import os
import sys
from decimal import Decimal
from datetime import datetime, timezone, timedelta
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver
from aws_lambda_powertools.utilities.typing import LambdaContext

# 共有モジュールのインポート（Lambda Layerから）
sys.path.insert(0, '/opt/python')
from shared.tenant_context import TenantContextManager, ContextNotFoundError

logger = Logger()
app = APIGatewayHttpResolver(strip_prefixes=["/dev"])

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ.get('DOCUMENTS_TABLE', 'documents'))
s3_client = boto3.client('s3')
bedrock_agent = boto3.client('bedrock-agent')
BUCKET_NAME = os.environ.get('DOCUMENTS_BUCKET', '')
KNOWLEDGE_BASE_ID = os.environ.get('KNOWLEDGE_BASE_ID', '')
DATA_SOURCE_ID = os.environ.get('DATA_SOURCE_ID', '')
MULTITENANT_MODE = os.environ.get('MULTITENANT_MODE', 'false').lower() == 'true'

def convert_decimals(obj):
    if isinstance(obj, list):
        return [convert_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj


def get_tenant_context_from_authorizer():
    """
    Lambda Authorizerから渡されたテナントコンテキストを取得します。
    
    Returns:
        テナントコンテキスト情報の辞書、またはNone（スタンドアロンモード時）
    """
    if not MULTITENANT_MODE:
        return None
    
    try:
        # API Gatewayのauthorizerコンテキストから取得
        request_context = app.current_event.request_context
        authorizer = request_context.get('authorizer', {})
        
        # Lambda Authorizerから渡されたコンテキスト
        tenant_name = authorizer.get('tenant_name')
        tenant_id = authorizer.get('tenant_id')
        username = authorizer.get('username')
        role = authorizer.get('role')
        user_id = authorizer.get('user_id')
        
        if tenant_name and tenant_id:
            # テナントコンテキストを作成
            context_data = {
                'custom:tenant_name': tenant_name,
                'name': username,
                'custom:role': role,
                'sub': user_id
            }
            TenantContextManager.create_context(context_data, tenant_id)
            
            logger.info(
                "テナントコンテキストを設定しました",
                extra={
                    'tenant_name': tenant_name,
                    'tenant_id': tenant_id,
                    'username': username
                }
            )
            return {
                'tenant_name': tenant_name,
                'tenant_id': tenant_id,
                'username': username,
                'role': role
            }
        else:
            logger.warning("Authorizerコンテキストにテナント情報がありません")
            return None
            
    except Exception as e:
        logger.error(f"テナントコンテキスト取得エラー: {str(e)}")
        return None

@app.get("/documents")
def list_documents():
    """
    文書一覧取得API
    
    クエリパラメータ:
        topCategory (optional): 大カテゴリIDでフィルタリング
        categories (optional): サブカテゴリIDでフィルタリング（カンマ区切り）
        title (optional): タイトルで部分一致検索
    
    戻り値:
        documents: 文書リスト
        count: 文書数
    """
    # テナントコンテキストの取得
    tenant_context = get_tenant_context_from_authorizer()
    
    params = app.current_event.query_string_parameters or {}
    
    scan_kwargs = {}
    filter_expressions = []
    expr_attr_values = {}
    
    # 将来の拡張: テナントIDでフィルタリング
    # if tenant_context and tenant_context.get('tenant_id'):
    #     filter_expressions.append('tenant_id = :tenantId')
    #     expr_attr_values[':tenantId'] = tenant_context['tenant_id']
    
    # 大カテゴリフィルタ
    if params.get('topCategory'):
        filter_expressions.append('topCategory = :topCat')
        expr_attr_values[':topCat'] = params['topCategory']
    
    # サブカテゴリフィルタ
    if params.get('categories'):
        cat_ids = params['categories'].split(',')
        cat_conditions = []
        for i, cat_id in enumerate(cat_ids):
            cat_conditions.append(f'contains(categories, :cat{i})')
            expr_attr_values[f':cat{i}'] = cat_id
        filter_expressions.append(f"({' OR '.join(cat_conditions)})")
    
    # タイトル検索（部分一致）
    if params.get('title'):
        filter_expressions.append('contains(title, :title)')
        expr_attr_values[':title'] = params['title']
    
    # フィルタ式を結合
    if filter_expressions:
        scan_kwargs['FilterExpression'] = ' AND '.join(filter_expressions)
        scan_kwargs['ExpressionAttributeValues'] = expr_attr_values
    
    result = table.scan(**scan_kwargs)
    items = [convert_decimals(item) for item in result.get('Items', [])]
    
    log_extra = {'document_count': len(items)}
    if tenant_context:
        log_extra.update({
            'tenant_name': tenant_context.get('tenant_name'),
            'tenant_id': tenant_context.get('tenant_id')
        })
    
    logger.info(f"文書一覧を取得しました: {len(items)}件", extra=log_extra)
    return {'documents': items, 'count': len(items)}

@app.get("/documents/<id>")
def get_document(id: str):
    """
    文書詳細取得API
    
    パスパラメータ:
        doc_id: 文書ID
    
    戻り値:
        文書の詳細情報（署名付きダウンロードURL含む）
    
    エラー:
        404: 文書が見つからない場合
    """
    # テナントコンテキストの取得
    tenant_context = get_tenant_context_from_authorizer()
    
    result = table.get_item(Key={'id': id})
    
    if 'Item' not in result:
        log_extra = {'document_id': id}
        if tenant_context:
            log_extra.update({
                'tenant_name': tenant_context.get('tenant_name'),
                'tenant_id': tenant_context.get('tenant_id')
            })
        logger.warning(f"文書が見つかりません: {id}", extra=log_extra)
        return {'error': 'Document not found'}, 404
    
    item = convert_decimals(result['Item'])
    
    # fileKeyがある場合、署名付きダウンロードURLを生成
    if item.get('fileKey'):
        try:
            download_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': BUCKET_NAME,
                    'Key': item['fileKey']
                },
                ExpiresIn=3600  # 1時間有効
            )
            item['downloadUrl'] = download_url
        except Exception as e:
            logger.error(f"ダウンロードURL生成失敗: {str(e)}")
    
    log_extra = {'document_id': id}
    if tenant_context:
        log_extra.update({
            'tenant_name': tenant_context.get('tenant_name'),
            'tenant_id': tenant_context.get('tenant_id')
        })
    logger.info(f"文書詳細を取得しました: {id}", extra=log_extra)
    return item

@app.post("/documents/upload-url")
def get_upload_url():
    """
    S3署名付きURL生成API
    
    リクエストボディ:
        fileName: ファイル名
        fileType: ファイルタイプ
    
    戻り値:
        uploadUrl: 署名付きURL
        fileKey: S3キー
    """
    # テナントコンテキストの取得
    tenant_context = get_tenant_context_from_authorizer()
    
    body = app.current_event.json_body
    file_name = body.get('fileName')
    file_type = body.get('fileType', 'application/pdf')
    
    # ユニークなS3キーを生成
    jst = timezone(timedelta(hours=9))
    timestamp = int(datetime.now(jst).timestamp() * 1000)
    file_key = f"documents/{timestamp}_{file_name}"
    
    # 署名付きURLを生成（有効期限5分）
    upload_url = s3_client.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': BUCKET_NAME,
            'Key': file_key,
            'ContentType': file_type
        },
        ExpiresIn=300
    )
    
    log_extra = {'file_key': file_key}
    if tenant_context:
        log_extra.update({
            'tenant_name': tenant_context.get('tenant_name'),
            'tenant_id': tenant_context.get('tenant_id')
        })
    logger.info(f"アップロードURLを生成しました: {file_key}", extra=log_extra)
    return {'uploadUrl': upload_url, 'fileKey': file_key}

@app.post("/documents")
def create_document():
    """
    文書登録API
    
    リクエストボディ:
        type: 文書種類
        title: タイトル
        department: 発番部署
        number: 発番番号
        division: 部署
        date: 日付
        endDate: 表示終了日
        fileKey: S3ファイルキー
        fileName: ファイル名
    
    戻り値:
        登録された文書情報（ステータス: 201）
    """
    # テナントコンテキストの取得
    tenant_context = get_tenant_context_from_authorizer()
    
    body = app.current_event.json_body
    jst = timezone(timedelta(hours=9))
    doc_id = str(int(datetime.now(jst).timestamp() * 1000))
    
    item = {
        'id': doc_id,
        'createdAt': datetime.now(jst).isoformat(),
        'updatedAt': datetime.now(jst).isoformat(),
        'status': 'draft'
    }
    
    # 将来の拡張: テナントIDを保存
    # if tenant_context and tenant_context.get('tenant_id'):
    #     item['tenant_id'] = tenant_context['tenant_id']
    
    # None値と空文字列を除外して追加
    for key in ['type', 'title', 'department', 'number', 'division', 'date', 'endDate',
                'personInCharge', 'internalContact', 'externalContact', 'email', 
                'distributionTarget', 'fileKey', 'fileName', 'topCategory']:
        value = body.get(key)
        if value is not None and value != '':
            item[key] = value
    
    # categoriesはリスト型
    if body.get('categories'):
        item['categories'] = body['categories']
    
    table.put_item(Item=item)
    
    log_extra = {'document_id': doc_id}
    if tenant_context:
        log_extra.update({
            'tenant_name': tenant_context.get('tenant_name'),
            'tenant_id': tenant_context.get('tenant_id')
        })
    logger.info(f"文書を登録しました: {doc_id}", extra=log_extra)
    
    # PDFファイルがアップロードされた場合、Knowledge Baseを同期
    if item.get('fileKey') and item['fileKey'].endswith('.pdf'):
        try:
            bedrock_agent.start_ingestion_job(
                knowledgeBaseId=KNOWLEDGE_BASE_ID,
                dataSourceId=DATA_SOURCE_ID
            )
            logger.info(f"Knowledge Base同期を開始しました: {item['fileKey']}")
        except Exception as e:
            logger.error(f"Knowledge Base同期失敗: {str(e)}")
    
    return convert_decimals(item), 201

@app.put("/documents/<id>")
def update_document(id: str):
    """
    文書更新API
    
    パスパラメータ:
        doc_id: 文書ID
    
    リクエストボディ:
        type: 文書種類（任意）
        title: タイトル（任意）
        department: 発番部署（任意）
        number: 発番番号（任意）
        division: 部署（任意）
        endDate: 表示終了日（任意）
    
    戻り値:
        更新された文書情報
    """
    # テナントコンテキストの取得
    tenant_context = get_tenant_context_from_authorizer()
    
    body = app.current_event.json_body
    jst = timezone(timedelta(hours=9))
    
    update_expr = 'SET updatedAt = :updated'
    expr_values = {':updated': datetime.now(jst).isoformat()}
    
    for key in ['type', 'title', 'department', 'number', 'division', 'endDate']:
        if key in body:
            update_expr += f', {key} = :{key}'
            expr_values[f':{key}'] = body[key]
    
    result = table.update_item(
        Key={'id': id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_values,
        ReturnValues='ALL_NEW'
    )
    
    log_extra = {'document_id': id}
    if tenant_context:
        log_extra.update({
            'tenant_name': tenant_context.get('tenant_name'),
            'tenant_id': tenant_context.get('tenant_id')
        })
    logger.info(f"文書を更新しました: {id}", extra=log_extra)
    return convert_decimals(result['Attributes'])

@app.delete("/documents/<id>")
def delete_document(id: str):
    """
    文書削除API（物理削除）
    
    パスパラメータ:
        doc_id: 文書ID
    
    処理:
        DynamoDBから文書を物理削除
    
    戻り値:
        削除完了メッセージ
    
    エラー:
        404: 文書が見つからない場合
    """
    # テナントコンテキストの取得
    tenant_context = get_tenant_context_from_authorizer()
    
    try:
        # 削除前に文書の存在確認
        result = table.get_item(Key={'id': id})
        if 'Item' not in result:
            log_extra = {'document_id': id}
            if tenant_context:
                log_extra.update({
                    'tenant_name': tenant_context.get('tenant_name'),
                    'tenant_id': tenant_context.get('tenant_id')
                })
            logger.warning(f"削除対象の文書が見つかりません: {id}", extra=log_extra)
            return {'error': 'Document not found'}, 404
        
        # 物理削除を実行
        table.delete_item(Key={'id': id})
        
        log_extra = {'document_id': id}
        if tenant_context:
            log_extra.update({
                'tenant_name': tenant_context.get('tenant_name'),
                'tenant_id': tenant_context.get('tenant_id')
            })
        logger.info(f"文書を削除しました: {id}", extra=log_extra)
        return {'message': 'Document deleted successfully'}
    except Exception as e:
        logger.error(f"文書削除エラー {id}: {str(e)}")
        return {'error': 'Failed to delete document'}, 500

@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    logger.info(f"Received event: {event}")
    return app.resolve(event, context)

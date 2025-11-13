import os
from decimal import Decimal
from datetime import datetime, timezone, timedelta
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
app = APIGatewayHttpResolver(strip_prefixes=["/dev"])

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ.get('DOCUMENTS_TABLE', 'documents'))
s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get('DOCUMENTS_BUCKET', '')

def convert_decimals(obj):
    if isinstance(obj, list):
        return [convert_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj

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
    params = app.current_event.query_string_parameters or {}
    
    scan_kwargs = {}
    filter_expressions = []
    expr_attr_values = {}
    
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
    
    logger.info(f"Retrieved {len(items)} documents")
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
    result = table.get_item(Key={'id': id})
    
    if 'Item' not in result:
        logger.warning(f"Document not found: {id}")
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
            logger.error(f"Failed to generate download URL: {str(e)}")
    
    logger.info(f"Retrieved document: {id}")
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
    
    logger.info(f"Generated upload URL for: {file_key}")
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
    body = app.current_event.json_body
    jst = timezone(timedelta(hours=9))
    doc_id = str(int(datetime.now(jst).timestamp() * 1000))
    
    item = {
        'id': doc_id,
        'createdAt': datetime.now(jst).isoformat(),
        'updatedAt': datetime.now(jst).isoformat(),
        'status': 'draft'
    }
    
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
    logger.info(f"Created document: {doc_id}")
    
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
    
    logger.info(f"Updated document: {id}")
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
    try:
        # 削除前に文書の存在確認
        result = table.get_item(Key={'id': id})
        if 'Item' not in result:
            logger.warning(f"Document not found for deletion: {id}")
            return {'error': 'Document not found'}, 404
        
        # 物理削除を実行
        table.delete_item(Key={'id': id})
        
        logger.info(f"Deleted document: {id}")
        return {'message': 'Document deleted successfully'}
    except Exception as e:
        logger.error(f"Error deleting document {id}: {str(e)}")
        return {'error': 'Failed to delete document'}, 500

@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    logger.info(f"Received event: {event}")
    return app.resolve(event, context)

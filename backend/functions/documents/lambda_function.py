import os
from decimal import Decimal
from datetime import datetime
import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayRestResolver
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
tracer = Tracer()
app = APIGatewayRestResolver()

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ.get('DOCUMENTS_TABLE', 'documents'))

def convert_decimals(obj):
    if isinstance(obj, list):
        return [convert_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj

@app.get("/documents")
@tracer.capture_method
def list_documents():
    """
    文書一覧取得API
    
    クエリパラメータ:
        category (optional): カテゴリでフィルタリング
    
    戻り値:
        documents: 文書リスト
        count: 文書数
    """
    params = app.current_event.query_string_parameters or {}
    
    scan_kwargs = {}
    if params.get('category'):
        scan_kwargs['FilterExpression'] = 'category = :cat'
        scan_kwargs['ExpressionAttributeValues'] = {':cat': params['category']}
    
    result = table.scan(**scan_kwargs)
    items = [convert_decimals(item) for item in result.get('Items', [])]
    
    logger.info(f"Retrieved {len(items)} documents")
    return {'documents': items, 'count': len(items)}

@app.get("/documents/<doc_id>")
@tracer.capture_method
def get_document(doc_id: str):
    """
    文書詳細取得API
    
    パスパラメータ:
        doc_id: 文書ID
    
    戻り値:
        文書の詳細情報
    
    エラー:
        404: 文書が見つからない場合
    """
    result = table.get_item(Key={'id': doc_id})
    
    if 'Item' not in result:
        logger.warning(f"Document not found: {doc_id}")
        return {'error': 'Document not found'}, 404
    
    logger.info(f"Retrieved document: {doc_id}")
    return convert_decimals(result['Item'])

@app.post("/documents")
@tracer.capture_method
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
    
    戻り値:
        登録された文書情報（ステータス: 201）
    """
    body = app.current_event.json_body
    doc_id = str(int(datetime.now().timestamp() * 1000))
    
    item = {
        'id': doc_id,
        'type': body.get('type'),
        'title': body.get('title'),
        'department': body.get('department'),
        'number': body.get('number'),
        'division': body.get('division'),
        'date': body.get('date'),
        'endDate': body.get('endDate'),
        'createdAt': datetime.now().isoformat(),
        'updatedAt': datetime.now().isoformat(),
        'status': 'draft'
    }
    
    table.put_item(Item=item)
    logger.info(f"Created document: {doc_id}")
    
    return convert_decimals(item), 201

@app.put("/documents/<doc_id>")
@tracer.capture_method
def update_document(doc_id: str):
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
    
    update_expr = 'SET updatedAt = :updated'
    expr_values = {':updated': datetime.now().isoformat()}
    
    for key in ['type', 'title', 'department', 'number', 'division', 'endDate']:
        if key in body:
            update_expr += f', {key} = :{key}'
            expr_values[f':{key}'] = body[key]
    
    result = table.update_item(
        Key={'id': doc_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_values,
        ReturnValues='ALL_NEW'
    )
    
    logger.info(f"Updated document: {doc_id}")
    return convert_decimals(result['Attributes'])

@app.delete("/documents/<doc_id>")
@tracer.capture_method
def delete_document(doc_id: str):
    """
    文書削除API（論理削除）
    
    パスパラメータ:
        doc_id: 文書ID
    
    処理:
        文書のステータスを'deleted'に更新（物理削除はしない）
    
    戻り値:
        削除完了メッセージ
    """
    table.update_item(
        Key={'id': doc_id},
        UpdateExpression='SET #status = :status, updatedAt = :updated',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={
            ':status': 'deleted',
            ':updated': datetime.now().isoformat()
        }
    )
    
    logger.info(f"Deleted document: {doc_id}")
    return {'message': 'Document deleted'}

@logger.inject_lambda_context
@tracer.capture_lambda_handler
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)

import os
import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayRestResolver
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
tracer = Tracer()
app = APIGatewayRestResolver()

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ.get('DOCUMENTS_TABLE', 'documents'))

@app.get("/external/documents")
@tracer.capture_method
def get_external_documents():
    """
    外部API - 文書一覧取得（GCP連携用）
    
    認証:
        X-API-KeyヘッダーでAPIキー認証
    
    処理:
        - APIキー検証
        - 公開中（status='published'）の文書のみ取得
        - 権限フィルタ適用
    
    戻り値:
        documents: 公開文書リスト
        count: 文書数
    
    エラー:
        401: APIキーが無効または不正
    """
    api_key = app.current_event.get_header_value('X-API-Key')
    
    if not api_key or api_key != os.environ.get('EXTERNAL_API_KEY'):
        logger.warning("Unauthorized access attempt")
        return {'error': 'Unauthorized'}, 401
    
    result = table.scan(
        FilterExpression='#status = :status',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={':status': 'published'}
    )
    
    items = result.get('Items', [])
    logger.info(f"Retrieved {len(items)} published documents for external API")
    
    return {'documents': items, 'count': len(items)}

@logger.inject_lambda_context
@tracer.capture_lambda_handler
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)

from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayRestResolver
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
app = APIGatewayRestResolver()

@app.post("/search")
def search():
    """
    文書検索API（将来実装）
    
    予定機能:
        - キーワード検索
        - RAG検索（OpenSearch + Bedrock）
        - ベクトル検索
    
    リクエストボディ（予定）:
        query: 検索クエリ
        filters: フィルタ条件
    
    戻り値（予定）:
        results: 検索結果
        summary: AI生成要約
    """
    logger.info("Search API called - To be implemented")
    return {'message': 'Search API - To be implemented'}

@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)

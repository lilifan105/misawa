import os
import json
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver
from aws_lambda_powertools.utilities.typing import LambdaContext
from typing import Dict, List, Any

logger = Logger()
app = APIGatewayHttpResolver(strip_prefixes=["/dev"])

# Bedrock Agent Runtimeクライアント初期化
bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')

# 環境変数からKnowledge Base IDを取得
KNOWLEDGE_BASE_ID = os.environ.get('KNOWLEDGE_BASE_ID', '')

@app.post("/search")
def search():
    """
    RAG全文検索API
    
    Bedrock Knowledge Baseを使用してベクトル検索を実行し、
    関連する文書チャンクを返す。
    
    リクエストボディ:
        query: 検索クエリ（必須）
        numberOfResults: 取得する結果数（オプション、デフォルト: 10）
    
    戻り値:
        results: 検索結果リスト
            - documentId: 文書ID
            - title: 文書タイトル
            - content: マッチしたテキストチャンク
            - score: 関連度スコア
            - s3Uri: S3ファイルパス
            - metadata: メタデータ（ページ番号など）
    """
    try:
        # リクエストボディを取得
        body = app.current_event.json_body
        query = body.get('query', '')
        number_of_results = body.get('numberOfResults', 10)
        
        # クエリが空の場合はエラー
        if not query:
            return {
                'statusCode': 400,
                'body': {'error': 'クエリが指定されていません'}
            }
        
        # Knowledge Base IDが設定されていない場合はエラー
        if not KNOWLEDGE_BASE_ID:
            logger.error('KNOWLEDGE_BASE_ID環境変数が設定されていません')
            return {
                'statusCode': 500,
                'body': {'error': 'Knowledge Baseが設定されていません'}
            }
        
        logger.info(f"検索クエリ: {query}, 結果数: {number_of_results}")
        
        # Bedrock Knowledge Base Retrieve APIを呼び出し
        response = bedrock_agent_runtime.retrieve(
            knowledgeBaseId=KNOWLEDGE_BASE_ID,
            retrievalQuery={
                'text': query
            },
            retrievalConfiguration={
                'vectorSearchConfiguration': {
                    'numberOfResults': number_of_results
                }
            }
        )
        
        # 検索結果を整形
        results = []
        for item in response.get('retrievalResults', []):
            # コンテンツを取得
            content = item.get('content', {})
            text = content.get('text', '')
            
            # ロケーション情報を取得
            location = item.get('location', {})
            s3_location = location.get('s3Location', {})
            s3_uri = s3_location.get('uri', '')
            
            # メタデータを取得
            metadata = item.get('metadata', {})
            
            # S3 URIから文書IDを抽出（例: s3://bucket/documents/doc123.pdf -> doc123）
            document_id = ''
            if s3_uri:
                parts = s3_uri.split('/')
                if len(parts) > 0:
                    filename = parts[-1]
                    document_id = filename.rsplit('.', 1)[0]
            
            # 結果を追加
            results.append({
                'documentId': document_id,
                'title': metadata.get('title', document_id),
                'content': text,
                'score': item.get('score', 0),
                's3Uri': s3_uri,
                'metadata': metadata
            })
        
        logger.info(f"検索結果: {len(results)}件")
        
        return {
            'statusCode': 200,
            'body': {
                'query': query,
                'results': results,
                'totalResults': len(results)
            }
        }
        
    except Exception as e:
        logger.exception(f"検索エラー: {str(e)}")
        return {
            'statusCode': 500,
            'body': {'error': f'検索に失敗しました: {str(e)}'}
        }

@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)

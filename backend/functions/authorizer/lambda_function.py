"""
Lambda Authorizer関数

API Gatewayレベルでの認証・認可を実施します。
JWTトークンを検証し、テナントのサブスクリプションを確認して、
IAMポリシーを返します。
"""

import os
import json
import logging
from typing import Dict, Any

# 共有モジュールのインポート
import sys
sys.path.insert(0, '/opt/python')  # Lambda Layerのパス

from shared.jwt_validator import JWTValidator, InvalidTokenError, MissingClaimError
from shared.rds_connection import get_rds_connection, ConnectionError as RDSConnectionError
from shared.subscription_validator import SubscriptionValidator


# ロギング設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)


# 環境変数の取得
COGNITO_REGION = os.environ.get('COGNITO_REGION', 'ap-northeast-1')
COGNITO_USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')
MULTITENANT_RDS_HOST = os.environ.get('MULTITENANT_RDS_HOST')
MULTITENANT_RDS_PORT = int(os.environ.get('MULTITENANT_RDS_PORT', '5432'))
MULTITENANT_RDS_DATABASE = os.environ.get('MULTITENANT_RDS_DATABASE', 'multitenant')
MULTITENANT_RDS_USER = os.environ.get('MULTITENANT_RDS_USER')
MULTITENANT_RDS_PASSWORD = os.environ.get('MULTITENANT_RDS_PASSWORD')
DOCUMENT_SERVICE_ID = os.environ.get('DOCUMENT_SERVICE_ID')
MULTITENANT_MODE = os.environ.get('MULTITENANT_MODE', 'false').lower() == 'true'


# グローバル変数（Lambda実行環境で再利用）
jwt_validator = None
rds_connection = None
subscription_validator = None


def initialize_components():
    """
    コンポーネントを初期化します。
    Lambda実行環境で再利用されるため、初回のみ実行されます。
    """
    global jwt_validator, rds_connection, subscription_validator
    
    if jwt_validator is None:
        logger.info("JWT Validatorを初期化中...")
        jwt_validator = JWTValidator(
            region=COGNITO_REGION,
            user_pool_id=COGNITO_USER_POOL_ID
        )
    
    if rds_connection is None:
        logger.info("RDS接続を初期化中...")
        rds_connection = get_rds_connection(
            host=MULTITENANT_RDS_HOST,
            port=MULTITENANT_RDS_PORT,
            database=MULTITENANT_RDS_DATABASE,
            user=MULTITENANT_RDS_USER,
            password=MULTITENANT_RDS_PASSWORD
        )
    
    if subscription_validator is None:
        logger.info("Subscription Validatorを初期化中...")
        subscription_validator = SubscriptionValidator(
            rds_connection=rds_connection,
            service_id=DOCUMENT_SERVICE_ID
        )


def extract_token_from_header(event: Dict[str, Any]) -> str:
    """
    Authorizationヘッダーからトークンを抽出します。
    
    Args:
        event: API Gateway authorizerイベント
        
    Returns:
        JWTトークン文字列
        
    Raises:
        ValueError: トークンが見つからない場合
    """
    # API Gateway v2形式
    headers = event.get('headers', {})
    
    # ヘッダー名は大文字小文字を区別しない
    auth_header = None
    for key, value in headers.items():
        if key.lower() == 'authorization':
            auth_header = value
            break
    
    if not auth_header:
        raise ValueError("Authorizationヘッダーが見つかりません")
    
    # "Bearer <token>"形式からトークンを抽出
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        raise ValueError("無効なAuthorizationヘッダー形式です")
    
    return parts[1]


def generate_policy(
    principal_id: str,
    effect: str,
    resource: str,
    context: Dict[str, str] = None
) -> Dict[str, Any]:
    """
    IAMポリシードキュメントを生成します。
    
    Args:
        principal_id: プリンシパルID（通常はユーザーID）
        effect: "Allow"または"Deny"
        resource: リソースARN
        context: コンテキスト情報（Lambda関数に渡される）
        
    Returns:
        IAMポリシードキュメント
    """
    policy = {
        'principalId': principal_id,
        'policyDocument': {
            'Version': '2012-10-17',
            'Statement': [
                {
                    'Action': 'execute-api:Invoke',
                    'Effect': effect,
                    'Resource': resource
                }
            ]
        }
    }
    
    if context:
        policy['context'] = context
    
    return policy


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda Authorizerのメインハンドラー。
    
    Args:
        event: API Gateway authorizerイベント
        context: Lambdaコンテキスト
        
    Returns:
        IAMポリシードキュメント
    """
    # リクエストIDをログに記録
    request_id = context.request_id if hasattr(context, 'request_id') else 'unknown'
    logger.info(f"認証リクエスト開始: request_id={request_id}")
    
    # マルチテナントモードが無効の場合は常に許可
    if not MULTITENANT_MODE:
        logger.info("スタンドアロンモード: 認証をスキップ")
        return generate_policy(
            principal_id='standalone-user',
            effect='Allow',
            resource=event.get('methodArn', '*')
        )
    
    try:
        # コンポーネントの初期化
        initialize_components()
        
        # トークンの抽出
        try:
            token = extract_token_from_header(event)
            logger.info("トークンを抽出しました")
        except ValueError as e:
            logger.warning(f"トークン抽出失敗: {str(e)}")
            return generate_policy(
                principal_id='unknown',
                effect='Deny',
                resource=event.get('methodArn', '*')
            )
        
        # JWTトークンの検証
        try:
            claims = jwt_validator.validate_token(token)
            tenant_name = claims['custom:tenant_name']
            username = claims['name']
            role = claims['custom:role']
            user_id = claims['sub']
            
            logger.info(
                f"トークン検証成功: tenant_name={tenant_name}, "
                f"username={username}, role={role}"
            )
        except (InvalidTokenError, MissingClaimError) as e:
            logger.warning(f"トークン検証失敗: {str(e)}")
            return generate_policy(
                principal_id='unknown',
                effect='Deny',
                resource=event.get('methodArn', '*')
            )
        
        # テナントIDの取得
        try:
            tenant_id = subscription_validator.get_tenant_id(tenant_name)
            if not tenant_id:
                logger.warning(f"テナントが見つかりません: tenant_name={tenant_name}")
                return generate_policy(
                    principal_id=user_id,
                    effect='Deny',
                    resource=event.get('methodArn', '*')
                )
            
            logger.info(f"テナントID取得成功: tenant_id={tenant_id}")
        except Exception as e:
            logger.error(f"テナントID取得エラー: {str(e)}")
            return generate_policy(
                principal_id=user_id,
                effect='Deny',
                resource=event.get('methodArn', '*')
            )
        
        # サブスクリプションの確認
        try:
            has_subscription = subscription_validator.check_subscription(tenant_id)
            if not has_subscription:
                logger.warning(
                    f"アクティブなサブスクリプションがありません: "
                    f"tenant_id={tenant_id}, service_id={DOCUMENT_SERVICE_ID}"
                )
                return generate_policy(
                    principal_id=user_id,
                    effect='Deny',
                    resource=event.get('methodArn', '*')
                )
            
            logger.info(f"サブスクリプション確認成功: tenant_id={tenant_id}")
        except Exception as e:
            logger.error(f"サブスクリプション確認エラー: {str(e)}")
            return generate_policy(
                principal_id=user_id,
                effect='Deny',
                resource=event.get('methodArn', '*')
            )
        
        # 認証・認可成功 - Allowポリシーを返す
        logger.info(
            f"認証・認可成功: tenant_name={tenant_name}, "
            f"tenant_id={tenant_id}, username={username}, action=allow"
        )
        
        return generate_policy(
            principal_id=user_id,
            effect='Allow',
            resource=event.get('methodArn', '*'),
            context={
                'tenant_name': tenant_name,
                'tenant_id': tenant_id,
                'username': username,
                'role': role,
                'user_id': user_id
            }
        )
        
    except RDSConnectionError as e:
        # データベース接続エラー
        logger.error(f"データベース接続エラー: {str(e)}")
        return generate_policy(
            principal_id='unknown',
            effect='Deny',
            resource=event.get('methodArn', '*')
        )
    
    except Exception as e:
        # 予期しないエラー
        logger.error(f"予期しないエラー: {str(e)}", exc_info=True)
        return generate_policy(
            principal_id='unknown',
            effect='Deny',
            resource=event.get('methodArn', '*')
        )

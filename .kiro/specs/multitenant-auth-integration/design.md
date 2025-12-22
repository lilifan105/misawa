# 設計書

## 概要

本設計書は、文書管理システムをマルチテナントSaaSプラットフォームの一部として統合するための認証・認可機能の詳細設計を記述する。マルチテナントサービスから発行されたCognito JWTトークンを検証し、RDS PostgreSQLデータベースでテナントのサービスアクセス権限を確認し、すべてのバックエンドAPIで権限チェックを実施する。

## アーキテクチャ

### システム構成

```
マルチテナントサービス（親）
  ↓ JWT Token (Authorization Header)
文書管理システム（子）
  ├─ Frontend (Next.js)
  │   └─ JWT Token Storage & API Calls
  ├─ API Gateway
  │   └─ Lambda Authorizer (JWT Validation)
  ├─ Backend Lambda Functions
  │   ├─ JWT Verification Module
  │   ├─ Tenant Context Module
  │   └─ RDS Connection Module
  └─ RDS PostgreSQL (Multitenant DB)
      ├─ tenant table
      ├─ service table
      └─ tenant_service_subscription table
```

### データフロー

1. **認証フロー**
   - ユーザーがマルチテナントサービスでログイン
   - Cognitoが`custom:tenant_name`を含むJWTトークンを発行
   - マルチテナントサービスがJWTトークンをAuthorizationヘッダーに含めて文書管理システムにリダイレクト

2. **認可フロー**
   - 文書管理システムがJWTトークンを検証
   - `custom:tenant_name`を抽出してRDS PostgreSQLに接続
   - `tenant`テーブルで`tenant_name`を検索して`tenant_id`（UUID）を取得
   - `tenant_service_subscription`テーブルでアクティブなサブスクリプションを確認
   - アクセス許可/拒否を判定

3. **APIアクセスフロー**
   - フロントエンドがAuthorizationヘッダーにJWTトークンを含めてAPIを呼び出し
   - Lambda AuthorizerがJWTトークンを検証
   - バックエンドLambda関数がテナントコンテキストを作成
   - すべてのデータベースクエリに`tenant_id`フィルタを適用


## コンポーネントとインターフェース

### 1. JWT検証モジュール (backend/shared/jwt_validator.py)

**責務**: Cognito JWTトークンの検証とクレーム抽出

**インターフェース**:
```python
class JWTValidator:
    def __init__(self, region: str, user_pool_id: str):
        """
        Args:
            region: AWS region (e.g., 'ap-northeast-1')
            user_pool_id: Cognito User Pool ID
        """
        
    def validate_token(self, token: str) -> Dict[str, Any]:
        """
        JWTトークンを検証してクレームを返す
        
        Args:
            token: JWT token string
            
        Returns:
            Dict containing claims:
                - custom:tenant_name: str
                - name: str
                - custom:role: str
                - sub: str (user ID)
                - email: str
                
        Raises:
            InvalidTokenError: トークンが無効または期限切れ
            MissingClaimError: 必須クレームが欠落
        """
```

**実装詳細**:
- Cognitoの公開鍵（JWKS）をキャッシュ（TTL: 1時間）
- `python-jose`ライブラリを使用してトークン署名を検証
- 必須クレーム（`custom:tenant_name`, `name`, `custom:role`）の存在を確認
- トークンの有効期限を検証

### 2. テナントコンテキストモジュール (backend/shared/tenant_context.py)

**責務**: テナント情報の管理と伝播

**インターフェース**:
```python
@dataclass
class TenantContext:
    tenant_name: str  # custom:tenant_name from JWT
    tenant_id: str    # UUID from database
    username: str     # name from JWT
    role: str         # custom:role from JWT
    user_id: str      # sub from JWT
    
class TenantContextManager:
    def create_context(self, jwt_claims: Dict[str, Any], tenant_id: str) -> TenantContext:
        """
        JWTクレームからテナントコンテキストを作成
        
        Args:
            jwt_claims: Validated JWT claims
            tenant_id: Tenant UUID from database
            
        Returns:
            TenantContext instance
        """
        
    def get_current_context(self) -> TenantContext:
        """
        現在のリクエストのテナントコンテキストを取得
        
        Returns:
            Current TenantContext
            
        Raises:
            ContextNotFoundError: コンテキストが設定されていない
        """
```

**実装詳細**:
- リクエストスコープでテナントコンテキストを保持
- Lambda関数のイベントコンテキストに保存
- すべてのバックエンド処理でアクセス可能


### 3. RDS接続モジュール (backend/shared/rds_connection.py)

**責務**: マルチテナントサービスのRDS PostgreSQLへの接続管理

**インターフェース**:
```python
class RDSConnectionPool:
    def __init__(self, host: str, port: int, database: str, user: str, password: str):
        """
        Args:
            host: RDS endpoint
            port: Database port (default: 5432)
            database: Database name
            user: Database username
            password: Database password
        """
        
    def get_connection(self) -> psycopg2.connection:
        """
        接続プールから接続を取得
        
        Returns:
            Database connection
            
        Raises:
            ConnectionError: 接続失敗
        """
        
    def execute_query(self, query: str, params: tuple) -> List[Dict]:
        """
        SQLクエリを実行
        
        Args:
            query: SQL query with placeholders
            params: Query parameters
            
        Returns:
            Query results as list of dicts
            
        Raises:
            DatabaseError: クエリ実行失敗
        """
```

**実装詳細**:
- `psycopg2`接続プールを使用（min_conn=2, max_conn=10）
- SSL/TLS接続を強制（`sslmode=require`）
- 接続リトライロジック（最大3回、指数バックオフ）
- 接続タイムアウト: 5秒
- クエリタイムアウト: 30秒

### 4. サブスクリプション検証モジュール (backend/shared/subscription_validator.py)

**責務**: テナントのサービスアクセス権限確認

**インターフェース**:
```python
class SubscriptionValidator:
    def __init__(self, rds_pool: RDSConnectionPool, service_id: str):
        """
        Args:
            rds_pool: RDS connection pool
            service_id: Document management service UUID
        """
        
    def get_tenant_id(self, tenant_name: str) -> Optional[str]:
        """
        tenant_nameからtenant_id（UUID）を取得
        
        Args:
            tenant_name: Tenant name from JWT (custom:tenant_name)
            
        Returns:
            Tenant UUID or None if not found
        """
        
    def check_subscription(self, tenant_id: str) -> bool:
        """
        テナントのアクティブなサブスクリプションを確認
        
        Args:
            tenant_id: Tenant UUID
            
        Returns:
            True if active subscription exists, False otherwise
        """
        
    def get_subscription_details(self, tenant_id: str) -> Optional[Dict]:
        """
        サブスクリプション詳細を取得
        
        Args:
            tenant_id: Tenant UUID
            
        Returns:
            Subscription details (access_level, expires_at, etc.) or None
        """
```

**実装詳細**:
- `tenant`テーブルで`tenant_name`を検索してUUIDを取得
- `tenant_service_subscription`テーブルでアクティブなサブスクリプションを確認
- ステータスが`'active'`で`expires_at`が未来または`NULL`であることを確認
- 結果を5分間キャッシュ（Lambda環境変数で設定可能）


### 5. Lambda Authorizer (backend/functions/authorizer/lambda_function.py)

**責務**: API Gatewayレベルでの認証・認可

**インターフェース**:
```python
def lambda_handler(event: Dict, context: LambdaContext) -> Dict:
    """
    API Gateway Lambda Authorizer
    
    Args:
        event: API Gateway authorizer event containing token
        context: Lambda context
        
    Returns:
        IAM policy document allowing/denying access
        
    Context:
        Adds tenant_name, tenant_id, username, role to context
    """
```

**処理フロー**:
1. Authorizationヘッダーからトークンを抽出
2. JWTValidatorでトークンを検証
3. `custom:tenant_name`を抽出
4. SubscriptionValidatorでテナントIDとサブスクリプションを確認
5. アクセス許可の場合、IAM policyとコンテキストを返す
6. アクセス拒否の場合、Denyポリシーを返す

**返却値**:
```python
{
    "principalId": user_id,
    "policyDocument": {
        "Version": "2012-10-17",
        "Statement": [{
            "Action": "execute-api:Invoke",
            "Effect": "Allow",  # or "Deny"
            "Resource": event["methodArn"]
        }]
    },
    "context": {
        "tenant_name": "sample-company",
        "tenant_id": "uuid-here",
        "username": "user01",
        "role": "user"
    }
}
```

### 6. フロントエンド認証モジュール (frontend/lib/auth.ts)

**責務**: JWTトークンの管理とAPIリクエストへの付与

**インターフェース**:
```typescript
interface AuthManager {
  // トークンを保存（sessionStorageまたはメモリ）
  setToken(token: string): void;
  
  // トークンを取得
  getToken(): string | null;
  
  // トークンをクリア
  clearToken(): void;
  
  // トークンの有効性を確認
  isTokenValid(): boolean;
  
  // トークンからクレームを抽出（検証なし）
  getTokenClaims(): TokenClaims | null;
}

interface TokenClaims {
  'custom:tenant_name': string;
  name: string;
  'custom:role': string;
  sub: string;
  exp: number;
}
```

**実装詳細**:
- トークンをsessionStorageに保存（localStorageは使用しない）
- ページロード時にURLパラメータ`?token=xxx`からトークンを取得
- すべてのAPI呼び出しに`Authorization: Bearer ${token}`ヘッダーを追加
- 401エラー時にマルチテナントサービスのログインURLにリダイレクト
- ブラウザ閉じる時にトークンをクリア（`beforeunload`イベント）


### 7. アクセス拒否画面 (frontend/app/access-denied/page.tsx)

**責務**: アクセス権限がない場合のユーザーフレンドリーな画面表示

**コンポーネント構成**:
```typescript
interface AccessDeniedPageProps {
  tenantName: string;
  serviceName: string;
  contactEmail: string;
}

export default function AccessDeniedPage(props: AccessDeniedPageProps) {
  // アクセス拒否メッセージ
  // テナント名とサービス名の表示
  // システム管理者への連絡先情報
  // マルチテナントサービスへの戻るリンク
}
```

**表示内容**:
- タイトル: 「アクセス権限がありません」
- メッセージ: 「お客様のテナント（{tenantName}）は文書管理システムへのアクセス権限がありません」
- 説明: 「このサービスを利用するには、システム管理者にお問い合わせください」
- 連絡先: システム管理者のメールアドレス
- アクション: 「ポータルに戻る」ボタン

## データモデル

### RDS PostgreSQL テーブル（マルチテナントサービス側）

#### tenant テーブル
```sql
CREATE TABLE tenant (
    tenant_id UUID PRIMARY KEY,
    tenant_name VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL,
    contract_start_date DATE NOT NULL,
    auth_method VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

#### service テーブル
```sql
CREATE TABLE service (
    service_id UUID PRIMARY KEY,
    service_name VARCHAR(255) NOT NULL,
    description TEXT,
    service_url VARCHAR(500) NOT NULL,
    icon_url VARCHAR(500),
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

#### tenant_service_subscription テーブル
```sql
CREATE TABLE tenant_service_subscription (
    subscription_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenant(tenant_id),
    service_id UUID NOT NULL REFERENCES service(service_id),
    access_level VARCHAR(50) NOT NULL,
    subscribed_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    UNIQUE(tenant_id, service_id)
);
```

### サービス登録データ

文書管理システムをserviceテーブルに登録：
```sql
INSERT INTO service (
    service_id,
    service_name,
    description,
    service_url,
    icon_url,
    status
) VALUES (
    'uuid-for-document-management',
    '文書管理システム',
    '社内文書の登録・検索・管理を行うシステム',
    'https://documents.example.com',
    'https://cdn.example.com/icons/documents.png',
    'active'
);
```


## エラーハンドリング

### エラー種別と対応

| エラー種別 | HTTPステータス | 対応 |
|-----------|--------------|------|
| トークン欠落 | 401 Unauthorized | ログイン画面にリダイレクト |
| トークン無効 | 401 Unauthorized | ログイン画面にリダイレクト |
| トークン期限切れ | 401 Unauthorized | ログイン画面にリダイレクト |
| テナント未登録 | 403 Forbidden | アクセス拒否画面を表示 |
| サブスクリプションなし | 403 Forbidden | アクセス拒否画面を表示 |
| サブスクリプション期限切れ | 403 Forbidden | アクセス拒否画面を表示 |
| データベース接続エラー | 503 Service Unavailable | エラーページを表示 |
| 内部エラー | 500 Internal Server Error | エラーページを表示 |

### ログ記録

すべてのエラーは構造化ログとして記録：
```json
{
  "timestamp": "2025-12-22T10:30:00Z",
  "level": "ERROR",
  "tenant_name": "sample-company",
  "tenant_id": "uuid-here",
  "username": "user01",
  "action": "validate_token",
  "result": "failed",
  "error_type": "InvalidTokenError",
  "error_message": "Token signature verification failed",
  "request_id": "request-uuid"
}
```

## テスト戦略

### ユニットテスト

各モジュールの個別機能をテスト：
- JWT検証ロジック（有効/無効/期限切れトークン）
- テナントID解決ロジック
- サブスクリプション確認ロジック
- データベース接続とクエリ実行

### 統合テスト

モジュール間の連携をテスト：
- JWT検証 → テナントID解決 → サブスクリプション確認の一連の流れ
- Lambda Authorizerの完全なフロー
- フロントエンドからバックエンドAPIへのリクエスト

### E2Eテスト

実際のユーザーシナリオをテスト：
- 有効なトークンでアクセス → 正常に画面表示
- 無効なトークンでアクセス → ログイン画面にリダイレクト
- サブスクリプションなしでアクセス → アクセス拒否画面表示
- API呼び出し → 正常にデータ取得

## セキュリティ考慮事項

### トークン管理
- トークンをlocalStorageに保存しない（XSS攻撃対策）
- sessionStorageまたはメモリのみに保存
- HTTPS通信を強制
- トークンの有効期限を厳密にチェック

### データベースアクセス
- SSL/TLS接続を強制
- 最小権限の原則（読み取り専用アクセス）
- 接続情報を環境変数で管理
- SQLインジェクション対策（パラメータ化クエリ）

### テナント分離
- すべてのクエリに`tenant_id`フィルタを強制
- クロステナントアクセスの防止
- ログにテナント情報を記録

### エラーメッセージ
- 詳細なエラー情報をクライアントに返さない
- ログには詳細情報を記録
- ユーザーフレンドリーなエラーメッセージを表示


## 環境変数設定

### バックエンド Lambda 関数

```bash
# Cognito設定
COGNITO_REGION=ap-northeast-1
COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx

# RDS接続設定
MULTITENANT_RDS_HOST=multitenant-db.xxxxxxxxx.ap-northeast-1.rds.amazonaws.com
MULTITENANT_RDS_PORT=5432
MULTITENANT_RDS_DATABASE=multitenant
MULTITENANT_RDS_USER=readonly_user
MULTITENANT_RDS_PASSWORD=<secure-password>

# サービス設定
DOCUMENT_SERVICE_ID=uuid-for-document-management

# モード設定
MULTITENANT_MODE=true

# キャッシュ設定
SUBSCRIPTION_CACHE_TTL=300  # 5分
```

### フロントエンド

```bash
# API エンドポイント
NEXT_PUBLIC_API_ENDPOINT=https://api.documents.example.com

# マルチテナントサービスURL
NEXT_PUBLIC_MULTITENANT_URL=https://portal.example.com

# モード設定
NEXT_PUBLIC_MULTITENANT_MODE=true
```

## デプロイメント

### インフラストラクチャ変更

#### 1. Lambda Authorizer の追加

```terraform
resource "aws_lambda_function" "authorizer" {
  filename      = "authorizer.zip"
  function_name = "${var.project_name}-authorizer-${var.environment}"
  role          = aws_iam_role.authorizer_role.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.11"
  timeout       = 10
  
  environment {
    variables = {
      COGNITO_REGION          = var.cognito_region
      COGNITO_USER_POOL_ID    = var.cognito_user_pool_id
      MULTITENANT_RDS_HOST    = var.multitenant_rds_host
      MULTITENANT_RDS_PORT    = var.multitenant_rds_port
      MULTITENANT_RDS_DATABASE = var.multitenant_rds_database
      MULTITENANT_RDS_USER    = var.multitenant_rds_user
      MULTITENANT_RDS_PASSWORD = var.multitenant_rds_password
      DOCUMENT_SERVICE_ID     = var.document_service_id
      MULTITENANT_MODE        = "true"
    }
  }
  
  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda_sg.id]
  }
}
```

#### 2. API Gateway Authorizer の設定

```terraform
resource "aws_apigatewayv2_authorizer" "jwt_authorizer" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "REQUEST"
  authorizer_uri   = aws_lambda_function.authorizer.invoke_arn
  identity_sources = ["$request.header.Authorization"]
  name             = "jwt-authorizer"
  
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = false
}

# すべてのルートにAuthorizerを適用
resource "aws_apigatewayv2_route" "documents_list" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /documents"
  target             = "integrations/${aws_apigatewayv2_integration.documents.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_authorizer.id
}
```

#### 3. VPC とセキュリティグループ

Lambda関数がRDSにアクセスできるようにVPC設定：
```terraform
resource "aws_security_group" "lambda_sg" {
  name        = "${var.project_name}-lambda-sg"
  description = "Security group for Lambda functions"
  vpc_id      = var.vpc_id
  
  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.rds_cidr_block]
  }
  
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### デプロイ手順

1. **共有モジュールのデプロイ**
   ```bash
   cd backend/shared
   pip install -r requirements.txt -t .
   zip -r shared.zip .
   ```

2. **Lambda Authorizer のデプロイ**
   ```bash
   cd backend/functions/authorizer
   pip install -r requirements.txt -t .
   zip -r authorizer.zip .
   terraform apply
   ```

3. **既存Lambda関数の更新**
   - 共有モジュールをLambda Layerとして追加
   - 環境変数を更新

4. **フロントエンドの更新**
   ```bash
   cd frontend
   npm run build
   aws s3 sync out/ s3://your-bucket/
   ```

5. **サービス登録**
   - マルチテナントサービスのRDSに接続
   - serviceテーブルに文書管理システムを登録


## 正確性プロパティ

*プロパティとは、システムのすべての有効な実行において真であるべき特性または動作のことです。プロパティは、人間が読める仕様と機械で検証可能な正確性保証の橋渡しとなります。*

### プロパティ 1: JWT検証の一貫性

*任意の*有効なCognito JWTトークンに対して、JWT検証モジュールは常に同じクレームセット（custom:tenant_name、name、custom:role）を抽出し、無効なトークンに対しては常にエラーを発生させる

**検証: 要件 1.2, 1.3**

### プロパティ 2: テナント名解決の一意性

*任意の*tenant_nameに対して、データベースクエリは最大1つのtenant_id（UUID）を返し、同じtenant_nameに対する複数回のクエリは常に同じtenant_idを返す

**検証: 要件 2.2**

### プロパティ 3: サブスクリプション検証の正確性

*任意の*tenant_idとservice_idの組み合わせに対して、サブスクリプション検証は、tenant_service_subscriptionテーブルにstatus='active'かつexpires_atが未来またはNULLのレコードが存在する場合のみtrueを返す

**検証: 要件 2.3, 2.6**

### プロパティ 4: アクセス制御の完全性

*任意の*APIリクエストに対して、有効なJWTトークンとアクティブなサブスクリプションの両方が存在する場合のみアクセスが許可される

**検証: 要件 4.1, 4.3**

### プロパティ 5: テナント分離の保証

*任意の*データベースクエリに対して、クエリ結果に含まれるすべてのレコードは、リクエストコンテキストのtenant_idと一致するtenant_idを持つ

**検証: 要件 4.4, 7.3**

### プロパティ 6: トークンストレージの安全性

*任意の*JWTトークンに対して、フロントエンドはトークンをlocalStorageに保存せず、sessionStorageまたはメモリのみに保存する

**検証: 要件 6.4**

### プロパティ 7: エラーログの完全性

*任意の*認証または認可エラーに対して、ログエントリには必ずtimestamp、level、tenant_name、tenant_id、action、resultフィールドが含まれる

**検証: 要件 8.5**

### プロパティ 8: データベース接続の暗号化

*任意の*RDS接続に対して、接続は常にSSL/TLS暗号化を使用する（sslmode=require）

**検証: 要件 5.2**

### プロパティ 9: トークン有効期限の厳密性

*任意の*期限切れJWTトークン（exp < 現在時刻）に対して、JWT検証モジュールは常にInvalidTokenErrorを発生させる

**検証: 要件 1.5**

### プロパティ 10: モード切り替えの互換性

*任意の*環境設定（MULTITENANT_MODE=true/false）に対して、システムはコード変更なしに動作モードを切り替えられ、各モードで適切な認証フローを使用する

**検証: 要件 10.1, 10.5**

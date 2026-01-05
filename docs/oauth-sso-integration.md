# OAuth 2.0 SSO統合ガイド

## 概要

このドキュメントは、文書管理システムをマルチテナントポータルの外部サービスとして統合する方法を説明します。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│           マルチテナントポータル → 文書管理システム          │
└─────────────────────────────────────────────────────────────┘

1. ユーザーがポータルでサービスをクリック
   ↓
2. ポータルがOAuth 2.0認可フローを開始
   - PKCE (code_challenge, code_verifier)
   - state (CSRF対策)
   ↓
3. ポータルが認可コードを発行
   - pending_auth状態で発行（ユーザー情報は後で設定）
   ↓
4. ポータルのコールバックページが認可コードを受け取る
   ↓
5. ポータルのバックエンドAPIがトークン交換
   - client_secretはバックエンドで管理
   - pending_authを実際のユーザー情報に更新
   ↓
6. ポータルがトークンを取得
   - access_token: API呼び出し用（15分有効）
   - id_token: ユーザー情報取得用（1時間有効）
   - refresh_token: トークン更新用（30日有効）
   ↓
7. 文書管理システムにリダイレクト
   - URLパラメータ: ?access_token=xxx&id_token=yyy
```

## サービス登録

### 1. OAuthクライアント登録

文書管理システムをポータルのOAuthクライアントとして登録します：

```bash
curl -X POST https://portal.example.com/api/admin/oauth/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "client_name": "文書管理システム",
    "redirect_uris": ["https://portal.example.com/oauth/callback"],
    "allowed_scopes": ["openid", "profile", "email"]
  }'
```

レスポンス:
```json
{
  "client_id": "f5f6e5c9-9a3e-48f4-a467-97ede2a8b281",
  "client_secret": "secret-xxx-yyy-zzz",
  "client_name": "文書管理システム",
  "redirect_uris": ["https://portal.example.com/oauth/callback"],
  "allowed_scopes": ["openid", "profile", "email"],
  "created_at": "2025-12-23T00:00:00Z"
}
```

### 2. サービステーブル更新

ポータルのサービステーブルに文書管理システムを登録し、`oauth_client_id`を設定します：

```bash
curl -X POST https://portal.example.com/api/admin/services \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "service_id": "f5f6e5c9-9a3e-48f4-a467-97ede2a8b281",
    "service_name": "文書管理システム",
    "service_url": "https://documents.example.com",
    "oauth_client_id": "f5f6e5c9-9a3e-48f4-a467-97ede2a8b281",
    "description": "文書の登録・検索・管理を行うシステム",
    "icon_url": "https://documents.example.com/icon.png"
  }'
```

## 実装詳細

### フロントエンド実装

#### 1. トークン受け取り

文書管理システムは、ポータルから以下の形式でリダイレクトされます：

```
https://documents.example.com?access_token=xxx&id_token=yyy
```

`frontend/lib/auth.ts`の`initializeTokenFromUrl()`関数が自動的にトークンを取得して保存します：

```typescript
// OAuth 2.0形式のトークン（推奨）
const accessToken = urlParams.get('access_token');
const idToken = urlParams.get('id_token');

if (accessToken && idToken) {
  // sessionStorageに保存
  sessionStorage.setItem('multitenant_access_token', accessToken);
  sessionStorage.setItem('multitenant_id_token', idToken);
  
  // id_tokenをメイントークンとして保存（ユーザー情報取得用）
  authManager.setToken(idToken);
}
```

#### 2. トークン使用

API呼び出し時は、**`id_token`を使用します**（カスタム属性が含まれるため）：

```typescript
// frontend/lib/api.ts
function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  if (MULTITENANT_MODE) {
    // IDトークンを使用（カスタム属性が含まれる）
    // 重要: access_tokenにはカスタム属性が含まれない
    const token = getIdToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
}
```

**重要**: Cognitoのカスタム属性（`custom:tenant_name`、`custom:role`）はIDトークンにのみ含まれます。アクセストークンには含まれないため、API呼び出しにはIDトークンを使用する必要があります。

#### 3. ユーザー情報取得

ユーザー情報は`id_token`から取得します：

```typescript
// frontend/lib/auth.ts
export function getTenantInfo(): { tenantName: string; username: string; role: string } | null {
  const claims = authManager.getTokenClaims();
  if (!claims) {
    return null;
  }
  
  return {
    tenantName: claims['custom:tenant_name'],
    username: claims.name,
    role: claims['custom:role']
  };
}
```

### バックエンド実装

#### Lambda Authorizer

Lambda Authorizerは、**`id_token`を検証します**（カスタム属性が含まれるため）：

```python
# backend/functions/authorizer/lambda_function.py

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    # Authorizationヘッダーからトークンを抽出
    # 重要: フロントエンドはid_tokenを送信する（カスタム属性が含まれる）
    token = extract_token_from_header(event)
    
    # JWTトークンを検証（Cognito JWKS使用）
    claims = jwt_validator.validate_token(token)
    
    # カスタム属性を取得（IDトークンにのみ含まれる）
    tenant_name = claims['custom:tenant_name']  # ✅ IDトークンに含まれる
    role = claims['custom:role']                # ✅ IDトークンに含まれる
    username = claims['name']
    user_id = claims['sub']
    
    # テナント情報を取得
    tenant_id = subscription_validator.get_tenant_id(tenant_name)
    
    # サブスクリプションを確認
    has_subscription = subscription_validator.check_subscription(tenant_id)
    
    if has_subscription:
        # Allowポリシーを返す
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
    else:
        # Denyポリシーを返す
        return generate_policy(
            principal_id=user_id,
            effect='Deny',
            resource=event.get('methodArn', '*')
        )
```

**重要**: アクセストークンにはカスタム属性（`custom:tenant_name`、`custom:role`）が含まれないため、IDトークンを使用する必要があります。

## トークンの種類と用途

| トークン | 用途 | 有効期限 | 保存場所 | カスタム属性 |
|---------|------|---------|---------|------------|
| `access_token` | （使用しない） | 15分 | sessionStorage | ❌ なし |
| `id_token` | API呼び出し、ユーザー情報取得 | 1時間 | sessionStorage | ✅ あり |
| `refresh_token` | トークン更新 | 30日 | （将来実装） | - |

### 重要: IDトークンを使用する理由

**Cognitoのカスタム属性（`custom:tenant_name`、`custom:role`）はIDトークンにのみ含まれます。**

アクセストークンには以下のクレームのみが含まれます：
- `sub`: ユーザーID
- `scope`: スコープ
- `exp`: 有効期限
- `iat`: 発行時刻
- `client_id`: クライアントID

**カスタム属性は含まれません！**

そのため、Lambda Authorizerでテナント情報を取得するには、IDトークンを使用する必要があります。

### access_token（使用しない）

- **用途**: 本来はAPI呼び出し用だが、カスタム属性がないため使用しない
- **形式**: JWT（RS256署名）
- **クレーム**:
  - `sub`: ユーザーID
  - `scope`: スコープ（例: "openid profile email"）
  - `exp`: 有効期限
  - `iat`: 発行時刻
  - `client_id`: クライアントID
  - ❌ **カスタム属性なし**

### id_token（API呼び出しとユーザー情報取得に使用）

- **用途**: API呼び出しのAuthorizationヘッダー、ユーザー情報の取得
- **形式**: JWT（RS256署名）
- **クレーム**:
  - `sub`: ユーザーID
  - `email`: メールアドレス
  - `email_verified`: メール検証状態
  - `name`: ユーザー名
  - ✅ **`custom:tenant_name`: テナント名**
  - ✅ **`custom:role`: ユーザーロール**
  - `exp`: 有効期限
  - `iat`: 発行時刻

## セキュリティ

### トークン保護

1. **sessionStorage使用**: トークンはsessionStorageに保存（XSS対策）
2. **URL削除**: トークン取得後、URLからパラメータを削除
3. **HTTPS必須**: すべての通信をHTTPSで行う
4. **有効期限確認**: トークンの有効期限を確認

### CSRF対策

ポータル側でstateパラメータを使用してCSRF攻撃を防止します。

### PKCE

ポータル側でPKCE（Proof Key for Code Exchange）を実装して、認可コード横取り攻撃を防止します。

## トラブルシューティング

### エラー: "認証エラー: トークンが無効または期限切れです"

**原因**: トークンが無効、または有効期限が切れている

**解決方法**:
1. ポータルに戻って再度サービスをクリック
2. トークンが自動的に更新される

### エラー: "アクセス権限がありません"

**原因**: テナントがサービスにサブスクライブしていない

**解決方法**:
1. ポータルの管理画面でサブスクリプションを確認
2. サブスクリプションを有効化

### エラー: "トークンが見つかりません"

**原因**: URLパラメータにトークンがない

**解決方法**:
1. ポータルから正しくリダイレクトされているか確認
2. ブラウザのコンソールでエラーを確認

## 環境変数

### フロントエンド

```bash
# .env.local
NEXT_PUBLIC_MULTITENANT_MODE=true
NEXT_PUBLIC_MULTITENANT_URL=https://portal.example.com
NEXT_PUBLIC_API_ENDPOINT=https://api.documents.example.com
```

### バックエンド

```bash
# Lambda環境変数
MULTITENANT_MODE=true
COGNITO_REGION=ap-northeast-1
COGNITO_USER_POOL_ID=ap-northeast-1_xF0rdWASB
MULTITENANT_RDS_HOST=multitenant-db.example.com
MULTITENANT_RDS_DATABASE=multitenant_saas_poc_db_dev
MULTITENANT_RDS_USER=dbadmin
MULTITENANT_RDS_PASSWORD=xxx
DOCUMENT_SERVICE_ID=f5f6e5c9-9a3e-48f4-a467-97ede2a8b281
```

## テスト

### 手動テスト

1. ポータルにログイン
2. サービス一覧から「文書管理システム」をクリック
3. 自動的に文書管理システムにリダイレクトされる
4. トークンが正しく保存されているか確認:
   ```javascript
   // ブラウザのコンソールで実行
   console.log('access_token:', sessionStorage.getItem('multitenant_access_token'));
   console.log('id_token:', sessionStorage.getItem('multitenant_id_token'));
   ```
5. API呼び出しが正常に動作するか確認

### 自動テスト

```bash
# Lambda Authorizerのテスト
aws lambda invoke \
  --function-name misawa-authorizer-dev \
  --cli-binary-format raw-in-base64-out \
  --payload file://test-authorizer-event.json \
  --region ap-northeast-1 \
  response.json

# レスポンスを確認
cat response.json
```

## 参考資料

- [OAuth 2.0実装完全ガイド](./マルチテナントサービス/oauth-service-implementation-guide.md)
- [OAuth 2.0 API仕様詳細](./マルチテナントサービス/oauth-api-spec.md)
- [OAuth 2.0 SSO実装完了サマリー](./マルチテナントサービス/oauth-sso-implementation-summary.md)
- [マルチテナントセットアップガイド](./multitenant-setup.md)
- [マルチテナントトラブルシューティング](./multitenant-troubleshooting.md)

## まとめ

文書管理システムは、マルチテナントポータルの外部サービスとして完全に統合されています：

✅ **OAuth 2.0対応**: access_tokenとid_tokenの両方をサポート
✅ **レガシー互換**: 単一トークン形式もサポート
✅ **セキュリティ**: sessionStorage、HTTPS、トークン有効期限確認
✅ **Lambda Authorizer**: JWT検証、テナント認証、サブスクリプション確認
✅ **シームレスなSSO**: ポータルからワンクリックでアクセス

ユーザーはポータルでサービスをクリックするだけで、自動的に認証され、文書管理システムにアクセスできます。

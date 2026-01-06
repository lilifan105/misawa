# OAuth 2.0 SSO実装完了サマリー

## 実装概要

ポータルシステムにOAuth 2.0 SSOを実装しました。ポータルが認可サーバーとして機能し、外部サービスがOAuthクライアントとして登録されます。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    OAuth 2.0 SSO フロー                      │
└─────────────────────────────────────────────────────────────┘

1. ユーザーがポータルでサービスをクリック
   ↓
2. ポータル（フロントエンド）が認可リクエストを送信
   - client_id: サービスのOAuthクライアントID
   - redirect_uri: ポータルのコールバックURL
   - PKCE: code_challenge
   - セッションに保存: state, code_verifier, service_id
   ↓
3. ポータル（認可サーバー）が認可コードを発行
   - ユーザー認証情報がない場合は pending_auth 状態で発行
   - Cookie/ヘッダーから認証情報を取得を試みる
   ↓
4. ポータル（コールバックページ）が認可コードを受け取る
   - URLパラメータ: code, state
   - セッションストレージから OAuth セッションを取得
   ↓
5. ポータル（バックエンドAPI）がトークン交換を代行
   - client_secret はバックエンドで管理
   - フロントエンドには渡さない
   - pending_auth の場合、実際のユーザー情報に更新
   ↓
6. ポータルがトークンを取得
   - access_token: 15分有効
   - id_token: 1時間有効
   - refresh_token: 30日有効
   ↓
7. 外部サービスにリダイレクト（トークンを渡す）
   - URLパラメータ: access_token, id_token
```

## 実装したコンポーネント

### 1. データベース

#### マイグレーション
- `backend/alembic/versions/add_oauth_client_id_to_service.py`
  - サービステーブルに`oauth_client_id`カラムを追加

#### モデル更新
- `backend/lambda/shared/modules/shared/models.py`
  - `Service`モデルに`oauth_client_id`フィールドを追加

### 2. バックエンドAPI

#### トークン交換プロキシAPI
- `backend/lambda/portal/handler.py`
  - `POST /api/portal/oauth/exchange-token`
  - 認可コードをトークンに交換
  - `client_secret`をバックエンドで安全に管理

#### サービス一覧API更新
- `backend/lambda/portal/handler.py`
  - `GET /api/portal/services`
  - レスポンスに`oauthClientId`を追加

### 3. フロントエンド

#### OAuthコールバックページ
- `frontend/app/oauth/callback/page.tsx`
  - 認可コードを受け取る
  - バックエンドAPIでトークン交換
  - 外部サービスにリダイレクト

#### サービスカード更新
- `frontend/components/portal/service-card.tsx`
  - サービスの`oauthClientId`を使用
  - セッションに`serviceId`を保存

#### 型定義更新
- `frontend/lib/types/portal.ts`
  - `Service`型に`oauthClientId`を追加
- `frontend/lib/oauth/types.ts`
  - `OAuthSession`型に`serviceId`を追加

### 4. インフラストラクチャ

#### Lambda環境変数
- `terraform/modules/lambda/main.tf`
  - ポータルLambdaに以下を追加:
    - `API_URL`: API GatewayのURL
    - `PORTAL_URL`: ポータルのURL
    - `OAUTH_CLIENTS_TABLE_NAME`: OAuthクライアントテーブル名

#### 変数定義
- `terraform/modules/lambda/variables.tf`
  - `api_gateway_url`変数を追加
  - `portal_url`変数を追加

## セキュリティ設計

### client_secretの管理

| 項目 | client_id | client_secret |
|------|-----------|---------------|
| **公開** | ✅ OK | ❌ NG |
| **フロントエンド** | ✅ OK | ❌ NG |
| **保存場所** | サービステーブル | DynamoDB（ハッシュ化） |
| **使用場所** | 認可リクエスト | トークン交換（バックエンドのみ） |

### PKCEフロー

1. フロントエンドで`code_verifier`を生成
2. `code_challenge`を計算（SHA256）
3. 認可リクエストに`code_challenge`を含める
4. トークン交換時に`code_verifier`を送信
5. サーバーで検証

## セットアップ手順

### 1. データベースマイグレーション

```bash
cd backend
alembic upgrade head
```

### 2. 外部サービスをOAuthクライアントとして登録

```bash
curl -X POST https://your-portal.com/api/admin/oauth/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "client_name": "勤怠管理システム",
    "redirect_uris": ["https://your-portal.com/oauth/callback"],
    "allowed_scopes": ["openid", "profile", "email"]
  }'
```

レスポンス:
```json
{
  "client_id": "abc-123-xyz",
  "client_secret": "secret-456-def",
  ...
}
```

### 3. サービステーブルを更新

```bash
curl -X PUT https://your-portal.com/api/admin/services/{service_id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "oauth_client_id": "abc-123-xyz"
  }'
```

### 4. 環境変数の設定

#### バックエンド（Terraform）

```hcl
module "lambda" {
  source = "./modules/lambda"
  
  # ... 既存の設定 ...
  
  api_gateway_url          = "https://api.your-portal.com"
  portal_url               = "https://your-portal.com"
  oauth_clients_table_name = module.dynamodb.oauth_clients_table_name
}
```

#### フロントエンド（.env.local）

```bash
NEXT_PUBLIC_API_URL=https://api.your-portal.com
```

## 使用フロー

### ユーザー視点

1. ポータルにログイン
2. サービス一覧からサービスをクリック
3. 自動的に認証処理が行われる
4. 外部サービスにリダイレクトされる
5. 外部サービスでトークンを使用してユーザー情報を取得

### 外部サービス側の実装

外部サービスは以下のパラメータを受け取ります：

```
https://external-service.com?access_token=xxx&id_token=yyy
```

外部サービスでの処理：

```javascript
// URLパラメータからトークンを取得
const params = new URLSearchParams(window.location.search)
const accessToken = params.get('access_token')
const idToken = params.get('id_token')

// IDトークンをデコードしてユーザー情報を取得
const payload = JSON.parse(atob(idToken.split('.')[1]))
console.log('ユーザーID:', payload.sub)
console.log('メール:', payload.email)
console.log('名前:', payload.name)
console.log('テナントID:', payload.tenant_id)
console.log('テナント名:', payload.tenant_name)
console.log('ロール:', payload.role)

// アクセストークンを使用してAPIリクエスト
fetch('https://api.your-portal.com/api/portal/profile', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
})

// トークンをセッションストレージに保存（推奨）
sessionStorage.setItem('access_token', accessToken)
sessionStorage.setItem('id_token', idToken)

// URLからトークンを削除（セキュリティのため）
window.history.replaceState({}, document.title, window.location.pathname)
```

**IDトークンのクレーム**:
- `sub`: ユーザーID（Cognito User Pool ID）
- `email`: メールアドレス
- `email_verified`: メール検証状態
- `name`: ユーザー名
- `tenant_id`: テナントID（UUID）
- `tenant_name`: テナント名（例: "sample-a"）
- `role`: ユーザーロール（例: "admin", "user"）
- `iss`: 発行者（ポータルのURL）
- `aud`: 対象者（client_id）
- `exp`: 有効期限（Unix timestamp）
- `iat`: 発行時刻（Unix timestamp）

## トラブルシューティング

### エラー: "このサービスはSSO認証に対応していません"

**原因**: サービスに`oauth_client_id`が設定されていない

**解決方法**:
1. OAuthクライアントを登録
2. サービステーブルに`oauth_client_id`を設定

### エラー: "OAuth設定エラー"

**原因**: DynamoDBにOAuthクライアント情報が見つからない

**解決方法**:
1. OAuthクライアントが正しく登録されているか確認
2. `oauth_client_id`が正しいか確認

### エラー: "セッションが見つかりません"

**原因**: セッションストレージがクリアされた、またはタイムアウト（10分）

**解決方法**:
- もう一度サービスをクリックして認証フローを開始

### エラー: "トークン取得に失敗しました"

**原因**: 
- `client_secret`が間違っている
- 認可コードが期限切れ（5分）
- PKCEの検証に失敗
- 認可コードが既に使用済み

**解決方法**:
1. OAuthクライアントの`client_secret`を確認
2. もう一度認証フローを開始
3. 認可コードは1回のみ使用可能なため、再度認可フローを開始

### エラー: "ユーザー認証が必要です"

**原因**: IDトークンが見つからない、または期限切れ

**解決方法**:
1. ポータルに再ログイン
2. ブラウザのlocalStorage/sessionStorageを確認

### エラー: "認可コードの有効期限が切れています"

**原因**: 認可コードの有効期限（5分）が切れている

**解決方法**:
- もう一度サービスをクリックして認証フローを開始

### エラー: "PKCE検証に失敗しました"

**原因**: `code_verifier`が正しくない、またはセッションが失われた

**解決方法**:
1. セッションストレージに`code_verifier`が保存されているか確認
2. もう一度認証フローを開始

## 参考資料

- [OAuth 2.0 API仕様詳細](./oauth-api-spec.md)
- [OAuthクライアント登録手順書](./oauth-client-registration-guide.md)
- [OAuth実装サンプルコード](./oauth-implementation-samples.md)
- [OAuth実装完全ガイド](./oauth-service-implementation-guide.md)

## 今後の拡張

### 推奨される改善

1. **トークンのリフレッシュ機能**
   - アクセストークンの有効期限切れ時に自動更新

2. **ログアウト機能**
   - トークンの無効化
   - セッションのクリア

3. **スコープの細かい制御**
   - サービスごとに異なるスコープを設定

4. **監査ログ**
   - OAuth認証のログ記録
   - トークン発行履歴

5. **レート制限**
   - トークンエンドポイントのレート制限
   - 不正アクセスの防止

## まとめ

OAuth 2.0 SSOの実装が完了しました。ポータルが認可サーバーとして機能し、外部サービスへのシームレスなSSO認証が可能になりました。

**重要なポイント**:
- `client_secret`はバックエンドで安全に管理
- PKCEによる認可コード横取り攻撃の防止
- トークン交換はポータルのバックエンドで代行
- 外部サービスはOAuth実装不要

# OAuth 2.0クライアント実装完全ガイド

## 目次

1. [概要](#概要)
2. [実装の全体フロー](#実装の全体フロー)
3. [必須エンドポイント一覧](#必須エンドポイント一覧)
4. [各エンドポイントの詳細仕様](#各エンドポイントの詳細仕様)
5. [リクエスト・レスポンス例](#リクエストレスポンス例)
6. [エラーハンドリング](#エラーハンドリング)
7. [セキュリティチェックリスト](#セキュリティチェックリスト)

---

## 概要

このガイドは、ポータルシステムのOAuth 2.0 Authorization Code Flow with PKCEを使用して、外部サービスにシングルサインオン（SSO）機能を実装するための完全なガイドです。

### 対応する仕様

- **OAuth 2.0**: RFC 6749
- **PKCE**: RFC 7636
- **OpenID Connect**: OpenID Connect Core 1.0
- **Token Revocation**: RFC 7009

### 前提条件

- サービスがHTTPSで公開されていること
- OAuthクライアントとして登録されていること（client_id、client_secretを取得済み）
- リダイレクトURIが登録されていること

---

## 実装の全体フロー

### パターン1: ポータル経由のSSO（推奨）

```
┌─────────┐                                  ┌─────────┐                                  ┌─────────┐
│ ユーザー │                                  │ポータル │                                  │外部サービス│
└────┬────┘                                  └────┬────┘                                  └────┬────┘
     │                                            │                                            │
     │ 1. ポータルでサービスをクリック            │                                            │
     ├───────────────────────────────────────────>│                                            │
     │                                            │                                            │
     │                                            │ 2. 認可URLを構築してリダイレクト           │
     │                                            │    (code_challenge, state含む)             │
     │<───────────────────────────────────────────┤                                            │
     │                                            │                                            │
     │ 3. 認可エンドポイントにアクセス            │                                            │
     ├───────────────────────────────────────────>│                                            │
     │                                            │                                            │
     │                                            │ 4. 認可コード発行（pending_auth状態）      │
     │                                            │    ユーザー認証はCookie/ヘッダーから取得   │
     │<───────────────────────────────────────────┤                                            │
     │                                            │                                            │
     │ 5. コールバックページにリダイレクト        │                                            │
     │    (code, state)                           │                                            │
     ├───────────────────────────────────────────>│                                            │
     │                                            │                                            │
     │                                            │ 6. トークン交換API呼び出し                 │
     │                                            │    (code, service_id, code_verifier)       │
     │                                            │    ※client_secretはバックエンドで管理      │
     │                                            │                                            │
     │                                            │ 7. 認可コードのユーザー情報を更新          │
     │                                            │    (pending_auth → 実際のuser_id/tenant_id)│
     │                                            │                                            │
     │                                            │ 8. トークンエンドポイント呼び出し          │
     │                                            │    (code, code_verifier, client_secret)    │
     │                                            │                                            │
     │                                            │ 9. トークン取得                            │
     │<───────────────────────────────────────────┤    (access_token, id_token, refresh_token) │
     │                                            │                                            │
     │ 10. 外部サービスにリダイレクト             │                                            │
     │     (access_token, id_token)               │                                            │
     ├────────────────────────────────────────────────────────────────────────────────────────>│
     │                                            │                                            │
     │ 11. サービスにログイン完了                 │                                            │
     │<────────────────────────────────────────────────────────────────────────────────────────┤
     │                                            │                                            │
```

### パターン2: 外部サービスから直接OAuth実装（標準）

```
┌─────────┐                                  ┌─────────┐                                  ┌─────────┐
│ ユーザー │                                  │外部サービス│                                │ポータル │
└────┬────┘                                  └────┬────┘                                  └────┬────┘
     │                                            │                                            │
     │ 1. サービスにアクセス                      │                                            │
     ├───────────────────────────────────────────>│                                            │
     │                                            │                                            │
     │                                            │ 2. 認可URLを構築してリダイレクト           │
     │                                            ├───────────────────────────────────────────>│
     │                                            │   (code_challenge, state含む)              │
     │                                            │                                            │
     │                                            │                                            │ 3. ユーザー認証
     │                                            │                                            │    (Cognito)
     │                                            │                                            │
     │                                            │ 4. 認可コードを返す                        │
     │                                            │<───────────────────────────────────────────┤
     │                                            │   (code, state)                            │
     │                                            │                                            │
     │                                            │ 5. トークンエンドポイントを呼び出し       │
     │                                            ├───────────────────────────────────────────>│
     │                                            │   (code, code_verifier, client_secret)     │
     │                                            │                                            │
     │                                            │ 6. アクセストークン、IDトークンを返す     │
     │                                            │<───────────────────────────────────────────┤
     │                                            │   (access_token, id_token, refresh_token)  │
     │                                            │                                            │
     │ 7. サービスにログイン完了                  │                                            │
     │<───────────────────────────────────────────┤                                            │
     │                                            │                                            │
```

### フローの詳細

#### パターン1: ポータル経由のSSO（推奨）

1. **ユーザーがポータルでサービスをクリック**: ポータルのサービス一覧からサービスを選択
2. **認可リクエスト**: ポータルのフロントエンドがPKCEパラメータ（code_challenge）とstateを生成し、認可エンドポイントにリダイレクト
3. **認可コード発行**: ポータルが認可コードを発行（ユーザー認証情報がない場合は`pending_auth`状態）
4. **コールバック**: ポータルのコールバックページが認可コードを受け取る
5. **トークン交換**: ポータルのバックエンドAPIが認可コードをトークンに交換（`client_secret`はバックエンドで管理）
6. **ユーザー情報更新**: 認可コードが`pending_auth`状態の場合、実際のユーザー情報に更新
7. **外部サービスにリダイレクト**: トークンを含めて外部サービスにリダイレクト
8. **ログイン完了**: 外部サービスがトークンを使用してユーザー情報を取得

**メリット**:
- `client_secret`をフロントエンドに露出しない
- 外部サービス側でOAuth実装が不要
- ポータルで一元管理

#### パターン2: 外部サービスから直接OAuth実装（標準）

1. **ユーザーがサービスにアクセス**: ユーザーがサービスのログインページにアクセス
2. **認可リクエスト**: サービスがPKCEパラメータ（code_challenge）とstateを生成し、ポータルの認可エンドポイントにリダイレクト
3. **ユーザー認証**: ポータルでユーザーがCognitoで認証
4. **認可コード発行**: ポータルが認可コードとstateをサービスのリダイレクトURIに返す
5. **トークンリクエスト**: サービスがcode_verifierとclient_secretを使ってトークンエンドポイントを呼び出し
6. **トークン発行**: ポータルがアクセストークン、IDトークン、リフレッシュトークンを返す
7. **ログイン完了**: サービスがユーザーをログイン状態にする

**メリット**:
- 標準的なOAuth 2.0フロー
- 外部サービスが独立して動作可能

---

## 必須エンドポイント一覧

### パターン1: ポータル経由のSSO（推奨）

外部サービス側で実装が必要なエンドポイント：

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/` または任意のパス | GET | トークンを受け取るエンドポイント（URLパラメータ: access_token, id_token） |

ポータル側のエンドポイント：

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/oauth/authorize` | GET | 認可エンドポイント |
| `/api/oauth/token` | POST | トークンエンドポイント |
| `/api/oauth/revoke` | POST | トークン無効化エンドポイント |
| `/api/portal/oauth/exchange-token` | POST | トークン交換プロキシAPI |
| `/.well-known/openid-configuration` | GET | OpenID Connect Discovery |
| `/.well-known/jwks.json` | GET | JSON Web Key Set |

### パターン2: 外部サービスから直接OAuth実装（標準）

外部サービス側で実装が必要なエンドポイント：

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/oauth/callback` | GET | 認可コールバック（ポータルからのリダイレクト先） |
| `/oauth/logout` | GET/POST | ログアウト処理 |

ポータル側のエンドポイント（サービスから呼び出す）：

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/oauth/authorize` | GET | 認可エンドポイント |
| `/api/oauth/token` | POST | トークンエンドポイント |
| `/api/oauth/revoke` | POST | トークン無効化エンドポイント |
| `/.well-known/openid-configuration` | GET | OpenID Connect Discovery |
| `/.well-known/jwks.json` | GET | JSON Web Key Set |

---

## 各エンドポイントの詳細仕様

### 1. 認可エンドポイント（ポータル側）

**エンドポイント**: `GET /api/oauth/authorize`

**パラメータ**:

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `response_type` | ✓ | 固定値: `code` |
| `client_id` | ✓ | クライアントID |
| `redirect_uri` | ✓ | リダイレクトURI（登録済みのもの） |
| `scope` | ✓ | スコープ（スペース区切り）例: `openid profile email` |
| `state` | ✓ | CSRF対策用のランダム文字列 |
| `code_challenge` | ✓ | PKCEチャレンジ（SHA256ハッシュのbase64url） |
| `code_challenge_method` | ✓ | 固定値: `S256` |

**レスポンス**:

成功時はリダイレクトURIにリダイレクト：
```
https://your-service.com/oauth/callback?code=AUTHORIZATION_CODE&state=STATE
```

エラー時もリダイレクトURIにリダイレクト：
```
https://your-service.com/oauth/callback?error=ERROR_CODE&error_description=DESCRIPTION&state=STATE
```

---

### 2. トークンエンドポイント（ポータル側）

**エンドポイント**: `POST /api/oauth/token`

**Content-Type**: `application/x-www-form-urlencoded`

**パラメータ（Authorization Code Grant）**:

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `grant_type` | ✓ | 固定値: `authorization_code` |
| `code` | ✓ | 認可コード |
| `redirect_uri` | ✓ | リダイレクトURI（認可リクエスト時と同じ） |
| `client_id` | ✓ | クライアントID |
| `client_secret` | ✓ | クライアントシークレット |
| `code_verifier` | ✓ | PKCEベリファイア |

**レスポンス**:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 900,
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "random-refresh-token-string",
  "scope": "openid profile email"
}
```

**パラメータ（Refresh Token Grant）**:

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `grant_type` | ✓ | 固定値: `refresh_token` |
| `refresh_token` | ✓ | リフレッシュトークン |
| `client_id` | ✓ | クライアントID |
| `client_secret` | ✓ | クライアントシークレット |

---

### 3. トークン無効化エンドポイント（ポータル側）

**エンドポイント**: `POST /api/oauth/revoke`

**Content-Type**: `application/x-www-form-urlencoded`

**パラメータ**:

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `token` | ✓ | 無効化するトークン（アクセストークンまたはリフレッシュトークン） |
| `token_type_hint` | | トークンタイプのヒント（`access_token` or `refresh_token`） |
| `client_id` | ✓ | クライアントID |
| `client_secret` | ✓ | クライアントシークレット |

**レスポンス**:

成功時は200 OKで空のレスポンス

---

### 4. 認可コールバック（サービス側）

**エンドポイント**: `GET /oauth/callback`

**パラメータ**:

| パラメータ | 説明 |
|-----------|------|
| `code` | 認可コード（成功時） |
| `state` | stateパラメータ |
| `error` | エラーコード（エラー時） |
| `error_description` | エラーの説明（エラー時） |

**処理フロー**:

1. stateパラメータを検証（セッションに保存したstateと一致するか）
2. errorパラメータがある場合はエラー処理
3. codeパラメータを使ってトークンエンドポイントを呼び出し
4. 取得したトークンをセッションに保存
5. ユーザーをサービスのホームページにリダイレクト

---

## リクエスト・レスポンス例

### 認可リクエストの構築例（Python）

```python
import secrets
import hashlib
import base64
from urllib.parse import urlencode

# 1. code_verifierを生成（43-128文字のランダム文字列）
code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')

# 2. code_challengeを生成（SHA256ハッシュ）
code_challenge = base64.urlsafe_b64encode(
    hashlib.sha256(code_verifier.encode('utf-8')).digest()
).decode('utf-8').rstrip('=')

# 3. stateを生成
state = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')

# 4. セッションに保存
session['oauth_state'] = state
session['oauth_code_verifier'] = code_verifier

# 5. 認可URLを構築
params = {
    'response_type': 'code',
    'client_id': 'YOUR_CLIENT_ID',
    'redirect_uri': 'https://your-service.com/oauth/callback',
    'scope': 'openid profile email',
    'state': state,
    'code_challenge': code_challenge,
    'code_challenge_method': 'S256'
}

authorization_url = f"https://portal.example.com/api/oauth/authorize?{urlencode(params)}"

# 6. リダイレクト
return redirect(authorization_url)
```

### トークンリクエスト例（Python）

```python
import requests

# コールバックから受け取ったパラメータ
code = request.args.get('code')
state = request.args.get('state')

# stateを検証
if state != session.get('oauth_state'):
    return "Invalid state", 400

# トークンエンドポイントを呼び出し
token_response = requests.post(
    'https://portal.example.com/api/oauth/token',
    data={
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': 'https://your-service.com/oauth/callback',
        'client_id': 'YOUR_CLIENT_ID',
        'client_secret': 'YOUR_CLIENT_SECRET',
        'code_verifier': session.get('oauth_code_verifier')
    },
    headers={
        'Content-Type': 'application/x-www-form-urlencoded'
    }
)

if token_response.status_code == 200:
    tokens = token_response.json()
    
    # トークンをセッションに保存
    session['access_token'] = tokens['access_token']
    session['id_token'] = tokens['id_token']
    session['refresh_token'] = tokens['refresh_token']
    
    # ユーザー情報をIDトークンから取得
    # （IDトークンをデコードして検証）
    
    return redirect('/home')
else:
    return "Token request failed", 400
```

### リフレッシュトークンの使用例（Python）

```python
import requests

refresh_token = session.get('refresh_token')

# トークンエンドポイントを呼び出し
token_response = requests.post(
    'https://portal.example.com/api/oauth/token',
    data={
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token,
        'client_id': 'YOUR_CLIENT_ID',
        'client_secret': 'YOUR_CLIENT_SECRET'
    },
    headers={
        'Content-Type': 'application/x-www-form-urlencoded'
    }
)

if token_response.status_code == 200:
    tokens = token_response.json()
    
    # 新しいトークンをセッションに保存
    session['access_token'] = tokens['access_token']
    session['refresh_token'] = tokens['refresh_token']
    
    return "Token refreshed"
else:
    # リフレッシュトークンが無効な場合は再ログイン
    return redirect('/oauth/login')
```

---

## エラーハンドリング

### OAuth 2.0標準エラーコード

| エラーコード | 説明 | 対処方法 |
|-------------|------|---------|
| `invalid_request` | リクエストパラメータが不正 | パラメータを確認 |
| `unauthorized_client` | クライアントが認可されていない | client_idを確認 |
| `access_denied` | ユーザーが認可を拒否 | ユーザーに再度認可を求める |
| `unsupported_response_type` | response_typeがサポートされていない | `code`を使用 |
| `invalid_scope` | スコープが不正 | スコープを確認 |
| `server_error` | サーバーエラー | 時間をおいて再試行 |
| `temporarily_unavailable` | サーバーが一時的に利用不可 | 時間をおいて再試行 |
| `invalid_client` | クライアント認証失敗 | client_secretを確認 |
| `invalid_grant` | 認可コードが無効または期限切れ | 新しい認可コードを取得 |
| `unsupported_grant_type` | grant_typeがサポートされていない | `authorization_code`または`refresh_token`を使用 |

### エラーレスポンス例

```json
{
  "error": "invalid_grant",
  "error_description": "Authorization code has expired",
  "error_uri": "https://portal.example.com/docs/errors#invalid_grant"
}
```

### エラーハンドリングのベストプラクティス

1. **エラーをログに記録**: すべてのOAuthエラーをログに記録
2. **ユーザーフレンドリーなメッセージ**: 技術的なエラーをユーザーに見せない
3. **リトライロジック**: `server_error`や`temporarily_unavailable`の場合は再試行
4. **セキュリティ**: エラーメッセージから機密情報を漏らさない

---

## セキュリティチェックリスト

### 必須のセキュリティ対策

- [ ] **HTTPS必須**: すべての通信をHTTPSで行う
- [ ] **state検証**: stateパラメータを必ず検証してCSRF攻撃を防ぐ
- [ ] **PKCE実装**: code_verifierとcode_challengeを正しく実装
- [ ] **client_secret保護**: client_secretをサーバー側でのみ使用（クライアント側に露出しない）
- [ ] **トークン保護**: アクセストークンとリフレッシュトークンを安全に保存
- [ ] **セッション管理**: セッションタイムアウトを適切に設定
- [ ] **リダイレクトURI検証**: 登録されたリダイレクトURIのみを使用
- [ ] **トークン有効期限**: アクセストークンの有効期限を確認
- [ ] **ログアウト処理**: ログアウト時にトークンを無効化

### 推奨のセキュリティ対策

- [ ] **IDトークン検証**: IDトークンの署名を検証
- [ ] **スコープ最小化**: 必要最小限のスコープのみを要求
- [ ] **ログ記録**: すべてのOAuth操作をログに記録
- [ ] **レート制限**: トークンエンドポイントへのリクエストにレート制限を設定
- [ ] **エラーハンドリング**: エラーメッセージから機密情報を漏らさない

### セキュリティ上の注意事項

1. **認可コードの使い回し禁止**: 認可コードは1回のみ使用可能
2. **認可コードの有効期限**: 認可コードは5分で期限切れ
3. **リフレッシュトークンのローテーション**: リフレッシュトークンは使用後に新しいものに更新
4. **トークンの有効期限**: 
   - アクセストークン: 15分（900秒）
   - IDトークン: 1時間（3600秒）
   - リフレッシュトークン: 30日（2592000秒）
5. **ユーザー無効化**: ユーザーが無効化された場合、すべてのトークンが無効化される
6. **テナント無効化**: テナントが無効化された場合、すべてのトークンが無効化される
7. **pending_auth状態**: 認可エンドポイントで認証情報が取得できない場合、認可コードは`pending_auth`状態で発行され、トークン交換時に実際のユーザー情報に更新される

---

## 参考資料

- [OAuth 2.0 (RFC 6749)](https://datatracker.ietf.org/doc/html/rfc6749)
- [PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [Token Revocation (RFC 7009)](https://datatracker.ietf.org/doc/html/rfc7009)

---

## サポート

実装に関する質問や問題がある場合は、システム管理者にお問い合わせください。

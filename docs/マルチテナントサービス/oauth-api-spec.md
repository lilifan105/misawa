# OAuth 2.0 API仕様詳細

## 認可エンドポイント

**URL**: `GET /api/oauth/authorize`

**パラメータ**:
- `response_type`: `code` (必須)
- `client_id`: クライアントID (必須)
- `redirect_uri`: リダイレクトURI (必須)
- `scope`: スコープ (必須)
- `state`: CSRF対策トークン (必須)
- `code_challenge`: PKCEチャレンジ (必須)
- `code_challenge_method`: `S256` (必須)

**レスポンス**: リダイレクト
```
https://your-service.com/oauth/callback?code=AUTHORIZATION_CODE&state=STATE
```

エラー時:
```
https://your-service.com/oauth/callback?error=ERROR_CODE&error_description=DESCRIPTION&state=STATE
```

**注意**: 
- 認可エンドポイントでは認証情報（Cookieまたはヘッダー）がオプションです
- 認証情報がない場合、認可コードは`pending_auth`状態で発行されます
- トークン交換時にポータルAPIが実際のユーザー情報を設定します

## トークンエンドポイント

**URL**: `POST /api/oauth/token`

**Content-Type**: `application/x-www-form-urlencoded`

**Authorization Code Grant**:
- `grant_type`: `authorization_code` (必須)
- `code`: 認可コード (必須)
- `redirect_uri`: リダイレクトURI (必須)
- `client_id`: クライアントID (必須)
- `client_secret`: クライアントシークレット (必須)
- `code_verifier`: PKCEベリファイア (必須)

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

**Refresh Token Grant**:
- `grant_type`: `refresh_token` (必須)
- `refresh_token`: リフレッシュトークン (必須)
- `client_id`: クライアントID (必須)
- `client_secret`: クライアントシークレット (必須)

**レスポンス**:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "new-refresh-token-string",
  "scope": "openid profile email"
}
```

## トークン無効化エンドポイント

**URL**: `POST /api/oauth/revoke`

**Content-Type**: `application/x-www-form-urlencoded`

**パラメータ**:
- `token`: トークン (必須)
- `token_type_hint`: `access_token` or `refresh_token` (オプション)
- `client_id`: クライアントID (必須)
- `client_secret`: クライアントシークレット (必須)

**レスポンス**:
```json
{
  "success": true
}
```

**注意**: RFC 7009に従い、トークンが存在しない場合でも成功を返します

## OpenID Connect Discovery

**URL**: `GET /.well-known/openid-configuration`

**レスポンス**:
```json
{
  "issuer": "https://portal.example.com",
  "authorization_endpoint": "https://portal.example.com/api/oauth/authorize",
  "token_endpoint": "https://portal.example.com/api/oauth/token",
  "revocation_endpoint": "https://portal.example.com/api/oauth/revoke",
  "jwks_uri": "https://portal.example.com/.well-known/jwks.json",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": ["openid", "profile", "email"],
  "token_endpoint_auth_methods_supported": ["client_secret_post"],
  "code_challenge_methods_supported": ["S256"],
  "claims_supported": ["sub", "iss", "aud", "exp", "iat", "email", "email_verified", "name", "tenant_id", "tenant_name", "role"]
}
```

## JWKS (JSON Web Key Set)

**URL**: `GET /.well-known/jwks.json`

**レスポンス**: JWT署名検証用の公開鍵セット

## ポータルAPI - トークン交換プロキシ

**URL**: `POST /api/portal/oauth/exchange-token`

**Content-Type**: `application/json`

**ヘッダー**:
- `Authorization`: `Bearer <id_token>` (必須)

**リクエストボディ**:
```json
{
  "code": "認可コード",
  "service_id": "サービスID",
  "code_verifier": "PKCEベリファイア"
}
```

**レスポンス**:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 900,
  "service_url": "https://external-service.com"
}
```

**説明**: 
- ポータルのフロントエンドから呼び出されます
- `client_secret`をバックエンドで安全に管理します
- 認可コードのユーザー情報が`pending_auth`の場合、実際の値に更新します

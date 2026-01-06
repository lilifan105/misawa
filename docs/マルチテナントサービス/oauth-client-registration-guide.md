# OAuthクライアント登録手順書

## 目次

1. [概要](#概要)
2. [登録に必要な情報](#登録に必要な情報)
3. [登録手順](#登録手順)
4. [client_id / client_secretの取得方法](#client_id--client_secretの取得方法)
5. [リダイレクトURIの設定](#リダイレクトuriの設定)
6. [登録後の確認事項](#登録後の確認事項)
7. [トラブルシューティング](#トラブルシューティング)

---

## 概要

ポータルシステムのOAuth 2.0 SSOを利用するには、事前にOAuthクライアントとして登録する必要があります。この手順書では、OAuthクライアントの登録方法を説明します。

### 前提条件

- システム管理者権限を持っていること
- サービスがHTTPSで公開されていること（本番環境）
- リダイレクトURIが決定していること

---

## 登録に必要な情報

OAuthクライアントを登録する際に、以下の情報が必要です：

| 項目 | 説明 | 例 |
|-----|------|-----|
| **クライアント名** | サービスの名前 | `サンプルサービス` |
| **リダイレクトURI** | 認可コールバックのURL（複数可） | `https://example.com/oauth/callback` |
| **許可されたスコープ** | 要求するスコープ | `openid`, `profile`, `email` |

### クライアント名

- サービスを識別するための名前
- 日本語・英語どちらでも可
- 例: `サンプルサービス`, `Sample Service`

### リダイレクトURI

- 認可コールバックを受け取るURL
- **本番環境ではHTTPS必須**（localhostを除く）
- 複数のURIを登録可能（開発環境と本番環境など）
- 例:
  - `https://example.com/oauth/callback`
  - `http://localhost:3000/oauth/callback`（開発環境）

### 許可されたスコープ

利用可能なスコープ：

| スコープ | 説明 | 取得できる情報 |
|---------|------|--------------|
| `openid` | OpenID Connect必須 | ユーザーID |
| `profile` | プロフィール情報 | 名前、ニックネーム |
| `email` | メールアドレス | メールアドレス、メール検証状態 |

**推奨**: すべてのスコープ（`openid profile email`）を要求

---

## 登録手順

### 方法1: 管理画面から登録（推奨）

1. **管理画面にログイン**
   - ポータルの管理画面にシステム管理者としてログイン

2. **OAuthクライアント管理画面に移動**
   - サイドメニューから「OAuth管理」→「クライアント一覧」を選択

3. **新規クライアント登録**
   - 「新規登録」ボタンをクリック

4. **情報を入力**
   ```
   クライアント名: サンプルサービス
   リダイレクトURI:
     - https://example.com/oauth/callback
     - http://localhost:3000/oauth/callback
   許可されたスコープ:
     ☑ openid
     ☑ profile
     ☑ email
   ```

5. **登録を実行**
   - 「登録」ボタンをクリック

6. **client_idとclient_secretを保存**
   - 登録完了画面に表示される`client_id`と`client_secret`を**必ず保存**
   - **重要**: `client_secret`はこの画面でのみ表示されます。再表示できません。

### 方法2: APIから登録

管理APIを使用してプログラムから登録することも可能です。

**エンドポイント**: `POST /api/admin/oauth/clients`

**リクエスト例**:

```bash
curl -X POST https://portal.example.com/api/admin/oauth/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "client_name": "サンプルサービス",
    "redirect_uris": [
      "https://example.com/oauth/callback",
      "http://localhost:3000/oauth/callback"
    ],
    "allowed_scopes": ["openid", "profile", "email"]
  }'
```

**レスポンス例**:

```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "client_secret": "generated-secret-string-save-this",
  "client_name": "サンプルサービス",
  "redirect_uris": [
    "https://example.com/oauth/callback",
    "http://localhost:3000/oauth/callback"
  ],
  "allowed_scopes": ["openid", "profile", "email"],
  "created_at": "2025-12-25T10:00:00Z",
  "updated_at": "2025-12-25T10:00:00Z"
}
```

---

## client_id / client_secretの取得方法

### 初回登録時

- 登録完了画面に`client_id`と`client_secret`が表示されます
- **必ず両方を安全な場所に保存してください**
- `client_secret`は**この画面でのみ表示**され、再表示できません

### client_secretを紛失した場合

`client_secret`を紛失した場合は、新しいシークレットを再生成する必要があります：

1. 管理画面の「OAuthクライアント一覧」から対象のクライアントを選択
2. 「シークレット再生成」ボタンをクリック
3. 新しい`client_secret`が表示されるので保存
4. **古いシークレットは無効化されます**
5. サービス側の設定を新しいシークレットに更新

---

## リダイレクトURIの設定

### リダイレクトURIの要件

1. **HTTPS必須**（本番環境）
   - 本番環境では必ずHTTPSを使用
   - 例外: `localhost`または`127.0.0.1`は開発環境でHTTPを許可

2. **完全一致**
   - 認可リクエスト時のリダイレクトURIは、登録されたURIと完全に一致する必要があります
   - クエリパラメータやフラグメントは含めません

3. **複数URI登録可能**
   - 開発環境と本番環境で異なるURIを登録可能
   - 例:
     ```
     https://example.com/oauth/callback        (本番)
     https://staging.example.com/oauth/callback (ステージング)
     http://localhost:3000/oauth/callback      (開発)
     ```

### リダイレクトURIの例

#### 良い例 ✅

```
https://example.com/oauth/callback
https://api.example.com/auth/callback
http://localhost:3000/oauth/callback
http://127.0.0.1:8000/callback
```

#### 悪い例 ❌

```
http://example.com/oauth/callback          (HTTPSではない)
https://example.com/oauth/callback?param=1 (クエリパラメータを含む)
https://example.com/oauth/callback#section (フラグメントを含む)
https://example.com/oauth/*                (ワイルドカード不可)
```

### リダイレクトURIの追加・変更

登録後にリダイレクトURIを追加・変更する場合：

1. 管理画面の「OAuthクライアント一覧」から対象のクライアントを選択
2. 「編集」ボタンをクリック
3. リダイレクトURIを追加・変更
4. 「保存」ボタンをクリック

---

## 登録後の確認事項

### 1. 認証情報の保存確認

- [ ] `client_id`を保存した
- [ ] `client_secret`を保存した
- [ ] 認証情報を安全な場所（環境変数、シークレット管理サービスなど）に保存した

### 2. リダイレクトURIの確認

- [ ] 本番環境のリダイレクトURIがHTTPSである
- [ ] リダイレクトURIがサービス側の実装と一致している
- [ ] 必要なすべての環境（開発、ステージング、本番）のURIを登録した

### 3. スコープの確認

- [ ] 必要なスコープがすべて許可されている
- [ ] `openid`スコープが含まれている（OpenID Connect必須）

### 4. テスト

- [ ] 開発環境でOAuthフローをテストした
- [ ] トークンの取得に成功した
- [ ] IDトークンからユーザー情報を取得できた

---

## トラブルシューティング

### よくある問題と解決方法

#### 問題1: `unauthorized_client`エラー

**原因**: `client_id`が無効または存在しない

**解決方法**:
- `client_id`が正しいか確認
- クライアントが削除されていないか確認
- 管理画面でクライアント一覧を確認

#### 問題2: `invalid_client`エラー

**原因**: `client_secret`が無効

**解決方法**:
- `client_secret`が正しいか確認
- シークレットが再生成されていないか確認
- 必要に応じてシークレットを再生成

#### 問題3: `redirect_uri_mismatch`エラー

**原因**: リダイレクトURIが登録されたURIと一致しない

**解決方法**:
- 認可リクエストのリダイレクトURIを確認
- 登録されたリダイレクトURIと完全に一致するか確認
- クエリパラメータやフラグメントが含まれていないか確認

#### 問題4: `invalid_scope`エラー

**原因**: 要求したスコープが許可されていない

**解決方法**:
- 要求するスコープを確認
- 管理画面で許可されたスコープを確認
- 必要に応じてスコープを追加

#### 問題5: HTTPSエラー

**原因**: 本番環境でHTTPを使用している

**解決方法**:
- リダイレクトURIをHTTPSに変更
- サービス全体をHTTPSで公開
- 開発環境の場合は`localhost`を使用

---

## セキュリティのベストプラクティス

### client_secretの管理

1. **環境変数に保存**
   ```bash
   export OAUTH_CLIENT_ID="your-client-id"
   export OAUTH_CLIENT_SECRET="your-client-secret"
   ```

2. **シークレット管理サービスを使用**
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault

3. **コードに直接書かない**
   - ❌ `client_secret = "abc123"` （ハードコード）
   - ✅ `client_secret = os.environ.get("OAUTH_CLIENT_SECRET")` （環境変数）

4. **バージョン管理に含めない**
   - `.gitignore`に環境変数ファイルを追加
   - シークレットをコミットしない

### アクセス制限

- `client_secret`はサーバー側でのみ使用
- クライアント側（ブラウザ、モバイルアプリ）に露出しない
- 必要最小限の権限のみを要求

---

## 参考資料

- [OAuth 2.0クライアント実装完全ガイド](./oauth-service-implementation-guide.md)
- [実装サンプルコード](./oauth-implementation-samples.md)
- [API仕様詳細](./oauth-api-specification.md)

---

## サポート

登録に関する質問や問題がある場合は、システム管理者にお問い合わせください。

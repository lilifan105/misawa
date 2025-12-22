# マルチテナント認証・認可 トラブルシューティングガイド

## 認証エラー（401 Unauthorized）

### 症状
- APIリクエストが401エラーを返す
- フロントエンドがマルチテナントサービスのログインにリダイレクトされる

### 原因と対処法

#### 1. トークンが存在しない

**確認方法:**
```javascript
// ブラウザのコンソールで確認
sessionStorage.getItem('multitenant_jwt_token')
```

**対処法:**
- URLパラメータ `?token=xxx` でアクセスしているか確認
- マルチテナントサービスから正しくリダイレクトされているか確認

#### 2. トークンの有効期限切れ

**確認方法:**
```javascript
// トークンのペイロードを確認
const token = sessionStorage.getItem('multitenant_jwt_token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Expiration:', new Date(payload.exp * 1000));
```

**対処法:**
- マルチテナントサービスで再ログイン
- トークンの有効期限を延長（Cognito設定）

#### 3. JWKSの取得失敗

**確認方法:**
```bash
# Lambda Authorizerのログを確認
aws logs tail /aws/lambda/document-management-authorizer-dev --follow
```

**対処法:**
- Lambda関数がHTTPS（ポート443）にアクセスできるか確認
- セキュリティグループの設定を確認
- Cognito User Pool IDが正しいか確認

#### 4. トークン署名の検証失敗

**確認方法:**
- Lambda Authorizerのログで "Token validation failed" を確認

**対処法:**
- Cognito User Pool IDが正しいか確認
- トークンが正しいUser Poolから発行されているか確認

## 認可エラー（403 Forbidden）

### 症状
- APIリクエストが403エラーを返す
- アクセス拒否画面が表示される

### 原因と対処法

#### 1. テナントが登録されていない

**確認方法:**
```sql
SELECT tenant_id, tenant_name, status
FROM tenant
WHERE tenant_name = 'your-tenant-name';
```

**対処法:**
- マルチテナントサービスでテナントを登録
- tenant_nameがJWTトークンの `custom:tenant_name` と一致するか確認

#### 2. サブスクリプションが存在しない

**確認方法:**
```sql
SELECT tss.*, t.tenant_name, s.service_name
FROM tenant_service_subscription tss
JOIN tenant t ON tss.tenant_id = t.tenant_id
JOIN service s ON tss.service_id = s.service_id
WHERE t.tenant_name = 'your-tenant-name'
  AND s.service_name = '文書管理システム';
```

**対処法:**
- `scripts/create_test_subscription.sql` を実行
- サブスクリプションのstatusが 'active' であることを確認

#### 3. サブスクリプションの有効期限切れ

**確認方法:**
```sql
SELECT expires_at, NOW()
FROM tenant_service_subscription
WHERE subscription_id = 'your-subscription-id';
```

**対処法:**
- expires_atをNULLまたは未来の日付に更新
```sql
UPDATE tenant_service_subscription
SET expires_at = NULL, updated_at = NOW()
WHERE subscription_id = 'your-subscription-id';
```

#### 4. service_idの不一致

**確認方法:**
- Lambda Authorizerの環境変数 `DOCUMENT_SERVICE_ID` を確認
- データベースのservice_idと一致するか確認

**対処法:**
- 環境変数を正しいservice_idに更新
- Lambda関数を再デプロイ

## データベース接続エラー（503 Service Unavailable）

### 症状
- APIリクエストが503エラーを返す
- Lambda Authorizerのログに "Database connection error" が記録される

### 原因と対処法

#### 1. RDS接続情報の誤り

**確認方法:**
- Lambda Authorizerの環境変数を確認
```bash
aws lambda get-function-configuration \
  --function-name document-management-authorizer-dev \
  --query 'Environment.Variables'
```

**対処法:**
- 環境変数を正しい値に更新
- 特に `MULTITENANT_RDS_HOST`, `MULTITENANT_RDS_PASSWORD` を確認

#### 2. VPC設定の誤り

**確認方法:**
- Lambda関数がVPC内にあるか確認
- サブネットがRDSと同じVPCにあるか確認

**対処法:**
- Lambda関数のVPC設定を更新
- プライベートサブネットを使用

#### 3. セキュリティグループの設定

**確認方法:**
```bash
# Lambda関数のセキュリティグループを確認
aws lambda get-function-configuration \
  --function-name document-management-authorizer-dev \
  --query 'VpcConfig.SecurityGroupIds'
```

**対処法:**
- セキュリティグループでポート5432（PostgreSQL）へのアウトバウンドを許可
- RDSのセキュリティグループでLambdaからのインバウンドを許可

#### 4. RDSの接続制限

**確認方法:**
- RDSの接続数を確認
```sql
SELECT count(*) FROM pg_stat_activity;
```

**対処法:**
- 接続プールの設定を調整（min_conn, max_conn）
- RDSのmax_connectionsパラメータを増やす

## フロントエンドの問題

### トークンが保存されない

**確認方法:**
```javascript
// ブラウザのコンソールで確認
console.log(sessionStorage.getItem('multitenant_jwt_token'));
```

**対処法:**
- ブラウザのsessionStorageが有効か確認
- プライベートブラウジングモードを無効化
- ブラウザのキャッシュをクリア

### APIリクエストにAuthorizationヘッダーが含まれない

**確認方法:**
```javascript
// ブラウザの開発者ツールでネットワークタブを確認
// リクエストヘッダーに "Authorization: Bearer ..." があるか確認
```

**対処法:**
- `NEXT_PUBLIC_MULTITENANT_MODE` が `true` に設定されているか確認
- フロントエンドを再ビルド

### アクセス拒否画面が表示されない

**確認方法:**
- `/access-denied` ページが存在するか確認
- 403エラー時のリダイレクト処理が実装されているか確認

**対処法:**
- `frontend/app/access-denied/page.tsx` が存在するか確認
- `frontend/lib/api.ts` のエラーハンドリングを確認

## ログの確認方法

### Lambda Authorizerのログ

```bash
# リアルタイムでログを確認
aws logs tail /aws/lambda/document-management-authorizer-dev --follow

# 特定の期間のログを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/document-management-authorizer-dev \
  --start-time $(date -d '1 hour ago' +%s)000
```

### documents Lambda関数のログ

```bash
aws logs tail /aws/lambda/document-management-documents-dev --follow
```

### search Lambda関数のログ

```bash
aws logs tail /aws/lambda/document-management-search-dev --follow
```

## よくある質問

### Q: スタンドアロンモードに戻すことはできますか？

A: はい、`MULTITENANT_MODE` 環境変数を `false` に設定して再デプロイすることで、スタンドアロンモードに戻すことができます。

### Q: 既存のデータはマルチテナントモードでも使用できますか？

A: はい、既存のデータはそのまま使用できます。ただし、テナント分離を有効にする場合は、データにtenant_idを追加する必要があります。

### Q: 複数のテナントで同じサービスを使用できますか？

A: はい、各テナントにサブスクリプションを作成することで、複数のテナントが同じサービスを使用できます。

### Q: トークンの有効期限はどのくらいですか？

A: Cognitoの設定によりますが、通常は1時間です。Cognito User Poolの設定で変更できます。

## サポート

問題が解決しない場合は、以下の情報を含めてサポートに連絡してください：

1. エラーメッセージ
2. Lambda関数のログ
3. 環境変数の設定（パスワードを除く）
4. 実行したSQLクエリの結果
5. ブラウザのコンソールログ

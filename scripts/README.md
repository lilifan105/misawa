# データベース初期化スクリプト

## サービス登録手順

### 1. UUIDの生成

PostgreSQLに接続して、サービスIDとなるUUIDを生成します。

```sql
SELECT gen_random_uuid();
```

生成されたUUID（例: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`）をメモしてください。

### 2. SQLスクリプトの編集

`register_service.sql` を開き、以下の箇所を編集します：

```sql
service_id: 生成したUUIDに置き換え
service_url: 実際のフロントエンドURLに変更
icon_url: アイコンURLを設定（オプション）
```

### 3. SQLスクリプトの実行

マルチテナントサービスのRDS PostgreSQLに接続して、スクリプトを実行します。

```bash
psql -h multitenant-db.example.com \
     -U admin_user \
     -d multitenant \
     -f register_service.sql
```

または、pgAdminなどのGUIツールを使用して実行することもできます。

### 4. 環境変数の設定

生成したUUIDを環境変数 `DOCUMENT_SERVICE_ID` に設定します。

**Terraform（terraform.tfvars）:**
```hcl
document_service_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

**Lambda関数の環境変数:**
```bash
DOCUMENT_SERVICE_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### 5. 登録確認

サービスが正しく登録されたことを確認します。

```sql
SELECT 
    service_id,
    service_name,
    description,
    service_url,
    status,
    created_at
FROM service
WHERE service_name = '文書管理システム';
```

## テストテナントのサブスクリプション作成

### 1. テナントIDの確認

テスト用テナントのIDを確認します。

```sql
SELECT tenant_id, tenant_name, status
FROM tenant
WHERE tenant_name = 'test-company'; -- テスト用テナント名に変更
```

### 2. サブスクリプションの作成

テストテナントに文書管理システムへのアクセス権を付与します。

```sql
INSERT INTO tenant_service_subscription (
    subscription_id,
    tenant_id,
    service_id,
    access_level,
    subscribed_at,
    expires_at,
    status,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'テナントのUUID', -- 上記で確認したtenant_id
    'サービスのUUID', -- register_service.sqlで設定したservice_id
    'standard',
    NOW(),
    NULL, -- 無期限の場合はNULL、期限がある場合は日付を設定
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (tenant_id, service_id) DO UPDATE SET
    access_level = EXCLUDED.access_level,
    status = EXCLUDED.status,
    updated_at = NOW();
```

### 3. サブスクリプション確認

サブスクリプションが正しく作成されたことを確認します。

```sql
SELECT 
    tss.subscription_id,
    t.tenant_name,
    s.service_name,
    tss.access_level,
    tss.status,
    tss.subscribed_at,
    tss.expires_at
FROM tenant_service_subscription tss
JOIN tenant t ON tss.tenant_id = t.tenant_id
JOIN service s ON tss.service_id = s.service_id
WHERE s.service_name = '文書管理システム';
```

## トラブルシューティング

### サービスが登録できない

- `service_id` が既に存在していないか確認
- `service_url` が有効なURL形式か確認
- データベース接続情報が正しいか確認

### サブスクリプションが作成できない

- `tenant_id` と `service_id` が存在するか確認
- `tenant_id` と `service_id` の組み合わせが既に存在していないか確認
- `status` が 'active' になっているか確認

### 認証が失敗する

- `DOCUMENT_SERVICE_ID` 環境変数が正しく設定されているか確認
- Lambda Authorizer関数が正しくデプロイされているか確認
- RDS接続情報が正しいか確認

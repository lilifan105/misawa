-- テストテナントのサブスクリプション作成SQLスクリプト
-- マルチテナントサービスのRDS PostgreSQLデータベースで実行します

-- 1. テナントIDの確認
-- テスト用テナントのIDを確認します
SELECT tenant_id, tenant_name, status
FROM tenant
WHERE tenant_name = 'test-company'; -- テスト用テナント名に変更してください

-- 2. サービスIDの確認
-- 文書管理システムのサービスIDを確認します
SELECT service_id, service_name, status
FROM service
WHERE service_name = '文書管理システム';

-- 3. サブスクリプションの作成
-- 上記で確認したtenant_idとservice_idを使用してサブスクリプションを作成します
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
    'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', -- テナントのUUIDに置き換え
    'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy', -- サービスのUUIDに置き換え
    'standard', -- アクセスレベル: standard, premium, enterprise など
    NOW(),
    NULL, -- 無期限の場合はNULL、期限がある場合は '2025-12-31 23:59:59' のように設定
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (tenant_id, service_id) DO UPDATE SET
    access_level = EXCLUDED.access_level,
    status = EXCLUDED.status,
    subscribed_at = EXCLUDED.subscribed_at,
    expires_at = EXCLUDED.expires_at,
    updated_at = NOW();

-- 4. サブスクリプション確認
-- サブスクリプションが正しく作成されたことを確認します
SELECT 
    tss.subscription_id,
    t.tenant_name,
    s.service_name,
    tss.access_level,
    tss.status,
    tss.subscribed_at,
    tss.expires_at,
    tss.created_at
FROM tenant_service_subscription tss
JOIN tenant t ON tss.tenant_id = t.tenant_id
JOIN service s ON tss.service_id = s.service_id
WHERE s.service_name = '文書管理システム'
  AND t.tenant_name = 'test-company'; -- テスト用テナント名に変更してください

-- 5. アクティブなサブスクリプション一覧
-- 文書管理システムへのアクティブなサブスクリプションを全て表示
SELECT 
    t.tenant_name,
    tss.access_level,
    tss.status,
    tss.subscribed_at,
    tss.expires_at
FROM tenant_service_subscription tss
JOIN tenant t ON tss.tenant_id = t.tenant_id
JOIN service s ON tss.service_id = s.service_id
WHERE s.service_name = '文書管理システム'
  AND tss.status = 'active'
  AND (tss.expires_at IS NULL OR tss.expires_at > NOW())
ORDER BY t.tenant_name;

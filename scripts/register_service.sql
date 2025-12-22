-- 文書管理システムのサービス登録SQLスクリプト
-- マルチテナントサービスのRDS PostgreSQLデータベースで実行します

-- サービスIDを生成（UUIDv4）
-- 実際の実行時には、生成されたUUIDをDOCUMENT_SERVICE_ID環境変数に設定してください
-- 例: SELECT gen_random_uuid(); を実行して取得

-- サービス登録
INSERT INTO service (
    service_id,
    service_name,
    description,
    service_url,
    icon_url,
    status,
    created_at,
    updated_at
) VALUES (
    'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', -- ここに生成したUUIDを設定
    '文書管理システム',
    '社内文書の登録・検索・管理を行うシステム。PDF文書のアップロード、カテゴリ分類、RAG検索機能を提供します。',
    'https://documents.example.com', -- 実際のフロントエンドURLに変更
    'https://cdn.example.com/icons/documents.png', -- アイコンURLを設定（オプション）
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (service_id) DO UPDATE SET
    service_name = EXCLUDED.service_name,
    description = EXCLUDED.description,
    service_url = EXCLUDED.service_url,
    icon_url = EXCLUDED.icon_url,
    status = EXCLUDED.status,
    updated_at = NOW();

-- 登録結果を確認
SELECT 
    service_id,
    service_name,
    description,
    service_url,
    status,
    created_at
FROM service
WHERE service_name = '文書管理システム';

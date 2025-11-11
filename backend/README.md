# バックエンド - Lambda関数

## 構成

```
backend/
└── functions/
    ├── documents/
    │   └── lambda_function.py
    ├── search/
    │   └── lambda_function.py
    ├── external_api/
    │   └── lambda_function.py
    ├── documents.zip
    ├── search.zip
    ├── external_api.zip
    └── package_all.ps1
```

## Lambda関数一覧

### 1. documents
文書のCRUD操作

**エンドポイント:**
- `GET /documents` - 文書一覧取得
- `GET /documents/{id}` - 文書詳細取得
- `POST /documents` - 文書登録
- `PUT /documents/{id}` - 文書更新
- `DELETE /documents/{id}` - 文書削除

### 2. search
検索・RAG機能（将来実装）

**エンドポイント:**
- `POST /search` - 文書検索

### 3. external_api
外部API（GCP連携）

**エンドポイント:**
- `GET /external/documents` - 文書一覧取得（APIキー認証）

## パッケージング

```powershell
cd backend/functions
.\package_all.ps1
```

## デプロイ

```bash
cd ../../infrastructure
terraform apply
```

## 環境変数

### documents
- `DOCUMENTS_TABLE` - DynamoDBテーブル名
- `S3_BUCKET` - S3バケット名

### external_api
- `DOCUMENTS_TABLE` - DynamoDBテーブル名
- `EXTERNAL_API_KEY` - 外部APIキー

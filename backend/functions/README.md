# Lambda関数（AWS Lambda Powertools使用）

## 構成

```
functions/
├── documents/
│   ├── lambda_function.py
│   └── requirements.txt
├── search/
│   ├── lambda_function.py
│   └── requirements.txt
├── external_api/
│   ├── lambda_function.py
│   └── requirements.txt
└── package_all.ps1
```

## AWS Lambda Powertools

各Lambda関数でPowertoolsを使用：
- **Logger**: 構造化ログ
- **Tracer**: X-Rayトレーシング
- **APIGatewayRestResolver**: ルーティング

### documents関数のエンドポイント
- `GET /documents` - 一覧取得
- `GET /documents/{id}` - 詳細取得
- `POST /documents` - 登録
- `PUT /documents/{id}` - 更新
- `DELETE /documents/{id}` - 削除

### search関数のエンドポイント
- `POST /search` - 検索（将来実装）

### external_api関数のエンドポイント
- `GET /external/documents` - 外部API

## パッケージング

```powershell
cd backend/functions
.\package_all.ps1
```

依存関係（Powertools）を自動的にインストールしてパッケージングします。

## デプロイ

```bash
cd ../../infrastructure
terraform apply
```

## 環境変数

### documents
- `DOCUMENTS_TABLE` - DynamoDBテーブル名
- `S3_BUCKET` - S3バケット名
- `POWERTOOLS_SERVICE_NAME` - documents
- `LOG_LEVEL` - INFO

### external_api
- `DOCUMENTS_TABLE` - DynamoDBテーブル名
- `EXTERNAL_API_KEY` - 外部APIキー
- `POWERTOOLS_SERVICE_NAME` - external-api
- `LOG_LEVEL` - INFO

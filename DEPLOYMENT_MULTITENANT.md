# マルチテナント認証統合 デプロイ手順

## 前提条件

1. AWS CLIがインストールされ、適切な認証情報が設定されていること
2. Terraformがインストールされていること（バージョン >= 1.9）
3. Lambda関数のパッケージが作成されていること
   - `backend/functions/authorizer.zip`
   - `backend/functions/documents.zip`
   - `backend/functions/search.zip`
4. Lambda Layerが構築されていること
   - `backend/shared/shared-layer.zip`

## デプロイ手順

### 1. Lambda関数のパッケージング

既に完了している場合はスキップしてください。

```powershell
# Authorizer関数
cd backend/functions/authorizer
Compress-Archive -Path lambda_function.py -DestinationPath ../authorizer.zip -Force

# Documents関数
cd ../documents
Compress-Archive -Path lambda_function.py -DestinationPath ../documents.zip -Force

# Search関数
cd ../search
Compress-Archive -Path lambda_function.py -DestinationPath ../search.zip -Force
```

### 2. Lambda Layerの構築

既に完了している場合はスキップしてください。

```powershell
cd backend/shared
.\build_layer.ps1
```

### 3. Terraform設定の確認

```powershell
cd infrastructure
terraform init
terraform plan -out=tfplan
```

以下の変更が表示されることを確認：
- 18個のリソースを作成
- 5個のリソースを更新
- 8個のリソースを削除

### 4. Terraformデプロイの実行

```powershell
terraform apply tfplan
```

デプロイには5-10分程度かかります。

### 5. デプロイ結果の確認

```powershell
# Lambda Authorizer関数の確認
aws lambda get-function --function-name misawa-authorizer-dev --region ap-northeast-1

# API Gateway Authorizerの確認
aws apigatewayv2 get-authorizers --api-id <API_ID> --region ap-northeast-1

# Lambda Layerの確認
aws lambda list-layers --region ap-northeast-1 | Select-String "misawa-shared"
```

### 6. データベースの初期化

マルチテナントRDSにサービスを登録します。

```powershell
# RDSに接続
psql -h multitenant-saas-platform-poc-dev-db.csebzakbjiw1.ap-northeast-1.rds.amazonaws.com -U dbadmin -d multitenant_saas_poc_db_dev

# サービス登録SQLを実行
\i scripts/register_service.sql

# テストサブスクリプション作成（オプション）
\i scripts/create_test_subscription.sql
```

または、pgAdminなどのGUIツールを使用してSQLファイルを実行してください。

### 7. フロントエンドの環境変数設定

`frontend/.env.local`を更新：

```bash
# APIエンドポイント（Terraform outputから取得）
NEXT_PUBLIC_API_ENDPOINT=https://<API_ID>.execute-api.ap-northeast-1.amazonaws.com/dev

# マルチテナントモード
NEXT_PUBLIC_MULTITENANT_MODE=true

# マルチテナントサービスURL
NEXT_PUBLIC_MULTITENANT_URL=https://portal.example.com

# サポートメール
NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com
```

### 8. フロントエンドのデプロイ

AWS Amplifyが自動的にデプロイを開始します。進捗を確認：

```powershell
aws amplify list-apps --region ap-northeast-1
aws amplify get-job --app-id <APP_ID> --branch-name main --job-id <JOB_ID> --region ap-northeast-1
```

## デプロイ後の確認

### 1. Lambda Authorizer関数のテスト

```powershell
# テストイベントを作成
$testEvent = @{
    type = "REQUEST"
    methodArn = "arn:aws:execute-api:ap-northeast-1:340084826803:gye5ghvoyb/dev/GET/documents"
    headers = @{
        Authorization = "Bearer <VALID_JWT_TOKEN>"
    }
} | ConvertTo-Json

# Lambda関数を呼び出し
aws lambda invoke --function-name misawa-authorizer-dev --payload $testEvent --region ap-northeast-1 response.json

# レスポンスを確認
Get-Content response.json | ConvertFrom-Json
```

### 2. API Gatewayのテスト

```powershell
# 有効なJWTトークンでAPIを呼び出し
$headers = @{
    "Authorization" = "Bearer <VALID_JWT_TOKEN>"
}
Invoke-RestMethod -Uri "https://<API_ID>.execute-api.ap-northeast-1.amazonaws.com/dev/documents" -Headers $headers -Method GET
```

### 3. フロントエンドのテスト

1. ブラウザでフロントエンドURLにアクセス
2. URLパラメータ `?token=<VALID_JWT_TOKEN>` を追加
3. トークンがsessionStorageに保存されることを確認
4. API呼び出しが成功することを確認

## トラブルシューティング

### Lambda Authorizer関数が呼び出されない

- API Gateway Authorizerが正しく設定されているか確認
- Lambda関数の権限が正しく設定されているか確認

### 401エラーが発生する

- JWTトークンの有効期限を確認
- Cognito User Pool IDが正しいか確認
- JWKSが取得できているか確認（CloudWatch Logsを確認）

### 403エラーが発生する

- テナントがデータベースに登録されているか確認
- サブスクリプションがアクティブか確認
- service_idが正しいか確認

### データベース接続エラー

- Lambda関数がVPC内にあるか確認
- セキュリティグループでポート5432が開いているか確認
- RDS接続情報が正しいか確認

### Lambda関数のログ確認

```powershell
# Lambda Authorizer関数のログ
aws logs tail /aws/lambda/misawa-authorizer-dev --follow --region ap-northeast-1

# Documents関数のログ
aws logs tail /aws/lambda/misawa-documents-dev --follow --region ap-northeast-1

# Search関数のログ
aws logs tail /aws/lambda/misawa-search-dev --follow --region ap-northeast-1
```

## ロールバック手順

問題が発生した場合、以前の状態に戻すことができます。

```powershell
cd infrastructure

# マルチテナントモードを無効化
# terraform.tfvarsを編集
# multitenant_mode = "false"

# 変更を適用
terraform plan -out=tfplan
terraform apply tfplan
```

## 参考資料

- [マルチテナント設定ガイド](docs/multitenant-setup.md)
- [モード切り替えガイド](docs/multitenant-mode-switching.md)
- [トラブルシューティングガイド](docs/multitenant-troubleshooting.md)
- [実装状況](MULTITENANT_IMPLEMENTATION.md)

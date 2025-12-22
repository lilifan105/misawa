# マルチテナント認証・認可 セットアップガイド

## 概要

このガイドでは、文書管理システムをマルチテナントSaaSプラットフォームの一部として統合するための環境変数設定と構成手順を説明します。

## 前提条件

- マルチテナントサービスのRDS PostgreSQLデータベースへのアクセス権限
- Cognito User Pool IDの取得
- AWS Lambda、API Gateway、VPCの基本的な知識

## 環境変数一覧

### バックエンド（Lambda関数）

#### Lambda Authorizer

| 環境変数名 | 説明 | 必須 | デフォルト値 | 例 |
|-----------|------|------|------------|-----|
| `COGNITO_REGION` | CognitoのAWSリージョン | ○ | - | `ap-northeast-1` |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | ○ | - | `ap-northeast-1_xxxxxxxxx` |
| `MULTITENANT_RDS_HOST` | マルチテナントRDSホスト | ○ | - | `multitenant-db.example.com` |
| `MULTITENANT_RDS_PORT` | RDSポート番号 | ○ | `5432` | `5432` |
| `MULTITENANT_RDS_DATABASE` | データベース名 | ○ | `multitenant` | `multitenant` |
| `MULTITENANT_RDS_USER` | データベースユーザー | ○ | - | `readonly_user` |
| `MULTITENANT_RDS_PASSWORD` | データベースパスワード | ○ | - | `********` |
| `DOCUMENT_SERVICE_ID` | 文書管理サービスUUID | ○ | - | `a1b2c3d4-...` |
| `MULTITENANT_MODE` | マルチテナントモード | ○ | `false` | `true` |

#### documents / search Lambda関数

| 環境変数名 | 説明 | 必須 | デフォルト値 |
|-----------|------|------|------------|
| `MULTITENANT_MODE` | マルチテナントモード | ○ | `false` |

既存の環境変数（`DOCUMENTS_TABLE`, `DOCUMENTS_BUCKET`など）はそのまま維持します。

### フロントエンド（Next.js）

| 環境変数名 | 説明 | 必須 | デフォルト値 | 例 |
|-----------|------|------|------------|-----|
| `NEXT_PUBLIC_API_ENDPOINT` | APIエンドポイント | ○ | - | `https://api.documents.example.com` |
| `NEXT_PUBLIC_MULTITENANT_MODE` | マルチテナントモード | ○ | `false` | `true` |
| `NEXT_PUBLIC_MULTITENANT_URL` | ポータルURL | ○ | - | `https://portal.example.com` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | サポートメール | × | - | `support@example.com` |

## セットアップ手順

### 1. サービス登録

詳細は `scripts/README.md` を参照してください。

```bash
# 1. UUIDを生成
psql -h multitenant-db.example.com -U admin_user -d multitenant \
  -c "SELECT gen_random_uuid();"

# 2. register_service.sqlを編集してUUIDを設定

# 3. SQLスクリプトを実行
psql -h multitenant-db.example.com -U admin_user -d multitenant \
  -f scripts/register_service.sql
```

### 2. Lambda Layer構築

```powershell
# Windows
cd backend/shared
.\build_layer.ps1
```

```bash
# Linux/Mac
cd backend/shared
chmod +x build_layer.sh
./build_layer.sh
```

### 3. Terraform設定

`infrastructure/terraform.tfvars` を作成：

```hcl
# terraform.tfvars.multitenant.exampleを参考に設定
multitenant_mode = "true"
cognito_region = "ap-northeast-1"
cognito_user_pool_id = "ap-northeast-1_xxxxxxxxx"
# ... その他の設定
```

### 4. インフラデプロイ

```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

### 5. フロントエンド設定

`frontend/.env.local` を作成：

```bash
NEXT_PUBLIC_API_ENDPOINT=https://api.documents.example.com
NEXT_PUBLIC_MULTITENANT_MODE=true
NEXT_PUBLIC_MULTITENANT_URL=https://portal.example.com
NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com
```

### 6. テストテナントのサブスクリプション作成

```bash
# create_test_subscription.sqlを編集してテナントIDとサービスIDを設定
psql -h multitenant-db.example.com -U admin_user -d multitenant \
  -f scripts/create_test_subscription.sql
```

## 動作確認

### 1. JWTトークンの取得

マルチテナントサービスでログインし、JWTトークンを取得します。

### 2. フロントエンドアクセス

```
https://documents.example.com?token=<JWT_TOKEN>
```

### 3. API呼び出しテスト

```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  https://api.documents.example.com/documents
```

## 次のステップ

- [モード切り替えガイド](./multitenant-mode-switching.md)
- [トラブルシューティング](./multitenant-troubleshooting.md)

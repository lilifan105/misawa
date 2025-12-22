# マルチテナントモード切り替えガイド

## 概要

文書管理システムは、スタンドアロンモードとマルチテナントモードの2つのモードで動作できます。
このガイドでは、モード間の切り替え方法を説明します。

## モードの違い

### スタンドアロンモード（デフォルト）

- 既存のCognito認証を使用
- 独立したサービスとして動作
- テナント分離なし
- Lambda Authorizerを使用しない

### マルチテナントモード

- マルチテナントサービスからのJWT認証
- 親サービスの一部として動作
- テナント分離あり
- Lambda Authorizerによる認証・認可

## モード切り替え手順

### スタンドアロン → マルチテナント

#### 1. 環境変数の設定

**バックエンド（Terraform）:**

```hcl
# terraform.tfvars
multitenant_mode = "true"
cognito_region = "ap-northeast-1"
cognito_user_pool_id = "ap-northeast-1_xxxxxxxxx"
multitenant_rds_host = "multitenant-db.example.com"
# ... その他のマルチテナント設定
```

**フロントエンド（.env.local）:**

```bash
NEXT_PUBLIC_MULTITENANT_MODE=true
NEXT_PUBLIC_MULTITENANT_URL=https://portal.example.com
```

#### 2. Lambda Layerの構築とデプロイ

```bash
cd backend/shared
./build_layer.sh  # または build_layer.ps1
```

#### 3. Terraformの適用

```bash
cd infrastructure
terraform plan
terraform apply
```

これにより以下が実行されます：
- Lambda Authorizer関数のデプロイ
- API Gateway Authorizerの設定
- 既存Lambda関数へのLayerアタッチ
- 環境変数の更新

#### 4. フロントエンドの再ビルドとデプロイ

```bash
cd frontend
npm run build
# デプロイコマンド（環境に応じて）
```

#### 5. サービス登録とサブスクリプション作成

```bash
# サービス登録
psql -h multitenant-db.example.com -U admin_user -d multitenant \
  -f scripts/register_service.sql

# テストテナントのサブスクリプション作成
psql -h multitenant-db.example.com -U admin_user -d multitenant \
  -f scripts/create_test_subscription.sql
```

### マルチテナント → スタンドアロン

#### 1. 環境変数の設定

**バックエンド（Terraform）:**

```hcl
# terraform.tfvars
multitenant_mode = "false"
```

**フロントエンド（.env.local）:**

```bash
NEXT_PUBLIC_MULTITENANT_MODE=false
```

#### 2. Terraformの適用

```bash
cd infrastructure
terraform plan
terraform apply
```

これにより以下が実行されます：
- Lambda Authorizerの無効化
- API Gateway Authorizerの削除
- 既存Lambda関数の環境変数更新

#### 3. フロントエンドの再ビルドとデプロイ

```bash
cd frontend
npm run build
# デプロイコマンド（環境に応じて）
```

## 動作確認

### スタンドアロンモード

```bash
# 直接APIにアクセス可能
curl https://api.documents.example.com/documents
```

### マルチテナントモード

```bash
# JWTトークンが必要
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  https://api.documents.example.com/documents
```

## 注意事項

### データの互換性

- スタンドアロンモードで作成されたデータは、マルチテナントモードでも引き続き使用できます
- ただし、テナント分離を有効にする場合は、既存データにtenant_idを追加する必要があります

### 認証フロー

- スタンドアロンモード: Cognitoログイン画面 → アプリケーション
- マルチテナントモード: ポータルログイン → JWTトークン付きでリダイレクト → アプリケーション

### コスト

- マルチテナントモード: Lambda Authorizer、VPC接続、RDS接続の追加コストが発生します
- スタンドアロンモード: 既存のコストのみ

## トラブルシューティング

### モード切り替え後に認証エラーが発生する

1. 環境変数が正しく設定されているか確認
2. Lambda関数が再デプロイされているか確認
3. フロントエンドが再ビルドされているか確認

### API Gateway Authorizerが動作しない

1. Lambda Authorizer関数がデプロイされているか確認
2. API Gateway Authorizerが正しく設定されているか確認
3. Lambda関数の実行ロールに必要な権限があるか確認

### データベース接続エラー

1. VPC設定が正しいか確認
2. セキュリティグループでポート5432が開いているか確認
3. RDS接続情報が正しいか確認

# マルチテナント認証・認可統合 実装状況

## 実装完了タスク

### ✅ タスク1: 共有モジュールの実装
- JWT検証モジュール (`backend/shared/jwt_validator.py`)
- RDS接続モジュール (`backend/shared/rds_connection.py`)
- サブスクリプション検証モジュール (`backend/shared/subscription_validator.py`)
- テナントコンテキストモジュール (`backend/shared/tenant_context.py`)
- Lambda Layer構築スクリプト (`build_layer.sh`, `build_layer.ps1`)

### ✅ タスク2: Lambda Authorizerの実装
- Lambda Authorizer関数 (`backend/functions/authorizer/lambda_function.py`)
- JWT検証、テナントID取得、サブスクリプション確認
- IAMポリシー生成とコンテキスト伝播
- エラーハンドリングとログ記録

### ✅ タスク3: 既存Lambda関数の更新
- documents Lambda関数の更新（テナントコンテキスト統合）
- search Lambda関数の更新（テナントコンテキスト統合）
- すべてのログにテナント情報を追加

### ✅ タスク4: フロントエンド認証モジュールの実装
- 認証モジュール (`frontend/lib/auth.ts`)
- APIクライアントの更新（認証ヘッダー追加）
- トークン初期化処理（URLパラメータから取得）
- 401/403エラー時のリダイレクト処理

### ✅ タスク5: アクセス拒否画面の実装
- アクセス拒否ページ (`frontend/app/access-denied/page.tsx`)
- レスポンシブデザイン対応
- テナント情報とサービス名の表示

### ✅ タスク6: インフラストラクチャの更新
- Lambda Authorizer のTerraform設定 (`infrastructure/modules/compute/authorizer.tf`)
- API Gateway Authorizer の設定 (`infrastructure/modules/api/authorizer.tf`)
- Lambda Layer の設定（共有モジュール）
- 環境変数の設定（variables.tf更新）
- VPCとセキュリティグループの設定

### ✅ タスク7: サービス登録とデータベース初期化
- サービス登録SQLスクリプト (`scripts/register_service.sql`)
- テストサブスクリプション作成スクリプト (`scripts/create_test_subscription.sql`)
- データベース初期化手順書 (`scripts/README.md`)

### ✅ タスク9: ドキュメントと設定ガイドの作成
- 環境変数設定ガイド (`docs/multitenant-setup.md`)
- モード切り替えガイド (`docs/multitenant-mode-switching.md`)
- トラブルシューティングガイド (`docs/multitenant-troubleshooting.md`)

## 次のステップ（未実装）

### タスク8: 統合とE2Eテスト
- E2Eテストシナリオの作成
- E2Eテストの実行

**注意:** E2Eテストは実際のデプロイ後に実行する必要があります。

## Terraform設定完了

### ✅ 完了した設定
- `infrastructure/main.tf`: マルチテナント設定をcomputeモジュールとapiモジュールに追加
- `infrastructure/variables.tf`: マルチテナント関連の変数を追加
- `infrastructure/terraform.tfvars`: マルチテナント設定とVPC設定を追加
- `infrastructure/modules/api/outputs.tf`: `api_execution_arn`を追加
- `infrastructure/modules/api/variables.tf`: マルチテナント関連の変数を追加
- `infrastructure/modules/api/main.tf`: 既存のルートをマルチテナントモードでない場合のみ作成するように修正
- `infrastructure/modules/api/authorizer.tf`: 変数の型をstringに修正、Lambda呼び出し権限を追加
- `infrastructure/modules/compute/outputs.tf`: authorizer関連のoutputsを追加
- `infrastructure/modules/compute/authorizer.tf`: すべてのリソースにcountを追加
- `infrastructure/modules/compute/layers.tf`: shared layerにcountを追加
- `infrastructure/modules/compute/main.tf`: documents/search関数のlayersを条件付きで設定

### Terraform Plan結果
- 18個のリソースを作成
- 5個のリソースを更新
- 8個のリソースを削除（既存のルートを認証付きルートに置き換え）

### デプロイ準備完了
すべてのTerraform設定が完了し、`terraform plan`が成功しました。次のステップでデプロイを実行できます。

## 環境変数設定

### バックエンド（Lambda関数）

```bash
# Cognito設定
COGNITO_REGION=ap-northeast-1
COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx

# RDS接続設定
MULTITENANT_RDS_HOST=multitenant-db.example.com
MULTITENANT_RDS_PORT=5432
MULTITENANT_RDS_DATABASE=multitenant
MULTITENANT_RDS_USER=readonly_user
MULTITENANT_RDS_PASSWORD=<secure-password>

# サービス設定
DOCUMENT_SERVICE_ID=uuid-for-document-management

# モード設定
MULTITENANT_MODE=true

# キャッシュ設定
SUBSCRIPTION_CACHE_TTL=300
```

### フロントエンド

```bash
# APIエンドポイント
NEXT_PUBLIC_API_ENDPOINT=https://api.documents.example.com

# マルチテナントモード
NEXT_PUBLIC_MULTITENANT_MODE=true

# マルチテナントサービスURL
NEXT_PUBLIC_MULTITENANT_URL=https://portal.example.com

# サポートメール
NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com
```

## Lambda Layer構築方法

### Windows (PowerShell)

```powershell
cd backend/shared
.\build_layer.ps1
```

### Linux/Mac (Bash)

```bash
cd backend/shared
chmod +x build_layer.sh
./build_layer.sh
```

構築されたLayerは `backend/shared/shared-layer.zip` に出力されます。

## デプロイ手順（概要）

1. **Lambda Layerのデプロイ**
   - `shared-layer.zip` をAWS Lambdaにアップロード
   - 既存のLambda関数にLayerをアタッチ

2. **Lambda Authorizerのデプロイ**
   - `backend/functions/authorizer` をパッケージング
   - Lambda関数を作成
   - VPC設定（RDSアクセス用）
   - 環境変数を設定

3. **API Gateway Authorizerの設定**
   - Lambda Authorizerを作成
   - すべてのルートにAuthorizerを適用

4. **既存Lambda関数の更新**
   - 環境変数を追加
   - Lambda Layerをアタッチ
   - 再デプロイ

5. **フロントエンドのデプロイ**
   - 環境変数を設定
   - ビルドしてデプロイ

## テスト方法

### ローカルテスト

1. **共有モジュールのテスト**
   ```bash
   cd backend/shared
   pytest tests/unit/
   ```

2. **フロントエンドのテスト**
   ```bash
   cd frontend
   npm test
   ```

### 統合テスト

1. **Lambda Authorizerのテスト**
   - 有効なJWTトークンでAPIを呼び出し
   - 無効なトークンで401エラーを確認
   - サブスクリプションなしで403エラーを確認

2. **フロントエンドのテスト**
   - URLパラメータ `?token=xxx` でアクセス
   - トークンがsessionStorageに保存されることを確認
   - API呼び出しにAuthorizationヘッダーが含まれることを確認

## トラブルシューティング

### トークンが保存されない
- ブラウザのsessionStorageが有効か確認
- コンソールにエラーが出ていないか確認

### 401エラーが発生する
- トークンの有効期限を確認
- Cognito User Pool IDが正しいか確認
- JWKSが取得できているか確認

### 403エラーが発生する
- テナントがデータベースに登録されているか確認
- サブスクリプションがアクティブか確認
- service_idが正しいか確認

### データベース接続エラー
- RDS接続情報が正しいか確認
- Lambda関数がVPC内にあるか確認
- セキュリティグループでポート5432が開いているか確認

## 参考資料

- [要件定義書](.kiro/specs/multitenant-auth-integration/requirements.md)
- [設計書](.kiro/specs/multitenant-auth-integration/design.md)
- [タスクリスト](.kiro/specs/multitenant-auth-integration/tasks.md)
- [共有モジュールREADME](backend/shared/README.md)

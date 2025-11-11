# デプロイ手順書

## 前提条件

- Node.js 18以上
- Python 3.12
- Terraform 1.0以上
- AWS CLI（設定済み）
- pip
- GitHubリポジトリ（Amplify用）

## デプロイ手順

### 1. LayerとLambda関数のビルド（一括）

```powershell
cd infrastructure
.\build_and_package.ps1
```

**作成されるファイル:**
- `backend/layers/powertools.zip` (~10MB)
- `backend/functions/documents.zip` (~5KB)
- `backend/functions/search.zip` (~2KB)
- `backend/functions/external_api.zip` (~3KB)

### 2. Terraformでインフラ構築

```bash
cd ..\..\infrastructure

# 初期化
terraform init

# 変数ファイル作成
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvarsを編集（repository_urlを設定）

# デプロイ
terraform plan
terraform apply
```

### 4. 出力の確認

```bash
terraform output
```

出力例:
```
api_endpoint = "https://abc123.execute-api.ap-northeast-1.amazonaws.com/dev"
cognito_user_pool_id = "ap-northeast-1_ABC123"
cognito_client_id = "1a2b3c4d5e6f7g8h9i0j"
amplify_app_id = "d1a2b3c4d5e6f"
amplify_app_url = "https://main.d1a2b3c4d5e6f.amplifyapp.com"
```

### 5. Amplifyアプリの接続

AmplifyコンソールでGitHubリポジトリを接続:

1. AWS Amplifyコンソールを開く
2. 作成されたアプリ（terraform outputのamplify_app_id）を選択
3. 「ホスティング環境を設定」→「GitHub」を選択
4. リポジトリとブランチを接続
5. 自動デプロイが開始される

### 6. ローカル開発（オプション）

```bash
cd frontend

# .env.localを作成
cp .env.local.example .env.local
# API_ENDPOINTを設定

npm install
npm run dev
```

## Lambda Layer使用の利点

### デプロイサイズ比較

| 方式 | 各関数サイズ | 合計サイズ |
|------|-------------|-----------|
| **Layer使用** | ~5KB | ~10MB (Layer) + 10KB (関数3つ) |
| Layer未使用 | ~10MB | ~30MB (関数3つ) |

### メリット

1. **デプロイ速度**: 関数のzipが小さいため高速
2. **バージョン管理**: Layerを更新するだけで全関数に反映
3. **コスト削減**: ストレージ使用量が削減

## トラブルシューティング

### Layerが見つからない

```bash
cd backend/layers
.\build_powertools.ps1
```

### Lambda関数が見つからない

```bash
cd backend/functions
.\package_all.ps1
```

### Terraformエラー

```bash
cd infrastructure
terraform init -upgrade
terraform plan
```

## 更新手順

### Powertoolsのバージョン更新

```powershell
# 1. Layerを再ビルド
cd backend\layers
.\build_powertools.ps1

# 2. Terraformで更新
cd ..\..\infrastructure
terraform apply
```

### Lambda関数コードの更新

```powershell
# 1. 関数を再パッケージング
cd backend\functions
.\package_all.ps1

# 2. Terraformで更新（自動検知）
cd ..\..\infrastructure
terraform apply
```

## リソースの削除

```bash
cd infrastructure
terraform destroy
```

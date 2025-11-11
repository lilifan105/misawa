# クイックスタートガイド

## 📋 前提条件

- Node.js 18以上
- Python 3.12
- Terraform 1.0以上
- AWS CLI（設定済み）
- GitHubアカウント

## 🚀 デプロイ手順（5ステップ）

### ステップ1: GitHubリポジトリ作成

1. https://github.com/new にアクセス
2. リポジトリ名: `misawa`
3. **「Initialize with README」はチェックしない**
4. 「Create repository」をクリック

### ステップ2: コードをGitHubにプッシュ

```powershell
# 自動セットアップスクリプトを実行
.\setup-github.ps1

# または手動で
git remote add origin https://github.com/YOUR_USERNAME/misawa.git
git push -u origin main
```

### ステップ3: Lambda関数をビルド

```powershell
cd infrastructure
.\build_and_package.ps1
```

### ステップ4: Terraform設定

```powershell
# 設定ファイルをコピー
cp terraform.tfvars.example terraform.tfvars

# terraform.tfvars を編集
# repository_url = "https://github.com/YOUR_USERNAME/misawa"
```

### ステップ5: デプロイ

```powershell
terraform init
terraform apply
```

出力例:
```
api_endpoint = "https://abc123.execute-api.ap-northeast-1.amazonaws.com"
amplify_app_id = "d1a2b3c4d5e6f"
amplify_app_url = "https://main.d1a2b3c4d5e6f.amplifyapp.com"
```

### ステップ6: Amplifyでリポジトリ接続

1. AWS Amplify コンソールを開く
2. 作成されたアプリ（amplify_app_id）を選択
3. 「ホスティング環境を設定」→「GitHub」
4. リポジトリとブランチ（main）を接続
5. 自動ビルド・デプロイ開始 🎉

## 🌐 アクセス

デプロイ完了後、`amplify_app_url` にアクセス:
```
https://main.d1a2b3c4d5e6f.amplifyapp.com
```

## 📁 プロジェクト構成

```
misawa/
├── frontend/          # Next.js フロントエンド
├── backend/           # Lambda関数
├── infrastructure/    # Terraform IaC
├── docs/             # ドキュメント
├── DEPLOYMENT.md     # 詳細デプロイ手順
└── GITHUB_SETUP.md   # GitHub接続手順
```

## 🔧 ローカル開発

```bash
# フロントエンド
cd frontend
cp .env.local.example .env.local
# NEXT_PUBLIC_API_ENDPOINT を設定
npm install
npm run dev
```

## 📚 詳細ドキュメント

- [デプロイ手順](DEPLOYMENT.md)
- [GitHub接続](GITHUB_SETUP.md)
- [API統合仕様](docs/03_詳細設計/API統合仕様.md)
- [Terraform実装状況](docs/02_基本設計/Terraform実装状況.md)

## 💰 コスト見積もり

月額約 $47（100万リクエスト想定）

| サービス | 月額コスト |
|---------|-----------|
| Amplify | $1 |
| Lambda | $20 |
| API Gateway | $3.5 |
| DynamoDB | $15 |
| S3 | $2.5 |
| Cognito | $5 |

## 🆘 トラブルシューティング

### ビルドエラー
```powershell
cd infrastructure
.\build_and_package.ps1
```

### Terraformエラー
```powershell
terraform init -upgrade
terraform plan
```

### Amplify接続エラー
- GitHubアプリの権限を確認
- リポジトリが正しく選択されているか確認

## 📞 サポート

問題が発生した場合は、各ドキュメントを参照してください。

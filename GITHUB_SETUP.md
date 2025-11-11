# GitHub セットアップ手順

## 1. GitHubでリポジトリを作成

1. https://github.com にアクセス
2. 右上の「+」→「New repository」をクリック
3. リポジトリ設定:
   - Repository name: `misawa`
   - Description: `文書管理システム`
   - Private/Public: お好みで選択
   - **「Initialize this repository with a README」はチェックしない**
4. 「Create repository」をクリック

## 2. ローカルリポジトリとGitHubを接続

作成後に表示されるURLをコピーして、以下のコマンドを実行:

```bash
cd c:\ECplus\misawa

# GitHubリポジトリを追加（URLは作成したリポジトリのもの）
git remote add origin https://github.com/YOUR_USERNAME/misawa.git

# または SSH の場合
# git remote add origin git@github.com:YOUR_USERNAME/misawa.git

# プッシュ
git push -u origin main
```

## 3. プッシュ完了後

terraform.tfvars に以下を設定:

```hcl
repository_url = "https://github.com/YOUR_USERNAME/misawa"
```

## 4. Terraformデプロイ

```bash
cd infrastructure
terraform init
terraform apply
```

## 5. Amplifyコンソールでリポジトリ接続

1. AWS Amplify コンソールを開く
2. terraform output で表示された amplify_app_id のアプリを選択
3. 「ホスティング環境を設定」→「GitHub」を選択
4. リポジトリとブランチ（main）を接続
5. 自動デプロイ開始

## トラブルシューティング

### リモートが既に存在する場合
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/misawa.git
```

### プッシュ時に認証エラー
```bash
# Personal Access Token を使用
# Settings → Developer settings → Personal access tokens → Generate new token
# repo 権限を付与してトークンを生成
```

# 🎯 最初に読んでください

## GitHubへのプッシュ方法

### 方法1: 自動セットアップ（推奨）

```powershell
# PowerShellで実行
.\setup-github.ps1
```

プロンプトに従ってGitHubリポジトリのURLを入力してください。

### 方法2: 手動セットアップ

#### 1. GitHubでリポジトリを作成
- https://github.com/new にアクセス
- リポジトリ名: `misawa`
- **「Initialize with README」はチェックしない**
- 「Create repository」をクリック

#### 2. リモートリポジトリを追加してプッシュ

```bash
# リモートリポジトリを追加（URLは作成したリポジトリのもの）
git remote add origin https://github.com/YOUR_USERNAME/misawa.git

# プッシュ
git push -u origin main
```

## 次のステップ

プッシュが完了したら、[QUICK_START.md](QUICK_START.md) を参照してデプロイを進めてください。

## 📚 ドキュメント一覧

- **[QUICK_START.md](QUICK_START.md)** - 5ステップでデプロイ
- **[GITHUB_SETUP.md](GITHUB_SETUP.md)** - GitHub接続の詳細
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - 詳細なデプロイ手順
- **[README.md](README.md)** - プロジェクト概要

## 🔑 重要な注意事項

### 認証について

GitHubへのプッシュ時に認証が必要な場合:

1. **Personal Access Token を使用**
   - GitHub Settings → Developer settings → Personal access tokens
   - 「Generate new token (classic)」をクリック
   - `repo` 権限を付与
   - 生成されたトークンをコピー

2. **プッシュ時にトークンを使用**
   ```bash
   # ユーザー名: あなたのGitHubユーザー名
   # パスワード: 生成したPersonal Access Token
   ```

### SSH接続の場合

```bash
git remote add origin git@github.com:YOUR_USERNAME/misawa.git
git push -u origin main
```

## ✅ 現在の状態

以下のファイルがコミット済みです:

- ✅ フロントエンド（Next.js + API統合）
- ✅ バックエンド（Lambda関数）
- ✅ インフラ（Terraform + Amplify）
- ✅ ドキュメント
- ✅ セットアップスクリプト

**合計: 44ファイル、2,513行追加**

## 🚀 今すぐ始める

```powershell
# セットアップスクリプトを実行
.\setup-github.ps1
```

その後、[QUICK_START.md](QUICK_START.md) に従ってデプロイしてください！

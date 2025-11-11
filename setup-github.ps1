# GitHub リポジトリセットアップスクリプト

Write-Host "=== GitHub リポジトリセットアップ ===" -ForegroundColor Cyan
Write-Host ""

# GitHubリポジトリURLの入力
$repoUrl = Read-Host "GitHubリポジトリのURL (例: https://github.com/username/misawa.git)"

if ([string]::IsNullOrWhiteSpace($repoUrl)) {
    Write-Host "エラー: リポジトリURLが入力されていません" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "リポジトリURL: $repoUrl" -ForegroundColor Green

# リモートリポジトリの設定
Write-Host ""
Write-Host "リモートリポジトリを設定中..." -ForegroundColor Yellow

# 既存のoriginを削除（存在する場合）
git remote remove origin 2>$null

# 新しいoriginを追加
git remote add origin $repoUrl

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ リモートリポジトリを設定しました" -ForegroundColor Green
} else {
    Write-Host "✗ リモートリポジトリの設定に失敗しました" -ForegroundColor Red
    exit 1
}

# プッシュ
Write-Host ""
Write-Host "GitHubにプッシュ中..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ GitHubへのプッシュが完了しました！" -ForegroundColor Green
    Write-Host ""
    Write-Host "次のステップ:" -ForegroundColor Cyan
    Write-Host "1. infrastructure/terraform.tfvars を編集"
    Write-Host "   repository_url = `"$repoUrl`""
    Write-Host ""
    Write-Host "2. Terraformでデプロイ"
    Write-Host "   cd infrastructure"
    Write-Host "   terraform apply"
    Write-Host ""
    Write-Host "3. Amplifyコンソールでリポジトリを接続"
    Write-Host "   詳細は GITHUB_SETUP.md を参照"
} else {
    Write-Host ""
    Write-Host "✗ プッシュに失敗しました" -ForegroundColor Red
    Write-Host ""
    Write-Host "認証が必要な場合:" -ForegroundColor Yellow
    Write-Host "- Personal Access Token を使用してください"
    Write-Host "- GitHub Settings → Developer settings → Personal access tokens"
    Write-Host "- 'repo' 権限を付与してトークンを生成"
    exit 1
}

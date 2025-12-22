# Lambda Layer構築スクリプト (PowerShell)
# 共有モジュールと依存関係をパッケージングします

Write-Host "Lambda Layerを構築中..." -ForegroundColor Green

# 作業ディレクトリの作成
$LayerDir = "layer"
if (Test-Path $LayerDir) {
    Remove-Item -Recurse -Force $LayerDir
}
New-Item -ItemType Directory -Path "$LayerDir\python" | Out-Null

# 共有モジュールをコピー
Write-Host "共有モジュールをコピー中..." -ForegroundColor Yellow
Get-ChildItem -Filter "*.py" | Copy-Item -Destination "$LayerDir\python\"

# 依存関係のインストール
Write-Host "依存関係をインストール中..." -ForegroundColor Yellow
pip install -r requirements.txt -t "$LayerDir\python\" --upgrade

# ZIPファイルの作成
Write-Host "ZIPファイルを作成中..." -ForegroundColor Yellow
Compress-Archive -Path "$LayerDir\python" -DestinationPath "shared-layer.zip" -Force

# クリーンアップ
Remove-Item -Recurse -Force $LayerDir

Write-Host "Lambda Layer構築完了: shared-layer.zip" -ForegroundColor Green
$size = (Get-Item "shared-layer.zip").Length / 1MB
Write-Host "サイズ: $([math]::Round($size, 2)) MB" -ForegroundColor Cyan

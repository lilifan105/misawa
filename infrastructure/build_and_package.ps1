# Lambda LayerとLambda関数を一括ビルド・パッケージング

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Lambda Layer & Functions build start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Lambda Layerのビルド
Write-Host "[1/2] Building Lambda Layer..." -ForegroundColor Green
Write-Host ""

Push-Location ..\backend\layers

# クリーンアップ
if (Test-Path "python") { Remove-Item -Recurse -Force "python" }
if (Test-Path "powertools.zip") { Remove-Item "powertools.zip" }

# Layerディレクトリ構造を作成
New-Item -ItemType Directory -Path "python" -Force | Out-Null

# Powertoolsと依存関係をインストール
Write-Host "  Installing Powertools and dependencies..." -ForegroundColor Yellow
pip install aws-lambda-powertools==2.31.0 aws-xray-sdk -t python --quiet

# zipファイルを作成
Write-Host "  Creating zip file..." -ForegroundColor Yellow
Compress-Archive -Path "python" -DestinationPath "powertools.zip"

# クリーンアップ
Remove-Item -Recurse -Force "python"

$layerSize = (Get-Item "powertools.zip").Length / 1MB
Write-Host "  OK powertools.zip created ($([math]::Round($layerSize, 2)) MB)" -ForegroundColor Green

Pop-Location

Write-Host ""

# 2. Lambda関数のパッケージング
Write-Host "[2/2] Packaging Lambda functions..." -ForegroundColor Green
Write-Host ""

Push-Location ..\backend\functions

$functions = @("documents", "search", "external_api")

foreach ($func in $functions) {
    Write-Host "  Packaging $func..." -ForegroundColor Yellow
    
    $zipPath = "$func.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath }
    
    Push-Location $func
    Compress-Archive -Path "lambda_function.py" -DestinationPath "..\$zipPath"
    Pop-Location
    
    $funcSize = (Get-Item $zipPath).Length / 1KB
    Write-Host "    OK $zipPath created ($([math]::Round($funcSize, 2)) KB)" -ForegroundColor Green
}

Pop-Location

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Build completed!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Created files:" -ForegroundColor White
Write-Host "  Layer:" -ForegroundColor Cyan
Write-Host "    - backend/layers/powertools.zip ($([math]::Round($layerSize, 2)) MB)" -ForegroundColor White
Write-Host "  Functions:" -ForegroundColor Cyan
Get-ChildItem ..\backend\functions\*.zip | ForEach-Object { 
    $size = $_.Length / 1KB
    Write-Host "    - backend/functions/$($_.Name) ($([math]::Round($size, 2)) KB)" -ForegroundColor White
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  terraform init" -ForegroundColor White
Write-Host "  terraform plan" -ForegroundColor White
Write-Host "  terraform apply" -ForegroundColor White
Write-Host ""

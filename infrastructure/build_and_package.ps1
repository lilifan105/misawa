# Lambda LayerとLambda関数を一括ビルド・パッケージング

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Lambda Layer & Functions build start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Lambda Layerのビルド（Powertools）
Write-Host "[1/4] Building Powertools Lambda Layer..." -ForegroundColor Green
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

# 2. 共有モジュールのLambda Layerをビルド（マルチテナント用）
Write-Host "[2/4] Building Shared Module Layer..." -ForegroundColor Green
Write-Host ""

Push-Location ..\backend\shared

# クリーンアップ
if (Test-Path "python") { Remove-Item -Recurse -Force "python" }
if (Test-Path "shared_layer.zip") { Remove-Item "shared_layer.zip" }

# Layerディレクトリ構造を作成
New-Item -ItemType Directory -Path "python\shared" -Force | Out-Null

# 依存関係をインストール
Write-Host "  Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt -t python --quiet

# 共有モジュールをコピー
Write-Host "  Copying shared modules..." -ForegroundColor Yellow
Copy-Item "*.py" -Destination "python\shared\" -Exclude "__pycache__"

# zipファイルを作成
Write-Host "  Creating zip file..." -ForegroundColor Yellow
Compress-Archive -Path "python" -DestinationPath "shared_layer.zip"

# クリーンアップ
Remove-Item -Recurse -Force "python"

$sharedLayerSize = (Get-Item "shared_layer.zip").Length / 1MB
Write-Host "  OK shared_layer.zip created ($([math]::Round($sharedLayerSize, 2)) MB)" -ForegroundColor Green

Pop-Location

Write-Host ""

# 3. Lambda Authorizer関数のパッケージング（マルチテナント用）
Write-Host "[3/4] Packaging Lambda Authorizer..." -ForegroundColor Green
Write-Host ""

Push-Location ..\backend\functions\authorizer

$authZipPath = "..\authorizer.zip"
if (Test-Path $authZipPath) { Remove-Item $authZipPath }

Write-Host "  Creating authorizer.zip..." -ForegroundColor Yellow
Compress-Archive -Path "lambda_function.py" -DestinationPath $authZipPath

$authSize = (Get-Item $authZipPath).Length / 1KB
Write-Host "  OK authorizer.zip created ($([math]::Round($authSize, 2)) KB)" -ForegroundColor Green

Pop-Location

Write-Host ""

# 4. Lambda関数のパッケージング
Write-Host "[4/4] Packaging Lambda functions..." -ForegroundColor Green
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
Write-Host "  Layers:" -ForegroundColor Cyan
Write-Host "    - backend/layers/powertools.zip ($([math]::Round($layerSize, 2)) MB)" -ForegroundColor White
Write-Host "    - backend/shared/shared_layer.zip ($([math]::Round($sharedLayerSize, 2)) MB)" -ForegroundColor White
Write-Host "  Functions:" -ForegroundColor Cyan
Write-Host "    - backend/functions/authorizer.zip ($([math]::Round($authSize, 2)) KB)" -ForegroundColor White
Get-ChildItem ..\backend\functions\*.zip | Where-Object { $_.Name -ne "authorizer.zip" } | ForEach-Object { 
    $size = $_.Length / 1KB
    Write-Host "    - backend/functions/$($_.Name) ($([math]::Round($size, 2)) KB)" -ForegroundColor White
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  terraform init" -ForegroundColor White
Write-Host "  terraform plan" -ForegroundColor White
Write-Host "  terraform apply" -ForegroundColor White
Write-Host ""

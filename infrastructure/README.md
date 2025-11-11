# インフラストラクチャ - Terraform（モジュール構成）

## 構成

```
infrastructure/
├── build_and_package.ps1  # ビルドスクリプト
├── main.tf                # モジュール呼び出し
├── variables.tf           # 変数定義
├── outputs.tf             # 出力定義
├── terraform.tfvars       # 変数値（gitignore）
└── modules/
    ├── database/          # DynamoDB
    ├── storage/           # S3
    ├── auth/              # Cognito
    ├── compute/           # Lambda + IAM + Layer
    └── api/               # API Gateway
```

## クイックスタート

### 1. ビルド（Layer + Lambda関数）

```powershell
.\build_and_package.ps1
```

このスクリプトは以下を実行します：
- Lambda Layer（Powertools）のビルド
- 全Lambda関数のパッケージング

### 2. Terraform初期化

```bash
terraform init
```

### 3. 変数設定

```bash
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvarsを編集
```

### 4. デプロイ

```bash
terraform plan
terraform apply
```

## モジュール一覧

| モジュール | 説明 | リソース |
|-----------|------|---------|
| database | データベース | DynamoDB |
| storage | ストレージ | S3 |
| auth | 認証 | Cognito |
| compute | コンピューティング | Lambda, IAM, Layer |
| api | API | API Gateway |

## ビルドスクリプト詳細

### build_and_package.ps1

**実行内容:**
1. Lambda Layer（Powertools）のビルド
   - `pip install aws-lambda-powertools`
   - `python/` ディレクトリに配置
   - `powertools.zip` を作成

2. Lambda関数のパッケージング
   - 各関数の `lambda_function.py` をzip
   - Powertoolsは含めない（Layerから提供）

**出力:**
```
backend/layers/powertools.zip      (~10MB)
backend/functions/documents.zip    (~5KB)
backend/functions/search.zip       (~2KB)
backend/functions/external_api.zip (~3KB)
```

## 更新手順

### コード変更時

```powershell
# 1. 再ビルド
.\build_and_package.ps1

# 2. 再デプロイ（自動検知）
terraform apply
```

### Powertoolsバージョン更新時

`build_and_package.ps1` の以下の行を編集：
```powershell
pip install aws-lambda-powertools==2.31.0 -t python --quiet
```

その後、再ビルド・デプロイ。

## トラブルシューティング

### ビルドエラー

```powershell
# Pythonとpipが正しくインストールされているか確認
python --version
pip --version

# 再ビルド
.\build_and_package.ps1
```

### Terraformエラー

```bash
# 初期化をやり直す
terraform init -upgrade

# プランを確認
terraform plan
```

## モジュール化の利点

1. **明確な責任分離**: 各モジュールが独立した機能
2. **再利用性**: 他のプロジェクトでモジュールを再利用可能
3. **保守性**: 変更箇所が明確で影響範囲が限定的
4. **テスト容易性**: モジュール単位でテスト可能
5. **スケーラビリティ**: 新しいモジュールの追加が容易

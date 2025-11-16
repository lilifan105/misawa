# 文書管理システム

## プロジェクト概要
通達・連絡・ライブラリ文書の管理・検索システム

## 技術スタック

### フロントエンド
- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **UIライブラリ**: shadcn/ui + Tailwind CSS
- **状態管理**: React Hooks

### バックエンド
- **ランタイム**: AWS Lambda (Python 3.12)
- **フレームワーク**: AWS Lambda Powertools
- **API**: Amazon API Gateway (HTTP API)
- **認証**: Amazon Cognito

### データベース・ストレージ
- **NoSQL**: Amazon DynamoDB
- **ファイルストレージ**: Amazon S3
- **RAG検索**: Amazon Bedrock Knowledge Base + S3 Vectors

### インフラ
- **IaC**: Terraform（モジュール構成）
- **CI/CD**: GitHub Actions（将来実装）

## クイックスタート

### 1. バックエンドのビルド

```powershell
cd infrastructure
.\build_and_package.ps1
```

このスクリプトで以下が作成されます：
- Lambda Layer（Powertools）
- Lambda関数（3つ）

### 2. インフラのデプロイ

```bash
# 変数設定
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvarsを編集

# デプロイ
terraform init
terraform apply
```

### 3. フロントエンドの起動

```bash
cd frontend
npm install
npm run dev
```

## プロジェクト構造

```
misawa/
├── frontend/              # Next.jsフロントエンド
│   ├── app/              # App Router
│   └── components/       # Reactコンポーネント
├── backend/
│   ├── functions/        # Lambda関数
│   │   ├── documents/
│   │   ├── search/
│   │   └── external_api/
│   └── layers/           # Lambda Layer
│       └── powertools.zip (ビルド後)
├── infrastructure/       # Terraform
│   ├── build_and_package.ps1  # ビルドスクリプト
│   ├── main.tf
│   └── modules/
│       ├── database/
│       ├── storage/
│       ├── auth/
│       ├── compute/
│       └── api/
└── docs/                # ドキュメント
```

## 画面一覧

1. **文書一覧画面** (`/`) - カテゴリツリー、検索、CRUD
2. **文書登録画面** (`/register`) - 属性入力、表示先設定
3. **文書登録確認画面** (`/confirm`) - 入力内容確認
4. **完了画面** (`/complete`) - 登録完了
5. **文書閲覧画面** (`/view/[id]`) - PDFビューア、属性表示
6. **RAG検索画面** (`/search`) - AI全文検索、ページプレビュー

## API エンドポイント

### 文書管理API
- `GET /documents` - 文書一覧取得
- `GET /documents/{id}` - 文書詳細取得
- `POST /documents` - 文書登録
- `PUT /documents/{id}` - 文書更新
- `DELETE /documents/{id}` - 文書削除

### 検索API
- `POST /search` - RAG全文検索（Bedrock Knowledge Base）

### 外部API（GCP連携）
- `GET /external/documents` - 文書一覧取得（APIキー認証）

## 実装状況

### ✅ 完了
- [x] フロントエンド画面（プロトタイプ）
- [x] Lambda関数（CRUD + Powertools）
- [x] Lambda Layer（Powertools）
- [x] Terraformモジュール構成
- [x] DynamoDB設計
- [x] S3設定
- [x] Cognito設定
- [x] API Gateway設定
- [x] AWS Amplify設定
- [x] フロントエンド・API統合
- [x] RAG全文検索機能（Bedrock + S3 Vectors）

### 🚧 実装中
- [ ] 認証機能統合（Cognito）
- [ ] ファイルアップロード機能

### 📋 未実装（優先度順）
1. **高優先度**
   - [ ] 承認ワークフロー
   - [ ] 権限管理
   - [ ] ファイルアップロード・ダウンロード

2. **中優先度**
   - [ ] PDF処理（テキスト抽出）
   - [ ] 通知機能（SES）
   - [ ] RAG検索拡張（リランキング、フィルタリング）

3. **低優先度**
   - [ ] 閲覧履歴
   - [ ] 版管理
   - [ ] 統計・分析

## デプロイ

詳細は [DEPLOYMENT.md](DEPLOYMENT.md) を参照

## ドキュメント

- [要件定義書](docs/01_要件定義/要件定義書.md)
- [システム構成図](docs/02_基本設計/システム構成図.md)
- [画面設計書](docs/02_基本設計/画面設計書.md)
- [バックエンドREADME](backend/README.md)
- [インフラREADME](infrastructure/README.md)
- [RAG検索機能実装ガイド](docs/04_実装/RAG検索機能/RAG検索機能実装ガイド.md)
- [デプロイ手順](DEPLOYMENT.md)

## コスト見積もり（月額）

| サービス | 想定利用量 | 月額コスト（USD） |
|---------|-----------|-----------------|
| Lambda | 100万リクエスト | $20 |
| API Gateway | 100万リクエスト | $3.5 |
| DynamoDB | 10GB、100万R/W | $15 |
| S3 | 100GB保存 | $2.5 |
| Cognito | 1,000 MAU | $5 |
| S3 Vectors | 10GBベクトル | $0.23 |
| Bedrock KB | 10万クエリ | $0.30 |
| **合計** | | **$46.53** |

## トラブルシューティング

### ビルドエラー
```bash
cd infrastructure
.\build_and_package.ps1
```

### Terraformエラー
```bash
cd infrastructure
terraform init -upgrade
terraform plan
```

## ライセンス
Private

## 連絡先
プロジェクト管理者: [連絡先]

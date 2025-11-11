# Terraform実装状況

## ✅ 実装済みリソース

### フロントエンド
- **AWS Amplify Hosting** - Next.jsアプリケーションのホスティング
  - GitHub連携によるCI/CD
  - 自動ビルド・デプロイ
  - 環境変数設定（API_ENDPOINT）

### バックエンド
- **Amazon API Gateway** - REST APIエンドポイント
  - CORS設定
  - Lambda統合
- **AWS Lambda** - サーバーレス処理
  - documents関数（文書CRUD）
  - search関数（検索・将来RAG対応）
  - external_api関数（GCP連携）
- **Lambda Layer** - Powertools共通ライブラリ

### データ・ストレージ
- **Amazon DynamoDB** - 文書メタデータ保存
  - GSI: category-index
- **Amazon S3** - PDFファイル保存
  - バージョニング有効化
  - 暗号化（SSE-S3）

### 認証（実装済み・未統合）
- **Amazon Cognito** - ユーザー認証基盤
  - ユーザープール
  - アプリクライアント
  - ※フロントエンド統合は未実装

## ⏳ 未実装リソース（システム構成図に記載）

### 検索・AI機能
- ❌ **Amazon OpenSearch Service** - 全文検索・ベクトル検索
- ❌ **Amazon Bedrock** - 生成AI（RAG）
- ❌ **Lambda（非同期処理）** - PDF→テキスト抽出

### 通知・監視
- ❌ **Amazon SNS** - 通知
- ❌ **Amazon SES** - メール送信
- ❌ **CloudWatch Alarms** - アラート
- ❌ **AWS X-Ray** - 分散トレーシング

### セキュリティ
- ❌ **AWS Secrets Manager** - APIキー管理（現在は環境変数）
- ❌ **VPC** - OpenSearch用プライベートネットワーク

### CDN
- ⚠️ **CloudFront** - Amplifyに内包されているため個別設定不要

## 📋 実装優先度

### 高優先度（次のフェーズ）
1. **Cognito統合** - フロントエンドでの認証実装
2. **ファイルアップロード** - S3への直接アップロード（Presigned URL）
3. **CloudWatch Logs保持期間** - コスト最適化

### 中優先度
1. **OpenSearch + Bedrock** - RAG検索機能
2. **Lambda（非同期処理）** - PDF処理
3. **Secrets Manager** - APIキー管理

### 低優先度
1. **SNS/SES** - 通知機能
2. **X-Ray** - 詳細トレーシング
3. **VPC** - OpenSearch用

## 🔄 現在のデプロイフロー

```
1. ローカル開発
   └─ npm run dev (localhost:3000)

2. GitHubへプッシュ
   └─ git push origin main

3. Amplify自動ビルド
   ├─ npm ci
   ├─ npm run build
   └─ デプロイ

4. アクセス
   └─ https://main.{app-id}.amplifyapp.com
```

## 📊 コスト見積もり（現在の構成）

| サービス | 想定利用量 | 月額コスト（USD） |
|---------|-----------|-----------------|
| Amplify Hosting | ビルド時間100分 | $1 |
| Lambda | 100万リクエスト | $20 |
| API Gateway | 100万リクエスト | $3.5 |
| DynamoDB | 10GB、100万R/W | $15 |
| S3 | 100GB保存 | $2.5 |
| Cognito | 1,000 MAU | $5 |
| **合計** | | **$47** |

※ OpenSearch追加時は+$50～100/月

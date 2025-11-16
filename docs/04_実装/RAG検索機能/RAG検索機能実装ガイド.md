# RAG検索機能実装ガイド

## 概要

本ドキュメントでは、Amazon Bedrock Knowledge BaseとS3 Vectorsを使用したRAG（Retrieval Augmented Generation）全文検索機能の実装について説明します。

## アーキテクチャ

### システム構成

```
ユーザー
  ↓
Next.js フロントエンド（検索画面）
  ↓
API Gateway
  ↓
Lambda関数（Search）
  ↓
Bedrock Knowledge Base
  ↓
S3 Vectors（ベクトルDB）
  ↓
S3バケット（文書ファイル）
```

### 主要コンポーネント

1. **フロントエンド**
   - 検索画面コンポーネント（`rag-search-page.tsx`）
   - 検索結果表示
   - 文書プレビュー機能

2. **バックエンド**
   - Lambda関数（`search/lambda_function.py`）
   - Bedrock Agent Runtime API統合
   - ベクトル検索処理

3. **インフラ**
   - Bedrock Knowledge Base
   - S3 Vectors（ベクトルインデックス）
   - S3バケット（文書ストレージ）

## 実装内容

### 1. バックエンド実装

#### Lambda関数（search/lambda_function.py）

**主要機能:**
- Bedrock Knowledge Base Retrieve APIを使用したベクトル検索
- 検索クエリの処理
- 検索結果の整形と返却

**環境変数:**
- `KNOWLEDGE_BASE_ID`: Bedrock Knowledge BaseのID

**APIエンドポイント:**
- `POST /search`

**リクエスト:**
```json
{
  "query": "検索キーワード",
  "numberOfResults": 10
}
```

**レスポンス:**
```json
{
  "query": "検索キーワード",
  "results": [
    {
      "documentId": "doc123",
      "title": "文書タイトル",
      "content": "マッチしたテキストチャンク",
      "score": 0.95,
      "s3Uri": "s3://bucket/documents/doc123.pdf",
      "metadata": {
        "pageNumber": 5
      }
    }
  ],
  "totalResults": 10
}
```

#### IAM権限

Lambda実行ロールに以下の権限を追加:
```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:Retrieve",
    "bedrock:RetrieveAndGenerate"
  ],
  "Resource": "*"
}
```

### 2. フロントエンド実装

#### 検索画面コンポーネント（rag-search-page.tsx）

**主要機能:**
- 検索クエリ入力
- 検索実行
- 検索結果一覧表示
- 関連度スコア表示
- 文書プレビューへの遷移

**画面構成:**
1. 検索バー
2. 検索結果カード一覧
3. ページ番号付きプレビューリンク

#### API統合（lib/api.ts）

新規追加関数:
```typescript
export async function searchDocuments(query: string, numberOfResults: number = 10)
```

### 3. インフラ設定

#### Terraform設定更新

**modules/compute/main.tf:**
- Lambda関数にKNOWLEDGE_BASE_ID環境変数を追加
- IAMポリシーにBedrock権限を追加

**variables.tf:**
- `knowledge_base_id`変数を追加

## セットアップ手順

### 前提条件

1. AWSアカウント
2. 適切なIAM権限
3. S3バケット（文書保存用）
4. 文書ファイル（PDF等）

### ステップ1: Terraformでインフラをデプロイ

```bash
cd infrastructure

# Lambda関数をビルド
.\build_and_package.ps1

# Terraformでデプロイ
terraform init
terraform apply

# Knowledge Base IDを確認
terraform output knowledge_base_id
terraform output data_source_id
```

これで以下が自動作成されます：
- S3 Vector Bucket
- Bedrock Knowledge Base
- Bedrock Data Source
- IAMロールとポリシー
- Lambda関数（KNOWLEDGE_BASE_ID環境変数設定済み）

### ステップ2: S3バケットに文書をアップロード

```bash
# 文書バケット名を取得
BUCKET_NAME=$(terraform output -raw s3_bucket_name)

# 文書をアップロード
aws s3 cp documents/ s3://$BUCKET_NAME/documents/ --recursive
```

### ステップ3: Bedrock Knowledge Baseの作成（自動完了）

Terraformで自動作成されます。以下が設定されています：
- 埋め込みモデル: Titan Embed Text v2
- ベクトルストア: S3 Vectors
- チャンキング: 固定サイズ（300トークン、20%オーバーラップ）

### ステップ4: データの取り込み（Ingestion）

```bash
# Knowledge Base IDとData Source IDを取得
KB_ID=$(terraform output -raw knowledge_base_id)
DS_ID=$(terraform output -raw data_source_id)

# Ingestion Jobを開始
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID

# 同期状態を確認
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID
```

完了まで数分～数十分かかります。

### ステップ5: フロントエンドの起動

```bash
cd frontend
npm run dev
```

### ステップ6: 動作確認

1. ブラウザで `http://localhost:3000/search` にアクセス
2. 検索キーワードを入力（例: "技術情報"）
3. 検索結果が表示されることを確認
4. 文書カードをクリックして該当ページが表示されることを確認

## トラブルシューティング

### 検索結果が返らない

**原因1: Knowledge Baseの同期が未完了**
- 解決策: Bedrockコンソールで同期ステータスを確認

**原因2: KNOWLEDGE_BASE_ID環境変数が未設定**
- 解決策: Terraform変数を確認し、再デプロイ

**原因3: IAM権限不足**
- 解決策: Lambda実行ロールにBedrock権限を追加

### エラー: "Knowledge Baseが設定されていません"

Lambda関数の環境変数を確認:
```bash
aws lambda get-function-configuration \
  --function-name misawa-search-dev \
  --query 'Environment.Variables.KNOWLEDGE_BASE_ID'
```

### エラー: "AccessDeniedException"

IAMロールのポリシーを確認:
```bash
aws iam get-role-policy \
  --role-name misawa-lambda-exec-dev \
  --policy-name dynamodb-s3-bedrock-access
```

## メタデータの活用

### ページ番号の埋め込み

文書ファイルと同じ場所に`.metadata.json`ファイルを配置:

**例: documents/doc123.pdf.metadata.json**
```json
{
  "metadataAttributes": {
    "title": "技術仕様書",
    "pageNumber": 5,
    "category": "技術情報",
    "date": "2025-01-15"
  }
}
```

### メタデータフィルタリング

検索時にメタデータでフィルタリング可能（将来実装）:
```python
response = bedrock_agent_runtime.retrieve(
    knowledgeBaseId=KNOWLEDGE_BASE_ID,
    retrievalQuery={'text': query},
    retrievalConfiguration={
        'vectorSearchConfiguration': {
            'numberOfResults': 10,
            'filter': {
                'equals': {
                    'key': 'category',
                    'value': '技術情報'
                }
            }
        }
    }
)
```

## コスト見積もり

### S3 Vectors

- ベクトルストレージ: $0.023/GB/月
- クエリ: $0.40/100万リクエスト

### Bedrock Knowledge Base

- 埋め込み生成: $0.0001/1000トークン（Titan Embed v2）
- Retrieve API: $0.002/1000リクエスト

### 想定コスト（月額）

| 項目 | 想定量 | 月額コスト |
|------|--------|-----------|
| ベクトルストレージ | 10GB | $0.23 |
| 埋め込み生成 | 100万トークン | $0.10 |
| 検索クエリ | 10万回 | $0.20 |
| **合計** | | **$0.53** |

## 今後の拡張

1. **ハイブリッド検索**
   - キーワード検索とベクトル検索の組み合わせ

2. **リランキング**
   - Bedrock Rerankingを使用した精度向上

3. **マルチモーダル検索**
   - 画像を含む文書の検索

4. **フィルタリング強化**
   - カテゴリ、日付範囲等での絞り込み

5. **生成AI統合**
   - RetrieveAndGenerate APIを使用した要約生成

## 参考資料

- [Amazon Bedrock Knowledge Bases](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html)
- [S3 Vectors Documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html)
- [Bedrock Retrieve API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_Retrieve.html)

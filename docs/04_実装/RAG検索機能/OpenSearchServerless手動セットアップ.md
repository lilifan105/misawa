# OpenSearch Serverless 手動セットアップ手順

## 概要

Bedrock Knowledge BaseでOpenSearch Serverlessを使用する場合、インデックスを事前に作成する必要があります。

## 前提条件

Terraformで以下が作成済み:
- OpenSearch Serverlessコレクション: `misawa-vectors-dev`
- IAMロール: `misawa-bedrock-kb-dev`
- セキュリティポリシー（暗号化・ネットワーク・データアクセス）

## セットアップ手順

### 1. OpenSearchコレクションエンドポイントを取得

```bash
cd infrastructure
terraform output
```

または

```bash
aws opensearchserverless list-collections --query "collectionSummaries[?name=='misawa-vectors-dev'].id" --output text
```

### 2. OpenSearch Dashboardsにアクセス

コレクションのDashboard URLにアクセス:
```
https://wueobzhtgjsq788bv870.ap-northeast-1.aoss.amazonaws.com/_dashboards
```

### 3. Dev Toolsでインデックスを作成

Dashboard > Dev Tools > Consoleで以下を実行:

```json
PUT bedrock-kb-index
{
  "settings": {
    "index.knn": true
  },
  "mappings": {
    "properties": {
      "vector": {
        "type": "knn_vector",
        "dimension": 1024,
        "method": {
          "name": "hnsw",
          "engine": "faiss",
          "parameters": {
            "ef_construction": 512,
            "m": 16
          }
        }
      },
      "text": {
        "type": "text"
      },
      "metadata": {
        "type": "text"
      }
    }
  }
}
```

### 4. インデックス作成を確認

```json
GET bedrock-kb-index
```

### 5. Terraformで残りをデプロイ

```bash
cd infrastructure
terraform apply -auto-approve
```

## トラブルシューティング

### エラー: "security_exception"

データアクセスポリシーを確認:
```bash
aws opensearchserverless get-access-policy --name misawa-vectors-access-dev --type data
```

### エラー: "index_not_found_exception"

インデックス名を確認:
```json
GET _cat/indices
```

## 完了後の確認

```bash
# Knowledge Base IDを取得
terraform output knowledge_base_id

# Data Source IDを取得
terraform output data_source_id

# Ingestion Jobを開始
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id $(terraform output -raw knowledge_base_id) \
  --data-source-id $(terraform output -raw data_source_id)
```

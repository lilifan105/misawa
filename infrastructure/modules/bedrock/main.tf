# IAMロール - Bedrock Knowledge Base用
resource "aws_iam_role" "bedrock_kb" {
  name = "${var.project_name}-bedrock-kb-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "bedrock.amazonaws.com"
      }
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = var.account_id
        }
        ArnLike = {
          "aws:SourceArn" = "arn:aws:bedrock:${var.aws_region}:${var.account_id}:knowledge-base/*"
        }
      }
    }]
  })
}

# IAMポリシー - S3アクセス
resource "aws_iam_role_policy" "bedrock_s3_access" {
  name = "s3-access"
  role = aws_iam_role.bedrock_kb.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          var.s3_bucket_arn,
          "${var.s3_bucket_arn}/*"
        ]
      }
    ]
  })
}

# IAMポリシー - Bedrock埋め込みモデルアクセス
resource "aws_iam_role_policy" "bedrock_model_access" {
  name = "bedrock-model-access"
  role = aws_iam_role.bedrock_kb.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.titan-embed-text-v2:0"
      }
    ]
  })
}

# IAMポリシー - OpenSearch Serverlessアクセス
resource "aws_iam_role_policy" "bedrock_aoss_access" {
  name = "aoss-access"
  role = aws_iam_role.bedrock_kb.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "aoss:APIAccessAll"
        ]
        Resource = aws_opensearchserverless_collection.vectors.arn
      }
    ]
  })
}

# OpenSearch Serverless暗号化ポリシー
resource "aws_opensearchserverless_security_policy" "vectors_encryption" {
  name = "${var.project_name}-vectors-encryption-${var.environment}"
  type = "encryption"
  policy = jsonencode({
    Rules = [{
      ResourceType = "collection"
      Resource     = ["collection/${var.project_name}-vectors-${var.environment}"]
    }]
    AWSOwnedKey = true
  })
}

# OpenSearch Serverlessネットワークポリシー
resource "aws_opensearchserverless_security_policy" "vectors_network" {
  name = "${var.project_name}-vectors-network-${var.environment}"
  type = "network"
  policy = jsonencode([{
    Rules = [{
      ResourceType = "collection"
      Resource     = ["collection/${var.project_name}-vectors-${var.environment}"]
    }]
    AllowFromPublic = true
  }])
}

# OpenSearch Serverlessコレクション
resource "aws_opensearchserverless_collection" "vectors" {
  name = "${var.project_name}-vectors-${var.environment}"
  type = "VECTORSEARCH"

  depends_on = [
    aws_opensearchserverless_security_policy.vectors_encryption,
    aws_opensearchserverless_security_policy.vectors_network
  ]

  tags = {
    Name        = "${var.project_name}-vectors"
    Environment = var.environment
  }
}

# 現在の実行ユーザー情報を取得（Terraform実行ユーザーにインデックス作成権限を付与するため）
data "aws_caller_identity" "current" {}

# OpenSearch Serverlessデータアクセスポリシー
resource "aws_opensearchserverless_access_policy" "vectors" {
  name = "${var.project_name}-vectors-access-${var.environment}"
  type = "data"
  policy = jsonencode([{
    Rules = [{
      ResourceType = "collection"
      Resource     = ["collection/${var.project_name}-vectors-${var.environment}"]
      Permission   = ["aoss:*"]
    }, {
      ResourceType = "index"
      Resource     = ["index/${var.project_name}-vectors-${var.environment}/*"]
      Permission   = [
        "aoss:CreateIndex",
        "aoss:DeleteIndex",
        "aoss:UpdateIndex",
        "aoss:DescribeIndex",
        "aoss:ReadDocument",
        "aoss:WriteDocument"
      ]
    }]
    Principal = [
      aws_iam_role.bedrock_kb.arn,
      data.aws_caller_identity.current.arn  # Terraform実行ユーザー
    ]
  }])
}

# Bedrock Knowledge Base
# 注意: このリソースを作成する前に、OpenSearchインデックスを手動で作成する必要があります
# scripts/create_index.ps1 を実行してください
resource "aws_bedrockagent_knowledge_base" "main" {
  name     = "${var.project_name}-kb-${var.environment}"
  role_arn = aws_iam_role.bedrock_kb.arn

  knowledge_base_configuration {
    type = "VECTOR"
    vector_knowledge_base_configuration {
      embedding_model_arn = "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.titan-embed-text-v2:0"
    }
  }

  storage_configuration {
    type = "OPENSEARCH_SERVERLESS"
    opensearch_serverless_configuration {
      collection_arn    = aws_opensearchserverless_collection.vectors.arn
      vector_index_name = "bedrock-kb-index"
      field_mapping {
        vector_field   = "vector"
        text_field     = "text"
        metadata_field = "metadata"
      }
    }
  }

  tags = {
    Name        = "${var.project_name}-knowledge-base"
    Environment = var.environment
  }
}

# Bedrock Data Source
# Knowledge Baseが作成された後に作成
resource "aws_bedrockagent_data_source" "main" {
  name              = "${var.project_name}-datasource-${var.environment}"
  knowledge_base_id = aws_bedrockagent_knowledge_base.main.id

  data_source_configuration {
    type = "S3"
    s3_configuration {
      bucket_arn = var.s3_bucket_arn
      inclusion_prefixes = ["documents/"]
    }
  }

  vector_ingestion_configuration {
    chunking_configuration {
      chunking_strategy = "FIXED_SIZE"
      fixed_size_chunking_configuration {
        max_tokens         = 300
        overlap_percentage = 20
      }
    }
  }
}

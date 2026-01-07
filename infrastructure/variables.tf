variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "misawa"
}

variable "environment" {
  description = "Environment (dev, prod)"
  type        = string
  default     = "dev"
}

variable "callback_urls" {
  description = "Cognito callback URLs"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "logout_urls" {
  description = "Cognito logout URLs"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "cors_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "external_api_key" {
  description = "External API key for GCP integration"
  type        = string
  sensitive   = true
  default     = "change-me-in-production"
}

variable "repository_url" {
  description = "GitHubリポジトリURL"
  type        = string
}

variable "branch_name" {
  description = "デプロイするブランチ名"
  type        = string
  default     = "main"
}

variable "github_access_token" {
  description = "GitHub Personal Access Token（repo権限必要）"
  type        = string
  sensitive   = true
  default     = ""
}

# マルチテナント認証設定
variable "multitenant_mode" {
  description = "マルチテナントモードを有効にするか（true/false）"
  type        = string
  default     = "false"
}

variable "cognito_region" {
  description = "Cognito User PoolのAWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
  default     = ""
}

variable "multitenant_issuer" {
  description = "マルチテナントサービスの発行者URL（例: https://multitenant-saas-platform-poc-dev.example.com）"
  type        = string
  default     = ""
}

variable "multitenant_url" {
  description = "マルチテナントサービスのURL（フロントエンド用、例: https://d3f0w4zg0s2x16.cloudfront.net）"
  type        = string
  default     = ""
}

variable "multitenant_rds_host" {
  description = "マルチテナントRDSのホスト名"
  type        = string
  default     = ""
}

variable "multitenant_rds_port" {
  description = "マルチテナントRDSのポート番号"
  type        = string
  default     = "5432"
}

variable "multitenant_rds_database" {
  description = "マルチテナントRDSのデータベース名"
  type        = string
  default     = ""
}

variable "multitenant_rds_user" {
  description = "マルチテナントRDSのユーザー名"
  type        = string
  default     = ""
}

variable "multitenant_rds_password" {
  description = "マルチテナントRDSのパスワード"
  type        = string
  sensitive   = true
  default     = ""
}

variable "document_service_id" {
  description = "文書管理サービスのUUID"
  type        = string
  default     = ""
}

variable "multitenant_client_id" {
  description = "マルチテナントサービスのOAuth Client ID（JWT audience検証用）"
  type        = string
  default     = ""
}

variable "vpc_id" {
  description = "VPC ID（マルチテナントモード時に必要）"
  type        = string
  default     = ""
}

variable "private_subnet_ids" {
  description = "プライベートサブネットIDのリスト（マルチテナントモード時に必要）"
  type        = list(string)
  default     = []
}

variable "rds_cidr_blocks" {
  description = "RDSのCIDRブロックのリスト（マルチテナントモード時に必要）"
  type        = list(string)
  default     = []
}

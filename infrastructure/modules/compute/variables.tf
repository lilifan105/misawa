variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "dynamodb_table_name" {
  type = string
}

variable "dynamodb_table_arn" {
  type = string
}

variable "s3_bucket_id" {
  type = string
}

variable "s3_bucket_arn" {
  type = string
}

variable "external_api_key" {
  type = string
}

variable "knowledge_base_id" {
  type        = string
  description = "Bedrock Knowledge Base ID for RAG search"
}

variable "data_source_id" {
  type        = string
  description = "Bedrock Data Source ID for ingestion"
}

# マルチテナント認証関連の変数
variable "multitenant_mode" {
  type        = string
  description = "Enable multitenant mode (true/false)"
  default     = "false"
}

variable "cognito_region" {
  type        = string
  description = "AWS region for Cognito"
  default     = "ap-northeast-1"
}

variable "cognito_user_pool_id" {
  type        = string
  description = "Cognito User Pool ID for JWT validation"
  default     = ""
}

variable "multitenant_rds_host" {
  type        = string
  description = "Multitenant RDS PostgreSQL host"
  default     = ""
}

variable "multitenant_rds_port" {
  type        = string
  description = "Multitenant RDS PostgreSQL port"
  default     = "5432"
}

variable "multitenant_rds_database" {
  type        = string
  description = "Multitenant RDS database name"
  default     = "multitenant"
}

variable "multitenant_rds_user" {
  type        = string
  description = "Multitenant RDS user"
  default     = ""
  sensitive   = true
}

variable "multitenant_rds_password" {
  type        = string
  description = "Multitenant RDS password"
  default     = ""
  sensitive   = true
}

variable "document_service_id" {
  type        = string
  description = "Document management service UUID in multitenant database"
  default     = ""
}

variable "vpc_id" {
  type        = string
  description = "VPC ID for Lambda functions"
  default     = ""
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for Lambda functions"
  default     = []
}

variable "rds_cidr_blocks" {
  type        = list(string)
  description = "CIDR blocks for RDS access"
  default     = []
}

variable "api_gateway_execution_arn" {
  type        = string
  description = "API Gateway execution ARN for Lambda permissions"
  default     = ""
}

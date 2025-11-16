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

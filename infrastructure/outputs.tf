output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = module.api.api_endpoint
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.auth.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = module.auth.client_id
}

output "s3_bucket_name" {
  description = "S3 bucket name for documents"
  value       = module.storage.bucket_id
}

output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = module.database.table_name
}

output "amplify_app_id" {
  description = "Amplify App ID"
  value       = module.frontend.app_id
}

output "amplify_app_url" {
  description = "AmplifyアプリケーションURL"
  value       = module.frontend.app_url
}

output "knowledge_base_id" {
  description = "Bedrock Knowledge Base ID"
  value       = module.bedrock.knowledge_base_id
}

output "data_source_id" {
  description = "Bedrock Data Source ID"
  value       = module.bedrock.data_source_id
}

output "collection_id" {
  description = "OpenSearch Serverless Collection ID"
  value       = module.bedrock.collection_id
}

output "collection_endpoint" {
  description = "OpenSearch Serverless Collection Endpoint"
  value       = module.bedrock.collection_endpoint
}

output "index_name" {
  description = "OpenSearch Index Name"
  value       = module.bedrock.index_name
}

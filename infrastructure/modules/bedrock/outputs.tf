output "knowledge_base_id" {
  value       = aws_bedrockagent_knowledge_base.main.id
  description = "Bedrock Knowledge Base ID"
}

output "knowledge_base_arn" {
  value       = aws_bedrockagent_knowledge_base.main.arn
  description = "Bedrock Knowledge Base ARN"
}

output "data_source_id" {
  value       = aws_bedrockagent_data_source.main.data_source_id
  description = "Bedrock Data Source ID"
}

output "collection_id" {
  value       = aws_opensearchserverless_collection.vectors.id
  description = "OpenSearch Serverless Collection ID"
}

output "collection_arn" {
  value       = aws_opensearchserverless_collection.vectors.arn
  description = "OpenSearch Serverless Collection ARN"
}

output "collection_endpoint" {
  value       = aws_opensearchserverless_collection.vectors.collection_endpoint
  description = "OpenSearch Serverless Collection Endpoint"
}

output "index_name" {
  value       = "bedrock-kb-index"
  description = "OpenSearch Index Name"
}

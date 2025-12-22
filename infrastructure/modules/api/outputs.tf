output "api_endpoint" {
  value = aws_apigatewayv2_stage.main.invoke_url
}

output "api_execution_arn" {
  description = "API Gateway実行ARN（Lambda Authorizerの権限設定に使用）"
  value       = aws_apigatewayv2_api.main.execution_arn
}

output "documents_function_name" {
  value = aws_lambda_function.documents.function_name
}

output "documents_invoke_arn" {
  value = aws_lambda_function.documents.invoke_arn
}

output "search_function_name" {
  value = aws_lambda_function.search.function_name
}

output "search_invoke_arn" {
  value = aws_lambda_function.search.invoke_arn
}

output "external_api_function_name" {
  value = aws_lambda_function.external_api.function_name
}

output "external_api_invoke_arn" {
  value = aws_lambda_function.external_api.invoke_arn
}

# マルチテナント認証関連のoutputs
output "authorizer_function_name" {
  description = "Lambda Authorizer関数名"
  value       = var.multitenant_mode == "true" ? aws_lambda_function.authorizer[0].function_name : ""
}

output "authorizer_invoke_arn" {
  description = "Lambda Authorizer呼び出しARN"
  value       = var.multitenant_mode == "true" ? aws_lambda_function.authorizer[0].invoke_arn : ""
}

output "authorizer_function_arn" {
  description = "Lambda Authorizer関数ARN"
  value       = var.multitenant_mode == "true" ? aws_lambda_function.authorizer[0].arn : ""
}

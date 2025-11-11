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

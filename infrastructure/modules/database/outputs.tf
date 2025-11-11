output "table_name" {
  value = aws_dynamodb_table.documents.name
}

output "table_arn" {
  value = aws_dynamodb_table.documents.arn
}

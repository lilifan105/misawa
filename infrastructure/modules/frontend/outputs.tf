output "app_id" {
  description = "Amplify App ID"
  value       = aws_amplify_app.frontend.id
}

output "default_domain" {
  description = "Amplifyデフォルトドメイン"
  value       = aws_amplify_app.frontend.default_domain
}

output "app_url" {
  description = "アプリケーションURL（リポジトリ接続後に有効）"
  value       = "https://${var.branch_name}.${aws_amplify_app.frontend.default_domain}"
}

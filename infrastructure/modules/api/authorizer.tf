# Lambda Authorizer（マルチテナントモード用）
resource "aws_apigatewayv2_authorizer" "lambda" {
  count = var.multitenant_mode == "true" ? 1 : 0

  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "REQUEST"
  authorizer_uri   = var.authorizer_invoke_arn
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.project_name}-authorizer-${var.environment}"
  
  # Lambda Authorizerのレスポンスをキャッシュ（5分）
  authorizer_result_ttl_in_seconds = 300
  
  # シンプルレスポンス形式を無効化（IAMポリシー形式を使用）
  enable_simple_responses = false
}

# 既存のルートにAuthorizerを適用（マルチテナントモードの場合のみ）
# documents_list
resource "aws_apigatewayv2_route" "documents_list_with_auth" {
  count = var.multitenant_mode == "true" ? 1 : 0

  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /documents"
  target             = "integrations/${aws_apigatewayv2_integration.documents.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda[0].id
}

# documents_get
resource "aws_apigatewayv2_route" "documents_get_with_auth" {
  count = var.multitenant_mode == "true" ? 1 : 0

  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /documents/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.documents.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda[0].id
}

# documents_upload_url
resource "aws_apigatewayv2_route" "documents_upload_url_with_auth" {
  count = var.multitenant_mode == "true" ? 1 : 0

  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /documents/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.documents.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda[0].id
}

# documents_create
resource "aws_apigatewayv2_route" "documents_create_with_auth" {
  count = var.multitenant_mode == "true" ? 1 : 0

  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /documents"
  target             = "integrations/${aws_apigatewayv2_integration.documents.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda[0].id
}

# documents_update
resource "aws_apigatewayv2_route" "documents_update_with_auth" {
  count = var.multitenant_mode == "true" ? 1 : 0

  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /documents/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.documents.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda[0].id
}

# documents_delete
resource "aws_apigatewayv2_route" "documents_delete_with_auth" {
  count = var.multitenant_mode == "true" ? 1 : 0

  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /documents/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.documents.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda[0].id
}

# search
resource "aws_apigatewayv2_route" "search_with_auth" {
  count = var.multitenant_mode == "true" ? 1 : 0

  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /search"
  target             = "integrations/${aws_apigatewayv2_integration.search.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda[0].id
}

# external_api（外部APIは認証不要のため、Authorizerを適用しない）

# Lambda Authorizerの呼び出し権限
resource "aws_lambda_permission" "authorizer" {
  count = var.multitenant_mode == "true" ? 1 : 0

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.authorizer_function_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*"
}

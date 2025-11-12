resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-api-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = var.cors_origins
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "X-API-Key"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.environment
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "documents" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = var.documents_invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "search" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = var.search_invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "external_api" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = var.external_api_invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "documents_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /documents"
  target    = "integrations/${aws_apigatewayv2_integration.documents.id}"
}

resource "aws_apigatewayv2_route" "documents_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /documents/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.documents.id}"
}

resource "aws_apigatewayv2_route" "documents_create" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /documents"
  target    = "integrations/${aws_apigatewayv2_integration.documents.id}"
}

resource "aws_apigatewayv2_route" "documents_update" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PUT /documents/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.documents.id}"
}

resource "aws_apigatewayv2_route" "documents_delete" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /documents/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.documents.id}"
}

resource "aws_apigatewayv2_route" "search" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /search"
  target    = "integrations/${aws_apigatewayv2_integration.search.id}"
}

resource "aws_apigatewayv2_route" "external_api" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /external/documents"
  target    = "integrations/${aws_apigatewayv2_integration.external_api.id}"
}

resource "aws_lambda_permission" "documents" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.documents_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "search" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.search_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "external_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.external_api_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

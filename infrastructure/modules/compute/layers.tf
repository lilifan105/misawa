# Lambda Layer for Powertools
resource "aws_lambda_layer_version" "powertools" {
  filename            = "${path.root}/../backend/layers/powertools.zip"
  layer_name          = "${var.project_name}-powertools-${var.environment}"
  compatible_runtimes = ["python3.12"]
  source_code_hash    = filebase64sha256("${path.root}/../backend/layers/powertools.zip")

  description = "AWS Lambda Powertools for Python"
}

# Lambda Layer for Shared Modules（マルチテナント認証用）
resource "aws_lambda_layer_version" "shared" {
  count = var.multitenant_mode == "true" ? 1 : 0

  filename            = "${path.root}/../backend/shared/shared-layer.zip"
  layer_name          = "${var.project_name}-shared-${var.environment}"
  compatible_runtimes = ["python3.12"]
  source_code_hash    = filebase64sha256("${path.root}/../backend/shared/shared-layer.zip")

  description = "Shared modules for multitenant authentication"
}

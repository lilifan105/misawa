# Lambda Layer for Powertools
resource "aws_lambda_layer_version" "powertools" {
  filename            = "${path.root}/../backend/layers/powertools.zip"
  layer_name          = "${var.project_name}-powertools-${var.environment}"
  compatible_runtimes = ["python3.12"]
  source_code_hash    = filebase64sha256("${path.root}/../backend/layers/powertools.zip")

  description = "AWS Lambda Powertools for Python"
}

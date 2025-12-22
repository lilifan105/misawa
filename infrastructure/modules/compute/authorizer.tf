# Lambda Authorizer用のIAMロール
resource "aws_iam_role" "authorizer_exec" {
  count = var.multitenant_mode == "true" ? 1 : 0

  name = "${var.project_name}-authorizer-exec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = {
    Name        = "${var.project_name}-authorizer-role"
    Environment = var.environment
  }
}

# Lambda Authorizer用の基本実行ポリシー
resource "aws_iam_role_policy_attachment" "authorizer_basic" {
  count = var.multitenant_mode == "true" ? 1 : 0

  role       = aws_iam_role.authorizer_exec[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda Authorizer用のVPC実行ポリシー（RDSアクセス用）
resource "aws_iam_role_policy_attachment" "authorizer_vpc" {
  count = var.multitenant_mode == "true" ? 1 : 0

  role       = aws_iam_role.authorizer_exec[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Lambda Authorizer関数
resource "aws_lambda_function" "authorizer" {
  count = var.multitenant_mode == "true" ? 1 : 0

  filename         = "${path.root}/../backend/functions/authorizer.zip"
  function_name    = "${var.project_name}-authorizer-${var.environment}"
  role             = aws_iam_role.authorizer_exec[0].arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  timeout          = 10
  memory_size      = 256
  source_code_hash = filebase64sha256("${path.root}/../backend/functions/authorizer.zip")
  
  # 共有モジュールのLambda Layerをアタッチ
  layers = [aws_lambda_layer_version.shared[0].arn]

  # VPC設定（RDSアクセス用）
  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda_authorizer[0].id]
  }

  environment {
    variables = {
      COGNITO_REGION           = var.cognito_region
      COGNITO_USER_POOL_ID     = var.cognito_user_pool_id
      MULTITENANT_RDS_HOST     = var.multitenant_rds_host
      MULTITENANT_RDS_PORT     = var.multitenant_rds_port
      MULTITENANT_RDS_DATABASE = var.multitenant_rds_database
      MULTITENANT_RDS_USER     = var.multitenant_rds_user
      MULTITENANT_RDS_PASSWORD = var.multitenant_rds_password
      DOCUMENT_SERVICE_ID      = var.document_service_id
      MULTITENANT_MODE         = var.multitenant_mode
      POWERTOOLS_SERVICE_NAME  = "authorizer"
      LOG_LEVEL                = "INFO"
    }
  }

  tags = {
    Name        = "${var.project_name}-authorizer"
    Environment = var.environment
  }
}

# Lambda Authorizer用のセキュリティグループ
resource "aws_security_group" "lambda_authorizer" {
  count = var.multitenant_mode == "true" ? 1 : 0

  name        = "${var.project_name}-lambda-authorizer-${var.environment}"
  description = "Security group for Lambda Authorizer"
  vpc_id      = var.vpc_id

  # RDSへのアウトバウンド通信を許可（PostgreSQL）
  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.rds_cidr_blocks
    description = "Allow outbound to RDS PostgreSQL"
  }

  # HTTPSへのアウトバウンド通信を許可（Cognito JWKS取得用）
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow outbound HTTPS for Cognito JWKS"
  }

  tags = {
    Name        = "${var.project_name}-lambda-authorizer-sg"
    Environment = var.environment
  }
}

# API GatewayがLambda Authorizerを呼び出すための権限
resource "aws_lambda_permission" "authorizer_api_gateway" {
  count = var.multitenant_mode == "true" ? 1 : 0

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authorizer[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

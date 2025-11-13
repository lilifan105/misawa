resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-lambda-exec-${var.environment}"

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
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_access" {
  name = "dynamodb-s3-access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          var.dynamodb_table_arn,
          "${var.dynamodb_table_arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${var.s3_bucket_arn}/*"
      }
    ]
  })
}

resource "aws_lambda_function" "documents" {
  filename         = "${path.root}/../backend/functions/documents.zip"
  function_name    = "${var.project_name}-documents-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 512
  source_code_hash = filebase64sha256("${path.root}/../backend/functions/documents.zip")
  layers           = [aws_lambda_layer_version.powertools.arn]

  environment {
    variables = {
      DOCUMENTS_TABLE         = var.dynamodb_table_name
      DOCUMENTS_BUCKET        = var.s3_bucket_id
      POWERTOOLS_SERVICE_NAME = "documents"
      LOG_LEVEL               = "INFO"
    }
  }

  tags = {
    Name        = "${var.project_name}-documents"
    Environment = var.environment
  }
}

resource "aws_lambda_function" "search" {
  filename         = "${path.root}/../backend/functions/search.zip"
  function_name    = "${var.project_name}-search-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 512
  source_code_hash = filebase64sha256("${path.root}/../backend/functions/search.zip")
  layers           = [aws_lambda_layer_version.powertools.arn]

  environment {
    variables = {
      POWERTOOLS_SERVICE_NAME = "search"
      LOG_LEVEL               = "INFO"
    }
  }

  tags = {
    Name        = "${var.project_name}-search"
    Environment = var.environment
  }
}

resource "aws_lambda_function" "external_api" {
  filename         = "${path.root}/../backend/functions/external_api.zip"
  function_name    = "${var.project_name}-external-api-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 512
  source_code_hash = filebase64sha256("${path.root}/../backend/functions/external_api.zip")
  layers           = [aws_lambda_layer_version.powertools.arn]

  environment {
    variables = {
      DOCUMENTS_TABLE         = var.dynamodb_table_name
      EXTERNAL_API_KEY        = var.external_api_key
      POWERTOOLS_SERVICE_NAME = "external-api"
      LOG_LEVEL               = "INFO"
    }
  }

  tags = {
    Name        = "${var.project_name}-external-api"
    Environment = var.environment
  }
}

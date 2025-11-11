# Amplifyアプリケーション
resource "aws_amplify_app" "frontend" {
  name       = "${var.project_name}-frontend-${var.environment}"
  repository = var.repository_url

  # ビルド設定
  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
  EOT

  # 環境変数
  environment_variables = {
    NEXT_PUBLIC_API_ENDPOINT = var.api_endpoint
    _LIVE_UPDATES            = "[{\"pkg\":\"next\",\"type\":\"internal\",\"version\":\"latest\"}]"
  }

  # カスタムルール（Next.js用）
  custom_rule {
    source = "/<*>"
    status = "404-200"
    target = "/index.html"
  }

  tags = {
    Name        = "${var.project_name}-frontend"
    Environment = var.environment
  }
}

# ブランチ設定
resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = var.branch_name

  enable_auto_build = true

  environment_variables = {
    NEXT_PUBLIC_API_ENDPOINT = var.api_endpoint
  }

  tags = {
    Name        = "${var.project_name}-${var.branch_name}"
    Environment = var.environment
  }
}

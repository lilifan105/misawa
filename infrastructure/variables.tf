variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "misawa"
}

variable "environment" {
  description = "Environment (dev, prod)"
  type        = string
  default     = "dev"
}

variable "callback_urls" {
  description = "Cognito callback URLs"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "logout_urls" {
  description = "Cognito logout URLs"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "cors_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "external_api_key" {
  description = "External API key for GCP integration"
  type        = string
  sensitive   = true
  default     = "change-me-in-production"
}

variable "repository_url" {
  description = "GitHubリポジトリURL"
  type        = string
}

variable "branch_name" {
  description = "デプロイするブランチ名"
  type        = string
  default     = "main"
}

variable "github_access_token" {
  description = "GitHub Personal Access Token（repo権限必要）"
  type        = string
  sensitive   = true
  default     = ""
}

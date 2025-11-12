variable "project_name" {
  description = "プロジェクト名"
  type        = string
}

variable "environment" {
  description = "環境名 (dev, prod)"
  type        = string
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

variable "api_endpoint" {
  description = "バックエンドAPIエンドポイント"
  type        = string
}

variable "github_access_token" {
  description = "GitHubアクセストークン（リポジトリ接続用）"
  type        = string
  sensitive   = true
  default     = ""
}

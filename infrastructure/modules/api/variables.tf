variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "cors_origins" {
  type = list(string)
}

variable "documents_function_name" {
  type = string
}

variable "documents_invoke_arn" {
  type = string
}

variable "search_function_name" {
  type = string
}

variable "search_invoke_arn" {
  type = string
}

variable "external_api_function_name" {
  type = string
}

variable "external_api_invoke_arn" {
  type = string
}

# マルチテナント認証関連の変数
variable "multitenant_mode" {
  type        = string
  description = "マルチテナントモードを有効にするか（true/false）"
  default     = "false"
}

variable "authorizer_function_arn" {
  type        = string
  description = "Lambda Authorizer関数ARN"
  default     = ""
}

variable "authorizer_invoke_arn" {
  type        = string
  description = "Lambda Authorizer呼び出しARN"
  default     = ""
}

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

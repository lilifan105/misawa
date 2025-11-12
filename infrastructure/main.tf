terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

module "database" {
  source = "./modules/database"

  project_name = var.project_name
  environment  = var.environment
}

module "storage" {
  source = "./modules/storage"

  project_name = var.project_name
  environment  = var.environment
  account_id   = data.aws_caller_identity.current.account_id
}

module "auth" {
  source = "./modules/auth"

  project_name  = var.project_name
  environment   = var.environment
  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls
}

module "compute" {
  source = "./modules/compute"

  project_name        = var.project_name
  environment         = var.environment
  dynamodb_table_name = module.database.table_name
  dynamodb_table_arn  = module.database.table_arn
  s3_bucket_id        = module.storage.bucket_id
  s3_bucket_arn       = module.storage.bucket_arn
  external_api_key    = var.external_api_key
}

module "api" {
  source = "./modules/api"

  project_name               = var.project_name
  environment                = var.environment
  cors_origins               = var.cors_origins
  documents_function_name    = module.compute.documents_function_name
  documents_invoke_arn       = module.compute.documents_invoke_arn
  search_function_name       = module.compute.search_function_name
  search_invoke_arn          = module.compute.search_invoke_arn
  external_api_function_name = module.compute.external_api_function_name
  external_api_invoke_arn    = module.compute.external_api_invoke_arn
}

module "frontend" {
  source = "./modules/frontend"

  project_name         = var.project_name
  environment          = var.environment
  repository_url       = var.repository_url
  branch_name          = var.branch_name
  api_endpoint         = module.api.api_endpoint
  github_access_token  = var.github_access_token
}

terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.20.0"
    }
    awscc = {
      source  = "hashicorp/awscc"
      version = "~> 1.63.0"
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

# Bedrock一時無効化
# module "bedrock" {
#   source = "./modules/bedrock"
#
#   project_name  = var.project_name
#   environment   = var.environment
#   aws_region    = var.aws_region
#   account_id    = data.aws_caller_identity.current.account_id
#   s3_bucket_arn = module.storage.bucket_arn
# }

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
  knowledge_base_id   = ""  # Bedrock一時無効化
  data_source_id      = ""  # Bedrock一時無効化
  
  # マルチテナント認証設定
  multitenant_mode         = var.multitenant_mode
  cognito_region           = var.cognito_region
  cognito_user_pool_id     = var.cognito_user_pool_id
  multitenant_issuer       = var.multitenant_issuer
  multitenant_rds_host     = var.multitenant_rds_host
  multitenant_rds_port     = var.multitenant_rds_port
  multitenant_rds_database = var.multitenant_rds_database
  multitenant_rds_user     = var.multitenant_rds_user
  multitenant_rds_password = var.multitenant_rds_password
  document_service_id      = var.document_service_id
  multitenant_client_id    = var.multitenant_client_id
  vpc_id                   = var.vpc_id
  private_subnet_ids       = var.private_subnet_ids
  rds_cidr_blocks          = var.rds_cidr_blocks
  api_gateway_execution_arn = module.api.api_execution_arn
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
  
  # マルチテナント認証設定
  multitenant_mode         = var.multitenant_mode
  authorizer_function_arn  = module.compute.authorizer_function_arn
  authorizer_invoke_arn    = module.compute.authorizer_invoke_arn
}

module "frontend" {
  source = "./modules/frontend"

  project_name         = var.project_name
  environment          = var.environment
  repository_url       = var.repository_url
  branch_name          = var.branch_name
  api_endpoint         = module.api.api_endpoint
  github_access_token  = var.github_access_token
  
  # マルチテナント設定
  multitenant_mode     = var.multitenant_mode
  multitenant_url      = var.multitenant_url
}

variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "account_id" {
  type = string
}

variable "s3_bucket_arn" {
  type        = string
  description = "ARN of the S3 bucket containing documents"
}

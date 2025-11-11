resource "aws_dynamodb_table" "documents" {
  name         = "${var.project_name}-documents-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  attribute {
    name = "date"
    type = "S"
  }

  global_secondary_index {
    name            = "CategoryDateIndex"
    hash_key        = "category"
    range_key       = "date"
    projection_type = "ALL"
  }

  tags = {
    Name        = "${var.project_name}-documents"
    Environment = var.environment
  }
}

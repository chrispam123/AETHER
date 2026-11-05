# ==============================================================================
# MÓDULO DE BÓVEDA Y ALMACENAMIENTO (DYNAMODB + S3 PRIVADO + LAMBDA + API GW)
# ==============================================================================
# Región de Soberanía: España (eu-south-2)
# ==============================================================================

resource "random_string" "vault_suffix" {
  length  = 6
  special = false
  upper   = false
}

# ------------------------------------------------------------------------------
# 1. TABLA DYNAMODB: CATÁLOGO DE METADATOS DE OBRAS (aether-works-catalog)
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "catalog" {
  name         = "${var.project_name}-works-catalog"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "workId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "workId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-works-catalog"
  }
}

# ------------------------------------------------------------------------------
# 2. BUCKET S3 PRIVADO: LA BÓVEDA DE ARCHIVOS .AETHER (aether-vault-...)
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "vault" {
  bucket = "${var.project_name}-vault-${var.aws_region}-${random_string.vault_suffix.result}"

  tags = {
    Name = "${var.project_name}-vault-storage"
  }
}

resource "aws_s3_bucket_public_access_block" "vault" {
  bucket = aws_s3_bucket.vault.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "vault" {
  bucket = aws_s3_bucket.vault.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "vault" {
  bucket = aws_s3_bucket.vault.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "vault" {
  bucket = aws_s3_bucket.vault.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# ------------------------------------------------------------------------------
# 3. EMPAQUETADO Y ROL IAM PARA AWS LAMBDA (sync-vault)
# ------------------------------------------------------------------------------
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda/index.mjs"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-vault-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-vault-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # CloudWatch Logs
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:*"
      },
      # DynamoDB CRUD sobre el catálogo
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query"
        ]
        Resource = aws_dynamodb_table.catalog.arn
      },
      # S3 operaciones de objetos para Presigned URLs y borrado
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:HeadObject"
        ]
        Resource = "${aws_s3_bucket.vault.arn}/*"
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 4. FUNCIÓN AWS LAMBDA (nodejs20.x en arm64 Graviton2)
# ------------------------------------------------------------------------------
resource "aws_lambda_function" "sync_vault" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-sync-vault"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  timeout          = 15
  memory_size      = 256
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      CATALOG_TABLE_NAME = aws_dynamodb_table.catalog.name
      VAULT_BUCKET_NAME  = aws_s3_bucket.vault.id
    }
  }

  tags = {
    Name = "${var.project_name}-sync-vault"
  }
}

# ------------------------------------------------------------------------------
# 5. API GATEWAY HTTP API (v2) CON AUTORIZADOR COGNITO JWT
# ------------------------------------------------------------------------------
resource "aws_apigatewayv2_api" "vault_api" {
  name          = "${var.project_name}-vault-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["Authorization", "Content-Type", "x-amz-date"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_origins     = ["*"]
    max_age           = 3600
  }
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.vault_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer"

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.vault_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.sync_vault.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = toset([
    "GET /vault/works",
    "POST /vault/sync/init",
    "GET /vault/works/{workId}/download",
    "DELETE /vault/works/{workId}"
  ])

  api_id             = aws_apigatewayv2_api.vault_api.id
  route_key          = each.value
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.vault_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sync_vault.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.vault_api.execution_arn}/*/*"
}

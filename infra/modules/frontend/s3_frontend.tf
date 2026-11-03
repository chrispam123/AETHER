# ==============================================================================
# MÓDULO FRONTEND: BUCKET PRIVADO DE ALMACENAMIENTO WEB (S3)
# ==============================================================================

# Sufijo determinista aleatorio para garantizar unicidad global del bucket en S3
resource "random_string" "bucket_suffix" {
  length  = 6
  special = false
  upper   = false
}

# Bucket S3 para alojar los archivos estáticos compilados (dist/)
resource "aws_s3_bucket" "frontend" {
  bucket = "${var.project_name}-frontend-${var.aws_region}-${random_string.bucket_suffix.result}"

  tags = {
    Name = "${var.project_name}-frontend-bucket"
  }
}

# 1. Seguridad: Bloqueo de Acceso Público al 100%
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 2. Seguridad: Cifrado en Reposo con AES-256 (SSE-S3 sin coste adicional)
resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# 3. Gobernanza: Versionado de artefactos web para rollbacks seguros
resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

# 4. Política de Acceso: Exclusivamente accesible a través de CloudFront OAC
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.frontend]
}

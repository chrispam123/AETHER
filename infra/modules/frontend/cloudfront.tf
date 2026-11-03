# ==============================================================================
# MÓDULO FRONTEND: RED DE DISTRIBUCIÓN GLOBAL (CLOUDFRONT CDN)
# ==============================================================================

# 1. Control de Acceso de Origen (OAC) moderno de AWS para S3
resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "${var.project_name}-frontend-oac"
  description                       = "Control de acceso seguro para el bucket de frontend de Aether"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# 2. Distribución Global de CloudFront
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "Aether Editorial Frontend CDN (España)"

  # Origen S3 privado mediante OAC
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "aether-s3-frontend-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  # Comportamiento de caché por defecto (Optimizado para SPAs)
  default_cache_behavior {
    target_origin_id       = "aether-s3-frontend-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # Política de caché gestionada por AWS: CachingOptimized
    # ID canónico de AWS: 658327ea-f89d-4fab-a63d-7e88639e58f6
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # Soporte para Single Page Application (SPA):
  # Si el usuario recarga en una ruta no física, devuelve index.html con HTTP 200
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  # Restricciones geográficas: Acceso global abierto
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Certificado SSL por defecto de CloudFront (*.cloudfront.net con HTTPS)
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${var.project_name}-frontend-cdn"
  }
}

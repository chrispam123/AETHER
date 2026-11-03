# ==============================================================================
# SALIDAS GLOBALES DE INFRAESTRUCTURA
# ==============================================================================

output "frontend_url" {
  description = "URL pública y segura (HTTPS) de la aplicación en CloudFront"
  value       = "https://${module.frontend.cloudfront_domain_name}"
}

output "frontend_s3_bucket" {
  description = "Nombre del bucket S3 de almacenamiento de artefactos web"
  value       = module.frontend.s3_bucket_name
}

output "cloudfront_distribution_id" {
  description = "ID de la distribución CloudFront para invalidaciones de caché en CI/CD"
  value       = module.frontend.cloudfront_distribution_id
}

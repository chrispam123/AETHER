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

output "github_actions_role_arn" {
  description = "ARN del rol IAM que GitHub Actions debe asumir para desplegar vía OIDC (sin claves estáticas)"
  value       = module.github_oidc.role_arn
}

# --- Autenticación (Cognito + Google OAuth) ---

output "cognito_user_pool_id" {
  description = "ID del Cognito User Pool en España (eu-south-2)"
  value       = module.auth.user_pool_id
}

output "cognito_client_id" {
  description = "ID del cliente SPA de Cognito para el frontend de Aether"
  value       = module.auth.user_pool_client_id
}

output "cognito_domain" {
  description = "Dominio base de Cognito para los flujos OAuth 2.0"
  value       = module.auth.cognito_domain
}

output "google_authorized_redirect_uri" {
  description = "URI autorizada de redirección que debe añadirse en Google Cloud Console"
  value       = module.auth.google_idp_callback_url
}

# --- Bóveda de Almacenamiento (DynamoDB + S3 + API Gateway + Lambda) ---

output "vault_dynamodb_table" {
  description = "Tabla DynamoDB para el catálogo de obras del autor"
  value       = module.vault.dynamodb_table_name
}

output "vault_s3_bucket" {
  description = "Bucket S3 privado de la Bóveda de Aether"
  value       = module.vault.s3_vault_bucket_name
}

output "vault_api_endpoint" {
  description = "Endpoint base de API Gateway para la sincronización de la Bóveda"
  value       = module.vault.api_gateway_endpoint
}

output "vault_lambda_name" {
  description = "Nombre de la función Lambda de sincronización"
  value       = module.vault.lambda_function_name
}

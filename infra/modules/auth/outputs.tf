# ==============================================================================
# SALIDAS DEL MÓDULO DE AUTENTICACIÓN
# ==============================================================================

output "user_pool_id" {
  description = "ID del Cognito User Pool en España"
  value       = aws_cognito_user_pool.pool.id
}

output "user_pool_arn" {
  description = "ARN del Cognito User Pool"
  value       = aws_cognito_user_pool.pool.arn
}

output "user_pool_client_id" {
  description = "ID del cliente SPA de Cognito para el frontend de Aether"
  value       = aws_cognito_user_pool_client.client.id
}

output "cognito_domain" {
  description = "Dominio base de Cognito para flujos OAuth 2.0"
  value       = "https://${aws_cognito_user_pool_domain.domain.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "google_idp_callback_url" {
  description = "URL exacta de redirección que debe añadirse en Google Cloud Console"
  value       = "https://${aws_cognito_user_pool_domain.domain.domain}.auth.${var.aws_region}.amazoncognito.com/oauth2/idpresponse"
}

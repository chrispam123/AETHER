# ==============================================================================
# VARIABLES DEL MÓDULO DE AUTENTICACIÓN (COGNITO + GOOGLE OAUTH 2.0)
# ==============================================================================

variable "project_name" {
  description = "Prefijo para los nombres de los recursos"
  type        = string
  default     = "aether"
}

variable "environment" {
  description = "Entorno (production, staging, dev)"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "Región de AWS para el despliegue soberano (España)"
  type        = string
  default     = "eu-south-2"
}

variable "google_client_id" {
  description = "Client ID obtenido en Google Cloud Console para OAuth 2.0"
  type        = string
}

variable "google_client_secret" {
  description = "Client Secret obtenido en Google Cloud Console para OAuth 2.0"
  type        = string
  sensitive   = true
}

variable "frontend_url" {
  description = "URL pública de producción en CloudFront"
  type        = string
}

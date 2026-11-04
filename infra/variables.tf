# ==============================================================================
# VARIABLES GLOBALES DE INFRAESTRUCTURA
# ==============================================================================

variable "aws_region" {
  description = "Región de AWS para el despliegue soberano (España)"
  type        = string
  default     = "eu-south-2"
}

variable "project_name" {
  description = "Prefijo identificador para todos los recursos del proyecto"
  type        = string
  default     = "aether"
}

variable "environment" {
  description = "Entorno de ejecución (production, staging, dev)"
  type        = string
  default     = "production"
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

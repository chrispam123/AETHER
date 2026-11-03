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

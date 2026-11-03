# ==============================================================================
# VARIABLES DEL MÓDULO GITHUB OIDC
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

variable "github_repository" {
  description = "Repositorio de GitHub en formato owner/repo (ej. chrispam123/AETHER)"
  type        = string
  default     = "chrispam123/AETHER"
}

variable "frontend_bucket_arn" {
  description = "ARN del bucket S3 del frontend de Aether"
  type        = string
}

variable "cloudfront_distribution_arn" {
  description = "ARN de la distribución CloudFront de Aether"
  type        = string
}

variable "create_oidc_provider" {
  description = "Indica si se debe crear el proveedor OIDC de GitHub si no existe en la cuenta de AWS"
  type        = bool
  default     = false
}

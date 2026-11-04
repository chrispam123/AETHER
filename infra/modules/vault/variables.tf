# ==============================================================================
# VARIABLES DEL MÓDULO DE BÓVEDA Y ALMACENAMIENTO (DYNAMODB + S3 + LAMBDA)
# ==============================================================================

variable "project_name" {
  description = "Nombre base del proyecto"
  type        = string
}

variable "environment" {
  description = "Entorno de despliegue (production, staging, etc.)"
  type        = string
}

variable "aws_region" {
  description = "Región de AWS para soberanía de datos (ej. eu-south-2)"
  type        = string
}

variable "cognito_user_pool_id" {
  description = "ID del Cognito User Pool para el JWT Authorizer"
  type        = string
}

variable "cognito_client_id" {
  description = "ID del cliente Cognito para validar la audiencia del JWT"
  type        = string
}

variable "frontend_domain" {
  description = "Dominio público de CloudFront para reglas de CORS"
  type        = string
}

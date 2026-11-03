variable "project_name" {
  description = "Nombre base del proyecto"
  type        = string
}

variable "environment" {
  description = "Entorno (production / staging)"
  type        = string
}

variable "aws_region" {
  description = "Región de AWS"
  type        = string
}

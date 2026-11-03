# ==============================================================================
# SALIDAS DEL MÓDULO GITHUB OIDC
# ==============================================================================

output "role_arn" {
  description = "ARN del rol IAM que GitHub Actions debe asumir para desplegar"
  value       = aws_iam_role.github_actions.arn
}

output "role_name" {
  description = "Nombre del rol IAM"
  value       = aws_iam_role.github_actions.name
}

# ==============================================================================
# SALIDAS DEL MÓDULO DE BÓVEDA (DYNAMODB + S3 + API GATEWAY + LAMBDA)
# ==============================================================================

output "dynamodb_table_name" {
  description = "Nombre de la tabla DynamoDB del catálogo de obras"
  value       = aws_dynamodb_table.catalog.name
}

output "dynamodb_table_arn" {
  description = "ARN de la tabla DynamoDB"
  value       = aws_dynamodb_table.catalog.arn
}

output "s3_vault_bucket_name" {
  description = "Nombre del bucket S3 privado de la Bóveda"
  value       = aws_s3_bucket.vault.id
}

output "s3_vault_bucket_arn" {
  description = "ARN del bucket S3 privado de la Bóveda"
  value       = aws_s3_bucket.vault.arn
}

output "api_gateway_endpoint" {
  description = "URL base del API Gateway HTTP para la Bóveda de Aether"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "lambda_function_name" {
  description = "Nombre de la función Lambda de sincronización"
  value       = aws_lambda_function.sync_vault.function_name
}

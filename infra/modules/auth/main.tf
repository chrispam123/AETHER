# ==============================================================================
# MÓDULO DE AUTENTICACIÓN COGNITO + GOOGLE OAUTH 2.0 (ESPAÑA - eu-south-2)
# ==============================================================================
# Gestión de identidades de autor unificada:
# Permite autenticación sin contraseñas mediante Google OAuth 2.0 y soporte nativo
# de User Pool para autores por correo electrónico.
# ==============================================================================

resource "random_string" "auth_suffix" {
  length  = 6
  special = false
  upper   = false
}

# 1. Cognito User Pool en España (eu-south-2)
resource "aws_cognito_user_pool" "pool" {
  name = "${var.project_name}-user-pool"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  schema {
    attribute_data_type = "String"
    name                = "email"
    required            = true
    mutable             = true
  }

  schema {
    attribute_data_type = "String"
    name                = "name"
    required            = false
    mutable             = true
  }

  tags = {
    Name = "${var.project_name}-user-pool"
  }

  lifecycle {
    ignore_changes = [schema]
  }
}

# 2. Dominio de Cognito para los endpoints de OAuth 2.0
resource "aws_cognito_user_pool_domain" "domain" {
  domain       = "${var.project_name}-auth-${random_string.auth_suffix.result}"
  user_pool_id = aws_cognito_user_pool.pool.id
}

# 3. Proveedor de Identidad Externo: Google OAuth 2.0
resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.pool.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
    authorize_scopes = "email openid profile"
  }

  attribute_mapping = {
    email    = "email"
    name     = "name"
    username = "sub"
  }
}

# 4. App Client para Single Page Application (SPA - sin secret)
resource "aws_cognito_user_pool_client" "client" {
  name         = "${var.project_name}-spa-client"
  user_pool_id = aws_cognito_user_pool.pool.id

  generate_secret = false

  supported_identity_providers = [
    aws_cognito_identity_provider.google.provider_name
  ]

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  callback_urls = [
    "http://localhost:5173",
    var.frontend_url
  ]

  logout_urls = [
    "http://localhost:5173",
    var.frontend_url
  ]

  prevent_user_existence_errors = "ENABLED"
  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # Dependencia explícita para asegurar que el IdP de Google exista antes de habilitarlo
  depends_on = [aws_cognito_identity_provider.google]
}

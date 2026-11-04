# ==============================================================================
# AETHER — INFRAESTRUCTURA COMO CÓDIGO (TERRAFORM)
# ==============================================================================
# Orquestador principal de infraestructura en AWS
# Región de soberanía europea: España (eu-south-2)
# Backend remoto en S3 con Native State Locking (Terraform 1.10+)
# ==============================================================================

terraform {
  required_version = ">= 1.10.0"

  backend "s3" {
    bucket       = "aether-tfstate-eu-south-2-artesanal"
    key          = "production/terraform.tfstate"
    region       = "eu-south-2"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

# Provider principal para la región de España
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Aether"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Repository  = "https://github.com/chrispam123/AETHER"
      Region      = var.aws_region
    }
  }
}

# Módulo del Frontend (Hosting S3 + CloudFront CDN Global)
module "frontend" {
  source = "./modules/frontend"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region
}

# Módulo de Autenticación OIDC para GitHub Actions (Despliegue Continuo sin claves estáticas)
module "github_oidc" {
  source = "./modules/github_oidc"

  project_name                = var.project_name
  environment                 = var.environment
  github_repository           = "chrispam123/AETHER"
  frontend_bucket_arn         = module.frontend.s3_bucket_arn
  cloudfront_distribution_arn = module.frontend.cloudfront_distribution_arn
  create_oidc_provider        = false
}

# Módulo de Identidad y Autenticación de Autores (AWS Cognito + Google OAuth 2.0)
module "auth" {
  source = "./modules/auth"

  project_name         = var.project_name
  environment          = var.environment
  aws_region           = var.aws_region
  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret
  frontend_url         = "https://${module.frontend.cloudfront_domain_name}"
}


# Módulo de Bóveda y Almacenamiento Privado (DynamoDB + S3 + API Gateway + Lambda)
module "vault" {
  source = "./modules/vault"

  project_name         = var.project_name
  environment          = var.environment
  aws_region           = var.aws_region
  cognito_user_pool_id = module.auth.user_pool_id
  cognito_client_id    = module.auth.user_pool_client_id
  frontend_domain      = module.frontend.cloudfront_domain_name
}

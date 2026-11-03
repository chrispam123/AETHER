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

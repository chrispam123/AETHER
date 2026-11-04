# ==============================================================================
# MODULO GITHUB ACTIONS OIDC FEDERATION — AETHER
# ==============================================================================
# Permite a GitHub Actions autenticarse mediante tokens efimeros JWT (OIDC)
# sin necesidad de guardar Access Keys estaticas en el repositorio.
# ==============================================================================

data "aws_caller_identity" "current" {}

# Creacion opcional del proveedor si no existiera
resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd"
  ]

  tags = {
    Name = "${var.project_name}-github-oidc-provider"
  }
}

locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
}

# Politica de confianza (Trust Policy) vinculada estrictamente al repositorio de GitHub
data "aws_iam_policy_document" "github_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [
        "repo:${var.github_repository}:*",
        "repo:chrispam123*AETHER*:*",
        "repo:chrispam123*aether*:*"
      ]
    }
  }
}

# Rol IAM para GitHub Actions con el prefijo obligatorio aether
resource "aws_iam_role" "github_actions" {
  name                 = "${var.project_name}-github-actions-cd-role"
  description          = "Rol asumido por GitHub Actions para el despliegue continuo de ${var.project_name} via OIDC"
  assume_role_policy   = data.aws_iam_policy_document.github_assume_role.json
  max_session_duration = 3600

  tags = {
    Name = "${var.project_name}-github-actions-cd-role"
  }
}

# Politica de permisos de infraestructura y despliegue para GitOps (Aether)
data "aws_iam_policy_document" "github_actions_permissions" {
  # 1. S3: Frontend, Vault y Terraform State
  statement {
    sid    = "S3Management"
    effect = "Allow"
    actions = [
      "s3:*"
    ]
    resources = [
      "arn:aws:s3:::aether-*",
      "arn:aws:s3:::aether-*/*"
    ]
  }

  statement {
    sid    = "S3GlobalReads"
    effect = "Allow"
    actions = [
      "s3:ListAllMyBuckets",
      "s3:GetAccountPublicAccessBlock"
    ]
    resources = ["*"]
  }

  # 2. DynamoDB: Catalogo de Obras
  statement {
    sid    = "DynamoDBManagement"
    effect = "Allow"
    actions = [
      "dynamodb:*"
    ]
    resources = [
      "arn:aws:dynamodb:*:*:table/aether-*",
      "arn:aws:dynamodb:*:*:table/aether-*/*"
    ]
  }

  # 3. AWS Lambda: Boveda y Funciones Backend
  statement {
    sid    = "LambdaManagement"
    effect = "Allow"
    actions = [
      "lambda:*"
    ]
    resources = ["*"]
  }

  # 4. API Gateway v2: HTTP API de Sincronizacion
  statement {
    sid    = "ApiGatewayManagement"
    effect = "Allow"
    actions = [
      "apigateway:*"
    ]
    resources = ["*"]
  }

  # 5. CloudFront: Distribucion, OAC e Invalidaciones
  statement {
    sid    = "CloudFrontManagement"
    effect = "Allow"
    actions = [
      "cloudfront:*"
    ]
    resources = ["*"]
  }

  # 6. Cognito: Identity Provider, User Pools y Dominios
  statement {
    sid    = "CognitoManagement"
    effect = "Allow"
    actions = [
      "cognito-idp:*"
    ]
    resources = ["*"]
  }

  # 7. IAM: Gobernanza y delegacion de roles del proyecto
  statement {
    sid    = "IAMManagement"
    effect = "Allow"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:PassRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy"
    ]
    resources = [
      "arn:aws:iam::*:role/aether-*",
      "arn:aws:iam::*:policy/aether-*"
    ]
  }

  # 8. CloudWatch Logs: Logs de la Lambda
  statement {
    sid    = "LogsManagement"
    effect = "Allow"
    actions = [
      "logs:*"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_actions_policy" {
  name   = "${var.project_name}-github-actions-deploy-policy"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_actions_permissions.json
}

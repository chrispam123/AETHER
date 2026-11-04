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
    sid    = "S3AetherManagement"
    effect = "Allow"
    actions = [
      "s3:CreateBucket",
      "s3:DeleteBucket",
      "s3:ListBucket",
      "s3:GetBucketLocation",
      "s3:GetBucketPolicy",
      "s3:PutBucketPolicy",
      "s3:DeleteBucketPolicy",
      "s3:GetBucketAcl",
      "s3:PutBucketAcl",
      "s3:GetBucketCors",
      "s3:PutBucketCors",
      "s3:GetBucketVersioning",
      "s3:PutBucketVersioning",
      "s3:GetEncryptionConfiguration",
      "s3:PutEncryptionConfiguration",
      "s3:GetBucketPublicAccessBlock",
      "s3:PutBucketPublicAccessBlock",
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ]
    resources = [
      "arn:aws:s3:::aether-*",
      "arn:aws:s3:::aether-*/*"
    ]
  }

  # 2. DynamoDB: Catalogo de Obras
  statement {
    sid    = "DynamoDBAetherManagement"
    effect = "Allow"
    actions = [
      "dynamodb:CreateTable",
      "dynamodb:DeleteTable",
      "dynamodb:DescribeTable",
      "dynamodb:DescribeContinuousBackups",
      "dynamodb:UpdateContinuousBackups",
      "dynamodb:DescribeTimeToLive",
      "dynamodb:UpdateTimeToLive",
      "dynamodb:ListTagsOfResource",
      "dynamodb:TagResource",
      "dynamodb:UntagResource",
      "dynamodb:UpdateTable"
    ]
    resources = [
      "arn:aws:dynamodb:*:*:table/aether-*"
    ]
  }

  # 3. AWS Lambda: Boveda y Funciones Backend
  statement {
    sid    = "LambdaAetherManagement"
    effect = "Allow"
    actions = [
      "lambda:CreateFunction",
      "lambda:DeleteFunction",
      "lambda:GetFunction",
      "lambda:GetFunctionCodeSigningConfig",
      "lambda:GetFunctionConfiguration",
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
      "lambda:AddPermission",
      "lambda:RemovePermission",
      "lambda:GetPolicy",
      "lambda:ListVersionsByFunction",
      "lambda:ListTags",
      "lambda:TagResource",
      "lambda:UntagResource"
    ]
    resources = [
      "arn:aws:lambda:*:*:function:aether-*"
    ]
  }

  # 4. API Gateway v2: HTTP API de Sincronizacion
  statement {
    sid    = "ApiGatewayAetherManagement"
    effect = "Allow"
    actions = [
      "apigateway:*"
    ]
    resources = [
      "*"
    ]
  }

  # 5. IAM: Gobernanza del rol de Lambda
  statement {
    sid    = "IAMAetherManagement"
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
      "iam:ListAttachedRolePolicies"
    ]
    resources = [
      "arn:aws:iam::*:role/aether-*"
    ]
  }

  # 6. CloudFront: Distribucion e Invalidaciones
  statement {
    sid    = "CloudFrontAetherManagement"
    effect = "Allow"
    actions = [
      "cloudfront:CreateInvalidation",
      "cloudfront:GetInvalidation",
      "cloudfront:GetDistribution",
      "cloudfront:GetDistributionConfig",
      "cloudfront:UpdateDistribution",
      "cloudfront:ListTagsForResource",
      "cloudfront:TagResource"
    ]
    resources = [
      "*"
    ]
  }

  # 7. Cognito: Autorizador y Autenticacion
  statement {
    sid    = "CognitoAetherManagement"
    effect = "Allow"
    actions = [
      "cognito-idp:DescribeUserPool",
      "cognito-idp:DescribeUserPoolClient",
      "cognito-idp:DescribeIdentityProvider",
      "cognito-idp:DescribeUserPoolDomain",
      "cognito-idp:GetUserPoolMfaConfig",
      "cognito-idp:UpdateUserPool",
      "cognito-idp:UpdateUserPoolClient",
      "cognito-idp:TagResource"
    ]
    resources = [
      "arn:aws:cognito-idp:*:*:userpool/*"
    ]
  }

  # 8. CloudWatch Logs: Logs de la Lambda
  statement {
    sid    = "LogsAetherManagement"
    effect = "Allow"
    actions = [
      "logs:DescribeLogGroups",
      "logs:CreateLogGroup",
      "logs:DeleteLogGroup",
      "logs:ListTagsLogGroup",
      "logs:PutRetentionPolicy"
    ]
    resources = [
      "arn:aws:logs:*:*:log-group:/aws/lambda/aether-*"
    ]
  }
}

resource "aws_iam_role_policy" "github_actions_policy" {
  name   = "${var.project_name}-github-actions-deploy-policy"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_actions_permissions.json
}

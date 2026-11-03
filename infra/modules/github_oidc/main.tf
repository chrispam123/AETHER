# ==============================================================================
# MÓDULO GITHUB ACTIONS OIDC FEDERATION — AETHER
# ==============================================================================
# Permite a GitHub Actions autenticarse mediante tokens efímeros JWT (OIDC)
# sin necesidad de guardar Access Keys estáticas en el repositorio.
# ==============================================================================

data "aws_caller_identity" "current" {}

# Creación opcional del proveedor si no existiera
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

# Política de confianza (Trust Policy) vinculada estrictamente al repositorio de GitHub
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
        "repo:${var.github_repository}:*"
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

# Política de permisos de mínimo privilegio para CI/CD
data "aws_iam_policy_document" "github_actions_permissions" {
  # Permisos en el bucket S3 del frontend
  statement {
    sid    = "S3FrontendDeployPermissions"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ]
    resources = [
      var.frontend_bucket_arn,
      "${var.frontend_bucket_arn}/*"
    ]
  }

  # Permisos para invalidar la caché de CloudFront
  statement {
    sid    = "CloudFrontInvalidationPermissions"
    effect = "Allow"
    actions = [
      "cloudfront:CreateInvalidation",
      "cloudfront:GetInvalidation"
    ]
    resources = [
      var.cloudfront_distribution_arn
    ]
  }
}

resource "aws_iam_role_policy" "github_actions_policy" {
  name   = "${var.project_name}-github-actions-deploy-policy"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_actions_permissions.json
}

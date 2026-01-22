#!/usr/bin/env bash
set -euo pipefail

# ===== CONFIG =====
AWS_PROFILE=mfa-session
AWS_REGION=ap-southeast-1
AWS_ACCOUNT_ID=345034663883

STACK_NAME=vzinternal-ai-uat
ECR_REPO=vz/internal-ai
ECR_URI=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}
IMAGE_TAG=uat

TEMPLATE_FILE=template-uat.yaml
# ==================

echo "🔹 Using AWS profile: ${AWS_PROFILE}"
echo "🔹 Region: ${AWS_REGION}"
echo "🔹 Stack: ${STACK_NAME}"

# ---------- Login ECR ----------
echo "🔐 Logging into ECR..."
aws ecr get-login-password \
  --region ${AWS_REGION} \
  --profile ${AWS_PROFILE} \
| docker login \
  --username AWS \
  --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# ---------- Build & Push Image ----------
echo "🐳 Building and pushing image: ${ECR_URI}:${IMAGE_TAG}"
docker buildx build \
  --platform linux/amd64 \
  -t ${ECR_URI}:${IMAGE_TAG} \
  --push .

# # ---------- Deploy CloudFormation ----------
# echo "🚀 Deploying CloudFormation stack: ${STACK_NAME}"

# aws cloudformation deploy \
#   --stack-name ${STACK_NAME} \
#   --template-file ${TEMPLATE_FILE} \
#   --capabilities CAPABILITY_NAMED_IAM \
#   --region ${AWS_REGION} \
#   --profile ${AWS_PROFILE} \
#   --parameter-overrides \
#     ImageUri=${ECR_URI}:${IMAGE_TAG} \
#     Environment=uat

# echo "✅ CloudFormation deployment completed for ${STACK_NAME}"

aws lambda update-function-code \
  --function-name internal-ai-bot-uat \
  --image-uri ${ECR_URI}:uat \
  --region ${AWS_REGION} \
  --profile ${AWS_PROFILE}
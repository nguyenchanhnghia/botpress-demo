#!/usr/bin/env bash
set -e

AWS_PROFILE=mfa-session
AWS_REGION=ap-southeast-1
AWS_ACCOUNT_ID=345034663883
ECR_REPO=vz/internal-ai
ECR_URI=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}

echo "🔹 Logging into ECR with MFA session..."
aws ecr get-login-password --region ${AWS_REGION} --profile ${AWS_PROFILE} | \
docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

echo "🚀 Building and pushing image to ${ECR_URI}:prod ..."
docker buildx build --platform linux/amd64 -t ${ECR_URI}:prod --push .

echo "🔁 Updating Lambda function internal-ai-bot-prod ..."
aws lambda update-function-code \
  --function-name internal-ai-bot-prod \
  --image-uri ${ECR_URI}:prod \
  --region ${AWS_REGION} \
  --profile ${AWS_PROFILE}

echo "✅ Done! Lambda function updated with latest image."
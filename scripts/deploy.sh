#!/bin/bash
set -e

FUNCTION_NAME="sow-backend"  # adjust to your actual Lambda name
REGION="us-east-1"           # adjust if different
ZIP_FILE="lambda.zip"

# Build/install production deps
npm run prepare-lambda

# Package
rm -f $ZIP_FILE
zip -r $ZIP_FILE lambda.js server.js node_modules config templates routes services utils

# Update the function code
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file "fileb://$ZIP_FILE" \
  --region "$REGION"

# Optional: publish a version and update alias (e.g., dev or prod)
# VERSION=$(aws lambda publish-version --function-name "$FUNCTION_NAME" --region "$REGION" --query 'Version' --output text)
# aws lambda update-alias --function-name "$FUNCTION_NAME" --name dev --function-version "$VERSION" --region "$REGION"

echo "Deployed to Lambda function $FUNCTION_NAME in $REGION"

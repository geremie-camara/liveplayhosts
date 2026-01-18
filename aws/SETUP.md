# AWS Infrastructure Setup Guide

This guide walks through setting up the AWS infrastructure for the Live Play Hosts landing page.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   CloudFront    │────▶│       S3        │     │       S3        │
│   (CDN)         │     │  (Static Site)  │     │ (Video Uploads) │
└─────────────────┘     └─────────────────┘     └────────▲────────┘
                                                         │
┌─────────────────┐     ┌─────────────────┐     ┌────────┴────────┐
│   API Gateway   │────▶│     Lambda      │────▶│    DynamoDB     │
│   (REST API)    │     │  (Functions)    │     │  (Applications) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Prerequisites

- AWS CLI installed and configured
- Node.js 18+ installed
- An AWS account with appropriate permissions

## Step 1: Create S3 Buckets

### Static Website Bucket

```bash
# Create bucket for static website
aws s3 mb s3://liveplayhosts-website --region us-east-1

# Enable static website hosting
aws s3 website s3://liveplayhosts-website \
  --index-document index.html \
  --error-document 404.html
```

### Video Uploads Bucket

```bash
# Create bucket for video uploads
aws s3 mb s3://liveplayhosts-uploads --region us-east-1

# Set CORS configuration for direct uploads
aws s3api put-bucket-cors --bucket liveplayhosts-uploads --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "POST", "GET"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}'
```

## Step 2: Create DynamoDB Table

```bash
aws dynamodb create-table \
  --table-name liveplayhosts-applications \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=email,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    '[{
      "IndexName": "email-index",
      "KeySchema": [{"AttributeName": "email", "KeyType": "HASH"}],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
    }]' \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region us-east-1
```

## Step 3: Create IAM Role for Lambda

```bash
# Create the trust policy file
cat > /tmp/lambda-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name liveplayhosts-lambda-role \
  --assume-role-policy-document file:///tmp/lambda-trust-policy.json

# Create the permissions policy
cat > /tmp/lambda-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/liveplayhosts-applications*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::liveplayhosts-uploads/*"
    }
  ]
}
EOF

# Attach the policy to the role
aws iam put-role-policy \
  --role-name liveplayhosts-lambda-role \
  --policy-name liveplayhosts-lambda-policy \
  --policy-document file:///tmp/lambda-policy.json
```

## Step 4: Deploy Lambda Functions

### Package and deploy submit-application

```bash
cd aws/submit-application
npm install
zip -r function.zip .

aws lambda create-function \
  --function-name liveplayhosts-submit-application \
  --runtime nodejs18.x \
  --handler index.handler \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/liveplayhosts-lambda-role \
  --zip-file fileb://function.zip \
  --environment Variables="{TABLE_NAME=liveplayhosts-applications}" \
  --timeout 30 \
  --region us-east-1
```

### Package and deploy get-upload-url

```bash
cd ../get-upload-url
npm install
zip -r function.zip .

aws lambda create-function \
  --function-name liveplayhosts-get-upload-url \
  --runtime nodejs18.x \
  --handler index.handler \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/liveplayhosts-lambda-role \
  --zip-file fileb://function.zip \
  --environment Variables="{BUCKET_NAME=liveplayhosts-uploads}" \
  --timeout 30 \
  --region us-east-1
```

## Step 5: Create API Gateway

```bash
# Create REST API
aws apigateway create-rest-api \
  --name liveplayhosts-api \
  --description "API for Live Play Hosts application" \
  --region us-east-1

# Note the API ID returned, you'll need it for subsequent commands
# Export it: export API_ID=your-api-id
```

### Create /apply endpoint

```bash
# Get the root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[0].id' --output text)

# Create /apply resource
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part apply

# Get the resource ID for /apply
APPLY_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?path==`/apply`].id' --output text)

# Create POST method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $APPLY_ID \
  --http-method POST \
  --authorization-type NONE

# Create OPTIONS method for CORS
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $APPLY_ID \
  --http-method OPTIONS \
  --authorization-type NONE

# Integrate with Lambda
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $APPLY_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:liveplayhosts-submit-application/invocations
```

### Create /upload-url endpoint

```bash
# Create /upload-url resource
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part upload-url

UPLOAD_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?path==`/upload-url`].id' --output text)

# Create GET method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $UPLOAD_ID \
  --http-method GET \
  --authorization-type NONE

# Integrate with Lambda
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $UPLOAD_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:liveplayhosts-get-upload-url/invocations
```

### Grant API Gateway permission to invoke Lambda

```bash
aws lambda add-permission \
  --function-name liveplayhosts-submit-application \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:YOUR_ACCOUNT_ID:$API_ID/*/POST/apply"

aws lambda add-permission \
  --function-name liveplayhosts-get-upload-url \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:YOUR_ACCOUNT_ID:$API_ID/*/GET/upload-url"
```

### Deploy API

```bash
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod

# Your API URL will be:
# https://$API_ID.execute-api.us-east-1.amazonaws.com/prod
```

## Step 6: Create CloudFront Distribution

```bash
# Create the CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name liveplayhosts-website.s3.amazonaws.com \
  --default-root-object index.html
```

For production, configure:
- Custom domain (liveplayhosts.com)
- SSL certificate via ACM
- Custom error pages for SPA routing

## Step 7: Build and Deploy Frontend

```bash
# From project root
cd /path/to/liveplayhosts

# Create .env.local with your API URL
echo "NEXT_PUBLIC_API_URL=https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod" > .env.local

# Install dependencies
npm install

# Build static export
npm run build

# Deploy to S3
aws s3 sync out/ s3://liveplayhosts-website --delete

# Invalidate CloudFront cache (if using CloudFront)
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## Environment Variables Summary

| Variable | Description | Where Used |
|----------|-------------|------------|
| `NEXT_PUBLIC_API_URL` | API Gateway URL | Frontend (.env.local) |
| `TABLE_NAME` | DynamoDB table name | submit-application Lambda |
| `BUCKET_NAME` | S3 bucket for uploads | get-upload-url Lambda |

## Updating Lambda Functions

To update a Lambda function after making changes:

```bash
cd aws/submit-application  # or get-upload-url
rm -f function.zip
zip -r function.zip .

aws lambda update-function-code \
  --function-name liveplayhosts-submit-application \
  --zip-file fileb://function.zip
```

## Monitoring

View Lambda logs:
```bash
aws logs tail /aws/lambda/liveplayhosts-submit-application --follow
```

View DynamoDB items:
```bash
aws dynamodb scan --table-name liveplayhosts-applications
```

## Cleanup

To delete all resources:

```bash
# Delete Lambda functions
aws lambda delete-function --function-name liveplayhosts-submit-application
aws lambda delete-function --function-name liveplayhosts-get-upload-url

# Delete API Gateway
aws apigateway delete-rest-api --rest-api-id $API_ID

# Delete DynamoDB table
aws dynamodb delete-table --table-name liveplayhosts-applications

# Empty and delete S3 buckets
aws s3 rm s3://liveplayhosts-website --recursive
aws s3 rb s3://liveplayhosts-website

aws s3 rm s3://liveplayhosts-uploads --recursive
aws s3 rb s3://liveplayhosts-uploads

# Delete IAM role
aws iam delete-role-policy --role-name liveplayhosts-lambda-role --policy-name liveplayhosts-lambda-policy
aws iam delete-role --role-name liveplayhosts-lambda-role
```

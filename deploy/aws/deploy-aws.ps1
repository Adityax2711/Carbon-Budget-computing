# ==============================================================================
# CarbonGuard Automated AWS Deployment Script (PowerShell)
# ==============================================================================
param (
    [string]$Region = "us-east-1",
    [string]$ProjectName = "carbonguard"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Starting CarbonGuard Cloud Deployment to AWS ($Region)  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check AWS CLI Authentication
Write-Host "`n[1/5] Verifying AWS Identity..." -ForegroundColor Yellow
$caller = aws sts get-caller-identity | ConvertFrom-Json
if (-not $caller) {
    Write-Error "AWS credentials not detected. Run 'aws configure' first."
    exit 1
}
$AccountId = $caller.Account
Write-Host "Authenticated as AWS Account: $AccountId" -ForegroundColor Green

# 2. Authenticate Docker with Amazon ECR
Write-Host "`n[2/5] Logging into Amazon ECR..." -ForegroundColor Yellow
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin "$AccountId.dkr.ecr.$Region.amazonaws.com"

# Create ECR repo if it does not exist
aws ecr describe-repositories --repository-names "$ProjectName-backend" --region $Region 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating ECR repository $ProjectName-backend..."
    aws ecr create-repository --repository-name "$ProjectName-backend" --region $Region
}

# 3. Build & Push Backend Container Image
Write-Host "`n[3/5] Building & Pushing Backend Image..." -ForegroundColor Yellow
$BackendImageTag = "$AccountId.dkr.ecr.$Region.amazonaws.com/$ProjectName-backend:latest"
docker build -t "$ProjectName-backend:latest" ./backend
docker tag "$ProjectName-backend:latest" $BackendImageTag
docker push $BackendImageTag
Write-Host "Pushed backend image: $BackendImageTag" -ForegroundColor Green

# 4. Build Frontend Distribution
Write-Host "`n[4/5] Building Frontend Production Assets..." -ForegroundColor Yellow
Set-Location ./frontend
npm run build
Set-Location ..

# 5. Provision AWS App Runner or ECS
Write-Host "`n[5/5] Deployment Instructions..." -ForegroundColor Cyan
Write-Host @"
Backend container is ready in Amazon ECR!
To launch using Terraform:
  cd deploy/aws
  terraform init
  terraform apply

To run locally with Docker Compose:
  docker compose up --build
"@ -ForegroundColor White

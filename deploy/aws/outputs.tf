output "ecr_backend_url" {
  description = "ECR Repository URL for Backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "rds_postgres_endpoint" {
  description = "PostgreSQL Host Endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "frontend_s3_bucket" {
  description = "S3 Bucket Name for Frontend"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront HTTPS Distribution Domain for Dashboard"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

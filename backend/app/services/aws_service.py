import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

logger = logging.getLogger("carbonguard.aws")

class AWSCloudBridge:
    def __init__(self):
        self.region = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
        self.namespace = "CarbonGuard/CloudWorkloads"
        self.is_live_aws = bool(os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("AWS_PROFILE"))
        
        # Boto3 clients initialized lazily
        self._cloudwatch = None
        self._sns = None
        self._ecs = None

    def _get_cloudwatch_client(self):
        if self._cloudwatch is None:
            try:
                import boto3
                self._cloudwatch = boto3.client("cloudwatch", region_name=self.region)
            except Exception as e:
                logger.warning(f"Failed to initialize AWS CloudWatch client: {e}")
        return self._cloudwatch

    def _get_sns_client(self):
        if self._sns is None:
            try:
                import boto3
                self._sns = boto3.client("sns", region_name=self.region)
            except Exception as e:
                logger.warning(f"Failed to initialize AWS SNS client: {e}")
        return self._sns

    def publish_carbon_metric(self, app_id: str, carbon_g: float, burn_percent: float, region: str):
        """
        Pushes real-time emissions and budget utilization to AWS CloudWatch Metrics.
        """
        metric_data = [
            {
                "MetricName": "EmissionsGenerated",
                "Dimensions": [
                    {"Name": "ApplicationId", "Value": app_id},
                    {"Name": "CloudRegion", "Value": region}
                ],
                "Timestamp": datetime.now(timezone.utc),
                "Value": carbon_g,
                "Unit": "None"
            },
            {
                "MetricName": "BudgetUtilizationPercent",
                "Dimensions": [
                    {"Name": "ApplicationId", "Value": app_id}
                ],
                "Timestamp": datetime.now(timezone.utc),
                "Value": burn_percent,
                "Unit": "Percent"
            }
        ]

        cw = self._get_cloudwatch_client()
        if cw:
            try:
                cw.put_metric_data(Namespace=self.namespace, MetricData=metric_data)
                logger.info(f"Published CloudWatch metrics for {app_id} (Emissions: {carbon_g:.2f}g, Burn: {burn_percent:.1f}%)")
                return {"status": "published_to_aws", "namespace": self.namespace}
            except Exception as e:
                logger.warning(f"[AWS CloudWatch Bridge] Fallback mode: {e}")

        # Local simulation fallback log
        return {
            "status": "simulated_local",
            "message": f"CloudWatch Metric dispatched: {carbon_g:.2f}g to {self.namespace}"
        }

    def dispatch_budget_alert(self, app_id: str, alert_level: str, message: str, topic_arn: Optional[str] = None):
        """
        Dispatches an emergency notification to Amazon SNS (SMS / Email / Slack PagerDuty integration).
        """
        sns = self._get_sns_client()
        subject = f"[CarbonGuard Alert] {alert_level}: Carbon Budget Quota Reached for {app_id}"

        if sns and topic_arn:
            try:
                sns.publish(
                    TopicArn=topic_arn,
                    Subject=subject,
                    Message=message
                )
                logger.info(f"Dispatched SNS Alert for {app_id}: {subject}")
                return {"status": "sns_dispatched", "topic_arn": topic_arn}
            except Exception as e:
                logger.warning(f"[AWS SNS Bridge] Fallback: {e}")

        return {
            "status": "simulated_local",
            "alert": alert_level,
            "subject": subject,
            "message": message
        }

    def pause_ecs_fargate_task(self, cluster_name: str, service_name: str):
        """
        Directly controls Amazon ECS Fargate container workloads:
        Scales desired count to 0 to safely halt compute when carbon allowance is exhausted.
        """
        try:
            import boto3
            ecs = boto3.client("ecs", region_name=self.region)
            response = ecs.update_service(
                cluster=cluster_name,
                service=service_name,
                desiredCount=0
            )
            return {"status": "ecs_paused", "desiredCount": 0, "service": service_name}
        except Exception as e:
            return {
                "status": "simulated_ecs_pause",
                "cluster": cluster_name,
                "service": service_name,
                "desiredCount": 0,
                "note": f"Simulated container scale-down: {e}"
            }

aws_bridge = AWSCloudBridge()

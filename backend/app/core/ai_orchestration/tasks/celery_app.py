"""
Intelli Platform -- Celery Configuration
Feature: AI-7.2-celery

Celery app setup for asynchronous agent task dispatch.
NOTE: Redis broker has been removed. Set CELERY_BROKER_URL env var to a valid broker before running workers.
"""
from celery import Celery

from app.config import settings

# Create Celery app
celery_app = Celery(
    "intelli_agents",
    broker=getattr(settings, "CELERY_BROKER_URL", ""),
    backend=getattr(settings, "CELERY_RESULT_BACKEND", ""),
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    result_expires=3600,  # Results expire after 1 hour
    task_acks_late=True,  # Don't ack until task completes
)

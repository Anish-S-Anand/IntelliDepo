"""
MacroPulse Celery app configuration.
NOTE: Redis broker has been removed. Set CELERY_BROKER_URL env var to a valid broker before running workers.
"""
import os

from celery import Celery


celery_app = Celery(
    "macropulse",
    broker=os.getenv("CELERY_BROKER_URL", ""),
    backend=os.getenv("CELERY_RESULT_BACKEND", ""),
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
)

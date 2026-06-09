"""
CipherVault — Celery Application
Configures Celery with Redis broker and periodic beat schedule.
"""
import os
from celery import Celery
from celery.schedules import crontab

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")

app = Celery(
    "ciphervault",
    broker=os.getenv("CELERY_BROKER_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}/1"),
    backend=os.getenv("CELERY_RESULT_BACKEND", f"redis://{REDIS_HOST}:{REDIS_PORT}/2"),
    include=["tasks"],
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# ── Periodic Tasks (Beat Schedule) ──────────────────────────────────────────
app.conf.beat_schedule = {
    "cleanup-expired-files": {
        "task": "tasks.cleanup_expired_files",
        "schedule": crontab(minute="*/10"),  # Run every 10 minutes
    },
    "detect-suspicious-activity": {
        "task": "tasks.detect_suspicious_activity",
        "schedule": crontab(minute="*/5"),  # Run every 5 minutes
    },
}

"""
CipherVault — Audit Service
Tracks all system events, detects suspicious activity, and manages security alerts.
"""
import sys
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, "/app")  # Docker fallback

from fastapi import FastAPI, HTTPException, Depends, Request, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from contextlib import asynccontextmanager
from prometheus_fastapi_instrumentator import Instrumentator

from shared.database import get_db, init_db
from shared.models import AuditLog, SecurityEvent
from shared.logging_config import get_logger

logger = get_logger("audit-service")

# Thresholds for suspicious activity detection
FAILED_LOGIN_THRESHOLD = 5
FAILED_PASSWORD_THRESHOLD = 10
UNUSUAL_DOWNLOAD_THRESHOLD = 20
DETECTION_WINDOW_MINUTES = 15


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("Audit Service started")
    yield


app = FastAPI(title="CipherVault Audit Service", version="1.0.0", lifespan=lifespan)
Instrumentator().instrument(app).expose(app, include_in_schema=False)


# ── Request Models ──────────────────────────────────────────────────────────

class AuditLogRequest(BaseModel):
    user_id: Optional[str] = None
    action: str  # e.g. "file_upload", "file_download", "login_failed", etc.
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: dict = {}
    severity: str = "info"


class SecurityEventRequest(BaseModel):
    user_id: Optional[str] = None
    event_type: str
    ip_address: Optional[str] = None
    details: dict = {}


# ── Audit Log Endpoints ────────────────────────────────────────────────────

@app.post("/audit/log", status_code=201)
async def create_audit_log(body: AuditLogRequest, db: AsyncSession = Depends(get_db)):
    """Record an audit log entry."""
    log = AuditLog(
        user_id=body.user_id,
        action=body.action,
        resource_type=body.resource_type,
        resource_id=body.resource_id,
        ip_address=body.ip_address,
        user_agent=body.user_agent,
        details=body.details,
        severity=body.severity,
    )
    db.add(log)
    await db.flush()

    # Check for suspicious patterns after logging
    await _check_suspicious_activity(db, body)

    logger.info(f"Audit log: {body.action} by user {body.user_id}")
    return {"id": str(log.id), "action": body.action, "recorded": True}


@app.get("/audit/logs")
async def get_audit_logs(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve audit logs with optional filters."""
    query = select(AuditLog).order_by(AuditLog.created_at.desc())

    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
    if severity:
        query = query.where(AuditLog.severity == severity)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return [
        {
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": str(log.resource_id) if log.resource_id else None,
            "ip_address": log.ip_address,
            "details": log.details,
            "severity": log.severity,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


# ── Security Events ─────────────────────────────────────────────────────────

@app.post("/audit/security-event", status_code=201)
async def create_security_event(body: SecurityEventRequest, db: AsyncSession = Depends(get_db)):
    """Record a security event / alert."""
    event = SecurityEvent(
        user_id=body.user_id,
        event_type=body.event_type,
        ip_address=body.ip_address,
        details=body.details,
    )
    db.add(event)
    await db.flush()
    logger.warning(f"Security event: {body.event_type} — user {body.user_id}, IP {body.ip_address}")
    return {"id": str(event.id), "event_type": body.event_type}


@app.get("/audit/security-events")
async def get_security_events(
    resolved: Optional[bool] = None,
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve security events."""
    query = select(SecurityEvent).order_by(SecurityEvent.created_at.desc())
    if resolved is not None:
        query = query.where(SecurityEvent.is_resolved == resolved)
    query = query.limit(limit)

    result = await db.execute(query)
    events = result.scalars().all()

    return [
        {
            "id": str(e.id),
            "user_id": str(e.user_id) if e.user_id else None,
            "event_type": e.event_type,
            "ip_address": e.ip_address,
            "details": e.details,
            "is_resolved": e.is_resolved,
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]


@app.get("/audit/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Dashboard statistics."""
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)

    # Total logs last 24h
    total_result = await db.execute(
        select(func.count(AuditLog.id)).where(AuditLog.created_at >= last_24h)
    )
    total_logs = total_result.scalar() or 0

    # Security events last 24h
    events_result = await db.execute(
        select(func.count(SecurityEvent.id)).where(SecurityEvent.created_at >= last_24h)
    )
    total_events = events_result.scalar() or 0

    # Unresolved events
    unresolved_result = await db.execute(
        select(func.count(SecurityEvent.id)).where(SecurityEvent.is_resolved == False)
    )
    unresolved = unresolved_result.scalar() or 0

    return {
        "logs_last_24h": total_logs,
        "security_events_last_24h": total_events,
        "unresolved_events": unresolved,
    }


# ── Suspicious Activity Detection ──────────────────────────────────────────

async def _check_suspicious_activity(db: AsyncSession, log: AuditLogRequest):
    """Detect suspicious patterns and create security events if needed."""
    window = datetime.now(timezone.utc) - timedelta(minutes=DETECTION_WINDOW_MINUTES)

    # Check for repeated failed logins
    if log.action == "login_failed" and log.ip_address:
        result = await db.execute(
            select(func.count(AuditLog.id)).where(
                and_(
                    AuditLog.action == "login_failed",
                    AuditLog.ip_address == log.ip_address,
                    AuditLog.created_at >= window,
                )
            )
        )
        count = result.scalar() or 0
        if count >= FAILED_LOGIN_THRESHOLD:
            event = SecurityEvent(
                user_id=log.user_id,
                event_type="brute_force_login",
                ip_address=log.ip_address,
                details={
                    "failed_attempts": count,
                    "window_minutes": DETECTION_WINDOW_MINUTES,
                    "description": f"Detected {count} failed login attempts from IP {log.ip_address}",
                },
            )
            db.add(event)
            logger.critical(f"BRUTE FORCE DETECTED: {count} failed logins from {log.ip_address}")

    # Check for excessive password guesses
    if log.action == "password_attempt_failed" and log.user_id:
        result = await db.execute(
            select(func.count(AuditLog.id)).where(
                and_(
                    AuditLog.action == "password_attempt_failed",
                    AuditLog.user_id == log.user_id,
                    AuditLog.created_at >= window,
                )
            )
        )
        count = result.scalar() or 0
        if count >= FAILED_PASSWORD_THRESHOLD:
            event = SecurityEvent(
                user_id=log.user_id,
                event_type="excessive_password_guesses",
                ip_address=log.ip_address,
                details={
                    "failed_attempts": count,
                    "description": f"User attempted {count} wrong passwords in {DETECTION_WINDOW_MINUTES} minutes",
                },
            )
            db.add(event)
            logger.critical(f"EXCESSIVE PASSWORD GUESSES: user {log.user_id}")

    # Check for unusual download patterns
    if log.action == "file_download" and log.user_id:
        result = await db.execute(
            select(func.count(AuditLog.id)).where(
                and_(
                    AuditLog.action == "file_download",
                    AuditLog.user_id == log.user_id,
                    AuditLog.created_at >= window,
                )
            )
        )
        count = result.scalar() or 0
        if count >= UNUSUAL_DOWNLOAD_THRESHOLD:
            event = SecurityEvent(
                user_id=log.user_id,
                event_type="unusual_download_pattern",
                ip_address=log.ip_address,
                details={
                    "download_count": count,
                    "description": f"User downloaded {count} files in {DETECTION_WINDOW_MINUTES} minutes",
                },
            )
            db.add(event)
            logger.warning(f"UNUSUAL DOWNLOAD PATTERN: user {log.user_id}")


@app.get("/audit/health")
async def health():
    return {"status": "healthy", "service": "audit-service"}

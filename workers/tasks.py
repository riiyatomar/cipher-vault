"""
CipherVault — Celery Tasks
Background tasks for file expiration cleanup and suspicious activity detection.
"""
import os
import logging
from datetime import datetime, timezone
from sqlalchemy import create_engine, text
from celery_app import app

logger = logging.getLogger("ciphervault.workers")

# Synchronous database connection for Celery workers
DB_USER = os.getenv("POSTGRES_USER", "ciphervault")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "password")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "ciphervault")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./storage/uploads")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL, pool_pre_ping=True)


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def cleanup_expired_files(self):
    """
    Find and delete expired documents.
    - Mark documents as 'expired'
    - Delete encrypted files from storage
    - Log the cleanup
    """
    try:
        with engine.connect() as conn:
            # Find expired active documents
            result = conn.execute(text("""
                SELECT id, stored_filename, user_id
                FROM documents
                WHERE status = 'active'
                  AND expiry_time < NOW()
            """))
            expired_docs = result.fetchall()

            deleted_count = 0
            for doc in expired_docs:
                doc_id, stored_filename, user_id = doc

                # Delete the encrypted file
                file_path = os.path.join(UPLOAD_DIR, stored_filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"Deleted expired file: {stored_filename}")

                # Mark document as expired
                conn.execute(text("""
                    UPDATE documents SET status = 'expired' WHERE id = :doc_id
                """), {"doc_id": doc_id})

                # Create audit log
                conn.execute(text("""
                    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, severity)
                    VALUES (:user_id, 'file_expired', 'document', :doc_id,
                            '{"reason": "automatic_expiration"}'::jsonb, 'info')
                """), {"user_id": user_id, "doc_id": doc_id})

                deleted_count += 1

            conn.commit()
            logger.info(f"Cleanup completed: {deleted_count} expired files removed")
            return {"deleted": deleted_count}

    except Exception as exc:
        logger.error(f"Cleanup task failed: {exc}")
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=30)
def detect_suspicious_activity(self):
    """
    Scan recent audit logs for suspicious patterns and create security events.
    """
    try:
        with engine.connect() as conn:
            # Detect IPs with many failed login attempts (last 15 min)
            result = conn.execute(text("""
                SELECT ip_address, COUNT(*) as attempt_count
                FROM audit_logs
                WHERE action = 'login_failed'
                  AND created_at > NOW() - INTERVAL '15 minutes'
                GROUP BY ip_address
                HAVING COUNT(*) >= 5
            """))
            suspicious_ips = result.fetchall()

            events_created = 0
            for ip, count in suspicious_ips:
                # Check if already flagged recently
                existing = conn.execute(text("""
                    SELECT id FROM security_events
                    WHERE event_type = 'brute_force_login'
                      AND ip_address = :ip
                      AND created_at > NOW() - INTERVAL '30 minutes'
                      AND is_resolved = FALSE
                    LIMIT 1
                """), {"ip": ip}).fetchone()

                if not existing:
                    conn.execute(text("""
                        INSERT INTO security_events (event_type, ip_address, details)
                        VALUES ('brute_force_login', :ip,
                                jsonb_build_object(
                                    'failed_attempts', :count,
                                    'detection_method', 'periodic_scan'
                                ))
                    """), {"ip": ip, "count": count})
                    events_created += 1
                    logger.warning(f"Brute force detected from IP: {ip} ({count} attempts)")

            conn.commit()
            logger.info(f"Security scan completed: {events_created} new events")
            return {"new_events": events_created}

    except Exception as exc:
        logger.error(f"Security scan failed: {exc}")
        raise self.retry(exc=exc)

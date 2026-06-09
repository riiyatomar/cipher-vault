"""
CipherVault — Storage Service
Handles encrypted file persistence, signed download URLs, and file integrity checks.
"""
import sys
import os
import time
import hashlib
import hmac
import base64

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, "/app")  # Docker fallback

from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.responses import Response
from contextlib import asynccontextmanager
from prometheus_fastapi_instrumentator import Instrumentator

from shared.logging_config import get_logger

logger = get_logger("storage-service")

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./storage/uploads")
JWT_SECRET = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-me")
DOWNLOAD_TOKEN_EXPIRY = 300  # 5 minutes


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    logger.info("Storage Service started")
    yield


app = FastAPI(title="CipherVault Storage Service", version="1.0.0", lifespan=lifespan)
Instrumentator().instrument(app).expose(app, include_in_schema=False)


def generate_download_token(file_id: str) -> str:
    """Generate a signed, time-limited download token."""
    expiry = int(time.time()) + DOWNLOAD_TOKEN_EXPIRY
    message = f"{file_id}:{expiry}"
    signature = hmac.new(
        JWT_SECRET.encode(), message.encode(), hashlib.sha256
    ).hexdigest()
    token = base64.urlsafe_b64encode(f"{message}:{signature}".encode()).decode()
    return token


def verify_download_token(token: str) -> str:
    """
    Verify a signed download token.
    Returns file_id if valid, raises HTTPException otherwise.
    """
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        parts = decoded.split(":")
        if len(parts) != 3:
            raise ValueError("Invalid token format")
        file_id, expiry_str, signature = parts
        expiry = int(expiry_str)

        # Check expiry
        if time.time() > expiry:
            raise HTTPException(status_code=410, detail="Download link has expired")

        # Verify signature
        message = f"{file_id}:{expiry_str}"
        expected_sig = hmac.new(
            JWT_SECRET.encode(), message.encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            raise HTTPException(status_code=403, detail="Invalid download token")

        return file_id
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed download token")


@app.post("/storage/store")
async def store_file(file: UploadFile = File(...), filename: str = ""):
    """Store an encrypted file."""
    if not filename:
        filename = file.filename or "unknown"

    content = await file.read()
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(content)

    file_hash = hashlib.sha256(content).hexdigest()
    logger.info(f"File stored: {filename} ({len(content)} bytes)")

    return {
        "filename": filename,
        "size": len(content),
        "hash": file_hash,
    }


@app.get("/storage/generate-link/{file_id}")
async def generate_link(file_id: str):
    """Generate a signed temporary download link."""
    token = generate_download_token(file_id)
    return {
        "download_url": f"/storage/download/{token}",
        "expires_in_seconds": DOWNLOAD_TOKEN_EXPIRY,
    }


@app.get("/storage/download/{token}")
async def download_file(token: str):
    """Download a file using a signed token."""
    file_id = verify_download_token(token)

    # Find file in storage
    matching = [f for f in os.listdir(UPLOAD_DIR) if f.startswith(file_id)]
    if not matching:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = os.path.join(UPLOAD_DIR, matching[0])
    with open(file_path, "rb") as f:
        content = f.read()

    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{matching[0]}"'},
    )


@app.get("/storage/verify/{filename}")
async def verify_integrity(filename: str, expected_hash: str = ""):
    """Verify file integrity by comparing SHA-256 hash."""
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    with open(file_path, "rb") as f:
        current_hash = hashlib.sha256(f.read()).hexdigest()

    is_valid = current_hash == expected_hash if expected_hash else True

    return {
        "filename": filename,
        "hash": current_hash,
        "expected_hash": expected_hash,
        "integrity_valid": is_valid,
    }


@app.delete("/storage/delete/{filename}")
async def delete_file(filename: str):
    """Delete a file from storage."""
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        logger.info(f"File deleted: {filename}")
        return {"message": "File deleted"}
    raise HTTPException(status_code=404, detail="File not found")


@app.get("/storage/health")
async def health():
    return {"status": "healthy", "service": "storage-service"}

"""
CipherVault — Document Service
Handles file uploads, metadata management, and document lifecycle.
"""
import sys
import os
import uuid
import hashlib
import time
import base64
import io
import tempfile
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, "/app")  # Docker fallback

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from contextlib import asynccontextmanager
from prometheus_fastapi_instrumentator import Instrumentator
import httpx
import jwt

from shared.database import get_db, init_db
from shared.models import Document
from shared.logging_config import get_logger

logger = get_logger("document-service")

JWT_SECRET = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "20")) * 1024 * 1024
FILE_EXPIRY_HOURS = int(os.getenv("FILE_EXPIRY_HOURS", "24"))
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./storage/uploads")
ALLOWED_MIME_TYPES = {
    "application/pdf", "image/jpeg", "image/png", "image/jpg"
}
STORAGE_SERVICE_URL = os.getenv("STORAGE_SERVICE_URL", "http://localhost:8004")


def get_user_from_request(request: Request) -> str:
    """Extract user_id from JWT in Authorization header."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = jwt.decode(auth.split(" ")[1], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    await init_db()
    logger.info("Document Service started")
    yield


app = FastAPI(title="CipherVault Document Service", version="1.0.0", lifespan=lifespan)
Instrumentator().instrument(app).expose(app, include_in_schema=False)


@app.get("/documents/health")
async def health():
    return {"status": "healthy", "service": "document-service"}


@app.post("/documents/upload", status_code=201)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    password: str = Form(None),
    salt: str = Form(""),
    iv: str = Form(""),
    file_hash: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """Upload an encrypted document."""
    user_id = get_user_from_request(request)

    # Validate MIME type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    # Apply native file password protection if password provided
    if password:
        try:
            import pikepdf
            try:
                if content_type.startswith("image/"):
                    from PIL import Image
                    image = Image.open(io.BytesIO(content))
                    # Convert to RGB if it's RGBA (PDFs don't support RGBA directly via PIL save)
                    if image.mode == 'RGBA':
                        image = image.convert('RGB')
                    pdf_buf = io.BytesIO()
                    image.save(pdf_buf, format="PDF")
                    content = pdf_buf.getvalue()
                    logger.info("Image converted to PDF for native password protection.")
            except Exception as e:
                logger.error(f"Image to PDF conversion failed: {e}")
                pass # Fallback to trying to treat as PDF anyway or fail in pikepdf

            # Apply PDF password protection using pikepdf
            src_pdf = pikepdf.open(io.BytesIO(content))
            buf = io.BytesIO()
            src_pdf.save(
                buf,
                encryption=pikepdf.Encryption(
                    owner=password,
                    user=password,
                ),
            )
            content = buf.getvalue()
            src_pdf.close()
            logger.info("PDF password protection applied.")
            
            salt = "protected"
            iv = "native"
        except Exception as e:
            logger.error(f"Password protection failed: {e}")
            raise HTTPException(status_code=500, detail=f"Password protection failed: {str(e)}")

    # Generate file hash if not provided (client should provide for integrity)
    if not file_hash:
        file_hash = hashlib.sha256(content).hexdigest()

    # Generate unique stored filename
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename or "file")[1]
    stored_filename = f"{file_id}{ext}.enc"

    # Save encrypted file to storage
    file_path = os.path.join(UPLOAD_DIR, stored_filename)
    with open(file_path, "wb") as f:
        f.write(content)

    # Create document record
    doc = Document(
        id=file_id,
        user_id=str(user_id),
        original_filename=file.filename or "unnamed",
        stored_filename=stored_filename,
        file_hash=file_hash,
        file_size=len(content),
        mime_type=content_type,
        salt=salt,
        iv=iv,
        expiry_time=datetime.now(timezone.utc) + timedelta(hours=FILE_EXPIRY_HOURS),
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)

    logger.info(f"Document uploaded: {file_id} by user {user_id}")

    return {
        "id": str(doc.id),
        "filename": doc.original_filename,
        "file_size": doc.file_size,
        "mime_type": doc.mime_type,
        "file_hash": doc.file_hash,
        "upload_time": doc.upload_time.isoformat(),
        "expiry_time": doc.expiry_time.isoformat(),
        "status": doc.status,
    }


@app.get("/documents/list")
async def list_documents(request: Request, db: AsyncSession = Depends(get_db)):
    """List all documents for the authenticated user."""
    user_id = get_user_from_request(request)

    result = await db.execute(
        select(Document)
        .where(Document.user_id == user_id)
        .where(Document.status == "active")
        .order_by(Document.upload_time.desc())
    )
    docs = result.scalars().all()

    return [
        {
            "id": str(d.id),
            "filename": d.original_filename,
            "file_size": d.file_size,
            "mime_type": d.mime_type,
            "upload_time": d.upload_time.isoformat(),
            "expiry_time": d.expiry_time.isoformat(),
            "status": d.status,
            "download_count": d.download_count,
            "encryption_algorithm": d.encryption_algorithm,
        }
        for d in docs
    ]


@app.get("/documents/{document_id}")
async def get_document(document_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Get document metadata."""
    user_id = get_user_from_request(request)

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "id": str(doc.id),
        "filename": doc.original_filename,
        "file_size": doc.file_size,
        "mime_type": doc.mime_type,
        "file_hash": doc.file_hash,
        "salt": doc.salt,
        "iv": doc.iv,
        "upload_time": doc.upload_time.isoformat(),
        "expiry_time": doc.expiry_time.isoformat(),
        "status": doc.status,
        "download_count": doc.download_count,
        "encryption_algorithm": doc.encryption_algorithm,
    }


@app.get("/documents/{document_id}/download")
async def download_document(document_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Get encrypted file content for download."""
    user_id = get_user_from_request(request)

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.status != "active":
        raise HTTPException(status_code=410, detail="Document has expired or been deleted")

    # Check expiry (use naive UTC for SQLite compatibility)
    if doc.expiry_time.replace(tzinfo=None) < datetime.utcnow():
        doc.status = "expired"
        await db.flush()
        raise HTTPException(status_code=410, detail="Document has expired")

    # Read encrypted file
    file_path = os.path.join(UPLOAD_DIR, doc.stored_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on storage")

    # Verify integrity
    with open(file_path, "rb") as f:
        content = f.read()

    current_hash = hashlib.sha256(content).hexdigest()
    if current_hash != doc.file_hash:
        doc.status = "tampered"
        await db.flush()
        logger.critical(f"TAMPERING DETECTED: Document {document_id}")
        raise HTTPException(status_code=409, detail="File integrity check failed — possible tampering detected")

    # Update download count
    doc.download_count += 1
    await db.flush()

    from fastapi.responses import Response

    # Determine filename and content type
    is_protected = doc.salt == "protected"
    if is_protected and not doc.original_filename.lower().endswith(".pdf"):
        # Image was converted to password-protected PDF
        filename = os.path.splitext(doc.original_filename)[0] + ".pdf"
        media_type = "application/pdf"
    else:
        filename = doc.original_filename
        media_type = doc.mime_type or "application/octet-stream"

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-File-Hash": doc.file_hash,
        }
    )


@app.delete("/documents/{document_id}")
async def delete_document(document_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Delete a document."""
    user_id = get_user_from_request(request)

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file from storage
    file_path = os.path.join(UPLOAD_DIR, doc.stored_filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    doc.status = "deleted"
    await db.flush()

    logger.info(f"Document deleted: {document_id} by user {user_id}")
    return {"message": "Document deleted successfully"}




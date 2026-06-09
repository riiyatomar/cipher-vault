"""
CipherVault — Encryption Service
Provides encryption/decryption endpoints, key management, and PDF protection.
"""
import sys
import os
import base64

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, "/app")  # Docker fallback

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Tuple
from contextlib import asynccontextmanager
from prometheus_fastapi_instrumentator import Instrumentator

from shared.logging_config import get_logger
from envelope import encrypt_file_data, decrypt_file_data, encrypt_dek, decrypt_dek, generate_dek
from shamir import split_secret, combine_shares
from pdf_protection import protect_pdf, remove_pdf_protection

logger = get_logger("encryption-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Encryption Service started")
    yield


app = FastAPI(title="CipherVault Encryption Service", version="1.0.0", lifespan=lifespan)
Instrumentator().instrument(app).expose(app, include_in_schema=False)


# ── Request/Response Models ─────────────────────────────────────────────────

class EncryptRequest(BaseModel):
    data_b64: str
    password: str


class DecryptRequest(BaseModel):
    ciphertext_b64: str
    data_nonce_b64: str
    encrypted_dek_b64: str
    dek_nonce_b64: str


class ShamirSplitRequest(BaseModel):
    secret_b64: str
    total_shares: int = 5
    threshold: int = 3


class ShamirCombineRequest(BaseModel):
    shares: List[List]  # [[index, hex_str], ...]


class PDFProtectRequest(BaseModel):
    pdf_data_b64: str
    user_password: str
    owner_password: Optional[str] = None


class PDFUnprotectRequest(BaseModel):
    pdf_data_b64: str
    password: str


class GenerateKeyResponse(BaseModel):
    encrypted_dek: str
    dek_nonce: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/encryption/encrypt")
async def encrypt(req: EncryptRequest):
    """Encrypt data using envelope encryption."""
    try:
        data = base64.b64decode(req.data_b64)
        result = encrypt_file_data(data, req.password)
        logger.info("Data encrypted successfully")
        return result
    except Exception as e:
        logger.error(f"Encryption failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Encryption failed: {str(e)}")


@app.post("/encryption/decrypt")
async def decrypt(req: DecryptRequest):
    """Decrypt data using envelope decryption."""
    try:
        plaintext = decrypt_file_data(
            req.ciphertext_b64,
            req.data_nonce_b64,
            req.encrypted_dek_b64,
            req.dek_nonce_b64,
        )
        return {"data_b64": base64.b64encode(plaintext).decode()}
    except Exception as e:
        logger.error(f"Decryption failed: {str(e)}")
        raise HTTPException(status_code=400, detail="Decryption failed — invalid key or corrupted data")


@app.post("/encryption/generate-key")
async def generate_key():
    """Generate a new DEK encrypted with the master key."""
    try:
        dek = generate_dek()
        encrypted_dek_b64, nonce_b64 = encrypt_dek(dek)
        return GenerateKeyResponse(encrypted_dek=encrypted_dek_b64, dek_nonce=nonce_b64)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Key generation failed: {str(e)}")


@app.post("/encryption/shamir/split")
async def shamir_split(req: ShamirSplitRequest):
    """Split a secret into Shamir shares."""
    try:
        secret = base64.b64decode(req.secret_b64)
        shares = split_secret(secret, req.total_shares, req.threshold)
        return {
            "shares": shares,
            "total": req.total_shares,
            "threshold": req.threshold,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Secret splitting failed: {str(e)}")


@app.post("/encryption/shamir/combine")
async def shamir_combine(req: ShamirCombineRequest):
    """Reconstruct a secret from Shamir shares."""
    try:
        shares = [(s[0], s[1]) for s in req.shares]
        secret = combine_shares(shares)
        return {"secret_b64": base64.b64encode(secret).decode()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Secret reconstruction failed: {str(e)}")


@app.post("/encryption/pdf/protect")
async def pdf_protect(req: PDFProtectRequest):
    """Apply PDF-level protection."""
    try:
        pdf_data = base64.b64decode(req.pdf_data_b64)
        protected = protect_pdf(pdf_data, req.user_password, req.owner_password)
        return {"protected_pdf_b64": base64.b64encode(protected).decode()}
    except Exception as e:
        logger.error(f"PDF protection failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF protection failed: {str(e)}")


@app.post("/encryption/pdf/unprotect")
async def pdf_unprotect(req: PDFUnprotectRequest):
    """Remove PDF protection."""
    try:
        pdf_data = base64.b64decode(req.pdf_data_b64)
        unprotected = remove_pdf_protection(pdf_data, req.password)
        return {"pdf_data_b64": base64.b64encode(unprotected).decode()}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Failed to remove PDF protection — wrong password?")


@app.get("/encryption/health")
async def health():
    return {"status": "healthy", "service": "encryption-service"}

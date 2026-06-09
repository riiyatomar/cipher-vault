"""
CipherVault — Auth Service
Handles user registration, login, JWT tokens, and role-based access.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, "/app")  # Docker fallback

from fastapi import FastAPI, HTTPException, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from contextlib import asynccontextmanager
from prometheus_fastapi_instrumentator import Instrumentator

from shared.database import get_db, init_db
from shared.models import User
from shared.logging_config import get_logger
from schemas import (
    UserRegisterRequest, UserLoginRequest, TokenResponse,
    UserResponse, TokenRefreshRequest
)
from security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token
)

logger = get_logger("auth-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Auth Service starting up")
    await init_db()
    yield
    logger.info("Auth Service shutting down")


app = FastAPI(
    title="CipherVault Auth Service",
    version="1.0.0",
    lifespan=lifespan,
)

Instrumentator().instrument(app).expose(app, include_in_schema=False)


# ── Register ─────────────────────────────────────────────────────────────────
@app.post("/auth/register", response_model=UserResponse, status_code=201)
async def register(body: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user."""
    # Check if email exists
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Check if username exists
    result = await db.execute(select(User).where(User.username == body.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already taken")

    user = User(
        email=body.email,
        username=body.username,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    logger.info(f"New user registered: {user.email}")
    return user


# ── Login ────────────────────────────────────────────────────────────────────
@app.post("/auth/login", response_model=TokenResponse)
async def login(body: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    """Login and receive JWT tokens."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        logger.warning(f"Failed login attempt for: {body.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    access_token = create_access_token(str(user.id), user.role)
    refresh_token = create_refresh_token(str(user.id))

    logger.info(f"User logged in: {user.email}")
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30")) * 60,
    )


# ── Refresh Token ────────────────────────────────────────────────────────────
@app.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token(body: TokenRefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh token."""
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    access_token = create_access_token(str(user.id), user.role)
    refresh_token = create_refresh_token(str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30")) * 60,
    )


# ── Get Current User ────────────────────────────────────────────────────────
@app.get("/auth/me", response_model=UserResponse)
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    """Get current authenticated user profile."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    payload = decode_token(auth_header.split(" ")[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


# ── Validate Token (internal) ───────────────────────────────────────────────
@app.post("/auth/validate")
async def validate_token(request: Request):
    """Validate a JWT token (used internally by API Gateway)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    payload = decode_token(auth_header.split(" ")[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    return {"valid": True, "user_id": payload["sub"], "role": payload.get("role", "user")}


# ── Health Check ─────────────────────────────────────────────────────────────
@app.get("/auth/health")
async def health():
    return {"status": "healthy", "service": "auth-service"}

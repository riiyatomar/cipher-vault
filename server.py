"""
CipherVault — Unified Production Server
Runs all microservices in a single process for cost-effective deployment.

Instead of running 6 separate services + API gateway, this loads each
service's FastAPI app, extracts its routes, and re-registers them under
/api/* on a single unified app. The gateway logic (JWT auth, CORS, rate
limiting) is applied as middleware.

Usage (Render / production):
  gunicorn server:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT

Usage (local testing):
  uvicorn server:app --host 0.0.0.0 --port 8000
"""
import os
import sys
import time
import importlib.util

# ── Path setup ─────────────────────────────────────────────────────────────
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICES_DIR = os.path.join(PROJECT_DIR, "services")

# Add service directories so their local imports (schemas, security, etc.) work
for svc_dir in [
    "auth-service", "document-service", "encryption-service",
    "storage-service", "audit-service",
]:
    sys.path.insert(0, os.path.join(SERVICES_DIR, svc_dir))

# Add services/ root for shared module
sys.path.insert(0, SERVICES_DIR)

# Set env defaults for production
os.environ.setdefault("UPLOAD_DIR", os.path.join(PROJECT_DIR, "storage", "uploads"))
os.makedirs(os.environ["UPLOAD_DIR"], exist_ok=True)

# ── Imports ────────────────────────────────────────────────────────────────
import jwt as pyjwt
import redis.asyncio as aioredis
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from prometheus_fastapi_instrumentator import Instrumentator

from shared.database import init_db
from shared.logging_config import get_logger

logger = get_logger("ciphervault")

# ── Configuration ──────────────────────────────────────────────────────────
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
JWT_SECRET = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
REDIS_URL = os.getenv("REDIS_URL", "")
SKIP_REDIS = os.getenv("SKIP_REDIS", "true").lower() == "true"
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "30"))
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

# Public routes that skip JWT validation
PUBLIC_ROUTES = {
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
    "/api/health",
}

redis_client = None


# ── Load service module from file path ─────────────────────────────────────
def _load_service(service_dir: str):
    """Import a service's main.py and return its FastAPI app."""
    mod_name = f"_svc_{service_dir.replace('-', '_')}"
    filepath = os.path.join(SERVICES_DIR, service_dir, "main.py")
    spec = importlib.util.spec_from_file_location(mod_name, filepath)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)
    return mod.app


def _copy_routes(source_app: FastAPI, target_app: FastAPI, prefix: str = "/api"):
    """
    Copy all API routes from source_app to target_app, adding a prefix.
    This avoids the limitations of mount() which doesn't merge routes.
    """
    for route in source_app.routes:
        if isinstance(route, APIRoute):
            # Re-register each route with the /api prefix
            target_app.add_api_route(
                path=f"{prefix}{route.path}",
                endpoint=route.endpoint,
                methods=route.methods,
                name=route.name,
                response_model=route.response_model,
                status_code=route.status_code,
                tags=route.tags or None,
                dependencies=route.dependencies,
                summary=route.summary,
                description=route.description,
            )


# ── Lifespan ───────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    logger.info("CipherVault unified server starting")

    # Initialize database tables
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")

    # Redis (optional — for rate limiting)
    if not SKIP_REDIS and REDIS_URL:
        try:
            redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
            await redis_client.ping()
            logger.info("Redis connected")
        except Exception:
            logger.info("Redis not available — rate limiting disabled")
            redis_client = None

    yield

    if redis_client:
        await redis_client.close()
    logger.info("CipherVault shutting down")


# ── Main App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="CipherVault API",
    description="Secure Document Protection Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Prometheus ─────────────────────────────────────────────────────────────
Instrumentator().instrument(app).expose(app, include_in_schema=False)


# ── Rate Limiting ──────────────────────────────────────────────────────────
async def check_rate_limit(client_ip: str, endpoint: str) -> bool:
    if not redis_client:
        return True
    key = f"rl:{client_ip}:{endpoint}"
    current = await redis_client.get(key)
    if current and int(current) >= RATE_LIMIT_REQUESTS:
        return False
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, RATE_LIMIT_WINDOW)
    await pipe.execute()
    return True


# ── JWT Validation ─────────────────────────────────────────────────────────
def validate_token(token: str) -> dict:
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Gateway Middleware ─────────────────────────────────────────────────────
@app.middleware("http")
async def gateway_middleware(request: Request, call_next):
    path = request.url.path

    # Skip public routes and metrics
    if path in PUBLIC_ROUTES or path.startswith("/metrics"):
        return await call_next(request)

    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not await check_rate_limit(client_ip, path):
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Try again later."},
        )

    # JWT validation for protected /api/ routes
    if path.startswith("/api/") and path not in PUBLIC_ROUTES:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing authentication token"},
            )
        try:
            token = auth_header.split(" ")[1]
            payload = validate_token(token)
            request.state.user_id = payload.get("sub")
            request.state.user_role = payload.get("role", "user")
        except HTTPException as e:
            return JSONResponse(
                status_code=e.status_code,
                content={"detail": e.detail},
            )

    return await call_next(request)


# ── Health Check ───────────────────────────────────────────────────────────
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ciphervault",
        "timestamp": time.time(),
    }


# ── Register Service Routes ───────────────────────────────────────────────
# Load each service and copy its routes under /api prefix.
# e.g. auth-service's /auth/login → /api/auth/login

_services = [
    "auth-service",
    "document-service",
    "encryption-service",
    "storage-service",
    "audit-service",
]

for _svc_name in _services:
    try:
        _svc_app = _load_service(_svc_name)
        _copy_routes(_svc_app, app)
        logger.info(f"Loaded routes from {_svc_name}")
    except Exception as e:
        logger.error(f"Failed to load {_svc_name}: {e}")
        raise

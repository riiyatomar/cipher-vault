"""
CipherVault — API Gateway
Central entry point: JWT validation, rate limiting, request proxying.
"""
import os
import time
import httpx
import jwt
import redis.asyncio as redis
from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from contextlib import asynccontextmanager

# ── Configuration ────────────────────────────────────────────────────────────
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
JWT_SECRET = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "5"))
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

SERVICE_MAP = {
    "auth": os.getenv("AUTH_SERVICE_URL", "http://localhost:8001"),
    "documents": os.getenv("DOCUMENT_SERVICE_URL", "http://localhost:8002"),
    "encryption": os.getenv("ENCRYPTION_SERVICE_URL", "http://localhost:8003"),
    "storage": os.getenv("STORAGE_SERVICE_URL", "http://localhost:8004"),
    "audit": os.getenv("AUDIT_SERVICE_URL", "http://localhost:8005"),
}

# Public routes that don't require authentication
PUBLIC_ROUTES = {
    "/api/auth/login",
    "/api/auth/register",
    "/api/health",
    "/docs",
    "/openapi.json",
}

redis_client = None
http_client = None
SKIP_REDIS = os.getenv("SKIP_REDIS", "false").lower() == "true"


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client, http_client
    if not SKIP_REDIS:
        try:
            redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
            await redis_client.ping()
        except Exception:
            print("WARNING: Redis not available — rate limiting disabled")
            redis_client = None
    http_client = httpx.AsyncClient(timeout=120.0)
    yield
    if redis_client:
        await redis_client.close()
    await http_client.aclose()


app = FastAPI(
    title="CipherVault API Gateway",
    description="Secure Document Protection Platform — API Gateway",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Prometheus Metrics ───────────────────────────────────────────────────────
Instrumentator().instrument(app).expose(app, include_in_schema=False)


# ── Rate Limiting ────────────────────────────────────────────────────────────
async def check_rate_limit(client_ip: str, endpoint: str) -> bool:
    """Returns True if request is within rate limits."""
    if not redis_client:
        return True  # Skip rate limiting if Redis unavailable
    key = f"rl:{client_ip}:{endpoint}"
    current = await redis_client.get(key)
    if current and int(current) >= RATE_LIMIT_REQUESTS:
        return False
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, RATE_LIMIT_WINDOW)
    await pipe.execute()
    return True


# ── JWT Validation ───────────────────────────────────────────────────────────
def validate_token(token: str) -> dict:
    """Validate JWT and return payload."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Middleware ───────────────────────────────────────────────────────────────
@app.middleware("http")
async def gateway_middleware(request: Request, call_next):
    """Auth validation + rate limiting for all requests."""
    path = request.url.path

    # Skip public routes
    if path in PUBLIC_ROUTES or path.startswith("/metrics"):
        return await call_next(request)

    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not await check_rate_limit(client_ip, path):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")

    # JWT validation for protected routes
    if path.startswith("/api/") and path not in PUBLIC_ROUTES:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authentication token")
        token = auth_header.split(" ")[1]
        payload = validate_token(token)
        # Inject user info into request state
        request.state.user_id = payload.get("sub")
        request.state.user_role = payload.get("role", "user")

    return await call_next(request)


# ── Health Check ─────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "api-gateway",
        "timestamp": time.time(),
    }


# ── Proxy Routes ─────────────────────────────────────────────────────────────
async def proxy_request(request: Request, service_url: str, path: str) -> Response:
    """Forward request to the target microservice."""
    url = f"{service_url}{path}"
    headers = dict(request.headers)
    # Remove hop-by-hop headers only — keep content-type for multipart
    for h in ("host", "transfer-encoding"):
        headers.pop(h, None)

    body = await request.body()

    response = await http_client.request(
        method=request.method,
        url=url,
        headers=headers,
        content=body,
        params=dict(request.query_params),
    )

    # Filter out hop-by-hop response headers
    resp_headers = dict(response.headers)
    for h in ("transfer-encoding", "content-encoding", "content-length"):
        resp_headers.pop(h, None)

    return Response(
        content=response.content,
        status_code=response.status_code,
        headers=resp_headers,
    )


# Auth routes
@app.api_route("/api/auth/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def auth_proxy(request: Request, path: str):
    return await proxy_request(request, SERVICE_MAP["auth"], f"/auth/{path}")


# Document routes
@app.api_route("/api/documents/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def documents_proxy(request: Request, path: str):
    return await proxy_request(request, SERVICE_MAP["documents"], f"/documents/{path}")


# Encryption routes
@app.api_route("/api/encryption/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def encryption_proxy(request: Request, path: str):
    return await proxy_request(request, SERVICE_MAP["encryption"], f"/encryption/{path}")


# Storage routes
@app.api_route("/api/storage/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def storage_proxy(request: Request, path: str):
    return await proxy_request(request, SERVICE_MAP["storage"], f"/storage/{path}")


# Audit routes
@app.api_route("/api/audit/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def audit_proxy(request: Request, path: str):
    return await proxy_request(request, SERVICE_MAP["audit"], f"/audit/{path}")

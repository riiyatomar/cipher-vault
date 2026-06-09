"""
CipherVault — Local Development Runner
Runs ALL backend services locally using SQLite (no Docker/PostgreSQL/Redis needed).
Usage:  python run_local.py
"""
import os
import sys
import subprocess
import time

# ── Directories ────────────────────────────────────────────────────────────
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICES_DIR = os.path.join(PROJECT_DIR, "services")
UPLOAD_DIR = os.path.join(PROJECT_DIR, "storage", "uploads")

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Common environment variables ───────────────────────────────────────────
COMMON_ENV = {
    **os.environ,
    "USE_SQLITE": "true",
    "SKIP_REDIS": "true",
    "JWT_SECRET_KEY": "dev_jwt_secret_key_change_in_production_please",
    "JWT_ALGORITHM": "HS256",
    "JWT_ACCESS_TOKEN_EXPIRE_MINUTES": "30",
    "JWT_REFRESH_TOKEN_EXPIRE_DAYS": "7",
    "MASTER_ENCRYPTION_KEY": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "AUTH_SERVICE_URL": "http://localhost:8001",
    "DOCUMENT_SERVICE_URL": "http://localhost:8002",
    "ENCRYPTION_SERVICE_URL": "http://localhost:8003",
    "STORAGE_SERVICE_URL": "http://localhost:8004",
    "AUDIT_SERVICE_URL": "http://localhost:8005",
    "CORS_ORIGINS": "http://localhost:3000",
    "UPLOAD_DIR": UPLOAD_DIR,
    "PYTHONPATH": SERVICES_DIR,
}

# ── Service definitions ───────────────────────────────────────────────────
SERVICES = [
    {"name": "Auth Service",        "dir": "auth-service",       "port": 8001},
    {"name": "Document Service",    "dir": "document-service",   "port": 8002},
    {"name": "Encryption Service",  "dir": "encryption-service", "port": 8003},
    {"name": "Storage Service",     "dir": "storage-service",    "port": 8004},
    {"name": "Audit Service",       "dir": "audit-service",      "port": 8005},
    {"name": "API Gateway",         "dir": "api-gateway",        "port": 8000},
]

print("=" * 60)
print("  CipherVault — Local Development Runner")
print("  Starting ALL backend services")
print("=" * 60)
print()

processes = []

for svc in SERVICES:
    svc_dir = os.path.join(SERVICES_DIR, svc["dir"])
    print(f"  Starting {svc['name']} on port {svc['port']}...")

    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app",
         "--host", "0.0.0.0", "--port", str(svc["port"]),
         "--log-level", "info"],
        cwd=svc_dir,
        env=COMMON_ENV,
    )
    processes.append((svc["name"], proc))
    time.sleep(2)  # Give each service time to start

print()
print("=" * 60)
print("  All services are starting up!")
print()
print("  API Gateway:        http://localhost:8000")
print("  Auth Service:       http://localhost:8001")
print("  Document Service:   http://localhost:8002")
print("  Encryption Service: http://localhost:8003")
print("  Storage Service:    http://localhost:8004")
print("  Audit Service:      http://localhost:8005")
print()
print("  Upload directory:   " + UPLOAD_DIR)
print("=" * 60)
print()
print("  Press Ctrl+C to stop all services")
print()

try:
    # Wait for the first process to exit (or Ctrl+C)
    processes[0][1].wait()
except KeyboardInterrupt:
    print("\nShutting down all services...")
    for name, proc in processes:
        try:
            proc.terminate()
        except Exception:
            pass
    for name, proc in processes:
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
    print("All services stopped.")

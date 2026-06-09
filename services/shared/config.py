"""
CipherVault — Shared Configuration
Loads environment variables and provides typed config to all services.
"""
import os
from dataclasses import dataclass, field
from typing import List


@dataclass
class DatabaseConfig:
    user: str = os.getenv("POSTGRES_USER", "ciphervault")
    password: str = os.getenv("POSTGRES_PASSWORD", "password")
    host: str = os.getenv("POSTGRES_HOST", "localhost")
    port: int = int(os.getenv("POSTGRES_PORT", "5432"))
    database: str = os.getenv("POSTGRES_DB", "ciphervault")

    @property
    def url(self) -> str:
        return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"

    @property
    def sync_url(self) -> str:
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"


@dataclass
class RedisConfig:
    host: str = os.getenv("REDIS_HOST", "localhost")
    port: int = int(os.getenv("REDIS_PORT", "6379"))

    @property
    def url(self) -> str:
        return f"redis://{self.host}:{self.port}/0"


@dataclass
class JWTConfig:
    secret_key: str = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-me")
    algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    refresh_token_expire_days: int = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "7"))


@dataclass
class EncryptionConfig:
    master_key: str = os.getenv("MASTER_ENCRYPTION_KEY", "dev-master-key-change-me-in-production")
    shamir_total_shares: int = int(os.getenv("SHAMIR_TOTAL_SHARES", "5"))
    shamir_threshold: int = int(os.getenv("SHAMIR_THRESHOLD", "3"))


@dataclass
class FileConfig:
    max_file_size_mb: int = int(os.getenv("MAX_FILE_SIZE_MB", "20"))
    file_expiry_hours: int = int(os.getenv("FILE_EXPIRY_HOURS", "24"))
    upload_dir: str = os.getenv("UPLOAD_DIR", "./storage/uploads")
    allowed_extensions: List[str] = field(default_factory=lambda: os.getenv(
        "ALLOWED_EXTENSIONS", "pdf,jpg,jpeg,png"
    ).split(","))

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024


@dataclass
class RateLimitConfig:
    requests: int = int(os.getenv("RATE_LIMIT_REQUESTS", "5"))
    window_seconds: int = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))


@dataclass
class ServiceURLs:
    auth: str = os.getenv("AUTH_SERVICE_URL", "http://localhost:8001")
    document: str = os.getenv("DOCUMENT_SERVICE_URL", "http://localhost:8002")
    encryption: str = os.getenv("ENCRYPTION_SERVICE_URL", "http://localhost:8003")
    storage: str = os.getenv("STORAGE_SERVICE_URL", "http://localhost:8004")
    audit: str = os.getenv("AUDIT_SERVICE_URL", "http://localhost:8005")


@dataclass
class AppConfig:
    db: DatabaseConfig = field(default_factory=DatabaseConfig)
    redis: RedisConfig = field(default_factory=RedisConfig)
    jwt: JWTConfig = field(default_factory=JWTConfig)
    encryption: EncryptionConfig = field(default_factory=EncryptionConfig)
    file: FileConfig = field(default_factory=FileConfig)
    rate_limit: RateLimitConfig = field(default_factory=RateLimitConfig)
    services: ServiceURLs = field(default_factory=ServiceURLs)
    cors_origins: List[str] = field(default_factory=lambda: os.getenv(
        "CORS_ORIGINS", "http://localhost:3000"
    ).split(","))


# Singleton config instance
config = AppConfig()

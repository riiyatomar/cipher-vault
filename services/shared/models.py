"""
CipherVault — Shared SQLAlchemy Models
All database models in one place for consistent schema across services.
Compatible with both PostgreSQL and SQLite backends.
"""
import os
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, BigInteger, Boolean, DateTime, Text, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from shared.database import Base

USE_SQLITE = os.getenv("USE_SQLITE", "false").lower() == "true"

if USE_SQLITE:
    # SQLite — use String(36) for UUIDs
    UUIDType = String(36)
    _uuid_default = lambda: str(uuid.uuid4())
else:
    # PostgreSQL — use native UUID type
    from sqlalchemy.dialects.postgresql import UUID
    UUIDType = UUID(as_uuid=True)
    _uuid_default = uuid.uuid4


class User(Base):
    __tablename__ = "users"

    id = Column(UUIDType, primary_key=True, default=_uuid_default)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUIDType, primary_key=True, default=_uuid_default)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    original_filename = Column(String(500), nullable=False)
    stored_filename = Column(String(500), nullable=False)
    file_hash = Column(String(128), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    mime_type = Column(String(100), nullable=False)
    encryption_algorithm = Column(String(50), default="AES-256-GCM")
    salt = Column(String(255))
    iv = Column(String(255))
    upload_time = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expiry_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(30), default="active")
    download_count = Column(Integer, default=0)
    max_downloads = Column(Integer, default=100)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="documents")
    encryption_key = relationship("EncryptionKey", back_populates="document",
                                  uselist=False, cascade="all, delete-orphan")


class EncryptionKey(Base):
    __tablename__ = "encryption_keys"

    id = Column(UUIDType, primary_key=True, default=_uuid_default)
    document_id = Column(UUIDType, ForeignKey("documents.id"),
                         nullable=False, unique=True)
    encrypted_dek = Column(Text, nullable=False)
    key_shares = Column(JSON)
    shares_total = Column(Integer, default=5)
    shares_threshold = Column(Integer, default=3)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    document = relationship("Document", back_populates="encryption_key")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUIDType, primary_key=True, default=_uuid_default)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50))
    resource_id = Column(UUIDType)
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    details = Column(JSON, default=dict)
    severity = Column(String(20), default="info")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(UUIDType, primary_key=True, default=_uuid_default)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=True)
    event_type = Column(String(100), nullable=False)
    ip_address = Column(String(45))
    details = Column(JSON, default=dict)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

-- =============================================================================
-- CipherVault — Database Schema
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users Table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Documents Table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_filename       VARCHAR(500) NOT NULL,
    stored_filename         VARCHAR(500) NOT NULL,
    file_hash               VARCHAR(128) NOT NULL,
    file_size               BIGINT NOT NULL,
    mime_type               VARCHAR(100) NOT NULL,
    encryption_algorithm    VARCHAR(50) DEFAULT 'AES-256-GCM',
    salt                    VARCHAR(255),
    iv                      VARCHAR(255),
    upload_time             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiry_time             TIMESTAMP WITH TIME ZONE NOT NULL,
    status                  VARCHAR(30) DEFAULT 'active'
                            CHECK (status IN ('active', 'expired', 'deleted', 'tampered')),
    download_count          INTEGER DEFAULT 0,
    max_downloads           INTEGER DEFAULT 100,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Encryption Keys Table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS encryption_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    encrypted_dek   TEXT NOT NULL,
    key_shares      JSONB,
    shares_total    INTEGER DEFAULT 5,
    shares_threshold INTEGER DEFAULT 3,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Audit Logs Table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    resource_type   VARCHAR(50),
    resource_id     UUID,
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(500),
    details         JSONB DEFAULT '{}',
    severity        VARCHAR(20) DEFAULT 'info'
                    CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Security Events Table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type      VARCHAR(100) NOT NULL,
    ip_address      VARCHAR(45),
    details         JSONB DEFAULT '{}',
    is_resolved     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_expiry ON documents(expiry_time);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_security_events_user ON security_events(user_id);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_encryption_keys_doc ON encryption_keys(document_id);

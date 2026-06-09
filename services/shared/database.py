"""
CipherVault — Shared Database Connection
Provides async SQLAlchemy engine and session for all services.
Supports both PostgreSQL (production) and SQLite (local dev).
"""
import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

USE_SQLITE = os.getenv("USE_SQLITE", "false").lower() == "true"

if USE_SQLITE:
    # Local development — use SQLite via aiosqlite
    _db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "ciphervault_local.db")
    _db_url = f"sqlite+aiosqlite:///{os.path.abspath(_db_path)}"
    engine = create_async_engine(_db_url, echo=False)
else:
    # Production — use PostgreSQL via asyncpg
    from shared.config import config
    engine = create_async_engine(
        config.db.url,
        echo=False,
        pool_size=20,
        max_overflow=10,
        pool_pre_ping=True,
    )

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields an async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create tables (used for development; production uses migrations)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

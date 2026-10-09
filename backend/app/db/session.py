"""Bounded PostgreSQL connections using the configured Neon database."""

from contextlib import contextmanager
from functools import lru_cache
from urllib.parse import urlsplit

from psycopg.conninfo import conninfo_to_dict
from psycopg_pool import ConnectionPool

from app.core.config import settings


@lru_cache(maxsize=1)
def get_pool() -> ConnectionPool:
    if urlsplit(settings.database_url).scheme not in {"postgres", "postgresql"}:
        raise RuntimeError("DATABASE_URL must configure a PostgreSQL database")
    options = conninfo_to_dict(settings.database_url)
    return ConnectionPool(
        settings.database_url,
        open=False,
        min_size=1,
        max_size=10,
        timeout=15,
        max_idle=60,
        max_lifetime=300,
        reconnect_timeout=30,
        check=ConnectionPool.check_connection,
        kwargs={
            "connect_timeout": 10,
            "sslmode": options.get("sslmode", "require"),
            "prepare_threshold": None,
        },
    )


@contextmanager
def get_session(pool: ConnectionPool):
    # Commits on success, rolls back on failure, and returns the connection.
    with pool.connection() as connection:
        yield connection

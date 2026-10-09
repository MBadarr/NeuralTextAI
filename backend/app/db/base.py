"""Versioned, transactional PostgreSQL schema initialization."""

from pathlib import Path

from psycopg_pool import ConnectionPool

from app.db.session import get_session


def initialize_database(pool: ConnectionPool) -> None:
    pool.open(wait=True, timeout=20)
    with get_session(pool) as connection:
        # Serialize simultaneous server starts while applying schema migrations.
        connection.execute("SELECT pg_advisory_xact_lock(728193041)")
        connection.execute(
            "CREATE TABLE IF NOT EXISTS public.neuraltext_schema_migrations "
            "(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
        )
        for path in sorted(Path(__file__).with_name("migrations").glob("*.sql")):
            applied = connection.execute(
                "SELECT 1 FROM public.neuraltext_schema_migrations WHERE version = %s",
                (path.name,),
            ).fetchone()
            if not applied:
                connection.execute(path.read_text(encoding="utf-8"), prepare=False)
                connection.execute(
                    "INSERT INTO public.neuraltext_schema_migrations (version) VALUES (%s)",
                    (path.name,),
                )

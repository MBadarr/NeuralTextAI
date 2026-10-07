"""SQLite connections for local document persistence."""

import sqlite3
from contextlib import contextmanager
from pathlib import Path


@contextmanager
def get_session(database_path: Path):
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path, timeout=15)
    try:
        with connection:
            yield connection
    finally:
        connection.close()

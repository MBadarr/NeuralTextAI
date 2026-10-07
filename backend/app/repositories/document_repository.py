import json
from datetime import datetime
from pathlib import Path
from threading import RLock

from app.core.config import settings
from app.db.session import get_session
from app.models.document import Document


class DocumentRepository:
    """SQLite storage in the app, with an isolated in-memory adapter for tests."""

    def __init__(self, database_path: Path | None = None):
        self.database_path = database_path
        self._documents: dict[str, Document] = {}
        self._lock = RLock()
        if database_path is not None:
            with get_session(database_path) as session:
                session.execute(
                    "CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, payload TEXT NOT NULL)"
                )

    @staticmethod
    def _decode(payload: str) -> Document:
        document = json.loads(payload)
        if "created_at" in document:
            document["created_at"] = datetime.fromisoformat(document["created_at"])
        return document

    def save(self, document: Document) -> Document:
        with self._lock:
            if self.database_path is None:
                self._documents[document["id"]] = document
            else:
                with get_session(self.database_path) as session:
                    session.execute(
                        "INSERT OR REPLACE INTO documents (id, payload) VALUES (?, ?)",
                        (document["id"], json.dumps(document, default=str)),
                    )
        return document

    def list(self) -> list[Document]:
        with self._lock:
            if self.database_path is None:
                return list(reversed(self._documents.values()))
            with get_session(self.database_path) as session:
                return [
                    self._decode(row[0])
                    for row in session.execute(
                        "SELECT payload FROM documents ORDER BY rowid DESC"
                    )
                ]

    def get(self, document_id: str) -> Document | None:
        with self._lock:
            if self.database_path is None:
                return self._documents.get(document_id)
            with get_session(self.database_path) as session:
                row = session.execute(
                    "SELECT payload FROM documents WHERE id = ?", (document_id,)
                ).fetchone()
                return self._decode(row[0]) if row else None

    def delete(self, document_id: str) -> bool:
        with self._lock:
            if self.database_path is None:
                return self._documents.pop(document_id, None) is not None
            with get_session(self.database_path) as session:
                return (
                    session.execute(
                        "DELETE FROM documents WHERE id = ?", (document_id,)
                    ).rowcount
                    > 0
                )


document_repository = DocumentRepository(settings.document_database)

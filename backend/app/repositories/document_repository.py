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
        self._owners: dict[str, str | None] = {}
        self._lock = RLock()
        if database_path is not None:
            with get_session(database_path) as session:
                session.execute(
                    "CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, payload TEXT NOT NULL)"
                )
                columns = {
                    row[1] for row in session.execute("PRAGMA table_info(documents)")
                }
                if "owner_id" not in columns:
                    session.execute("ALTER TABLE documents ADD COLUMN owner_id TEXT")
                session.execute(
                    "CREATE INDEX IF NOT EXISTS documents_owner_idx ON documents(owner_id)"
                )

    @staticmethod
    def _decode(payload: str) -> Document:
        document = json.loads(payload)
        if "created_at" in document:
            document["created_at"] = datetime.fromisoformat(document["created_at"])
        return document

    def save(self, document: Document, owner_id: str | None = None) -> Document:
        with self._lock:
            if self.database_path is None:
                if (
                    document["id"] in self._documents
                    and self._owners.get(document["id"]) != owner_id
                ):
                    raise ValueError("Cannot overwrite another user's document")
                self._documents[document["id"]] = document
                self._owners[document["id"]] = owner_id
            else:
                with get_session(self.database_path) as session:
                    result = session.execute(
                        "INSERT INTO documents (id, payload, owner_id) VALUES (?, ?, ?) "
                        "ON CONFLICT(id) DO UPDATE SET payload = excluded.payload WHERE documents.owner_id IS excluded.owner_id",
                        (document["id"], json.dumps(document, default=str), owner_id),
                    )
                    if result.rowcount == 0:
                        raise ValueError("Cannot overwrite another user's document")
        return document

    def list(self, owner_id: str | None = None) -> list[Document]:
        with self._lock:
            if self.database_path is None:
                return [
                    document
                    for document in reversed(self._documents.values())
                    if self._owners.get(document["id"]) == owner_id
                ]
            with get_session(self.database_path) as session:
                return [
                    self._decode(row[0])
                    for row in session.execute(
                        "SELECT payload FROM documents WHERE owner_id IS ? ORDER BY rowid DESC",
                        (owner_id,),
                    )
                ]

    def get(self, document_id: str, owner_id: str | None = None) -> Document | None:
        with self._lock:
            if self.database_path is None:
                return (
                    self._documents.get(document_id)
                    if self._owners.get(document_id) == owner_id
                    else None
                )
            with get_session(self.database_path) as session:
                row = session.execute(
                    "SELECT payload FROM documents WHERE id = ? AND owner_id IS ?",
                    (document_id, owner_id),
                ).fetchone()
                return self._decode(row[0]) if row else None

    def delete(self, document_id: str, owner_id: str | None = None) -> bool:
        with self._lock:
            if self.database_path is None:
                if self._owners.get(document_id) != owner_id:
                    return False
                self._owners.pop(document_id, None)
                return self._documents.pop(document_id, None) is not None
            with get_session(self.database_path) as session:
                return (
                    session.execute(
                        "DELETE FROM documents WHERE id = ? AND owner_id IS ?",
                        (document_id, owner_id),
                    ).rowcount
                    > 0
                )


document_repository = DocumentRepository(settings.document_database)

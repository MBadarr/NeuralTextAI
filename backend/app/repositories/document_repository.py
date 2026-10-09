import json
from contextlib import nullcontext
from datetime import datetime
from threading import RLock

from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app.db.base import initialize_database
from app.db.session import get_session
from app.models.document import Document


class DocumentRepository:
    """Neon PostgreSQL storage, with an isolated in-memory adapter for tests."""

    def __init__(self, pool: ConnectionPool | None = None):
        self.pool = pool
        self._documents: dict[str, Document] = {}
        self._owners: dict[str, str | None] = {}
        self._lock = RLock()

    def initialize(self) -> None:
        if self.pool is not None:
            initialize_database(self.pool)

    def close(self) -> None:
        if self.pool is not None:
            self.pool.close()

    @staticmethod
    def _decode(payload: dict) -> Document:
        document = dict(payload)
        if "created_at" in document:
            document["created_at"] = datetime.fromisoformat(document["created_at"])
        return document

    def save(self, document: Document, owner_id: str | None = None) -> Document:
        with self._lock if self.pool is None else nullcontext():
            if self.pool is None:
                if (
                    document["id"] in self._documents
                    and self._owners.get(document["id"]) != owner_id
                ):
                    raise ValueError("Cannot overwrite another user's document")
                self._documents[document["id"]] = document
                self._owners[document["id"]] = owner_id
            else:
                with get_session(self.pool) as session:
                    result = session.execute(
                        "INSERT INTO public.documents (id, payload, owner_id) VALUES (%s, %s, %s) "
                        "ON CONFLICT(id) DO UPDATE SET payload = excluded.payload WHERE documents.owner_id IS NOT DISTINCT FROM excluded.owner_id",
                        (
                            document["id"],
                            Jsonb(
                                document,
                                dumps=lambda value: json.dumps(value, default=str),
                            ),
                            owner_id,
                        ),
                    )
                    if result.rowcount == 0:
                        raise ValueError("Cannot overwrite another user's document")
        return document

    def list(self, owner_id: str | None = None) -> list[Document]:
        with self._lock if self.pool is None else nullcontext():
            if self.pool is None:
                return [
                    document
                    for document in reversed(self._documents.values())
                    if self._owners.get(document["id"]) == owner_id
                ]
            with get_session(self.pool) as session:
                return [
                    self._decode(row[0])
                    for row in session.execute(
                        "SELECT payload FROM public.documents WHERE owner_id IS NOT DISTINCT FROM %s ORDER BY position DESC",
                        (owner_id,),
                    )
                ]

    def get(self, document_id: str, owner_id: str | None = None) -> Document | None:
        with self._lock if self.pool is None else nullcontext():
            if self.pool is None:
                return (
                    self._documents.get(document_id)
                    if self._owners.get(document_id) == owner_id
                    else None
                )
            with get_session(self.pool) as session:
                row = session.execute(
                    "SELECT payload FROM public.documents WHERE id = %s AND owner_id IS NOT DISTINCT FROM %s",
                    (document_id, owner_id),
                ).fetchone()
                return self._decode(row[0]) if row else None

    def delete(self, document_id: str, owner_id: str | None = None) -> bool:
        with self._lock if self.pool is None else nullcontext():
            if self.pool is None:
                if self._owners.get(document_id) != owner_id:
                    return False
                self._owners.pop(document_id, None)
                return self._documents.pop(document_id, None) is not None
            with get_session(self.pool) as session:
                return (
                    session.execute(
                        "DELETE FROM public.documents WHERE id = %s AND owner_id IS NOT DISTINCT FROM %s",
                        (document_id, owner_id),
                    ).rowcount
                    > 0
                )

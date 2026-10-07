from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from app.repositories.document_repository import DocumentRepository


class DocumentRepositoryTests(TestCase):
    def test_sqlite_persists_across_repository_instances(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "documents.sqlite3"
            created = datetime.now(UTC)
            first = DocumentRepository(path)
            first.save({"id": "old", "created_at": created})
            first.save({"id": "new", "created_at": created})
            second = DocumentRepository(path)
            self.assertEqual(second.get("old")["created_at"], created)
            self.assertEqual([item["id"] for item in second.list()], ["new", "old"])
            self.assertTrue(second.delete("old"))
            self.assertIsNone(first.get("old"))

    def test_storage_lifecycle_and_instance_isolation(self):
        repository = DocumentRepository()
        document = {"id": "demo"}
        repository.save(document)
        self.assertEqual(repository.get("demo"), document)
        self.assertEqual(repository.list(), [document])
        self.assertEqual(DocumentRepository().list(), [])
        self.assertTrue(repository.delete("demo"))
        self.assertIsNone(repository.get("demo"))
        self.assertFalse(repository.delete("demo"))

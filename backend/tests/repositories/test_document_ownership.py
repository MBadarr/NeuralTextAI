from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from app.repositories.document_repository import DocumentRepository


class DocumentOwnershipTests(TestCase):
    def check_isolation(self, repository):
        repository.save({"id": "one"}, "alice")
        repository.save({"id": "two"}, "bob")
        repository.save({"id": "legacy"})
        with self.assertRaises(ValueError):
            repository.save({"id": "one", "changed": True}, "bob")
        self.assertEqual(repository.list("alice"), [{"id": "one"}])
        self.assertIsNone(repository.get("one", "bob"))
        self.assertFalse(repository.delete("one", "bob"))
        self.assertTrue(repository.delete("two", "bob"))
        self.assertEqual(repository.list("bob"), [])
        self.assertEqual(repository.list(), [{"id": "legacy"}])

    def test_memory_repository_isolation(self):
        self.check_isolation(DocumentRepository())

    def test_sqlite_repository_isolation_and_persistence(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "documents.sqlite3"
            self.check_isolation(DocumentRepository(path))
            self.assertEqual(
                DocumentRepository(path).get("one", "alice"), {"id": "one"}
            )

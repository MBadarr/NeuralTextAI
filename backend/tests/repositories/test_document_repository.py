from unittest import TestCase

from app.repositories.document_repository import DocumentRepository


class DocumentRepositoryTests(TestCase):
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

from unittest import TestCase

from fastapi.testclient import TestClient

from app.dependencies import get_document_repository
from app.main import app
from app.repositories.document_repository import DocumentRepository


class MainRoutesTests(TestCase):
    def setUp(self):
        repository = DocumentRepository()
        app.dependency_overrides[get_document_repository] = lambda: repository
        self.addCleanup(app.dependency_overrides.pop, get_document_repository)

    def test_root_and_health(self):
        with TestClient(app) as client:
            self.assertEqual(client.get("/").status_code, 200)
            self.assertEqual(client.get("/health").status_code, 200)

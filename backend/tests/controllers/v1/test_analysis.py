from unittest import TestCase

from fastapi.testclient import TestClient

from app.core.security import require_user
from app.dependencies import get_document_repository
from app.main import app
from app.repositories.document_repository import DocumentRepository


class AnalysisRoutesTests(TestCase):
    def setUp(self):
        app.dependency_overrides[require_user] = lambda: "test-user"
        self.addCleanup(app.dependency_overrides.pop, require_user)
        repository = DocumentRepository()
        app.dependency_overrides[get_document_repository] = lambda: repository
        self.addCleanup(app.dependency_overrides.pop, get_document_repository)

    def test_analysis(self):
        with TestClient(app) as client:
            response = client.post(
                "/analysis",
                json={"text": "Microsoft opened an office in London."},
            )
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()["entities"])

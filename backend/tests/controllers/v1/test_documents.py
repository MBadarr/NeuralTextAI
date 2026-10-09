from unittest import TestCase

from fastapi.testclient import TestClient

from app.core.security import require_user
from app.dependencies import get_document_repository
from app.main import app
from app.repositories.document_repository import DocumentRepository


class DocumentRoutesTests(TestCase):
    def setUp(self):
        app.dependency_overrides[require_user] = lambda: "test-user"
        self.addCleanup(app.dependency_overrides.pop, require_user)
        self.repository = DocumentRepository()
        app.dependency_overrides[get_document_repository] = lambda: self.repository
        self.addCleanup(app.dependency_overrides.pop, get_document_repository)

    def test_document_lifecycle_and_insights(self):
        with TestClient(app) as client:
            created = client.post(
                "/analysis",
                json={"text": "Microsoft works in London.", "title": "Demo"},
            ).json()
            path = f"/documents/{created['id']}"
            self.assertEqual(client.get(path).json()["title"], "Demo")
            self.assertEqual(len(client.get("/documents").json()), 1)
            self.assertEqual(client.get("/insights").json()["total_documents"], 1)
            self.assertEqual(client.delete(path).status_code, 204)
            self.assertEqual(client.get("/documents").json(), [])
            self.assertEqual(client.get(path).status_code, 404)
            self.assertEqual(
                client.delete(path).json(), {"detail": "Document not found"}
            )

    def test_invalid_analysis_input(self):
        with TestClient(app) as client:
            self.assertEqual(
                client.post("/analysis", json={"text": ""}).status_code, 422
            )

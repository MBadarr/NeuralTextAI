from unittest import TestCase

from fastapi.testclient import TestClient

from app.core.security import require_user
from app.dependencies import get_document_repository
from app.main import app
from app.repositories.document_repository import DocumentRepository


class WritingRoutesTests(TestCase):
    def setUp(self):
        repository = DocumentRepository()
        app.dependency_overrides[get_document_repository] = lambda: repository
        self.addCleanup(app.dependency_overrides.pop, get_document_repository)
        app.dependency_overrides[require_user] = lambda: "test-user"
        self.addCleanup(app.dependency_overrides.pop, require_user)

    def test_writing_feedback_and_autocomplete(self):
        with TestClient(app) as client:
            feedback = client.post(
                "/writing-feedback", json={"text": "this is teh test"}
            )
            self.assertEqual(feedback.status_code, 200)
            self.assertIn(
                "typo", [issue["type"] for issue in feedback.json()["issues"]]
            )
            completion = client.post("/autocomplete", json={"text": "This"})
            self.assertEqual(completion.status_code, 200)
            self.assertIn("source", completion.json())

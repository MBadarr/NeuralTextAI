from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest import TestCase
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.security import require_user
from app.dependencies import get_document_repository
from app.main import app
from app.repositories.document_repository import DocumentRepository
from app.services.document_service import DocumentService


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

    def test_overlapping_nlp_requests_are_rejected_and_failure_releases_capacity(self):
        entered, release = Event(), Event()

        def failing_analysis(*args):
            entered.set()
            if not release.wait(timeout=10):
                raise TimeoutError("Test did not release the analysis request")
            raise RuntimeError("Simulated analysis failure")

        with (
            TestClient(app, raise_server_exceptions=False) as client,
            ThreadPoolExecutor(max_workers=1) as executor,
            patch.object(DocumentService, "create", failing_analysis),
        ):
            pending = executor.submit(
                client.post, "/analysis", json={"text": "Analyze this text."}
            )
            try:
                self.assertTrue(entered.wait(timeout=5))
                busy = client.post("/sentiment", json={"text": "Excellent work."})
                self.assertEqual(busy.status_code, 503)
                self.assertEqual(busy.headers["Retry-After"], "1")
                self.assertEqual(busy.headers["X-Service-Error"], "nlp_busy")
                self.assertEqual(client.get("/health").status_code, 200)
                self.assertEqual(client.get("/models").status_code, 200)
            finally:
                release.set()
            self.assertEqual(pending.result(timeout=5).status_code, 500)
            self.assertEqual(
                client.post("/sentiment", json={"text": "Excellent work."}).status_code,
                200,
            )

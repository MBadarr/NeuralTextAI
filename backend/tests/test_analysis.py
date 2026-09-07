from unittest import TestCase

from fastapi.testclient import TestClient

from app.main import app


class AnalysisRoutesTests(TestCase):
    def test_analysis_and_writing_features(self):
        with TestClient(app) as client:
            response = client.post(
                "/analysis",
                json={"text": "Microsoft opened an office in London."},
            )
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()["entities"])
            self.assertEqual(
                client.post(
                    "/writing-feedback", json={"text": "this is teh test"}
                ).status_code,
                200,
            )
            self.assertEqual(
                client.post("/autocomplete", json={"text": "This"}).status_code,
                200,
            )

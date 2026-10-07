from unittest import TestCase

from fastapi.testclient import TestClient

from app.main import app


class WritingRoutesTests(TestCase):
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

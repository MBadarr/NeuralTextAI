from unittest import TestCase

from fastapi.testclient import TestClient

from app.dependencies import get_document_repository
from app.main import app
from app.repositories.document_repository import DocumentRepository


class NLPFeaturesTests(TestCase):
    def setUp(self):
        repository = DocumentRepository()
        app.dependency_overrides[get_document_repository] = lambda: repository
        self.addCleanup(app.dependency_overrides.pop, get_document_repository)

    def test_trained_analysis_and_keywords(self):
        with TestClient(app) as client:
            response = client.post(
                "/analysis",
                json={
                    "text": "Microsoft opened a research office in London. The scientists study language and build useful tools."
                },
            )
            self.assertEqual(response.status_code, 200)
            result = response.json()
            self.assertTrue(result["entities"])
            self.assertTrue(
                any(token["part_of_speech"] == "VERB" for token in result["tokens"])
            )
            self.assertTrue(result["noun_phrases"])
            self.assertTrue(result["keywords"])
            self.assertIsNotNone(result["readability"])
            self.assertGreater(result["processing_time_ms"], 0)
            self.assertEqual(client.get("/models").json()[0]["vectors"], 300)
            self.assertTrue(
                client.post(
                    "/keywords",
                    json={"text": "Language research improves language tools."},
                ).json()["keywords"]
            )

    def test_negation_summary_limit_and_similarity(self):
        with TestClient(app) as client:
            positive = client.post(
                "/sentiment", json={"text": "The service is good."}
            ).json()
            negative = client.post(
                "/sentiment", json={"text": "The service is not good."}
            ).json()
            self.assertGreater(positive["score"], 0)
            self.assertLess(negative["score"], 0)
            summary = client.post(
                "/summary",
                json={
                    "text": "A cat sleeps. Research improves language tools. Language tools help researchers. Research supports language analysis.",
                    "sentence_limit": 1,
                },
            ).json()
            self.assertEqual(summary["selected_sentence_count"], 1)
            self.assertNotEqual(summary["summary"], "A cat sleeps.")
            client.post(
                "/analysis",
                json={"text": "The vehicle travels on the road.", "title": "Transport"},
            )
            client.post(
                "/analysis",
                json={"text": "A chef cooks food in the kitchen.", "title": "Cooking"},
            )
            search = client.post("/search", json={"query": "cars and driving"}).json()
            self.assertEqual(search["results"][0]["document"]["title"], "Transport")
            comparison = client.post(
                "/plagiarism", json={"text": "The vehicle travels on the road."}
            ).json()
            self.assertEqual(comparison["match_percentage"], 100)
            self.assertEqual(comparison["compared_documents"], 2)

    def test_whitespace_empty_vocabulary_and_invalid_limits(self):
        with TestClient(app) as client:
            for path in (
                "/analysis",
                "/sentiment",
                "/summary",
                "/writing-feedback",
                "/autocomplete",
                "/keywords",
            ):
                self.assertEqual(
                    client.post(path, json={"text": "   "}).status_code, 422
                )
            self.assertEqual(
                client.post("/search", json={"query": "  "}).status_code, 422
            )
            self.assertEqual(
                client.post(
                    "/summary", json={"text": "Hello.", "sentence_limit": 0}
                ).status_code,
                422,
            )
            self.assertEqual(
                client.post("/keywords", json={"text": "!!!"}).json()["keywords"], []
            )
            self.assertEqual(
                client.post("/search", json={"query": "anything"}).json()["results"], []
            )

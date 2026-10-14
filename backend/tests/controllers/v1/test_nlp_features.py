from unittest import TestCase

from fastapi.testclient import TestClient

from app.core.security import require_user
from app.dependencies import get_document_repository
from app.main import app
from app.repositories.document_repository import DocumentRepository


class NLPFeaturesTests(TestCase):
    def setUp(self):
        app.dependency_overrides[require_user] = lambda: "test-user"
        self.addCleanup(app.dependency_overrides.pop, require_user)
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
            model = client.get("/models").json()[0]
            self.assertTrue(model["trained"])
            self.assertIn(model["vectors"], (0, 300))
            if model["vectors"] == 0:
                self.assertTrue(any("Low-memory" in w for w in result["warnings"]))
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
            has_vectors = client.get("/models").json()[0]["vectors"] > 0
            search = client.post(
                "/search",
                json={"query": "cars and driving" if has_vectors else "vehicle road"},
            ).json()
            self.assertEqual(search["results"][0]["document"]["title"], "Transport")
            if not has_vectors:
                self.assertEqual(search["method"], "TF-IDF lexical similarity")
                self.assertTrue(search["warnings"])
            comparison = client.post(
                "/plagiarism", json={"text": "The vehicle travels on the road."}
            ).json()
            self.assertEqual(comparison["match_percentage"], 100)
            self.assertEqual(comparison["compared_documents"], 2)

    def test_classification_and_stems_round_trip_through_api(self):
        with TestClient(app) as client:
            intent = client.post("/intent", json={"text": "Can you help me?"})
            self.assertEqual(intent.status_code, 200)
            self.assertEqual(intent.json()["label"], "Request")
            self.assertIn("speech-act rules", intent.json()["method"])
            semantic = client.post(
                "/intent",
                json={"text": "My delivery is late and the service is terrible."},
            ).json()
            if client.get("/models").json()[0]["vectors"]:
                self.assertEqual(semantic["label"], "Complaint")
                self.assertEqual(
                    semantic["sentences"][0]["evidence"],
                    "Similarity to semantic examples",
                )
            else:
                self.assertEqual(semantic["method"], "English speech-act rules")
                self.assertTrue(
                    any(
                        "Semantic vectors unavailable" in w
                        for w in semantic["warnings"]
                    )
                )
            emotion = client.post(
                "/emotions", json={"text": "I am not sad, but I am very happy."}
            )
            self.assertEqual(emotion.status_code, 200)
            self.assertEqual(emotion.json()["label"], "Joy")
            response = client.post(
                "/analysis", json={"text": "Please help me. I am scared and running."}
            )
            self.assertEqual(response.status_code, 200)
            result = response.json()
            self.assertEqual(result["emotions"]["label"], "Fear")
            self.assertEqual(result["intent"]["label"], "Mixed")
            self.assertEqual(
                next(t for t in result["tokens"] if t["text"] == "running")["stem"],
                "run",
            )
            saved = client.get(f"/documents/{result['id']}").json()
            self.assertEqual(saved["emotions"], result["emotions"])
            self.assertEqual(saved["intent"], result["intent"])
            self.assertEqual(saved["tokens"], result["tokens"])

    def test_whitespace_empty_vocabulary_and_invalid_limits(self):
        with TestClient(app) as client:
            for path in (
                "/analysis",
                "/sentiment",
                "/intent",
                "/emotions",
                "/summary",
                "/writing-feedback",
                "/autocomplete",
                "/keywords",
                "/entities",
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

    def test_entity_extraction_does_not_create_a_document(self):
        with TestClient(app) as client:
            text = "Microsoft opened a research office in London."
            response = client.post("/entities", json={"text": text})
            self.assertEqual(response.status_code, 200)
            result = response.json()
            self.assertTrue(result["entities"])
            self.assertEqual(sum(result["counts"].values()), len(result["entities"]))
            for entity in result["entities"]:
                self.assertEqual(text[entity["start"] : entity["end"]], entity["text"])
            self.assertEqual(client.get("/documents").json(), [])

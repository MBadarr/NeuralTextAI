from unittest import TestCase
from unittest.mock import patch

from app.services.nlp_service import NLPService


class NLPServiceTests(TestCase):
    def setUp(self):
        self.nlp = NLPService()
        with patch("app.services.nlp_service.spacy.load", side_effect=OSError):
            self.nlp.load()

    def test_fallback_analysis_reports_unavailable_model_without_fake_entities(self):
        result = self.nlp.analyze("Microsoft works in London.")
        self.assertEqual(result["word_count"], 4)
        self.assertEqual(result["sentence_count"], 1)
        self.assertEqual(result["entities"], [])
        self.assertTrue(result["warnings"])
        self.assertTrue(result["tokens"])

    def test_sentiment_summary_and_comparison(self):
        self.assertEqual(
            self.nlp.sentiment("great helpful success")["label"], "Positive"
        )
        self.assertEqual(
            self.nlp.summary("One. Two. Three. Four.")["summary"], "One. Two. Three."
        )
        result = self.nlp.plagiarism(
            "hello world",
            [
                {"id": "demo", "title": "Demo", "text": "hello world"},
            ],
        )
        self.assertEqual(result["match_percentage"], 100)

    def test_stems_are_separate_from_lemmas_and_skip_punctuation(self):
        self.assertEqual(self.nlp.stem("running"), "run")
        self.assertEqual(self.nlp.stem("connections"), "connect")
        self.assertEqual(self.nlp.stem("studies"), "studi")
        self.assertEqual(self.nlp.stem("!"), "")
        self.assertEqual(self.nlp.stem("bonjour", "fr"), "")
        result = self.nlp.analyze("I am very happy and running.")
        self.assertEqual(result["emotions"]["label"], "Joy")
        self.assertEqual(result["intent"]["label"], "Statement")
        self.assertEqual(
            next(t for t in result["tokens"] if t["text"] == "running")["stem"], "run"
        )

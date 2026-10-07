from unittest import TestCase
from unittest.mock import patch

from app.services.nlp_service import NLPService


class NLPServiceTests(TestCase):
    def setUp(self):
        self.nlp = NLPService()
        with patch("app.services.nlp_service.spacy.load", side_effect=OSError):
            self.nlp.load()

    def test_fallback_analysis_preserves_entities_and_tokens(self):
        result = self.nlp.analyze("Microsoft works in London.")
        self.assertEqual(result["word_count"], 4)
        self.assertEqual(result["sentence_count"], 1)
        self.assertEqual(
            [entity["label"] for entity in result["entities"]], ["ORG", "GPE"]
        )
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

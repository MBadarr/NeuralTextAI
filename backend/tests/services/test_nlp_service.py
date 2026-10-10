from unittest import TestCase
from unittest.mock import patch

from app.services.nlp_service import NLPService


class NLPServiceTests(TestCase):
    def setUp(self):
        self.nlp = NLPService()
        with patch("app.services.nlp_service.spacy.load", side_effect=OSError):
            self.nlp.load()

    def test_large_parses_are_not_retained_and_short_parse_cache_is_bounded(self):
        for number in range(6):
            self.nlp.parse(f"Short document number {number}.")
        self.assertEqual(self.nlp._cached_parse.cache_info().currsize, 4)
        before = self.nlp._cached_parse.cache_info()
        self.nlp.parse("large document " * 1000)
        self.assertEqual(self.nlp._cached_parse.cache_info(), before)

    def test_loaded_model_is_reused(self):
        loaded = self.nlp.nlp
        with patch("app.services.nlp_service.spacy.load") as load:
            self.nlp.load()
        load.assert_not_called()
        self.assertIs(self.nlp.nlp, loaded)

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

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

    def test_entity_extraction_reports_missing_model(self):
        result = self.nlp.entities("Microsoft works in London.")
        self.assertEqual(result["entities"], [])
        self.assertEqual(result["counts"], {})
        self.assertTrue(
            any("trained spaCy" in warning for warning in result["warnings"])
        )

    def test_conflicting_tone_abstains_and_keeps_lexical_score(self):
        for text in (
            "Fantastic, another three-hour delay.",
            "I lost my best friend yesterday.",
        ):
            with self.subTest(text=text):
                result = self.nlp.sentiment(text)
                self.assertEqual(result["label"], "Uncertain")
                self.assertEqual(result["confidence"], 0)
                self.assertTrue(
                    any("conflicts" in warning for warning in result["warnings"])
                )
        self.assertEqual(
            self.nlp.sentiment("The service is excellent.")["label"], "Positive"
        )
        self.assertEqual(
            self.nlp.sentiment("The service is not good.")["label"], "Negative"
        )

    def test_non_latin_analysis_does_not_claim_english_annotations(self):
        result = self.nlp.analyze("مرحبا بالعالم")
        self.assertEqual(result["sentiment"]["label"], "Unsupported")
        self.assertEqual(result["entities"], [])
        self.assertEqual(result["noun_phrases"], [])
        self.assertIsNone(result["readability"])
        self.assertTrue(
            all(token["part_of_speech"] == "Unavailable" for token in result["tokens"])
        )
        self.assertTrue(all(token["stem"] == "" for token in result["tokens"]))

    def test_summary_deduplicates_sentences(self):
        result = self.nlp.summary(
            "Research helps people. Research helps people. Tools support research.", 3
        )
        self.assertEqual(result["summary"].count("Research helps people."), 1)
        self.assertEqual(result["sentence_count"], 3)
        self.assertEqual(result["selected_sentence_count"], 2)

    def test_low_similarity_is_not_reported_as_zero(self):
        result = self.nlp.plagiarism(
            "alpha beta gamma delta epsilon zeta eta theta iota kappa",
            [
                {
                    "id": "one",
                    "title": "Other",
                    "text": "alpha lambda mu nu xi omicron pi rho sigma tau",
                }
            ],
        )
        self.assertGreater(result["match_percentage"], 0)
        self.assertLess(result["match_percentage"], 20)
        self.assertEqual(result["matches"], [])

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

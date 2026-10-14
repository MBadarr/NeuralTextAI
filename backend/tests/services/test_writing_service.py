from unittest import TestCase

import spacy

from app.services.nlp_service import NLPService
from app.services.writing_service import WritingService


class WritingServiceTests(TestCase):
    @classmethod
    def setUpClass(cls):
        nlp = NLPService()
        nlp.nlp = spacy.blank("en")
        nlp.nlp.add_pipe("sentencizer")
        cls.service = WritingService(nlp)

    def test_feedback_rules_have_correct_offsets_and_replacements(self):
        text = "this is teh test"
        result = self.service.feedback(text)
        self.assertEqual(result["issue_count"], 3)
        typo = next(issue for issue in result["issues"] if issue["type"] == "typo")
        self.assertEqual(text[typo["start"] : typo["end"]], "teh")
        self.assertEqual(typo["replacement"], "the")
        punctuation = next(
            issue for issue in result["issues"] if issue["replacement"] == "."
        )
        self.assertEqual(punctuation["start"], len(text))

    def test_repeated_typo_occurrences_and_word_boundaries(self):
        result = self.service.feedback("Teh teh test.")
        self.assertEqual(
            len([issue for issue in result["issues"] if issue["type"] == "typo"]), 2
        )
        self.assertFalse(
            any(
                issue["type"] == "typo"
                for issue in self.service.feedback("The theorem is clear.")["issues"]
            )
        )

    def test_completion_uses_workspace_context_without_repeating_last_word(self):
        result = self.service.autocomplete(
            "Today we ", [{"text": "Today we build language tools."}]
        )
        self.assertIn("build language tools", result["suggestions"])
        self.assertEqual(result["source"], "workspace n-grams")

    def test_prefix_completion_and_empty_context(self):
        self.assertEqual(self.service.autocomplete("")["suggestions"], [])
        self.assertTrue(self.service.autocomplete("analyz")["suggestions"])
        self.assertEqual(self.service.autocomplete("this ")["suggestions"], [])

    def test_known_word_prefix_and_workspace_vocabulary(self):
        self.assertTrue(self.service.autocomplete("work")["suggestions"])
        result = self.service.autocomplete(
            "We use neu", [{"text": "We use neuraltext daily."}]
        )
        self.assertEqual(result["source"], "workspace prefix")
        self.assertEqual(result["suggestions"][0], "neuraltext")

    def test_predictions_do_not_cross_sentence_boundaries(self):
        result = self.service.autocomplete(
            "tools ", [{"text": "We build tools. Nobody sleeps."}]
        )
        self.assertEqual(result["suggestions"], [])

    def test_pronoun_agreement_uses_trained_dependencies(self):
        service = WritingService(NLPService())
        result = service.feedback("She are writing a report.")
        issue = next(issue for issue in result["issues"] if issue["type"] == "grammar")
        self.assertEqual(issue["replacement"], "is")
        self.assertEqual(
            "She are writing a report."[issue["start"] : issue["end"]], "are"
        )
        for text in (
            "We are writing a report.",
            "She can have a report.",
            "She and I are writing.",
        ):
            self.assertFalse(
                any(
                    issue["type"] == "grammar"
                    for issue in service.feedback(text)["issues"]
                )
            )

    def test_subjunctives_and_linking_adjectives_are_not_corrected(self):
        service = WritingService(NLPService())
        for text in (
            "I suggest that he have a rest.",
            "We recommend that she be ready.",
            "I insist that he do the work.",
            "The food tastes good.",
            "She looks good.",
        ):
            with self.subTest(text=text):
                self.assertFalse(
                    any(
                        i["type"] == "grammar" for i in service.feedback(text)["issues"]
                    )
                )
        text = "She writes good."
        issue = next(
            i for i in service.feedback(text)["issues"] if i["type"] == "grammar"
        )
        self.assertEqual(text[issue["start"] : issue["end"]], "good")
        self.assertEqual(issue["replacement"], "well")

    def test_short_non_latin_text_is_not_checked_as_english(self):
        for text in ("你好世界", "مرحبا"):
            self.assertEqual(self.service.feedback(text)["issues"], [])
            result = self.service.autocomplete(text)
            self.assertEqual(result["suggestions"], [])
            self.assertTrue(result["warnings"])

    def test_truncated_issues_are_disclosed(self):
        result = self.service.feedback("This  is  a  simple  sentence. " * 35)
        self.assertEqual(len(result["issues"]), 50)
        self.assertTrue(any("first 50" in warning for warning in result["warnings"]))

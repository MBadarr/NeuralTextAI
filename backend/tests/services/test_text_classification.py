from unittest import TestCase

import spacy

from app.services.text_classification import TextClassifier


class TextClassificationTests(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nlp = spacy.blank("en")
        cls.nlp.add_pipe("sentencizer")
        cls.classifier = TextClassifier(cls.nlp)

    def test_communication_purpose_and_mixed_text(self):
        for text, label in [
            ("Can you reset my password?", "Request"),
            ("Where is my order?", "Question"),
            ("The product is broken.", "Complaint"),
            ("Thank you for your help.", "Appreciation"),
            ("The meeting starts at noon.", "Statement"),
            ("The product is not broken.", "Statement"),
            ("I am not grateful.", "Statement"),
            ("!!!", "Unknown"),
        ]:
            with self.subTest(text=text):
                result = self.classifier.intent(self.nlp(text), "en")
                self.assertEqual(result["label"], label)
                self.assertTrue(result["warnings"])
        result = self.classifier.intent(
            self.nlp("Please help me. Where is my order?"), "en"
        )
        self.assertEqual(result["label"], "Mixed")
        self.assertEqual(result["scores"], {"Request": 1, "Question": 1})

    def test_all_emotions_and_neutral(self):
        for word, label in [
            ("happy", "Joy"),
            ("furious", "Anger"),
            ("sad", "Sadness"),
            ("afraid", "Fear"),
            ("astonished", "Surprise"),
            ("disgusted", "Disgust"),
        ]:
            with self.subTest(word=word):
                result = self.classifier.emotions(self.nlp(f"I feel {word}."), "en")
                self.assertEqual(result["label"], label)
                self.assertEqual(result["scores"][label], 1)
        result = self.classifier.emotions(self.nlp("The meeting starts at noon."), "en")
        self.assertEqual(result["label"], "Neutral")
        self.assertFalse(any(result["scores"].values()))

    def test_negation_intensity_and_clause_boundaries(self):
        result = self.classifier.emotions(
            self.nlp("I am not sad, but I am extremely happy."), "en"
        )
        self.assertEqual(result["label"], "Joy")
        self.assertEqual(result["scores"]["Sadness"], 0)
        self.assertEqual(result["scores"]["Joy"], 1.5)
        self.assertTrue(result["sentences"][0]["evidence"][0]["negated"])
        for text in ["I am not happy.", "I am not unhappy.", "I am never afraid."]:
            self.assertEqual(
                self.classifier.emotions(self.nlp(text), "en")["label"], "Neutral"
            )
        self.assertEqual(
            self.classifier.emotions(
                self.nlp("I am not only happy but thrilled."), "en"
            )["scores"]["Joy"],
            2,
        )
        self.assertEqual(
            self.classifier.emotions(self.nlp("I am angry and scared."), "en")["label"],
            "Mixed",
        )
        self.assertEqual(
            self.classifier.emotions(self.nlp("I am slightly sad."), "en")["scores"][
                "Sadness"
            ],
            0.5,
        )

    def test_non_english_is_not_a_fake_prediction(self):
        for classify in [self.classifier.intent, self.classifier.emotions]:
            result = classify(self.nlp("Je suis heureux."), "fr")
            self.assertEqual(result["label"], "Unsupported")
            self.assertEqual(result["scores"], {})
            self.assertTrue(result["warnings"])

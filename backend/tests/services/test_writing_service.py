from unittest import TestCase
from unittest.mock import Mock

from app.services.nlp_service import NLPService
from app.services.writing_service import WritingService


class WritingServiceTests(TestCase):
    def test_feedback_rules(self):
        nlp = Mock(spec=NLPService)
        nlp.sentences.return_value = ["this is teh test"]
        result = WritingService(nlp).feedback("this is teh test")
        self.assertEqual(result["issue_count"], 3)
        self.assertTrue(any("'the'" in issue["message"] for issue in result["issues"]))

    def test_completion_uses_last_word(self):
        service = WritingService(Mock(spec=NLPService))
        self.assertIn(
            "we should consider", service.autocomplete("Today we")["suggestions"]
        )

from unittest import TestCase
from unittest.mock import Mock

from app.core.exceptions import DocumentNotFoundError
from app.repositories.document_repository import DocumentRepository
from app.services.document_service import DocumentService
from app.services.nlp_service import NLPService


class DocumentServiceTests(TestCase):
    def test_create_stores_analysis_and_aggregates_it(self):
        nlp = Mock(spec=NLPService)
        document = {"id": "demo", "word_count": 4, "entities": [{"text": "London"}]}
        nlp.analyze.return_value = document
        service = DocumentService(DocumentRepository(), nlp)
        self.assertEqual(service.create("Input text", "Title"), document)
        nlp.analyze.assert_called_once_with("Input text", "Title")
        self.assertEqual(service.get("demo"), document)
        self.assertEqual(
            service.insights(),
            {
                "total_documents": 1,
                "total_words": 4,
                "total_entities": 1,
            },
        )
        service.delete("demo")
        self.assertEqual(service.insights()["total_documents"], 0)

    def test_missing_documents_raise_domain_error(self):
        service = DocumentService(DocumentRepository(), Mock(spec=NLPService))
        with self.assertRaises(DocumentNotFoundError):
            service.get("missing")
        with self.assertRaises(DocumentNotFoundError):
            service.delete("missing")

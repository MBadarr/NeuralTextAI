from collections import Counter

from app.core.exceptions import DocumentNotFoundError
from app.models.document import Document
from app.repositories.document_repository import DocumentRepository
from app.services.nlp_service import NLPService


class DocumentService:
    def __init__(
        self,
        repository: DocumentRepository,
        nlp: NLPService,
        owner_id: str | None = None,
    ):
        self.repository = repository
        self.nlp = nlp
        self.owner_id = owner_id

    def create(self, text: str, title: str | None = None) -> Document:
        return self.repository.save(self.nlp.analyze(text, title), self.owner_id)

    def list(self) -> list[Document]:
        return self.repository.list(self.owner_id)

    def get(self, document_id: str) -> Document:
        document = self.repository.get(document_id, self.owner_id)
        if document is None:
            raise DocumentNotFoundError(document_id)
        return document

    def delete(self, document_id: str) -> None:
        if not self.repository.delete(document_id, self.owner_id):
            raise DocumentNotFoundError(document_id)

    def insights(self) -> dict:
        documents = self.repository.list(self.owner_id)
        return {
            "total_documents": len(documents),
            "total_words": sum(item["word_count"] for item in documents),
            "total_entities": sum(len(item["entities"]) for item in documents),
            "average_processing_time_ms": round(
                sum(item.get("processing_time_ms", 0) for item in documents)
                / max(1, len(documents)),
                2,
            ),
            "entity_counts": dict(
                Counter(
                    entity["label"] for item in documents for entity in item["entities"]
                )
            ),
            "language_counts": dict(
                Counter(item.get("language", "und") for item in documents)
            ),
            "sentiment_counts": dict(
                Counter(
                    item.get("sentiment", {}).get("label", "Unknown")
                    for item in documents
                )
            ),
        }

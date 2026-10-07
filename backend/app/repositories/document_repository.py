from app.models.document import Document


class DocumentRepository:
    """Process-local storage; replace this adapter when persistence is added."""

    def __init__(self):
        self._documents: dict[str, Document] = {}

    def save(self, document: Document) -> Document:
        self._documents[document["id"]] = document
        return document

    def list(self) -> list[Document]:
        return list(self._documents.values())

    def get(self, document_id: str) -> Document | None:
        return self._documents.get(document_id)

    def delete(self, document_id: str) -> bool:
        return self._documents.pop(document_id, None) is not None


document_repository = DocumentRepository()

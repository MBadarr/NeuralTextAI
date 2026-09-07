from app.services.nlp import nlp_service


class DocumentStore:
    def __init__(self):
        self.documents = {}

    def create(self, text: str, title: str | None = None):
        document = nlp_service.analyze(text, title)
        self.documents[document["id"]] = document
        return document

    def list(self):
        return list(self.documents.values())

    def get(self, document_id: str):
        return self.documents.get(document_id)

    def delete(self, document_id: str):
        return self.documents.pop(document_id, None) is not None

    def insights(self):
        return {
            "total_documents": len(self.documents),
            "total_words": sum(item["word_count"] for item in self.documents.values()),
            "total_entities": sum(
                len(item["entities"]) for item in self.documents.values()
            ),
        }


document_store = DocumentStore()

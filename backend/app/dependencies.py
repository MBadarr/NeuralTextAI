from collections.abc import Generator

from app.services.documents import DocumentStore, document_store
from app.services.nlp import NLPService, nlp_service


def get_document_store() -> Generator[DocumentStore]:
    yield document_store


def get_nlp_service() -> Generator[NLPService]:
    yield nlp_service

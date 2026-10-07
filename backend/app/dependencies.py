from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.repositories.document_repository import (
    DocumentRepository,
    document_repository,
)
from app.services.document_service import DocumentService
from app.services.nlp_service import NLPService, nlp_service
from app.services.writing_service import WritingService


def get_document_repository() -> DocumentRepository:
    return document_repository


def get_nlp_service() -> NLPService:
    return nlp_service


def get_document_service(
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
    nlp: Annotated[NLPService, Depends(get_nlp_service)],
) -> DocumentService:
    return DocumentService(repository, nlp)


@lru_cache(maxsize=4)
def get_writing_service(
    nlp: Annotated[NLPService, Depends(get_nlp_service)],
) -> WritingService:
    return WritingService(nlp)

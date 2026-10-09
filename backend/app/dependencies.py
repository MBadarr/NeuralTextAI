from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.core.security import require_user
from app.db.session import get_pool
from app.repositories.document_repository import DocumentRepository
from app.services.document_service import DocumentService
from app.services.nlp_service import NLPService, nlp_service
from app.services.writing_service import WritingService


@lru_cache(maxsize=1)
def get_document_repository() -> DocumentRepository:
    return DocumentRepository(get_pool())


def get_nlp_service() -> NLPService:
    return nlp_service


def get_document_service(
    repository: Annotated[DocumentRepository, Depends(get_document_repository)],
    nlp: Annotated[NLPService, Depends(get_nlp_service)],
    user_id: Annotated[str, Depends(require_user)],
) -> DocumentService:
    return DocumentService(repository, nlp, owner_id=user_id)


@lru_cache(maxsize=4)
def get_writing_service(
    nlp: Annotated[NLPService, Depends(get_nlp_service)],
) -> WritingService:
    return WritingService(nlp)

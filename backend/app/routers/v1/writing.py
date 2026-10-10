from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.nlp_capacity import limit_nlp_requests
from app.dependencies import get_document_service, get_writing_service
from app.schemas.writing import (
    AutocompleteResponse,
    WritingFeedbackResponse,
    WritingRequest,
)
from app.services.document_service import DocumentService
from app.services.writing_service import WritingService

router = APIRouter(tags=["writing"], dependencies=[Depends(limit_nlp_requests)])
WritingDependency = Annotated[WritingService, Depends(get_writing_service)]


@router.post("/writing-feedback", response_model=WritingFeedbackResponse)
def writing_feedback(payload: WritingRequest, writing: WritingDependency):
    return writing.feedback(payload.text)


@router.post("/autocomplete", response_model=AutocompleteResponse)
def autocomplete(
    payload: WritingRequest,
    writing: WritingDependency,
    documents: Annotated[DocumentService, Depends(get_document_service)],
):
    return writing.autocomplete(payload.text, documents.list())

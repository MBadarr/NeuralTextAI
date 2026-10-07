from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies import get_writing_service
from app.schemas.writing import (
    AutocompleteResponse,
    WritingFeedbackResponse,
    WritingRequest,
)
from app.services.writing_service import WritingService

router = APIRouter(tags=["writing"])
WritingDependency = Annotated[WritingService, Depends(get_writing_service)]


@router.post("/writing-feedback", response_model=WritingFeedbackResponse)
async def writing_feedback(payload: WritingRequest, writing: WritingDependency):
    return writing.feedback(payload.text)


@router.post("/autocomplete", response_model=AutocompleteResponse)
async def autocomplete(payload: WritingRequest, writing: WritingDependency):
    return writing.autocomplete(payload.text)

from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies import get_document_service, get_nlp_service
from app.schemas.analysis import AnalysisRequest
from app.schemas.document import DocumentResponse
from app.services.document_service import DocumentService
from app.services.nlp_service import NLPService

router = APIRouter(tags=["analysis"])
NLPDependency = Annotated[NLPService, Depends(get_nlp_service)]
DocumentDependency = Annotated[DocumentService, Depends(get_document_service)]


@router.post("/analysis", response_model=DocumentResponse)
async def create_analysis(payload: AnalysisRequest, documents: DocumentDependency):
    return documents.create(payload.text, payload.title)


@router.get("/models", tags=["models"])
async def list_models(nlp: NLPDependency):
    return nlp.models()


@router.post("/sentiment")
async def sentiment(payload: AnalysisRequest, nlp: NLPDependency):
    return nlp.sentiment(payload.text)


@router.post("/summary")
async def summary(payload: AnalysisRequest, nlp: NLPDependency):
    return nlp.summary(payload.text)


@router.post("/plagiarism")
async def plagiarism(
    payload: AnalysisRequest, nlp: NLPDependency, documents: DocumentDependency
):
    return nlp.plagiarism(payload.text, documents.list())

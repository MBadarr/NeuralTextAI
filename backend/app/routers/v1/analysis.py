from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.nlp_capacity import limit_nlp_requests
from app.dependencies import get_document_service, get_nlp_service
from app.schemas.analysis import AnalysisRequest, SearchRequest, SummaryRequest
from app.schemas.document import DocumentResponse
from app.services.document_service import DocumentService
from app.services.nlp_service import NLPService

router = APIRouter(tags=["analysis"], dependencies=[Depends(limit_nlp_requests)])
NLPDependency = Annotated[NLPService, Depends(get_nlp_service)]
DocumentDependency = Annotated[DocumentService, Depends(get_document_service)]


@router.post("/analysis", response_model=DocumentResponse)
def create_analysis(payload: AnalysisRequest, documents: DocumentDependency):
    return documents.create(payload.text, payload.title)


@router.get("/models", tags=["models"])
def list_models(nlp: NLPDependency):
    return nlp.models()


@router.post("/sentiment")
def sentiment(payload: AnalysisRequest, nlp: NLPDependency):
    return nlp.sentiment(payload.text)


@router.post("/summary")
def summary(payload: SummaryRequest, nlp: NLPDependency):
    return nlp.summary(payload.text, payload.sentence_limit)


@router.post("/intent")
def intent(payload: AnalysisRequest, nlp: NLPDependency):
    return nlp.intent(payload.text)


@router.post("/emotions")
def emotions(payload: AnalysisRequest, nlp: NLPDependency):
    return nlp.emotions(payload.text)


@router.post("/keywords")
def keywords(payload: AnalysisRequest, nlp: NLPDependency):
    return nlp.keywords(payload.text)


@router.post("/search")
def search(payload: SearchRequest, nlp: NLPDependency, documents: DocumentDependency):
    return nlp.search(payload.query, documents.list(), payload.limit)


@router.post("/plagiarism")
def plagiarism(
    payload: AnalysisRequest, nlp: NLPDependency, documents: DocumentDependency
):
    return nlp.plagiarism(payload.text, documents.list())

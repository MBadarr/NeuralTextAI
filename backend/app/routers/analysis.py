from fastapi import APIRouter, HTTPException, status

from app.schemas.analysis import AnalysisRequest
from app.services.documents import document_store
from app.services.nlp import nlp_service

router = APIRouter()


@router.get("/health", tags=["system"])
async def health():
    return {
        "status": "ok",
        "service": "NeuralText AI",
        "model": nlp_service.model_name,
    }


@router.post("/analysis", tags=["analysis"])
async def create_analysis(payload: AnalysisRequest):
    document = document_store.create(payload.text, payload.title)
    return document


@router.get("/documents", tags=["documents"])
async def list_documents():
    return document_store.list()


@router.get("/documents/{document_id}", tags=["documents"])
async def get_document(document_id: str):
    document = document_store.get(document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    return document


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["documents"],
)
async def delete_document(document_id: str):
    if not document_store.delete(document_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )


@router.get("/models", tags=["models"])
async def list_models():
    return nlp_service.models()


@router.get("/insights", tags=["insights"])
async def get_insights():
    return document_store.insights()


@router.post("/sentiment", tags=["analysis"])
async def sentiment(payload: AnalysisRequest):
    return nlp_service.sentiment(payload.text)


@router.post("/summary", tags=["analysis"])
async def summary(payload: AnalysisRequest):
    return nlp_service.summary(payload.text)


@router.post("/plagiarism", tags=["analysis"])
async def plagiarism(payload: AnalysisRequest):
    return nlp_service.plagiarism(payload.text, document_store.list())


@router.post("/writing-feedback", tags=["writing"])
async def writing_feedback(payload: AnalysisRequest):
    return nlp_service.writing_feedback(payload.text)


@router.post("/autocomplete", tags=["writing"])
async def autocomplete(payload: AnalysisRequest):
    return nlp_service.autocomplete(payload.text)

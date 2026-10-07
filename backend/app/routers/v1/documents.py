from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.dependencies import get_document_service
from app.schemas.document import DocumentResponse, InsightsResponse
from app.services.document_service import DocumentService

router = APIRouter(tags=["documents"])
DocumentDependency = Annotated[DocumentService, Depends(get_document_service)]


@router.get("/documents", response_model=list[DocumentResponse])
async def list_documents(documents: DocumentDependency):
    return documents.list()


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str, documents: DocumentDependency):
    return documents.get(document_id)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: str, documents: DocumentDependency):
    documents.delete(document_id)


@router.get("/insights", response_model=InsightsResponse, tags=["insights"])
async def get_insights(documents: DocumentDependency):
    return documents.insights()

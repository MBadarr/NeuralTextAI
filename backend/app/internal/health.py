from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.config import settings
from app.dependencies import get_nlp_service
from app.services.nlp_service import NLPService

router = APIRouter(tags=["system"])


@router.get("/health")
async def health(nlp: Annotated[NLPService, Depends(get_nlp_service)]):
    return {
        "status": "ok",
        "service": settings.app_name,
        "model": nlp.model_name,
        "trained": nlp.model_name != "en_blank",
        "storage": "Neon PostgreSQL",
    }

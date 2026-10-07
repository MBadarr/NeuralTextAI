from fastapi import APIRouter

from app.routers.v1 import analysis, documents, writing

router = APIRouter()
router.include_router(analysis.router)
router.include_router(documents.router)
router.include_router(writing.router)

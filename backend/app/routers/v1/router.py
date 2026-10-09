from fastapi import APIRouter, Depends

from app.core.security import require_user
from app.routers.v1 import analysis, documents, writing

router = APIRouter(dependencies=[Depends(require_user)])
router.include_router(analysis.router)
router.include_router(documents.router)
router.include_router(writing.router)

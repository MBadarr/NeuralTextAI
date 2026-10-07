from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import DocumentNotFoundError
from app.core.logging import get_logger
from app.internal.health import router as health_router
from app.routers.v1.router import router
from app.services.nlp_service import nlp_service

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    nlp_service.load()
    logger.info("Loaded NLP model: %s", nlp_service.model_name)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Simple NLP analysis API.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(health_router)


@app.exception_handler(DocumentNotFoundError)
async def document_not_found(_: Request, error: DocumentNotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(error)})


@app.get("/", tags=["system"])
async def root():
    return {"name": "NeuralText AI", "docs": "/docs", "health": "/health"}


@app.get("/scalar", include_in_schema=False)
async def scalar_html():
    from scalar_fastapi import get_scalar_api_reference

    return get_scalar_api_reference(
        openapi_url=app.openapi_url,
        scalar_proxy_url="https://proxy.scalar.com",
    )

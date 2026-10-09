from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg import Error as DatabaseError
from psycopg_pool import PoolTimeout
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.exceptions import DocumentNotFoundError
from app.core.logging import get_logger
from app.dependencies import get_document_repository
from app.internal.health import router as health_router
from app.routers.v1.router import router
from app.services.nlp_service import nlp_service

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    factory = application.dependency_overrides.get(
        get_document_repository, get_document_repository
    )
    repository = factory()
    try:
        await run_in_threadpool(repository.initialize)
        nlp_service.load()
        logger.info("Loaded NLP model: %s", nlp_service.model_name)
        yield
    finally:
        await run_in_threadpool(repository.close)


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


@app.exception_handler(DatabaseError)
@app.exception_handler(PoolTimeout)
async def database_unavailable(_: Request, error: Exception):
    logger.error("Neon database request failed (%s)", type(error).__name__)
    return JSONResponse(
        status_code=503,
        content={"detail": "Database temporarily unavailable. Please retry."},
    )


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

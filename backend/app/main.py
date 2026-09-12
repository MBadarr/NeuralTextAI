from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers.analysis import router
from app.services.nlp import nlp_service


@asynccontextmanager
async def lifespan(_: FastAPI):
    nlp_service.load()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Simple NLP analysis API.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://neuraltext-ai.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


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

from pydantic import BaseModel, Field


class AnalysisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=100_000)
    title: str | None = Field(default=None, max_length=120)

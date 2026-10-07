from pydantic import BaseModel, Field, field_validator


class AnalysisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=100_000)
    title: str | None = Field(default=None, max_length=120)

    @field_validator("text")
    @classmethod
    def require_content(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Text must contain non-whitespace characters.")
        return value


class SummaryRequest(AnalysisRequest):
    sentence_limit: int = Field(default=3, ge=1, le=10)


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    limit: int = Field(default=20, ge=1, le=100)

    @field_validator("query")
    @classmethod
    def require_query(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Enter a search query.")
        return value

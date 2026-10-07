from pydantic import BaseModel

from app.schemas.analysis import AnalysisRequest


class WritingRequest(AnalysisRequest):
    """Keep the existing text/title request contract for writing endpoints."""


class WritingIssue(BaseModel):
    type: str
    message: str
    start: int
    end: int
    replacement: str | None = None


class WritingFeedbackResponse(BaseModel):
    issues: list[WritingIssue]
    issue_count: int
    warnings: list[str] = []


class AutocompleteResponse(BaseModel):
    suggestions: list[str]
    source: str = "workspace n-grams"

from datetime import datetime

from pydantic import BaseModel


class TokenResponse(BaseModel):
    text: str
    lemma: str
    part_of_speech: str
    is_stop: bool
    dependency: str = "Unavailable"
    head: str = ""
    start: int = 0
    end: int = 0


class EntityResponse(BaseModel):
    text: str
    label: str
    start: int
    end: int


class DocumentResponse(BaseModel):
    id: str
    title: str
    text: str
    language: str
    word_count: int
    sentence_count: int
    reading_time_minutes: float
    created_at: datetime
    tokens: list[TokenResponse]
    entities: list[EntityResponse]
    language_confidence: float = 0
    character_count: int = 0
    unique_word_count: int = 0
    noun_phrases: list[str] = []
    keywords: list[dict] = []
    word_frequencies: list[dict] = []
    readability: dict | None = None
    sentiment: dict = {}
    summary: str = ""
    processing_time_ms: float = 0
    model: str = ""
    warnings: list[str] = []


class InsightsResponse(BaseModel):
    total_documents: int
    total_words: int
    total_entities: int
    average_processing_time_ms: float = 0
    entity_counts: dict[str, int] = {}
    language_counts: dict[str, int] = {}
    sentiment_counts: dict[str, int] = {}

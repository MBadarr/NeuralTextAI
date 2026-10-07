from datetime import datetime

from pydantic import BaseModel


class TokenResponse(BaseModel):
    text: str
    lemma: str
    part_of_speech: str
    is_stop: bool


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
    reading_time_minutes: int
    created_at: datetime
    tokens: list[TokenResponse]
    entities: list[EntityResponse]


class InsightsResponse(BaseModel):
    total_documents: int
    total_words: int
    total_entities: int

"""Document domain types used by the in-memory repository."""

from datetime import datetime
from typing import NotRequired, TypedDict


class Token(TypedDict):
    text: str
    lemma: str
    part_of_speech: str
    is_stop: bool
    dependency: NotRequired[str]
    head: NotRequired[str]
    start: NotRequired[int]
    end: NotRequired[int]


class Entity(TypedDict):
    text: str
    label: str
    start: int
    end: int


class Document(TypedDict):
    id: str
    title: str
    text: str
    language: str
    word_count: int
    sentence_count: int
    reading_time_minutes: float
    created_at: datetime
    tokens: list[Token]
    entities: list[Entity]
    language_confidence: NotRequired[float]
    character_count: NotRequired[int]
    unique_word_count: NotRequired[int]
    noun_phrases: NotRequired[list[str]]
    keywords: NotRequired[list[dict]]
    word_frequencies: NotRequired[list[dict]]
    readability: NotRequired[dict | None]
    sentiment: NotRequired[dict]
    summary: NotRequired[str]
    processing_time_ms: NotRequired[float]
    model: NotRequired[str]
    warnings: NotRequired[list[str]]

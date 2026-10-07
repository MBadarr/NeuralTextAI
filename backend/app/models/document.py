"""Document domain types used by the in-memory repository."""

from datetime import datetime
from typing import TypedDict


class Token(TypedDict):
    text: str
    lemma: str
    part_of_speech: str
    is_stop: bool


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
    reading_time_minutes: int
    created_at: datetime
    tokens: list[Token]
    entities: list[Entity]

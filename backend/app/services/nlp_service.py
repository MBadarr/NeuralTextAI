import re
from datetime import UTC, datetime
from os import getenv
from uuid import uuid4

import spacy

from app.models.document import Document


class NLPService:
    def __init__(self):
        self.nlp = None
        self.model_name = "not loaded"

    def load(self):
        model_name = getenv("SPACY_MODEL", "en_core_web_sm")
        try:
            self.nlp = spacy.load(model_name)
            self.model_name = model_name
        except OSError:
            self.nlp = spacy.blank("en")
            self.nlp.add_pipe("sentencizer")
            self.model_name = "en_blank (install en_core_web_sm for full NLP)"

    def analyze(self, text: str, title: str | None = None) -> Document:
        if self.nlp is None:
            self.load()

        doc = self.nlp(text)
        words = sum(1 for token in doc if token.is_alpha)
        entities = [
            {
                "text": entity.text,
                "label": entity.label_,
                "start": entity.start_char,
                "end": entity.end_char,
            }
            for entity in doc.ents
        ]
        if not entities:
            entities = self._fallback_entities(text)

        return {
            "id": str(uuid4()),
            "title": title or "Untitled analysis",
            "text": text,
            "language": doc.lang_,
            "word_count": words,
            "sentence_count": max(1, len(list(doc.sents))),
            "reading_time_minutes": max(1, round(words / 220)),
            "created_at": datetime.now(UTC),
            "tokens": [
                {
                    "text": token.text,
                    "lemma": token.lemma_ or token.text.lower(),
                    "part_of_speech": token.pos_ or "—",
                    "is_stop": token.is_stop,
                }
                for token in doc
                if not token.is_space
            ],
            "entities": entities,
        }

    def models(self):
        if self.nlp is None:
            self.load()
        return [
            {
                "name": self.model_name,
                "language": "English",
                "components": self.nlp.pipe_names,
            }
        ]

    def sentiment(self, text: str):
        if self.nlp is None:
            self.load()
        positive = {"good", "great", "excellent", "happy", "love", "helpful", "success"}
        negative = {"bad", "poor", "terrible", "sad", "hate", "problem", "failed"}
        words = {
            (token.lemma_ or token.text).lower()
            for token in self.nlp(text)
            if token.is_alpha
        }
        score = len(words & positive) - len(words & negative)
        label = "Positive" if score > 0 else "Negative" if score < 0 else "Neutral"
        return {
            "label": label,
            "score": score,
            "confidence": min(0.99, 0.55 + abs(score) * 0.08),
        }

    def summary(self, text: str, sentence_limit: int = 3):
        if self.nlp is None:
            self.load()
        doc = self.nlp(text)
        sentences = [
            sentence.text.strip() for sentence in doc.sents if sentence.text.strip()
        ]
        return {
            "summary": " ".join(sentences[:sentence_limit]),
            "sentence_count": len(sentences),
        }

    def plagiarism(self, text: str, documents: list[dict]):
        words = set(text.lower().split())
        matches = []
        for document in documents:
            other_words = set(document["text"].lower().split())
            overlap = len(words & other_words) / max(1, len(words))
            if overlap >= 0.2:
                matches.append(
                    {
                        "document_id": document["id"],
                        "title": document["title"],
                        "overlap": round(overlap * 100, 1),
                    }
                )
        return {
            "match_percentage": max([item["overlap"] for item in matches], default=0),
            "matches": matches,
        }

    def sentences(self, text: str):
        if self.nlp is None:
            self.load()
        return [sentence.text for sentence in self.nlp(text).sents]

    def _fallback_entities(self, text: str):
        entities = []
        months = (
            "January|February|March|April|May|June|July|August|September|"
            "October|November|December"
        )
        patterns = [
            (
                rf"\b(?:{months})\s+\d{{1,2}}(?:,\s+\d{{4}})?\b|\b\d{{4}}-\d{{2}}-\d{{2}}\b",
                "DATE",
            ),
            (r"\b(?:Microsoft|Google|Apple|Amazon|OpenAI|Meta|Tesla|NASA)\b", "ORG"),
            (
                r"\b(?:New York|London|Paris|Tokyo|Berlin|Dubai|California|Pakistan|India|United States)\b",
                "GPE",
            ),
        ]
        for pattern, label in patterns:
            for match in re.finditer(pattern, text):
                entities.append(
                    {
                        "text": match.group(),
                        "label": label,
                        "start": match.start(),
                        "end": match.end(),
                    }
                )
        for match in re.finditer(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b", text):
            if not any(
                item["start"] <= match.start() < item["end"] for item in entities
            ):
                entities.append(
                    {
                        "text": match.group(),
                        "label": "PERSON",
                        "start": match.start(),
                        "end": match.end(),
                    }
                )
        return sorted(entities, key=lambda entity: entity["start"])


nlp_service = NLPService()

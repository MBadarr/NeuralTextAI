import re
from datetime import UTC, datetime
from os import getenv
from uuid import uuid4

import spacy


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

    def analyze(self, text: str, title: str | None = None):
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
        return {"label": label, "score": score, "confidence": min(0.99, 0.55 + abs(score) * 0.08)}

    def summary(self, text: str, sentence_limit: int = 3):
        if self.nlp is None:
            self.load()
        doc = self.nlp(text)
        sentences = [sentence.text.strip() for sentence in doc.sents if sentence.text.strip()]
        return {"summary": " ".join(sentences[:sentence_limit]), "sentence_count": len(sentences)}

    def plagiarism(self, text: str, documents: list[dict]):
        words = set(text.lower().split())
        matches = []
        for document in documents:
            other_words = set(document["text"].lower().split())
            overlap = len(words & other_words) / max(1, len(words))
            if overlap >= 0.2:
                matches.append({"document_id": document["id"], "title": document["title"], "overlap": round(overlap * 100, 1)})
        return {"match_percentage": max([item["overlap"] for item in matches], default=0), "matches": matches}

    def writing_feedback(self, text: str):
        issues = []
        if "  " in text:
            issues.append({"type": "style", "message": "Remove repeated spaces.", "start": text.find("  "), "end": text.find("  ") + 2})
        for word in ("teh", "recieve", "seperate", "definately", "occured", "wich"):
            start = text.lower().find(word)
            if start >= 0:
                corrections = {"teh": "the", "recieve": "receive", "seperate": "separate", "definately": "definitely", "occured": "occurred", "wich": "which"}
                issues.append({"type": "typo", "message": f"Did you mean '{corrections[word]}'?", "start": start, "end": start + len(word)})
        for sentence in self._sentences(text):
            stripped = sentence.strip()
            start = text.find(stripped)
            if stripped and stripped[0].islower():
                issues.append({"type": "structure", "message": "Start each sentence with a capital letter.", "start": start, "end": start + 1})
            if len(stripped.split()) > 35:
                issues.append({"type": "style", "message": "Consider splitting this long sentence.", "start": start, "end": start + len(stripped)})
        if text.rstrip() and text.rstrip()[-1] not in ".!?":
            issues.append({"type": "structure", "message": "Add punctuation at the end of the text.", "start": len(text.rstrip()) - 1, "end": len(text.rstrip())})
        return {"issues": issues[:20], "issue_count": len(issues)}

    def autocomplete(self, text: str):
        words = text.strip().lower().split()
        if not words:
            return {"suggestions": ["Start by describing your topic.", "This analysis explores", "The main idea is"]}
        last = words[-1].strip(".,!?")
        suggestions = {
            "the": ["the main point is", "the results show that", "the next step is"],
            "this": ["this suggests that", "this analysis focuses on", "this approach helps"],
            "we": ["we can improve this by", "we should consider", "we found that"],
            "i": ["I think that", "I would recommend", "I noticed that"],
            "because": ["because it provides", "because the data shows", "because this means"],
            "is": ["is important to note that", "is based on", "is likely to"],
            "are": ["are commonly used to", "are related to", "are expected to"],
        }.get(last, ["which means that", "and this helps to", "for example,"])
        return {"suggestions": suggestions}

    def _sentences(self, text: str):
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
            (rf"\b(?:{months})\s+\d{{1,2}}(?:,\s+\d{{4}})?\b|\b\d{{4}}-\d{{2}}-\d{{2}}\b", "DATE"),
            (r"\b(?:Microsoft|Google|Apple|Amazon|OpenAI|Meta|Tesla|NASA)\b", "ORG"),
            (r"\b(?:New York|London|Paris|Tokyo|Berlin|Dubai|California|Pakistan|India|United States)\b", "GPE"),
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
            if not any(item["start"] <= match.start() < item["end"] for item in entities):
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

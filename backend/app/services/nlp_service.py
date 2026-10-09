from collections import Counter
from datetime import UTC, datetime
from functools import lru_cache
from os import getenv
from threading import Lock
from time import perf_counter
from uuid import uuid4

import numpy as np
import pyphen
import snowballstemmer
import spacy
from langdetect import DetectorFactory, LangDetectException, detect_langs
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from app.models.document import Document
from app.services.text_classification import TextClassifier

DetectorFactory.seed = 0


class NLPService:
    def __init__(self):
        self.nlp = None
        self.model_name = "not loaded"
        self._lock = Lock()
        self._sentiment = SentimentIntensityAnalyzer()
        self._syllables = pyphen.Pyphen(lang="en_US")
        self._stemmer = snowballstemmer.stemmer("english")
        self._classifier = None
        self.parse = lru_cache(maxsize=16)(self._parse)

    def load(self):
        with self._lock:
            requested = getenv("SPACY_MODEL", "en_core_web_md")
            try:
                self.nlp = spacy.load(requested)
                self.model_name = requested
            except OSError:
                self.nlp = spacy.blank("en")
                self.nlp.add_pipe("sentencizer")
                self.model_name = "en_blank"
            self._classifier = TextClassifier(self.nlp)
            self.parse.cache_clear()

    def _parse(self, text: str):
        if self.nlp is None:
            self.load()
        return self.nlp(text)

    def language(self, text: str):
        if sum(character.isalpha() for character in text) < 20:
            return {"code": "und", "confidence": 0.0}
        try:
            detected = detect_langs(text[:5000])[0]
            return {
                "code": detected.lang if detected.prob >= 0.8 else "und",
                "confidence": round(detected.prob, 3),
            }
        except LangDetectException:
            return {"code": "und", "confidence": 0.0}

    def _warnings(self, language: str):
        warnings = []
        if self.model_name == "en_blank":
            warnings.append(
                "Trained spaCy model unavailable. Entity recognition, POS tags and dependency parsing require en_core_web_md."
            )
        if language not in ("en", "und"):
            warnings.append(
                "Detected non-English text. English linguistic analysis, sentiment and readability may be inaccurate."
            )
        elif language == "und":
            warnings.append("Language is uncertain; English analysis is assumed.")
        return warnings

    def analyze(self, text: str, title: str | None = None) -> Document:
        started = perf_counter()
        doc = self.parse(text)
        words = [token for token in doc if token.is_alpha]
        sentences = [sentence for sentence in doc.sents if sentence.text.strip()]
        language = self.language(text)
        frequencies = Counter(
            (token.lemma_ or token.text).lower() for token in words if not token.is_stop
        )
        entities = [
            {
                "text": e.text,
                "label": e.label_,
                "start": e.start_char,
                "end": e.end_char,
            }
            for e in doc.ents
        ]
        keywords = self.keywords(text)["keywords"]
        readability = (
            self.readability(text, doc) if language["code"] in ("en", "und") else None
        )
        result = {
            "id": str(uuid4()),
            "title": title or "Untitled analysis",
            "text": text,
            "language": language["code"],
            "language_confidence": language["confidence"],
            "word_count": len(words),
            "sentence_count": len(sentences),
            "reading_time_minutes": round(len(words) / 220, 2),
            "created_at": datetime.now(UTC),
            "character_count": len(text),
            "unique_word_count": len({token.lower_ for token in words}),
            "tokens": [
                {
                    "text": t.text,
                    "lemma": t.lemma_ or t.text.lower(),
                    "stem": self.stem(t.text, language["code"]),
                    "part_of_speech": t.pos_ or "Unavailable",
                    "is_stop": t.is_stop,
                    "dependency": t.dep_ or "Unavailable",
                    "head": t.head.text,
                    "start": t.idx,
                    "end": t.idx + len(t.text),
                }
                for t in doc
                if not t.is_space
            ],
            "entities": entities,
            "noun_phrases": [chunk.text for chunk in doc.noun_chunks]
            if doc.has_annotation("DEP")
            else [],
            "keywords": keywords,
            "word_frequencies": [
                {"word": word, "count": count}
                for word, count in frequencies.most_common(20)
            ],
            "readability": readability,
            "sentiment": self.sentiment(text),
            "intent": self._classifier.intent(doc, language["code"]),
            "emotions": self._classifier.emotions(doc, language["code"]),
            "summary": self.summary(text)["summary"],
            "model": self.model_name,
            "warnings": self._warnings(language["code"]),
        }
        result["processing_time_ms"] = round((perf_counter() - started) * 1000, 2)
        return result

    def models(self):
        if self.nlp is None:
            self.load()
        return [
            {
                "name": self.model_name,
                "language": "English",
                "components": self.nlp.pipe_names,
                "vectors": self.nlp.vocab.vectors_length,
                "trained": self.model_name != "en_blank",
                "capabilities": [
                    "tokenization",
                    "sentence segmentation",
                    "VADER sentiment",
                    "English intent classification",
                    "English emotion evidence",
                    "Snowball stemming",
                    "TF-IDF keywords",
                    "ranked summaries",
                    "language detection",
                    "spelling feedback",
                ]
                + (
                    ["entities", "lemmatization", "POS tagging", "dependency parsing"]
                    if self.model_name != "en_blank"
                    else []
                )
                + (["semantic vectors"] if self.nlp.vocab.vectors_length else []),
            }
        ]

    def sentiment(self, text: str):
        scores = self._sentiment.polarity_scores(text)
        score = scores["compound"]
        return {
            "label": "Positive"
            if score >= 0.05
            else "Negative"
            if score <= -0.05
            else "Neutral",
            "score": score,
            "confidence": abs(score),
            "positive": scores["pos"],
            "negative": scores["neg"],
            "neutral": scores["neu"],
            "method": "VADER",
            "emotions": self.emotions(text),
            "warnings": self._warnings(self.language(text)["code"]),
        }

    def stem(self, text: str, language: str = "en") -> str:
        if language not in ("en", "und") or not text.isalpha():
            return ""
        # Snowball's generated stemmer maintains mutable state per call.
        with self._lock:
            return self._stemmer.stemWord(text.lower())

    def intent(self, text: str):
        doc = self.parse(text)
        return self._classifier.intent(doc, self.language(text)["code"])

    def emotions(self, text: str):
        doc = self.parse(text)
        return self._classifier.emotions(doc, self.language(text)["code"])

    def keywords(self, text: str, limit: int = 10):
        sentences = self.sentences(text)
        if not sentences:
            return {"keywords": []}
        try:
            vectorizer = TfidfVectorizer(
                stop_words="english", ngram_range=(1, 2), max_features=5000
            )
            matrix = vectorizer.fit_transform(sentences)
        except ValueError:
            return {"keywords": []}
        weights = np.asarray(matrix.mean(axis=0)).ravel()
        terms = vectorizer.get_feature_names_out()
        indices = sorted(range(len(terms)), key=lambda i: (-weights[i], terms[i]))[
            :limit
        ]
        return {
            "keywords": [
                {"text": str(terms[i]), "score": round(float(weights[i]), 4)}
                for i in indices
            ]
        }

    def readability(self, text: str, doc=None):
        doc = doc if doc is not None else self.parse(text)
        words = [token.text for token in doc if token.is_alpha]
        sentences = max(1, sum(bool(sentence.text.strip()) for sentence in doc.sents))
        if not words:
            return {
                "flesch_reading_ease": 0.0,
                "flesch_kincaid_grade": 0.0,
                "average_sentence_length": 0.0,
                "lexical_diversity": 0.0,
            }
        syllables = sum(
            max(1, len(self._syllables.inserted(word.lower()).split("-")))
            for word in words
        )
        count = len(words)
        return {
            "flesch_reading_ease": round(
                206.835 - 1.015 * count / sentences - 84.6 * syllables / count, 1
            ),
            "flesch_kincaid_grade": round(
                max(0, 0.39 * count / sentences + 11.8 * syllables / count - 15.59), 1
            ),
            "average_sentence_length": round(count / sentences, 1),
            "lexical_diversity": round(
                len({word.lower() for word in words}) / count, 3
            ),
        }

    def summary(self, text: str, sentence_limit: int = 3):
        sentences = self.sentences(text)
        chosen = list(range(min(sentence_limit, len(sentences))))
        if len(sentences) > sentence_limit:
            try:
                matrix = TfidfVectorizer(
                    stop_words="english", max_features=5000
                ).fit_transform(sentences)
                centroid = np.asarray(matrix.mean(axis=0))
                scores = cosine_similarity(matrix, centroid).ravel()
                chosen = sorted(
                    sorted(range(len(sentences)), key=lambda i: (-scores[i], i))[
                        :sentence_limit
                    ]
                )
            except ValueError:
                pass
        return {
            "summary": " ".join(sentences[i] for i in chosen),
            "sentence_count": len(sentences),
            "selected_sentence_count": len(chosen),
            "method": "TF-IDF sentence ranking",
        }

    def plagiarism(self, text: str, documents: list[dict]):
        if not documents:
            return {
                "match_percentage": 0,
                "matches": [],
                "method": "TF-IDF cosine similarity",
                "compared_documents": 0,
            }
        try:
            matrix = TfidfVectorizer(
                lowercase=True, ngram_range=(1, 2), max_features=10000
            ).fit_transform([text] + [item["text"] for item in documents])
            similarities = cosine_similarity(matrix[:1], matrix[1:]).ravel()
        except ValueError:
            similarities = np.zeros(len(documents))
        matches = [
            {
                "document_id": item["id"],
                "title": item["title"],
                "overlap": round(float(score) * 100, 1),
            }
            for item, score in zip(documents, similarities, strict=True)
            if score >= 0.2
        ]
        matches.sort(key=lambda item: item["overlap"], reverse=True)
        return {
            "match_percentage": max((item["overlap"] for item in matches), default=0),
            "matches": matches,
            "method": "TF-IDF cosine similarity",
            "compared_documents": len(documents),
        }

    def search(self, query: str, documents: list[dict], limit: int = 20):
        if not documents:
            return {"results": [], "method": "no documents", "warnings": []}
        texts = [f"{item['title']} {item['text']}" for item in documents]
        query_doc = self.parse(query)
        scores = np.zeros(len(documents))
        method = "TF-IDF lexical similarity"
        warnings = []
        if self.nlp.vocab.vectors_length and query_doc.vector_norm:
            docs = [self.parse(text) for text in texts]
            scores = np.array(
                [
                    max(0.0, float(query_doc.similarity(doc))) if doc.vector_norm else 0
                    for doc in docs
                ]
            )
            method = "spaCy semantic vectors + TF-IDF"
        else:
            warnings.append(
                "Semantic vectors unavailable for this query; using lexical similarity."
            )
        try:
            matrix = TfidfVectorizer(
                stop_words="english", ngram_range=(1, 2), max_features=10000
            ).fit_transform([query] + texts)
            lexical = cosine_similarity(matrix[:1], matrix[1:]).ravel()
            scores = (
                0.65 * scores + 0.35 * lexical
                if method.startswith("spaCy")
                else lexical
            )
        except ValueError:
            pass
        ordered = sorted(range(len(documents)), key=lambda i: -scores[i])[:limit]
        return {
            "results": [
                {"document": documents[i], "score": round(float(scores[i]), 4)}
                for i in ordered
                if scores[i] > 0.05
            ],
            "method": method,
            "warnings": warnings,
        }

    def sentences(self, text: str):
        return [
            sentence.text.strip()
            for sentence in self.parse(text).sents
            if sentence.text.strip()
        ]


nlp_service = NLPService()

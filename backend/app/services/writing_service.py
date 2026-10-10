import re
from collections import Counter
from functools import lru_cache
from heapq import nsmallest

from spellchecker import SpellChecker

from app.services.nlp_service import NLPService


class WritingService:
    def __init__(self, nlp: NLPService):
        self.nlp = nlp
        self.spelling = SpellChecker(distance=1)
        self.spelling.word_frequency.load_words(
            ["spacy", "fastapi", "neuraltext", "nlp", "typescript", "javascript"]
        )
        self.correction = lru_cache(maxsize=512)(self.spelling.correction)
        self.prefix_completions = lru_cache(maxsize=128)(self._prefix_completions)

    def _prefix_completions(self, prefix: str):
        completions = (
            (word, self.spelling.word_frequency[word])
            for word in self.spelling.word_frequency.words()
            if word.startswith(prefix) and word != prefix
        )
        return [
            word
            for word, _ in nsmallest(
                5, completions, key=lambda item: (-item[1], item[0])
            )
        ]

    def feedback(self, text: str):
        language = self.nlp.language(text)["code"]
        if language not in ("en", "und"):
            return {
                "issues": [],
                "issue_count": 0,
                "warnings": ["Writing feedback currently supports English text."],
            }
        doc = self.nlp.parse(text)
        issues = []

        def add(kind, message, start, end, replacement=None):
            issues.append(
                {
                    "type": kind,
                    "message": message,
                    "start": start,
                    "end": end,
                    "replacement": replacement,
                }
            )

        for match in re.finditer(r" {2,}", text):
            add("style", "Use a single space.", match.start(), match.end(), " ")
        for match in re.finditer(r"\b(\w+)(\s+)\1\b", text, flags=re.IGNORECASE):
            add(
                "structure",
                "Remove the repeated word.",
                match.start(),
                match.end(),
                match.group(1),
            )
        for match in re.finditer(r" +([,.;:!?])", text):
            add(
                "structure",
                "Remove the space before punctuation.",
                match.start(),
                match.end(),
                match.group(1),
            )
        tokens = [
            token
            for token in doc
            if token.is_alpha
            and 3 <= len(token.text) <= 20
            and not token.ent_type_
            and token.pos_ != "PROPN"
            and not token.text.isupper()
        ]
        candidates = self.spelling.unknown(token.lower_ for token in tokens[:500])
        corrections = {word: self.correction(word) for word in sorted(candidates)[:30]}
        for token in tokens[:500]:
            corrected = corrections.get(token.lower_)
            if corrected and corrected != token.lower_:
                replacement = (
                    corrected.capitalize() if token.text[0].isupper() else corrected
                )
                add(
                    "typo",
                    f"Consider '{replacement}' instead of '{token.text}'.",
                    token.idx,
                    token.idx + len(token.text),
                    replacement,
                )
        for sentence in doc.sents:
            first = next((token for token in sentence if token.is_alpha), None)
            if first is not None and first.text[0].islower():
                add(
                    "structure",
                    "Start the sentence with a capital letter.",
                    first.idx,
                    first.idx + 1,
                    first.text[0].upper(),
                )
            if sum(token.is_alpha for token in sentence) > 35:
                add(
                    "style",
                    "Consider splitting this long sentence.",
                    sentence.start_char,
                    sentence.end_char,
                )
            for token in sentence:
                if token.dep_ == "auxpass":
                    add(
                        "style",
                        "Consider using active voice for a clearer sentence.",
                        sentence.start_char,
                        sentence.end_char,
                    )
                    break
        if text.rstrip() and text.rstrip()[-1] not in ".!?":
            end = len(text.rstrip())
            add("structure", "Add punctuation at the end of the text.", end, end, ".")
        issues.sort(key=lambda issue: (issue["start"], issue["end"]))
        warnings = (
            [
                "Spelling review is limited to the first 500 candidate words and 30 unknown words."
            ]
            if len(tokens) > 500 or len(candidates) > 30
            else []
        )
        return {"issues": issues[:50], "issue_count": len(issues), "warnings": warnings}

    def autocomplete(self, text: str, documents: list[dict] | None = None):
        context = re.findall(r"[\w']+", text.lower())
        if not context:
            return {"suggestions": [], "source": "workspace n-grams"}
        phrases = Counter()
        for content in [text] + [item["text"] for item in documents or []]:
            words = re.findall(r"[\w']+", content.lower())
            for size in (2, 1):
                if len(context) < size:
                    continue
                for i in range(size, len(words)):
                    if words[i - size : i] == context[-size:]:
                        phrase = " ".join(words[i : i + 3])
                        if phrase:
                            phrases[phrase] += size
        suggestions = [phrase for phrase, _ in phrases.most_common(5)]
        source = "workspace n-grams"
        if not suggestions and not text.endswith((" ", "\n")):
            prefix = context[-1]
            if len(prefix) >= 2 and self.spelling.unknown([prefix]):
                suggestions = self.prefix_completions(prefix)
                source = "dictionary prefix"
        return {"suggestions": suggestions, "source": source}

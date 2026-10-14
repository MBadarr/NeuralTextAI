"""Explainable English speech-act and emotion classification.

Intent uses grammatical cues and pretrained spaCy vector similarity to examples.
Emotion uses a curated lexicon with clause-local negation and intensity modifiers.
Scores are evidence/similarity scores, never calibrated probabilities.
"""

from collections import Counter
from re import compile
from unicodedata import name

import numpy as np
from spacy.tokens import Doc, Span, Token

EMOTION_WORDS = {
    "Joy": "happy joy joyful delighted excited thrilled glad cheerful elated ecstatic pleased grateful love wonderful celebrate enjoyment happiness",
    "Anger": "angry anger furious rage enraged irritated annoyed frustration frustrated outraged mad resentment resent",
    "Sadness": "sad sadness unhappy sorrow sorrowful grief grieving miserable depressed heartbroken disappointed lonely despair devastated mourn crying",
    "Fear": "afraid fear fearful scared terrified anxious anxiety worried worry frightened nervous panic apprehensive dread terrified",
    "Surprise": "surprised surprise astonished amazed stunned unexpected shocking shocked bewildered disbelief startled wow",
    "Disgust": "disgust disgusted disgusting revolting repulsive nauseating loathe loathing vile gross repugnant sickening",
}
EMOTION_LOOKUP = {
    word: label for label, words in EMOTION_WORDS.items() for word in words.split()
}
INTENT_EXAMPLES = {
    "Complaint": (
        "The product is broken and does not work.",
        "My delivery is late and the service is unacceptable.",
        "I am dissatisfied with this terrible experience.",
    ),
    "Appreciation": (
        "Thank you for your excellent help and support.",
        "I appreciate the wonderful service and recommend it.",
        "You did a fantastic job and I am grateful.",
        "The customer support team did an excellent job resolving my issue.",
        "Your assistance and the customer care made a positive difference.",
    ),
}
REQUEST = compile(
    r"^(?:please\b|(?:can|could|would|will)\s+you\b|(?:can|could|may)\s+i\b)"
    r"|\b(?:i|we)\s+(?:want|need|would like|request)\b"
)
APPRECIATION = compile(r"\b(?:thank(?:s| you)|appreciate|grateful|well done)\b")
QUESTION = compile(
    r"^(?:what|why|when|where|who|whom|whose|which|how|is|are|do|does|did|has|have|can|could|would|will)\b"
)
COMPLAINT = compile(
    r"\b(?:broken|unacceptable|dissatisfied|complaint|refund|not working|does not work|doesn't work|never arrived)\b"
)
NEGATORS = {"not", "n't", "never", "no", "neither", "nor", "hardly", "without"}
INTENSIFIERS = {"very", "extremely", "really", "so", "deeply", "absolutely"}
DAMPENERS = {"slightly", "somewhat", "rather", "little", "barely"}
LOSS_EVENT = compile(
    r"\b(?:lost|loss of)\s+(?:my|our|his|her|their)\s+"
    r"(?:(?:best|close|dear|beloved)\s+)?"
    r"(?:friend|mother|father|parent|child|son|daughter|wife|husband|partner|job|home)\b"
    r"|\b(?:my|our|his|her|their)\s+(?:friend|mother|father|parent|child|wife|husband|partner)\s+(?:died|passed away)\b"
)


def supports_english(text: str, language: str) -> bool:
    letters = [character for character in text if character.isalpha()]
    return (
        language in {"en", "und"}
        and bool(letters)
        and sum("LATIN" in name(character, "") for character in letters) / len(letters)
        >= 0.8
    )


def _context(token: Token, sentence: Span) -> list[Token]:
    # Stop at punctuation or a new coordinated clause to avoid negating the
    # emotion after "not sad, but happy" / "not angry and delighted".
    context = []
    for previous in reversed(token.doc[max(sentence.start, token.i - 4) : token.i]):
        if previous.is_punct or previous.lower_ in {"but", "however", "and", "yet"}:
            break
        context.append(previous)
    return list(reversed(context))


def _affirmed(pattern, sentence: Span) -> bool:
    for match in pattern.finditer(sentence.text.lower().strip()):
        # A cue inside a negated clause must not reverse the user's intent.
        offset = (
            sentence.start_char
            + len(sentence.text)
            - len(sentence.text.lstrip())
            + match.start()
        )
        token = next(
            (t for t in sentence if t.idx <= offset < t.idx + len(t.text)), None
        )
        if token is not None and not any(
            t.lower_ in NEGATORS for t in _context(token, sentence)
        ):
            return True
    return False


class TextClassifier:
    def __init__(self, nlp):
        self.nlp = nlp
        # Use only tokenization and static vectors, avoiding another full parse.
        self.examples = {
            label: [self._vector(nlp.make_doc(example)) for example in examples]
            for label, examples in INTENT_EXAMPLES.items()
        }

    @staticmethod
    def _vector(doc):
        vectors = [
            t.vector for t in doc if t.is_alpha and not t.is_stop and t.has_vector
        ]
        if not vectors:
            return None
        vector = np.mean(vectors, axis=0)
        norm = np.linalg.norm(vector)
        return vector / norm if norm else None

    @staticmethod
    def _unsupported(method: str):
        return {
            "label": "Unsupported",
            "method": method,
            "scores": {},
            "sentences": [],
            "warnings": ["This classifier supports English text only."],
        }

    def intent(self, doc: Doc, language: str):
        method = "English speech-act rules + spaCy semantic examples"
        if not supports_english(doc.text, language) and any(t.is_alpha for t in doc):
            return self._unsupported(method)
        results = []
        has_vectors = bool(self.nlp.vocab.vectors_length)
        for sentence in doc.sents:
            text = sentence.text.strip()
            if not text:
                continue
            lower = text.lower()
            scores = {}
            vector = self._vector(sentence) if has_vectors else None
            if vector is not None:
                for label, examples in self.examples.items():
                    scores[label] = round(
                        max(
                            (
                                float(np.dot(vector, example))
                                for example in examples
                                if example is not None
                            ),
                            default=0.0,
                        ),
                        4,
                    )
            evidence = "Declarative sentence"
            label = "Statement" if any(t.is_alpha for t in sentence) else "Unknown"
            root = sentence.root
            imperative = (
                doc.has_annotation("DEP")
                and root.pos_ == "VERB"
                and root.tag_ == "VB"
                and not any(t.dep_ in {"nsubj", "nsubjpass"} for t in root.children)
            )
            if REQUEST.search(lower) or imperative:
                label, evidence = "Request", "Request phrasing or imperative verb"
            elif text.endswith("?") or QUESTION.search(lower):
                label, evidence = "Question", "Question phrasing or question mark"
            elif _affirmed(APPRECIATION, sentence):
                label, evidence = "Appreciation", "Appreciation phrasing"
            elif _affirmed(COMPLAINT, sentence):
                label, evidence = "Complaint", "Complaint phrasing"
            elif scores and not any(t.lower_ in NEGATORS for t in sentence):
                ranked = sorted(scores, key=scores.get, reverse=True)
                first, second = ranked
                # Abstain rather than force every factual statement into an intent.
                if scores[first] >= 0.65 and scores[first] - scores[second] >= 0.08:
                    label, evidence = first, "Similarity to semantic examples"
            results.append(
                {
                    "text": sentence.text,
                    "start": sentence.start_char,
                    "end": sentence.end_char,
                    "label": label,
                    "evidence": evidence,
                    "scores": scores,
                }
            )
        counts = Counter(item["label"] for item in results)
        labels = list(counts)
        return {
            "label": labels[0]
            if len(labels) == 1
            else "Mixed"
            if labels
            else "Unknown",
            "scores": dict(counts),
            "sentences": results,
            "method": method if has_vectors else "English speech-act rules",
            "warnings": [
                "Intent labels describe communication purpose, not domain-specific actions. Similarity scores are not probabilities."
            ]
            + (
                []
                if has_vectors
                else ["Semantic vectors unavailable; using speech-act rules only."]
            )
            + (
                ["Language is uncertain; English classification is assumed."]
                if language == "und"
                else []
            ),
        }

    def emotions(self, doc: Doc, language: str):
        method = "English emotion lexicon with negation and intensity modifiers"
        if not supports_english(doc.text, language) and any(t.is_alpha for t in doc):
            return self._unsupported(method)
        totals = {label: 0.0 for label in EMOTION_WORDS}
        sentences = []
        for sentence in doc.sents:
            scores = {label: 0.0 for label in EMOTION_WORDS}
            evidence = []
            for match in LOSS_EVENT.finditer(sentence.text.lower()):
                token = next(
                    (
                        t
                        for t in sentence
                        if t.idx
                        <= sentence.start_char + match.start()
                        < t.idx + len(t.text)
                    ),
                    None,
                )
                negated = token is not None and any(
                    t.lower_ in NEGATORS for t in _context(token, sentence)
                )
                weight = 0.0 if negated else 1.0
                scores["Sadness"] += weight
                evidence.append(
                    {
                        "text": sentence.text[match.start() : match.end()],
                        "label": "Sadness",
                        "negated": negated,
                        "weight": weight,
                        "start": sentence.start_char + match.start(),
                        "end": sentence.start_char + match.end(),
                    }
                )
            for token in sentence:
                label = EMOTION_LOOKUP.get(token.lower_) or EMOTION_LOOKUP.get(
                    token.lemma_.lower()
                )
                if not label:
                    continue
                context = _context(token, sentence)
                negators = [t for t in context if t.lower_ in NEGATORS]
                # "not only happy" is emphasis rather than a negated emotion.
                negators = [
                    t
                    for t in negators
                    if not (
                        t.lower_ == "not"
                        and t.i + 1 < token.i
                        and doc[t.i + 1].lower_ == "only"
                    )
                ]
                negated = len(negators) % 2 == 1
                modifier = (
                    1.5 if any(t.lower_ in INTENSIFIERS for t in context) else 1.0
                )
                if any(t.lower_ in DAMPENERS for t in context):
                    modifier *= 0.5
                weight = 0.0 if negated else modifier
                scores[label] += weight
                evidence.append(
                    {
                        "text": token.text,
                        "label": label,
                        "negated": negated,
                        "weight": weight,
                        "start": token.idx,
                        "end": token.idx + len(token.text),
                    }
                )
            for label in totals:
                totals[label] += scores[label]
            sentences.append(
                {
                    "text": sentence.text,
                    "start": sentence.start_char,
                    "end": sentence.end_char,
                    "label": self._emotion_label(scores),
                    "scores": scores,
                    "evidence": evidence,
                }
            )
        return {
            "label": self._emotion_label(totals),
            "scores": totals,
            "sentences": sentences,
            "method": method + " and contextual loss cues",
            "warnings": [
                "Scores count weighted emotion evidence, not probabilities. Neutral means no supported emotion evidence. Sarcasm, implicit feelings and quoted speech may be misinterpreted."
            ]
            + (
                ["Language is uncertain; English classification is assumed."]
                if language == "und"
                else []
            ),
        }

    @staticmethod
    def _emotion_label(scores: dict):
        maximum = max(scores.values(), default=0)
        if not maximum:
            return "Neutral"
        labels = [label for label, score in scores.items() if score == maximum]
        return labels[0] if len(labels) == 1 else "Mixed"

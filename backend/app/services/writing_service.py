from app.services.nlp_service import NLPService


class WritingService:
    """Writing feedback rules and context-based completion suggestions."""

    def __init__(self, nlp: NLPService):
        self.nlp = nlp

    def feedback(self, text: str):
        issues = []
        if "  " in text:
            issues.append(
                {
                    "type": "style",
                    "message": "Remove repeated spaces.",
                    "start": text.find("  "),
                    "end": text.find("  ") + 2,
                }
            )
        for word in ("teh", "recieve", "seperate", "definately", "occured", "wich"):
            start = text.lower().find(word)
            if start >= 0:
                corrections = {
                    "teh": "the",
                    "recieve": "receive",
                    "seperate": "separate",
                    "definately": "definitely",
                    "occured": "occurred",
                    "wich": "which",
                }
                issues.append(
                    {
                        "type": "typo",
                        "message": f"Did you mean '{corrections[word]}'?",
                        "start": start,
                        "end": start + len(word),
                    }
                )
        for sentence in self.nlp.sentences(text):
            stripped = sentence.strip()
            start = text.find(stripped)
            if stripped and stripped[0].islower():
                issues.append(
                    {
                        "type": "structure",
                        "message": "Start each sentence with a capital letter.",
                        "start": start,
                        "end": start + 1,
                    }
                )
            if len(stripped.split()) > 35:
                issues.append(
                    {
                        "type": "style",
                        "message": "Consider splitting this long sentence.",
                        "start": start,
                        "end": start + len(stripped),
                    }
                )
        if text.rstrip() and text.rstrip()[-1] not in ".!?":
            issues.append(
                {
                    "type": "structure",
                    "message": "Add punctuation at the end of the text.",
                    "start": len(text.rstrip()) - 1,
                    "end": len(text.rstrip()),
                }
            )
        return {"issues": issues[:20], "issue_count": len(issues)}

    def autocomplete(self, text: str):
        words = text.strip().lower().split()
        if not words:
            return {
                "suggestions": [
                    "Start by describing your topic.",
                    "This analysis explores",
                    "The main idea is",
                ]
            }
        last = words[-1].strip(".,!?")
        suggestions = {
            "the": ["the main point is", "the results show that", "the next step is"],
            "this": [
                "this suggests that",
                "this analysis focuses on",
                "this approach helps",
            ],
            "we": ["we can improve this by", "we should consider", "we found that"],
            "i": ["I think that", "I would recommend", "I noticed that"],
            "because": [
                "because it provides",
                "because the data shows",
                "because this means",
            ],
            "is": ["is important to note that", "is based on", "is likely to"],
            "are": ["are commonly used to", "are related to", "are expected to"],
        }.get(last, ["which means that", "and this helps to", "for example,"])
        return {"suggestions": suggestions}

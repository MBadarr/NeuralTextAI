# NeuralText AI backend

The backend is a layered FastAPI application. Public controllers live under
`routers/v1`, services implement NLP and writing behavior, and repositories
own document storage. Schemas validate HTTP data; models describe domain data.

## Run locally

From the `backend/` directory (Python 3.14 or newer and uv required):

```bash
uv sync
uv run uvicorn app.main:app --reload
```

The application entrypoint is `app.main:app`. It initializes the spaCy service
during startup, configures CORS for the frontend, and preserves `/docs`,
`/redoc`, `/openapi.json`, and `/scalar`.

## API endpoints

For deployment, use exactly the same `NEON_AUTH_BASE_URL` as the Vercel
frontend. `NEON_AUTH_JWKS_URL` is optional and derives from that base URL plus
`/.well-known/jwks.json`; an explicit override must match. Deploy backend
changes separately from Vercel frontend changes and check Vercel's `API_URL`
points to that backend. Signing-key failures expose safe codes:
`signing_key_not_found` (401), `jwks_configuration_mismatch`,
`invalid_jwks_url`, `invalid_jwks_response`, and `jwks_unavailable` (503).
If the response still reports generic `PyJWKClientError`, the updated backend
code is not serving the request.

Workspace endpoints require `Authorization: Bearer <Neon JWT>`. The Next.js
server proxy supplies this after checking the live session and verified email.
Direct API calls must also supply a valid signed token. `core/security.py`
validates the signature against `NEON_AUTH_JWKS_URL`, expiry, issuer, audience,
and user identity; anonymous tokens are rejected. JWTs remain valid until their
short expiry with a 30-second clock-skew tolerance, while the frontend proxy also
enforces live session revocation.
The default issuer and audience are `NEON_AUTH_BASE_URL`'s origin without
the path, matching signed-in Managed Better Auth tokens. Optional
`NEON_AUTH_ISSUER` / `NEON_AUTH_AUDIENCE` overrides support
provider configuration changes. Health and documentation routes remain public.
The frontend and backend must use the same Neon Auth endpoint and branch. A
different provider or branch produces a token rejection, surfaced as a 502 by
the frontend proxy; the response's `code` and backend warning identify the
failure category without exposing tokens.

Document creation, lists, reads, deletion, insights, search and plagiarism
comparisons are scoped to the authenticated user. Documents and analysis payloads persist in Neon PostgreSQL using the existing
`DATABASE_URL`. Indexed owner-scoped queries prevent access to other users'
documents. Records imported without an owner remain hidden until an
administrator explicitly assigns ownership. Row-level security prevents
non-owner database roles from directly reading the document table; server
requests use the database owner role and enforce the signed-in owner in SQL.
Object Storage integration is outside this authentication change.

All endpoints use JSON. Analysis and writing endpoints accept:

```json
{ "text": "Text to process", "title": "Optional title" }
```

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service and loaded model status |
| POST | `/analysis` | Analyze text and store the document |
| GET | `/documents` | List analyzed documents |
| GET | `/documents/{document_id}` | Fetch one document |
| DELETE | `/documents/{document_id}` | Delete one document |
| GET | `/insights` | Aggregate document, word, and entity totals |
| GET | `/models` | Loaded model and pipeline components |
| POST | `/sentiment` | VADER sentiment with polarity breakdown |
| POST | `/intent` | Sentence-level English communication intent |
| POST | `/emotions` | Six English emotion categories with negation and evidence |
| POST | `/summary` | Ranked extractive summary; optional `sentence_limit` (1â€“10) |
| POST | `/plagiarism` | Compare text with stored documents |
| POST | `/writing-feedback` | Typos, structure, punctuation, and style issues |
| POST | `/autocomplete` | Workspace n-gram and dictionary-prefix completions |
| POST | `/keywords` | TF-IDF keyword and keyphrase extraction |
| POST | `/entities` | English entity mentions, character spans, and type counts; does not save a document |
| POST | `/search` | Semantic vector and lexical document ranking (`query`, `limit`) |

## Structure

### Reliability boundaries

English annotations, writing review, sentiment, and word completion reject
unsupported languages and short non-Latin text instead of returning English
predictions. Generic keyword and summary extraction can process other scripts,
but sentence segmentation still uses the English tokenizer.

Writing checks preserve mandative clauses such as "I suggest that he have a rest"
and linking adjectives such as "The food tastes good". Action-adverb corrections
are limited to selected verbs; this remains a bounded rule checker.
The first 50 issues are returned, with a warning when more are available.

Emotion evidence includes explicit emotion words and a small set of contextual
loss cues, with negation handling. These cues are not a comprehensive understanding
of emotion. Sentiment reports `Uncertain` when recognized irony or loss cues conflict
with its lexical score. The score remains VADER's raw lexical score; the legacy
`confidence` field is always zero because this method has no calibrated confidence.
Other sarcasm and implicit meanings may still be missed.

Summaries omit duplicate sentences and preserve original wording. Similarity
reports the true highest score, even below the 20% threshold used for the match
list. Semantic search still requires the optional vector model; its lexical
fallback is explicitly labeled. Readability scores remain estimates.

Regression tests cover these boundaries, model fallback, authentication, document
ownership, and request capacity. PostgreSQL integration tests require a separate
`TEST_DATABASE_URL`; unit tests do not validate the deployed database or browser.

The four primary tools have separate workflows. Only the text analyzer stores
a full analysis. Entity recognition runs the trained spaCy NER pipeline and
returns highlighted mentions and counts. Writing feedback includes dependency-based
pronoun agreement checks for present-tense forms of be, have, and do, alongside
spelling, punctuation, and style review; it is not a comprehensive grammar checker.
Autocomplete ranks one- and two-word contexts from the draft and saved documents,
stops at sentence boundaries, and completes partial words using workspace vocabulary
or dictionary frequency. It is corpus-based completion, not generative text.

### Intent, emotion, and stemming

New `/analysis` results include `intent`, `emotions`, and a `stem` per alphabetic
English token. `/sentiment` also includes the emotion result. These fields persist
in the existing Neon JSON payload; older documents remain readable without a
database migration. Re-analyze old text to populate the new fields.

Intent identifies Question, Request, Complaint, Appreciation, and Statement per
sentence (Mixed for different purposes). It combines English speech-act rules
with similarity to curated examples using the installed spaCy static vectors.
Without vectors, it explicitly reports rule-only classification. This is a
general communication-purpose classifier, not domain-specific action extraction.
Top-level intent scores are sentence counts; sentence scores are cosine similarities.

Emotion detects Joy, Anger, Sadness, Fear, Surprise, and Disgust using a curated
English lexicon, local negation, and intensity modifiers. Scores are weighted
evidence counts, not probabilities. Negated evidence is retained but excluded
from scores; absence of evidence is Neutral, not proof of an emotional state.
This lightweight classifier can miss implicit feelings and misread sarcasm or
quoted speech. Unsupported detected languages return Unsupported instead of an
English prediction. Both tools are local and do not transmit text to another service.

Stems use the official Snowball English algorithm (Porter2), separately from
spaCy dictionary lemmas. Punctuation and detected non-English tokens have an
empty stem. Stems may not be valid dictionary words.

```text
backend/
â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ __init__.py
â”‚   â”œâ”€â”€ main.py
â”‚   â”œâ”€â”€ dependencies.py
â”‚   â”œâ”€â”€ routers/
â”‚   â”‚   â”œâ”€â”€ __init__.py
â”‚   â”‚   â””â”€â”€ v1/
â”‚   â”‚       â”œâ”€â”€ __init__.py
â”‚   â”‚       â”œâ”€â”€ router.py
â”‚   â”‚       â”œâ”€â”€ analysis.py
â”‚   â”‚       â”œâ”€â”€ documents.py
â”‚   â”‚       â””â”€â”€ writing.py
â”‚   â”œâ”€â”€ internal/
â”‚   â”‚   â”œâ”€â”€ __init__.py
â”‚   â”‚   â”œâ”€â”€ admin.py
â”‚   â”‚   â”œâ”€â”€ health.py
â”‚   â”‚   â””â”€â”€ tasks.py
â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”œâ”€â”€ __init__.py
â”‚   â”‚   â”œâ”€â”€ nlp_service.py
â”‚   â”‚   â”œâ”€â”€ document_service.py
â”‚   â”‚   â””â”€â”€ writing_service.py
â”‚   â”œâ”€â”€ repositories/
â”‚   â”‚   â”œâ”€â”€ __init__.py
â”‚   â”‚   â””â”€â”€ document_repository.py
â”‚   â”œâ”€â”€ models/
â”‚   â”‚   â”œâ”€â”€ __init__.py
â”‚   â”‚   â””â”€â”€ document.py
â”‚   â”œâ”€â”€ schemas/
â”‚   â”‚   â”œâ”€â”€ __init__.py
â”‚   â”‚   â”œâ”€â”€ analysis.py
â”‚   â”‚   â”œâ”€â”€ document.py
â”‚   â”‚   â””â”€â”€ writing.py
â”‚   â”œâ”€â”€ core/
â”‚   â”‚   â”œâ”€â”€ __init__.py
â”‚   â”‚   â”œâ”€â”€ config.py
â”‚   â”‚   â”œâ”€â”€ security.py
â”‚   â”‚   â”œâ”€â”€ exceptions.py
â”‚   â”‚   â””â”€â”€ logging.py
â”‚   â””â”€â”€ db/
â”‚       â”œâ”€â”€ __init__.py
â”‚       â”œâ”€â”€ session.py
â”‚       â”œâ”€â”€ base.py
â”‚       â””â”€â”€ migrations/
â”‚           â””â”€â”€ README.md
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ __init__.py
â”‚   â”œâ”€â”€ controllers/
â”‚   â”‚   â”œâ”€â”€ __init__.py
â”‚   â”‚   â”œâ”€â”€ test_health.py
â”‚   â”‚   â””â”€â”€ v1/
â”‚   â”‚       â”œâ”€â”€ __init__.py
â”‚   â”‚       â”œâ”€â”€ test_analysis.py
â”‚   â”‚       â”œâ”€â”€ test_nlp_features.py
â”‚   â”‚       â”œâ”€â”€ test_documents.py
â”‚   â”‚       â””â”€â”€ test_writing.py
â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”œâ”€â”€ __init__.py
â”‚   â”‚   â”œâ”€â”€ test_nlp_service.py
â”‚   â”‚   â”œâ”€â”€ test_document_service.py
â”‚   â”‚   â””â”€â”€ test_writing_service.py
â”‚   â””â”€â”€ repositories/
â”‚       â”œâ”€â”€ __init__.py
â”‚       â””â”€â”€ test_document_repository.py
â”œâ”€â”€ pyproject.toml
â””â”€â”€ README.md
```

`routers/v1/router.py` assembles the public API. Its routes retain their existing
paths (for example `/analysis`, not `/v1/analysis`) so the frontend remains
compatible. `internal/health.py` owns `/health`; admin and tasks remain future
extension points with no exposed routes.

Request flow: **controller â†’ service â†’ repository** for documents, or
**controller â†’ NLP/writing service** for text tools. `dependencies.py` wires
services and the shared PostgreSQL repository using FastAPI dependencies, which
tests can override. Services raise domain exceptions; `main.py` converts missing
documents into HTTP 404 responses.

`models/document.py` contains typed domain dictionaries, while `schemas/` holds
Pydantic request/response models. `db/session.py` owns a bounded Psycopg
connection pool; transactions commit on success and roll back on failure.
`db/base.py` applies versioned SQL files from `db/migrations` during startup,
under a PostgreSQL advisory lock so concurrent app instances migrate safely.
Connections are checked before reuse and closed at shutdown. Prepared statements
are disabled for compatibility with Neon's pooled connection endpoint.

Backend `.env` settings include `DATABASE_URL` (required PostgreSQL connection
string), `FRONTEND_URL` (default `http://localhost:3000`), and `SPACY_MODEL`
(default `en_core_web_sm`). Production has no local storage fallback. Preserve
Neon's TLS settings in the connection string; TLS is required by default.
Copy `.env.example` to `.env` to customize settings. The trained English model is
installed by `uv sync` using the official spaCy release wheel. If the selected
model is absent, the API uses a blank English pipeline and explicitly reports
its limitations; it does not invent entities or POS tags.

Run tests with:

```bash
uv run python -m unittest discover -s tests -v
```

Normal tests use isolated in-memory repositories and do not touch Neon.
To also run persistence, JSON/date round-trip, and ownership integration checks,
set `TEST_DATABASE_URL` explicitly to a PostgreSQL test database and run the
same test command. These checks use unique records and clean up only their own
IDs; they never truncate tables. A separate Neon test branch is recommended.

The local `data/` directory is ignored by Git and can hold a JSON backup of
previously imported records; it is never used for runtime persistence.
Python may create `__pycache__` folders during execution; `.gitignore` excludes
them and they are not application source.

## NLP implementation

- spaCy `en_core_web_sm`: tokenization, sentence segmentation, lemmas, POS,
  dependencies, noun phrases, and named entities. The optional `en_core_web_md`
  model also supplies static semantic word vectors.
- VADER: English sentiment with negation, emphasis, and punctuation handling.
  The compound score is intensity, not a calibrated prediction probability.
  The legacy `confidence` field remains for compatibility and equals absolute
  compound intensity; the UI does not label it confidence.
- scikit-learn: TF-IDF keywords, sentence ranking, and cosine text similarity.
  Summaries select up to the requested number of sentences and preserve order.
- langdetect: deterministic language identification on a sample of the text.
  Very short input is reported as `und`; multilingual linguistic pipelines are
  not installed. Non-English analysis includes a limitation message.
- pyspellchecker: dictionary-based English spelling suggestions with correction
  offsets. Custom project vocabulary and recognized proper nouns are excluded.
- Pyphen: approximate English syllables used in Flesch readability formulas.
- Writing rules: repeated words/spaces, punctuation, capitalization, sentence
  length, and parser-based passive voice. This is not a complete grammar engine.
- Autocomplete: n-grams from saved documents and the current text, with a
  dictionary-prefix fallback for incomplete unknown words. Suggestions are
  continuations, not generated LLM sentences.

Analysis responses include the original fields plus keywords, word frequencies,
noun phrases, token dependencies/offsets, readability, sentiment, summary, model
information, warnings, and processing time. Token/entity/correction offsets are
Unicode code-point offsets; the frontend handles emoji correctly.

Search blends semantic vector cosine similarity with TF-IDF. If vectors are
unavailable, it reports a lexical fallback. Similarity scores are not relevance
probabilities. Plagiarism comparison is limited to saved workspace documents;
it neither searches the web nor proves copying. All inference runs locally,
with no API key or runtime model/corpus downloads.

CPU-bound text routes use synchronous FastAPI handlers so work runs in the
thread pool rather than blocking the async event loop. Recent parses and spelling
corrections are cached with bounded instance caches. Spelling review caps its
work and reports limits for long inputs.

## Production memory and OOM restarts

Run one application worker per instance initially: each worker loads a separate
spaCy model and scientific Python libraries. Measure the cloud instance's peak
memory under analysis and writing requests, and allocate headroom above it. A
local Windows measurement with `en_core_web_md` reached approximately 481 MiB
for a short analysis before API and database overhead; this is not a Linux/cloud
memory guarantee. A 500 MiB instance can be insufficient for that model.
With the small model, the same short input returned HTTP 200 and the API,
analysis, writing-feedback, and autocomplete checks peaked at approximately
318 MiB locally using isolated in-memory test storage. Production PostgreSQL,
Linux runtime differences, long texts, and larger workspaces still require
verification against cloud metrics.

The default installation now includes `en_core_web_sm` for low-memory hosting.
In FastAPI Cloud, set `SPACY_MODEL=en_core_web_sm` and redeploy the updated code
and lockfile. An existing `SPACY_MODEL=en_core_web_md` environment variable
overrides the new default and must be changed. Confirm `/health` reports
`model: en_core_web_sm` and `trained: true`, then watch cloud memory metrics
while running analysis and writing requests. No model is downloaded at runtime.

The small model retains trained entities, POS, dependencies, lemmatization,
sentiment, emotions, stemming, summaries, and writing tools. It has no static
word vectors: search uses TF-IDF lexical matching, and intent classification
uses speech-act rules. API warnings and `/models` report these limitations.
For vector-based semantics on a sufficiently large instance, install the
optional model with `uv sync --extra semantic` and select
`SPACY_MODEL=en_core_web_md`. Smaller models have different prediction accuracy;
the low-memory profile does not promise identical results or a fixed memory cap.

NLP and writing endpoints share one processing slot per worker. Overlapping
requests receive HTTP 503 with `Retry-After: 1` instead of running simultaneous
inference, plus `X-Service-Error: nlp_busy` so clients can distinguish a safe
capacity retry from a database or authentication failure. Health, model metadata,
and document reads remain available. The slot is released
even when processing fails. The model loads once per service instance, unused
sentence-recognizer weights are excluded, and `doc_cleaner` removes intermediate
tensors after parsing. Up to four texts of at most 10,000 characters are cached;
larger parses are not retained. NER, POS, dependencies, and lemmatization remain
enabled; static semantic vectors are available with the optional medium model.
Autocomplete selects five suggestions without
sorting and retaining every matching dictionary entry.

FastAPI Cloud's `Degraded (OOM)` status means the process exceeded its memory
allocation. It can cause `EOF` or 502 responses followed by a return to Ready
after a restart. Deploy these changes and configure adequate instance memory;
changing CORS or Neon auth URLs cannot resolve an OOM kill.

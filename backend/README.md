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
| POST | `/summary` | Ranked extractive summary; optional `sentence_limit` (1–10) |
| POST | `/plagiarism` | Compare text with stored documents |
| POST | `/writing-feedback` | Typos, structure, punctuation, and style issues |
| POST | `/autocomplete` | Workspace n-gram and dictionary-prefix completions |
| POST | `/keywords` | TF-IDF keyword and keyphrase extraction |
| POST | `/search` | Semantic vector and lexical document ranking (`query`, `limit`) |

## Structure

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── dependencies.py
│   ├── routers/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py
│   │       ├── analysis.py
│   │       ├── documents.py
│   │       └── writing.py
│   ├── internal/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── health.py
│   │   └── tasks.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── nlp_service.py
│   │   ├── document_service.py
│   │   └── writing_service.py
│   ├── repositories/
│   │   ├── __init__.py
│   │   └── document_repository.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── document.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── analysis.py
│   │   ├── document.py
│   │   └── writing.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── security.py
│   │   ├── exceptions.py
│   │   └── logging.py
│   └── db/
│       ├── __init__.py
│       ├── session.py
│       ├── base.py
│       └── migrations/
│           └── README.md
├── tests/
│   ├── __init__.py
│   ├── controllers/
│   │   ├── __init__.py
│   │   ├── test_health.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── test_analysis.py
│   │       ├── test_nlp_features.py
│   │       ├── test_documents.py
│   │       └── test_writing.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── test_nlp_service.py
│   │   ├── test_document_service.py
│   │   └── test_writing_service.py
│   └── repositories/
│       ├── __init__.py
│       └── test_document_repository.py
├── pyproject.toml
└── README.md
```

`routers/v1/router.py` assembles the public API. Its routes retain their existing
paths (for example `/analysis`, not `/v1/analysis`) so the frontend remains
compatible. `internal/health.py` owns `/health`; admin and tasks remain future
extension points with no exposed routes.

Request flow: **controller → service → repository** for documents, or
**controller → NLP/writing service** for text tools. `dependencies.py` wires
services and the shared SQLite repository using FastAPI dependencies, which
tests can override. Services raise domain exceptions; `main.py` converts missing
documents into HTTP 404 responses.

`models/document.py` contains typed domain dictionaries, while `schemas/` holds
Pydantic request/response models. `db/base.py` exposes SQLModel metadata and
`db/session.py` manages SQLite connections. The repository creates its document
table when initialized. `db/base.py` reserves SQLModel metadata for future ORM
migrations; the current adapter uses Python’s standard-library SQLite driver.

Backend `.env` settings include `FRONTEND_URL` (default
`http://localhost:3000`), `SPACY_MODEL` (default `en_core_web_md`), and optional
`DOCUMENT_DATABASE` (default `backend/data/neuraltext.sqlite3`). Copy
`.env.example` to `.env` to customize settings. The trained English model is
installed by `uv sync` using the official spaCy release wheel. If the selected
model is absent, the API uses a blank English pipeline and explicitly reports
its limitations; it does not invent entities or POS tags.

Run tests with:

```bash
uv run python -m unittest discover -s tests -v
```

Documents persist in SQLite across restarts. Tests use isolated repositories
and temporary databases. The local `data/` directory is ignored by Git. Python may create `__pycache__` folders during
execution; `.gitignore` excludes them and they are not application source.

## NLP implementation

- spaCy `en_core_web_md`: tokenization, sentence segmentation, lemmas, POS,
  dependencies, noun phrases, named entities, and semantic word vectors.
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

# NeuralText AI backend

The backend is a layered FastAPI application. Public controllers live under
`routers/v1`, services implement NLP and writing behavior, and repositories
own document storage. Schemas validate HTTP data; models describe domain data.

## Run locally

From the `backend/` directory (Python 3.14 or newer and uv required):

```bash
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
| POST | `/sentiment` | Heuristic sentiment result |
| POST | `/summary` | Extractive summary |
| POST | `/plagiarism` | Compare text with stored documents |
| POST | `/writing-feedback` | Typos, structure, punctuation, and style issues |
| POST | `/autocomplete` | Context-based completion suggestions |

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
services and the shared in-memory repository using FastAPI dependencies, which
tests can override. Services raise domain exceptions; `main.py` converts missing
documents into HTTP 404 responses.

`models/document.py` contains typed domain dictionaries, while `schemas/` holds
Pydantic request/response models. `db/base.py` exposes SQLModel metadata and
`db/session.py` reserves the session boundary; no database is connected yet.

Backend `.env` settings include `FRONTEND_URL` (default
`http://localhost:3000`) and `SPACY_MODEL` (default `en_core_web_sm`). The NLP
service falls back to a blank English pipeline if the selected model is absent.

Run tests with:

```bash
uv run python -m unittest discover -s tests -v
```

The MVP uses in-memory storage. Python may create `__pycache__` folders during
execution; `.gitignore` excludes them and they are not application source.

# NeuralText AI backend

The backend is a package-first FastAPI application. HTTP concerns stay in
routers, NLP and document behavior stays in services, and configuration,
schemas, models, and persistence boundaries are kept separate under `app/`.

## Run locally

From the `backend/` directory:

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

- `app/main.py`: application factory configuration, lifespan, CORS, root, and
  Scalar route.
- `app/routers/analysis.py`: analysis, document, insight, model, and writing
  endpoints.
- `app/services/nlp.py`: spaCy loading, fallback NER, sentiment, summary,
  plagiarism, feedback, and autocomplete logic.
- `app/services/documents.py`: in-memory document repository and aggregates.
- `app/schemas/`: Pydantic request and response boundaries.
- `app/core/`: environment configuration and security extension points.
- `app/db/`: future database adapter and migrations.
- `app/internal/`: internal administration extension points.
- `tests/`: standard-library `unittest` integration tests.

Run tests with:

```bash
uv run python -m unittest discover -s tests -v
```

The MVP uses in-memory storage. Python may create `__pycache__` folders during
execution; `.gitignore` excludes them and they are not application source.

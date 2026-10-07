# NeuralText AI

NeuralText AI is a text-first NLP workspace for understanding and improving
written content. Users can paste text into a responsive dashboard and receive
useful language insights without uploading files.

The workspace combines automated text analysis with practical writing tools:

- **Text analysis:** word count, sentence count, tokens, reading time, and
  language information.
- **Named Entity Recognition:** identifies people, organizations, locations,
  and dates in text.
- **Writing assistance:** detects common typos, punctuation problems, sentence
  structure issues, and style concerns while the user types.
- **Predictive text:** suggests continuations learned from workspace text and
  dictionary completions for partial words.
- **Sentiment analysis:** identifies whether text is positive, negative, or
  neutral.
- **Text summary:** creates a short extractive summary from longer text.
- **Plagiarism comparison:** compares new text with documents already analyzed
  in the workspace.
- **Workspace insights:** provides document history, entity totals, analytics,
  semantic search, and active NLP model information.

The dashboard is designed to be simple and responsive, with sidebar
navigation, desktop expand/minimize behavior, a mobile navigation drawer, and
shared navigation state managed through Zustand. The backend is powered by
FastAPI and spaCy, while the frontend is built with Next.js and Tailwind CSS.

The backend now includes a trained spaCy English model with word vectors, VADER
sentiment, scikit-learn ranking and similarity, langdetect, pyspellchecker, and
Pyphen. Additional features include keyword extraction, readability, noun
phrases, dependency inspection, entity highlighting, and JSON export. Documents
persist locally in SQLite. English linguistic analysis is supported; other
languages receive explicit limitations.

## Local development

Run the backend and frontend in separate terminals:

```powershell
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

```powershell
cd frontend
pnpm install
pnpm dev
```

Open http://localhost:3000. Set frontend `NEXT_PUBLIC_API_URL` to
`http://localhost:8000` for local development. Each directory includes an
`.env.example`; restart the frontend after changing its API URL. For hosted
usage, deploy the updated backend and rebuild the frontend with its hosted API
URL. Detailed architecture, algorithms, limitations, and test commands are in
[backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).

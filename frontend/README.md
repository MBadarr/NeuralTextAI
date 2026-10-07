# NeuralText AI frontend

The frontend is a responsive Next.js dashboard for the NeuralText AI API. It
uses Tailwind utility classes in components and Zustand for shared workspace
state.

## Run locally

From the `frontend/` directory:

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. Start the backend separately from `backend/`:

```bash
uv run uvicorn app.main:app --reload
```

The API client uses `http://localhost:8000` by default. Set
`NEXT_PUBLIC_API_URL` when the API is hosted elsewhere. `.env.example` targets
the local backend. Restart the dev server after changing this setting; production
builds embed the API URL at build time. Deploy both frontend and backend changes
together when using a hosted API.

## Frontend structure

- `app/page.tsx`: dashboard shell and feature-page routing.
- `app/layout.tsx`: document metadata and font setup.
- `app/globals.css`: Tailwind import only.
- `components/Sidebar.tsx`: workspace navigation, desktop collapse, and mobile
  drawer.
- `components/Topbar.tsx`: breadcrumb, search with Ctrl/Cmd+K, live service status, and mobile menu.
- `components/Overview.tsx`: live documents, insights, and entity breakdown.
- `components/TextAnalyzer.tsx`: analysis, NER display, writing feedback, and
  autocomplete controls.
- `components/TextTool.tsx`: sentiment, summary, and plagiarism interfaces.
- `components/FeaturePage.tsx`: documents, entity explorer, analytics,
  semantic search, and model views.
- `lib/api.ts`: typed API calls for every backend endpoint, error handling, and
  network status messages.
- `lib/workspace-store.ts`: Zustand store for active page, sidebar collapse,
  mobile drawer, and global search query.
- `types/analysis.ts`: TypeScript API response types.

Navigation is shared through Zustand rather than duplicated component-local
state. Selecting a page closes the mobile drawer, while desktop collapse and
global search remain synchronized across the sidebar, topbar, overview, and
feature views.

## Features

- Analyzer tabs expose entity highlights, lemmas, POS/dependency tags, stop
  words, keyphrases, noun phrases, word frequencies, readability, and a summary.
- Writing feedback runs after a debounce and provides applyable corrections.
  Requests are aborted on edits/navigation to prevent older results overwriting
  current feedback; offline errors never appear as “No issues detected.”
- Completions use workspace vocabulary and insert at the cursor without
  repeating the context word. Dictionary suggestions replace a partial word.
- Sentiment shows compound intensity and positive/neutral/negative proportions.
- Summaries support a selectable sentence limit. Similarity compares saved
  documents and displays the number of documents actually compared.
- Document history can reopen complete analysis results and export JSON.
- Search uses the backend semantic ranking endpoint and shares the topbar query.
- Analytics shows real processing times, entity types, languages, and sentiment.
- Model status lists actual pipeline capabilities and vector availability.

`components/AnalysisResults.tsx` is the shared result view used by the analyzer
and saved documents. Browser JSON export works locally without uploading text.

Verify with `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`.

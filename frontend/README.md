# NeuralText AI frontend

The frontend is a responsive Next.js dashboard for the NeuralText AI API. It
uses Tailwind utility classes in components and Zustand for shared workspace
state.

## Run locally

From the `frontend/` directory:

```bash
pnpm dev
```

Open <http://localhost:3000>. Start the backend separately from `backend/`:

```bash
uv run uvicorn app.main:app --reload
```

The API client uses `http://localhost:8000` by default. Set
`NEXT_PUBLIC_API_URL` when the API is hosted elsewhere.

## Frontend structure

- `app/page.tsx`: dashboard shell and feature-page routing.
- `app/layout.tsx`: document metadata and font setup.
- `app/globals.css`: Tailwind import only.
- `components/Sidebar.tsx`: workspace navigation, desktop collapse, and mobile
  drawer.
- `components/Topbar.tsx`: breadcrumb, search, notifications, and mobile menu.
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

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

The browser calls the same-origin `/api/backend` route. This route validates the
Neon session and verified email, obtains a short-lived Neon JWT on the server,
and forwards requests to `API_URL`, falling back to `NEXT_PUBLIC_API_URL` and
then `http://localhost:8000`. Deploy both frontend and backend changes together.

## Authentication and sessions

The existing `.env` supplies `NEON_AUTH_BASE_URL` and
`NEON_AUTH_COOKIE_SECRET` (at least 32 characters). Secrets remain server-only.
The backend uses its existing `NEON_AUTH_BASE_URL` and `NEON_AUTH_JWKS_URL`.
Both apps must point to the same Neon Auth endpoint and branch; otherwise the
backend rejects the frontend's signed-in token.
`NEON_AUTH_BASE_URL` is the auth service URL ending in `/neondb/auth`.
`NEON_AUTH_JWKS_URL` points to its `/.well-known/jwks.json` signing-key document;
these values serve different purposes and must not be interchanged. The frontend
validates its base URL at startup. Public auth pages skip provider session checks
when there is no session cookie; expired sessions return to sign-in.

- `/auth/sign-up`: name, email and password signup, followed by email OTP.
- `/auth/sign-in`: password login, Google OAuth, or passwordless email OTP.
- `/auth/verify`: code entry, resend cooldown, and recovery after refresh.
- `/auth/callback`: server-validated OAuth completion.
- `/auth/forgot-password`: request a Neon password-reset email code.
- `/auth/reset-password`: verify the six-digit reset code, then enter a new password and confirmation.
- `/`: server-protected workspace; unverified users return to verification.

Neon's SDK manages HTTP-only session cookies and renewal. Authentication is
checked against Neon on workspace entry and every proxied API request. The
client subscribes to SDK session changes and periodically rechecks sessions.
Tokens and passwords are never saved to localStorage or sessionStorage.
Only pending email/code-purpose details are kept in sessionStorage, and
navigation/sidebar preferences are stored under a separate key per user.
`proxy.ts` completes Neon's OAuth verifier exchange and refreshes cookies before
rendering. Server Components use a read-only SDK context for live session
checks, since Next.js prohibits cookie writes during server rendering. The OTP
page remains public so accounts without a session can verify their email.

Password recovery uses `emailOtp.requestPasswordReset`,
`emailOtp.checkVerificationOtp` with type `forget-password`, and
`emailOtp.resetPassword` through the same-origin Neon Auth handler. The password
form appears only after Neon accepts the code; Neon checks it again when saving
the password. Refreshing returns to code entry. Recovery
pages remain available without a session. Only the pending email and resend
timestamp are stored; reset codes and passwords are never persisted. Resends
have a 60-second UI cooldown, with provider expiry and attempt limits enforced
by Neon. Invalid/expired codes remain recoverable by requesting a fresh code.
Successful recovery returns to sign-in with a confirmation message.

Workspace session checks and route transitions show a themed spinner with a
screen-reader status label. The spinner respects reduced-motion preferences.

Ensure the deployed app origin is a trusted domain in Neon Auth, Google is
enabled, and email verification uses **verification codes**. Enable required
email verification in Neon as well as the app's verified-email gate. Provider
rate limits, code expiry/attempt limits, and OAuth credentials are managed by
Neon. Production uses HTTPS. No database passwords or storage credentials belong
in public environment variables.

Auth screens and the entire dashboard support light, dark, and system themes. Dashboard surfaces, text, controls, highlights, and alerts use shared semantic
color tokens. The theme preference uses a
cookie so the server renders the selected theme; system mode follows OS changes.
All forms include labels, autocomplete hints, keyboard focus, pending states,
and announced errors. Verification can request a fresh code if delivery fails.

Authentication and recovery forms validate email, name, 8–128 character passwords,
six-digit codes, and reset-password confirmation before contacting Neon. Password
and confirmation feedback updates while typing; other fields validate on blur
and submission. Errors are linked to their fields for assistive technology.
The forgot-password link sits above the sign-in button, aligned to the right.

All component styling uses Tailwind utilities, including auth screens, loaders,
focus states, reduced motion, and responsive layouts. `globals.css` contains only
the Tailwind import, data-attribute dark variant, and light/dark color tokens;
the root uses Tailwind color-scheme utilities to resolve those tokens.

## Frontend structure

- `app/page.tsx`: server-side workspace session gate.
- `app/auth/[view]/page.tsx`: authentication pages and OAuth callback.
- `app/api/auth/[...path]/route.ts`: official Neon Auth handler.
- `app/api/backend/[...path]/route.ts`: authenticated backend proxy.
- `app/layout.tsx`: document metadata and font setup.
- `app/globals.css`: Tailwind and themed, responsive authentication styles.
- `components/Workspace.tsx`: existing dashboard shell and feature routing.
- `components/AuthScreen.tsx`: signup, login and OTP forms.
- `components/SessionGuard.tsx`: session updates and preference hydration.
- `lib/auth-client.ts` / `lib/auth-server.ts`: Neon SDK configuration.
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

Verify with `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`.
Frontend flow tests mock Neon; they never send email or create real accounts.

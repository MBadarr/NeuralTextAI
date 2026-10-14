# NeuralText AI frontend

The frontend is a responsive Next.js dashboard for the NeuralText AI API. It
uses Tailwind utility classes in components and Zustand for shared workspace
state.

The text analyzer saves a complete analysis and opens token/POS/dependency results.
Named entity recognition calls `/entities` without saving, with highlighted mentions,
entity type filters, counts, and character spans. Writing assistance displays live
correction cards with Apply actions. Predictive text displays live word/phrase
completions and inserts them at the cursor while preserving surrounding text.
The latter two tools do not create analysis records. Each tool includes a relevant
example and cancels pending requests when navigating away.

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

```text
frontend/
  app/                         Next.js routes, layouts, loading/error boundaries
  screens/                     AuthScreen, WorkspaceScreen, OverviewScreen
  features/
    auth/
      components/              PasswordRecoveryForm, SessionGuard
      hooks/                   Form validation hook
      lib/                     Neon client/server, configuration, validation, styles
      types/                   Authentication view types
    analysis/
      api/                     Typed analysis and NLP tool calls
      components/              Analyzer, text tools, analysis/classification results
      types/                   API response models
    workspace/
      api/                     Documents, search, insights, models, service health
      components/              FeatureContent for workspace views
      store/                   Persisted Zustand navigation and preferences
  components/
    layout/                    Sidebar, Topbar
    providers/                 ThemeProvider and useTheme
    theme/                     ThemeToggle
  ui/                          Button, Input, Textarea, Select, Icon,
                               FieldError, LoadingIndicator
  lib/                         Shared HTTP transport and error handling
  tests/                       Authentication, session, theme, and NLP regressions
  public/                      Static assets
```

`app` keeps routing and server session gates; screens compose the user-facing
pages. Feature folders own domain-specific components, hooks, API functions,
state, and types. Shared layout and provider components live in `components`.
`ui` contains reusable native-control wrappers that preserve refs, accessibility
attributes, event handlers, and existing Tailwind classes. Authentication inputs
use the `auth` and `otp` variants; dashboard controls retain their existing styles.

Import modules directly through the `@/` alias. Shared UI and HTTP transport do
not import screens or features. Keep Neon server code behind its existing
`server-only` boundary; client components import only the auth client. Routes,
environment-variable names, cookie handling, and persisted storage keys remain
the same. Add new domain behavior under its feature, and use screens for page
composition rather than adding unrelated files to `components`.

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

Feature editors run their own background tools: Writing Assistant checks writing,
Predictive Text requests cursor-context completions, and entity, keyword, and
readability pages open the matching result tab. NLP POST requests are serialized
per browser page to respect the low-memory backend's processing slot. Canceled
queued requests are skipped. Only explicit `X-Service-Error: nlp_busy` responses
are retried (at most twice); connection, authentication, and database failures
are surfaced without repeating a potentially completed save. Deploy frontend
and backend together so the proxy can forward the capacity diagnostics.

`features/analysis/components/AnalysisResults.tsx` is the shared result view used by the analyzer
and saved documents. Browser JSON export works locally without uploading text.

Verify with `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`.
Frontend flow tests mock Neon; they never send email or create real accounts.

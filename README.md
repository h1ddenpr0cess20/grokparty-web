# GrokParty Web

Browser-based companion for hosting multi-character conversations on the Grok API. GrokParty Web lets you manage personas, launch live chat sessions, and export transcripts without running your own backend services.

## Features
- Configure conversations end-to-end: persona authoring, scenario settings, Grok model selection, search controls, and launch review.
- Stream multi-speaker dialogue directly from the Grok API with pause/resume controls and status-aware UI cues.
- Persist key session data locally with sensible defaults; remember API keys securely per device when requested.
- Export transcripts (conversation plus configuration) as JSON for archival or tooling handoff.
- Responsive, theme-aware interface using a11y-focused defaults and smooth transcript scrolling.

## Tech Stack
- React 19 + TypeScript + Vite for fast, typed application development.
- Zustand for lightweight, colocated state management with persistence helpers.
- Tailwind CSS and custom design tokens for theming.
- React Router for client-side navigation.
- Vitest + Testing Library + MSW-ready setup for unit and integration coverage.

## Getting Started
### Prerequisites
- Node.js 20.x (LTS) or newer
- npm 10.x (bundled with Node 20)

### Installation
```bash
npm install
```

### Environment
The app talks to the Grok API via a configurable base URL. You can set this at build time with Vite environment variables.

Create a `.env` file (or use your hosting provider's env settings) and set:
```bash
VITE_GROK_API_BASE=https://api.x.ai/v1
```
If omitted, the default above is used.

### Development Server
```bash
npm run dev
```
This launches Vite with hot module reloading at http://localhost:5173.

### Production Build
```bash
npm run build
npm run preview # optional smoke test of the build output
```
The optimized assets land in `dist/`.

## Project Structure
```
├── public/                Static assets served as-is
├── src/
│   ├── api/               Grok client, context, and provider
│   ├── app/               Top-level routing, providers, and error boundary
│   ├── components/        Reusable UI + layout primitives
│   ├── features/          Feature-oriented modules (conversation, session, setup)
│   ├── pages/             Route-level screens
│   ├── state/             Zustand stores and selectors
│   ├── styles/            Global style helpers
│   └── test/              Vitest setup and test suites
├── docs/                  Additional documentation (architecture, processes)
├── vite.config.ts         Vite + Vitest configuration
└── tailwind.config.js     Tailwind theme extensions
```

## Application Architecture
- **Conversation engine** (`src/features/conversation/conversationEngine.ts`): orchestrates streaming chat, speaker rotation, and message state transitions.
- **Session state** (`src/state/sessionStore.ts`): central store for configuration, messages, and flow status with persistence.
- **UI composition**: `AppProviders` wires theme + API client context; `AppLayout` exposes navigation, status, API key management, and theme toggle.
- **API access** (`src/api/grokClient.ts`): typed client with graceful fallbacks, streaming helpers, and model listing.

More design notes live in `docs/architecture.md`.

## Quality Tooling
- `npm run lint` – ESLint with TypeScript awareness and Tailwind plugin.
- `npm run format` – Prettier with Tailwind-class sorting.
- `npm run test` – Vitest in CI mode (jsdom, Testing Library, jest-dom matchers).
- `npm run test:watch` – Interactive test loop.

## Further Reading
- [Architecture Overview](docs/architecture.md)
- [Testing Strategy](docs/testing.md)
- [Security Policy](SECURITY.md)

## Security
Found a vulnerability? Review [SECURITY.md](SECURITY.md) for disclosure guidelines before filing an issue.
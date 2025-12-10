# Getting Started

## Features
- Configure conversations end-to-end: persona authoring, scenario settings (including the host name Grok should address), Grok model selection, search controls (opt-in and disabled by default), and launch review. The decision model never calls web search, regardless of that toggle.
- Stream multi-speaker dialogue from the Grok API with pause/resume controls, host interjection support, and status-aware UI cues.
- Persist key session data locally with sensible defaults; remember API keys securely per device when requested.
- Export transcripts (conversation plus configuration) as JSON, Markdown, HTML, or plain text for archival or tooling handoff.
- Responsive, theme-aware interface using accessibility-focused defaults and smooth transcript scrolling.

## Tech Stack
- React 19 + TypeScript + Vite for fast, typed application development.
- Zustand for lightweight, colocated state management with persistence helpers.
- Tailwind CSS and custom design tokens for theming.
- React Router for client-side navigation.
- Vitest + Testing Library setup for unit and integration coverage.

## Environment Setup
### Prerequisites
- Node.js 20.x (LTS) or newer
- npm 10.x (bundled with Node 20)

### Installation
```bash
npm install
```

### Configuration
Create a `.env` file (or use your hosting provider's environment settings) and set:
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

## Quality Tooling
- `npm run lint` – ESLint with TypeScript awareness and Tailwind plugin.
- `npm run format` – Prettier with Tailwind-class sorting.
- `npm run test` – Vitest in CI mode (jsdom, Testing Library, jest-dom matchers).
- `npm run test:watch` – Interactive test loop.

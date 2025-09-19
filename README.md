# GrokParty Web

GrokParty Web is a browser app for orchestrating Grok-powered multi-speaker sessions. Assemble persona panels to pressure-test product ideas, rehearse support conversations, run research interviews, or capture transcripts for creative teams—no backend required.

## Quick Start
- Requires Node.js 20+ and npm 10 (bundled with Node 20).
- Install dependencies with `npm install`.
- Create an optional `.env` containing `VITE_GROK_API_BASE` to target a non-default Grok endpoint.
- Launch the dev server with `npm run dev` and open http://localhost:5173.

## Useful Scripts
- `npm run build` – produce an optimized bundle in `dist/`.
- `npm run preview` – smoke-test the built assets locally.
- `npm run lint` / `npm run format` / `npm run test` – static analysis, formatting, and unit/integration tests.
- `npm run docs:api` – generate API reference docs from TSDoc into `docs/api`.

## Documentation
- [Getting started guide](docs/getting-started.md)
- [Architecture overview](docs/architecture.md)
- [Testing strategy](docs/testing.md)
- API Reference (generate locally with `npm run docs:api` into `docs/api`)

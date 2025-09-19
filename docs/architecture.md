# Architecture

GrokParty Web is a client-only React application that orchestrates multi-character conversations against the Grok API. The codebase is organized around feature folders with shared infrastructure for state, theming, and API access.

## Module Map
- `src/app` – Router, root App, providers, and error boundary.
- `src/api` – GrokClient wrapper, React provider/context, hooks, and tests.
- `src/components` – Reusable UI primitives, layout, theme context/provider/toggle.
- `src/features` – Feature slices (`setup`, `conversation`, `session`).
- `src/pages` – Route-level screens that compose features.
- `src/state` – Zustand stores, selectors, and toast helpers.
- `src/test` – Test setup and render helpers.

## Layered Overview
- **UI Shell (`src/app` + `src/components`)**: Provides routing, theming, and layout primitives. `AppProviders` wires context providers, while `AppLayout` supplies navigation, status, API key management, and the global toast viewport.
- **Feature Modules (`src/features`)**: Self-contained vertical slices (session, setup, conversation) that compose UI, hooks, and domain logic.
- **State Stores (`src/state`)**: Zustand stores coordinate configuration, session lifecycle, UI modals, and ephemeral toasts. Selectors wrap common derivations.
- **Services (`src/api`)**: Thin TypeScript client (`GrokClient`) for Grok REST endpoints plus context/provider wiring for dependency injection.

```
┌─────────────┐    selects     ┌───────────────────────┐
│ React Views │───────────────▶│ Zustand Stores        │
└─────────────┘◀───────────────┤ (session/ui/toast)    │
      ▲   ▲       subscribe    └───────────────────────┘
      │   │                                      │
      │   │ uses                                 │mutates
      │   └───────────────┐                      ▼
      │                   │           ┌─────────────────────┐
      │             ┌────────────┐    │ Conversation Engine │
      │             │ Hooks      │────│ (loop + state sync) │
      │             └────────────┘    └─────────────────────┘
      │                                 │       ▲
      │                                 │calls  │streams
      ▼                                 ▼       │
┌─────────────────┐            ┌────────────────────────┐
│ Theme & Context │            │ Grok Client (API)      │
│ Providers       │───────────▶│ fetch + streaming sse │
└─────────────────┘            └────────────────────────┘
```

## Conversation Lifecycle
1. **Configuration**: Users define scenario settings and participants through the setup wizard. On submit, `useSessionStore` persists configuration and ensures at least two participants via normalization helpers.
2. **Launch**: `ConversationControls` invokes `useConversationEngine.start()`. The engine clears existing messages, sets status to `connecting`, assigns a session ID, and kicks off the first speaker.
3. **Streaming Loop**: For each turn, `ConversationEngine.emitMessage` streams text via `GrokClient.streamChatCompletion`, updating the store incrementally for UI reactivity. A rolling history buffer feeds subsequent prompts.
4. **Speaker Selection**: `chooseNextSpeaker` either alternates (two participants) or queries Grok with a decision prompt to pick the next participant; failures fall back to randomness to keep the loop moving.
5. **Controls**: `pause` defers until the current message resolves, `resume` flips status back to `streaming`, and `stop` aborts the in-flight request while marking the session `completed`.
6. **Transcript Actions**: Users can download the conversation with metadata as JSON via `TranscriptActions`.

## Persistence Strategy
- **Session Store**: Uses `zustand/persist` with `localStorage`. API keys are stored only if the user opts into "remember" mode; otherwise they remain in-memory. Configuration defaults guarantee two starter participants so the UI does not render empty states.
- **Toasts**: A separate store drives ephemeral notifications without forcing rerenders beyond consumers.

## Theming
- Theme values live in CSS custom properties (`src/index.css`) toggled by `ThemeProvider` + `ThemeToggle`. Utilities like `glass-panel` and `transcript-scroll` provide consistent styling.

## Routing
- `appRouter` routes `/`, `/setup`, `/conversation`, and a fallback `*` to a not-found screen. The layout wraps every route with shared chrome.

## Error Handling
- `AppErrorBoundary` catches React tree crashes, logs them, and surfaces a toast plus fallback UI.
- Conversational errors push toasts and update store status to `error` for global visibility.

## Testing Infrastructure
- Vitest runs with jsdom, Testing Library, jest-dom matchers, and `whatwg-fetch` polyfill. Tests live under `src/test`. Feature tests render components within the real providers to exercise state interactions.

## Future Enhancements
- Introduce MSW handlers in `src/test` for deterministic API simulations once server interactions expand.
- Instrument analytics hooks or logging sinks inside `ConversationEngine` for deeper observability.
- Expand docs with screen-level walkthroughs (`docs/ui-guide.md`) as the UI stabilizes.
 - Publish generated API reference (`docs/api`) via static hosting.

# Testing Strategy

This document summarizes the automated test approach for GrokParty Web.

## Tooling
- **Vitest** provides a lightweight Jest-compatible runner integrated with Vite.
- **@testing-library/react** exposes DOM-level queries plus helpers for simulating user interactions.
- **jest-dom matchers** supply semantic assertions (visibility, accessibility state).

## Test Structure
- Unit-level tests for hooks and utilities live near their features (e.g. `src/features/**/__tests__`).
- Component integration tests and regression guards live under `src/test/` when they exercise multiple domains.
- Providers or context-heavy components should be rendered via helpers that include `AppProviders`.

## Areas of Coverage
- **State stores**: serialization, participant normalization, and API key persistence rules.
- **Hooks**: conversation engine orchestration, API key helpers, and Grok model fetching.
- **UI components**: menu toggles, dialog flows, and transcript rendering states.

## Adding New Tests
1. Create a file ending in `.test.ts` or `.test.tsx` alongside the code under test.
2. Import `setup` helpers from `src/test` if the scenario requires global providers or mocks.
3. Run `npm run test -- --runInBand <path>` for targeted runs.
4. Keep assertions user-focused. Query by role, label, placeholder text, or test IDs that map to meaningful affordances.

## Manual QA Checklist
- API key add/update/remember flows
- Conversation start, pause, resume, stop
- Transcript download and JSON structure
- Dark mode and reduced motion preferences
- Responsive layouts for key breakpoints (mobile, tablet, desktop)

Future enhancements include MSW request handlers for deterministic Grok API simulations and accessibility audits via `@axe-core/react`.

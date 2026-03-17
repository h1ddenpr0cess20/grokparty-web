# GrokParty Web

GrokParty Web is a browser application for orchestrating Grok-powered, multi-speaker sessions entirely on the client. Configure a panel of personas, stream their dialogue live, and export the full transcript without deploying a backend.

## Highlights
- Guided setup that covers scenario design, persona authoring, and Grok model selection.
- Live conversation view with pause, resume, stop, and host interjection controls.
- Secure-by-default API key handling that never leaves the browser.
- Responsive, dark-mode friendly UI tuned for longer-running sessions.
- Transcript export that bundles both the conversation and its configuration (JSON, Markdown, HTML, or plain text).
- Shared Model Context Protocol (MCP) server management directly in the header—configure once, then grant characters selective access (with optional `allowed_tool_names`) inside the setup wizard.

## Key Workflows

### 1. Prepare the scenario
Start on the home screen to add or update your Grok API key, manage MCP servers via the header menu, and open the setup wizard. The scenario step gathers the conversation type, topic, mood, optional setting, host name, model temperature, and whether Grok's search tools should be turned on. Search is opt-in (disabled by default) and is never used by the decision model that chooses the next speaker. Each field ships with sensible defaults so you can iterate quickly.

### 2. Configure participants
Define at least two personas, each with a name, short description, Grok model, per-character temperature, and optional web search + MCP server access. The wizard reads from the shared MCP pool you configured in the header menu and lets you toggle server access and supply `allowed_tool_names` per character. Models can be refreshed in-line to pick up the latest availability. The wizard keeps inputs validated and enforces that every persona is ready before launch.

### 3. Launch and moderate the session
Once the configuration looks right, launch the conversation. Responses stream into the transcript in real time while the side panel keeps the scenario context nearby. You can pause, resume, or stop at any point and insert host-authored messages that use the configured display name so participants respond directly to you.

### 4. Review and export
Every run records the scenario, participants, decision model, and full transcript. Download the bundle as JSON, Markdown, HTML, or plain text for auditing or tooling handoff, or reset and start a new experiment right away.

## Documentation
- [Getting started guide](docs/getting-started.md)
- [Architecture overview](docs/architecture.md)

## Running with Docker

Build a production bundle and serve it with Nginx using Docker:

```bash
docker build -t grokparty-web .
docker run --rm -p 8080:80 grokparty-web
```

Then open <http://localhost:8080> in your browser.

## Disclaimers
- [AI Output Disclaimer](docs/ai-output-disclaimer.md) – Important information about the limitations of AI-generated content and allocation of responsibility
- [Not a Companion Policy](docs/not-a-companion.md) – GrokParty is a tool for creativity, productivity, and learning, not for companionship or simulated relationships

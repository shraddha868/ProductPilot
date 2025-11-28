# ProductPilot (AI Agent)

## Overview

ProductPilot (also shown in code as ChatDPT / ProductPilot) is a lightweight AI agent that recommends products based on user queries. It provides conversational recommendations by combining a static frontend (HTML/CSS/JS) with a small Express backend that calls an LLM via the Groq SDK and can use external tools (Tavily web search) to fetch realtime product data.

This README explains how the agent works end-to-end, how to run it locally, the technologies and APIs used, limitations, and suggested improvements.

## Features

- Conversational product recommendation assistant (chat-style UI).
- Uses an LLM (via `groq-sdk`) with a tool/plug-in integration to perform web searches when needed.
- Simple, responsive frontend (static HTML/CSS/JS) under `frontend/`.
- Backend API exposed at `POST /chat` which accepts JSON `{ message: string }` and returns `{ message: string }`.
- Demo product quick-links in the UI.

## Limitations

- No authentication — the API is open by default for local development.
- No rate-limiting or abuse protection.
- No streaming/token-by-token UI streaming implemented — responses are returned as finished strings.
- No persistent conversation store (each request is treated independently unless you extend message state handling).
- The assistant relies on third-party APIs (Groq, Tavily) — availability and results depend on those services and the configured API keys.

## Tech stack & APIs used

- Node.js (ES Modules) — server runtime
- Express (v5) — API server (see `server.js`)
- dotenv — environment variable management (used in code via `process.env`)
- groq-sdk — LLM / chat completions (used in `chatbot.js`)
- @tavily/core — Tavily search client (used in `chatbot.js` for webSearch)
- openai (listed in dependencies) — available but not currently used by `chatbot.js` (kept for possible expansion)
- grok-sdk, groq-sdk — present in `package.json` (groq-sdk is actively used)
- Frontend: plain HTML/CSS/JS in `frontend/` (no build step). Styling in `frontend/styles.css`.

Dependencies (from `package.json`):
- @tavily/core ^0.5.13
- cors ^2.8.5
- dotenv ^17.2.3
- express ^5.1.0
- grok-sdk ^0.0.1-security
- groq-sdk ^0.37.0
- openai ^6.9.1

## How it works — end-to-end (flow)

1. User interacts with the static UI in `frontend/index.html`.
2. The frontend sends POST requests to the backend endpoint `POST http://localhost:3002/chat` with JSON `{ message: "..." }`.
3. `server.js` receives the request and calls `generate(message)` exported from `chatbot.js`.
4. `chatbot.js` builds a conversation array (`messages`) including a `system` role that instructs the model and an initial assistant prompt.
5. `chatbot.js` calls `groq.chat.completions.create(...)` with the messages and specifies a `webSearch` function tool.
6. If the LLM decides to call the webSearch tool, `groq` will indicate tool calls in the model response. The code executes `webSearch({query})`, which in turn calls tavily (`tvly.search(query)`) to fetch realtime results.
7. The tool output is inserted back into the conversation as a `tool` role, and the loop continues until the model returns a final answer without further tool calls.
8. The final assistant text is returned by `generate()` and sent back to the frontend by `server.js` as `{ message: string }`.
9. The frontend displays the assistant message in the chat history.

Data shapes
- Request to backend: `{ "message": "user question" }`
- Successful response from backend: `{ "message": "assistant text" }`

## Architecture diagram

Simple ASCII diagram (traces request flow):

Browser (frontend) -> POST /chat -> Express server -> chatbot.generate -> groq.chat.completions (LLM)
                                             |
                                             -> If needed: Tavily webSearch -> internet -> returns content -> LLM -> final answer

Mermaid diagram (if your Markdown viewer supports mermaid):

```mermaid
flowchart LR
  A[Browser (frontend)] -->|POST /chat| B[Express server (server.js)]
  B --> C[chatbot.generate (chatbot.js)]
  C --> D[Groq LLM via groq-sdk]
  D -->|tool call: webSearch| E[Tavily API]
  E --> D
  D --> C
  C --> B
  B --> A
```

## Setup & run (local)

1. Prerequisites
   - Node.js 18+ (recommended)
   - npm or yarn

2. Clone / open repository in terminal and install dependencies

PowerShell commands (from project root):

```powershell
# Install dependencies
npm install
```

3. Environment variables

Create a `.env` file in the project root or set environment variables directly. `chatbot.js` expects (at least) API keys for Tavily and Groq. Example `.env`:

```
TAVILY_API_KEY=your_tavily_api_key_here
GROQ_API_KEY=your_groq_api_key_here
# Optional (if you plan to use OpenAI SDK):
# OPENAI_API_KEY=your_openai_api_key_here
```

If you prefer to set environment vars from PowerShell temporarily:

```powershell
$env:TAVILY_API_KEY = "your_tavily_api_key_here"
$env:GROQ_API_KEY = "your_groq_api_key_here"
node server.js
```

4. Start the backend server

```powershell
node server.js
```

By default the backend runs on port `3002`. You should see a console log like `Server is running on port: 3002`.

5. Open the frontend

- Option A: Open `frontend/index.html` directly in the browser (file://). This works for static usage but cross-origin calls to `http://localhost:3002/chat` may be blocked depending on the browser. The server has CORS enabled, so using a local static server is preferred.

- Option B: Serve the `frontend/` folder with a simple static server. Example (PowerShell) using npx http-server (no install needed):

```powershell
npx http-server .\frontend -p 8080
# Then open http://localhost:8080
```

6. Try the API (example)

Example `curl` (or PowerShell `Invoke-RestMethod`) to call the chat endpoint:

curl (POSIX / Git Bash):

```bash
curl -X POST http://localhost:3002/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Recommend budget headphones under $100"}'
```

PowerShell (Invoke-RestMethod):

```powershell
Invoke-RestMethod -Uri http://localhost:3002/chat -Method POST -ContentType 'application/json' -Body (@{ message = 'Recommend a budget laptop under $700' } | ConvertTo-Json)
```

## Potential improvements (short-term & long-term)

Short-term:
- Add request/response streaming (token-by-token) so the UI can display a typewriter effect.
- Add message timestamps, avatars, and conversation history (persist in a DB like SQLite or Postgres).
- Add basic rate-limiting and API keys for the server to prevent abuse.
- Add tests for the server endpoint and unit tests for the `chatbot.generate` logic.

Long-term:
- Add proper auth (OAuth/JWT), role-based access control, and rate limiting.
- Containerize (Docker) and add a simple CI/CD pipeline.
- Add a message queue for handling heavy LLM workloads and background web searches.
- Replace the simple product links with a dynamic products API and catalog service.

## Security & privacy notes

- Do not commit real API keys to source control. Use `.env` and secrets management in production.
- The app sends user messages to third-party LLM providers and Tavily — avoid sending sensitive PII unless you have proper controls.

## Where to look in the repo

- `server.js` — Express server and `/chat` endpoint.
- `chatbot.js` — LLM integration, tool loop, and `webSearch` implementation (Tavily).
- `frontend/` — `index.html`, `styles.css`, `script.js` (static UI).
- `package.json` — dependencies.

## Next steps I can implement (pick one)

- Add token-by-token streaming and a UI typewriter effect.
- Add persistent conversation history (simple SQLite DB) and a conversation list UI.
- Add authentication + API key protection for the backend.
- Replace `example.com` product links with real URLs and add product images.

---

If you'd like, I can now:
- Replace the placeholder product links with your real product URLs.
- Add streaming responses to the frontend.
- Create a Dockerfile + start script for easier deployment.

Tell me which next step you prefer and I will implement it.

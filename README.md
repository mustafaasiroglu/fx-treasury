# FX Treasury Agent Cockpit

A real-time FX pricing **decision cockpit**. A pricing model continuously proposes executable FX
rate updates on a fixed cycle, visualized on a live market control chart and governed through
**human-in-the-loop** approval. A GPT-5.2-backed treasury agent sits alongside it — inspecting the
model, pulling live news, and tuning parameters on request. This is not a passive dashboard; it is
a live pricing policy engine where the model decides and the human approves or overrides.

![FX Treasury Agent Cockpit dashboard](screenshot.png)

## Features

- **Model Decision Stream** — the pricing model emits `HOLD` / `PUBLISH` / `SMOOTH_STEP` decisions
  with confidence, reasoning, and expected impact (revenue, conversion, execution risk).
- **Human-in-the-loop control** — every decision can be **Accepted** or **Rejected**; accepted
  decisions become active client-rate policy immediately. Pending decisions auto-accept after a
  configurable window.
- **Agent chat (Azure OpenAI, gpt-5.2)** — a tool-calling treasury agent that can read the model
  params, fetch rate history, pull and read live news articles, and recommend parameter changes.
  Falls back to a helpful stub when Azure OpenAI isn't configured.
- **Live market news** — headlines aggregated from RSS sources (Investing.com, Reuters/Yahoo, FT,
  Google News) for the selected pair, with safe article fetching for in-chat summaries.
- **Live rate chart** — spot, agent-suggested, and client-published quotes on a single time axis,
  with blinking suggestion markers and smooth-step transition paths.
- **KPI cards** — market spread, treasury margin, mid deviation, and spread ratio with rolling
  and session averages.
- **Order pressure** — aggregated buy/sell flow visualization.
- **Conversational tuning** — ask the agent in plain language to fine-tune pricing parameters
  (spread multipliers, hold thresholds, publish probability, smoothing, auto-accept).
- **Multi-pair** — USD/TRY and EUR/TRY, with selectable time ranges (5m / 15m / 1h / 24h / 7d).

## Tech stack

| Layer     | Stack                                                                   |
| --------- | ----------------------------------------------------------------------- |
| Frontend  | React 18, Vite, Tailwind CSS, Lightweight Charts, react-markdown        |
| Backend   | Node.js, Express, fast-xml-parser (RSS)                                 |
| AI        | Azure OpenAI (gpt-5.2) with function/tool calling                       |
| Structure | npm monorepo (`backend/` + `frontend/`)                                 |

## Project structure

```
fx-treasury/
├── backend/
│   └── src/
│       ├── server.js          # Express API
│       ├── rateEngine.js      # Market/client rate generation
│       ├── decisionEngine.js  # HOLD / PUBLISH / SMOOTH_STEP logic + model params
│       ├── orderBookEngine.js # Order pressure / order book
│       ├── tickStore.js       # Historical tick storage
│       ├── agentChat.js       # Azure OpenAI agent + tool calling
│       ├── newsProvider.js    # RSS news aggregation
│       └── urlFetcher.js      # SSRF-guarded URL fetcher for the agent
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── components/        # Chart, DecisionFeed, KpiCards, AgentChat, ...
│       └── services/api.js    # API client
└── package.json               # Monorepo scripts
```

## Getting started

### Prerequisites

- Node.js 18+ (backend uses `node --watch` and `--env-file`)

### Install

```bash
npm run install:all
```

### Configure the agent (optional)

The dashboard and pricing model run without any config. To enable live agent chat, create
`backend/.env` with your Azure OpenAI credentials:

```env
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<your-key>
AZURE_OPENAI_DEPLOYMENT=gpt-5.2
AZURE_OPENAI_API_VERSION=2024-10-21
```

Without these, the agent chat replies with a stub and everything else works normally.

### Run (backend + frontend together)

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001 (proxied under `/api` from the frontend)

Or run each side individually:

```bash
npm run dev:backend
npm run dev:frontend
```

## API reference

| Method | Endpoint                       | Description                                  |
| ------ | ------------------------------ | -------------------------------------------- |
| GET    | `/api/rates?pair=`             | Latest market + client quote                 |
| GET    | `/api/rates/history?pair=&range=` | Historical ticks (`5m`,`15m`,`1h`,`24h`,`7d`) |
| GET    | `/api/decision?pair=`          | Latest model decision                        |
| GET    | `/api/decisions/history?pair=` | Decision history                             |
| POST   | `/api/decision/:id/accept`     | Accept a decision (activates client rate)    |
| POST   | `/api/decision/:id/reject`     | Reject a decision                            |
| GET    | `/api/orderbook?pair=`         | Order pressure / order book                  |
| GET    | `/api/agent/params`            | Current model parameters                     |
| PUT    | `/api/agent/params`            | Update model parameters                      |
| POST   | `/api/agent/chat`              | Agent chat (Azure OpenAI, tool calling)      |
| GET    | `/api/news?pair=`              | Aggregated FX news headlines (RSS)           |

Supported pairs: `USDTRY`, `EURTRY`.

## Agent tools

The chat agent has access to the following tools (function calling):

| Tool                  | Purpose                                             |
| --------------------- | --------------------------------------------------- |
| `get_model_params`    | Read current model tuning parameters                |
| `get_rate_history`    | Fetch spot / client rate history for a pair         |
| `compare_competitor`  | Compare quotes vs a competitor feed (stub)          |
| `fetch_news`          | Fetch latest FX news headlines for a pair           |
| `fetch_url`           | Safely fetch and read a public URL (SSRF-guarded)   |
| `update_model_params` | Propose new model parameters (confirmed in UI)      |
| `run_backtest`        | Backtest modified params vs history (stub)          |

## Decision logic

Each cycle the model computes the gap between market mid and client mid:

- **gap < `holdThreshold`** → `HOLD` (leave client rate unchanged)
- **gap > `smoothStepThreshold`** → `SMOOTH_STEP` (converge gradually, closing part of the gap)
- **otherwise** → `PUBLISH` with `publishProbability` (close most of the gap)

Client spread is derived from the market spread scaled by a configurable multiplier range. All
thresholds, factors, and the auto-accept window are tunable via the parameters panel or the
in-app agent chat.

# Notion Failure Detective

It passed CI. It still breaks in production before your users tell you. Notion Failure Detective lets a developer describe an investigation in plain English inside Notion, runs the investigation, and writes the diagnosis back into Notion through MCP.

## Positioning

This is not presented as a load-testing dashboard. It is a production failure investigation tool.

Core story:

> Your API passed CI. It still breaks in production. Notion finds it first.

Notion MCP is the structural core:
- the investigation spec is read from Notion through MCP
- execution state is written back to Notion through MCP
- the final diagnosis and report are written back to Notion through MCP

Remove Notion and the interaction model collapses.

## Product Loop

1. A developer writes what to investigate in a Notion page.
2. The system extracts target, flow, load profile, and thresholds.
3. It generates a k6 investigation script and validates it.
4. It runs the investigation in Docker.
5. It writes the measured results and diagnosis back into Notion.

## What The Verdict Means

Two statuses matter:

- `Project status`: whether the investigation pipeline itself succeeded.
- `API verdict`: whether the target API passed or failed the requested thresholds.

Example:
- `Project status: RUN_SUCCEEDED`
- `API verdict: FAILED`

That means the product worked correctly end to end, and it found that the API breached its SLO. It does not mean the project is broken.

## Why This Exists

Production APIs fail because investigation usually requires three separate skills and tools:
- writing a test
- running it
- interpreting the result

This product collapses all three into one Notion workflow.

## Demo Story

Primary demo scenario:

- Target: `http://localhost:3001`
- Flow: `POST /auth/login`, `GET /cart`, `POST /checkout`
- Load: ramp to `200` users over `90` seconds, sustain for `3` minutes
- Thresholds: p95 latency `300ms`, error rate `3%`

Expected story:
- the run succeeds
- the API may fail the threshold
- the Notion report explains what happened and what to fix

The demo API intentionally simulates a checkout bottleneck so the report has something real to diagnose.

## Stack

- Node.js 20
- Express
- `@modelcontextprotocol/sdk`
- `mcp-remote`
- Groq via direct `fetch`
- k6 via `grafana/k6:latest`
- local run artifacts under `runs/{run_id}/`

## Setup

```bash
npm install
cp .env.example .env
```

Fill in:

- `GROQ_API_KEY`
- `NOTION_PARENT_PAGE_ID`

Authenticate Notion MCP:

```bash
node index.js notion-login
```

Initialize the workspace:

```bash
node index.js init
```

Run an investigation:

```bash
node index.js run
```

`init` creates:
- the `API Failure Reports` database
- a template `Test Spec` page
- `NOTION_DATABASE_ID` and `NOTION_SPEC_PAGE_ID` entries in `.env`

## Commands

- `node index.js notion-login`
- `node index.js init`
- `node index.js run`
- `node index.js server`
- `npm run demo-api`

## API

The Express server exposes:

- `POST /api/run`
- `GET /api/run/:run_id/status`
- `GET /api/run/:run_id/result`

`GET /api/run/:run_id/result` returns both execution outcome and API outcome:

- `project_status`
- `api_verdict`
- `metrics`
- `diagnosis`
- `notion_report_url`

## Notion Output

Each investigation writes:

- a database row in `API Failure Reports`
- a report sub-page with the metrics table first
- headline, primary finding, fix recommendation, and confidence

The report copy is intentionally phrased for presentation:
- first show the numbers
- then say what happened
- then say what to fix before users find it

## Local Artifacts

Each run writes files under `runs/{run_id}/`:

- `spec.json`
- `k6_script.js`
- `k6_output.json`
- `k6_summary.json`
- `metrics.json`
- `rca.json`

## Demo API

Run the local demo API:

```bash
npm run demo-api
```

The checkout endpoint simulates a connection-pool ceiling. To create the pass-case demo:

```bash
curl -X POST http://localhost:3001/admin/pool/500
```

## Presentation Notes

If you are presenting this project, keep the framing tight:

1. Start with the Notion page, not the terminal.
2. Say this is a production failure investigation tool, not a load-testing UI.
3. Let the Notion verdict and metrics table do the talking.
4. Show that changing one line in Notion changes the investigation outcome.

Closing line:

> The bottleneck was always there. Now you can find it before your users do.

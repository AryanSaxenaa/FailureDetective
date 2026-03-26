# Notion Failure Detective

It passed CI. It still breaks in production before your users do.

Notion Failure Detective turns a plain English Notion page into a live investigation. It runs the test, finds where your system breaks, and writes back exactly why.

## Positioning

This is a production failure investigation tool, not a dashboard.

Core story:

> Your API passed CI. It still breaks in production. Notion finds it first.

Notion MCP is the structural core:
- the investigation spec is read from Notion through MCP
- execution state is written back to Notion through MCP
- the final diagnosis is written back to Notion through MCP

Remove Notion and the interaction model collapses.

## Example Output

Example Notion report output for the demo bottleneck scenario:

```text
❌ FAILED THRESHOLD — Checkout flow breached latency target

P95 Latency: 1240ms (threshold 300ms)
Error Rate: 8.2% (threshold 3.0%)

Root Cause:
Latency increases through the ramp and breaches the threshold under sustained load,
consistent with a hard checkout bottleneck.

Fix:
Increase the checkout service's effective concurrency limit and reduce waiting at the bottleneck.
```

A run can succeed even if your API fails. That means the tool worked and found a real issue.

## Product Loop

1. A developer writes what to investigate in a Notion page.
2. The system extracts the target, flow, load profile, and thresholds.
3. It generates and validates a k6 investigation script.
4. It runs the investigation in Docker.
5. It writes the measured results and diagnosis back into Notion.

## Why This Exists

Most teams never run real investigations before production.

They test at 10 users.  
They ship.  
It breaks at 200.

Not because they could not test it, but because investigation requires scripting, execution, and interpretation across different tools.

This collapses all of that into one Notion page.

## Human-In-The-Loop

The developer defines the investigation in Notion. The system runs it and writes back the diagnosis. The developer edits one line and reruns.

No code changes. No config files. Just iteration inside Notion.

## Demo Story

Primary demo scenario:

- Target: `http://localhost:3001`
- Flow: `POST /auth/login`, `GET /cart`, `POST /checkout`
- Load: ramp to `200` users over `90` seconds, sustain for `3` minutes
- Thresholds: p95 latency `300ms`, error rate `3%`

Expected story:
- the run succeeds
- the API may fail the requested threshold
- the Notion report explains what happened and what to fix

The demo API intentionally simulates a checkout bottleneck so the report has something real to diagnose.

## Stack

- Node.js + Express
- Notion MCP for the read/write core loop
- k6 via Docker for investigation execution
- Groq for structured extraction, diagnosis, and fallback code generation

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

`GET /api/run/:run_id/result` returns:

- `project_status`
- `api_verdict`
- `metrics`
- `diagnosis`
- `notion_report_url`

## Notion Output

Each investigation writes:

- a database row in `API Failure Reports`
- a report sub-page with the metrics table first
- a headline, primary finding, fix recommendation, and confidence statement

The report wording is designed to be presentation-friendly:
- show the numbers first
- say what happened
- say what to fix before your users do

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

The checkout endpoint simulates a bottleneck. To create the pass-case demo:

```bash
curl -X POST http://localhost:3001/admin/pool/500
```

## Presentation Notes

1. Start with the Notion page, not the terminal.
2. Say this is a production failure investigation tool, not a load-testing UI.
3. Let the Notion verdict and metrics table do the talking.
4. Show that changing one line in Notion changes the investigation outcome.

Closing line:

> The bottleneck was always there. Now you can find it before your users do.

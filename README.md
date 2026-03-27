# Notion Failure Detective

Notion Failure Detective is a Node.js application that reads an investigation spec from Notion through Notion MCP, runs a k6-based API investigation in Docker, and writes the results and diagnosis back to Notion.

The product focus is production failure investigation, not a standalone load-testing dashboard. Notion is the primary interface for defining what to investigate and for reading the final report.

## Overview

The system supports this end-to-end workflow:

1. Read a plain-English test spec from a Notion page.
2. Extract the target URL, endpoints, load profile, and thresholds.
3. Generate and validate a k6 script.
4. Execute the script in Docker.
5. Parse summary metrics from k6 output.
6. Generate a diagnosis with Groq, with deterministic fallbacks.
7. Write the structured result and a report page back to Notion.

## Current Implementation

- Runtime: Node.js + Express
- Notion integration: Notion MCP via `@modelcontextprotocol/sdk` and `mcp-remote`
- Investigation execution: k6 in Docker
- LLM provider: Groq
- Local artifacts: written under `runs/{run_id}/`

## Architecture

Main entry points:

- `node index.js notion-login`
- `node index.js init`
- `node index.js run`
- `node index.js server`

Main modules:

- [index.js](/C:/Users/91730/Documents/Notion%20MCP/index.js)
  CLI entry point for login, init, run, and server modes.
- [src/notionClient.js](/C:/Users/91730/Documents/Notion%20MCP/src/notionClient.js)
  MCP client wrapper for reading Notion pages, creating the database, updating rows, and creating report pages.
- [src/orchestrator.js](/C:/Users/91730/Documents/Notion%20MCP/src/orchestrator.js)
  Sequential investigation pipeline.
- [src/llm.js](/C:/Users/91730/Documents/Notion%20MCP/src/llm.js)
  Spec extraction, diagnosis generation, deterministic k6 fallback generation, and LLM retry/fallback behavior.
- [src/k6Runner.js](/C:/Users/91730/Documents/Notion%20MCP/src/k6Runner.js)
  Docker-based k6 execution and script validation.
- [src/metricsParser.js](/C:/Users/91730/Documents/Notion%20MCP/src/metricsParser.js)
  Extracts p50/p95/p99, error rate, RPS, VUs, and request counts from k6 summary output.
- [src/server.js](/C:/Users/91730/Documents/Notion%20MCP/src/server.js)
  Express API for starting runs and polling status/results.

## Notion Model

The project creates and uses:

- a Notion database named `API Failure Reports`
- a template spec page named `Test Spec`
- a report sub-page for each investigation run

The Notion report includes:

- a metrics table
- a verdict
- a headline
- a primary finding
- a fix recommendation
- a confidence statement

## Result Semantics

Two outcomes are tracked:

- `project_status`
  Whether the investigation pipeline itself completed successfully.
- `api_verdict`
  Whether the target API passed or failed the requested thresholds.

This means a run can succeed operationally while still reporting that the target API failed its thresholds.

## Setup

Install dependencies:

```bash
npm install
cp .env.example .env
```

Fill in these values in `.env`:

- `GROQ_API_KEY`
- `NOTION_PARENT_PAGE_ID`

Authenticate Notion MCP:

```bash
node index.js notion-login
```

Initialize the Notion workspace objects:

```bash
node index.js init
```

`init` creates:

- the `API Failure Reports` database
- the `Test Spec` page
- `NOTION_DATABASE_ID`
- `NOTION_SPEC_PAGE_ID`

## Running The Project

Run a full investigation from the configured Notion page:

```bash
node index.js run
```

Start the local API server:

```bash
node index.js server
```

Start the demo API:

```bash
npm run demo-api
```

## Demo Spec

The local demo flow is designed around:

- Target: `http://localhost:3001`
- OpenAPI spec: `http://localhost:3001/openapi.json`
- Flow: `POST /auth/login`, `GET /cart`, `POST /checkout`
- Thresholds: p95 latency and error rate from the Notion spec

To create a pass-case demo on the local API:

```bash
curl -X POST http://localhost:3001/admin/pool/500
```

## Using A Public Target

If you want to demonstrate the workflow against a public target, use a very small scenario only. Shared public test services are appropriate for lightweight demos, not sustained or aggressive load.

Example public target:

- Base URL: `https://test-api.k6.io`
- Example endpoints:
  - `GET /public/crocodiles/`
  - `GET /public/crocodiles/1/`

Example Notion spec:

```text
Target: https://test-api.k6.io

What I want to investigate:
Ramp to 5 concurrent users over 10 seconds.
Sustain for 20 seconds.
Investigate the public crocodiles endpoints: GET /public/crocodiles/, GET /public/crocodiles/1/.
Flag if p95 latency exceeds 1500ms or error rate exceeds 5%.
```

Recommended steps:

1. Make sure Docker Desktop is running locally.
2. Open the Notion `Test Spec` page.
3. Replace the page content with the public-target spec above.
4. Run `node index.js run`.
5. Open the generated Notion report URL from the CLI output.
6. Restore your original local spec when you are done.

Verified example result from this project:

- target: `https://test-api.k6.io`
- run id: `b4135e50-7f6d-4fce-974a-8c00d47ea6fa`
- project status: `RUN_SUCCEEDED`
- api verdict: `PASSED`
- p95 latency: `522ms`
- error rate: `0.0%`
- peak VUs: `5`
- total requests: `352`
- report: [Notion report](https://www.notion.so/3301f496f67d81e8b01ed75fe1a8d32a)

Notes:

- Keep the public-target load intentionally small.
- Do not use shared public targets for stress or endurance testing.
- The local demo API remains the preferred target for repeatable full demos.

## Express API

### `POST /api/run`

Starts an investigation run.

Request body:

```json
{
  "notion_page_id": "string",
  "notion_database_id": "string"
}
```

Response:

```json
{
  "run_id": "uuid",
  "status": "PENDING",
  "message": "Investigation started. Poll /api/run/{run_id}/status for updates."
}
```

### `GET /api/run/:run_id/status`

Returns the current in-memory status for a run, including phase and progress message.

### `GET /api/run/:run_id/result`

Returns the completed result payload:

```json
{
  "run_id": "uuid",
  "project_status": "RUN_SUCCEEDED | RUN_FAILED",
  "api_verdict": "PASSED | FAILED | INCONCLUSIVE",
  "metrics": {},
  "diagnosis": {},
  "notion_report_url": "https://www.notion.so/..."
}
```

## Local Run Artifacts

Each run creates a directory under `runs/{run_id}/` with:

- `spec.json`
- `k6_script.js`
- `script-meta.json`
- `k6_output.json`
- `k6_summary.json`
- `metrics.json`
- `rca.json`

These files are the local source of truth for what was parsed, executed, and diagnosed.

## Investigation Flow

At a high level:

1. Notion page content is fetched through MCP.
2. The spec is parsed into structured JSON.
3. A run row is created in the Notion database.
4. A k6 script is generated and validated.
5. Docker runs the k6 script and exports summary output.
6. Metrics are parsed from the summary file.
7. A diagnosis is generated.
8. The Notion database row is updated.
9. A report sub-page is created under the run row.

## Failure Handling

The implementation includes fallbacks for the main failure modes:

- Missing or invalid target URL
  returns `SPEC_PARSE_FAILED`
- Docker unavailable
  returns a clean error and stops the run
- Invalid generated k6 script
  validation fails before execution
- LLM JSON failure
  retries once, then falls back to deterministic behavior
- Partial metrics parsing issues
  handled defensively in the metrics parser

## Notes

- Docker must be running locally.
- Notion MCP must be authenticated in this environment.
- The parent Notion page must be accessible to the authenticated MCP session.
- Groq is the only active LLM provider in the current implementation.

## Repository Files

Key files:

- [.env.example](/C:/Users/91730/Documents/Notion%20MCP/.env.example)
- [README.md](/C:/Users/91730/Documents/Notion%20MCP/README.md)
- [index.js](/C:/Users/91730/Documents/Notion%20MCP/index.js)
- [src/notionClient.js](/C:/Users/91730/Documents/Notion%20MCP/src/notionClient.js)
- [src/orchestrator.js](/C:/Users/91730/Documents/Notion%20MCP/src/orchestrator.js)
- [src/llm.js](/C:/Users/91730/Documents/Notion%20MCP/src/llm.js)
- [src/server.js](/C:/Users/91730/Documents/Notion%20MCP/src/server.js)

## Example Outcome

Typical interpretation:

- `project_status: RUN_SUCCEEDED`
- `api_verdict: FAILED`

This means the application worked correctly and found that the target API breached the requested thresholds.

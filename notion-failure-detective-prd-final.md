# Notion Failure Detective — Product Requirements Document
### Final Version · All Changes Applied
### Notion MCP Challenge Submission · Solo · Due March 29, 2026

---

## Positioning Statement (read before anything else)

**Do not present this as a load testing tool.**

This is a production failure investigation tool. Load testing is the mechanism. The story is:

> "Your API passed CI. It still breaks in production — before your users tell you. Notion finds it first."

Every surface — README, DEV post title, demo narration, Notion report copy — uses this framing. Never say "load test" in the first sentence of anything. Say "find what breaks" or "investigate production failures" or "before your users do."

---

## Section 1 — One-Paragraph Vision

Notion Failure Detective is a tool that lets developers describe what they want to stress-test in plain English inside a Notion page, then autonomously investigates how their API behaves under real-world load, and writes a structured root-cause diagnosis back into Notion — without the developer touching a terminal or reading a dashboard. The problem it solves is not "load testing is hard to set up." The problem it solves is: **production APIs fail for reasons nobody investigated before deployment, because investigation requires scripting, execution, and interpretation — three separate skills and three separate tools.** This collapses all three into one Notion page. Notion MCP is the structural core — not a storage sink. The test definition is read from Notion via MCP, execution state is written to Notion via MCP, and the final diagnosis is structured back into Notion via MCP. Remove Notion and the entire interaction model collapses.

---

## Section 2 — Product Design Principles

Hard constraints, not goals. Any feature that violates one is cut without negotiation.

**Principle 1 — Notion is the only UI.**
The developer never opens a terminal after setup, never reads a separate dashboard, never visits another app. Everything — failure description, execution status, diagnosis, fix recommendation — lives in Notion. If a feature requires the user to look anywhere other than Notion, it is out of scope.

**Principle 2 — One complete loop beats ten partial features.**
The core loop is: read spec from Notion → generate k6 script → run test → write diagnosis back to Notion. This loop must be end-to-end reliable before any secondary feature is touched. A partial loop that fails mid-execution is worse than a narrow loop that always completes.

**Principle 3 — Every LLM output is factual, authoritative, and gracefully degraded.**
The diagnosis must be grounded in actual k6 metrics. No fabricated statistics, no hedging language, no probabilistic claims without measured basis. Language is decisive: "is consistent with connection pool exhaustion" not "suggests a possible issue." If JSON parsing fails at any LLM call, the system applies safe defaults and continues — it never crashes the loop.

---

## Section 3 — What NOT To Build

Every item below is a trap that looks architecturally correct but must be refused.

**Do NOT build a frontend dashboard.**
No React app, no Next.js UI, no separate web interface. The product lives inside Notion. A dashboard violates Principle 1.

**Do NOT integrate with Slack, email, PagerDuty, or any notification system.**
Notion already notifies the team. External notifications add build time and confuse the product story.

**Do NOT implement authentication or multi-user support.**
One user, one Notion workspace, one API key. No OAuth, no accounts, no sessions.

**Do NOT build a visual test builder, form UI, or YAML editor.**
Plain English in Notion is the entire point.

**Do NOT add CVE scanning, security testing, or vulnerability detection.**
This tool diagnoses performance failure only.

**Do NOT implement distributed load testing across multiple machines.**
k6 runs locally in a single Docker container. No k6 Cloud API, no distributed workers.

**Do NOT implement real-time WebSocket streaming to Notion.**
Notion MCP does not support WebSocket push. All Notion writes are REST calls at the end of test phases.

**Do NOT store raw k6 metrics in Notion.**
k6 outputs thousands of data points per second. Raw metrics stay in local JSON. Only summarized diagnosis goes to Notion.

**Do NOT implement test scheduling, cron jobs, or CI/CD hooks.**
Tests are triggered manually only.

**Do NOT auto-fix or modify the application under test.**
The tool diagnoses and recommends. It never touches the user's application code.

**Do NOT use Vertex AI, AWS Bedrock, or Azure OpenAI.**
LLM calls use Groq (`openai/gpt-oss-120b`) or Gemini (`gemini-2.0-flash`) via direct `fetch`. No SDK wrappers, no LangChain, no LlamaIndex.

**Do NOT validate the OpenAPI spec beyond endpoint extraction.**
If extraction fails, return a clear error. Do not build a spec validator.

**Do NOT retry failed test runs automatically.**
Infrastructure failure → write error to Notion → stop. No silent retries.

**Do NOT crash the pipeline on LLM JSON parse failure.**
Apply safe defaults (see Feature 4 — Fallback System) and continue. Reliability beats purity.

---

## Section 4 — Core Data Schema

### 4.1 Notion Database: "API Failure Reports" (created by init)

One row = one investigation run.

| Property Name | Notion Type | Values / Notes |
|---|---|---|
| `Name` | Title | Auto-generated: `[target_url] — [timestamp]` |
| `Status` | Select | `PENDING`, `RUNNING`, `PASSED`, `FAILED`, `ERROR` |
| `Target URL` | URL | Base URL of the API under investigation |
| `Spec Source` | URL | URL of the OpenAPI spec, or "inline" |
| `VU Count` | Number | Peak virtual users — extracted from spec |
| `Duration Seconds` | Number | Test duration in seconds — extracted from spec |
| `P95 Latency MS` | Number | p95 latency from k6, populated after run |
| `P95 Threshold MS` | Number | User-defined acceptable p95 — extracted from spec |
| `Error Rate` | Number | 0.00–1.00, populated after run |
| `Error Rate Threshold` | Number | User-defined acceptable error rate — extracted from spec |
| `Verdict` | Select | `PASSED`, `FAILED`, `INCONCLUSIVE` |
| `Verdict Emoji` | Rich Text | `✅ PASSED`, `❌ FAILED`, `⚠️ INCONCLUSIVE` — for visual scanning |
| `Headline` | Rich Text | One decisive sentence — what happened and what it means |
| `Primary Finding` | Rich Text | 2-3 sentences, every claim backed by a measured number |
| `Fix Recommendation` | Rich Text | One specific, actionable next step |
| `Confidence` | Select | `HIGH`, `MEDIUM`, `LOW` |
| `Confidence Reasoning` | Rich Text | One sentence explaining why this confidence level |
| `Run ID` | Rich Text | UUID for local file correlation |
| `Created` | Created Time | Auto-populated |

### 4.2 Notion Page: "Test Spec" (written by the user)

Plain Notion page. Agent reads via MCP. Recommended format:

```
Target: https://api.example.com
Spec: https://api.example.com/openapi.json

What I want to investigate:
Ramp to 300 concurrent users over 2 minutes.
Sustain for 3 minutes.
Investigate the checkout flow: POST /auth/login, GET /cart, POST /cart/items, POST /checkout.
Flag if p95 latency exceeds 200ms.
Flag if error rate exceeds 2%.
```

No rigid format enforced — the LLM handles natural variation. "Ramp to 300 users" and "300 concurrent people" extract identically.

### 4.3 Local File System (not in Notion)

```
/runs/
  {run_id}/
    spec.json           # Parsed spec extracted from Notion page
    k6_script.js        # LLM-generated k6 script
    k6_output.json      # Raw k6 JSON output (--out json)
    k6_summary.json     # k6 summary export (--summary-export)
    metrics.json        # Summarized metrics (p50, p95, p99, error_rate, rps, counts)
    rca.json            # Structured diagnosis before Notion write
```

### 4.4 Environment Configuration — .env.example

This file must be committed to the repo. A judge who hits an error on `cp .env.example .env` stops reviewing immediately.

```bash
# .env.example — copy to .env and fill in values

# Notion integration token
# Create at: https://www.notion.so/my-integrations
NOTION_API_KEY=your_notion_integration_token_here

# LLM provider — use "gemini" for the demo (faster JSON responses)
# Options: "gemini" | "groq"
LLM_PROVIDER=gemini

# Google Gemini API key (used when LLM_PROVIDER=gemini)
# Get at: https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Groq API key (used when LLM_PROVIDER=groq)
# Get at: https://console.groq.com/keys
GROQ_API_KEY=your_groq_api_key_here

# Populated automatically by: node index.js init
# Do not set manually
NOTION_DATABASE_ID=
NOTION_SPEC_PAGE_ID=

# Port for the Express server (default: 3001)
PORT=3001
```

---

## Section 5 — API Contracts

Single Express server. All endpoints called by the runner process, not the user directly.

### POST /api/run

**Request:**
```json
{
  "notion_page_id": "string — Notion page ID containing the test spec",
  "notion_database_id": "string — API Failure Reports database ID"
}
```

**Response 202:**
```json
{
  "run_id": "uuid-string",
  "status": "PENDING",
  "message": "Investigation started. Poll /api/run/{run_id}/status for updates."
}
```

**Response 400:**
```json
{
  "error": "SPEC_PARSE_FAILED",
  "message": "Could not extract target URL. Ensure Notion page contains 'Target: https://...'",
  "run_id": null
}
```

**Response 500:**
```json
{
  "error": "DOCKER_UNAVAILABLE",
  "message": "k6 Docker container failed to start. Verify Docker daemon is running.",
  "run_id": null
}
```

### GET /api/run/:run_id/status

**Response 200:**
```json
{
  "run_id": "string",
  "status": "RUNNING | PASSED | FAILED | ERROR",
  "phase": "SPEC_READING | SCRIPT_GENERATION | RUNNING | DIAGNOSING | WRITING_TO_NOTION | COMPLETE",
  "progress_message": "Running k6 — 47s elapsed, 253 VUs active",
  "elapsed_seconds": 47
}
```

### GET /api/run/:run_id/result

**Response 200:**
```json
{
  "run_id": "string",
  "verdict": "PASSED | FAILED | INCONCLUSIVE",
  "metrics": {
    "p50_ms": 45,
    "p95_ms": 1240,
    "p99_ms": 2100,
    "error_rate": 0.082,
    "peak_rps": 287,
    "peak_vus": 200,
    "total_requests": 13041,
    "failed_requests": 1069
  },
  "diagnosis": {
    "verdict": "FAILED",
    "verdict_emoji": "❌ FAILED",
    "headline": "Checkout collapses at 52 users — your safe limit is below this",
    "primary_finding": "POST /checkout p95 latency reached 1,240ms at peak load of 200 VUs, breaching the 300ms threshold by 4.1×. Error rate peaked at 8.2%, with 1,069 failed requests out of 13,041 total. The linear latency growth pattern from 40–80 VUs, before plateau at higher loads, is consistent with connection pool exhaustion rather than CPU or memory saturation.",
    "fix_recommendation": "Raise the database connection pool size for the checkout service. Add a queue with a configurable timeout so requests wait rather than fail when the pool is at capacity.",
    "confidence": "HIGH",
    "confidence_reasoning": "Both the p95 threshold (300ms) and error rate threshold (3%) were clearly breached, and the linear latency pattern across the 40–80 VU ramp is consistent with a hard resource ceiling — not gradual degradation."
  },
  "notion_report_url": "https://notion.so/..."
}
```

---

## Section 6 — Feature Specifications

### Feature 1 — Notion Spec Reader

**What it does:** Reads the plain English spec from a Notion page via MCP and extracts structured test parameters.

**Implementation:**
1. Call Notion MCP `retrieve_page` and `retrieve_block_children` with the page ID
2. Concatenate all block text into a single string
3. Call LLM with extraction prompt
4. Apply safe defaults for any missing non-critical fields (see fallback table below)
5. Validate only the one hard requirement: `target_url` must be present and valid
6. Store as `spec.json`

**Extraction prompt (use verbatim):**
```
You are a test configuration extractor. Extract the following fields from this investigation spec.
Return ONLY valid JSON with no explanation, no markdown, no code fences.

Fields to extract:
- target_url: string (base URL of the API, must start with http:// or https://)
- spec_url: string or null (URL to OpenAPI spec, null if not provided)
- endpoints: array of strings (HTTP method + path in order, e.g. ["POST /auth/login", "GET /cart"])
- max_vus: integer (peak concurrent virtual users)
- duration_seconds: integer (total test duration in seconds)
- ramp_seconds: integer (seconds to reach max_vus)
- p95_threshold_ms: integer (p95 latency failure threshold in ms)
- error_rate_threshold: float (error rate failure threshold 0.0–1.0)

If any field is not explicitly stated, use these defaults:
- max_vus: 100
- duration_seconds: 120
- ramp_seconds: 30
- p95_threshold_ms: 500
- error_rate_threshold: 0.05
- endpoints: [] (empty array — only if truly none mentioned)

Spec text:
{NOTION_PAGE_TEXT}
```

**Safe defaults table (applied after LLM parse, before validation):**
```javascript
const SPEC_DEFAULTS = {
  spec_url: null,
  endpoints: [],
  max_vus: 100,
  duration_seconds: 120,
  ramp_seconds: 30,
  p95_threshold_ms: 500,
  error_rate_threshold: 0.05
};

function applyDefaults(parsed) {
  return { ...SPEC_DEFAULTS, ...parsed };
}
```

**Hard validation — only two fields can cause SPEC_PARSE_FAILED:**
- `target_url` must start with `http://` or `https://` — without this, there is nothing to test
- `max_vus` must be between 1 and 1000 — values outside this range indicate a parse error

All other fields use defaults rather than failing.

---

### Feature 2 — k6 Script Generator

**What it does:** LLM generates a valid stateful k6 script from the parsed spec.

**Implementation:**
1. If `spec_url` present, fetch OpenAPI spec and extract request/response schemas for listed endpoints
2. Call LLM with generation prompt
3. Validate via `docker run --rm -v {run_dir}:/scripts grafana/k6:latest inspect /scripts/k6_script.js`
4. On validation failure: retry once, appending k6 stderr to the prompt
5. On second failure: write `SCRIPT_GENERATION_FAILED` to Notion and halt

**Generation prompt (use verbatim):**
```
You are a k6 load testing script generator. Generate a valid k6 JavaScript script.

Hard rules:
- Use k6 version 0.46+ syntax only
- Execute endpoints in the EXACT ORDER listed — they form a stateful user journey
- Extract response values (auth tokens, IDs) and pass to subsequent requests
- Use ramping-vus executor with stages from the ramp/duration parameters
- Set thresholds for p95 latency and error rate using provided values
- Add sleep(Math.random() * 0.4 + 0.1) between requests (100–500ms pacing)
- Handle HTTP 4xx/5xx per-request without aborting the VU
- Return ONLY the JavaScript code — no explanation, no markdown, no code fences

Parameters:
- Target URL: {target_url}
- Endpoints (in order): {endpoints}
- Max VUs: {max_vus}
- Ramp seconds: {ramp_seconds}
- Duration seconds: {duration_seconds}
- P95 threshold: {p95_threshold_ms}ms
- Error rate threshold: {error_rate_threshold}

OpenAPI schemas for listed endpoints:
{openapi_schemas_or_NONE}
```

---

### Feature 3 — k6 Test Runner

**What it does:** Executes the k6 script in Docker, writes Notion status during run.

**Docker command:**
```bash
docker run --rm \
  -v {run_dir}:/scripts \
  --network host \
  grafana/k6:latest run \
  --out json=/scripts/k6_output.json \
  --summary-export /scripts/k6_summary.json \
  /scripts/k6_script.js
```

**Metrics extraction from k6_summary.json:**
```javascript
function extractMetrics(summary) {
  try {
    return {
      p50_ms:          Math.round(summary.metrics['http_req_duration'].values['p(50)'] ?? 0),
      p95_ms:          Math.round(summary.metrics['http_req_duration'].values['p(95)'] ?? 0),
      p99_ms:          Math.round(summary.metrics['http_req_duration'].values['p(99)'] ?? 0),
      error_rate:      summary.metrics['http_req_failed']?.values?.rate ?? 0,
      peak_rps:        Math.round(summary.metrics['http_reqs']?.values?.rate ?? 0),
      total_requests:  summary.metrics['http_reqs']?.values?.count ?? 0,
      failed_requests: Math.round(
        (summary.metrics['http_reqs']?.values?.count ?? 0) *
        (summary.metrics['http_req_failed']?.values?.rate ?? 0)
      )
    };
  } catch (e) {
    // Partial metrics are better than a crash
    return { p50_ms: 0, p95_ms: 0, p99_ms: 0, error_rate: 0,
             peak_rps: 0, total_requests: 0, failed_requests: 0 };
  }
}
```

**Notion updates:**
- Run start → `Status: RUNNING`
- Run end → `Status: PASSED` (exit 0) | `Status: FAILED` (threshold breach) | `Status: ERROR` (script error)

**Error handling:**
- Docker unavailable → write ERROR to Notion with message "Docker daemon not running. Start Docker Desktop and retry." → halt cleanly
- k6 threshold breach (exit non-zero) → expected FAILED path, continue to diagnosis
- k6 script error (exit non-zero, not threshold) → write ERROR + first 500 chars of stderr to Notion → halt

---

### Feature 4 — LLM Diagnosis Engine + Fallback System

**What it does:** Analyzes k6 metrics and produces a decisive, factual diagnosis. Never crashes the pipeline on LLM failure.

**Implementation:**
1. Load `metrics.json` and `spec.json`
2. Call LLM with diagnosis prompt
3. Parse JSON response
4. On parse failure: retry once with error correction prefix
5. On second failure: apply DIAGNOSIS_FALLBACK (see below) — do not halt
6. Store result as `rca.json`

**Diagnosis prompt (use verbatim — language rules are critical):**
```
You are a performance engineering analyst producing a failure diagnosis.

LANGUAGE RULES — enforce strictly:
- Every claim MUST cite a specific number from the metrics below
- BANNED words: "typically", "usually", "often", "studies show", "can indicate", "may suggest"
- USE INSTEAD: "is consistent with", "indicates", "confirms", "shows"
- Headline must include a number AND what it means for the user
- If root cause is genuinely unclear, set confidence LOW and headline to
  "Investigation complete — manual review required to determine root cause"
- Return ONLY valid JSON, no explanation, no markdown, no code fences

Parameters:
- Target URL: {target_url}
- Endpoints tested (in order): {endpoints}
- Peak VUs: {max_vus}
- P95 threshold: {p95_threshold_ms}ms
- Error rate threshold: {error_rate_percent}%

Measured results:
- p50 latency: {p50_ms}ms
- p95 latency: {p95_ms}ms
- p99 latency: {p99_ms}ms
- Error rate: {error_rate_percent}%
- Peak RPS: {peak_rps}
- Total requests: {total_requests}
- Failed requests: {failed_requests}

Return this exact JSON:
{
  "verdict": "PASSED | FAILED | INCONCLUSIVE",
  "verdict_emoji": "✅ PASSED | ❌ FAILED | ⚠️ INCONCLUSIVE",
  "headline": "one sentence, max 15 words, includes a number, ends with what it means for the user",
  "primary_finding": "2-3 sentences. Every claim cites a number. Authoritative, not hedged.",
  "fix_recommendation": "one specific actionable next step. Not generic advice.",
  "confidence": "HIGH | MEDIUM | LOW",
  "confidence_reasoning": "one sentence — cite the specific evidence supporting this confidence level"
}

Verdict rules:
- PASSED: p95_ms < p95_threshold_ms AND error_rate < error_rate_threshold
- FAILED: p95_ms >= p95_threshold_ms OR error_rate >= error_rate_threshold
- INCONCLUSIVE: test completed but total_requests < 100
```

**DIAGNOSIS_FALLBACK — applied on second LLM failure, never exposed as a crash:**
```javascript
const DIAGNOSIS_FALLBACK = {
  verdict: metrics.p95_ms >= spec.p95_threshold_ms || metrics.error_rate >= spec.error_rate_threshold
    ? "FAILED" : "PASSED",
  verdict_emoji: metrics.p95_ms >= spec.p95_threshold_ms || metrics.error_rate >= spec.error_rate_threshold
    ? "❌ FAILED" : "✅ PASSED",
  headline: `API ${metrics.error_rate >= spec.error_rate_threshold ? "exceeded error threshold" : "exceeded latency threshold"} — your safe limit is below ${spec.max_vus} users`,
  primary_finding: `P95 latency measured ${metrics.p95_ms}ms against a ${spec.p95_threshold_ms}ms threshold. Error rate was ${(metrics.error_rate * 100).toFixed(1)}% against a ${(spec.error_rate_threshold * 100).toFixed(1)}% threshold. Automated narrative unavailable — review raw metrics in the run directory.`,
  fix_recommendation: `Review /runs/${runId}/metrics.json for full data. Compare p95 latency curve against VU ramp to identify the failure point.`,
  confidence: "LOW",
  confidence_reasoning: "Automated diagnosis unavailable — metrics are real but narrative generation failed. Raw data is accurate."
};
```

**Note on the fallback:** The verdict in the fallback is calculated deterministically from real metrics — it is always correct. Only the narrative is degraded. This is disclosed via the LOW confidence field. Judges respect this honesty.

**LLM implementations:**

Groq (`openai/gpt-oss-120b`):
```javascript
async function callGroq(prompt) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: "json_object" }
    })
  });
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}
```

Gemini (`gemini-2.0-flash`) — **use for the demo, more reliable JSON output:**
```javascript
async function callGemini(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 600,
          responseMimeType: "application/json"
        }
      })
    }
  );
  const data = await response.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}
```

**Universal LLM wrapper with retry + fallback (use for all three LLM calls):**
```javascript
async function callLLM(prompt, fallback) {
  const callFn = process.env.LLM_PROVIDER === "groq" ? callGroq : callGemini;

  // First attempt
  try {
    return await callFn(prompt);
  } catch (e) {
    console.warn("LLM first attempt failed:", e.message);
  }

  // Retry with correction prefix
  try {
    const correctionPrompt = "Your previous response was not valid JSON. Return ONLY the JSON object, nothing else.\n\n" + prompt;
    return await callFn(correctionPrompt);
  } catch (e) {
    console.warn("LLM retry failed:", e.message);
  }

  // Apply fallback — never crash
  console.warn("Both LLM attempts failed. Applying safe fallback.");
  return fallback;
}
```

---

### Feature 5 — Notion Report Writer

**Critical:** The metrics comparison table must be the FIRST element in the Notion report sub-page. Judges scan visually. Verdict and numbers must be visible without scrolling.

**Database row update:**
```javascript
await notion.pages.update({
  page_id: run.notion_row_id,
  properties: {
    "Status":               { select: { name: diagnosis.verdict } },
    "P95 Latency MS":       { number: metrics.p95_ms },
    "P95 Threshold MS":     { number: spec.p95_threshold_ms },
    "Error Rate":           { number: metrics.error_rate },
    "Error Rate Threshold": { number: spec.error_rate_threshold },
    "Verdict":              { select: { name: diagnosis.verdict } },
    "Verdict Emoji":        { rich_text: [{ text: { content: diagnosis.verdict_emoji } }] },
    "Headline":             { rich_text: [{ text: { content: diagnosis.headline } }] },
    "Primary Finding":      { rich_text: [{ text: { content: diagnosis.primary_finding } }] },
    "Fix Recommendation":   { rich_text: [{ text: { content: diagnosis.fix_recommendation } }] },
    "Confidence":           { select: { name: diagnosis.confidence } },
    "Confidence Reasoning": { rich_text: [{ text: { content: diagnosis.confidence_reasoning } }] }
  }
});
```

**Full report sub-page — THIS EXACT ORDER, metrics table always first:**

```
{verdict_emoji}  Investigation Report — {target_url}
{timestamp} · {duration_seconds}s · {max_vus} peak users

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Results at a glance

| Metric          | Measured            | Your Threshold          | Status |
|-----------------|---------------------|-------------------------|--------|
| P95 Latency     | {p95_ms}ms          | {p95_threshold_ms}ms    | ✅/❌  |
| Error Rate      | {error_rate_pct}%   | {error_threshold_pct}%  | ✅/❌  |
| Peak RPS        | {peak_rps}          | —                       | —      |
| Total Requests  | {total_requests}    | —                       | —      |
| Failed          | {failed_requests}   | —                       | —      |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## What happened

{headline}

{primary_finding}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## What to fix — before your users find it

{fix_recommendation}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Diagnosis confidence

{confidence} — {confidence_reasoning}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## What was investigated

Endpoints (in order): {endpoints_list}

Additional metrics:
- p50 latency: {p50_ms}ms
- p99 latency: {p99_ms}ms
- Ramp period: {ramp_seconds}s to {max_vus} VUs
- Sustain period: {duration_seconds - ramp_seconds}s
```

**All Notion MCP calls (all five must be present for structural validity):**
- `retrieve_page` + `retrieve_block_children` → reads spec
- `pages.update` (call 1) → sets RUNNING at test start
- `pages.update` (call 2) → writes full diagnosis at test end
- `pages.create` → creates full report sub-page as child of database row
- `databases.query` → used by init to check for duplicate database

---

### Feature 6 — Init Command

`node index.js init`

1. Calls `databases.query` to check if "API Failure Reports" already exists — does not create duplicates
2. Calls `databases.create` with all properties from Section 4.1
3. Calls `pages.create` to build the template spec page with the Section 4.2 format
4. Appends `NOTION_DATABASE_ID` and `NOTION_SPEC_PAGE_ID` to the `.env` file automatically
5. Prints confirmation with both URLs so the user can open them in Notion

---

## Section 7 — Demo Scenarios

### Scenario 1 — "The 3am Call" (primary demo)

**Setup:** Local Express API at `http://localhost:3001` with `/auth/login`, `/cart`, `/checkout`. Checkout has a simulated connection pool capped at 50 concurrent connections. This is a realistic bottleneck pattern.

**Notion spec page:**
```
Target: http://localhost:3001
Spec: http://localhost:3001/openapi.json

What I want to investigate:
Ramp to 200 concurrent users over 90 seconds.
Sustain for 3 minutes.
Investigate the checkout flow: POST /auth/login, GET /cart, POST /checkout.
Flag if p95 latency exceeds 300ms or error rate exceeds 3%.
```

**Expected Notion report:**
```
❌ FAILED  Investigation Report — http://localhost:3001
March 27, 2026 · 270s · 200 peak users

Results at a glance
┌──────────────────┬──────────┬───────────┬────────┐
│ Metric           │ Measured │ Threshold │ Status │
├──────────────────┼──────────┼───────────┼────────┤
│ P95 Latency      │ 1240ms   │ 300ms     │  ❌    │
│ Error Rate       │ 8.2%     │ 3%        │  ❌    │
│ Peak RPS         │ 287      │ —         │  —     │
│ Total Requests   │ 13,041   │ —         │  —     │
│ Failed           │ 1,069    │ —         │  —     │
└──────────────────┴──────────┴───────────┴────────┘

What happened
Checkout collapses at 52 users — your safe limit is below this.

POST /checkout p95 latency reached 1,240ms at peak load, breaching the 300ms
threshold by 4.1×. Error rate peaked at 8.2%, with 1,069 failed requests out
of 13,041 total. The linear latency growth from 40–80 VUs before plateau is
consistent with connection pool exhaustion rather than CPU or memory saturation.

What to fix — before your users find it
Raise the database connection pool size for the checkout service. Add a queue
with a configurable timeout so requests wait rather than fail immediately when
the pool is at capacity.

Confidence: HIGH
HIGH — Both the p95 threshold (300ms) and error rate threshold (3%) were
clearly breached. The linear latency growth pattern across the 40–80 VU ramp
is consistent with a hard resource ceiling, not gradual degradation.
```

---

### Scenario 2 — "Clean Bill of Health" (pass case)

**Setup:** Same API, connection pool raised to 500. Same Notion workflow, 100 VUs.

**Expected output:**
```
✅ PASSED  Investigation Report — http://localhost:3001

Results at a glance
┌─────────────┬──────────┬───────────┬────────┐
│ P95 Latency │  87ms    │  300ms    │  ✅    │
│ Error Rate  │  0.0%    │  3%       │  ✅    │
│ Peak RPS    │  142     │  —        │  —     │
└─────────────┴──────────┴───────────┴────────┘

What happened
API stable at 100 users — all thresholds passed with margin.

P95 latency peaked at 87ms across 8,400 requests, 3.4× below the 300ms
threshold. Zero failed requests at peak throughput of 142 RPS.

What to fix — before your users find it
No action required at this load level. Investigate at 300+ VUs to establish
your actual failure ceiling before your next traffic event.

Confidence: HIGH
HIGH — Both thresholds passed with significant margin. Zero errors across
8,400 requests confirms stability at 100 concurrent users.
```

**Why this scenario matters:** Proves the tool is a diagnostic instrument, not a false-alarm generator. Same Notion workflow. Different API config. Different verdict. This is the before/after proof.

---

### Scenario 3 — "Edit and Rerun" (the human-in-the-loop moment)

**Action:** After Scenario 1, the developer edits ONE LINE in the Notion spec — changes "200 concurrent users" to "50 concurrent users" — and reruns.

**Expected output:**
```
✅ PASSED  Investigation Report — http://localhost:3001

P95 Latency: 143ms (threshold: 300ms) ✅
Error Rate: 0.4%   (threshold: 3%)    ✅

What happened
API stable at 50 users — failure ceiling is between 50 and 200 concurrent users.
```

**Why this wins:** The developer edited one plain English sentence in Notion — not code, not YAML, not a config file — and got a completely different investigation. This is the human-in-the-loop moment the challenge description calls out explicitly. Show this last. Say nothing while the result appears. Let the silence work.

---

## Section 7B — Demo Script (5-minute live delivery)

Pauses are intentional. Do not fill them.

| Timestamp | Action | Words |
|---|---|---|
| 0:00 | Open Notion, spec page visible on screen | *"This API passed CI yesterday. It will fail in production before your users tell you."* |
| 0:20 | Point at plain English spec | *"This is the entire investigation definition. Plain English. No config files. No YAML."* |
| 0:35 | Trigger run (`node index.js run`) | *"Running."* — say nothing else |
| 0:45–3:00 | k6 executes, terminal visible | Say nothing. The silence builds. |
| 3:00 | Notion refreshes — ❌ FAILED appears | Read headline aloud: *"Checkout collapses at 52 users — your safe limit is below this."* Pause 4 seconds. |
| 3:10 | — | *"No logs. No dashboards. Just Notion."* |
| 3:20 | Scroll to metrics table | Let judges read it silently. Do not narrate the numbers. |
| 3:40 | Scroll to Fix Recommendation | Read it aloud once. |
| 3:55 | Back to spec page, change "200" → "50" | *"Changing one line."* |
| 4:10 | Trigger run again | Say nothing. |
| 5:20 | Notion shows ✅ PASSED | *"Your failure ceiling is between 50 and 200 users. You just found it in under 6 minutes — before your users did."* |
| 5:35 | Done. | Stop talking. |

**Pre-recorded backup (mandatory — do this before the live session):**

Run Scenario 1 to completion before the demo. Save the resulting Notion page URL. If Docker fails, k6 crashes, or Notion latency spikes during the live demo, open the pre-recorded Notion page and narrate over it. Judges do not penalize pre-recorded backup demos. A smooth walkthrough of a real output beats a failed live run every time.

```bash
# Run this the day before the demo
node index.js run
# Save the Notion report URL from the output
# Screenshot the full report page
# Keep the terminal output as a backup reference
```

---

## Section 8 — Known Limitations

State these in the DEV post. Judges score honesty.

**Local execution only.** k6 runs on your machine via Docker. Not a cloud fleet. Realistic maximum is 500–1000 concurrent users depending on machine specs. Enough to find the failure ceiling of any typical API — before your users do.

**Single API per test.** v1 investigates one base URL per run. Multi-service investigation is v2.

**Plain English parsing accuracy.** The LLM handles natural phrasing well. Highly ambiguous or terse specs may extract to defaults. The Section 4.2 format is recommended for reliable parsing.

**Docker required.** Docker Desktop or Docker Engine must be running locally. Standard for the target audience.

**Notion write latency.** Results appear 2–5 seconds after test completion. Not instant — this is expected.

**RCA is pattern-based, not traced.** Diagnosis is inferred from aggregate k6 metrics. "Connection pool exhaustion" is a pattern inference, not a direct read from your application's pool state. Disclosed in every Confidence Reasoning field.

**LLM fallback degrades narrative, not verdict.** If both LLM attempts fail, the verdict is still calculated correctly from real metrics. The narrative is replaced with raw numbers and a note to review the local files. Verdict accuracy is never compromised.

---

## Section 9 — Passing Criteria

A feature is not done until all criteria in its block pass.

### Feature 1 — Spec Reader
- [ ] Valid Notion page → all 8 fields extracted correctly, including defaults for unstated values
- [ ] Notion page missing `Target:` → SPEC_PARSE_FAILED written to Notion, process halts cleanly
- [ ] Ambiguous VU phrasing ("a few hundred") → default of 100 applied, no crash
- [ ] `retrieve_page` and `retrieve_block_children` calls verified in server logs

### Feature 2 — Script Generator
- [ ] Generated script passes `k6 inspect` with exit code 0
- [ ] Endpoints appear in script in the correct order
- [ ] Threshold values in script match spec values exactly
- [ ] Failed first attempt → retry with stderr feedback → valid script produced

### Feature 3 — k6 Runner
- [ ] `k6_output.json` and `k6_summary.json` written to run directory after completion
- [ ] Notion Status is `RUNNING` during test, transitions correctly at completion
- [ ] Docker unavailable → clean error written to Notion, server does not crash
- [ ] Metrics extraction does not throw on any k6 summary format variation

### Feature 4 — Diagnosis Engine
- [ ] Every number in `primary_finding` matches a value in `metrics.json`
- [ ] No hedging language in output ("suggests", "may", "typically")
- [ ] Headline always includes a number and ends with user-facing implication
- [ ] Verdict is `PASSED` when both thresholds are met
- [ ] Verdict is `FAILED` when either threshold is breached
- [ ] On first LLM failure → retry attempt made
- [ ] On second LLM failure → DIAGNOSIS_FALLBACK applied, verdict still correct, pipeline continues
- [ ] `confidence_reasoning` always cites specific evidence

### Feature 5 — Notion Writer
- [ ] Metrics table is the FIRST block in the report sub-page
- [ ] All 13 database properties updated correctly in the row
- [ ] Report sub-page created as child of the database row
- [ ] All 5 Notion MCP call types used and logged
- [ ] `notion_report_url` opens the correct Notion page

### Feature 6 — Init
- [ ] Running init twice does not create duplicate databases
- [ ] `.env` file updated with both IDs automatically after init
- [ ] Template spec page matches Section 4.2 format exactly

### End-to-End
- [ ] Scenario 1 completes in under 8 minutes (Notion read to Notion write)
- [ ] Scenario 2 produces PASSED verdict
- [ ] Editing one line in Notion spec and rerunning produces a different verdict
- [ ] Zero terminal interaction required after first run trigger
- [ ] Pre-recorded backup demo page exists before live demo date

---

## Section 10 — Architecture

```
index.js (CLI entry point)
  ├── init   →  notionMCP.createDatabase() + createTemplatePage() + updateEnvFile()
  └── run    →  orchestrator.run(pageId, databaseId)

orchestrator.js (sequential pipeline — no parallelism)
  1.  notionMCP.getPageContent(pageId)           → raw spec text
  2.  llm.extractSpec(rawText)                   → spec.json  [with fallback]
  3.  notionMCP.updatePage(RUNNING)              → Notion status: RUNNING
  4.  llm.generateK6Script(spec)                → k6_script.js  [with retry]
  5.  k6Runner.execute(scriptPath, runDir)       → k6_output.json + k6_summary.json
  6.  metricsParser.extract(summaryPath)         → metrics.json  [never throws]
  7.  notionMCP.updatePage(PASSED|FAILED|ERROR)  → Notion status: final
  8.  llm.generateDiagnosis(spec, metrics)       → rca.json  [with fallback]
  9.  notionMCP.updatePage(all diagnosis fields) → Notion row: complete
  10. notionMCP.createPage(full report)          → Notion sub-page

llm.js
  ├── provider: "groq" | "gemini"  (LLM_PROVIDER env var)
  ├── callLLM(prompt, fallback)    → parsed object  [universal wrapper with retry]
  ├── extractSpec(text)            → structured spec
  ├── generateK6Script(spec)       → JavaScript string  [retry on k6 inspect failure]
  └── generateDiagnosis(spec, metrics) → structured diagnosis

notionMCP.js (wraps @notionhq/client v2)
  ├── getPageContent(pageId)         → string
  ├── updatePage(pageId, properties) → void
  ├── createPage(parentId, blocks)   → page object
  └── queryDatabase(databaseId)      → results array

k6Runner.js
  └── execute(scriptPath, runDir) → Promise<{ exitCode, durationMs }>

metricsParser.js
  └── extract(summaryPath) → metrics object  [catches all exceptions, returns zeros]
```

**Stack:**
- Runtime: Node.js 20
- Notion: `@notionhq/client` v2
- k6: `grafana/k6:latest` Docker image
- LLM: Gemini or Groq via direct `fetch` — no SDK, no LangChain
- Storage: Local filesystem for run artifacts
- Config: `.env` file (see Section 4.4 for complete `.env.example`)

**Single setup command:**
```bash
npm install && cp .env.example .env
# Fill in NOTION_API_KEY, LLM_PROVIDER, and the relevant API key
node index.js init
# Creates database + template page, auto-fills NOTION_DATABASE_ID and NOTION_SPEC_PAGE_ID in .env
node index.js run
# Full investigation loop
```

---

## Section 11 — DEV Post

**Title (final — do not change):**
> "It Passed CI. It Breaks at 52 Users. Notion Told Me Why."

**Tags:** `#notionchallenge` `#devchallenge` `#mcp` `#ai`

**Opening paragraph (determines reactions — do not change):**
> "Your CI pipeline runs your tests at 10 concurrent users. Your checkout handles 200 on a normal Tuesday. Nobody connected those two facts — so I built a tool that does. You write what to investigate in plain English in Notion. An agent runs the test and writes back exactly where and why your API breaks — before your users find it. No terminal. No dashboard. Just Notion."

**Post structure:**
1. Opening paragraph above — no changes
2. Screenshot of the Notion report — metrics table visible, ❌ FAILED verdict prominent, no scrolling required
3. How it works: four steps in plain English (write → run → diagnose → read in Notion)
4. Screenshot of the edit-and-rerun moment: one line changed → ✅ PASSED
5. Known limitations: 3 honest bullet points
6. GitHub link + single setup command block
7. Closing line: *"The bottleneck was always there. Now you can find it before your users do."*

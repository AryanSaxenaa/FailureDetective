export function buildSpecExtractionPrompt(rawText) {
  return `You are a test configuration extractor. Extract the following fields from this investigation spec.
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
${rawText}`;
}

export function buildK6ScriptPrompt(spec, openApiSchemas) {
  return `You are a k6 load testing script generator. Generate a valid k6 JavaScript script.

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
- Target URL: ${spec.target_url}
- Endpoints (in order): ${JSON.stringify(spec.endpoints)}
- Max VUs: ${spec.max_vus}
- Ramp seconds: ${spec.ramp_seconds}
- Duration seconds: ${spec.duration_seconds}
- P95 threshold: ${spec.p95_threshold_ms}ms
- Error rate threshold: ${spec.error_rate_threshold}

OpenAPI schemas for listed endpoints:
${openApiSchemas || "NONE"}`;
}

export function buildDiagnosisPrompt(spec, metrics) {
  const p50 = Number.isFinite(metrics.p50_ms) ? `${metrics.p50_ms}ms` : "unavailable";
  const p95 = Number.isFinite(metrics.p95_ms) ? `${metrics.p95_ms}ms` : "unavailable";
  const p99 = Number.isFinite(metrics.p99_ms) ? `${metrics.p99_ms}ms` : "unavailable";
  return `You are a performance engineering analyst producing a failure diagnosis.

LANGUAGE RULES — enforce strictly:
- Every claim MUST cite a specific number from the metrics below
- BANNED words: "typically", "usually", "often", "studies show", "can indicate", "may suggest"
- USE INSTEAD: "is consistent with", "indicates", "confirms", "shows"
- Headline must include a number AND what it means for the user
- If root cause is genuinely unclear, set confidence LOW and headline to
  "Investigation complete — manual review required to determine root cause"
- Return ONLY valid JSON, no explanation, no markdown, no code fences

Parameters:
- Target URL: ${spec.target_url}
- Endpoints tested (in order): ${JSON.stringify(spec.endpoints)}
- Peak VUs: ${spec.max_vus}
- P95 threshold: ${spec.p95_threshold_ms}ms
- Error rate threshold: ${(spec.error_rate_threshold * 100).toFixed(1)}%

Measured results:
- p50 latency: ${p50}
- p95 latency: ${p95}
- p99 latency: ${p99}
- Error rate: ${(metrics.error_rate * 100).toFixed(1)}%
- Peak RPS: ${metrics.peak_rps}
- Total requests: ${metrics.total_requests}
- Failed requests: ${metrics.failed_requests}

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
- INCONCLUSIVE: test completed but total_requests < 100`;
}

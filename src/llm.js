import fs from "node:fs";
import path from "node:path";
import { SPEC_DEFAULTS, VERDICTS } from "./constants.js";
import { buildDiagnosisPrompt, buildK6ScriptPrompt, buildSpecExtractionPrompt } from "./prompts.js";

function applyDefaults(parsed) {
  return { ...SPEC_DEFAULTS, ...parsed };
}

function normalizeSpec(spec) {
  const merged = applyDefaults(spec);
  return {
    ...merged,
    target_url: merged.target_url?.trim(),
    spec_url: merged.spec_url?.trim() || null,
    endpoints: Array.isArray(merged.endpoints) ? merged.endpoints : [],
    max_vus: Number(merged.max_vus),
    duration_seconds: Number(merged.duration_seconds),
    ramp_seconds: Number(merged.ramp_seconds),
    p95_threshold_ms: Number(merged.p95_threshold_ms),
    error_rate_threshold: Number(merged.error_rate_threshold)
  };
}

function validateSpec(spec) {
  if (!spec.target_url || !/^https?:\/\//.test(spec.target_url)) {
    const error = new Error("Could not extract target URL. Ensure Notion page contains 'Target: https://...'");
    error.code = "SPEC_PARSE_FAILED";
    throw error;
  }
  if (!Number.isFinite(spec.max_vus) || spec.max_vus < 1 || spec.max_vus > 1000) {
    const error = new Error("Parsed VU count is invalid. Ensure the investigation page specifies 1 to 1000 users.");
    error.code = "SPEC_PARSE_FAILED";
    throw error;
  }
}

function dockerReachableTargetUrl(targetUrl) {
  return targetUrl
    .replace("://localhost", "://host.docker.internal")
    .replace("://127.0.0.1", "://host.docker.internal");
}

function latencyText(value) {
  return Number.isFinite(value) ? `${value}ms` : "unavailable";
}

function errorRatePercentText(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function extractFirstUrl(text) {
  if (!text) {
    return null;
  }
  const markdownMatch = text.match(/\((https?:\/\/[^)\s]+)\)/i);
  if (markdownMatch) {
    return markdownMatch[1];
  }
  const directMatch = text.match(/https?:\/\/[^\s)]+/i);
  return directMatch ? directMatch[0] : null;
}

function toSeconds(amount, unit) {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return null;
  }
  return /minute/i.test(unit) ? value * 60 : value;
}

function parseSpecHeuristically(rawText) {
  const lines = rawText.split(/\r?\n/);
  const targetLine = lines.find((line) => /^target\s*:/i.test(line));
  const specLine = lines.find((line) => /^spec\s*:/i.test(line));
  const rampMatch = rawText.match(/ramp\s+to\s+(\d+)\s+(?:concurrent\s+)?(?:users|virtual users|vus)[^.]*?\bover\s+(\d+)\s+(seconds?|minutes?)/i);
  const sustainMatch = rawText.match(/sustain\s+for\s+(\d+)\s+(seconds?|minutes?)/i);
  const durationMatch = rawText.match(/duration(?:\s+of)?\s+(\d+)\s+(seconds?|minutes?)/i);
  const p95Match = rawText.match(/p95\s+latency\s+exceeds\s+(\d+)\s*ms/i);
  const errorRateMatch = rawText.match(/error\s+rate\s+exceeds\s+(\d+(?:\.\d+)?)\s*%/i);
  const endpoints = [...rawText.matchAll(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[^\s,.)]+)/gi)].map((match) => `${match[1].toUpperCase()} ${match[2]}`);
  const rampSeconds = rampMatch ? toSeconds(rampMatch[2], rampMatch[3]) : null;
  const sustainSeconds = sustainMatch ? toSeconds(sustainMatch[1], sustainMatch[2]) : null;
  const explicitDuration = durationMatch ? toSeconds(durationMatch[1], durationMatch[2]) : null;

  return {
    target_url: extractFirstUrl(targetLine || rawText),
    spec_url: extractFirstUrl(specLine || ""),
    endpoints,
    max_vus: rampMatch ? Number(rampMatch[1]) : undefined,
    ramp_seconds: rampSeconds ?? undefined,
    duration_seconds: explicitDuration ?? ((((rampSeconds ?? 0) + (sustainSeconds ?? 0)) || undefined)),
    p95_threshold_ms: p95Match ? Number(p95Match[1]) : undefined,
    error_rate_threshold: errorRateMatch ? Number(errorRateMatch[1]) / 100 : undefined
  };
}

function buildDeterministicK6Script(spec) {
  const sustainSeconds = Math.max(spec.duration_seconds - spec.ramp_seconds, 1);
  const steps = (spec.endpoints.length > 0 ? spec.endpoints : ["GET /"]).map((endpoint) => {
    const [method, ...rest] = endpoint.split(" ");
    const endpointPath = rest.join(" ");
    return `  requestStep("${method}", "${endpointPath}", state);`;
  }).join("\n");

  return `import http from "k6/http";
import { sleep } from "k6";

export const options = {
  scenarios: {
    investigation: {
      executor: "ramping-vus",
      stages: [
        { duration: "${spec.ramp_seconds}s", target: ${spec.max_vus} },
        { duration: "${sustainSeconds}s", target: ${spec.max_vus} },
        { duration: "1s", target: 0 }
      ]
    }
  },
  thresholds: {
    http_req_duration: ["p(95)<${spec.p95_threshold_ms}"],
    http_req_failed: ["rate<${spec.error_rate_threshold}"]
  }
};

const BASE_URL = "${spec.target_url}";
const SUCCESS_STATUSES = http.expectedStatuses({ min: 200, max: 399 });

function safeJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

function extractState(state, data) {
  if (!data || typeof data !== "object") {
    return;
  }
  const token = data.token || data.authToken || data.access_token;
  if (typeof token === "string" && token.length > 0) {
    state.authToken = token;
  }
  const entityId = data.id || data.cartId || data.orderId || data.userId;
  if (typeof entityId === "string" && entityId.length > 0) {
    state.lastId = entityId;
  }
}

function buildBody(method, endpointPath, state) {
  if (method === "GET") {
    return null;
  }
  if (endpointPath.includes("/auth/login")) {
    return JSON.stringify({ email: "loadtest@example.com", password: "password123" });
  }
  if (state.lastId) {
    return JSON.stringify({ id: state.lastId });
  }
  return JSON.stringify({});
}

function requestStep(method, endpointPath, state) {
  const headers = { "Content-Type": "application/json" };
  if (state.authToken) {
    headers.Authorization = \`Bearer \${state.authToken}\`;
  }
  const response = http.request(method, \`\${BASE_URL}\${endpointPath}\`, buildBody(method, endpointPath, state), {
    headers,
    responseCallback: SUCCESS_STATUSES,
    tags: { endpoint: \`\${method} \${endpointPath}\` }
  });
  extractState(state, safeJson(response));
  sleep(Math.random() * 0.4 + 0.1);
}

export default function () {
  const state = {};
${steps}
}`;
}

async function parseJsonResponse(response) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LLM request failed with ${response.status}: ${body}`);
  }
  return response.json();
}

async function callGroq(prompt) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 1200
    })
  });
  const data = await parseJsonResponse(response);
  const text = data?.choices?.[0]?.message?.content;
  return parseJsonObjectFromText(text);
}

function parseJsonObjectFromText(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    throw new Error("Empty model response");
  }

  try {
    return JSON.parse(trimmed);
  } catch {}

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1]);
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
  }

  throw new Error("No JSON object found in model response");
}

async function callRawCodeGroq(prompt) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 1600
    })
  });
  const data = await parseJsonResponse(response);
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function callRawCodeLLM(prompt) {
  try {
    return await callRawCodeGroq(prompt);
  } catch (error) {
    console.warn("Groq raw-code generation failed:", error.message);
    throw error;
  }
}

function sanitizeGeneratedCode(code) {
  let next = (code || "").trim();
  next = next.replace(/^```(?:javascript|js)?\s*/i, "");
  next = next.replace(/\s*```$/, "");
  return next.trim();
}

function availableProviders() {
  const providers = [];

  if (process.env.GROQ_API_KEY) {
    providers.push({ name: "groq", fn: callGroq });
  }

  return providers;
}

export async function callLLM(prompt, fallback) {
  const providers = availableProviders();

  for (const provider of providers) {
    try {
      return await provider.fn(prompt);
    } catch (error) {
      console.warn(`LLM first attempt failed on ${provider.name}:`, error.message);
    }

    try {
      const correctionPrompt = "Your previous response was not valid JSON. Return ONLY the JSON object, nothing else.\n\n" + prompt;
      return await provider.fn(correctionPrompt);
    } catch (error) {
      console.warn(`LLM retry failed on ${provider.name}:`, error.message);
    }
  }

  console.warn("Both LLM attempts failed. Applying safe fallback.");
  return fallback;
}

export async function extractSpec(rawText) {
  const heuristic = parseSpecHeuristically(rawText);
  const fallback = {
    ...SPEC_DEFAULTS,
    ...heuristic
  };
  const parsed = await callLLM(buildSpecExtractionPrompt(rawText), fallback);
  const spec = normalizeSpec({
    ...fallback,
    ...parsed
  });
  validateSpec(spec);
  return spec;
}

export async function fetchOpenApiSchemas(spec) {
  if (!spec.spec_url) {
    return "NONE";
  }

  const response = await fetch(spec.spec_url);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
  }

  const openApi = await response.json();
  const summarized = [];

  for (const endpoint of spec.endpoints) {
    const [method, endpointPath] = endpoint.split(/\s+/, 2);
    const definition = openApi.paths?.[endpointPath]?.[method.toLowerCase()];
    if (!definition) {
      continue;
    }
    summarized.push({
      endpoint,
      summary: definition.summary || null,
      requestBody: definition.requestBody || null,
      responses: definition.responses || null
    });
  }

  return summarized.length > 0 ? JSON.stringify(summarized, null, 2) : "NONE";
}

function fallbackK6Script(spec) {
  return buildDeterministicK6Script(spec);
}

export async function generateK6Script(spec, runDir, validateScript) {
  const executionSpec = {
    ...spec,
    target_url: dockerReachableTargetUrl(spec.target_url)
  };
  let candidate = buildDeterministicK6Script(executionSpec);

  const scriptPath = path.join(runDir, "k6_script.js");
  fs.writeFileSync(scriptPath, candidate, "utf8");
  let validation = await validateScript(scriptPath);
  if (validation.dockerUnavailable) {
    const error = new Error("Docker daemon not running. Start Docker Desktop and retry.");
    error.code = "DOCKER_UNAVAILABLE";
    throw error;
  }
  if (validation.ok) {
    return candidate;
  }

  const openApiSchemas = await fetchOpenApiSchemas(spec).catch(() => "NONE");
  let prompt = buildK6ScriptPrompt(executionSpec, openApiSchemas);
  prompt += `\n\nk6 inspect stderr:\n${validation.stderr}`;
  candidate = sanitizeGeneratedCode(await callRawCodeLLM(prompt).catch(() => fallbackK6Script(executionSpec)));
  fs.writeFileSync(scriptPath, candidate, "utf8");
  validation = await validateScript(scriptPath);
  if (validation.dockerUnavailable) {
    const error = new Error("Docker daemon not running. Start Docker Desktop and retry.");
    error.code = "DOCKER_UNAVAILABLE";
    throw error;
  }
  if (!validation.ok) {
    const error = new Error(`SCRIPT_GENERATION_FAILED: ${validation.stderr}`);
    error.code = "SCRIPT_GENERATION_FAILED";
    throw error;
  }
  return candidate;
}

function deterministicVerdict(spec, metrics) {
  if (metrics.total_requests < 100) {
    return VERDICTS.INCONCLUSIVE;
  }
  if (metrics.p95_ms >= spec.p95_threshold_ms || metrics.error_rate >= spec.error_rate_threshold) {
    return VERDICTS.FAILED;
  }
  return VERDICTS.PASSED;
}

function canonicalNumberToken(value) {
  const normalized = String(value).replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed.toString() : null;
}

export function diagnosisAllowedNumbers(spec, metrics) {
  const values = [
    spec.max_vus,
    spec.duration_seconds,
    spec.ramp_seconds,
    spec.p95_threshold_ms,
    spec.error_rate_threshold,
    spec.error_rate_threshold * 100,
    metrics.p50_ms,
    metrics.p95_ms,
    metrics.p99_ms,
    metrics.error_rate,
    metrics.error_rate * 100,
    metrics.peak_rps,
    metrics.peak_vus,
    metrics.total_requests,
    metrics.failed_requests
  ];
  const allowed = new Set();

  for (const value of values) {
    if (!Number.isFinite(value)) {
      continue;
    }
    allowed.add(Number(value).toString());
    allowed.add(Number(value).toFixed(1).replace(/\.0$/, ""));
    allowed.add(Number(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1"));
  }

  return allowed;
}

export function extractNumericTokens(text) {
  return [...String(text || "").matchAll(/\d[\d,]*(?:\.\d+)?/g)]
    .map((match) => canonicalNumberToken(match[0]))
    .filter(Boolean);
}

function fieldHasOnlyAllowedNumbers(text, allowed) {
  const tokens = extractNumericTokens(text);
  return tokens.every((token) => allowed.has(token));
}

function fieldHasRequiredNumbers(text) {
  return extractNumericTokens(text).length > 0;
}

export function isDiagnosisGroundedInMetrics(diagnosis, spec, metrics) {
  const allowed = diagnosisAllowedNumbers(spec, metrics);
  return (
    fieldHasRequiredNumbers(diagnosis?.primary_finding) &&
    fieldHasRequiredNumbers(diagnosis?.confidence_reasoning) &&
    fieldHasOnlyAllowedNumbers(diagnosis?.headline, allowed) &&
    fieldHasOnlyAllowedNumbers(diagnosis?.primary_finding, allowed) &&
    fieldHasOnlyAllowedNumbers(diagnosis?.confidence_reasoning, allowed)
  );
}

function reconcileDiagnosis(diagnosis, fallback, spec, metrics) {
  if (diagnosis?.verdict !== fallback.verdict) {
    return fallback;
  }

  const allowed = diagnosisAllowedNumbers(spec, metrics);
  const headline = fieldHasOnlyAllowedNumbers(diagnosis?.headline, allowed) && typeof diagnosis?.headline === "string" && diagnosis.headline.trim()
    ? diagnosis.headline
    : fallback.headline;
  const primaryFinding = fieldHasRequiredNumbers(diagnosis?.primary_finding) && fieldHasOnlyAllowedNumbers(diagnosis?.primary_finding, allowed)
    ? diagnosis.primary_finding
    : fallback.primary_finding;
  const confidenceReasoning = fieldHasRequiredNumbers(diagnosis?.confidence_reasoning) && fieldHasOnlyAllowedNumbers(diagnosis?.confidence_reasoning, allowed)
    ? diagnosis.confidence_reasoning
    : fallback.confidence_reasoning;

  return {
    verdict: fallback.verdict,
    verdict_emoji: fallback.verdict_emoji,
    headline,
    primary_finding: primaryFinding,
    fix_recommendation: typeof diagnosis?.fix_recommendation === "string" && diagnosis.fix_recommendation.trim()
      ? diagnosis.fix_recommendation
      : fallback.fix_recommendation,
    confidence: ["HIGH", "MEDIUM", "LOW"].includes(diagnosis?.confidence)
      ? diagnosis.confidence
      : fallback.confidence,
    confidence_reasoning: confidenceReasoning
  };
}

export function buildDiagnosisFallback(spec, metrics, runId) {
  const verdict = deterministicVerdict(spec, metrics);
  const verdictEmoji = verdict === VERDICTS.FAILED ? "❌ FAILED" : verdict === VERDICTS.PASSED ? "✅ PASSED" : "⚠️ INCONCLUSIVE";
  const thresholdLabel = metrics.error_rate >= spec.error_rate_threshold ? "error threshold" : "latency threshold";
  const latencySummary = Number.isFinite(metrics.p95_ms)
    ? `P95 latency measured ${metrics.p95_ms}ms against a ${spec.p95_threshold_ms}ms threshold.`
    : "Latency metrics were unavailable from the k6 summary.";
  const headline =
    verdict === VERDICTS.INCONCLUSIVE
      ? "Investigation complete — manual review required to determine root cause"
      : verdict === VERDICTS.PASSED
        ? `API stable at ${spec.max_vus} users — thresholds passed with margin`
        : `API exceeded ${thresholdLabel} — your safe limit is below ${spec.max_vus} users`;
  return {
    verdict,
    verdict_emoji: verdictEmoji,
    headline,
    primary_finding: `${latencySummary} Error rate was ${errorRatePercentText(metrics.error_rate)} against a ${errorRatePercentText(spec.error_rate_threshold)} threshold. Automated narrative unavailable — review raw metrics in the run directory.`,
    fix_recommendation: `Review /runs/${runId}/metrics.json for full data. Compare p95 latency curve against VU ramp to identify the failure point.`,
    confidence: "LOW",
    confidence_reasoning: "Automated diagnosis unavailable — metrics are real but narrative generation failed. Raw data is accurate."
  };
}

export async function generateDiagnosis(spec, metrics, runId) {
  const fallback = buildDiagnosisFallback(spec, metrics, runId);
  const diagnosis = await callLLM(buildDiagnosisPrompt(spec, metrics), fallback);
  return reconcileDiagnosis(diagnosis, fallback, spec, metrics);
}

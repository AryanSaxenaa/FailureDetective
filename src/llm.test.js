import test from "node:test";
import assert from "node:assert/strict";
import { isDiagnosisGroundedInMetrics } from "./llm.js";

const spec = {
  max_vus: 200,
  duration_seconds: 180,
  ramp_seconds: 90,
  p95_threshold_ms: 300,
  error_rate_threshold: 0.03
};

const metrics = {
  p50_ms: 52,
  p95_ms: 315,
  p99_ms: 1784,
  error_rate: 0.0001624973273465897,
  peak_rps: 430,
  peak_vus: 200,
  total_requests: 116925,
  failed_requests: 19
};

test("accepts diagnosis text when all cited numbers come from measured metrics", () => {
  const diagnosis = {
    headline: "315ms latency exceeds the 300ms threshold for users",
    primary_finding: "Latency measured 315ms against a 300ms threshold. Peak RPS reached 430 across 116925 requests.",
    confidence_reasoning: "Confidence is HIGH because failed requests were 19."
  };

  assert.equal(isDiagnosisGroundedInMetrics(diagnosis, spec, metrics), true);
});

test("rejects diagnosis text when it invents numbers not present in measured metrics", () => {
  const diagnosis = {
    headline: "315ms p95 latency exceeds the 300ms threshold for users",
    primary_finding: "The p95 latency measured 315ms, but the error rate was 7.0% under load.",
    confidence_reasoning: "Confidence is HIGH because 7.0% errors clearly breached the target."
  };

  assert.equal(isDiagnosisGroundedInMetrics(diagnosis, spec, metrics), false);
});

test("allows a qualitative headline when the numeric evidence is grounded elsewhere", () => {
  const diagnosis = {
    headline: "Service remained stable for users",
    primary_finding: "Latency measured 315ms against a 300ms threshold. Peak RPS reached 430 across 116925 requests.",
    confidence_reasoning: "Confidence is HIGH because failed requests were 19."
  };

  assert.equal(isDiagnosisGroundedInMetrics(diagnosis, spec, metrics), true);
});

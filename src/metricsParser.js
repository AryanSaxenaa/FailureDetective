import fs from "node:fs";

function metricValues(metric) {
  return metric?.values || metric || {};
}

function metricNumber(metric, key, fallback = 0) {
  const values = metricValues(metric);
  const value = values?.[key];
  return typeof value === "number" ? value : fallback;
}

function optionalMetricNumber(metric, keys) {
  for (const key of keys) {
    const value = metricNumber(metric, key, null);
    if (typeof value === "number") {
      return Math.round(value);
    }
  }
  return null;
}

export function extractMetrics(summaryPath) {
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    const durations = summary.metrics["http_req_duration"] || {};
    const requestFailures = summary.metrics["http_req_failed"] || {};
    const requests = summary.metrics["http_reqs"] || {};
    const totalRequests = metricNumber(requests, "count", 0);
    const errorRate = typeof requestFailures.value === "number"
      ? requestFailures.value
      : typeof requestFailures.fails === "number" && typeof requestFailures.passes === "number"
        ? requestFailures.fails / Math.max(requestFailures.fails + requestFailures.passes, 1)
        : metricNumber(requestFailures, "rate", 0);
    const candidates = [
      typeof requestFailures.passes === "number" ? requestFailures.passes : null,
      typeof requestFailures.fails === "number" ? requestFailures.fails : null,
      Math.round(totalRequests * errorRate)
    ].filter((value) => typeof value === "number");
    const expectedFailures = totalRequests * errorRate;
    const failedRequests = candidates.reduce((best, current) => {
      return Math.abs(current - expectedFailures) < Math.abs(best - expectedFailures) ? current : best;
    }, candidates[0] ?? 0);

    return {
      p50_ms: optionalMetricNumber(durations, ["p(50)", "med"]),
      p95_ms: optionalMetricNumber(durations, ["p(95)", "max"]),
      p99_ms: optionalMetricNumber(durations, ["p(99)", "max"]),
      error_rate: errorRate,
      peak_rps: Math.round(metricNumber(requests, "rate", 0)),
      peak_vus: Math.round(metricNumber(summary.metrics["vus_max"] || {}, "max", metricNumber(summary.metrics["vus_max"] || {}, "value", 0))),
      total_requests: totalRequests,
      failed_requests: failedRequests
    };
  } catch {
    return {
      p50_ms: null,
      p95_ms: null,
      p99_ms: null,
      error_rate: 0,
      peak_rps: 0,
      peak_vus: 0,
      total_requests: 0,
      failed_requests: 0
    };
  }
}

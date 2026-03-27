import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { extractMetrics } from "./metricsParser.js";

test("extractMetrics preserves missing latency metrics as null instead of 0", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nfd-metrics-"));
  const summaryPath = path.join(dir, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify({
    metrics: {
      http_req_failed: { value: 1, fails: 25, passes: 0 },
      http_reqs: { values: { count: 25, rate: 5 } },
      vus_max: { value: 5 }
    }
  }), "utf8");

  const metrics = extractMetrics(summaryPath);
  assert.equal(metrics.p50_ms, null);
  assert.equal(metrics.p95_ms, null);
  assert.equal(metrics.p99_ms, null);
  assert.equal(metrics.error_rate, 1);
  assert.equal(metrics.failed_requests, 25);
});

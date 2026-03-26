export const NOTION_VERSION = "2026-03-11";

export const REPORT_DATABASE_TITLE = "API Failure Reports";

export const RUN_PHASES = {
  SPEC_READING: "SPEC_READING",
  SCRIPT_GENERATION: "SCRIPT_GENERATION",
  RUNNING: "RUNNING",
  DIAGNOSING: "DIAGNOSING",
  WRITING_TO_NOTION: "WRITING_TO_NOTION",
  COMPLETE: "COMPLETE"
};

export const RUN_STATUS = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  PASSED: "PASSED",
  FAILED: "FAILED",
  ERROR: "ERROR"
};

export const VERDICTS = {
  PASSED: "PASSED",
  FAILED: "FAILED",
  INCONCLUSIVE: "INCONCLUSIVE"
};

export const SPEC_DEFAULTS = {
  spec_url: null,
  endpoints: [],
  max_vus: 100,
  duration_seconds: 120,
  ramp_seconds: 30,
  p95_threshold_ms: 500,
  error_rate_threshold: 0.05
};

export const INVESTIGATION_DATABASE_PROPERTIES = {
  Name: { title: {} },
  Status: {
    select: {
      options: [
        { name: "PENDING", color: "default" },
        { name: "RUNNING", color: "blue" },
        { name: "PASSED", color: "green" },
        { name: "FAILED", color: "red" },
        { name: "ERROR", color: "yellow" }
      ]
    }
  },
  "Target URL": { url: {} },
  "Spec Source": { url: {} },
  "VU Count": { number: { format: "number" } },
  "Duration Seconds": { number: { format: "number" } },
  "P95 Latency MS": { number: { format: "number" } },
  "P95 Threshold MS": { number: { format: "number" } },
  "Error Rate": { number: { format: "percent" } },
  "Error Rate Threshold": { number: { format: "percent" } },
  Verdict: {
    select: {
      options: [
        { name: "PASSED", color: "green" },
        { name: "FAILED", color: "red" },
        { name: "INCONCLUSIVE", color: "yellow" }
      ]
    }
  },
  "Verdict Emoji": { rich_text: {} },
  Headline: { rich_text: {} },
  "Primary Finding": { rich_text: {} },
  "Fix Recommendation": { rich_text: {} },
  Confidence: {
    select: {
      options: [
        { name: "HIGH", color: "green" },
        { name: "MEDIUM", color: "yellow" },
        { name: "LOW", color: "red" }
      ]
    }
  },
  "Confidence Reasoning": { rich_text: {} },
  "Run ID": { rich_text: {} }
};

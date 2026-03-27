import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "./server.js";
import { setRunState } from "./state.js";

test("GET /api/run/:runId/result returns api_verdict without legacy verdict field", async () => {
  setRunState("run-1", {
    run_id: "run-1",
    project_status: "RUN_SUCCEEDED",
    api_verdict: "FAILED",
    metrics: { total_requests: 10 },
    diagnosis: { headline: "x" },
    notion_report_url: "https://www.notion.so/example"
  });

  const app = createServer();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/run/run-1/result`);
    const json = await response.json();

    assert.equal(response.status, 200);
    assert.equal(json.api_verdict, "FAILED");
    assert.equal("verdict" in json, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

import express from "express";
import { v4 as uuidv4 } from "uuid";
import { createNotionMcp } from "./notionClient.js";
import { runInvestigation, getRunStatus } from "./orchestrator.js";

export function createServer() {
  const app = express();
  app.use(express.json());

  app.post("/api/run", async (req, res) => {
    const { notion_page_id: notionPageId, notion_database_id: notionDatabaseId } = req.body ?? {};

    if (!notionPageId || !notionDatabaseId) {
      return res.status(400).json({
        error: "SPEC_PARSE_FAILED",
        message: "Both notion_page_id and notion_database_id are required.",
        run_id: null
      });
    }

    const notion = await createNotionMcp();
    const runId = uuidv4();
    const promise = runInvestigation({ notion, notionPageId, notionDatabaseId, runId });
    promise.finally(() => notion.close()).catch(() => {});

    return res.status(202).json({
      run_id: runId,
      status: "PENDING",
      message: "Investigation started. Poll /api/run/{run_id}/status for updates."
    });
  });

  app.get("/api/run/:runId/status", (req, res) => {
    const run = getRunStatus(req.params.runId);
    if (!run) {
      return res.status(404).json({ error: "RUN_NOT_FOUND" });
    }
    return res.json(run);
  });

  app.get("/api/run/:runId/result", (req, res) => {
    const run = getRunStatus(req.params.runId);
    if (!run) {
      return res.status(404).json({ error: "RUN_NOT_FOUND" });
    }
    return res.json({
      run_id: run.run_id,
      project_status: run.project_status,
      api_verdict: run.api_verdict ?? run.verdict,
      verdict: run.verdict,
      metrics: run.metrics,
      diagnosis: run.diagnosis,
      notion_report_url: run.notion_report_url
    });
  });

  return app;
}

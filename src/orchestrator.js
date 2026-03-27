import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { RUN_PHASES, RUN_STATUS } from "./constants.js";
import { percent, truncateText } from "./format.js";
import { executeK6, validateK6Script } from "./k6Runner.js";
import { extractMetrics } from "./metricsParser.js";
import {
  createInvestigationRow,
  createReportSubPage,
  getPageContent,
  updateRunStatus,
  writeDiagnosisToRow
} from "./notionClient.js";
import { buildDiagnosisFallback, extractSpec, generateDiagnosis, generateK6Script } from "./llm.js";
import { ensureRunDir, writeJson } from "./paths.js";
import { getRunState, setRunState } from "./state.js";

export async function runInvestigation({ notion, notionPageId, notionDatabaseId, runId = uuidv4() }) {
  const runDir = ensureRunDir(runId);
  const startedAt = Date.now();
  let row = null;

  setRunState(runId, {
    run_id: runId,
    status: RUN_STATUS.PENDING,
    phase: RUN_PHASES.SPEC_READING,
    progress_message: "Reading investigation spec from Notion",
    elapsed_seconds: 0
  });

  try {
    const rawSpec = await getPageContent(notion, notionPageId);
    const spec = await extractSpec(rawSpec);
    writeJson(path.join(runDir, "spec.json"), spec);

    row = await createInvestigationRow(notion, notionDatabaseId, runId, spec);
    setRunState(runId, { notion_row_id: row.id, status: RUN_STATUS.RUNNING });
    await updateRunStatus(notion, row.id, RUN_STATUS.RUNNING);

    setRunState(runId, {
      phase: RUN_PHASES.SCRIPT_GENERATION,
      progress_message: "Generating k6 script from the Notion investigation"
    });

    const script = await generateK6Script(spec, runDir, validateK6Script);
    writeJson(path.join(runDir, "script-meta.json"), { generated: true, length: script.length });

    setRunState(runId, {
      phase: RUN_PHASES.RUNNING,
      progress_message: `Running k6 against ${spec.target_url}`
    });

    const k6Result = await executeK6(runDir);
    if (k6Result.dockerUnavailable) {
      const message = "Docker daemon not running. Start Docker Desktop and retry.";
      const error = new Error(message);
      error.code = "DOCKER_UNAVAILABLE";
      throw error;
    }

    if (!k6Result.ok) {
      const stderr = (k6Result.stderr || "").slice(0, 500);
      const error = new Error(stderr);
      error.code = "K6_SCRIPT_ERROR";
      throw error;
    }

    const metrics = extractMetrics(path.join(runDir, "k6_summary.json"));
    writeJson(path.join(runDir, "metrics.json"), metrics);

    await updateRunStatus(notion, row.id, k6Result.thresholdFailure ? RUN_STATUS.FAILED : RUN_STATUS.PASSED);

    setRunState(runId, {
      phase: RUN_PHASES.DIAGNOSING,
      progress_message: `Diagnosing ${metrics.total_requests} requests with p95 ${metrics.p95_ms}ms`,
      elapsed_seconds: Math.round((Date.now() - startedAt) / 1000)
    });

    const diagnosis = await generateDiagnosis(spec, metrics, runId).catch(() =>
      buildDiagnosisFallback(spec, metrics, runId)
    );
    writeJson(path.join(runDir, "rca.json"), diagnosis);

    setRunState(runId, {
      phase: RUN_PHASES.WRITING_TO_NOTION,
      progress_message: "Writing structured diagnosis back to Notion"
    });

    await writeDiagnosisToRow(notion, row.id, spec, metrics, diagnosis);
    const report = await createReportSubPage(notion, row.id, spec, metrics, diagnosis);
    const projectStatus = "RUN_SUCCEEDED";
    const apiVerdict = diagnosis.verdict;

    setRunState(runId, {
      status: diagnosis.verdict === "INCONCLUSIVE" ? RUN_STATUS.FAILED : diagnosis.verdict,
      phase: RUN_PHASES.COMPLETE,
      progress_message: "Investigation complete",
      elapsed_seconds: Math.round((Date.now() - startedAt) / 1000),
      project_status: projectStatus,
      api_verdict: apiVerdict,
      verdict: diagnosis.verdict,
      metrics,
      diagnosis,
      notion_report_url: report.url
    });

    return {
      run_id: runId,
      project_status: projectStatus,
      api_verdict: apiVerdict,
      verdict: diagnosis.verdict,
      metrics,
      diagnosis,
      notion_report_url: report.url,
      summary: `Run succeeded. API verdict ${apiVerdict}. P95 ${metrics.p95_ms}ms vs ${spec.p95_threshold_ms}ms, error rate ${percent(metrics.error_rate)}`
    };
  } catch (error) {
    if (row?.id) {
      const summary =
        error.code === "DOCKER_UNAVAILABLE"
          ? "Docker daemon not running. Start Docker Desktop and retry."
          : error.code === "K6_SCRIPT_ERROR"
            ? `k6 script error: ${truncateText(error.message, 500)}`
            : error.code === "SCRIPT_GENERATION_FAILED"
              ? `k6 script validation failed: ${truncateText(error.message, 500)}`
              : "";
      if (summary) {
        await updateRunStatus(notion, row.id, RUN_STATUS.ERROR, summary).catch(() => {});
      }
    }
    setRunState(runId, {
      status: RUN_STATUS.ERROR,
      phase: RUN_PHASES.COMPLETE,
      project_status: "RUN_FAILED",
      progress_message: error.message,
      elapsed_seconds: Math.round((Date.now() - startedAt) / 1000)
    });
    throw error;
  }
}

export function getRunStatus(runId) {
  return getRunState(runId);
}

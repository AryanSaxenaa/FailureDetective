import fs from "node:fs";
import path from "node:path";

export function ensureRunDir(runId) {
  const runDir = path.join(process.cwd(), "runs", runId);
  fs.mkdirSync(runDir, { recursive: true });
  return runDir;
}

export function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

import { spawn } from "node:child_process";
import path from "node:path";

function runDocker(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

export function isDockerUnavailableMessage(text = "") {
  return /docker daemon|dockerdesktoplinuxengine|error during connect|cannot find the file specified|is the docker daemon running|open \/\/\.\/pipe\/dockerDesktopLinuxEngine/i.test(text);
}

export async function validateK6Script(scriptPath) {
  try {
    const runDir = path.dirname(scriptPath);
    const args = ["run", "--rm", "-v", `${runDir}:/scripts`, "grafana/k6:latest", "inspect", "/scripts/k6_script.js"];
    const result = await runDocker(args);
    const stderr = result.stderr || result.stdout;
    return {
      ok: result.code === 0,
      stderr,
      dockerUnavailable: isDockerUnavailableMessage(stderr)
    };
  } catch (error) {
    return {
      ok: false,
      stderr: error.message,
      dockerUnavailable: isDockerUnavailableMessage(error.message)
    };
  }
}

function isThresholdFailure(stderr) {
  const value = stderr.toLowerCase();
  return value.includes("threshold") || value.includes("some thresholds have failed");
}

export async function executeK6(runDir) {
  const args = [
    "run",
    "--rm",
    "-v",
    `${runDir}:/scripts`,
    "--network",
    "host",
    "grafana/k6:latest",
    "run",
    "--out",
    "json=/scripts/k6_output.json",
    "--summary-export",
    "/scripts/k6_summary.json",
    "/scripts/k6_script.js"
  ];

  try {
    const startedAt = Date.now();
    const result = await runDocker(args);
    const dockerUnavailable = isDockerUnavailableMessage(result.stderr || result.stdout);
    return {
      ok: !dockerUnavailable && (result.code === 0 || isThresholdFailure(result.stderr)),
      exitCode: result.code,
      durationMs: Date.now() - startedAt,
      thresholdFailure: !dockerUnavailable && result.code !== 0 && isThresholdFailure(result.stderr),
      dockerUnavailable,
      stderr: result.stderr,
      stdout: result.stdout
    };
  } catch (error) {
    return {
      ok: false,
      exitCode: -1,
      durationMs: 0,
      thresholdFailure: false,
      dockerUnavailable: isDockerUnavailableMessage(error.message) || /ENOENT|not recognized|cannot find/i.test(error.message),
      stderr: error.message,
      stdout: ""
    };
  }
}

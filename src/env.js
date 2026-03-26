import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.join(process.cwd(), ".env");
const ENV_EXAMPLE_PATH = path.join(process.cwd(), ".env.example");

export function ensureEnvFile() {
  if (!fs.existsSync(ENV_PATH) && fs.existsSync(ENV_EXAMPLE_PATH)) {
    fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
  }
}

export function requireEnv(keys) {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export function updateEnvFile(updates) {
  const current = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  let next = current;

  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    if (pattern.test(next)) {
      next = next.replace(pattern, line);
    } else {
      next += `${next.endsWith("\n") || next.length === 0 ? "" : "\n"}${line}\n`;
    }
    process.env[key] = value;
  }

  fs.writeFileSync(ENV_PATH, next, "utf8");
}

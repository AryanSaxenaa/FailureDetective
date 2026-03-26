import dotenv from "dotenv";
import { createServer } from "./src/server.js";
import { ensureEnvFile, requireEnv, updateEnvFile } from "./src/env.js";
import { createNotionMcp, verifyNotionMcpConnection } from "./src/notionClient.js";
import { initWorkspace, runInvestigationFromEnv } from "./src/commands.js";

dotenv.config();

async function main() {
  const command = process.argv[2] ?? "server";

  if (command === "init") {
    ensureEnvFile();
    requireEnv(["NOTION_PARENT_PAGE_ID", "GROQ_API_KEY"]);
    const notion = await createNotionMcp();
    const result = await initWorkspace(notion);
    updateEnvFile({
      NOTION_DATABASE_ID: result.databaseId,
      NOTION_SPEC_PAGE_ID: result.specPageId
    });
    await notion.close();
    console.log(`Database: ${result.databaseUrl}`);
    console.log(`Spec page: ${result.specPageUrl}`);
    return;
  }

  if (command === "run") {
    ensureEnvFile();
    requireEnv(["NOTION_DATABASE_ID", "NOTION_SPEC_PAGE_ID", "GROQ_API_KEY"]);
    const result = await runInvestigationFromEnv();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "notion-login") {
    ensureEnvFile();
    const notion = await createNotionMcp();
    const info = await verifyNotionMcpConnection(notion);
    await notion.close();
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  if (command === "server") {
    ensureEnvFile();
    const app = createServer();
    const port = Number(process.env.PORT || 3001);
    app.listen(port, () => {
      console.log(`Notion Failure Detective listening on http://localhost:${port}`);
    });
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

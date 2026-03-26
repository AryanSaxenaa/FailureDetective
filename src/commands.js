import { createNotionMcp, createInvestigationDatabase, createTemplateSpecPage } from "./notionClient.js";
import { runInvestigation } from "./orchestrator.js";

export async function initWorkspace(notion) {
  const database = await createInvestigationDatabase(notion);
  const specPage = await createTemplateSpecPage(notion);
  return {
    databaseId: database.id,
    databaseUrl: database.url,
    specPageId: specPage.id,
    specPageUrl: specPage.url
  };
}

export async function runInvestigationFromEnv() {
  const notion = await createNotionMcp();
  const result = await runInvestigation({
    notion,
    notionPageId: process.env.NOTION_SPEC_PAGE_ID,
    notionDatabaseId: process.env.NOTION_DATABASE_ID
  });
  await notion.close();
  return result;
}

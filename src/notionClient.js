import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { REPORT_DATABASE_TITLE, RUN_STATUS } from "./constants.js";

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function stringifyContent(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  return JSON.stringify(value, null, 2);
}

function extractToolText(result) {
  const parts = [];

  if (Array.isArray(result?.content)) {
    for (const item of result.content) {
      if (typeof item?.text === "string") {
        parts.push(item.text);
      } else if (item) {
        parts.push(stringifyContent(item));
      }
    }
  }

  if (result?.structuredContent) {
    parts.push(stringifyContent(result.structuredContent));
  }

  if (result?.content == null && result?.structuredContent == null && result != null) {
    parts.push(stringifyContent(result));
  }

  return parts.filter(Boolean).join("\n");
}

function findStringsDeep(value, matches = []) {
  if (typeof value === "string") {
    matches.push(value);
    return matches;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      findStringsDeep(item, matches);
    }
    return matches;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      findStringsDeep(item, matches);
    }
  }
  return matches;
}

function extractNotionUrls(text) {
  return [...text.matchAll(/https:\/\/(?:www\.)?notion\.so\/[^\s)",]+/g)].map((match) => match[0]);
}

function extractCollectionUrls(text) {
  return [...text.matchAll(/collection:\/\/[0-9a-f-]+/gi)].map((match) => match[0]);
}

function extractUuidCandidates(text) {
  return [...text.matchAll(/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/gi)].map((match) => {
    const value = match[0].replace(/-/g, "").toLowerCase();
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
  });
}

function extractIdAndUrl(resultText) {
  const urls = extractNotionUrls(resultText);
  const ids = extractUuidCandidates(resultText);
  return {
    id: ids[0] || null,
    url: urls[0] || null
  };
}

function parseEmbeddedJsonStrings(text) {
  const parsed = [];
  for (const candidate of findStringsDeep(text)) {
    const trimmed = candidate.trim();
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
      continue;
    }
    try {
      parsed.push(JSON.parse(trimmed));
    } catch {}
  }
  return parsed;
}

function extractFetchBodyText(raw) {
  const jsonObjects = parseEmbeddedJsonStrings(raw);
  for (const parsed of jsonObjects) {
    if (typeof parsed?.text === "string") {
      return parsed.text;
    }
  }
  return raw;
}

function notionTextToPlainText(text) {
  const match = text.match(/<content>\s*([\s\S]*?)\s*<\/content>/i);
  const content = match ? match[1] : text;
  return content
    .replace(/<empty-block\/>/gi, "")
    .replace(/<page [^>]*>(.*?)<\/page>/gi, "$1")
    .replace(/<database [^>]*>(.*?)<\/database>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractDatabaseInfo(value, title = REPORT_DATABASE_TITLE) {
  const strings = findStringsDeep(value);
  const jsonObjects = parseEmbeddedJsonStrings(value);

  for (const parsed of jsonObjects) {
    const results = Array.isArray(parsed?.results) ? parsed.results : [];
    for (const result of results) {
      if (result?.type === "database" && (!title || result.title === title)) {
        return {
          id: result.id || null,
          url: result.url ? (result.url.startsWith("http") ? result.url : `https://www.notion.so/${result.url}`) : null,
          dataSourceId: null,
          dataSourceUrl: null
        };
      }
    }

    const bodyText = typeof parsed?.text === "string" ? parsed.text : "";
    const bodyResult = typeof parsed?.result === "string" ? parsed.result : "";
    const combined = `${bodyText}\n${bodyResult}`;
    const tagMatch = combined.match(/<database url=\"([^\"]+)\"[^>]*data-source-url=\"([^\"]+)\"[^>]*>([^<]+)<\/database>/i);
    if (tagMatch && (!title || tagMatch[3].trim() === title)) {
      return {
        id: extractUuidCandidates(tagMatch[1])[0] || null,
        url: tagMatch[1],
        dataSourceId: extractUuidCandidates(tagMatch[2])[0] || tagMatch[2],
        dataSourceUrl: tagMatch[2]
      };
    }
  }

  for (const text of strings) {
    const tagMatch = text.match(/<database url=\"([^\"]+)\"[^>]*data-source-url=\"([^\"]+)\"[^>]*>([^<]+)<\/database>/i);
    if (tagMatch && (!title || tagMatch[3].trim() === title)) {
      return {
        id: extractUuidCandidates(tagMatch[1])[0] || null,
        url: tagMatch[1],
        dataSourceId: extractUuidCandidates(tagMatch[2])[0] || tagMatch[2],
        dataSourceUrl: tagMatch[2]
      };
    }
  }

  const flat = strings.join("\n");
  return {
    id: extractUuidCandidates(flat)[0] || null,
    url: extractNotionUrls(flat)[0] || null,
    dataSourceId: extractUuidCandidates(extractCollectionUrls(flat)[0] || "")[0] || null,
    dataSourceUrl: extractCollectionUrls(flat)[0] || null
  };
}

function extractPageInfo(value, title) {
  const strings = findStringsDeep(value);
  const jsonObjects = parseEmbeddedJsonStrings(value);

  for (const parsed of jsonObjects) {
    const results = Array.isArray(parsed?.results) ? parsed.results : [];
    for (const result of results) {
      if (result?.type === "page" && (!title || result.title === title)) {
        return {
          id: result.id || null,
          url: result.url ? (result.url.startsWith("http") ? result.url : `https://www.notion.so/${result.url}`) : null
        };
      }
    }

    const bodyText = typeof parsed?.text === "string" ? parsed.text : "";
    const pageMatch = bodyText.match(/<page url=\"([^\"]+)\">([^<]+)<\/page>/i);
    if (pageMatch && (!title || pageMatch[2].trim() === title)) {
      return {
        id: extractUuidCandidates(pageMatch[1])[0] || null,
        url: pageMatch[1]
      };
    }
  }

  const flat = strings.join("\n");
  return {
    id: extractUuidCandidates(flat)[0] || null,
    url: extractNotionUrls(flat)[0] || null
  };
}

function buildSingleStringArgs(schema, payload) {
  const properties = schema?.properties || {};
  const keys = Object.keys(properties);
  const promptKeys = ["prompt", "query", "input", "text", "instructions", "request"];

  for (const key of promptKeys) {
    if (key in properties) {
      return { [key]: payload };
    }
  }

  const stringKeys = keys.filter((key) => {
    const type = properties[key]?.type;
    return type === "string" || (Array.isArray(type) && type.includes("string"));
  });

  if (stringKeys.length === 1) {
    return { [stringKeys[0]]: payload };
  }

  return null;
}

async function listTools(mcp) {
  const response = await mcp.client.listTools();
  return response.tools || [];
}

function resolveTool(mcp, possibleNames) {
  for (const name of possibleNames) {
    const match = mcp.tools.find((tool) => tool.name === name);
    if (match) {
      return match;
    }
  }
  throw new Error(`Required MCP tool not available. Tried: ${possibleNames.join(", ")}`);
}

async function callTool(mcp, possibleNames, args) {
  const tool = resolveTool(mcp, possibleNames);
  const result = await mcp.client.callTool({
    name: tool.name,
    arguments: args || {}
  });
  return {
    tool: tool.name,
    text: extractToolText(result),
    raw: result
  };
}

async function searchWorkspace(mcp, query) {
  return callTool(mcp, ["notion-search", "search"], {
    query,
    query_type: "internal",
    content_search_mode: "workspace_search",
    filters: {},
    page_size: 10,
    max_highlight_length: 200
  });
}

async function fetchWorkspace(mcp, id) {
  return callTool(mcp, ["notion-fetch", "fetch"], { id });
}

async function createPages(mcp, args) {
  return callTool(mcp, ["notion-create-pages"], args);
}

async function updatePage(mcp, args) {
  return callTool(mcp, ["notion-update-page"], args);
}

async function createDatabase(mcp, args) {
  return callTool(mcp, ["notion-create-database"], args);
}

export async function createNotionMcp() {
  const transport = new StdioClientTransport({
    command: npxCommand(),
    args: ["-y", "mcp-remote", process.env.NOTION_MCP_URL || "https://mcp.notion.com/mcp"]
  });

  const client = new McpClient(
    {
      name: "notion-failure-detective",
      version: "1.0.0"
    },
    {
      capabilities: {}
    }
  );

  await client.connect(transport);
  const tools = await listTools({ client });

  return {
    client,
    transport,
    tools,
    async close() {
      if (typeof client.close === "function") {
        await client.close();
      }
      if (typeof transport.close === "function") {
        await transport.close();
      }
    }
  };
}

export async function verifyNotionMcpConnection(mcp) {
  const toolNames = mcp.tools.map((tool) => tool.name).sort();
  const selfCheck = await fetchWorkspace(
    mcp,
    process.env.NOTION_PARENT_PAGE_ID
  );
  return {
    connected: true,
    tools: toolNames,
    sample: selfCheck.text.slice(0, 1000)
  };
}

export async function createInvestigationDatabase(mcp) {
  const parent = await fetchWorkspace(mcp, process.env.NOTION_PARENT_PAGE_ID);
  const existing = extractDatabaseInfo(parent.raw, REPORT_DATABASE_TITLE);

  if (existing.dataSourceId || existing.url) {
    return {
      id: existing.dataSourceId || existing.id,
      url: existing.url,
      created: false
    };
  }

  const schema = `CREATE TABLE (
"Name" TITLE,
"Status" SELECT('PENDING':gray, 'RUNNING':blue, 'PASSED':green, 'FAILED':red, 'ERROR':yellow),
"Target URL" URL,
"Spec Source" URL,
"VU Count" NUMBER,
"Duration Seconds" NUMBER,
"P95 Latency MS" NUMBER,
"P95 Threshold MS" NUMBER,
"Error Rate" NUMBER,
"Error Rate Threshold" NUMBER,
"Verdict" SELECT('PASSED':green, 'FAILED':red, 'INCONCLUSIVE':yellow),
"Verdict Emoji" RICH_TEXT,
"Headline" RICH_TEXT,
"Primary Finding" RICH_TEXT,
"Fix Recommendation" RICH_TEXT,
"Confidence" SELECT('HIGH':green, 'MEDIUM':yellow, 'LOW':red),
"Confidence Reasoning" RICH_TEXT,
"Run ID" RICH_TEXT
)`;
  const createResult = await createDatabase(mcp, {
    title: REPORT_DATABASE_TITLE,
    parent: {
      page_id: process.env.NOTION_PARENT_PAGE_ID,
      type: "page_id"
    },
    schema
  });
  const created = extractDatabaseInfo(createResult.raw, REPORT_DATABASE_TITLE);
  if (!created.dataSourceId && !created.url) {
    throw new Error("Failed to determine database ID from Notion MCP response.");
  }
  return {
    id: created.dataSourceId || created.id,
    url: created.url,
    created: true
  };
}

export async function createTemplateSpecPage(mcp) {
  const result = await createPages(mcp, {
    parent: {
      page_id: process.env.NOTION_PARENT_PAGE_ID,
      type: "page_id"
    },
    pages: [
      {
        properties: {
          title: "Test Spec"
        },
        content: `Target: https://api.example.com
Spec: https://api.example.com/openapi.json

What I want to investigate:
Ramp to 300 concurrent users over 2 minutes.
Sustain for 3 minutes.
Investigate the checkout flow: POST /auth/login, GET /cart, POST /cart/items, POST /checkout.
Flag if p95 latency exceeds 200ms.
Flag if error rate exceeds 2%.`,
        icon: "🕵️"
      }
    ]
  });
  const created = extractPageInfo(result.raw, "Test Spec");
  if (!created.id && !created.url) {
    throw new Error("Failed to determine template spec page ID from Notion MCP response.");
  }
  return created;
}

export async function getPageContent(mcp, pageId) {
  const result = await fetchWorkspace(mcp, pageId);
  return notionTextToPlainText(extractFetchBodyText(result.text));
}

export async function createInvestigationRow(mcp, databaseId, runId, spec) {
  const result = await createPages(mcp, {
    parent: {
      data_source_id: databaseId,
      type: "data_source_id"
    },
    pages: [
      {
        properties: {
          Name: `${spec.target_url} — ${new Date().toISOString()}`,
          Status: RUN_STATUS.PENDING,
          "Target URL": spec.target_url,
          "Spec Source": spec.spec_url,
          "VU Count": spec.max_vus,
          "Duration Seconds": spec.duration_seconds,
          "P95 Threshold MS": spec.p95_threshold_ms,
          "Error Rate Threshold": spec.error_rate_threshold,
          "Run ID": runId
        }
      }
    ]
  });
  const created = extractPageInfo(result.raw);
  if (!created.id && !created.url) {
    throw new Error("Failed to determine investigation row ID from Notion MCP response.");
  }
  return created;
}

export async function updateRunStatus(mcp, rowId, status, extraSummary = "") {
  await updatePage(mcp, {
    page_id: rowId,
    command: "update_properties",
    properties: {
      Status: status
    },
    content_updates: []
  });

  if (extraSummary) {
    const fetched = await fetchWorkspace(mcp, rowId);
    await updatePage(mcp, {
      page_id: rowId,
      command: "replace_content",
      new_str: `${fetched.text}\n\n${extraSummary}`.trim(),
      content_updates: [],
      allow_deleting_content: true
    });
  }
}

export async function writeDiagnosisToRow(mcp, rowId, spec, metrics, diagnosis) {
  await updatePage(mcp, {
    page_id: rowId,
    command: "update_properties",
    properties: {
      Status: diagnosis.verdict === "INCONCLUSIVE" ? RUN_STATUS.FAILED : diagnosis.verdict,
      "P95 Latency MS": metrics.p95_ms,
      "P95 Threshold MS": spec.p95_threshold_ms,
      "Error Rate": metrics.error_rate,
      "Error Rate Threshold": spec.error_rate_threshold,
      Verdict: diagnosis.verdict,
      "Verdict Emoji": diagnosis.verdict_emoji,
      Headline: diagnosis.headline,
      "Primary Finding": diagnosis.primary_finding,
      "Fix Recommendation": diagnosis.fix_recommendation,
      Confidence: diagnosis.confidence,
      "Confidence Reasoning": diagnosis.confidence_reasoning
    },
    content_updates: []
  });
}

export async function createReportSubPage(mcp, rowId, spec, metrics, diagnosis) {
  const content = `| Metric | Measured | Your Threshold | Status |
| --- | --- | --- | --- |
| P95 Latency | ${metrics.p95_ms}ms | ${spec.p95_threshold_ms}ms | ${metrics.p95_ms < spec.p95_threshold_ms ? "✅" : "❌"} |
| Error Rate | ${(metrics.error_rate * 100).toFixed(1)}% | ${(spec.error_rate_threshold * 100).toFixed(1)}% | ${metrics.error_rate < spec.error_rate_threshold ? "✅" : "❌"} |
| Peak RPS | ${metrics.peak_rps} | — | — |
| Total Requests | ${metrics.total_requests} | — | — |
| Failed | ${metrics.failed_requests} | — | — |

${new Date().toLocaleString("en-US")} · ${spec.duration_seconds}s · ${spec.max_vus} peak users

Project status: Run succeeded
API verdict: ${diagnosis.verdict === "FAILED" ? "❌ FAILED THRESHOLD" : diagnosis.verdict === "PASSED" ? "✅ PASSED THRESHOLD" : "⚠️ INCONCLUSIVE"}

## What happened
${diagnosis.headline}

${diagnosis.primary_finding}

## What to fix — before your users find it
${diagnosis.fix_recommendation}

## Diagnosis confidence
${diagnosis.confidence} — ${diagnosis.confidence_reasoning}

## What was investigated
Endpoints (in order): ${spec.endpoints.join(", ") || "None specified"}

Additional metrics:
- p50 latency: ${metrics.p50_ms}ms
- p99 latency: ${metrics.p99_ms}ms
- Ramp period: ${spec.ramp_seconds}s to ${spec.max_vus} VUs
- Sustain period: ${Math.max(spec.duration_seconds - spec.ramp_seconds, 0)}s`;

  const result = await createPages(mcp, {
    parent: {
      page_id: rowId,
      type: "page_id"
    },
    pages: [
      {
        properties: {
          title: `${diagnosis.verdict_emoji} Investigation Report — ${spec.target_url}`
        },
        content
      }
    ]
  });
  const created = extractPageInfo(result.raw);
  if (!created.id && !created.url) {
    throw new Error("Failed to determine report sub-page ID from Notion MCP response.");
  }
  return created;
}

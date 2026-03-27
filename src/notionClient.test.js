import test from "node:test";
import assert from "node:assert/strict";
import {
  extractDatabaseInfo,
  extractFetchBodyText,
  extractPageInfo,
  normalizeStatusSummary,
  notionTextToPlainText
} from "./notionClient.js";

test("normalizeStatusSummary preserves plain string messages", () => {
  assert.equal(normalizeStatusSummary("Docker daemon not running."), "Docker daemon not running.");
});

test("normalizeStatusSummary stringifies objects instead of producing [object Object]", () => {
  const value = normalizeStatusSummary({ error: "Docker daemon not running." });
  assert.match(value, /"error": "Docker daemon not running\."/);
  assert.equal(value.includes("[object Object]"), false);
});

test("extractFetchBodyText pulls page text from embedded JSON strings", () => {
  const raw = '{"text":"<content>Target: https://api.example.com</content>"}';
  assert.equal(extractFetchBodyText(raw), "<content>Target: https://api.example.com</content>");
});

test("notionTextToPlainText strips notion markup wrappers", () => {
  const raw = '<content><page url="https://www.notion.so/x">Ignored</page>Target: https://api.example.com<empty-block/></content>';
  assert.equal(notionTextToPlainText(raw), "IgnoredTarget: https://api.example.com");
});

test("extractDatabaseInfo parses embedded database tags from MCP text output", () => {
  const raw = {
    structuredContent: {
      text: '<database url="https://www.notion.so/16ae685414aa4e1cac384a05cd213fb7" data-source-url="collection://7e41bbcd-c967-4ce0-9efe-3e0701b0c734">API Failure Reports</database>'
    }
  };
  const parsed = extractDatabaseInfo(raw, "API Failure Reports");
  assert.equal(parsed.dataSourceId, "7e41bbcd-c967-4ce0-9efe-3e0701b0c734");
});

test("extractPageInfo parses page ids from MCP-style page tags", () => {
  const raw = {
    structuredContent: {
      text: '<page url="https://www.notion.so/32f1f496f67d810abcd6d22b6ebacfdc">Test Spec</page>'
    }
  };
  const parsed = extractPageInfo(raw, "Test Spec");
  assert.equal(parsed.id, "32f1f496-f67d-810a-bcd6-d22b6ebacfdc");
});

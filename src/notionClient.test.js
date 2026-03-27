import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStatusSummary } from "./notionClient.js";

test("normalizeStatusSummary preserves plain string messages", () => {
  assert.equal(normalizeStatusSummary("Docker daemon not running."), "Docker daemon not running.");
});

test("normalizeStatusSummary stringifies objects instead of producing [object Object]", () => {
  const value = normalizeStatusSummary({ error: "Docker daemon not running." });
  assert.match(value, /"error": "Docker daemon not running\."/);
  assert.equal(value.includes("[object Object]"), false);
});

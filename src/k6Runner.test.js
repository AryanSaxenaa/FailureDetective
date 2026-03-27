import test from "node:test";
import assert from "node:assert/strict";
import { isDockerUnavailableMessage } from "./k6Runner.js";

test("detects docker daemon connectivity errors from stderr text", () => {
  const stderr = "docker: error during connect: Head \"http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/_ping\": open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.";
  assert.equal(isDockerUnavailableMessage(stderr), true);
});

test("does not classify ordinary k6 validation errors as docker unavailable", () => {
  const stderr = "ERRO[0000] GoError: cannot parse threshold expression";
  assert.equal(isDockerUnavailableMessage(stderr), false);
});

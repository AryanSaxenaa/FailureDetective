const runs = new Map();

export function setRunState(runId, patch) {
  const current = runs.get(runId) || {};
  runs.set(runId, { ...current, ...patch });
  return runs.get(runId);
}

export function getRunState(runId) {
  return runs.get(runId) || null;
}

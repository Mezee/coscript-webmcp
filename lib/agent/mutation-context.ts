export interface ManualEditRecord {
  id: string;
  timestamp: string;
  source: "manual";
  label: "Manual editor edit";
}

let agentMutationDepth = 0;
const manualEdits: ManualEditRecord[] = [];

function id() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function beginAgentMutation() {
  agentMutationDepth += 1;
}

export function endAgentMutation() {
  agentMutationDepth = Math.max(0, agentMutationDepth - 1);
}

export function recordManualEdit() {
  if (agentMutationDepth > 0) return;
  manualEdits.unshift({ id: id(), timestamp: new Date().toISOString(), source: "manual", label: "Manual editor edit" });
  if (manualEdits.length > 50) manualEdits.length = 50;
}

export function getManualEditHistory() {
  return manualEdits.slice();
}

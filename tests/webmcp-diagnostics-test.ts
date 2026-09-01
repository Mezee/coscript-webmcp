import { useWebMCPDiagnosticsStore } from "../lib/agent/webmcp-diagnostics";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const tools = [
  { name: "inspect_project", stableKey: "project.inspect_current" },
  { name: "find_in_transcript", stableKey: "transcript.find" },
] as never;

const store = useWebMCPDiagnosticsStore.getState();
store.setScopes([["editor", tools]]);
store.beginRegistration(tools, "2026-08-31T00:00:00.000Z");
let state = useWebMCPDiagnosticsStore.getState();
assert(state.scopes[0]?.name === "editor", "diagnostics records active scopes");
assert(state.scopes[0]?.toolNames.join(",") === "inspect_project,find_in_transcript", "diagnostics records scope tools");
assert(state.tools.every((tool) => tool.status === "pending"), "diagnostics records a pending SDK registration");

store.recordResults([
  { name: "inspect_project", stableKey: "project.inspect_current", state: "registered" },
  { name: "find_in_transcript", stableKey: "transcript.find", state: "failed", error: new Error("duplicate") },
], "2026-08-31T00:00:01.000Z");
state = useWebMCPDiagnosticsStore.getState();
assert(state.tools[0]?.status === "registered", "diagnostics records registered SDK tools");
assert(state.tools[1]?.status === "failed" && state.tools[1]?.error === "duplicate", "diagnostics preserves SDK registration failures");
assert(state.tools[1]?.registrationTime === "2026-08-31T00:00:01.000Z", "diagnostics records registration time");

store.clearRegistration();
assert(useWebMCPDiagnosticsStore.getState().tools.length === 0, "diagnostics clears inactive registrations");
console.log("webmcp-diagnostics-test: all passed");

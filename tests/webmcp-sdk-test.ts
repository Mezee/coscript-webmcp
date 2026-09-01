import { registerTools, resolveModelContext, type AnyWebMCPTool, type ModelContextLike } from "../lib/agent/webmcp-sdk";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const tool: AnyWebMCPTool = {
  stableKey: "project.inspect_current",
  name: "inspect_project",
  title: "Inspect project",
  description: "Read the current project.",
  inputSchema: { type: "object" },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute: () => ({ status: "ready" }),
};

const calls: Array<{ name: string; signal?: AbortSignal; hasStableKey: boolean }> = [];
const modelContext: ModelContextLike = {
  registerTool: async (nativeTool, options) => {
    calls.push({ name: nativeTool.name, signal: options?.signal, hasStableKey: "stableKey" in nativeTool });
  },
};

async function main() {
  const registration = registerTools([tool], { modelContext });
  const results = await registration.ready;
  assert(results[0]?.state === "registered", "registers a tool with the native singular API");
  assert(calls[0]?.name === "inspect_project", "passes the native tool name");
  assert(calls[0]?.hasStableKey === false, "does not send SDK-only metadata to the browser");
  assert(calls[0]?.signal === registration.signal, "uses one signal for the registration lifetime");
  registration.unregister();
  assert(registration.signal.aborted, "unregister aborts the native registration lifetime");

  const unsupported = await registerTools([tool]).ready;
  assert(unsupported[0]?.state === "unsupported", "reports unsupported browsers without throwing");

  const fromNavigator = resolveModelContext({ navigator: { modelContext } } as never);
  assert(fromNavigator === modelContext, "falls back to navigator.modelContext");
  console.log("webmcp-sdk-test: all passed");
}

void main();

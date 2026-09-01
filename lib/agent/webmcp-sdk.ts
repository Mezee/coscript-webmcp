export interface AnyWebMCPTool {
  stableKey: string;
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => unknown;
  annotations?: { readOnlyHint: boolean; untrustedContentHint: boolean };
  source?: string;
  intent?: string;
}

export type ToolRegistrationState = "registered" | "unsupported" | "aborted" | "failed";

export interface ToolRegistrationResult {
  name: string;
  stableKey: string;
  state: ToolRegistrationState;
  error?: unknown;
}

export interface ToolRegistration {
  signal: AbortSignal;
  ready: Promise<ToolRegistrationResult[]>;
  unregister: () => void;
}

type NativeWebMCPTool = Pick<AnyWebMCPTool, "name" | "title" | "description" | "inputSchema" | "execute" | "annotations">;

export interface ModelContextLike {
  registerTool: (tool: NativeWebMCPTool, options?: { signal?: AbortSignal }) => Promise<void> | void;
}

type WebMCPGlobal = {
  document?: Document & { modelContext?: ModelContextLike };
  navigator?: Navigator & { modelContext?: ModelContextLike };
};

export function resolveModelContext(scope: WebMCPGlobal = globalThis): ModelContextLike | undefined {
  return scope.document?.modelContext ?? scope.navigator?.modelContext;
}

/**
 * Keep WebMCP optional: unsupported browsers preserve the editor experience,
 * while compatible browsers receive native tools one at a time. The WebMCP
 * draft uses AbortSignal as the registration lifetime, so aborting removes a
 * whole active batch without relying on a deprecated unregister API.
 */
export function defineTool<TInput extends Record<string, unknown>>(
  definition: Omit<AnyWebMCPTool, "execute"> & { execute: (input: TInput) => unknown }
): AnyWebMCPTool {
  return definition as AnyWebMCPTool;
}

export function registerTools(
  tools: readonly AnyWebMCPTool[],
  options: { modelContext?: ModelContextLike } = {}
): ToolRegistration {
  const controller = new AbortController();
  const context = options.modelContext ?? resolveModelContext();
  const result = (tool: AnyWebMCPTool, state: ToolRegistrationState, error?: unknown): ToolRegistrationResult => ({
    name: tool.name,
    stableKey: tool.stableKey,
    state,
    ...(error === undefined ? {} : { error }),
  });
  const nativeTool = (tool: AnyWebMCPTool): NativeWebMCPTool => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: tool.execute,
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
  });

  const ready = Promise.all(tools.map(async (tool) => {
    if (!context) return result(tool, "unsupported");
    if (controller.signal.aborted) return result(tool, "aborted");
    try {
      await context.registerTool(nativeTool(tool), { signal: controller.signal });
      return controller.signal.aborted ? result(tool, "aborted") : result(tool, "registered");
    } catch (error) {
      return controller.signal.aborted ? result(tool, "aborted") : result(tool, "failed", error);
    }
  }));

  return { signal: controller.signal, ready, unregister: () => controller.abort() };
}

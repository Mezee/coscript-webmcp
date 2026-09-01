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

export type ToolRegistrationState = "registered" | "failed";

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

type RawRegistration = {
  ready?: Promise<unknown>;
  unregister?: () => void;
};

type ModelContext = {
  registerTools?: (tools: readonly AnyWebMCPTool[], options?: { telemetry?: boolean }) => RawRegistration | Promise<RawRegistration | void> | void;
};

/**
 * Keep WebMCP optional: unsupported browsers preserve the editor experience
 * while browsers exposing document.modelContext receive the native tools.
 */
export function defineTool<TInput extends Record<string, unknown>>(
  definition: Omit<AnyWebMCPTool, "execute"> & { execute: (input: TInput) => unknown }
): AnyWebMCPTool {
  return definition as AnyWebMCPTool;
}

export function registerTools(
  tools: readonly AnyWebMCPTool[],
  options: { telemetry?: boolean } = {}
): ToolRegistration {
  const controller = new AbortController();
  let unregister = () => controller.abort();
  const unsupported = () => tools.map((tool) => ({
    name: tool.name,
    stableKey: tool.stableKey,
    state: "failed" as const,
    error: new Error("WebMCP is not available in this browser"),
  }));

  const ready = (async (): Promise<ToolRegistrationResult[]> => {
    const context = typeof document === "undefined"
      ? undefined
      : (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTools) return unsupported();

    try {
      const registration = await context.registerTools(tools, options);
      if (registration?.unregister) {
        const nativeUnregister = registration.unregister;
        unregister = () => {
          controller.abort();
          nativeUnregister();
        };
      }
      await registration?.ready;
      if (controller.signal.aborted) return [];
      return tools.map((tool) => ({ name: tool.name, stableKey: tool.stableKey, state: "registered" as const }));
    } catch (error) {
      return tools.map((tool) => ({ name: tool.name, stableKey: tool.stableKey, state: "failed" as const, error }));
    }
  })();

  return { signal: controller.signal, ready, unregister: () => unregister() };
}

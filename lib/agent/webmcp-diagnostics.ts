import { create } from "zustand";
import type { AnyWebMCPTool, ToolRegistrationResult, ToolRegistrationState } from "./webmcp-sdk";

export type WebMCPRegistrationStatus = ToolRegistrationState | "pending";

export type WebMCPDiagnosticScope = {
  name: string;
  toolNames: string[];
};

export type WebMCPToolDiagnostic = {
  name: string;
  stableKey: string;
  status: WebMCPRegistrationStatus;
  registrationTime: string;
  error?: string;
};

type WebMCPDiagnosticsState = {
  scopes: WebMCPDiagnosticScope[];
  tools: WebMCPToolDiagnostic[];
  setScopes: (scopes: Iterable<[string, readonly AnyWebMCPTool[]]>) => void;
  beginRegistration: (tools: readonly AnyWebMCPTool[], registrationTime?: string) => void;
  recordResults: (results: readonly ToolRegistrationResult[], registrationTime?: string) => void;
  clearRegistration: () => void;
};

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error) return error;
  return error == null ? undefined : "The browser rejected tool registration";
}

export const useWebMCPDiagnosticsStore = create<WebMCPDiagnosticsState>((set) => ({
  scopes: [],
  tools: [],
  setScopes: (scopes) => set({
    scopes: [...scopes].map(([name, tools]) => ({ name, toolNames: tools.map((tool) => tool.name) })),
  }),
  beginRegistration: (tools, registrationTime = new Date().toISOString()) => set({
    tools: tools.map((tool) => ({
      name: tool.name,
      stableKey: tool.stableKey,
      status: "pending",
      registrationTime,
    })),
  }),
  recordResults: (results, registrationTime = new Date().toISOString()) => set({
    tools: results.map((result) => ({
      name: result.name,
      stableKey: result.stableKey,
      status: result.state,
      registrationTime,
      error: errorMessage(result.error),
    })),
  }),
  clearRegistration: () => set({ tools: [] }),
}));

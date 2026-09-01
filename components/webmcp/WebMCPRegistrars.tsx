"use client";

import { useEffect } from "react";
import { registerTools, type AnyWebMCPTool, type ToolRegistration } from "@/lib/agent/webmcp-sdk";
import { useIsDesktopLayout } from "@/hooks/useIsDesktopLayout";
import { useEditorStore } from "@/lib/store";
import { useAgentStore } from "@/lib/agent/store";
import { useWebMCPDiagnosticsStore } from "@/lib/agent/webmcp-diagnostics";
import {
  editorActionTools,
  editorReadTools,
  planReviewTools,
  processingTools,
  projectProposalTools,
  redoHistoryTools,
  selectionProposalTools,
  undoHistoryTools,
  undoRedoHistoryTools,
  uploadBaseTools,
  uploadProjectTools,
} from "@/lib/agent/webmcp-tools";

const noTools: readonly AnyWebMCPTool[] = [];
type ScopeEntry = { token: symbol; tools: readonly AnyWebMCPTool[] };
const scopes = new Map<string, ScopeEntry>();
let activeRegistration: ToolRegistration | null = null;
let activeSignature = "";
let commitScheduled = false;

function toolSignature(tools: readonly AnyWebMCPTool[]) {
  return tools.map((tool) => `${tool.name}:${tool.description}:${JSON.stringify(tool.inputSchema)}`).join("|");
}

function scheduleCommit() {
  if (commitScheduled) return;
  commitScheduled = true;
  queueMicrotask(() => {
    commitScheduled = false;
    const byName = new Map<string, AnyWebMCPTool>();
    for (const entry of scopes.values()) {
      for (const tool of entry.tools) byName.set(tool.name, tool);
    }
    const tools = [...byName.values()];
    useWebMCPDiagnosticsStore.getState().setScopes([...scopes.entries()].map(([scope, entry]) => [scope, entry.tools]));
    const signature = toolSignature(tools);
    if (signature === activeSignature) return;

    activeRegistration?.unregister();
    activeRegistration = null;
    activeSignature = signature;
    if (!tools.length) {
      useWebMCPDiagnosticsStore.getState().clearRegistration();
      useAgentStore.getState().setConnection("disconnected");
      return;
    }

    useAgentStore.getState().setConnection("fallback");
    useWebMCPDiagnosticsStore.getState().beginRegistration(tools);
    const registration = registerTools(tools);
    activeRegistration = registration;
    void registration.ready.then((results) => {
      if (activeRegistration !== registration || registration.signal.aborted) return;
      useWebMCPDiagnosticsStore.getState().recordResults(results);
      const failed = results.filter((result) => result.state === "failed");
      const connected = results.some((result) => result.state === "registered");
      useAgentStore.getState().setConnection(connected ? "webmcp" : "fallback");
      if (connected) useAgentStore.getState().clearWebMCPFailures();
      for (const result of failed) {
        useAgentStore.getState().addEvent({
          title: `WebMCP registration failed: ${result.name}`,
          detail: result.error instanceof Error ? result.error.message : "The browser rejected tool registration",
          kind: "error",
        });
      }
    });
  });
}

function useToolScope(scope: string, tools: readonly AnyWebMCPTool[], revision = "") {
  useEffect(() => {
    if (tools.length === 0) return;
    const entry: ScopeEntry = { token: Symbol(scope), tools };
    scopes.set(scope, entry);
    scheduleCommit();

    return () => {
      if (scopes.get(scope) === entry) scopes.delete(scope);
      scheduleCommit();
    };
  }, [scope, tools, revision]);
}

export function UploadWebMCPTools({ hasRecentProjects }: { hasRecentProjects: boolean }) {
  useToolScope("upload", hasRecentProjects ? uploadProjectTools : uploadBaseTools, hasRecentProjects ? "projects" : "empty");
  return null;
}

export function ProcessingWebMCPTools() {
  const status = useEditorStore((state) => state.status);
  const active = status !== "idle" && status !== "ready";
  useToolScope("processing", active ? processingTools : noTools, status);
  return null;
}

export function EditorActionWebMCPTools() {
  const status = useEditorStore((state) => state.status);
  const projectId = useEditorStore((state) => state.projectId);
  const exportOpen = useEditorStore((state) => state.exportOpen);
  const canUndo = useEditorStore((state) => state.past.length > 0);
  const canRedo = useEditorStore((state) => state.future.length > 0);
  const reviewUiVisible = useIsDesktopLayout();
  const actionable = status === "ready" && !exportOpen;

  useToolScope("editor-actions", actionable ? editorActionTools : noTools, projectId ?? "unsaved");
  useToolScope("project-proposal", actionable && reviewUiVisible ? projectProposalTools : noTools, projectId ?? "unsaved");
  const historyTools = !actionable
    ? noTools
    : canUndo && canRedo
      ? undoRedoHistoryTools
      : canUndo
        ? undoHistoryTools
        : canRedo
          ? redoHistoryTools
          : noTools;
  useToolScope("history", historyTools, `${canUndo}:${canRedo}`);
  return null;
}

export function TranscriptWebMCPTools() {
  const status = useEditorStore((state) => state.status);
  const projectId = useEditorStore((state) => state.projectId);
  const exportOpen = useEditorStore((state) => state.exportOpen);
  const reviewUiVisible = useIsDesktopLayout();
  const ready = status === "ready";

  useToolScope("transcript-read", ready ? editorReadTools : noTools, projectId ?? "unsaved");
  useToolScope("selection-proposal", ready && !exportOpen && reviewUiVisible ? selectionProposalTools : noTools, projectId ?? "unsaved");
  return null;
}

export function PlanWebMCPTools() {
  const status = useEditorStore((state) => state.status);
  const exportOpen = useEditorStore((state) => state.exportOpen);
  const plan = useAgentStore((state) => state.proposedPlan);
  const reviewUiVisible = useIsDesktopLayout();
  const reviewable = status === "ready" && !exportOpen && reviewUiVisible && plan?.status === "proposed";

  useToolScope("plan-review", reviewable ? planReviewTools : noTools, plan?.id ?? "none");
  return null;
}

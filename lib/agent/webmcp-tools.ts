import { defineTool, type AnyWebMCPTool } from "./webmcp-sdk";
import { nativeToolSchemas } from "./tool-schemas";
import { callNativeTool } from "./webmcp";

function schema(name: keyof typeof nativeToolSchemas) {
  return nativeToolSchemas[name];
}

function readTool<TInput extends Record<string, unknown>>(definition: {
  stableKey: string;
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: TInput) => unknown;
}) {
  return defineTool<TInput>({
    ...definition,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    source: "merchant_authored",
    intent: "answer",
  });
}

function actionTool<TInput extends Record<string, unknown>>(definition: {
  stableKey: string;
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: TInput) => unknown;
}) {
  return defineTool<TInput>({
    ...definition,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    source: "merchant_authored",
    intent: "act",
  });
}

export const listRecentProjectsTool = readTool<Record<string, never>>({
  stableKey: "projects.list_recent",
  name: "list_recent_projects",
  title: "List recent projects",
  ...schema("list_recent_projects"),
  execute: (input) => callNativeTool("list_recent_projects", input),
});

export const openRecentProjectTool = actionTool<{ projectId: string }>({
  stableKey: "projects.open_recent",
  name: "open_recent_project",
  title: "Open recent project",
  ...schema("open_recent_project"),
  execute: (input) => callNativeTool("open_recent_project", input),
});

export const inspectProjectTool = readTool<Record<string, never>>({
  stableKey: "project.inspect_current",
  name: "inspect_project",
  title: "Inspect project",
  ...schema("inspect_project"),
  execute: (input) => callNativeTool("inspect_project", input),
});

export const manageEditingTaskTool = actionTool<{ action: "start" | "complete" | "cancel"; goal?: string }>({
  stableKey: "task.manage_editing",
  name: "manage_editing_task",
  title: "Manage editing task",
  ...schema("manage_editing_task"),
  execute: (input) => callNativeTool("manage_editing_task", input),
});

export const findInTranscriptTool = readTool<{ query: string }>({
  stableKey: "transcript.find",
  name: "find_in_transcript",
  title: "Find in transcript",
  ...schema("find_in_transcript"),
  execute: (input) => callNativeTool("find_in_transcript", input),
});

export const focusTranscriptMatchTool = actionTool<{ query: string }>({
  stableKey: "transcript.focus_match",
  name: "focus_transcript_match",
  title: "Focus transcript match",
  ...schema("focus_transcript_match"),
  execute: (input) => callNativeTool("focus_transcript_match", input),
});

type SelectionEditInput = {
  action: "cut" | "restore" | "remove_fillers" | "remove_silence" | "correct_text";
  replacement?: string;
  minimumSilenceDuration?: number;
  startWordId?: number;
  endWordId?: number;
  userPrompt?: string;
};

export const applySelectionEditTool = actionTool<SelectionEditInput>({
  stableKey: "selection.apply_edit",
  name: "apply_selection_edit",
  title: "Apply selection edit",
  ...schema("apply_selection_edit"),
  execute: (input) => callNativeTool("apply_selection_edit", input),
});

type ProjectCleanupInput = {
  removeFillers?: boolean;
  minimumSilenceDuration?: number;
  userPrompt?: string;
};

export const applyProjectCleanupTool = actionTool<ProjectCleanupInput>({
  stableKey: "project.apply_cleanup",
  name: "apply_project_cleanup",
  title: "Apply project cleanup",
  ...schema("apply_project_cleanup"),
  execute: (input) => callNativeTool("apply_project_cleanup", input),
});

function historyTool(actions: readonly ("undo" | "redo")[]) {
  const base = schema("navigate_edit_history");
  return actionTool<{ action: "undo" | "redo" }>({
    stableKey: "history.navigate",
    name: "navigate_edit_history",
    title: "Navigate edit history",
    description: `${base.description} Currently available: ${actions.join(" and ")}.`,
    inputSchema: {
      ...base.inputSchema,
      properties: { action: { enum: actions } },
    },
    execute: (input) => callNativeTool("navigate_edit_history", input),
  });
}

export const undoHistoryTool = historyTool(["undo"]);
export const redoHistoryTool = historyTool(["redo"]);
export const undoRedoHistoryTool = historyTool(["undo", "redo"]);

export const openExportConfirmationTool = actionTool<{ format: "mp4" | "webm"; resolution: "original" | "720p" | "1080p" | "4k" }>({
  stableKey: "export.open_confirmation",
  name: "open_export_confirmation",
  title: "Open export confirmation",
  ...schema("open_export_confirmation"),
  execute: (input) => callNativeTool("open_export_confirmation", input),
});

export const uploadBaseTools: readonly AnyWebMCPTool[] = [listRecentProjectsTool];
export const uploadProjectTools: readonly AnyWebMCPTool[] = [listRecentProjectsTool, openRecentProjectTool];
export const processingTools: readonly AnyWebMCPTool[] = [inspectProjectTool];
export const editorReadTools: readonly AnyWebMCPTool[] = [inspectProjectTool, findInTranscriptTool];
export const editorActionTools: readonly AnyWebMCPTool[] = [focusTranscriptMatchTool, manageEditingTaskTool, openExportConfirmationTool];
export const projectProposalTools: readonly AnyWebMCPTool[] = [applyProjectCleanupTool];
export const selectionProposalTools: readonly AnyWebMCPTool[] = [applySelectionEditTool];
export const undoHistoryTools: readonly AnyWebMCPTool[] = [undoHistoryTool];
export const redoHistoryTools: readonly AnyWebMCPTool[] = [redoHistoryTool];
export const undoRedoHistoryTools: readonly AnyWebMCPTool[] = [undoRedoHistoryTool];
export const planReviewTools: readonly AnyWebMCPTool[] = [];

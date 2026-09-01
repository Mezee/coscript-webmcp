import { getEditedDuration, getCutRanges } from "@/lib/edits";
import { useEditorStore } from "@/lib/store";
import { agentId, useAgentStore } from "./store";
import { beginAgentMutation, endAgentMutation, getManualEditHistory } from "./mutation-context";
import type { AgentEditOperation, AgentEditTransaction } from "./types";

export function editedDuration() {
  const state = useEditorStore.getState();
  return getEditedDuration(getCutRanges(state.words, state.duration, state.manualCuts), state.duration);
}

export function runAgentTransaction<T>(options: {
  label: string;
  operations: AgentEditOperation[];
  source?: AgentEditTransaction["source"];
  userPrompt?: string;
  execute: () => T;
}): { result: T; transaction: AgentEditTransaction } {
  const editor = useEditorStore.getState();
  const beforeDuration = editedDuration();
  const ownsGesture = !editor.gestureActive;
  useAgentStore.getState().setActiveOperation(options.label);
  beginAgentMutation();
  if (ownsGesture) editor.beginGesture();
  const activityId = useAgentStore.getState().addEvent({
    title: options.label,
    detail: "Working in the shared editor…",
    kind: "edit",
    status: "running",
    undoable: true,
  });
  try {
    const result = options.execute();
    if (ownsGesture) useEditorStore.getState().endGesture();
    const transaction: AgentEditTransaction = {
      id: agentId("transaction"),
      timestamp: new Date().toISOString(),
      source: options.source ?? "webmcp",
      userPrompt: options.userPrompt,
      label: options.label,
      operations: options.operations,
      beforeDuration,
      afterDuration: editedDuration(),
      undone: false,
    };
    useAgentStore.getState().addTransaction(transaction);
    useAgentStore.getState().addEvent({
      title: options.label,
      detail: `${transaction.operations.length} operation${transaction.operations.length === 1 ? "" : "s"} · ${transaction.beforeDuration.toFixed(1)}s → ${transaction.afterDuration.toFixed(1)}s`,
      kind: "edit",
      status: "completed",
      undoable: true,
    });
    useAgentStore.getState().updateEvent(activityId, {
      detail: `${transaction.operations.length} operation${transaction.operations.length === 1 ? "" : "s"} completed`,
      status: "completed",
    });
    return { result, transaction };
  } catch (error) {
    if (ownsGesture) useEditorStore.getState().endGesture();
    useAgentStore.getState().updateEvent(activityId, {
      detail: error instanceof Error ? error.message : "Unknown agent error",
      status: "failed",
    });
    useAgentStore.getState().addEvent({
      title: `${options.label} failed`,
      detail: error instanceof Error ? error.message : "Unknown agent error",
      kind: "error",
      status: "failed",
    });
    throw error;
  } finally {
    endAgentMutation();
    useAgentStore.getState().setActiveOperation(null);
  }
}

export function getEditHistory() {
  const agent = useAgentStore.getState();
  const editor = useEditorStore.getState();
  return {
    transactions: agent.transactions,
    manualEdits: getManualEditHistory(),
    canUndo: editor.past.length > 0,
    canRedo: editor.future.length > 0,
  };
}

export function undoAgentEdit() {
  const editor = useEditorStore.getState();
  if (editor.past.length === 0) return { ok: false, reason: "Nothing to undo" };
  editor.undo();
  useAgentStore.getState().markLatestUndone(true);
  useAgentStore.getState().addEvent({ title: "Undid last edit", detail: "Project state restored", kind: "edit" });
  return { ok: true, editedDuration: editedDuration() };
}

export function redoAgentEdit() {
  const editor = useEditorStore.getState();
  if (editor.future.length === 0) return { ok: false, reason: "Nothing to redo" };
  editor.redo();
  useAgentStore.getState().markLatestUndone(false);
  useAgentStore.getState().addEvent({ title: "Redid last edit", detail: "Project state reapplied", kind: "edit" });
  return { ok: true, editedDuration: editedDuration() };
}

import { useEditorStore } from "@/lib/store";
import { listProjects } from "@/lib/projects";
import { applyEditPlan, idsBetween, removeFillers, removeSilence } from "./edit-commands";
import { editedDuration, getEditHistory, redoAgentEdit, undoAgentEdit } from "./history";
import { previewRange, seek, seekToWords } from "./navigation";
import { applyProposedPlan, proposeEditPlan, rejectProposedPlan } from "./plans";
import { getProjectContext } from "./project-context";
import { useAgentStore } from "./store";
import { agentToolSchemas, nativeToolSchemas } from "./tool-schemas";
import { getSelection, getTranscript, searchTranscript } from "./transcript-query";
import { manageAgentTask } from "./task";
import type { AgentEditOperation, AgentScope } from "./types";

type ToolInput = Record<string, unknown>;
type AgentToolName = keyof typeof agentToolHandlers;
type NativeToolName = keyof typeof nativeToolHandlers;

function inputObject(input: unknown): ToolInput {
  return input && typeof input === "object" ? input as ToolInput : {};
}

function number(input: ToolInput, key: string) {
  const value = input[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${key} must be a finite number`);
  return value;
}

function string(input: ToolInput, key: string) {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} must be a non-empty string`);
  return value;
}

function numbers(input: ToolInput, key: string) {
  const value = input[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "number")) throw new Error(`${key} must be an array of numbers`);
  return value as number[];
}

function scopeFrom(input: ToolInput): AgentScope {
  const value = input.scope;
  if (!value || value === "project") return { type: "project" };
  if (value === "selection") return { type: "selection" };
  if (typeof value !== "object") throw new Error("scope is invalid");
  const scope = value as ToolInput;
  if (scope.type === "speaker") return { type: "speaker", speakerId: number(scope, "speakerId") };
  if (scope.type === "time-range") return { type: "time-range", start: number(scope, "start"), end: number(scope, "end") };
  throw new Error("scope is invalid");
}

function editOperations(input: ToolInput) {
  if (!Array.isArray(input.operations)) throw new Error("operations must be an array");
  return input.operations as AgentEditOperation[];
}

function editResult(operation: AgentEditOperation, userPrompt?: string) {
  return applyEditPlan([operation], { userPrompt });
}

export const agentToolHandlers = {
  get_project_context: () => getProjectContext(),
  get_transcript: (raw?: unknown) => getTranscript(inputObject(raw).includeDeleted === true),
  search_transcript: (raw?: unknown) => searchTranscript(string(inputObject(raw), "query")),
  get_selection: () => getSelection(),
  get_edited_duration: () => ({ editedDuration: editedDuration() }),
  cut_words: (raw?: unknown) => editResult({ type: "cut_words", wordIds: numbers(inputObject(raw), "wordIds") }),
  cut_transcript_range: (raw?: unknown) => { const input = inputObject(raw); return editResult({ type: "cut_words", startWordId: number(input, "startWordId"), endWordId: number(input, "endWordId") }); },
  restore_words: (raw?: unknown) => editResult({ type: "restore_words", wordIds: numbers(inputObject(raw), "wordIds") }),
  restore_transcript_range: (raw?: unknown) => { const input = inputObject(raw); return editResult({ type: "restore_words", startWordId: number(input, "startWordId"), endWordId: number(input, "endWordId") }); },
  cut_time_range: (raw?: unknown) => { const input = inputObject(raw); return editResult({ type: "cut_time_range", start: number(input, "start"), end: number(input, "end") }); },
  restore_time_range: (raw?: unknown) => { const input = inputObject(raw); return editResult({ type: "restore_time_range", start: number(input, "start"), end: number(input, "end") }); },
  remove_fillers: (raw?: unknown) => removeFillers(scopeFrom(inputObject(raw))),
  remove_silence: (raw?: unknown) => { const input = inputObject(raw); return removeSilence(typeof input.minimumDuration === "number" ? input.minimumDuration : 0.5, scopeFrom(input)); },
  correct_transcript: (raw?: unknown) => { const input = inputObject(raw); return editResult({ type: "correct_transcript", wordIds: numbers(input, "wordIds"), replacement: string(input, "replacement") }); },
  split_clip: (raw?: unknown) => editResult({ type: "split_clip", time: number(inputObject(raw), "time") }),
  trim_clip: (raw?: unknown) => { const input = inputObject(raw); return editResult({ type: "trim_clip", clipId: string(input, "clipId"), start: number(input, "start"), end: number(input, "end") }); },
  select_transcript_range: (raw?: unknown) => { const input = inputObject(raw); const wordIds = idsBetween(number(input, "startWordId"), number(input, "endWordId")); useEditorStore.getState().setSelectedWords(wordIds); return { wordIds }; },
  seek: (raw?: unknown) => seek(number(inputObject(raw), "time")),
  seek_to_words: (raw?: unknown) => seekToWords(numbers(inputObject(raw), "wordIds")),
  seek_to_phrase: (raw?: unknown) => { const matches = searchTranscript(string(inputObject(raw), "query")); return matches.length ? seek(matches[0].start) : { time: null, matches: 0 }; },
  preview_range: (raw?: unknown) => { const input = inputObject(raw); return previewRange(number(input, "start"), number(input, "end")); },
  undo: () => undoAgentEdit(),
  redo: () => redoAgentEdit(),
  get_edit_history: () => getEditHistory(),
  propose_edit_plan: (raw?: unknown) => { const input = inputObject(raw); return proposeEditPlan(editOperations(input), typeof input.userPrompt === "string" ? input.userPrompt : undefined); },
  apply_edit_plan: (raw?: unknown) => { const input = inputObject(raw); return applyEditPlan(editOperations(input), { userPrompt: typeof input.userPrompt === "string" ? input.userPrompt : undefined }); },
  apply_proposed_plan: (raw?: unknown) => applyProposedPlan(string(inputObject(raw), "planId")),
  reject_proposed_plan: (raw?: unknown) => rejectProposedPlan(string(inputObject(raw), "planId")),
  export_video: (raw?: unknown) => {
    const input = inputObject(raw);
    const format = string(input, "format");
    const requestedResolution = string(input, "resolution");
    if (format !== "mp4" && format !== "webm") throw new Error("format must be mp4 or webm");
    const resolutions = { original: "original", "720p": "720", "1080p": "1080", "4k": "2160" } as const;
    const resolution = resolutions[requestedResolution as keyof typeof resolutions];
    if (!resolution) throw new Error("resolution must be original, 720p, 1080p, or 4k");
    useAgentStore.getState().setExportRequest({ format, resolution });
    useEditorStore.getState().setExportOpen(true);
    useAgentStore.getState().addEvent({ title: "Export ready for confirmation", detail: `${format.toUpperCase()} · ${requestedResolution}`, kind: "export" });
    return { requiresUserConfirmation: true, dialogOpened: true, format, resolution: requestedResolution };
  },
};

export async function callAgentTool(name: AgentToolName, input?: unknown): Promise<unknown> {
  const schema = agentToolSchemas[name];
  if (!schema) throw new Error(`Unknown ReScript tool: ${String(name)}`);
  useAgentStore.getState().setActiveOperation(name);
  const activityId = useAgentStore.getState().addEvent({
    title: name,
    detail: "Running in Rescript…",
    kind: name.startsWith("get_") || name === "search_transcript" ? "read" : "navigation",
    status: "running",
  });
  try {
    const result = await agentToolHandlers[name](input as never);
    useAgentStore.getState().updateEvent(activityId, { status: "completed", detail: "Completed" });
    if (name.startsWith("get_") || name === "search_transcript") {
      useAgentStore.getState().addEvent({ title: schema.description.split(".")[0], detail: name, kind: "read" });
    }
    return result;
  } catch (error) {
    useAgentStore.getState().updateEvent(activityId, {
      status: "failed",
      detail: error instanceof Error ? error.message : "Unknown tool error",
    });
    useAgentStore.getState().addEvent({ title: `${name} failed`, detail: error instanceof Error ? error.message : "Unknown tool error", kind: "error" });
    throw error;
  } finally {
    useAgentStore.getState().setActiveOperation(null);
  }
}

export const nativeToolHandlers = {
  list_recent_projects: () => listProjects(),
  open_recent_project: async (raw?: unknown) => {
    const projectId = string(inputObject(raw), "projectId");
    await useEditorStore.getState().openProject(projectId);
    return getProjectContext();
  },
  inspect_project: () => {
    const state = useEditorStore.getState();
    if (state.status === "ready") return { ...getProjectContext(), selectionContext: getSelection(), task: useAgentStore.getState().task };
    return {
      status: state.status,
      progress: state.progress,
      partialText: state.partialText,
      error: state.error,
      projectId: state.projectId,
    };
  },
  manage_editing_task: (raw?: unknown) => {
    const input = inputObject(raw);
    const action = string(input, "action");
    if (action !== "start" && action !== "complete" && action !== "cancel") throw new Error("action must be start, complete, or cancel");
    return manageAgentTask(action, typeof input.goal === "string" ? input.goal : undefined);
  },
  find_in_transcript: (raw?: unknown) => callAgentTool("search_transcript", { query: string(inputObject(raw), "query") }),
  focus_transcript_match: async (raw?: unknown) => {
    const query = string(inputObject(raw), "query");
    const matches = searchTranscript(query);
    if (!matches.length) return { match: null, note: "The transcript has no matching content." };
    await callAgentTool("seek", { time: matches[0].start });
    return { match: matches[0], focused: true };
  },
  apply_selection_edit: (raw?: unknown) => {
    const input = inputObject(raw);
    const hasStart = input.startWordId != null;
    const hasEnd = input.endWordId != null;
    if (hasStart !== hasEnd) throw new Error("startWordId and endWordId must be provided together");
    const wordIds = hasStart
      ? idsBetween(number(input, "startWordId"), number(input, "endWordId"))
      : [...useEditorStore.getState().selectedWordIds];
    if (!wordIds.length) throw new Error("The transcript selection is no longer available");
    const action = string(input, "action");
    let operation: AgentEditOperation;
    if (action === "cut") operation = { type: "cut_words", wordIds };
    else if (action === "restore") operation = { type: "restore_words", wordIds };
    else if (action === "remove_fillers") {
      if (hasStart) throw new Error("An explicit range supports cut, restore, or correct_text only");
      operation = { type: "remove_fillers", scope: { type: "selection" } };
    }
    else if (action === "remove_silence") {
      if (hasStart) throw new Error("An explicit range supports cut, restore, or correct_text only");
      operation = {
        type: "remove_silence",
        minimumDuration: typeof input.minimumSilenceDuration === "number" ? input.minimumSilenceDuration : 0.5,
        scope: { type: "selection" },
      };
    }
    else if (action === "correct_text") operation = { type: "correct_transcript", wordIds, replacement: string(input, "replacement") };
    else throw new Error("action must be cut, restore, remove_fillers, remove_silence, or correct_text");
    return callAgentTool("apply_edit_plan", {
      operations: [operation],
      userPrompt: typeof input.userPrompt === "string" ? input.userPrompt : undefined,
    });
  },
  apply_project_cleanup: (raw?: unknown) => {
    const input = inputObject(raw);
    const operations: AgentEditOperation[] = [];
    if (input.removeFillers !== false) operations.push({ type: "remove_fillers", scope: { type: "project" } });
    if (typeof input.minimumSilenceDuration === "number") operations.push({
      type: "remove_silence",
      minimumDuration: input.minimumSilenceDuration,
      scope: { type: "project" },
    });
    if (!operations.length) throw new Error("Choose filler removal or provide minimumSilenceDuration");
    return callAgentTool("apply_edit_plan", {
      operations,
      userPrompt: typeof input.userPrompt === "string" ? input.userPrompt : undefined,
    });
  },
  navigate_edit_history: (raw?: unknown) => {
    const action = string(inputObject(raw), "action");
    if (action === "undo") return callAgentTool("undo");
    if (action === "redo") return callAgentTool("redo");
    throw new Error("action must be undo or redo");
  },
  open_export_confirmation: (raw?: unknown) => callAgentTool("export_video", raw),
};

export async function callNativeTool(name: NativeToolName, input?: unknown): Promise<unknown> {
  if (!nativeToolSchemas[name]) throw new Error(`Unknown ReScript tool: ${String(name)}`);
  return nativeToolHandlers[name](input as never);
}

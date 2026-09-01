import { getClipSegments, getEditedDuration, getCutRanges, getKeepRanges } from "../lib/edits";
import { getEditHistory } from "../lib/agent/history";
import { applyProposedPlan, proposeEditPlan, rejectProposedPlan } from "../lib/agent/plans";
import { useAgentStore } from "../lib/agent/store";
import { getContextualNativeToolSchemas, nativeToolSchemas } from "../lib/agent/tool-schemas";
import { agentToolHandlers, callAgentTool, callNativeTool } from "../lib/agent/webmcp";
import { useEditorStore } from "../lib/store";
import type { Word } from "../lib/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function resetProject() {
  const words: Word[] = [
    { id: 1, text: "Hello", start: 0.2, end: 0.5, speaker: 0, deleted: false },
    { id: 2, text: "um", start: 1.0, end: 1.2, speaker: 0, deleted: false },
    { id: 3, text: "WebMCP", start: 2.0, end: 2.4, speaker: 0, deleted: false },
    { id: 4, text: "makes", start: 2.5, end: 2.8, speaker: 0, deleted: false },
    { id: 5, text: "editing", start: 3.0, end: 3.4, speaker: 0, deleted: false },
    { id: 6, text: "easier", start: 3.5, end: 3.9, speaker: 1, deleted: false },
  ];
  useEditorStore.setState({
    words,
    duration: 6,
    manualCuts: [],
    sceneBoundaries: [],
    selectedWordIds: [3, 4],
    selectedClipIndex: null,
    currentTime: 0,
    status: "ready",
    past: [],
    future: [],
    gestureActive: false,
    nextManualCutId: 1,
    nextBoundaryId: 1,
    exportOpen: false,
    videoFile: null,
  });
  useAgentStore.setState({ connection: "disconnected", task: null, activeOperation: null, transactions: [], events: [], proposedPlan: null, exportRequest: null });
}

async function main() {
resetProject();

const expectedTools = [
  "get_project_context", "get_transcript", "search_transcript", "get_selection", "get_edited_duration",
  "cut_words", "cut_transcript_range", "restore_words", "restore_transcript_range", "cut_time_range", "restore_time_range",
  "remove_fillers", "remove_silence", "correct_transcript", "split_clip", "trim_clip",
  "select_transcript_range", "seek", "seek_to_words", "seek_to_phrase", "preview_range", "undo", "redo",
  "get_edit_history", "propose_edit_plan", "apply_edit_plan", "apply_proposed_plan", "reject_proposed_plan", "export_video",
];
for (const tool of expectedTools) assert(tool in agentToolHandlers, `missing tool ${tool}`);
assert(Object.keys(nativeToolSchemas).length === 10, "native WebMCP definitions stay within the global ten-tool limit");
const disclosureDefaults = { canUndo: false, canRedo: false, hasProposedPlan: false, exportOpen: false, hasRecentProjects: false, selectedWordCount: 0, reviewUiVisible: true };
assert(Object.keys(getContextualNativeToolSchemas({ ...disclosureDefaults, status: "idle" })).join(",") === "list_recent_projects", "empty upload screen exposes discovery only");
assert(Object.keys(getContextualNativeToolSchemas({ ...disclosureDefaults, status: "idle", hasRecentProjects: true })).join(",") === "list_recent_projects,open_recent_project", "upload screen exposes project opening only when a target exists");
assert(Object.keys(getContextualNativeToolSchemas({ ...disclosureDefaults, status: "preparing" })).join(",") === "inspect_project", "processing exposes only project inspection");
assert(Object.keys(getContextualNativeToolSchemas({ ...disclosureDefaults, status: "ready", canUndo: true, canRedo: true, hasProposedPlan: true, selectedWordCount: 2 })).length === 7, "ready desktop editor exposes only relevant journeys");
const modalTools = getContextualNativeToolSchemas({ ...disclosureDefaults, status: "ready", exportOpen: true, selectedWordCount: 2 });
assert(Object.keys(modalTools).join(",") === "inspect_project,find_in_transcript", "open export dialog leaves only read-only editor tools");

const context = await callNativeTool("inspect_project");
assert((context as unknown as { wordCount: number }).wordCount === 6, "context returns transcript metadata");
assert(Array.isArray((context as unknown as { cuts: unknown[] }).cuts) && Array.isArray((context as unknown as { sceneBoundaries: unknown[] }).sceneBoundaries), "context exposes cut and scene state");

const task = await callNativeTool("manage_editing_task", { action: "start", goal: "Clean up and tighten this video" }) as { status: string; goal: string };
assert(task.status === "running" && task.goal === "Clean up and tighten this video", "agent task starts with a visible goal");

const matches = await callNativeTool("find_in_transcript", { query: "WebMCP makes" });
assert(Array.isArray(matches) && matches[0]?.startWordId === 3 && matches[0]?.endWordId === 4, "phrase search returns stable range IDs");

const plan = await callAgentTool("apply_edit_plan", { operations: [
  { type: "remove_fillers", scope: { type: "project" } },
  { type: "cut_words", startWordId: 3, endWordId: 4 },
] }) as ReturnType<typeof applyProposedPlan>;
assert(plan.transaction.operations.length === 2, "batch transaction retains all operations");
assert(useEditorStore.getState().past.length === 1, "batch plan creates one undo entry");
assert(useEditorStore.getState().words.find((word) => word.id === 2)?.deleted, "filler was cut");
assert(useEditorStore.getState().words.find((word) => word.id === 3)?.deleted, "range was cut");

await callNativeTool("navigate_edit_history", { action: "undo" });
assert(!useEditorStore.getState().words.find((word) => word.id === 2)?.deleted, "undo restores entire batch");
await callNativeTool("navigate_edit_history", { action: "redo" });
assert(useEditorStore.getState().words.find((word) => word.id === 3)?.deleted, "redo reapplies entire batch");

await callAgentTool("restore_transcript_range", { startWordId: 3, endWordId: 4 });
assert(!useEditorStore.getState().words.find((word) => word.id === 3)?.deleted, "restore transcript range works");

await callAgentTool("correct_transcript", { wordIds: [3, 4], replacement: "Model Context Protocol" });
assert(useEditorStore.getState().words.some((word) => word.text === "Model"), "transcript correction works");
assert(useEditorStore.getState().words.some((word) => word.id === 3) && useEditorStore.getState().words.some((word) => word.id === 4), "correction preserves existing stable word IDs");

await callAgentTool("split_clip", { time: 4.5 });
assert(useEditorStore.getState().sceneBoundaries.length === 1, "split clip creates a scene boundary");

const trimTarget = getClipSegments(
  getKeepRanges(getCutRanges(useEditorStore.getState().words, 6, useEditorStore.getState().manualCuts), 6),
  useEditorStore.getState().sceneBoundaries
).find((clip) => clip.start === 0);
assert(trimTarget, "a kept clip is available to trim");
await callAgentTool("trim_clip", { clipId: trimTarget.id, start: 0.2, end: 0.8 });
assert(useEditorStore.getState().manualCuts.length > 0, "trim clip produces semantic time cuts");

await callAgentTool("remove_silence", { minimumDuration: 0.4, scope: "project" });
assert(getEditHistory().transactions.some((transaction) => transaction.operations[0]?.type === "remove_silence"), "silence removal is recorded as an agent transaction");

const proposed = proposeEditPlan([{ type: "cut_time_range", start: 4.0, end: 4.4 }], "Tighten the close");
assert(proposed.status === "proposed", "plan proposal is non-destructive");
const rejected = rejectProposedPlan(proposed.id);
assert(rejected.status === "rejected", "plan rejection preserves project state");

useEditorStore.setState({ selectedWordIds: [5] });
const selectionEdit = await callNativeTool("apply_selection_edit", { action: "cut", userPrompt: "Tighten the selection" }) as { transaction: { operations: unknown[] } };
assert(selectionEdit.transaction.operations.length === 1 && useEditorStore.getState().words.find((word) => word.id === 5)?.deleted, "selection tool applies an undoable edit immediately");

await callNativeTool("apply_selection_edit", { action: "cut", startWordId: 3, endWordId: 4, userPrompt: "Tighten an explicit range" });
assert(useEditorStore.getState().words.find((word) => word.id === 3)?.deleted && useEditorStore.getState().words.find((word) => word.id === 4)?.deleted, "selection tool cuts an explicit WebMCP word range");

const approved = proposeEditPlan([{ type: "cut_time_range", start: 4.0, end: 4.4 }], "Tighten the close");
applyProposedPlan(approved.id);
assert(getCutRanges(useEditorStore.getState().words, 6, useEditorStore.getState().manualCuts).some((range) => range.start <= 4.0 && range.end >= 4.4), "approved plan modifies the project");

await callNativeTool("open_export_confirmation", { format: "mp4", resolution: "1080p" });
assert(useEditorStore.getState().exportOpen, "export tool opens a confirmation dialog");
assert(useAgentStore.getState().exportRequest?.resolution === "1080", "export request passes requested resolution to dialog");
const completedTask = await callNativeTool("manage_editing_task", { action: "complete" }) as { status: string };
assert(completedTask.status === "completed", "agent task can complete after its edit steps");

const history = getEditHistory();
assert(history.transactions.length >= 5, "agent history records transactions");
useEditorStore.getState().deleteWords([6]);
assert(getEditHistory().manualEdits.length > 0 && getEditHistory().manualEdits[0]?.source === "manual", "history distinguishes manual editor edits");
assert(getEditedDuration(getCutRanges(useEditorStore.getState().words, 6, useEditorStore.getState().manualCuts), 6) < 6, "edited duration reflects agent changes");

console.log("agent-commands-test: all passed");
}

void main();

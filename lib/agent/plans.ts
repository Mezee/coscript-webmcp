import { getClipSegments, getCutRanges, getEditedDuration, getKeepRanges, mergeCutRanges } from "@/lib/edits";
import { findFillerWordIds } from "@/lib/fillers";
import { findSilenceRanges } from "@/lib/silences";
import { useEditorStore } from "@/lib/store";
import type { TimeRange } from "@/lib/types";
import { applyEditPlan } from "./edit-commands";
import { agentId, useAgentStore } from "./store";
import type { AgentEditOperation, AgentEditPlan, AgentScope } from "./types";

function wordsInScope(scope: AgentScope | undefined) {
  const state = useEditorStore.getState();
  if (!scope || scope.type === "project") return state.words;
  if (scope.type === "selection") return state.words.filter((word) => state.selectedWordIds.includes(word.id));
  if (scope.type === "speaker") return state.words.filter((word) => word.speaker === scope.speakerId);
  return state.words.filter((word) => word.end > scope.start && word.start < scope.end);
}

function boundsForScope(scope: AgentScope | undefined) {
  const state = useEditorStore.getState();
  if (!scope || scope.type === "project") return { start: 0, end: state.duration };
  if (scope.type === "time-range") return { start: scope.start, end: scope.end };
  const words = wordsInScope(scope);
  if (!words.length) return { start: 0, end: 0 };
  return { start: Math.min(...words.map((word) => word.start)), end: Math.max(...words.map((word) => word.end)) };
}

function subtractRange(ranges: TimeRange[], restore: TimeRange) {
  return ranges.flatMap((range) => {
    if (restore.end <= range.start || restore.start >= range.end) return [range];
    const result: TimeRange[] = [];
    if (restore.start > range.start) result.push({ start: range.start, end: restore.start });
    if (restore.end < range.end) result.push({ start: restore.end, end: range.end });
    return result;
  });
}

export function estimatePlanDuration(operations: AgentEditOperation[]) {
  const state = useEditorStore.getState();
  let cuts = getCutRanges(state.words, state.duration, state.manualCuts);
  const wordsById = new Map(state.words.map((word) => [word.id, word]));
  const idsForOperation = (operation: Extract<AgentEditOperation, { type: "cut_words" | "restore_words" }>) => {
    if (operation.wordIds) return operation.wordIds;
    const start = state.words.findIndex((word) => word.id === operation.startWordId);
    const end = state.words.findIndex((word) => word.id === operation.endWordId);
    return start >= 0 && end >= start ? state.words.slice(start, end + 1).map((word) => word.id) : [];
  };
  for (const operation of operations) {
    if (operation.type === "cut_time_range") cuts.push({ start: operation.start, end: operation.end });
    if (operation.type === "restore_time_range") cuts = subtractRange(cuts, operation);
    if (operation.type === "cut_words" || operation.type === "restore_words") {
      const ranges = idsForOperation(operation).map((id) => wordsById.get(id)).filter((word) => word != null).map((word) => ({ start: word.start, end: word.end }));
      cuts = operation.type === "cut_words" ? [...cuts, ...ranges] : ranges.reduce(subtractRange, cuts);
    }
    if (operation.type === "remove_fillers") {
      const scoped = new Set(wordsInScope(operation.scope).map((word) => word.id));
      cuts.push(...findFillerWordIds(state.words).filter((id) => scoped.has(id)).map((id) => wordsById.get(id)).filter((word) => word != null).map((word) => ({ start: word.start, end: word.end })));
    }
    if (operation.type === "remove_silence") {
      const bounds = boundsForScope(operation.scope);
      cuts.push(...findSilenceRanges(state.words, state.duration, state.manualCuts, operation.minimumDuration ?? 0.5)
        .map((range) => ({ start: Math.max(range.start, bounds.start), end: Math.min(range.end, bounds.end) }))
        .filter((range) => range.end > range.start));
    }
    if (operation.type === "trim_clip") {
      const clip = getClipSegments(getKeepRanges(mergeCutRanges(cuts, state.duration), state.duration), state.sceneBoundaries)
        .find((item) => item.id === operation.clipId);
      if (clip) cuts.push({ start: clip.start, end: operation.start }, { start: operation.end, end: clip.end });
    }
  }
  return getEditedDuration(mergeCutRanges(cuts, state.duration), state.duration);
}

export function proposeEditPlan(operations: AgentEditOperation[], userPrompt?: string) {
  if (!operations.length) throw new Error("Edit plan contains no operations");
  const state = useEditorStore.getState();
  const beforeDuration = getEditedDuration(getCutRanges(state.words, state.duration, state.manualCuts), state.duration);
  const plan: AgentEditPlan = {
    id: agentId("plan"),
    createdAt: new Date().toISOString(),
    userPrompt,
    operations,
    beforeDuration,
    projectedDuration: estimatePlanDuration(operations),
    status: "proposed",
  };
  useAgentStore.getState().setProposedPlan(plan);
  useAgentStore.getState().addEvent({
    title: `Proposed ${operations.length} edits`,
    detail: `${beforeDuration.toFixed(1)}s → ${plan.projectedDuration.toFixed(1)}s`,
    kind: "edit",
  });
  return plan;
}

export function applyProposedPlan(planId: string) {
  const plan = useAgentStore.getState().proposedPlan;
  if (!plan || plan.id !== planId) throw new Error("Proposed edit plan was not found");
  const applied = applyEditPlan(plan.operations, { userPrompt: plan.userPrompt });
  useAgentStore.getState().setProposedPlan({ ...plan, status: "applied" });
  return applied;
}

export function rejectProposedPlan(planId: string) {
  const plan = useAgentStore.getState().proposedPlan;
  if (!plan || plan.id !== planId) throw new Error("Proposed edit plan was not found");
  const rejected = { ...plan, status: "rejected" as const };
  useAgentStore.getState().setProposedPlan(rejected);
  useAgentStore.getState().addEvent({ title: "Rejected edit plan", detail: `${plan.operations.length} proposed edits were not applied`, kind: "edit" });
  return rejected;
}

export function getPlanPreviewRange(plan: AgentEditPlan) {
  const state = useEditorStore.getState();
  const byId = new Map(state.words.map((word) => [word.id, word]));
  const times: number[] = [];
  for (const operation of plan.operations) {
    if ("start" in operation && typeof operation.start === "number") times.push(operation.start);
    if ("end" in operation && typeof operation.end === "number") times.push(operation.end);
    if (operation.type === "split_clip") times.push(Math.max(0, operation.time - 2), Math.min(state.duration, operation.time + 2));
    if (operation.type === "cut_words" || operation.type === "restore_words") {
      const ids = operation.wordIds ?? [operation.startWordId, operation.endWordId].filter((id): id is number => id != null);
      for (const id of ids) {
        const word = byId.get(id);
        if (word) times.push(word.start, word.end);
      }
    }
    if (operation.type === "correct_transcript") {
      for (const id of operation.wordIds) {
        const word = byId.get(id);
        if (word) times.push(word.start, word.end);
      }
    }
  }
  if (!times.length) return { start: 0, end: Math.min(state.duration, 15) };
  return { start: Math.max(0, Math.min(...times) - 0.5), end: Math.min(state.duration, Math.max(...times) + 0.5) };
}

import { getClipSegments, getCutRanges, getKeepRanges } from "@/lib/edits";
import { findFillerWordIds } from "@/lib/fillers";
import { findSilenceRanges } from "@/lib/silences";
import { useEditorStore } from "@/lib/store";
import { runAgentTransaction } from "./history";
import type { AgentEditOperation, AgentScope } from "./types";

function ensureProject() {
  const state = useEditorStore.getState();
  if (!state.videoFile && state.words.length === 0) throw new Error("No media project is loaded");
  return state;
}

function uniqueExistingIds(ids: number[]) {
  const existing = new Set(ensureProject().words.map((word) => word.id));
  return [...new Set(ids)].filter((id) => existing.has(id));
}

export function idsBetween(startWordId: number, endWordId: number) {
  const words = ensureProject().words;
  const start = words.findIndex((word) => word.id === startWordId);
  const end = words.findIndex((word) => word.id === endWordId);
  if (start < 0 || end < 0) throw new Error("Transcript range contains an unknown word ID");
  if (end < start) throw new Error("endWordId must occur after startWordId");
  return words.slice(start, end + 1).map((word) => word.id);
}

function resolveWordIds(operation: Extract<AgentEditOperation, { type: "cut_words" | "restore_words" }>) {
  if (operation.wordIds?.length) return uniqueExistingIds(operation.wordIds);
  if (operation.startWordId == null || operation.endWordId == null) throw new Error(`${operation.type} requires wordIds or a transcript range`);
  return idsBetween(operation.startWordId, operation.endWordId);
}

function wordsForScope(scope: AgentScope | undefined) {
  const state = ensureProject();
  if (!scope || scope.type === "project") return state.words;
  if (scope.type === "selection") return state.words.filter((word) => state.selectedWordIds.includes(word.id));
  if (scope.type === "speaker") return state.words.filter((word) => word.speaker === scope.speakerId);
  return state.words.filter((word) => word.end > scope.start && word.start < scope.end);
}

function timeBoundsForScope(scope: AgentScope | undefined) {
  const state = ensureProject();
  if (!scope || scope.type === "project") return { start: 0, end: state.duration };
  if (scope.type === "time-range") return { start: scope.start, end: scope.end };
  const words = wordsForScope(scope);
  if (!words.length) throw new Error("The requested scope is empty");
  return { start: Math.min(...words.map((word) => word.start)), end: Math.max(...words.map((word) => word.end)) };
}

export function executeEditOperation(operation: AgentEditOperation) {
  const state = ensureProject();
  switch (operation.type) {
    case "cut_words": {
      const ids = resolveWordIds(operation);
      const words = state.words.filter((word) => ids.includes(word.id) && !word.deleted);
      state.deleteWords(ids);
      return { removedWords: words.length, removedDuration: words.reduce((total, word) => total + word.end - word.start, 0) };
    }
    case "restore_words": {
      const ids = resolveWordIds(operation);
      const words = state.words.filter((word) => ids.includes(word.id) && word.deleted);
      state.restoreWords(ids);
      return { restoredWords: words.length, restoredDuration: words.reduce((total, word) => total + word.end - word.start, 0) };
    }
    case "cut_time_range":
      if (operation.end <= operation.start) throw new Error("Cut end must be after start");
      state.cutRanges([{ start: operation.start, end: operation.end }]);
      return { removedDuration: operation.end - operation.start };
    case "restore_time_range":
      if (operation.end <= operation.start) throw new Error("Restore end must be after start");
      // The MIT baseline restores transcript-backed cuts through restoreWords.
      // A range with no transcript words has no independently addressable cut.
      const ids = state.words
        .filter((word) => word.end > operation.start && word.start < operation.end)
        .map((word) => word.id);
      state.restoreWords(ids);
      return { restoredWords: ids.length };
    case "remove_fillers": {
      const scopeIds = new Set(wordsForScope(operation.scope).map((word) => word.id));
      const ids = findFillerWordIds(state.words).filter((id) => scopeIds.has(id));
      const duration = state.words.filter((word) => ids.includes(word.id)).reduce((total, word) => total + word.end - word.start, 0);
      state.deleteWords(ids);
      return { removedWords: ids.length, removedDuration: duration };
    }
    case "remove_silence": {
      const minimumDuration = operation.minimumDuration ?? 0.5;
      if (minimumDuration < 0) throw new Error("minimumDuration cannot be negative");
      const bounds = timeBoundsForScope(operation.scope);
      const ranges = findSilenceRanges(state.words, state.duration, state.manualCuts, minimumDuration)
        .map((range) => ({ start: Math.max(range.start, bounds.start), end: Math.min(range.end, bounds.end) }))
        .filter((range) => range.end > range.start);
      state.cutRanges(ranges);
      return { removedRanges: ranges.length, removedDuration: ranges.reduce((total, range) => total + range.end - range.start, 0), ranges };
    }
    case "correct_transcript": {
      const ids = uniqueExistingIds(operation.wordIds);
      if (!operation.replacement.trim()) throw new Error("Replacement text cannot be empty");
      state.correctWords(ids, operation.replacement.trim());
      return { correctedWords: ids.length, replacement: operation.replacement.trim() };
    }
    case "split_clip":
      state.seekTo(operation.time);
      if (!state.splitAtPlayhead()) throw new Error(`Cannot split at ${operation.time.toFixed(2)}s`);
      return { splitAt: operation.time };
    case "trim_clip": {
      const cuts = getCutRanges(state.words, state.duration, state.manualCuts);
      const clip = getClipSegments(getKeepRanges(cuts, state.duration), state.sceneBoundaries).find((item) => item.id === operation.clipId);
      if (!clip) throw new Error(`Unknown clip ID ${operation.clipId}`);
      if (operation.start < clip.start || operation.end > clip.end || operation.end <= operation.start) throw new Error("Trim bounds must be inside the target clip");
      state.cutRanges([
        { start: clip.start, end: operation.start },
        { start: operation.end, end: clip.end },
      ]);
      return { clipId: operation.clipId, start: operation.start, end: operation.end };
    }
  }
}

export function applyEditPlan(operations: AgentEditOperation[], options: { userPrompt?: string; source?: "webmcp" | "agent-panel" } = {}) {
  if (!operations.length) throw new Error("Edit plan contains no operations");
  return runAgentTransaction({
    label: operations.length === 1 ? operationLabel(operations[0]) : `Applied ${operations.length}-operation edit plan`,
    operations,
    source: options.source,
    userPrompt: options.userPrompt,
    execute: () => operations.map(executeEditOperation),
  });
}

export function cutWords(wordIds: number[], options?: { source?: "webmcp" | "agent-panel" }) {
  return applyEditPlan([{ type: "cut_words", wordIds }], options);
}

export function restoreWords(wordIds: number[]) {
  return applyEditPlan([{ type: "restore_words", wordIds }]);
}

export function removeFillers(scope: AgentScope = { type: "project" }, source: "webmcp" | "agent-panel" = "webmcp") {
  return applyEditPlan([{ type: "remove_fillers", scope }], { source });
}

export function removeSilence(minimumDuration = 0.5, scope: AgentScope = { type: "project" }) {
  return applyEditPlan([{ type: "remove_silence", minimumDuration, scope }]);
}

function operationLabel(operation: AgentEditOperation) {
  const labels: Record<AgentEditOperation["type"], string> = {
    cut_words: "Cut transcript words",
    restore_words: "Restored transcript words",
    cut_time_range: "Cut time range",
    restore_time_range: "Restored time range",
    remove_fillers: "Removed filler words",
    remove_silence: "Removed silence",
    correct_transcript: "Corrected transcript",
    split_clip: "Split clip",
    trim_clip: "Trimmed clip",
  };
  return labels[operation.type];
}

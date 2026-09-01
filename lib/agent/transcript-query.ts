import { useEditorStore } from "@/lib/store";

export function getTranscript(includeDeleted = false) {
  const { words } = useEditorStore.getState();
  const filtered = words.filter((word) => includeDeleted || !word.deleted);
  const segments: Array<{ speakerId: number; speaker: string; words: Array<(typeof filtered)[number]> }> = [];
  for (const word of filtered) {
    const last = segments[segments.length - 1];
    if (!last || last.speakerId !== word.speaker) {
      segments.push({ speakerId: word.speaker, speaker: `Speaker ${word.speaker + 1}`, words: [word] });
    } else {
      last.words.push(word);
    }
  }
  return { segments };
}

export function searchTranscript(query: string) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  const { words } = useEditorStore.getState();
  const queryTokens = q.split(/\s+/).filter(Boolean);
  const normalized = words.map((word) => word.text.toLocaleLowerCase().replace(/^\W+|\W+$/g, ""));
  const matches: Array<{ startWordId: number; endWordId: number; text: string; start: number; end: number; deleted: boolean }> = [];
  for (let i = 0; i < normalized.length; i++) {
    const window = normalized.slice(i, i + queryTokens.length);
    const phraseMatch = queryTokens.length > 1 && window.every((token, index) => token === queryTokens[index]);
    const fuzzyMatch = queryTokens.length === 1 && normalized[i].includes(queryTokens[0]);
    if (!phraseMatch && !fuzzyMatch) continue;
    const matchedWords = words.slice(i, i + Math.max(1, queryTokens.length));
    matches.push({
      startWordId: matchedWords[0].id,
      endWordId: matchedWords[matchedWords.length - 1].id,
      text: matchedWords.map((word) => word.text).join(" "),
      start: matchedWords[0].start,
      end: matchedWords[matchedWords.length - 1].end,
      deleted: matchedWords.every((word) => word.deleted),
    });
  }
  return matches;
}

export function getSelection() {
  const s = useEditorStore.getState();
  const selectedIds = new Set(s.selectedWordIds);
  const selectedIndices: number[] = [];
  const selectedWords: typeof s.words = [];
  s.words.forEach((word, index) => {
    if (!selectedIds.has(word.id)) return;
    selectedIndices.push(index);
    selectedWords.push(word);
  });
  const from = selectedIndices.length ? Math.max(0, Math.min(...selectedIndices) - 8) : -1;
  const to = selectedIndices.length ? Math.min(s.words.length, Math.max(...selectedIndices) + 9) : -1;
  return {
    wordIds: s.selectedWordIds,
    selectedWords,
    clipIndex: s.selectedClipIndex,
    playhead: s.currentTime,
    visibleContext: from >= 0 ? s.words.slice(from, to) : [],
  };
}

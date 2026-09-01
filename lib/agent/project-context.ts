import { getClipSegments, getCutRanges, getEditedDuration, getKeepRanges } from "@/lib/edits";
import { useEditorStore } from "@/lib/store";

export function getProjectContext() {
  const s = useEditorStore.getState();
  const cuts = getCutRanges(s.words, s.duration, s.manualCuts);
  const speakerIds = [...new Set(s.words.map((word) => word.speaker))].sort((a, b) => a - b);
  return {
    projectId: s.projectId,
    mediaType: s.mediaKind,
    duration: s.duration,
    editedDuration: getEditedDuration(cuts, s.duration),
    speakerCount: speakerIds.length,
    wordCount: s.words.length,
    cutWordCount: s.words.filter((w) => w.deleted).length,
    sceneCount: s.sceneBoundaries.length + 1,
    currentTime: s.currentTime,
    selection: {
      wordIds: s.selectedWordIds,
      clipIndex: s.selectedClipIndex,
    },
    clips: getClipSegments(getKeepRanges(cuts, s.duration), s.sceneBoundaries).map((clip) => ({
      id: clip.id,
      start: clip.start,
      end: clip.end,
      index: clip.index,
    })),
    cuts,
    sceneBoundaries: s.sceneBoundaries,
    speakerIds,
    status: s.status,
    progress: s.progress,
    error: s.error,
  };
}

import { useEditorStore } from "@/lib/store";
import { useAgentStore } from "./store";

let stopPreview: (() => void) | null = null;

export function seek(time: number) {
  const state = useEditorStore.getState();
  const clamped = Math.max(0, Math.min(state.duration || time, time));
  state.seekTo(clamped);
  useAgentStore.getState().addEvent({ title: "Moved playhead", detail: `${clamped.toFixed(2)}s`, kind: "navigation" });
  return { time: clamped };
}
export function seekToWords(wordIds: number[]) {
  const words = useEditorStore.getState().words.filter((word) => wordIds.includes(word.id));
  return words.length ? seek(words[0].start) : { time: null };
}
export function previewRange(start: number, end: number) {
  const state = useEditorStore.getState();
  if (end <= start) throw new Error("Preview end must be after start");
  stopPreview?.();
  state.seekTo(start);
  const media = state.videoEl;
  if (media) {
    const onTimeUpdate = () => {
      if (media.currentTime < end) return;
      media.pause();
      media.removeEventListener("timeupdate", onTimeUpdate);
      stopPreview = null;
    };
    media.addEventListener("timeupdate", onTimeUpdate);
    stopPreview = () => media.removeEventListener("timeupdate", onTimeUpdate);
    void media.play();
  } else {
    state.setPlaying(true);
  }
  useAgentStore.getState().addEvent({ title: "Previewing section", detail: `${start.toFixed(1)}s–${end.toFixed(1)}s`, kind: "navigation" });
  return { start, end, playing: true };
}

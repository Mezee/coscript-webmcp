"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/lib/store";
import type { WorkerResponse } from "@/lib/types";

let activeWorker: Worker | null = null;

/** Stop an in-flight transcription job (e.g. after importing a transcript). */
export function cancelTranscription() {
  activeWorker?.terminate();
  activeWorker = null;
}

/** Owns the transcription web worker and pipes its messages into the store. */
export function useTranscriber() {
  const workerRef = useRef<Worker | null>(null);
  const transcribingRef = useRef(false);
  const [modelState, setModelState] = useState({ ready: false, message: "Preparing transcription…", error: null as string | null });

  useEffect(() => {
    cancelTranscription();
    const worker = new Worker(new URL("../workers/transcription.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    activeWorker = worker;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (!transcribingRef.current) {
        if (msg.type === "progress") setModelState({ ready: false, message: msg.message, error: null });
        else if (msg.type === "model-ready") setModelState({ ready: true, message: "", error: null });
        else if (msg.type === "error") setModelState({ ready: false, message: "", error: msg.message });
        return;
      }
      const s = useEditorStore.getState();
      if (s.skipTranscription) return;
      switch (msg.type) {
        case "progress": s.setProgress({ message: msg.message, value: msg.value }); break;
        case "partial": s.setPartialText(msg.text); break;
        case "complete": s.setWords(msg.words); s.setStatus("ready"); s.setPartialText(""); transcribingRef.current = false; break;
        case "error": s.setError(msg.message); transcribingRef.current = false; break;
      }
    };
    worker.onerror = (err) => {
      if (!transcribingRef.current) setModelState({ ready: false, message: "", error: err.message || "Could not load the speech model." });
      else useEditorStore.getState().setError(err.message || "Transcription worker crashed.");
    };
    worker.postMessage({ type: "preload", model: "small" });

    return () => {
      if (activeWorker === worker) cancelTranscription();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, []);

  const transcribe = useCallback((audio: Float32Array, duration: number) => {
    const store = useEditorStore.getState();
    const worker = workerRef.current;
    if (!worker) { store.setError("Speech model is not ready yet."); return; }
    store.setStatus("transcribing");
    store.setProgress({ message: "Transcribing…", value: 0 });
    transcribingRef.current = true;

    // Transfer a copy so the original stays available for the waveform.
    const copy = audio.slice();
    worker.postMessage(
      { type: "transcribe", audio: copy, duration, model: "small", language: store.transcriptLanguage, verbatim: store.verbatim },
      [copy.buffer]
    );
  }, []);

  return { transcribe, cancel: cancelTranscription, modelState };
}

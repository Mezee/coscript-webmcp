"use client";

import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import type { TranscriptionModel } from "@/lib/models";
import {
  TRANSCRIPT_LANGUAGE_ORDER,
  TRANSCRIPT_LANGUAGES,
  type TranscriptLanguage,
} from "@/lib/languages";
import { useEditorStore } from "@/lib/store";

export default function RetranscribeDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (
    model: TranscriptionModel,
    language: TranscriptLanguage,
    verbatim: boolean
  ) => void;
}) {
  const currentLanguage = useEditorStore((s) => s.transcriptLanguage);
  const currentVerbatim = useEditorStore((s) => s.verbatim);
  const model: TranscriptionModel = "small";
  const [language, setLanguage] = useState<TranscriptLanguage>(currentLanguage);
  const [verbatim, setVerbatim] = useState(currentVerbatim);
  const selectedLanguage = language;

  return (
    <div
      className="app-no-drag fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm dark:bg-black/60"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="retranscribe-title"
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="retranscribe-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Re-transcribe media
            </h2>
            <p className="mt-1 text-sm leading-5 text-zinc-500 dark:text-zinc-400">
              Keep the media and create a new transcript.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Language</span>
            <select
              value={selectedLanguage}
              onChange={(event) => setLanguage(event.target.value as TranscriptLanguage)}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {TRANSCRIPT_LANGUAGE_ORDER.map((option) => (
                <option key={option} value={option}>{TRANSCRIPT_LANGUAGES[option].label}</option>
              ))}
            </select>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
            <input
              type="checkbox"
              checked={verbatim}
              onChange={(event) => setVerbatim(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
            />
            <span>
              <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">Verbatim transcript</span>
              <span className="mt-0.5 block text-xs leading-4 text-zinc-500 dark:text-zinc-400">
                Preserve stutters, filler words, and repetitions where the model detects them.
              </span>
            </span>
          </label>
        </div>

        <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Your current transcript, cuts, corrections, and undo history will be replaced. The original media stays loaded.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg px-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(model, selectedLanguage, verbatim)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <RefreshCw size={14} />
            Re-transcribe
          </button>
        </div>
      </section>
    </div>
  );
}

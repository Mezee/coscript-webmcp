/** Whisper variants executed through transformers.js. */
export type WhisperModel = "base" | "small";
/** Parakeet variants executed through parakeet.js. */
export type ParakeetModel = "parakeet-tdt-0.6b-v2";
/** Any built-in model that can generate a transcript. */
export type TranscriptionModel = WhisperModel | ParakeetModel;
/** Transcription source choices offered on the upload screen. */
export type ModelChoice = TranscriptionModel | "import";

type DType = "fp32" | "fp16" | "q8" | "int8" | "uint8" | "q4" | "q4f16" | "bnb4";

export interface ModelInfo {
  /** Hugging Face model id (ONNX export compatible with transformers.js). */
  id: string;
  label: string;
  description: string;
  /** Approximate download size shown in the UI. */
  size: string;
  /** dtype configuration per device. */
  dtype: {
    webgpu: Record<string, DType>;
    wasm: Record<string, DType>;
  };
  /**
   * Whisper is trained to produce "clean" transcripts and usually drops
   * disfluencies. Conditioning the decoder on a prompt that itself contains
   * fillers biases it toward verbatim output. The prompt is injected as
   * `<|startofprev|> …prompt… <|startoftranscript|>` decoder tokens.
   *
   * (A dedicated verbatim model — CrisperWhisper — was evaluated, but its
   * only browser-runnable ONNX export lacks the cross-attention outputs
   * required for word-level timestamps, which this editor depends on.)
   */
  verbatimPrompt?: string;
}

/** Display order for Whisper rows in the homepage source dropdown. */
export const WHISPER_ORDER: WhisperModel[] = ["base", "small"];

const WHISPER_DTYPE = {
  // q4 decoder: q8 fails session creation on onnxruntime-web 1.26
  // (Missing required scale … MatMulNBits).
  webgpu: { encoder_model: "fp32", decoder_model_merged: "q4" },
  wasm: { encoder_model: "fp32", decoder_model_merged: "q4" },
} satisfies ModelInfo["dtype"];

/** Whisper models that can run in the transcription worker. */
export const MODELS: Record<WhisperModel, ModelInfo> = {
  base: {
    id: "onnx-community/whisper-base_timestamped",
    label: "Whisper Base",
    description: "Faster download and transcription. Good for most clips.",
    size: "~200 MB",
    dtype: WHISPER_DTYPE,
    // Do not set verbatimPrompt: forcing a long <|startofprev|> prompt via
    // decoder_input_ids truncates long-form transcripts (e.g. drops the second
    // speaker on mixed clips). Prefer post-process / filler tools instead.
  },
  small: {
    id: "onnx-community/whisper-small_timestamped",
    label: "Whisper Small",
    description: "More accurate on longer or noisier audio. Larger download.",
    size: "~600 MB",
    dtype: WHISPER_DTYPE,
  },
};

/** Metadata for non-Whisper models. Kept separate because their runtimes differ. */
export const PARAKEET_MODELS: Record<ParakeetModel, Omit<ModelInfo, "dtype">> = {
  "parakeet-tdt-0.6b-v2": {
    id: "parakeet-tdt-0.6b-v2",
    label: "Parakeet TDT 0.6B v2",
    description: "Higher-accuracy English transcription with native word timing.",
    size: "~700 MB · English",
  },
};

export function isWhisperModel(value: unknown): value is WhisperModel {
  return value === "base" || value === "small";
}

export function isParakeetModel(value: unknown): value is ParakeetModel {
  return value === "parakeet-tdt-0.6b-v2";
}

export function isTranscriptionModel(value: unknown): value is TranscriptionModel {
  return isWhisperModel(value) || isParakeetModel(value);
}

/** Get picker metadata for either transcription runtime. */
export function getTranscriptionModelInfo(model: TranscriptionModel) {
  return isWhisperModel(model) ? MODELS[model] : PARAKEET_MODELS[model];
}

export function isModelChoice(value: unknown): value is ModelChoice {
  return isTranscriptionModel(value) || value === "import";
}

const MODEL_STORAGE_KEY = "rescript.model";
const VERBATIM_STORAGE_KEY = "rescript.verbatim";

/** Read the last-selected transcription model from localStorage (defaults to Small). */
export function loadModelPreference(): TranscriptionModel {
  // The editor intentionally ships one warmed speech model for a predictable
  // first-run experience. Keep the legacy key only so old sessions stay safe.
  return "small";
}

/** Persist the selected transcription model for the next visit. */
export function saveModelPreference(model: TranscriptionModel) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MODEL_STORAGE_KEY, model);
  } catch {
    // private mode / disabled storage
  }
}

/** Whether new transcripts should favor disfluencies over a polished reading. */
export function loadVerbatimPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(VERBATIM_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function saveVerbatimPreference(verbatim: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VERBATIM_STORAGE_KEY, String(verbatim));
  } catch {
    // private mode / disabled storage
  }
}

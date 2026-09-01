export interface AgentToolSchema {
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface NativeToolContext {
  status: "idle" | "preparing" | "transcribing" | "ready" | "exporting" | "error";
  canUndo: boolean;
  canRedo: boolean;
  hasProposedPlan: boolean;
  exportOpen: boolean;
  hasRecentProjects: boolean;
  selectedWordCount: number;
  reviewUiVisible: boolean;
}

const emptyInput = { type: "object", additionalProperties: false, properties: {} };
const wordIds = { type: "array", items: { type: "number" }, minItems: 1 };
const scope = {
  oneOf: [
    { type: "string", enum: ["project", "selection"] },
    { type: "object", required: ["type", "speakerId"], properties: { type: { const: "speaker" }, speakerId: { type: "number" } } },
    { type: "object", required: ["type", "start", "end"], properties: { type: { const: "time-range" }, start: { type: "number" }, end: { type: "number" } } },
  ],
};

export const agentEditOperationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type"],
  properties: {
    type: { enum: ["cut_words", "restore_words", "cut_time_range", "restore_time_range", "remove_fillers", "remove_silence", "correct_transcript", "split_clip", "trim_clip"] },
    wordIds,
    startWordId: { type: "number" },
    endWordId: { type: "number" },
    start: { type: "number" },
    end: { type: "number" },
    minimumDuration: { type: "number", minimum: 0 },
    scope,
    replacement: { type: "string" },
    speakerId: { type: "number" },
    name: { type: "string" },
    time: { type: "number" },
    clipId: { type: "string" },
  },
};

export const agentToolSchemas: Record<string, AgentToolSchema> = {
  get_project_context: { description: "Inspect project metadata, duration, speakers, clips, cuts, playhead, and selection.", inputSchema: emptyInput },
  get_transcript: { description: "Return speaker-grouped transcript words with stable IDs and original-media timestamps.", inputSchema: { type: "object", additionalProperties: false, properties: { includeDeleted: { type: "boolean", default: false } } } },
  search_transcript: { description: "Find exact phrases or fuzzy single-word matches and return transcript ranges.", inputSchema: { type: "object", additionalProperties: false, required: ["query"], properties: { query: { type: "string", minLength: 1 } } } },
  get_selection: { description: "Return selected words, selected timeline objects, playhead, and nearby transcript context.", inputSchema: emptyInput },
  get_edited_duration: { description: "Return the current edited duration after all cuts.", inputSchema: emptyInput },
  cut_words: { description: "Cut words by stable transcript IDs.", inputSchema: { type: "object", additionalProperties: false, required: ["wordIds"], properties: { wordIds } } },
  cut_transcript_range: { description: "Cut one contiguous transcript range inclusively.", inputSchema: { type: "object", additionalProperties: false, required: ["startWordId", "endWordId"], properties: { startWordId: { type: "number" }, endWordId: { type: "number" } } } },
  restore_words: { description: "Restore cut words by stable transcript IDs.", inputSchema: { type: "object", additionalProperties: false, required: ["wordIds"], properties: { wordIds } } },
  restore_transcript_range: { description: "Restore one contiguous transcript range inclusively.", inputSchema: { type: "object", additionalProperties: false, required: ["startWordId", "endWordId"], properties: { startWordId: { type: "number" }, endWordId: { type: "number" } } } },
  cut_time_range: { description: "Cut an arbitrary original-media time range.", inputSchema: { type: "object", additionalProperties: false, required: ["start", "end"], properties: { start: { type: "number" }, end: { type: "number" } } } },
  restore_time_range: { description: "Restore an arbitrary original-media time range.", inputSchema: { type: "object", additionalProperties: false, required: ["start", "end"], properties: { start: { type: "number" }, end: { type: "number" } } } },
  remove_fillers: { description: "Remove detected filler words in the project or current selection/speaker/time range.", inputSchema: { type: "object", additionalProperties: false, properties: { scope } } },
  remove_silence: { description: "Remove pauses at least minimumDuration seconds long in the requested scope.", inputSchema: { type: "object", additionalProperties: false, properties: { minimumDuration: { type: "number", minimum: 0, default: 0.5 }, scope } } },
  correct_transcript: { description: "Correct a contiguous transcript selection without changing the underlying media.", inputSchema: { type: "object", additionalProperties: false, required: ["wordIds", "replacement"], properties: { wordIds, replacement: { type: "string", minLength: 1 } } } },
  split_clip: { description: "Split the kept clip at an original-media timestamp.", inputSchema: { type: "object", additionalProperties: false, required: ["time"], properties: { time: { type: "number" } } } },
  trim_clip: { description: "Trim a clip inward to the requested original-media bounds.", inputSchema: { type: "object", additionalProperties: false, required: ["clipId", "start", "end"], properties: { clipId: { type: "string" }, start: { type: "number" }, end: { type: "number" } } } },
  select_transcript_range: { description: "Select a contiguous transcript range for selection-aware follow-up edits.", inputSchema: { type: "object", additionalProperties: false, required: ["startWordId", "endWordId"], properties: { startWordId: { type: "number" }, endWordId: { type: "number" } } } },
  seek: { description: "Move the playhead to an original-media timestamp.", inputSchema: { type: "object", additionalProperties: false, required: ["time"], properties: { time: { type: "number" } } } },
  seek_to_words: { description: "Move the playhead to the first supplied transcript word.", inputSchema: { type: "object", additionalProperties: false, required: ["wordIds"], properties: { wordIds } } },
  seek_to_phrase: { description: "Search for a phrase and seek to its first match.", inputSchema: { type: "object", additionalProperties: false, required: ["query"], properties: { query: { type: "string", minLength: 1 } } } },
  preview_range: { description: "Play a bounded original-media section and stop at its end.", inputSchema: { type: "object", additionalProperties: false, required: ["start", "end"], properties: { start: { type: "number" }, end: { type: "number" } } } },
  undo: { description: "Undo the most recent human or agent edit.", inputSchema: emptyInput },
  redo: { description: "Redo the most recently undone edit.", inputSchema: emptyInput },
  get_edit_history: { description: "Return recent agent transactions and current undo/redo availability.", inputSchema: emptyInput },
  propose_edit_plan: { description: "Create a human-reviewable edit plan without changing the project.", inputSchema: { type: "object", additionalProperties: false, required: ["operations"], properties: { operations: { type: "array", items: agentEditOperationSchema, minItems: 1 }, userPrompt: { type: "string" } } } },
  apply_edit_plan: { description: "Apply multiple semantic operations as one undoable transaction.", inputSchema: { type: "object", additionalProperties: false, required: ["operations"], properties: { operations: { type: "array", items: agentEditOperationSchema, minItems: 1 }, userPrompt: { type: "string" } } } },
  apply_proposed_plan: { description: "Apply the currently proposed plan after human approval.", inputSchema: { type: "object", additionalProperties: false, required: ["planId"], properties: { planId: { type: "string" } } } },
  reject_proposed_plan: { description: "Reject the currently proposed plan without changing the project.", inputSchema: { type: "object", additionalProperties: false, required: ["planId"], properties: { planId: { type: "string" } } } },
  export_video: { description: "Open the export confirmation dialog with the requested video settings.", inputSchema: { type: "object", additionalProperties: false, required: ["format", "resolution"], properties: { format: { enum: ["mp4", "webm"] }, resolution: { enum: ["original", "720p", "1080p", "4k"] } } } },
};

/** Journey-oriented public surface registered with WebMCP. Legacy command schemas remain above for direct callers. */
export const nativeToolSchemas: Record<string, AgentToolSchema> = {
  list_recent_projects: {
    description: "List locally saved ReScript projects while the upload screen is visible. Returns project IDs and display metadata without opening or changing a project.",
    inputSchema: emptyInput,
  },
  open_recent_project: {
    description: "Open a project returned by list_recent_projects while the upload screen is visible. Returns the loading project context and replaces the upload screen with the editor.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["projectId"],
      properties: { projectId: { type: "string", minLength: 1 } },
    },
  },
  inspect_project: {
    description: "Inspect the currently open project while it is processing or ready. Returns status and progress plus available project, timeline, playhead, and current-selection context without changing the page.",
    inputSchema: emptyInput,
  },
  manage_editing_task: {
    description: "Start, complete, or cancel an autonomous editing task in the ready editor. Starting records the goal; completing or cancelling updates the visible Agent Workspace without changing media by itself.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      properties: { action: { enum: ["start", "complete", "cancel"] }, goal: { type: "string", minLength: 1 } },
    },
  },
  find_in_transcript: {
    description: "Find words or phrases in the currently visible transcript when the editor is ready. Returns matching word IDs, text, timestamps, and deletion state without moving the playhead.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1 },
      },
    },
  },
  focus_transcript_match: {
    description: "Find a phrase in the ready transcript and move the visible playhead to its first match. Returns the focused match, or an explicit no-match result.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: { query: { type: "string", minLength: 1 } },
    },
  },
  apply_selection_edit: {
    description: "Apply a reversible edit to the transcript words currently selected in the visible editor, or cut, restore, or correct an explicit contiguous word range. Changes the shared editor immediately, records one undoable history transaction, and returns the applied operation.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      properties: {
        action: { enum: ["cut", "restore", "remove_fillers", "remove_silence", "correct_text"] },
        replacement: { type: "string", minLength: 1, description: "Required for correct_text." },
        minimumSilenceDuration: { type: "number", minimum: 0, default: 0.5 },
        startWordId: { type: "number", description: "First word in an explicit range. Use with endWordId for cut, restore, or correct_text." },
        endWordId: { type: "number", description: "Last word in an explicit range. Use with startWordId for cut, restore, or correct_text." },
        userPrompt: { type: "string" },
      },
    },
  },
  apply_project_cleanup: {
    description: "Apply reversible cleanup to the ready project by removing filler words and optionally long silences. Changes the shared editor immediately, records one undoable history transaction, and returns the applied operations.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        removeFillers: { type: "boolean", default: true },
        minimumSilenceDuration: { type: "number", minimum: 0 },
        userPrompt: { type: "string" },
      },
    },
  },
  navigate_edit_history: {
    description: "Move through the ready editor's currently available undo/redo history. Reversibly changes visible project state and returns the resulting edited duration.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      properties: { action: { enum: ["undo", "redo"] } },
    },
  },
  open_export_confirmation: {
    description: "Open Rescript's visible export confirmation dialog with the requested video settings while the ready editor is unobstructed. Returns the selected settings; rendering starts only if the user presses Export in the dialog.",
    inputSchema: agentToolSchemas.export_video.inputSchema,
  },
};

/** Pure disclosure model used by registrars and lifecycle tests. */
export function getContextualNativeToolSchemas(context: NativeToolContext) {
  if (context.status === "idle") {
    const tools: Record<string, AgentToolSchema> = { list_recent_projects: nativeToolSchemas.list_recent_projects };
    if (context.hasRecentProjects) tools.open_recent_project = nativeToolSchemas.open_recent_project;
    return tools;
  }

  if (context.status !== "ready") return { inspect_project: nativeToolSchemas.inspect_project };

  const tools: Record<string, AgentToolSchema> = {
    inspect_project: nativeToolSchemas.inspect_project,
    find_in_transcript: nativeToolSchemas.find_in_transcript,
  };
  if (context.exportOpen) return tools;

  tools.focus_transcript_match = nativeToolSchemas.focus_transcript_match;
  if (context.reviewUiVisible) tools.apply_project_cleanup = nativeToolSchemas.apply_project_cleanup;
  if (context.selectedWordCount > 0 && context.reviewUiVisible) tools.apply_selection_edit = nativeToolSchemas.apply_selection_edit;
  if (context.canUndo || context.canRedo) tools.navigate_edit_history = nativeToolSchemas.navigate_edit_history;
  tools.open_export_confirmation = nativeToolSchemas.open_export_confirmation;
  return tools;
}

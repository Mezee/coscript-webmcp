export type AgentScope =
  | { type: "project" }
  | { type: "selection" }
  | { type: "speaker"; speakerId: number }
  | { type: "time-range"; start: number; end: number };

export type AgentEditOperation =
  | { type: "cut_words"; wordIds?: number[]; startWordId?: number; endWordId?: number }
  | { type: "restore_words"; wordIds?: number[]; startWordId?: number; endWordId?: number }
  | { type: "cut_time_range"; start: number; end: number }
  | { type: "restore_time_range"; start: number; end: number }
  | { type: "remove_fillers"; scope?: AgentScope }
  | { type: "remove_silence"; minimumDuration?: number; scope?: AgentScope }
  | { type: "correct_transcript"; wordIds: number[]; replacement: string }
  | { type: "split_clip"; time: number }
  | { type: "trim_clip"; clipId: string; start: number; end: number };

export interface AgentEditTransaction {
  id: string;
  timestamp: string;
  source: "webmcp" | "agent-panel";
  userPrompt?: string;
  label: string;
  operations: AgentEditOperation[];
  beforeDuration: number;
  afterDuration: number;
  undone: boolean;
}

export interface AgentActivityEvent {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  kind: "read" | "edit" | "navigation" | "export" | "error";
  status?: "running" | "completed" | "failed" | "cancelled";
  progress?: number;
  operationId?: string;
  undoable?: boolean;
}

export interface AgentTask {
  id: string;
  goal: string;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  activeStep?: string;
  error?: string;
}

export interface AgentEditPlan {
  id: string;
  createdAt: string;
  userPrompt?: string;
  operations: AgentEditOperation[];
  beforeDuration: number;
  projectedDuration: number;
  status: "proposed" | "applied" | "rejected";
}

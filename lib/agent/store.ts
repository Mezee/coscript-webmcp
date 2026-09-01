"use client";

import { create } from "zustand";
import type { AgentActivityEvent, AgentEditPlan, AgentEditTransaction, AgentTask } from "./types";

type ConnectionKind = "disconnected" | "fallback" | "webmcp";

interface AgentState {
  connection: ConnectionKind;
  task: AgentTask | null;
  activeOperation: string | null;
  transactions: AgentEditTransaction[];
  events: AgentActivityEvent[];
  proposedPlan: AgentEditPlan | null;
  exportRequest: { format: "mp4" | "webm"; resolution: "original" | "720" | "1080" | "2160" } | null;
  setConnection: (connection: ConnectionKind) => void;
  setTask: (task: AgentTask | null) => void;
  setActiveOperation: (operation: string | null) => void;
  addEvent: (event: Omit<AgentActivityEvent, "id" | "timestamp">) => string;
  updateEvent: (id: string, patch: Partial<Omit<AgentActivityEvent, "id" | "timestamp">>) => void;
  addTransaction: (transaction: AgentEditTransaction) => void;
  markLatestUndone: (undone: boolean) => void;
  setProposedPlan: (plan: AgentEditPlan | null) => void;
  setExportRequest: (request: AgentState["exportRequest"]) => void;
  resetAgentState: () => void;
}

function createId(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export const useAgentStore = create<AgentState>((set) => ({
  connection: "disconnected",
  task: null,
  activeOperation: null,
  transactions: [],
  events: [],
  proposedPlan: null,
  exportRequest: null,
  setConnection: (connection) => set({ connection }),
  setTask: (task) => set({ task }),
  setActiveOperation: (activeOperation) => set({ activeOperation }),
  addEvent: (event) => {
    const id = createId("event");
    set((state) => ({
      events: [{ ...event, id, timestamp: new Date().toISOString() }, ...state.events].slice(0, 50),
    }));
    return id;
  },
  updateEvent: (id, patch) => set((state) => ({
    events: state.events.map((event) => event.id === id ? { ...event, ...patch } : event),
  })),
  addTransaction: (transaction) => set((state) => ({
    transactions: [transaction, ...state.transactions].slice(0, 50),
  })),
  markLatestUndone: (undone) => set((state) => {
    const index = state.transactions.findIndex((transaction) => transaction.undone !== undone);
    if (index < 0) return state;
    const transactions = [...state.transactions];
    transactions[index] = { ...transactions[index], undone };
    return { transactions };
  }),
  setProposedPlan: (proposedPlan) => set({ proposedPlan }),
  setExportRequest: (exportRequest) => set({ exportRequest }),
  resetAgentState: () => set({ activeOperation: null, task: null, transactions: [], events: [], proposedPlan: null, exportRequest: null }),
}));

export function agentId(prefix: string) {
  return createId(prefix);
}

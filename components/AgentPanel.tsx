"use client";

import { AlertCircle, Check, CheckCircle2, Eye, Loader2, RotateCcw, X } from "lucide-react";
import { undoAgentEdit } from "@/lib/agent/history";
import { previewRange } from "@/lib/agent/navigation";
import { applyProposedPlan, getPlanPreviewRange, rejectProposedPlan } from "@/lib/agent/plans";
import { useAgentStore } from "@/lib/agent/store";
import type { AgentActivityEvent } from "@/lib/agent/types";
import { PlanWebMCPTools } from "./webmcp/WebMCPRegistrars";
import { WebMCPDiagnostics } from "./webmcp/WebMCPDiagnostics";

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${(safe % 60).toString().padStart(2, "0")}`;
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function eventIcon(event: Pick<AgentActivityEvent, "status" | "kind">) {
  if (event.status === "running") return <Loader2 size={11} className="animate-spin" />;
  if (event.status === "failed" || event.kind === "error") return <AlertCircle size={11} />;
  return <CheckCircle2 size={11} />;
}

function eventTone(event: Pick<AgentActivityEvent, "status" | "kind">) {
  if (event.status === "failed" || event.kind === "error") return "text-red-600 dark:text-red-400";
  if (event.status === "running") return "text-zinc-500 dark:text-zinc-400";
  return "text-zinc-500 dark:text-zinc-400";
}

export default function AgentPanel() {
  const connection = useAgentStore((state) => state.connection);
  const events = useAgentStore((state) => state.events);
  const transactions = useAgentStore((state) => state.transactions);
  const proposedPlan = useAgentStore((state) => state.proposedPlan);
  const latest = transactions[0];
  const native = connection === "webmcp";
  const previewPlan = () => {
    if (!proposedPlan) return;
    const range = getPlanPreviewRange(proposedPlan);
    previewRange(range.start, range.end);
  };

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col border-l border-zinc-200 bg-white lg:flex dark:border-zinc-800 dark:bg-zinc-900">
      <PlanWebMCPTools />

      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-900 text-balance dark:text-zinc-100">Assistant Workspace</h2>
        <span className={`flex items-center gap-1.5 text-[11px] ${native ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}>
          <i className={`size-1.5 rounded-full ${native ? "bg-emerald-500" : "bg-zinc-400"}`} />
          {native ? "Connected" : "Available"}
        </span>
      </header>

      <WebMCPDiagnostics />

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {proposedPlan?.status === "proposed" && (
          <section className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-medium text-zinc-900 dark:text-zinc-100">Proposed edit</h3>
              <span className="tabular-nums text-[11px] text-zinc-500">{proposedPlan.operations.length} edits</span>
            </div>
            {proposedPlan.userPrompt && <p className="mt-1.5 line-clamp-2 text-pretty text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">{proposedPlan.userPrompt}</p>}
            <p className="mt-2 tabular-nums text-[11px] text-zinc-500">{formatDuration(proposedPlan.beforeDuration)} → {formatDuration(proposedPlan.projectedDuration)}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" onClick={previewPlan} className="flex items-center justify-center gap-1 rounded-md border border-zinc-300 px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"><Eye size={11} />Preview</button>
              <button type="button" onClick={() => applyProposedPlan(proposedPlan.id)} className="flex items-center justify-center gap-1 rounded-md bg-zinc-900 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"><Check size={11} />Apply</button>
              <button type="button" onClick={() => rejectProposedPlan(proposedPlan.id)} className="flex items-center justify-center gap-1 rounded-md border border-zinc-300 px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"><X size={11} />Reject</button>
            </div>
          </section>
        )}

        <section className="px-4 py-3">
          <h3 className="mb-1 text-xs font-medium text-zinc-900 dark:text-zinc-100">Agent History</h3>
          {events.length === 0 ? (
            <p className="text-pretty text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">Recent assistant actions will appear here.</p>
          ) : events.slice(0, 8).map((event) => (
            <div key={event.id} className="flex items-start gap-2 border-b border-zinc-100 py-2.5 last:border-b-0 dark:border-zinc-800">
              <span className={`mt-0.5 shrink-0 ${eventTone(event)}`}>{eventIcon(event)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-zinc-800 dark:text-zinc-200">{event.title}</p>
                <p className="line-clamp-2 text-pretty text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">{event.detail}</p>
              </div>
              <time className="shrink-0 tabular-nums text-[10px] text-zinc-400">{formatTime(event.timestamp)}</time>
            </div>
          ))}
        </section>

        {transactions.length > 0 && (
          <section className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h3 className="mb-1 text-xs font-medium text-zinc-900 dark:text-zinc-100">Edit history</h3>
            {transactions.slice(0, 6).map((transaction) => (
              <div key={transaction.id} className="flex items-start gap-2 border-b border-zinc-100 py-2.5 last:border-b-0 dark:border-zinc-800">
                <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-zinc-800 dark:text-zinc-200">{transaction.label}</p>
                  <p className="mt-0.5 tabular-nums text-[10px] text-zinc-500">{formatDuration(transaction.beforeDuration)} → {formatDuration(transaction.afterDuration)} · {transaction.undone ? "Undone" : `${transaction.operations.length} edit${transaction.operations.length === 1 ? "" : "s"}`}</p>
                </div>
                <button type="button" onClick={undoAgentEdit} disabled={transaction.undone || transaction.id !== latest?.id} className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-zinc-100"><RotateCcw size={10} />Undo</button>
              </div>
            ))}
          </section>
        )}
      </div>
    </aside>
  );
}

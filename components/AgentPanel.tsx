"use client";

import { AlertCircle, Check, CheckCircle2, CircleDot, Eye, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { useEditorStore } from "@/lib/store";
import { removeFillers } from "@/lib/agent/edit-commands";
import { undoAgentEdit } from "@/lib/agent/history";
import { previewRange } from "@/lib/agent/navigation";
import { applyProposedPlan, getPlanPreviewRange, rejectProposedPlan } from "@/lib/agent/plans";
import { useAgentStore } from "@/lib/agent/store";
import type { AgentActivityEvent } from "@/lib/agent/types";
import { manageAgentTask } from "@/lib/agent/task";
import { PlanWebMCPTools } from "./webmcp/WebMCPRegistrars";
import { WebMCPDiagnostics } from "./webmcp/WebMCPDiagnostics";

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${(safe % 60).toString().padStart(2, "0")}`;
}

function eventIcon(event: Pick<AgentActivityEvent, "status" | "kind">) {
  if (event.status === "running") return <Loader2 size={10} className="animate-spin" />;
  if (event.status === "failed" || event.kind === "error") return <AlertCircle size={10} />;
  return <CheckCircle2 size={10} />;
}

export default function AgentPanel() {
  const status = useEditorStore((state) => state.status);
  const connection = useAgentStore((state) => state.connection);
  const activeOperation = useAgentStore((state) => state.activeOperation);
  const task = useAgentStore((state) => state.task);
  const events = useAgentStore((state) => state.events);
  const transactions = useAgentStore((state) => state.transactions);
  const proposedPlan = useAgentStore((state) => state.proposedPlan);
  const latest = transactions[0];
  const native = connection === "webmcp";

  const cleanUp = () => {
    manageAgentTask("start", "Clean up this video");
    try {
      removeFillers({ type: "project" }, "agent-panel");
      manageAgentTask("complete");
    } catch (error) {
      useAgentStore.getState().addEvent({
        title: "Cleanup task failed",
        detail: error instanceof Error ? error.message : "Unknown cleanup error",
        kind: "error",
        status: "failed",
      });
      manageAgentTask("cancel");
    }
  };
  const previewPlan = () => {
    if (!proposedPlan) return;
    const range = getPlanPreviewRange(proposedPlan);
    previewRange(range.start, range.end);
  };

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col border-l border-zinc-200 bg-white lg:flex dark:border-zinc-800 dark:bg-zinc-900">
      <PlanWebMCPTools />
      <div className="flex items-start justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase text-zinc-400">Agent workspace</p>
          <h2 className="text-sm font-semibold text-zinc-900 text-balance dark:text-zinc-100">Agent activity</h2>
        </div>
        <span className={`flex items-center gap-1.5 font-mono text-[10px] ${native ? "text-emerald-600" : "text-amber-600"}`}>
          <i className={`size-1.5 rounded-full ${native ? "bg-emerald-500" : "bg-amber-500"}`} />
          {native ? "WebMCP" : "Bridge ready"}
        </span>
      </div>

      <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/70">
        <span className="grid size-7 place-items-center rounded-full bg-amber-200 text-amber-900"><Sparkles size={14} /></span>
        <span className="flex flex-col">
          <strong className="text-xs text-zinc-900 dark:text-zinc-100">{native ? "Agent connected" : "WebMCP available"}</strong>
          <span className="text-[10px] text-zinc-500">{native ? "Using native browser tools" : "Waiting for a compatible agent"}</span>
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <CircleDot size={14} className={activeOperation ? "text-amber-500" : "text-emerald-500"} />
        <span className="flex min-w-0 flex-col">
          <strong className="truncate text-xs text-zinc-900 dark:text-zinc-100">{activeOperation ?? task?.activeStep ?? (task ? "Editing task in progress" : "Ready to edit")}</strong>
          <span className="text-[10px] text-zinc-500">{task?.goal ?? (status === "ready" ? "Human and agent share editor state" : "Load a video to begin editing")}</span>
        </span>
      </div>

      <WebMCPDiagnostics />

      {proposedPlan?.status === "proposed" && (
        <section className="m-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="mb-2 flex items-center justify-between"><strong className="text-xs text-zinc-900 dark:text-zinc-100">Proposed edit plan</strong><span className="font-mono text-[10px] text-amber-700 dark:text-amber-400">{proposedPlan.operations.length} edits</span></div>
          {proposedPlan.userPrompt && <p className="mb-2 line-clamp-2 text-pretty text-[10px] leading-4 text-zinc-600 dark:text-zinc-400">{proposedPlan.userPrompt}</p>}
          <p className="mb-3 font-mono text-[10px] text-zinc-600 dark:text-zinc-300">{formatDuration(proposedPlan.beforeDuration)} → {formatDuration(proposedPlan.projectedDuration)}</p>
          <div className="grid grid-cols-3 gap-1.5">
            <button type="button" onClick={previewPlan} className="flex items-center justify-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[10px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"><Eye size={11} />Preview</button>
            <button type="button" onClick={() => applyProposedPlan(proposedPlan.id)} className="flex items-center justify-center gap-1 rounded-md bg-zinc-900 px-2 py-1.5 text-[10px] font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"><Check size={11} />Apply</button>
            <button type="button" onClick={() => rejectProposedPlan(proposedPlan.id)} className="flex items-center justify-center gap-1 rounded-md border border-zinc-300 px-2 py-1.5 text-[10px] font-medium text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300"><X size={11} />Reject</button>
          </div>
        </section>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto border-b border-zinc-200 px-4 py-3 scrollbar-thin dark:border-zinc-800">
        <p className="mb-2 font-mono text-[10px] uppercase text-zinc-400">Live activity</p>
        {events.length === 0 ? (
          <div className="flex h-full min-h-28 flex-col items-center justify-center text-center"><Sparkles size={16} className="mb-2 text-zinc-300" /><p className="text-[11px] font-medium text-zinc-500">Ready for an editing task</p><p className="mt-1 max-w-44 text-pretty text-[10px] leading-4 text-zinc-400">Agent progress and semantic edits will appear here.</p></div>
        ) : events.slice(0, 12).map((event) => (
          <div key={event.id} className="flex items-start gap-2 py-2.5">
            <span className={`grid size-4 shrink-0 place-items-center rounded-full text-[9px] ${event.status === "failed" || event.kind === "error" ? "bg-red-100 text-red-700" : event.status === "running" ? "bg-amber-100 text-amber-700" : event.kind === "edit" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{eventIcon(event)}</span>
            <span className="flex min-w-0 flex-1 flex-col"><strong className="truncate text-[11px] font-medium text-zinc-800 dark:text-zinc-200">{event.title}</strong><span className="line-clamp-2 text-pretty text-[10px] leading-4 text-zinc-500">{event.detail}</span></span>
            <time className="shrink-0 font-mono text-[9px] text-zinc-400">{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
          </div>
        ))}
      </div>

      {transactions.length > 0 && (
        <div className="px-4 py-4">
          <p className="mb-2 font-mono text-[10px] uppercase text-zinc-400">Edit history</p>
          <div className="space-y-2">
            {transactions.slice(0, 6).map((transaction) => (
              <div key={transaction.id} className="rounded-md border border-zinc-200 px-2.5 py-2 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-medium text-zinc-800 dark:text-zinc-200">{transaction.label}</span><span className="shrink-0 font-mono text-[9px] text-zinc-400">{transaction.undone ? "undone" : `${transaction.operations.length} edit${transaction.operations.length === 1 ? "" : "s"}`}</span></div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-zinc-500"><span>{formatDuration(transaction.beforeDuration)} → {formatDuration(transaction.afterDuration)}</span><button type="button" onClick={undoAgentEdit} disabled={transaction.undone || transaction.id !== latest?.id} className="inline-flex items-center gap-1 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-zinc-200"><RotateCcw size={10} />Undo</button></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <button type="button" onClick={cleanUp} disabled={status !== "ready" || activeOperation != null} className="flex w-full items-center justify-between rounded-md bg-zinc-900 px-3 py-2.5 text-left text-xs font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"><span>Clean up video</span><Sparkles size={13} /></button>
      </div>
    </aside>
  );
}

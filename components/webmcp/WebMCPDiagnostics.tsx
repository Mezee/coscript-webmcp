"use client";

import { ChevronDown } from "lucide-react";
import { useAgentStore } from "@/lib/agent/store";
import { useWebMCPDiagnosticsStore } from "@/lib/agent/webmcp-diagnostics";
import { useEditorStore } from "@/lib/store";

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function statusClass(status: string) {
  if (status === "registered") return "text-emerald-600 dark:text-emerald-400";
  if (status === "unsupported") return "text-amber-600 dark:text-amber-400";
  if (status === "failed") return "text-red-600 dark:text-red-400";
  return "text-zinc-500 dark:text-zinc-400";
}

export function WebMCPDiagnostics() {
  const scopes = useWebMCPDiagnosticsStore((state) => state.scopes);
  const tools = useWebMCPDiagnosticsStore((state) => state.tools);
  const status = useEditorStore((state) => state.status);
  const projectId = useEditorStore((state) => state.projectId);
  const exportOpen = useEditorStore((state) => state.exportOpen);
  const selectedWordCount = useEditorStore((state) => state.selectedWordIds.length);
  const undoCount = useEditorStore((state) => state.past.length);
  const redoCount = useEditorStore((state) => state.future.length);
  const connection = useAgentStore((state) => state.connection);
  const task = useAgentStore((state) => state.task);
  const activeOperation = useAgentStore((state) => state.activeOperation);
  const proposedPlan = useAgentStore((state) => state.proposedPlan);

  return (
    <details className="border-t border-zinc-200 dark:border-zinc-800">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-medium text-zinc-700 marker:content-none dark:text-zinc-300">
        <span>WebMCP diagnostics</span>
        <ChevronDown size={14} className="transition-transform [[open]_&]:rotate-180" />
      </summary>
      <div className="max-h-72 space-y-4 overflow-y-auto border-t border-zinc-100 px-4 py-3 text-[10px] dark:border-zinc-800">
        <section>
          <p className="mb-1.5 font-mono uppercase text-zinc-400">Registration scopes</p>
          {scopes.length ? scopes.map((scope) => (
            <div key={scope.name} className="mb-1 rounded border border-zinc-200 px-2 py-1.5 dark:border-zinc-700">
              <strong className="font-mono text-zinc-700 dark:text-zinc-200">{scope.name}</strong>
              <p className="mt-0.5 break-words text-zinc-500 dark:text-zinc-400">{scope.toolNames.join(", ")}</p>
            </div>
          )) : <p className="text-zinc-500">No active registration scopes.</p>}
        </section>

        <section>
          <p className="mb-1.5 font-mono uppercase text-zinc-400">SDK registration results</p>
          {tools.length ? tools.map((tool) => (
            <div key={tool.name} className="mb-1 rounded border border-zinc-200 px-2 py-1.5 dark:border-zinc-700">
              <div className="flex items-center justify-between gap-2"><strong className="truncate font-mono text-zinc-700 dark:text-zinc-200">{tool.name}</strong><span className={`shrink-0 font-medium ${statusClass(tool.status)}`}>{tool.status}</span></div>
              <p className="mt-0.5 font-mono text-zinc-500">{tool.stableKey} · {formatTime(tool.registrationTime)}</p>
              {tool.error && <p className="mt-0.5 text-red-600 dark:text-red-400">{tool.error}</p>}
            </div>
          )) : <p className="text-zinc-500">No tools are currently registered.</p>}
        </section>

        <section>
          <p className="mb-1.5 font-mono uppercase text-zinc-400">Current editor and task state</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-zinc-500">
            <dt>Editor</dt><dd className="text-zinc-700 dark:text-zinc-200">{status}</dd>
            <dt>Project</dt><dd className="truncate text-zinc-700 dark:text-zinc-200">{projectId ?? "unsaved"}</dd>
            <dt>Selection</dt><dd className="text-zinc-700 dark:text-zinc-200">{selectedWordCount} words</dd>
            <dt>History</dt><dd className="text-zinc-700 dark:text-zinc-200">{undoCount} undo · {redoCount} redo</dd>
            <dt>Export dialog</dt><dd className="text-zinc-700 dark:text-zinc-200">{exportOpen ? "open" : "closed"}</dd>
            <dt>Connection</dt><dd className="text-zinc-700 dark:text-zinc-200">{connection}</dd>
            <dt>Task</dt><dd className="truncate text-zinc-700 dark:text-zinc-200">{task ? `${task.status}: ${task.goal}` : "none"}</dd>
            <dt>Operation</dt><dd className="truncate text-zinc-700 dark:text-zinc-200">{activeOperation ?? "none"}</dd>
            <dt>Plan</dt><dd className="text-zinc-700 dark:text-zinc-200">{proposedPlan?.status ?? "none"}</dd>
          </dl>
        </section>
      </div>
    </details>
  );
}

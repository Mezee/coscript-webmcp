import { agentId, useAgentStore } from "./store";
import type { AgentTask } from "./types";

export function manageAgentTask(action: "start" | "complete" | "cancel", goal?: string) {
  const current = useAgentStore.getState().task;
  if (action === "start") {
    if (!goal?.trim()) throw new Error("A task goal is required");
    const task: AgentTask = {
      id: agentId("task"),
      goal: goal.trim(),
      status: "running",
      startedAt: new Date().toISOString(),
    };
    useAgentStore.getState().setTask(task);
    useAgentStore.getState().addEvent({ title: "Started editing task", detail: task.goal, kind: "navigation", status: "running", operationId: task.id });
    return task;
  }
  if (!current || current.status !== "running") throw new Error("No active editing task");
  const status = action === "complete" ? "completed" : "cancelled";
  const task = { ...current, status, completedAt: new Date().toISOString(), activeStep: undefined } as AgentTask;
  useAgentStore.getState().setTask(task);
  useAgentStore.getState().addEvent({ title: action === "complete" ? "Completed editing task" : "Cancelled editing task", detail: current.goal, kind: action === "complete" ? "edit" : "navigation", status, operationId: current.id });
  return task;
}

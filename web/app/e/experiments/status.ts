export const EXPERIMENT_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-light text-slate" },
  running: { label: "Running", cls: "bg-amber-50 text-amber-800" },
  completed: { label: "Completed", cls: "bg-green-050 text-green-700" },
  stopped: { label: "Stopped", cls: "bg-light text-slate" },
};

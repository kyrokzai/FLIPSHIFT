import { stepStatusLabels, type StepStatus } from "@/lib/hiring-steps";

const tone: Record<StepStatus | "prohibited", string> = {
  success: "border-ok/30 bg-ok/8 text-ok",
  error: "border-danger/30 bg-danger-wash text-danger",
  needs_access: "border-gold/50 bg-gold-wash text-gold-deep",
  not_connected: "border-line-strong bg-paper text-ink-soft",
  waiting: "border-line bg-paper text-muted",
  running: "border-line-strong bg-surface text-ink",
  prohibited: "border-danger/30 bg-danger-wash text-danger",
};

/** Состояние шага или источника — словами, а не только цветом. */
export function StatusBadge({ status, label }: { status: StepStatus | "prohibited"; label?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${tone[status]} ${status === "running" ? "animate-pulse" : ""}`}
    >
      {label ?? (status === "prohibited" ? "Запрещено" : stepStatusLabels[status])}
    </span>
  );
}

import type { HTMLAttributes } from "react";
import clsx from "clsx";
import { STATO_COLOR, STATO_LABEL, type StatoMisura } from "@/lib/misure/stato";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function StatoBadge({ stato, className }: { stato: StatoMisura; className?: string }) {
  const c = STATO_COLOR[stato];
  return (
    <Badge className={clsx(c.bg, c.text, c.border, className)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", c.dot, stato === "IN_SCADENZA" && "animate-pulse")} />
      {STATO_LABEL[stato]}
    </Badge>
  );
}

"use client";

import clsx from "clsx";
import type { TimelineGanttHandle } from "./timeline-gantt";
import type { RefObject } from "react";

const PRESET = [
  { label: "3 mesi", mesi: 3 },
  { label: "6 mesi", mesi: 6 },
  { label: "1 anno", mesi: 12 },
];

export function TimelineToolbar({ timelineRef }: { timelineRef: RefObject<TimelineGanttHandle> }) {
  return (
    <div className="flex items-center gap-1.5">
      {PRESET.map((p) => (
        <button
          key={p.mesi}
          onClick={() => timelineRef.current?.impostaFinestraMesi(p.mesi)}
          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-brand-300 hover:text-brand-700"
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={() => timelineRef.current?.fit()}
        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-brand-300 hover:text-brand-700"
      >
        Tutto
      </button>
      <div className="mx-1 h-4 w-px bg-slate-200" />
      <ZoomButton onClick={() => timelineRef.current?.zoomOut()} label="Riduci zoom">
        −
      </ZoomButton>
      <ZoomButton onClick={() => timelineRef.current?.zoomIn()} label="Aumenta zoom">
        +
      </ZoomButton>
    </div>
  );
}

function ZoomButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        "flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-slate-500",
        "transition-colors hover:border-brand-300 hover:text-brand-700",
      )}
    >
      {children}
    </button>
  );
}

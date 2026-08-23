"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { DataSet } from "vis-data";
import { Timeline } from "vis-timeline/standalone";
import "vis-timeline/styles/vis-timeline-graph2d.min.css";
import { calcolaStatoMisura, STATO_TIMELINE_COLOR, STATO_LABEL, giorniAllaScadenza } from "@/lib/misure/stato";
import { formatValoreMisura, CATEGORIA_LABEL } from "@/lib/misure/valore";

export interface MisuraTimelineItem {
  id: string;
  titolo: string;
  categoria: string;
  dataApertura: string | Date;
  dataScadenza: string | Date;
  tipoValore: "IMPORTO_FISSO" | "RANGE" | "PERCENTUALE";
  importoFisso?: number | string | null;
  importoMin?: number | string | null;
  importoMax?: number | string | null;
  percentuale?: number | string | null;
  tettoMassimo?: number | string | null;
}

export interface TimelineGanttHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  impostaFinestraMesi: (mesi: number) => void;
}

const UN_GIORNO_MS = 1000 * 60 * 60 * 24;

export const TimelineGantt = forwardRef<
  TimelineGanttHandle,
  { misure: MisuraTimelineItem[]; onSelect: (id: string) => void }
>(function TimelineGantt({ misure, onSelect }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<Timeline | null>(null);

  useImperativeHandle(ref, () => ({
    zoomIn: () => timelineRef.current?.zoomIn(0.4),
    zoomOut: () => timelineRef.current?.zoomOut(0.4),
    fit: () => timelineRef.current?.fit({ animation: true }),
    impostaFinestraMesi: (mesi: number) => {
      const oggi = new Date();
      const inizio = new Date(oggi.getTime() - 21 * UN_GIORNO_MS);
      const fine = new Date(oggi.getTime() + mesi * 30 * UN_GIORNO_MS);
      timelineRef.current?.setWindow(inizio, fine, { animation: true });
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const gruppi = new DataSet(
      Object.entries(CATEGORIA_LABEL).map(([id, content], index) => ({ id, content, order: index })),
    );

    const items = new DataSet(
      misure.map((m) => {
        const stato = calcolaStatoMisura(new Date(m.dataApertura), new Date(m.dataScadenza));
        const colore = STATO_TIMELINE_COLOR[stato];
        const giorni = giorniAllaScadenza(new Date(m.dataScadenza));
        const sottotitolo =
          stato === "SCADUTA"
            ? "scaduta"
            : stato === "FUTURA"
              ? "non ancora aperta"
              : `scade tra ${giorni}g`;

        return {
          id: m.id,
          group: m.categoria,
          start: new Date(m.dataApertura),
          end: new Date(m.dataScadenza),
          content: `<span class="truncate">${escapeHtml(m.titolo)}</span>`,
          title: `${m.titolo} · ${STATO_LABEL[stato]} (${sottotitolo}) · ${formatValoreMisura(m)}`,
          style: `background-color:${colore.bg}22; border-color:${colore.bg}; color:${colore.border};`,
        };
      }),
    );

    const options = {
      stack: true,
      horizontalScroll: true,
      zoomKey: "ctrlKey" as const,
      zoomMin: 1000 * 60 * 60 * 24 * 14,
      orientation: { axis: "top" as const },
      margin: { item: { horizontal: 4, vertical: 6 }, axis: 5 },
      showCurrentTime: true,
      tooltip: { followMouse: true },
      groupOrder: "order",
      moveable: true,
      selectable: true,
      start: new Date(Date.now() - 21 * UN_GIORNO_MS),
      end: new Date(Date.now() + 180 * UN_GIORNO_MS),
    };

    const timeline = new Timeline(containerRef.current, items, gruppi, options);
    timeline.on("select", (props) => {
      if (props.items?.[0]) onSelect(props.items[0] as string);
    });
    timelineRef.current = timeline;

    return () => {
      timeline.destroy();
      timelineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [misure]);

  return <div ref={containerRef} className="h-[520px] w-full" />;
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

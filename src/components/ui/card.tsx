import type { HTMLAttributes } from "react";
import clsx from "clsx";

/**
 * Toni "solidi" per Card — usati per stat tile e pannelli in evidenza sullo
 * stile della reference CRM fornita dal team (card scure/pastello sopra la
 * sidebar, card lavanda/verde in evidenza accanto ai contenuti), ricolorati
 * sulla palette MOLO reale invece del nero/lime della reference.
 *
 * Implementati come varianti INTERNE del componente (non come className
 * passata dall'esterno): un bug reale trovato nella pagina pubblica
 * Finanza Agevolata Match — passare `bg-ink` via className su una Card che
 * ha già `bg-white` nelle sue classi base rende l'esito imprevedibile (chi
 * vince dipende dall'ordine nel foglio di stile compilato, non da quello
 * nel markup) — qui il tono è sempre l'UNICA classe bg-* applicata.
 */
type Tono = "chiaro" | "scuro" | "growth" | "navigation" | "ocra" | "brand";

const TONO_CLASSI: Record<Tono, string> = {
  chiaro: "bg-white border border-black/[0.06] text-ink",
  scuro: "bg-ink border border-white/[0.06] text-white",
  growth: "bg-growth-50 border border-growth-500/20 text-ink",
  navigation: "bg-navigation-50 border border-navigation-500/20 text-ink",
  ocra: "bg-ocra-50 border border-ocra-500/25 text-ink",
  brand: "bg-brand-50 border border-brand-500/20 text-ink",
};

export function Card({
  className,
  tono = "chiaro",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tono?: Tono }) {
  return (
    <div
      className={clsx("rounded-3xl shadow-card transition-shadow", TONO_CLASSI[tono], className)}
      {...props}
    />
  );
}

export function CardInteractive({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-black/[0.06] bg-white shadow-card cursor-pointer",
        "transition-[transform,box-shadow,border-color] duration-300 ease-glass",
        "hover:-translate-y-0.5 hover:shadow-card-hover hover:border-brand-200/70",
        className,
      )}
      {...props}
    />
  );
}

/** Superficie "Liquid Glass": per pannelli in evidenza sopra sfondi ricchi (login, header). */
export function CardGlass({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("glass-surface rounded-3xl", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("p-5 pb-3", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("p-5 pt-0", className)} {...props} />;
}

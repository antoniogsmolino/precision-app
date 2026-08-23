import type { HTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-black/[0.06] bg-white shadow-card transition-shadow",
        className,
      )}
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

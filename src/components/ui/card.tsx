import type { HTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-slate-200 bg-white shadow-card transition-shadow",
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
        "rounded-2xl border border-slate-200 bg-white shadow-card transition-all duration-150",
        "hover:shadow-card-hover hover:border-brand-200 cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("p-5 pb-3", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("p-5 pt-0", className)} {...props} />;
}

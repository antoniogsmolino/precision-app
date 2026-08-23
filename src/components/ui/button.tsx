import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "glass";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 hover:shadow-glow active:bg-brand-700 shadow-sm shadow-brand-600/25 focus-visible:ring-brand-400",
  secondary:
    "bg-white text-ink border border-black/[0.08] hover:bg-surface-alt hover:border-black/[0.12] focus-visible:ring-brand-300",
  ghost: "bg-transparent text-ink/60 hover:bg-ink/[0.05] hover:text-ink focus-visible:ring-brand-300",
  danger: "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-400",
  glass:
    "glass-surface text-ink hover:bg-white/80 focus-visible:ring-brand-300 shadow-glass",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(({ className, variant = "primary", size = "md", ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center rounded-full font-medium",
        "transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-glass",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.96]",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
});
Button.displayName = "Button";

import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-strong",
  secondary: "border border-line-strong bg-surface-2 text-ink hover:bg-surface-3",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "border border-critical/50 bg-critical/10 text-critical-ink hover:bg-critical/20",
};
const sizes: Record<Size, string> = { sm: "h-7 px-2.5 text-xs", md: "h-9 px-3.5 text-sm" };

export function buttonClass(variant: Variant = "secondary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({ variant = "secondary", size = "md", className, type = "button", ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant = "secondary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light" | "onDark";
type Size = "md" | "lg" | "cta";

// Square, hairline, quiet. Hover is a considered inversion rather than a colour flash; press nudges 1px.
const base =
  "inline-flex items-center justify-center gap-2.5 font-medium whitespace-nowrap select-none " +
  "border transition-[background-color,color,border-color] duration-[var(--duration-base)] ease-[var(--ease-out)] " +
  "active:translate-y-px motion-reduce:active:translate-y-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "btn-gloss text-ivory border-walnut-dark",
  secondary: "bg-transparent text-walnut border-walnut hover:bg-walnut hover:text-ivory",
  ghost: "bg-transparent text-text border-transparent hover:bg-linen",
  danger: "bg-danger text-ivory border-danger hover:bg-transparent hover:text-danger",
  // For use on dark (walnut) bands
  light: "gloss bg-ivory text-walnut border-ivory hover:bg-ivory/90",
  // Outline for use on dark (wood) bands
  onDark: "bg-transparent text-ivory border-ivory/50 hover:bg-ivory/10 hover:border-ivory",
};

const sizes: Record<Size, string> = {
  md: "min-h-10 px-4 text-sm tracking-[0.01em]",
  lg: "min-h-[var(--touch-target)] px-6 text-base tracking-[0.01em]",
  // Public calls to action: small caps-style label, generous padding.
  cta: "min-h-11 px-6 text-[0.75rem] font-semibold uppercase tracking-[0.12em]",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant, size, className, href, ...props }: ButtonLinkProps) {
  const external = /^(https?:|mailto:|tel:)/.test(href);
  const classes = buttonClasses(variant, size, className);
  return external ? <a href={href} className={classes} {...props} /> : <Link href={href} className={classes} {...props} />;
}

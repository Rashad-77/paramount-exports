import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light" | "onDark";
type Size = "md" | "lg" | "cta";

// Square, hairline, quiet. Hover is a considered inversion rather than a colour flash; pressing does not move the button.
const base =
  "btn inline-flex items-center justify-center gap-2.5 font-medium whitespace-nowrap select-none " +
  "border transition-[background-color,color,border-color] duration-[var(--duration-base)] ease-[var(--ease-out)] " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "btn-solid text-ivory border-transparent",
  secondary: "bg-transparent text-walnut border-walnut enabled:hover:bg-walnut enabled:hover:text-ivory",
  ghost: "bg-transparent text-text border-transparent hover:bg-linen",
  danger: "bg-danger text-ivory border-danger enabled:hover:bg-[color-mix(in_srgb,var(--color-danger)_82%,black)] enabled:hover:border-[color-mix(in_srgb,var(--color-danger)_82%,black)]",
  // For use on dark (walnut) bands
  light: "bg-white text-walnut-dark border-white hover:bg-white/85",
  // Outline for use on dark (wood) bands
  onDark: "bg-white/5 text-ivory border-white/45 hover:bg-white/15 hover:border-white",
};

const sizes: Record<Size, string> = {
  md: "min-h-10 px-4 text-sm tracking-[0.01em]",
  lg: "min-h-[var(--touch-target)] px-6 text-base tracking-[0.01em]",
  // Public calls to action: small tracked capitals, generous padding.
  cta: "min-h-12 rounded-[3px] px-7 text-[0.6875rem] font-semibold uppercase tracking-[0.16em]",
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

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none " +
  "rounded-[var(--radius-md)] border transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-walnut text-ivory border-walnut hover:bg-walnut-dark hover:border-walnut-dark",
  secondary: "bg-transparent text-walnut border-walnut hover:bg-linen",
  ghost: "bg-transparent text-text border-transparent hover:bg-linen",
  danger: "bg-danger text-ivory border-danger hover:brightness-90",
};

const sizes: Record<Size, string> = {
  md: "min-h-10 px-4 text-sm",
  lg: "min-h-[var(--touch-target)] px-6 text-base",
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

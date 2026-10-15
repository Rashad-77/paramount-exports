import type { SVGProps } from "react";

/** The Facebook mark, drawn in the surrounding text colour. */
export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  const { strokeWidth: _strokeWidth, ...rest } = props;
  void _strokeWidth;
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path d="M13.5 22v-8.2h2.8l.5-3.3h-3.3V8.4c0-.9.4-1.7 1.8-1.7h1.6V3.8S15.6 3.5 14.4 3.5c-2.6 0-4.2 1.6-4.2 4.4v2.6H7.4v3.3h2.8V22h3.3z" />
    </svg>
  );
}

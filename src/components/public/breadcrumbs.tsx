import Link from "next/link";

export interface Crumb {
  name: string;
  href: string;
}

/** The trail from the home page to this page ("Home › Collection › Dining tables"), each step a link except the last. Search engines get the same trail as structured data. */
export function Breadcrumbs({ trail, className }: { trail: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={"text-xs text-text-muted " + (className ?? "")}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {trail.map((c, i) => (
          <li key={c.href} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden="true">›</span> : null}
            {i < trail.length - 1 ? (
              <Link href={c.href} className="underline-offset-2 hover:text-text hover:underline">
                {c.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-text">
                {c.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

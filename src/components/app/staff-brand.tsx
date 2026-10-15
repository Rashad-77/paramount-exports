import Image from "next/image";
import Link from "next/link";

/** The business mark and name at the top of the staff area: "Paramount" over "Export Industries", like the website header. */
export function StaffBrand({ name }: { name: string }) {
  const [first = name, ...rest] = name.trim().split(/\s+/);
  return (
    <Link href="/app" className="staff-brand" aria-label={`${name} — dashboard`}>
      <Image src="/logo-mark.png" alt="" width={32} height={32} className="staff-brand-mark" />
      <span className="staff-brand-name">
        <b>{first}</b>
        {rest.length ? <i>{rest.join(" ")}</i> : null}
      </span>
    </Link>
  );
}

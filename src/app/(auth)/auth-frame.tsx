import Image from "next/image";

/** The business mark and name set as in the website header: "Paramount" over "Export Industries" in spaced capitals. */
export function BrandLockup({ name, large, dark, className }: { name: string; large?: boolean; dark?: boolean; className?: string }) {
  const [first = name, ...rest] = name.trim().split(/\s+/);
  return (
    <div role="img" aria-label={name} className={"flex items-center " + (large ? "gap-5 " : "gap-3 ") + (className ?? "")}>
      <Image src="/logo-mark.png" alt="" width={72} height={72} className={(large ? "size-[4.5rem] " : "size-10 ") + "shrink-0 " + (dark ? "" : "invert")} />
      <span className={"flex flex-col leading-tight " + (dark ? "text-walnut" : "text-ivory")}>
        <b className={(large ? "text-[clamp(1.75rem,3vw,2.75rem)] " : "text-lg ") + "font-semibold uppercase tracking-[0.2em]"}>{first}</b>
        {rest.length ? <i className={(large ? "mt-2 text-sm " : "mt-1 text-[0.625rem] ") + "uppercase not-italic tracking-[0.2em] " + (dark ? "text-text-muted" : "text-ivory/70")}>{rest.join(" ")}</i> : null}
      </span>
    </div>
  );
}

/** Split screen: a dark textured brand panel beside the form. */
export function AuthFrame({ name, heading, sub, children }: { name: string; heading: string; sub?: string; children: React.ReactNode }) {
  return (
    <main id="main" className="app-ui grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative isolate hidden bg-walnut-dark overflow-hidden p-14 text-ivory lg:flex lg:flex-col lg:justify-between">
        <p className="eyebrow rise-in relative !text-linen-dark">Owner area</p>
        <div className="relative">
          <BrandLockup name={name} large className="rise-in rise-in-2" />
          <div className="rise-in rise-in-3 mt-8 h-px w-24 bg-brand" />
        </div>
        <div aria-hidden="true" />
      </div>
      <div className="flex items-center justify-center px-[var(--gutter)] py-14">
        <div className="rise-in w-full max-w-sm">
          <BrandLockup name={name} dark className="lg:hidden" />
          <h1 className={"font-display mt-6 text-[2.25rem] leading-tight text-walnut lg:mt-0" + (sub ? "" : " mb-8")}>{heading}</h1>
          {sub ? <p className="mt-2 mb-8 text-sm text-text-muted">{sub}</p> : null}
          {children}
        </div>
      </div>
    </main>
  );
}

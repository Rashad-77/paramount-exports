import { User } from "lucide-react";
import { SiteImage } from "@/components/public/site-image";
import { cn } from "@/lib/cn";

/** The reviewer's profile picture beside their name. A reviewer without an account (or without a picture) shows the plain profile icon. */
export function ReviewAvatar({ src, className }: { src?: string | null; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-linen text-stone", className)}>
      {src ? <SiteImage src={src} alt="" fill sizes="48px" className="object-cover" /> : <User className="size-[55%]" strokeWidth={1.5} />}
    </span>
  );
}

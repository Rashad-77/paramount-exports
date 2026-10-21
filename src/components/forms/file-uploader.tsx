"use client";

import { Paperclip, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useFormState } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/status";

interface Item {
  key: string;
  name: string;
  size: number;
  state: "uploading" | "done" | "error";
  fileId?: string;
  error?: string;
}

interface SignResponse {
  fileId: string;
  maxBytes: number;
  driver: "supabase" | "local";
  bucket: string;
  key: string;
  token?: string;
  url?: string;
  error?: string;
}

/**
 * Sends one file straight to storage and returns the id the form action later verifies and links. Throws an Error with a plain
 * message when the upload cannot start or fails.
 */
export async function uploadToStorage(file: File, purpose: string): Promise<string> {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose, fileName: file.name, contentType: file.type, size: file.size }),
  });
  const s = (await signRes.json()) as SignResponse;
  if (!signRes.ok) throw new Error(s.error ?? "The upload could not be started.");

  if (s.driver === "local") {
    const put = await fetch(s.url!, { method: "PUT", body: file });
    if (!put.ok) throw new Error("The upload failed. Please try again.");
  } else {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error("Uploads are not configured yet.");
    // Loaded only when a file is actually uploaded, so pages with an uploader do not ship the Supabase client up front.
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await supabase.storage.from(s.bucket).uploadToSignedUrl(s.key, s.token!, file, { contentType: file.type });
    if (error) throw new Error("The upload failed. Please try again.");
  }
  return s.fileId;
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

/**
 * Direct-to-storage uploader (files never pass through our server functions, which Vercel limits to ~4.5 MB).
 * Each finished upload adds a hidden input `name=<fileId>`; the form action later verifies and links the files.
 */
export function FileUploader({
  name = "fileIds",
  purpose,
  label,
  hint,
  accept = "image/jpeg,image/png,image/webp",
  maxFiles = 5,
}: {
  name?: string;
  purpose: string;
  label: string;
  hint?: string;
  accept?: string;
  maxFiles?: number;
}) {
  const inputId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const uploading = items.some((i) => i.state === "uploading");
  const { state } = useFormState();

  // Once the form has been saved the files are on the record: the list starts empty again, so they are not sent a second time.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.ok) setItems([]);
  }

  // Tell the surrounding <form> not to submit while a transfer is running.
  const flagForm = (busy: boolean) => {
    const form = root.current?.closest("form");
    if (form) form.dataset.uploading = busy ? "true" : "false";
  };

  const patch = (key: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function uploadOne(file: File, key: string) {
    try {
      patch(key, { state: "done", fileId: await uploadToStorage(file, purpose) });
    } catch (e) {
      patch(key, { state: "error", error: e instanceof Error ? e.message : "The upload failed." });
    }
  }

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    const room = maxFiles - items.filter((i) => i.state !== "error").length;
    const picked = Array.from(files).slice(0, Math.max(room, 0));
    const next: Item[] = picked.map((f, n) => ({ key: `${Date.now()}-${n}-${f.name}`, name: f.name, size: f.size, state: "uploading" }));
    if (files.length > picked.length) {
      next.push({ key: `limit-${Date.now()}`, name: "Extra files", size: 0, state: "error", error: `You can attach up to ${maxFiles} files.` });
    }
    setItems((cur) => [...cur, ...next]);
    flagForm(true);
    await Promise.all(picked.map((f, n) => uploadOne(f, next[n]!.key)));
    flagForm(false);
  }

  return (
    <div ref={root} className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        onChange={(e) => {
          void onPick(e.target.files);
          e.target.value = "";
        }}
        className="peer sr-only"
      />
      {/* Our own button in place of the browser's file chooser (the real input above stays for the picker and for keyboards) */}
      <label
        htmlFor={inputId}
        className="flex min-h-12 cursor-pointer items-center gap-3 border border-dashed border-border-strong bg-surface px-4 py-3 text-sm hover:border-walnut peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
      >
        <Paperclip aria-hidden="true" className="size-4 shrink-0 text-stone" />
        <span className="font-medium">{maxFiles > 1 ? "Choose files" : "Choose a file"}</span>
      </label>
      {hint ? <p className="text-sm text-text-muted">{hint}</p> : null}

      {items.length > 0 ? (
        <ul className="mt-1 space-y-2" aria-label="Attached files">
          {items.map((i) => (
            <li key={i.key} className="flex items-center justify-between gap-3 border border-border bg-surface px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Paperclip aria-hidden="true" className="size-4 shrink-0 text-stone" />
                <span className="truncate">{i.name}</span>
                {i.size ? <span className="shrink-0 text-text-muted">{mb(i.size)}</span> : null}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {i.state === "uploading" ? <span className="text-text-muted">Uploading…</span> : null}
                {i.state === "done" ? <span className="text-success">Attached</span> : null}
                {i.state === "error" ? <span className="text-danger">{i.error}</span> : null}
                <button
                  type="button"
                  onClick={() => setItems((cur) => cur.filter((x) => x.key !== i.key))}
                  aria-label={`Remove ${i.name}`}
                  className="inline-flex size-8 items-center justify-center hover:bg-linen"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </span>
              {i.state === "done" && i.fileId ? <input type="hidden" name={name} value={i.fileId} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div aria-live="polite" className="min-h-0">
        {uploading ? <Alert tone="info">Please wait for the upload to finish before sending the form.</Alert> : null}
      </div>
    </div>
  );
}

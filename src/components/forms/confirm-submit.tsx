"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useFormState } from "./action-form";

/**
 * Button that asks for confirmation before submitting the surrounding <ActionForm>.
 * Use for destructive or financially sensitive actions (archive, cancel, void, adjust…).
 */
export function ConfirmSubmit({
  children,
  title,
  description,
  confirmLabel,
  destructive = true,
  variant = "secondary",
}: {
  children: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const { pending } = useFormState();
  return (
    <span ref={anchor}>
      <Button variant={variant} onClick={() => setOpen(true)} disabled={pending}>
        {children}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        destructive={destructive}
        pending={pending}
        onConfirm={() => {
          setOpen(false);
          anchor.current?.closest("form")?.requestSubmit();
        }}
      />
    </span>
  );
}

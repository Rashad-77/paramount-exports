"use client";

import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import { replyAction } from "@/app/app/messages/actions";
import { ActionForm, FTextArea, SubmitButton, useFormState } from "@/components/forms/action-form";

/** Clears the box once the reply has gone. */
function ClearOnSent({ onSent }: { onSent: () => void }) {
  const { state } = useFormState();
  useEffect(() => {
    if (state.ok) onSent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return null;
}

/** Write an answer to the customer from the site. It goes by email and/or to their account, and marks the enquiry as responded. */
export function ReplyForm({ messageId, to }: { messageId: string; to: string }) {
  const [key, setKey] = useState(0);
  return (
    <ActionForm key={key} action={replyAction}>
      <ClearOnSent onSent={() => setKey((k) => k + 1)} />
      <input type="hidden" name="id" value={messageId} />
      <FTextArea name="body" label="Your reply" rows={5} required maxLength={3000} hint={to} />
      <SubmitButton pendingLabel="Sending…">
        <Send aria-hidden="true" className="size-4" /> Send reply
      </SubmitButton>
    </ActionForm>
  );
}

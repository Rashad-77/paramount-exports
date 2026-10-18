"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

const EditCtx = createContext<{ editing: boolean; selected: Set<string>; setSelected: (s: Set<string>) => void; toggleEditing: () => void } | null>(null);

export const useEdit = () => {
  const c = useContext(EditCtx);
  if (!c) throw new Error("Wrap the list in EditProvider.");
  return c;
};

/** Shares edit mode (tick boxes and bulk actions) between the Edit button in the page header and the list below it. */
export function EditProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return (
    <EditCtx.Provider
      value={{
        editing,
        selected,
        setSelected,
        toggleEditing: () => {
          setEditing((e) => !e);
          setSelected(new Set());
        },
      }}
    >
      {children}
    </EditCtx.Provider>
  );
}

/** The Edit / Done button, placed next to the Add button. */
export function EditToggle() {
  const { editing, toggleEditing } = useEdit();
  return (
    <Button type="button" variant={editing ? "primary" : "secondary"} onClick={toggleEditing}>
      {editing ? "Done" : "Edit"}
    </Button>
  );
}

"use client";

import { useEffect, useState } from "react";

/** The signed, time-stamped anti-spam token, fetched when the form mounts so a cached page never carries a stale one. */
export function useFormToken(): string {
  const [token, setToken] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/api/form-token", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { token: string }) => alive && setToken(j.token))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return token;
}

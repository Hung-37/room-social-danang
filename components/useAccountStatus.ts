"use client";
import { useEffect, useState } from "react";
let pending: Promise<Response> | null = null;
let installed = false;
/** Share only concurrent reads: roles and sessions are never kept in a timed browser cache. */
export async function accountResponse() {
  if (!installed && typeof window !== "undefined") {
    window.addEventListener("account-session-changed", () => {
      pending = null;
    });
    installed = true;
  }
  if (!pending) {
    const request = fetch("/api/auth/me", { cache: "no-store" });
    pending = request;
    void request
      .finally(() => {
        if (pending === request) pending = null;
      })
      .catch(() => undefined);
  }
  return (await pending).clone();
}
export function useAccountStatus() {
  const [authenticated, setAuthenticated] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true,
      generation = 0;
    async function load() {
      const run = ++generation;
      try {
        const r = await accountResponse();
        if (live && run === generation) {
          if (r.ok) setAuthenticated(true);
          else if (r.status === 401) setAuthenticated(false);
        }
      } catch {
        /* Keep the last server-confirmed state on temporary failures. */
      }
    }
    const changed = () => {
      setRevision((v) => v + 1);
      void load();
    };
    const focus = () => void load();
    void load();
    window.addEventListener("account-session-changed", changed);
    window.addEventListener("focus", focus);
    return () => {
      live = false;
      generation++;
      window.removeEventListener("account-session-changed", changed);
      window.removeEventListener("focus", focus);
    };
  }, []);
  return { authenticated, revision };
}

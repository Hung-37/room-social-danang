"use client";
import { useRef } from "react";
export function useSubmissionKey() {
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  return {
    keyFor(payload: unknown) {
      const serialized = JSON.stringify(payload);
      if (!attempt.current || attempt.current.payload !== serialized) {
        const key =
          globalThis.crypto.randomUUID?.() ??
          Array.from(
            globalThis.crypto.getRandomValues(new Uint8Array(16)),
            (v) => v.toString(16).padStart(2, "0"),
          ).join("");
        attempt.current = { payload: serialized, key };
      }
      return attempt.current.key;
    },
    confirmed() {
      attempt.current = null;
    },
  };
}

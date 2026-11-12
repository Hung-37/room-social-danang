"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export type PageMeta = {
  total: number;
  count: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number;
};
export function usePagedResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null),
    [meta, setMeta] = useState<PageMeta | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [statusCode, setStatusCode] = useState<number | null>(null),
    [revision, setRevision] = useState(0);
  const epoch = useRef(0);
  const reload = useCallback(() => {
    epoch.current++;
    setLoading(true);
    setRevision((v) => v + 1);
  }, []);
  useEffect(() => {
    const changed = () => {
      epoch.current++;
      setData(null);
      setMeta(null);
      reload();
    };
    window.addEventListener("account-session-changed", changed);
    return () => window.removeEventListener("account-session-changed", changed);
  }, [reload]);
  useEffect(() => {
    const controller = new AbortController(),
      version = ++epoch.current;
    const current = () =>
      !controller.signal.aborted && version === epoch.current;
    setLoading(true);
    setError("");
    setStatusCode(null);
    let deadline: number | undefined;
    const timer = setTimeout(async () => {
      deadline = window.setTimeout(() => {
        if (current()) {
          setMeta(null);
          setError("Kết nối quá lâu. Vui lòng thử tải lại.");
          setLoading(false);
          controller.abort();
        }
      }, 10000);
      let adjusting = false;
      try {
        const r = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        const p = await r.json();
        if (!current()) return;
        setStatusCode(r.status);
        if (!r.ok) {
          if (r.status === 401 || r.status === 403) setData(null);
          throw new Error(p.error || "Chưa thể tải dữ liệu. Vui lòng thử lại.");
        }
        if (!p.meta || !Number.isSafeInteger(p.meta.total) || p.data == null)
          throw new Error("Phản hồi dữ liệu chưa hợp lệ. Vui lòng thử lại.");
        adjusting = p.meta.offset > 0 && p.meta.offset >= p.meta.total;
        setData(p.data);
        setMeta(p.meta);
      } catch (e) {
        if (current()) {
          setMeta(null);
          setError(
            e instanceof TypeError || e instanceof SyntaxError
              ? "Mất kết nối hoặc dữ liệu chưa hợp lệ. Vui lòng thử tải lại."
              : e instanceof Error
                ? e.message
                : "Chưa thể kết nối. Vui lòng thử lại.",
          );
        }
      } finally {
        window.clearTimeout(deadline);
        if (current()) setLoading(adjusting);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      window.clearTimeout(deadline);
      controller.abort();
    };
  }, [url, revision]);
  return { data, meta, loading, error, statusCode, reload };
}

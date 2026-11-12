"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
type Item = {
  id: number;
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  createdAt: string;
};
export default function Notifications() {
  const [rows, setRows] = useState<Item[]>([]),
    [unreadCount, setUnreadCount] = useState(0),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [notice, setNotice] = useState(""),
    [guest, setGuest] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const mounted = useRef(true);
  const writing = useRef(false);
  const writeController = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("notifications-updated", refresh);
    return () => {
      mounted.current = false;
      writeController.current?.abort();
      window.removeEventListener("notifications-updated", refresh);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    fetch("/api/notifications", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          if (response.status === 401) setGuest(true);
          throw new Error(payload.error || "Chưa thể tải thông báo.");
        }
        setGuest(false);
        setRows(payload.data);
        setUnreadCount(
          payload.meta?.unreadCount ??
            payload.data.filter((item: Item) => !item.isRead).length,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLoadError("Chưa thể tải thông báo. Vui lòng thử lại.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  async function read() {
    if (writing.current || loading || loadError || unreadCount === 0) return;
    const controller = new AbortController();
    writeController.current = controller;
    writing.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error("Chưa thể đánh dấu đã đọc. Vui lòng thử lại.");
      if (mounted.current && !controller.signal.aborted) {
        setRows((current) =>
          current.map((item) => ({ ...item, isRead: true })),
        );
        setUnreadCount(0);
        setNotice("Đã đánh dấu tất cả thông báo là đã đọc.");
        window.dispatchEvent(new Event("notifications-updated"));
      }
    } catch {
      if (mounted.current && !controller.signal.aborted)
        setError(
          "Chưa thể đánh dấu đã đọc. Vui lòng kiểm tra kết nối và thử lại.",
        );
    } finally {
      writing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function change(item: Item, remove: boolean) {
    if (writing.current || loading) return;
    if (
      remove &&
      !window.confirm(
        "Xóa thông báo này? Thao tác không xóa bài viết hoặc tin nhắn liên quan.",
      )
    )
      return;
    const controller = new AbortController();
    writeController.current = controller;
    writing.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/notifications/" + item.id, {
        method: remove ? "DELETE" : "PATCH",
        signal: controller.signal,
      });
      if (!r.ok) {
        if (r.status === 404)
          window.dispatchEvent(new Event("notifications-updated"));
        throw new Error();
      }
      if (mounted.current && !controller.signal.aborted) {
        setRows((current) =>
          remove
            ? current.filter((row) => row.id !== item.id)
            : current.map((row) =>
                row.id === item.id ? { ...row, isRead: true } : row,
              ),
        );
        if (!item.isRead) setUnreadCount((v) => Math.max(0, v - 1));
        setNotice(
          remove ? "Đã xóa thông báo." : "Đã đánh dấu thông báo là đã đọc.",
        );
        window.dispatchEvent(new Event("notifications-updated"));
      }
    } catch {
      if (mounted.current && !controller.signal.aborted)
        setError("Chưa thể cập nhật thông báo. Vui lòng thử lại.");
    } finally {
      writing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return guest ? (
    <Link href="/dang-nhap?next=%2Fthong-bao" className="primary-btn">
      Đăng nhập để xem thông báo
    </Link>
  ) : (
    <>
      <button
        className="secondary-btn"
        disabled={loading || busy || Boolean(loadError) || unreadCount === 0}
        onClick={read}
      >
        {busy ? "Đang cập nhật..." : "Đánh dấu tất cả đã đọc"}
      </button>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loading ? (
        <p role="status">Đang tải...</p>
      ) : loadError ? (
        <div role="alert">
          <p>{loadError}</p>
          <button
            className="secondary-btn"
            onClick={() => setRevision((value) => value + 1)}
          >
            Thử lại
          </button>
        </div>
      ) : !rows.length ? (
        <p>Chưa có thông báo mới.</p>
      ) : (
        rows.map((item) => (
          <article key={item.id} className="management-card">
            <Link
              className="text-link"
              href={
                item.href?.startsWith("/") && !item.href.startsWith("//")
                  ? item.href
                  : "/profile"
              }
            >
              {item.title}
              {!item.isRead ? " · Chưa đọc" : ""}
            </Link>
            <div className="management-actions">
              {!item.isRead && (
                <button
                  className="text-button"
                  disabled={busy || loading}
                  aria-label={"Đánh dấu đã đọc: " + item.title}
                  onClick={() => void change(item, false)}
                >
                  Đánh dấu đã đọc
                </button>
              )}
              <button
                className="text-button"
                disabled={busy || loading}
                aria-label={"Xóa thông báo: " + item.title}
                onClick={() => void change(item, true)}
              >
                Xóa thông báo
              </button>
            </div>
            <p>{item.body}</p>
            <time dateTime={item.createdAt}>
              {new Date(item.createdAt).toLocaleString("vi-VN")}
            </time>
          </article>
        ))
      )}
    </>
  );
}

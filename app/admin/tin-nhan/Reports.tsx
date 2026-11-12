"use client";
import { useEffect, useRef, useState } from "react";
type Report = { id: string; reporter: string; reason: string; status: string };
export default function Reports() {
  const [rows, setRows] = useState<Report[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const generation = useRef(0);
  async function load() {
    const run = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/admin/chat-reports", { cache: "no-store" });
      const p = await r.json();
      if (!r.ok || !Array.isArray(p.data)) throw new Error();
      if (run === generation.current) setRows(p.data);
    } catch {
      if (run === generation.current)
        setError("Chưa thể tải báo cáo. Vui lòng thử lại.");
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, []);
  async function update(id: string, status: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/chat-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!r.ok) throw new Error();
      await load();
    } catch {
      setError("Chưa thể cập nhật. Báo cáo vẫn được giữ để thử lại.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {loading && <p role="status">Đang tải báo cáo…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            className="secondary-btn"
            disabled={busy || loading}
            onClick={() => void load()}
          >
            Thử tải lại báo cáo
          </button>
        </div>
      )}
      {!loading && !error && !rows.length && <p>Chưa có báo cáo.</p>}
      <div className="management-grid" aria-busy={loading}>
        {rows.map((r) => (
          <article className="management-card" key={r.id}>
            <h2>{r.reporter}</h2>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {r.reason}
            </p>
            <p>
              {r.status === "pending"
                ? "Chờ xử lý"
                : r.status === "resolved"
                  ? "Đã xử lý"
                  : "Đã bỏ qua"}
            </p>
            {r.status === "pending" && (
              <div className="inline-actions">
                <button
                  className="primary-btn"
                  disabled={busy || loading || Boolean(error)}
                  onClick={() => void update(r.id, "resolved")}
                >
                  Đã xử lý
                </button>
                <button
                  className="secondary-btn"
                  disabled={busy || loading || Boolean(error)}
                  onClick={() => void update(r.id, "dismissed")}
                >
                  Bỏ qua
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

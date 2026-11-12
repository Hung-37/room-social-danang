"use client";
import { useEffect, useRef, useState } from "react";
import { usePagedResource } from "@/components/usePagedResource";
import ManagementPager from "@/components/ManagementPager";
type Landlord = { id: string; name: string; email: string; status: string };
const labels: Record<string, string> = {
  pending: "Chờ xác minh",
  verified: "Đã xác minh",
  rejected: "Đã từ chối",
};
export default function LandlordReview() {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [offset, setOffset] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const params = new URLSearchParams({
    limit: "20",
    offset: String(offset),
    q: query,
    status,
  });
  const { data, meta, loading, error, reload } = usePagedResource<Landlord[]>(
    "/api/admin/landlords?" + params,
  );
  const items = data ?? [];
  useEffect(() => {
    if (meta && offset > 0 && offset >= meta.total)
      setOffset(Math.max(0, Math.floor((meta.total - 1) / 20) * 20));
  }, [meta, offset]);
  function page(next: number) {
    setOffset(next);
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: "start" });
  }
  async function review(id: string, status: string) {
    if (busy || loading || error) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/landlords", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error || "Không thể xác minh.");
      setMessage("Đã lưu kết quả xác minh.");
      reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không thể xác minh.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="management-filters">
        <label>
          Tìm chủ trọ
          <input
            type="search"
            value={query}
            maxLength={100}
            disabled={busy}
            placeholder="Tên hoặc email chủ trọ..."
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label>
          Trạng thái xác minh
          <select
            aria-label="Trạng thái xác minh"
            value={status}
            disabled={busy}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xác minh</option>
            <option value="verified">Đã xác minh</option>
            <option value="rejected">Đã từ chối</option>
          </select>
        </label>
        {(query || status) && (
          <button
            className="secondary-btn"
            disabled={busy}
            onClick={() => {
              setQuery("");
              setStatus("");
              setOffset(0);
            }}
          >
            Bỏ bộ lọc
          </button>
        )}
      </div>
      <h2 ref={heading} tabIndex={-1}>
        Danh sách chủ trọ
      </h2>
      {!loading && !error && (
        <ManagementPager
          meta={meta}
          disabled={busy}
          label="chủ trọ"
          position="đầu"
          onPage={page}
        />
      )}
      {message && <p role="status">{message}</p>}
      {loading && <p role="status">Đang tải danh sách chủ trọ…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            className="secondary-btn"
            disabled={busy || loading}
            onClick={reload}
          >
            Thử tải lại danh sách chủ trọ
          </button>
        </div>
      )}
      {!loading && !error && !items.length && (
        <p>
          {query || status
            ? "Không có chủ trọ phù hợp. Hãy thử từ khóa khác hoặc bỏ bộ lọc."
            : "Chưa có tài khoản chủ trọ."}
        </p>
      )}
      <div className="management-grid">
        {!loading &&
          !error &&
          items.map((u) => (
            <article className="management-card" key={u.id}>
              <h3>{u.name}</h3>
              <p>{u.email}</p>
              <p>{labels[u.status] || u.status}</p>
              <div className="management-actions">
                <button
                  className="primary-btn"
                  disabled={
                    busy || loading || Boolean(error) || u.status === "verified"
                  }
                  onClick={() => void review(u.id, "verified")}
                >
                  Xác minh
                </button>
                <button
                  className="secondary-btn"
                  disabled={
                    busy || loading || Boolean(error) || u.status === "rejected"
                  }
                  onClick={() => void review(u.id, "rejected")}
                >
                  Từ chối / Thu hồi
                </button>
              </div>
            </article>
          ))}
      </div>
      {!loading && !error && items.length > 0 && (
        <ManagementPager
          meta={meta}
          disabled={busy}
          label="chủ trọ"
          position="cuối"
          onPage={page}
        />
      )}
    </>
  );
}

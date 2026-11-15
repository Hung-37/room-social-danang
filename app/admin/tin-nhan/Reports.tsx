"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ReportStatus = "pending" | "resolved" | "dismissed";
type Report = {
  id: string;
  conversationId: string;
  reporter: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
};
type Filter = "pending" | "resolved" | "dismissed" | "all";

const filters: { value: Filter; label: string }[] = [
  { value: "pending", label: "Chờ xử lý" },
  { value: "resolved", label: "Đã xử lý" },
  { value: "dismissed", label: "Đã bỏ qua" },
  { value: "all", label: "Tất cả" },
];

const statusLabels: Record<ReportStatus, string> = {
  pending: "Cần xem xét",
  resolved: "Đã xử lý",
  dismissed: "Đã bỏ qua",
};

function formatReportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Thời gian chưa xác định"
    : date.toLocaleString("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      });
}

export default function Reports() {
  const [rows, setRows] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const generation = useRef(0);

  async function load() {
    const run = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/chat-reports", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.data))
        throw new Error(payload.error || "Chưa thể tải báo cáo.");
      if (run === generation.current) setRows(payload.data);
    } catch (cause) {
      if (run === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Chưa thể tải báo cáo. Vui lòng thử lại.",
        );
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

  async function update(id: string, status: Exclude<ReportStatus, "pending">) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/chat-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(payload?.error || "Chưa thể cập nhật báo cáo.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Chưa thể cập nhật. Báo cáo vẫn được giữ để thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(
    () => ({
      pending: rows.filter((row) => row.status === "pending").length,
      resolved: rows.filter((row) => row.status === "resolved").length,
      dismissed: rows.filter((row) => row.status === "dismissed").length,
    }),
    [rows],
  );
  const visibleRows = rows.filter((row) => {
    const matchesStatus = filter === "all" || row.status === filter;
    const searchable = `${row.reporter} ${row.reason}`.toLocaleLowerCase("vi-VN");
    return matchesStatus && searchable.includes(query.trim().toLocaleLowerCase("vi-VN"));
  });

  return (
    <section className="chat-reports" aria-busy={loading || busy}>
      <div className="chat-report-summary" aria-label="Thống kê báo cáo">
        <div className="chat-report-stat is-pending">
          <span>Chờ xem xét</span>
          <strong>{counts.pending}</strong>
        </div>
        <div className="chat-report-stat is-resolved">
          <span>Đã xử lý</span>
          <strong>{counts.resolved}</strong>
        </div>
        <div className="chat-report-stat is-dismissed">
          <span>Đã bỏ qua</span>
          <strong>{counts.dismissed}</strong>
        </div>
      </div>

      <div className="chat-report-toolbar">
        <label>
          Tìm theo người báo cáo hoặc lý do
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nhập tên hoặc từ khóa..."
          />
        </label>
        <div className="chat-report-filters" role="group" aria-label="Lọc báo cáo">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              className={filter === item.value ? "is-active" : ""}
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
              {item.value !== "all" && (
                <span>{counts[item.value]}</span>
              )}
            </button>
          ))}
        </div>
        <button
          className="secondary-btn"
          disabled={loading || busy}
          onClick={() => void load()}
        >
          Tải lại
        </button>
      </div>

      {loading && (
        <p className="chat-report-feedback" role="status">
          Đang tải báo cáo...
        </p>
      )}
      {error && (
        <div className="chat-report-error" role="alert">
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
      {!loading && !error && !visibleRows.length && (
        <div className="chat-report-empty">
          <span aria-hidden="true">✓</span>
          <h2>
            {query
              ? "Không tìm thấy báo cáo phù hợp"
              : filter === "pending"
                ? "Không có báo cáo cần xử lý"
                : "Chưa có báo cáo trong mục này"}
          </h2>
          <p>
            {query
              ? "Hãy thử từ khóa khác hoặc đổi bộ lọc trạng thái."
              : "Các báo cáo mới sẽ xuất hiện tại đây để đội ngũ xem xét."}
          </p>
        </div>
      )}

      <div className="chat-report-list">
        {visibleRows.map((report) => (
          <article className="chat-report-card" key={report.id}>
            <div className="chat-report-card-head">
              <span className={`chat-report-status is-${report.status}`}>
                {statusLabels[report.status]}
              </span>
              <div>
                <time dateTime={report.createdAt}>
                  {formatReportDate(report.createdAt)}
                </time>
                <span className="chat-report-reference">
                  Mã hội thoại · {report.conversationId.slice(-8)}
                </span>
              </div>
            </div>
            <div className="chat-report-reason">
              <span>Lý do được gửi</span>
              <p>{report.reason}</p>
            </div>
            <div className="chat-report-reporter">
              <span aria-hidden="true">
                {(report.reporter.trim().slice(0, 1) || "T").toLocaleUpperCase(
                  "vi-VN",
                )}
              </span>
              <div>
                <small>Người gửi báo cáo</small>
                <strong>{report.reporter}</strong>
              </div>
            </div>
            {report.status === "pending" && (
              <div className="chat-report-actions">
                <button
                  className="primary-btn"
                  disabled={busy || loading}
                  onClick={() => void update(report.id, "resolved")}
                >
                  Đánh dấu đã xử lý
                </button>
                <button
                  className="secondary-btn"
                  disabled={busy || loading}
                  onClick={() => void update(report.id, "dismissed")}
                >
                  Bỏ qua báo cáo
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="chat-report-privacy">
        Báo cáo chỉ hiển thị lý do do người tham gia gửi; nội dung hội thoại
        riêng tư không được mở trong trang này.
      </p>
    </section>
  );
}

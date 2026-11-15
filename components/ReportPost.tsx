"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

const reasons = [
  { value: "spam", label: "Spam hoặc nội dung quảng cáo" },
  { value: "scam", label: "Có dấu hiệu lừa đảo" },
  { value: "harassment", label: "Quấy rối hoặc nội dung không phù hợp" },
  { value: "wrong_information", label: "Thông tin sai lệch" },
  { value: "other", label: "Lý do khác" },
];

export default function ReportPost({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitted) return;

    setBusy(true);
    setError("");
    setLoginRequired(false);
    try {
      const response = await fetch(
        `/api/community/posts/${encodeURIComponent(postId)}/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, details }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (response.status === 401) {
        setLoginRequired(true);
        return;
      }
      if (!response.ok)
        throw new Error(payload?.error || "Chưa thể gửi báo cáo.");
      setSubmitted(true);
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Chưa thể gửi báo cáo. Vui lòng thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="post-report">
      {submitted ? (
        <p className="post-report-success" role="status">
          Đã gửi báo cáo. Cảm ơn bạn đã giúp cộng đồng an toàn hơn.
        </p>
      ) : (
        <>
          <button
            type="button"
            className="post-report-trigger"
            aria-expanded={open}
            onClick={() => {
              setOpen((value) => !value);
              setError("");
              setLoginRequired(false);
            }}
          >
            Báo cáo bài đăng
          </button>
          {open && (
            <form className="post-report-form" onSubmit={submit}>
              <div>
                <h3>Báo cáo nội dung</h3>
                <p>
                  Chọn lý do cụ thể để đội ngũ có thể kiểm tra chính xác hơn.
                </p>
              </div>
              <label htmlFor={`report-reason-${postId}`}>Lý do báo cáo</label>
              <select
                id={`report-reason-${postId}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
              >
                <option value="">Chọn lý do</option>
                {reasons.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <label htmlFor={`report-details-${postId}`}>
                Thông tin bổ sung <span>(không bắt buộc)</span>
              </label>
              <textarea
                id={`report-details-${postId}`}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Mô tả ngắn gọn điều cần kiểm tra"
              />
              <div className="post-report-actions">
                <button className="primary-btn" disabled={busy || !reason}>
                  {busy ? "Đang gửi..." : "Gửi báo cáo"}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Hủy
                </button>
              </div>
              {loginRequired && (
                <p className="feedback feedback-error" role="alert">
                  Bạn cần đăng nhập để gửi báo cáo.{" "}
                  <Link
                    href={`/dang-nhap?next=${encodeURIComponent(`/bai/${postId}`)}`}
                  >
                    Đăng nhập
                  </Link>
                </p>
              )}
              {error && (
                <p className="feedback feedback-error" role="alert">
                  {error}
                </p>
              )}
            </form>
          )}
        </>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { assessPageResponse } from "@/lib/page-protections.js";

export default function PageProtectionReview() {
  const [result, setResult] = useState<ReturnType<typeof assessPageResponse>>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    setBusy(true);
    setResult(undefined);
    setError("");
    try {
      const response = await fetch("/", { cache: "no-store", credentials: "omit", redirect: "error" });
      setResult(assessPageResponse(response));
    } catch {
      setError("Chưa đọc được phản hồi trang chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }
  return <section>
    <h2>Bảo vệ trình duyệt trên trang chủ</h2>
    <p>Mỗi tiêu chí đạt được tính một điểm từ phản hồi HTTP hiện tại.</p>
    <button className="secondary-btn" disabled={busy} onClick={check}>{busy ? "Đang kiểm tra…" : "Kiểm tra trang chủ"}</button>
    {error && <p role="alert">{error}</p>}
    {result && <><p role="status">Đạt {result.score}/{result.checks.length} tiêu chí.</p>
      <ul>{result.checks.map(item => <li key={item.label}>{item.label} · {item.pass ? "Đạt" : "Chưa đạt"}</li>)}</ul></>}
  </section>;
}

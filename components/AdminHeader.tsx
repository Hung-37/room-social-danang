"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminHeader() {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/logout", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error();
      window.dispatchEvent(new Event("account-session-changed"));
      router.replace("/dang-nhap");
      router.refresh();
    } catch {
      setError("Chưa thể đăng xuất. Vui lòng thử lại.");
      setBusy(false);
    }
  }

  return (
    <header className="admin-topbar">
      <div className="container admin-topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">R</span>
          <span>
            Room<span>ĐàNẵng</span>
          </span>
          <span className="admin-badge">Quản trị</span>
        </Link>
        <nav className="admin-nav-links">
          <Link href="/admin">Tổng quan</Link>
          <Link href="/admin?tab=listings">Tin cần duyệt</Link>
          <Link href="/admin/chu-tro">Xác minh chủ trọ</Link>
          <Link href="/admin/nguoi-dung">Người dùng</Link>
          <Link href="/admin/cau-hinh">Cấu hình</Link>
          <Link href="/admin/tin-nhan">Báo cáo tin nhắn</Link>
        </nav>
        <div className="admin-header-actions">
          <Link href="/" className="secondary-btn">
            ← Về trang chủ
          </Link>
          <button
            type="button"
            className="secondary-btn"
            disabled={busy}
            onClick={() => void logout()}
          >
            {busy ? "Đang đăng xuất…" : "Đăng xuất Admin"}
          </button>
        </div>
      </div>
      {error && (
        <p className="container feedback feedback-error" role="alert">
          {error}
        </p>
      )}
    </header>
  );
}

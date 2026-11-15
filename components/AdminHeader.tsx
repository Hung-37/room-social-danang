"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const navItems: { href: string; label: string; tab?: string }[] = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin?tab=listings", label: "Tin cần duyệt", tab: "listings" },
  { href: "/admin?tab=reports", label: "Báo cáo bài viết", tab: "reports" },
  { href: "/admin/chu-tro", label: "Xác minh chủ trọ" },
  { href: "/admin/nguoi-dung", label: "Người dùng" },
  { href: "/admin/cau-hinh", label: "Cấu hình" },
  { href: "/admin/tin-nhan", label: "Báo cáo tin nhắn" },
];

export default function AdminHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showMobileNav, setShowMobileNav] = useState(false);
  const selectedTab = searchParams.get("tab");
  function isActive(item: (typeof navItems)[number]) {
    if (item.tab) return pathname === "/admin" && selectedTab === item.tab;
    if (item.href === "/admin")
      return (
        pathname === "/admin" &&
        selectedTab !== "listings" &&
        selectedTab !== "reports"
      );
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

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
        <Link href="/" className="brand" aria-label="Về trang chủ">
          <span className="brand-mark">R</span>
          <span>
            Room<span>ĐàNẵng</span>
          </span>
          <span className="admin-badge">Quản trị</span>
        </Link>

        <nav className="admin-nav-links" aria-label="Điều hướng quản trị">
          {navItems.map((item) => {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item) ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="admin-header-actions">
          <button
            type="button"
            className="admin-menu-toggle"
            aria-label={showMobileNav ? "Đóng menu" : "Mở menu"}
            aria-expanded={showMobileNav}
            aria-controls="admin-mobile-navigation"
            onClick={() => setShowMobileNav((value) => !value)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
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

      {showMobileNav && (
        <nav
          id="admin-mobile-navigation"
          className="admin-mobile-nav"
          aria-label="Menu quản trị trên điện thoại"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setShowMobileNav(false)}
              aria-current={isActive(item) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/" onClick={() => setShowMobileNav(false)}>
            Về trang chủ
          </Link>
        </nav>
      )}

      {error && (
        <p className="container feedback feedback-error" role="alert">
          {error}
        </p>
      )}
    </header>
  );
}

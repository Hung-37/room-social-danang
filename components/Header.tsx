"use client";

import Link from "next/link";
import { accountResponse } from "./useAccountStatus";
import { useState, useEffect, useRef } from "react";
import { signOut } from "@/lib/client-session";
import { useRouter, usePathname } from "next/navigation";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [siteName, setSiteName] = useState("RoomĐàNẵng");
  useEffect(() => {
    fetch("/api/site/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p?.data?.siteName) setSiteName(p.data.siteName);
      })
      .catch(() => undefined);
  }, []);
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    role?: "student" | "landlord" | "admin";
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{
      id: number;
      title: string;
      body: string;
      href?: string | null;
      isRead: boolean;
      createdAt: string;
    }>
  >([]);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    let generation = 0;
    async function loadSession() {
      const run = ++generation;
      let serverAuthenticated = false;
      try {
        const response = await accountResponse();
        if (!response.ok && response.status !== 401)
          throw new Error("Session unavailable");
        if (mounted && generation === run) setSessionError("");
        const payload = response.ok
          ? ((await response.json()) as {
              data?: {
                name: string;
                email?: string;
                role?: "student" | "landlord" | "admin";
              };
            })
          : null;
        if (mounted && generation === run && payload?.data) {
          serverAuthenticated = true;
          setAuthenticated(true);
          setCurrentUser({ name: payload.data.name, role: payload.data.role });
        } else if (mounted && generation === run) {
          // A successful server response is authoritative; stale local storage is not a session.
          setAuthenticated(false);
          setCurrentUser(null);
          setNotifications([]);
          setUnreadCount(0);
        }
      } catch {
        if (mounted && generation === run) {
          setSessionError("Chưa kết nối được tài khoản. Vui lòng thử lại.");
        }
      } finally {
        if (mounted && generation === run) setLoading(false);
      }
      if (mounted && generation === run && serverAuthenticated) {
        fetch("/api/notifications")
          .then((response) => (response.ok ? response.json() : null))
          .then((payload) => {
            if (mounted && generation === run && payload?.data) {
              setNotifications(payload.data);
              setUnreadCount(
                payload.meta?.unreadCount ??
                  payload.data.filter((n: { isRead: boolean }) => !n.isRead)
                    .length,
              );
            }
          })
          .catch(() => undefined);
      }
    }
    loadSession();
    const refresh = () => void loadSession();
    window.addEventListener("account-session-changed", refresh);
    window.addEventListener("session-retry", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("profile-updated", refresh);
    window.addEventListener("notifications-updated", refresh);
    return () => {
      window.removeEventListener("account-session-changed", refresh);
      window.removeEventListener("session-retry", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("profile-updated", refresh);
      window.removeEventListener("notifications-updated", refresh);
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (document.getElementById("mobile-navigation"))
          menuToggleRef.current?.focus();
        setShowMobileNav(false);
        setShowProfileMenu(false);
        setShowNotifications(false);
      }
    }
    document.addEventListener("keydown", escape);
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  async function handleLogout() {
    try {
      await signOut();
    } catch {
      setSessionError("Chưa thể đăng xuất. Hãy kiểm tra kết nối và thử lại.");
      return;
    }
    setAuthenticated(false);
    setCurrentUser(null);
    setShowProfileMenu(false);
    setShowMobileNav(false);
    router.push("/");
  }

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">R</span>
          <span>{siteName}</span>
        </Link>
        <nav className="nav-links" aria-label="Điều hướng chính">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
            Trang chủ
          </Link>
          <Link
            href="/bang-tin"
            aria-current={pathname.startsWith("/bang-tin") ? "page" : undefined}
          >
            Tìm phòng
          </Link>
          <Link
            href="/thao-luan"
            aria-current={
              pathname.startsWith("/thao-luan") ? "page" : undefined
            }
          >
            Thảo luận
          </Link>
          <Link
            href="/khu-vuc"
            aria-current={
              pathname.startsWith("/khu-vuc") ||
              pathname === "/cum" ||
              pathname.startsWith("/cum/")
                ? "page"
                : undefined
            }
          >
            Khu vực
          </Link>
        </nav>
        <div className="header-actions">
          <button
            ref={menuToggleRef}
            className={`mobile-menu-btn ${showMobileNav ? "is-open" : ""}`}
            aria-label={showMobileNav ? "Đóng menu" : "Mở menu"}
            aria-expanded={showMobileNav}
            aria-controls="mobile-navigation"
            onClick={() => setShowMobileNav((value) => !value)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          {authenticated && (
            <div className="notification-wrapper" ref={notificationRef}>
              <button
                className="icon-btn notification-btn"
                aria-label={`Thông báo, ${unreadCount} chưa đọc`}
                title="Thông báo"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  fetch("/api/notifications", { cache: "no-store" })
                    .then((r) => (r.ok ? r.json() : null))
                    .then((p) => {
                      if (p?.data) {
                        setNotifications(p.data);
                        setUnreadCount(
                          p.meta?.unreadCount ??
                            p.data.filter((n: { isRead: boolean }) => !n.isRead)
                              .length,
                        );
                      }
                    })
                    .catch(() => {});
                }}
              >
                🔔
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </button>
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <strong>Thông báo</strong>
                    <button
                      className="mark-read-btn"
                      onClick={async () => {
                        try {
                          const response = await fetch("/api/notifications", {
                            method: "PATCH",
                          });
                          if (!response.ok) throw new Error();
                          setNotifications((items) =>
                            items.map((item) => ({ ...item, isRead: true })),
                          );
                          setUnreadCount(0);
                          window.dispatchEvent(
                            new Event("notifications-updated"),
                          );
                        } catch {
                          setSessionError(
                            "Chưa thể đánh dấu thông báo. Vui lòng thử lại.",
                          );
                        }
                      }}
                    >
                      Đánh dấu đã đọc
                    </button>
                  </div>
                  <div className="notification-list">
                    {notifications.length ? (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`notification-item ${!notif.isRead ? "unread" : ""}`}
                        >
                          <p>
                            <Link
                              href={
                                notif.href?.startsWith("/") &&
                                !notif.href.startsWith("//")
                                  ? notif.href
                                  : "/profile"
                              }
                              onClick={() => setShowNotifications(false)}
                            >
                              {notif.title}
                            </Link>
                            {notif.body ? ` · ${notif.body}` : ""}
                          </p>
                          <span className="notification-time">
                            {new Date(notif.createdAt).toLocaleString("vi-VN")}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="notification-empty">
                        Chưa có thông báo mới.
                      </p>
                    )}
                  </div>
                  <Link href="/tin-nhan">Tin nhắn riêng</Link>
                  <Link href="/thong-bao" className="notification-footer">
                    Xem tất cả thông báo
                  </Link>
                </div>
              )}
            </div>
          )}
          {loading ? (
            <div className="header-loading">
              <span className="loading-spinner-sm"></span>
            </div>
          ) : authenticated ? (
            <div className="profile-menu-wrapper" ref={profileMenuRef}>
              <button
                aria-expanded={showProfileMenu}
                aria-controls="profile-navigation"
                aria-label={`Tài khoản của ${currentUser?.name || "bạn"}`}
                className="profile-chip authenticated"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <span aria-hidden="true">👤</span>
                <span>{currentUser?.name || "Người dùng"}</span>
                <span className="dropdown-arrow">▼</span>
              </button>
              {showProfileMenu && (
                <div id="profile-navigation" className="profile-dropdown">
                  <Link
                    href="/quy-dinh"
                    onClick={() => setShowMobileNav(false)}
                  >
                    Quy định sử dụng
                  </Link>
                  <Link
                    href="/tin-nhan"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    Tin nhắn riêng
                  </Link>
                  <Link
                    href="/profile"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <span aria-hidden="true">👤</span> Hồ sơ của tôi
                  </Link>
                  {currentUser?.role === "landlord" && (
                    <Link
                      href="/quan-ly-phong"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      Quản lý phòng
                    </Link>
                  )}
                  <Link
                    href="/profile?tab=settings"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <span aria-hidden="true">⚙️</span> Cài đặt
                  </Link>
                  <button onClick={handleLogout}>
                    <span aria-hidden="true">🚪</span> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/dang-nhap" className="profile-chip">
              <span aria-hidden="true">👤</span> Đăng nhập
            </Link>
          )}
        </div>
      </div>
      {sessionError && (
        <div className="container feedback feedback-error" role="alert">
          {sessionError}{" "}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.dispatchEvent(new Event("session-retry"))}
          >
            Thử lại
          </button>
        </div>
      )}
      {showMobileNav && (
        <nav
          id="mobile-navigation"
          className="mobile-nav"
          aria-label="Điều hướng trên điện thoại"
        >
          <Link href="/quy-dinh" onClick={() => setShowMobileNav(false)}>
            Quy định sử dụng
          </Link>
          <Link href="/tin-nhan" onClick={() => setShowMobileNav(false)}>
            Tin nhắn riêng
          </Link>
          <Link href="/" onClick={() => setShowMobileNav(false)}>
            Trang chủ <span>⌂</span>
          </Link>
          <Link href="/khu-vuc" onClick={() => setShowMobileNav(false)}>
            Cụm sinh viên <span>⌖</span>
          </Link>
          <Link href="/bang-tin" onClick={() => setShowMobileNav(false)}>
            Tìm phòng <span>▤</span>
          </Link>
          <Link href="/thao-luan" onClick={() => setShowMobileNav(false)}>
            Thảo luận <span>↗</span>
          </Link>
          {authenticated ? (
            <>
              <Link
                href="/bai-viet-cua-toi"
                onClick={() => setShowMobileNav(false)}
              >
                Bài viết của tôi
              </Link>
              <Link href="/profile" onClick={() => setShowMobileNav(false)}>
                Tài khoản của tôi <span>↗</span>
              </Link>
              {currentUser?.role === "landlord" && (
                <Link
                  href="/quan-ly-phong"
                  onClick={() => setShowMobileNav(false)}
                >
                  Quản lý phòng <span>↗</span>
                </Link>
              )}
              <button className="mobile-logout" onClick={handleLogout}>
                Đăng xuất
              </button>
            </>
          ) : (
            <Link href="/dang-nhap" onClick={() => setShowMobileNav(false)}>
              Đăng nhập / Đăng ký <span>＋</span>
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}

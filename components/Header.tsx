"use client";

import Link from "next/link";
import { accountResponse } from "./useAccountStatus";
import { useState, useEffect, useRef } from "react";
import { signOut } from "@/lib/client/client-session";
import { useRouter, usePathname } from "next/navigation";
import { useLoginModal } from "./LoginModalProvider";
import { useToast } from "./Toast";

const headerPaths = {
  home: "m3 11 9-8 9 8v10h-6v-7H9v7H3V11Z",
  search: "m21 21-4.5-4.5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  message: "M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4ZM8 10h8m-8 4h5",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
  chevron: "m6 9 6 6 6-6",
  document: "M6 3h9l4 4v14H6V3Zm8 0v5h5M9 12h7m-7 4h7",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6",
  logout: "M9 3H4v18h5m7-15 6 6-6 6M9 12h13",
};
function HeaderIcon({ name }: { name: keyof typeof headerPaths }) {
  return <svg className="site-header-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={headerPaths[name]} /></svg>;
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { openLoginModal } = useLoginModal();
  const { showToast } = useToast();
  const [reading, setReading] = useState(false);
  const readPending = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
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
  const profileToggleRef = useRef<HTMLButtonElement>(null);
  const notificationToggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);

  const mainLinks = [
    { href: "/", label: "Trang chủ", icon: "home", active: pathname === "/" },
    { href: "/bang-tin", label: "Tìm phòng", icon: "search", active: pathname.startsWith("/bang-tin") },
    { href: "/khu-vuc", label: "Cụm sinh viên", icon: "pin", active: pathname.startsWith("/khu-vuc") || pathname === "/cum" || pathname.startsWith("/cum/") },
    { href: "/thao-luan", label: "Thảo luận", icon: "message", active: pathname.startsWith("/thao-luan") },
  ] as const;

  function closeMenus() {
    setShowMobileNav(false);
    setShowProfileMenu(false);
    setShowNotifications(false);
  }

  useEffect(() => {
    setShowMobileNav(false);
    setShowProfileMenu(false);
    setShowNotifications(false);
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const resize = () => {
      setShowMobileNav(false);
      setShowProfileMenu(false);
      setShowNotifications(false);
    };
    desktop.addEventListener("change", resize);
    return () => desktop.removeEventListener("change", resize);
  }, []);

  useEffect(() => {
    if (!showMobileNav) return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const previousOverflow = document.body.style.overflow;
    const previousGutter = document.documentElement.style.scrollbarGutter;
    document.documentElement.style.scrollbarGutter = "stable";
    document.body.style.overflow = "hidden";
    drawer.showModal();
    return () => {
      drawer.close();
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.scrollbarGutter = previousGutter;
      if (menuToggleRef.current?.getClientRects().length) menuToggleRef.current.focus({ preventScroll: true });
    };
  }, [showMobileNav]);

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
        if (profileMenuRef.current?.contains(document.activeElement)) profileToggleRef.current?.focus();
        if (notificationRef.current?.contains(document.activeElement)) notificationToggleRef.current?.focus();
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
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      setSessionError("Chưa thể đăng xuất. Hãy kiểm tra kết nối và thử lại.");
      return;
    } finally {
      setSigningOut(false);
    }
    setAuthenticated(false);
    setCurrentUser(null);
    setShowProfileMenu(false);
    setShowMobileNav(false);
    router.push("/");
  }

  return (
    <header className="topbar site-header">
      <div className="container topbar-inner site-header-row">
        <Link href="/" className="brand site-header-brand" title={siteName} onClick={closeMenus}>
          <span className="brand-mark site-header-mark">R</span>
          <span className="site-header-name">{siteName}</span>
        </Link>
        <nav className="nav-links site-header-nav" aria-label="Điều hướng chính">
          {mainLinks.map(link => <Link key={link.href} href={link.href} aria-current={link.active ? "page" : undefined} onClick={closeMenus}>{link.label}</Link>)}
        </nav>
        <div className="header-actions site-header-actions">
          {authenticated && (
            <div className="notification-wrapper site-header-notifications" ref={notificationRef}>
              <button
                ref={notificationToggleRef}
                className="icon-btn notification-btn site-header-control"
                aria-label={"Thông báo, " + unreadCount + " chưa đọc"}
                aria-expanded={showNotifications}
                aria-controls="site-header-notification-panel"
                title="Thông báo"
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowNotifications(!showNotifications);
                  fetch("/api/notifications", { cache: "no-store" })
                    .then((r) => (r.ok ? r.json() : null))
                    .then((p) => {
                      if (p?.data) {
                        setNotifications(p.data);
                        setUnreadCount(p.meta?.unreadCount ?? p.data.filter((n: { isRead: boolean }) => !n.isRead).length);
                      }
                    }).catch(() => {});
                }}
              >
                <HeaderIcon name="bell" />
                {unreadCount > 0 && <span className="notification-badge site-header-count" aria-hidden="true">{unreadCount}</span>}
              </button>
              {showNotifications && (
                <div id="site-header-notification-panel" className="notification-dropdown site-header-notification-panel">
                  <div className="notification-header site-header-notification-heading">
                    <strong>Thông báo</strong>
                    <button className="mark-read-btn" disabled={reading || unreadCount === 0} aria-busy={reading}
                      onClick={async () => {
                        if (readPending.current) return;
                        readPending.current = true;
                        setReading(true);
                        try {
                          const response = await fetch("/api/notifications", { method: "PATCH" });
                          if (!response.ok) throw new Error();
                          setNotifications(items => items.map(item => ({ ...item, isRead: true })));
                          setUnreadCount(0);
                          showToast("Đã đánh dấu tất cả thông báo là đã đọc.", "success");
                          window.dispatchEvent(new Event("notifications-updated"));
                        } catch {
                          setSessionError("Chưa thể đánh dấu thông báo. Vui lòng thử lại.");
                        } finally {
                          readPending.current = false;
                          setReading(false);
                        }
                      }}
                    >{reading ? "Đang cập nhật…" : "Đánh dấu đã đọc"}</button>
                  </div>
                  <div className="notification-list">
                    {notifications.length ? notifications.map(notif => (
                      <div key={notif.id} className={"notification-item " + (!notif.isRead ? "unread" : "")}>
                        <p><Link href={notif.href?.startsWith("/") && !notif.href.startsWith("//") ? notif.href : "/profile"} onClick={closeMenus}>{notif.title}</Link>{notif.body ? " · " + notif.body : ""}</p>
                        <span className="notification-time">{new Date(notif.createdAt).toLocaleString("vi-VN")}</span>
                      </div>
                    )) : <p className="notification-empty">Chưa có thông báo mới.</p>}
                  </div>
                  <Link href="/tin-nhan" onClick={closeMenus}>Tin nhắn riêng</Link>
                  <Link href="/thong-bao" className="notification-footer" onClick={closeMenus}>Xem tất cả thông báo</Link>
                </div>
              )}
            </div>
          )}
          {loading ? <div className="header-loading site-header-loading" role="status" aria-label="Đang tải tài khoản"><span className="loading-spinner-sm" /></div> : (
            <>
              <div className={"profile-menu-wrapper site-header-account " + (!authenticated ? "site-header-more" : "")} ref={profileMenuRef}>
                <button ref={profileToggleRef} aria-expanded={showProfileMenu} aria-controls="profile-navigation"
                  aria-label={authenticated ? "Tài khoản của " + (currentUser?.name || "bạn") : "Thêm"}
                  className={"profile-chip site-header-control " + (authenticated ? "authenticated site-header-avatar" : "site-header-more-toggle")}
                  onClick={() => { setShowNotifications(false); setShowProfileMenu(!showProfileMenu); }}>
                  {authenticated ? <><HeaderIcon name="user" /><span className="site-header-account-name">{currentUser?.name || "Người dùng"}</span></> : <span>Thêm</span>}
                  <HeaderIcon name="chevron" />
                </button>
                {showProfileMenu && (
                  <div id="profile-navigation" className="profile-dropdown site-header-profile-panel">
                    {authenticated && <Link href="/profile" onClick={closeMenus}><HeaderIcon name="user" />Hồ sơ của tôi</Link>}
                    <Link href="/tin-nhan" onClick={closeMenus}><HeaderIcon name="message" />Tin nhắn riêng</Link>
                    {currentUser?.role === "landlord" && <Link href="/quan-ly-phong" onClick={closeMenus}><HeaderIcon name="home" />Quản lý phòng</Link>}
                    {authenticated && <Link href="/profile?tab=settings" onClick={closeMenus}><HeaderIcon name="settings" />Cài đặt</Link>}
                    <Link href="/quy-dinh" onClick={closeMenus}><HeaderIcon name="document" />Quy định sử dụng</Link>
                    {authenticated && <button onClick={handleLogout} disabled={signingOut} aria-busy={signingOut}><HeaderIcon name="logout" />Đăng xuất</button>}
                  </div>
                )}
              </div>
              {!authenticated && <button className="profile-chip site-header-login" onClick={() => { closeMenus(); openLoginModal("login", pathname); }}><HeaderIcon name="user" />Đăng nhập</button>}
            </>
          )}
          <button ref={menuToggleRef} className={"mobile-menu-btn site-header-toggle " + (showMobileNav ? "is-open" : "")}
            aria-label={showMobileNav ? "Đóng menu" : "Mở menu"} aria-expanded={showMobileNav} aria-controls="mobile-navigation"
            onClick={() => { setShowNotifications(false); setShowProfileMenu(false); setShowMobileNav(value => !value); }}>
            <HeaderIcon name={showMobileNav ? "close" : "menu"} />
          </button>
        </div>
      </div>
      {sessionError && <div className="container feedback feedback-error site-header-alert" role="alert">{sessionError}{" "}<button type="button" className="btn btn-secondary" onClick={() => window.dispatchEvent(new Event("session-retry"))}>Thử lại</button></div>}
      {showMobileNav && (
        <dialog ref={drawerRef} className="site-header-drawer" aria-label="Menu điều hướng"
          onCancel={event => { event.preventDefault(); setShowMobileNav(false); }}
          onClick={event => {
            const box=event.currentTarget.getBoundingClientRect();
            if(event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) setShowMobileNav(false);
          }}
          onKeyDown={event => {
            if(event.key !== "Tab") return;
            const items=event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
            const first=items[0], last=items[items.length-1];
            if(event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if(!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }}>
          <div className="site-header-drawer-heading"><strong>Menu</strong><button className="site-header-close" aria-label="Đóng menu" onClick={() => setShowMobileNav(false)}><HeaderIcon name="close" /></button></div>
          <nav id="mobile-navigation" className="mobile-nav site-header-mobile-nav" aria-label="Điều hướng trên điện thoại">
            {mainLinks.map(link => <Link key={link.href} href={link.href} aria-current={link.active ? "page" : undefined} onClick={closeMenus}><HeaderIcon name={link.icon} />{link.label}</Link>)}
            <div className="site-header-divider" />
            <Link href="/tin-nhan" aria-current={pathname.startsWith("/tin-nhan") ? "page" : undefined} onClick={closeMenus}><HeaderIcon name="message" />Tin nhắn riêng</Link>
            <Link href="/quy-dinh" aria-current={pathname === "/quy-dinh" ? "page" : undefined} onClick={closeMenus}><HeaderIcon name="document" />Quy định sử dụng</Link>
            {authenticated && <>
              <div className="site-header-divider" />
              <Link href="/thong-bao" aria-current={pathname === "/thong-bao" ? "page" : undefined} onClick={closeMenus}><HeaderIcon name="bell" />Thông báo{unreadCount > 0 && <span className="site-header-inline-count">{unreadCount} chưa đọc</span>}</Link>
              <Link href="/bai-viet-cua-toi" aria-current={pathname === "/bai-viet-cua-toi" ? "page" : undefined} onClick={closeMenus}><HeaderIcon name="document" />Bài viết của tôi</Link>
              <Link href="/profile" aria-current={pathname === "/profile" ? "page" : undefined} onClick={closeMenus}><HeaderIcon name="user" />Tài khoản của tôi</Link>
              {currentUser?.role === "landlord" && <Link href="/quan-ly-phong" aria-current={pathname.startsWith("/quan-ly-phong") ? "page" : undefined} onClick={closeMenus}><HeaderIcon name="home" />Quản lý phòng</Link>}
              <button className="mobile-logout" onClick={handleLogout} disabled={signingOut} aria-busy={signingOut}><HeaderIcon name="logout" />Đăng xuất</button>
            </>}
          </nav>
        </dialog>
      )}
    </header>
  );
}

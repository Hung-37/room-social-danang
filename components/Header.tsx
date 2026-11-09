'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { isLoggedIn, getCurrentUser, logout } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function Header() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: number; title: string; body: string; href?: string | null; isRead: boolean; createdAt: string }>>([]);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    async function loadSession() {
      const localUser = getCurrentUser();
      const localLoggedIn = isLoggedIn();
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        const payload = response.ok ? await response.json() as { data?: { name: string; email?: string } } : null;
        if (mounted && payload?.data) {
          setAuthenticated(true);
          setCurrentUser({ name: payload.data.name });
          if (localUser && payload.data.email && localUser.email !== payload.data.email) logout();
        } else if (mounted) {
          setAuthenticated(localLoggedIn);
          setCurrentUser(localUser);
        }
      } catch {
        if (mounted) {
          setAuthenticated(localLoggedIn);
          setCurrentUser(localUser);
        }
      } finally {
        if (mounted) setLoading(false);
      }
      if (mounted && (localLoggedIn || localUser)) {
        fetch('/api/notifications').then((response) => response.ok ? response.json() : null).then((payload) => {
          if (mounted && payload?.data) setNotifications(payload.data);
        }).catch(() => undefined);
      }
    }
    loadSession();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    logout();
    setAuthenticated(false);
    setCurrentUser(null);
    setShowProfileMenu(false);
    setShowMobileNav(false);
    router.push('/');
  }

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">R</span>
          <span>Room<span>ĐàNẵng</span></span>
        </Link>
        <nav className="nav-links" aria-label="Điều hướng chính">
          <Link href="/">Trang chủ</Link>
          <Link href="/bang-tin">Bản tin</Link>
          <Link href="/thao-luan">Thảo luận</Link>
          <Link href="/cum">Khu vực</Link>
        </nav>
        <div className="header-actions">
          <button className={`mobile-menu-btn ${showMobileNav ? 'is-open' : ''}`} aria-label={showMobileNav ? 'Đóng menu' : 'Mở menu'} aria-expanded={showMobileNav} onClick={() => setShowMobileNav((value) => !value)}>
            <span></span><span></span><span></span>
          </button>
          {authenticated && (
            <div className="notification-wrapper" ref={notificationRef}>
              <button
                className="icon-btn notification-btn"
                aria-label="Thông báo"
                title="Thông báo"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                🔔
                {notifications.filter(n => !n.isRead).length > 0 && (
                  <span className="notification-badge">
                    {notifications.filter(n => !n.isRead).length}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <strong>Thông báo</strong>
                    <button className="mark-read-btn" onClick={() => {
                      fetch('/api/notifications', { method: 'PATCH' }).catch(() => undefined);
                      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
                    }}>Đánh dấu đã đọc</button>
                  </div>
                  <div className="notification-list">
                    {notifications.length ? notifications.map((notif) => (
                      <div key={notif.id} className={`notification-item ${!notif.isRead ? 'unread' : ''}`}>
                        <p>{notif.title}{notif.body ? ` · ${notif.body}` : ''}</p>
                        <span className="notification-time">{new Date(notif.createdAt).toLocaleString('vi-VN')}</span>
                      </div>
                    )) : <p className="notification-empty">Chưa có thông báo mới.</p>}
                  </div>
                  <Link href="/profile" className="notification-footer">Xem tất cả thông báo</Link>
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
                className="profile-chip authenticated"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <span>👤</span>
                <span>{currentUser?.name || 'Người dùng'}</span>
                <span className="dropdown-arrow">▼</span>
              </button>
              {showProfileMenu && (
                <div className="profile-dropdown">
                  <Link href="/profile" onClick={() => setShowProfileMenu(false)}>
                    <span>👤</span> Hồ sơ của tôi
                  </Link>
                  <Link href="/profile?tab=settings" onClick={() => setShowProfileMenu(false)}>
                    <span>⚙️</span> Cài đặt
                  </Link>
                  <button onClick={handleLogout}>
                    <span>🚪</span> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/dang-nhap" className="profile-chip">
              <span>👤</span> Đăng nhập
            </Link>
          )}
        </div>
      </div>
      {showMobileNav && (
        <nav className="mobile-nav" aria-label="Điều hướng mobile">
          <Link href="/" onClick={() => setShowMobileNav(false)}>Trang chủ <span>⌂</span></Link>
          <Link href="/#cum-sinh-vien" onClick={() => setShowMobileNav(false)}>Cụm sinh viên <span>⌖</span></Link>
          <Link href="/#bang-tin" onClick={() => setShowMobileNav(false)}>Bảng tin <span>▤</span></Link>
          <Link href={authenticated ? '/dang-phong' : '/dang-nhap'} onClick={() => setShowMobileNav(false)}>{authenticated ? 'Đăng tin phòng' : 'Tham gia cộng đồng'} <span>＋</span></Link>
        </nav>
      )}
    </header>
  );
}

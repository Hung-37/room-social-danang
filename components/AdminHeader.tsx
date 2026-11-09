'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminHeader() {
  const router = useRouter();

  return (
    <header className="admin-topbar">
      <div className="container admin-topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">R</span>
          <span>Room<span>ĐàNẵng</span></span>
          <span className="admin-badge">Admin</span>
        </Link>
        <nav className="admin-nav-links">
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin?tab=listings">Tin cần duyệt</Link>
          <Link href="/admin?tab=files">Quản lý file</Link>
        </nav>
        <div className="admin-header-actions">
          <Link href="/" className="secondary-btn">
            ← Về trang chủ
          </Link>
        </div>
      </div>
    </header>
  );
}

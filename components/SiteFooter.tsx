import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="site-footer-branding">
          <Link href="/" className="site-footer-brand">
            <span className="site-footer-mark">R</span>
            <span>
              Room<span>ĐàNẵng</span>
            </span>
          </Link>
          <p>Cộng đồng tìm phòng và chia sẻ thông tin cho sinh viên Đà Nẵng.</p>
        </div>

        <nav className="site-footer-nav" aria-label="Liên kết nhanh">
          <Link href="/bang-tin">Tìm phòng</Link>
          <Link href="/khu-vuc">Khu vực</Link>
          <Link href="/thao-luan">Thảo luận</Link>
          <Link href="/quy-dinh">Quy định</Link>
          <Link href="/dang-nhap">Đăng nhập</Link>
        </nav>

        <div className="site-footer-meta">
          <p>© {new Date().getFullYear()} RoomĐàNẵng</p>
          <span>Thông tin cập nhật theo cộng đồng sinh viên</span>
        </div>
      </div>
    </footer>
  );
}

import Header from '@/components/Header';
import Link from 'next/link';
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="content-shell route-empty">
        <span className="section-eyebrow">Không tìm thấy trang · 404</span>
        <h1>Mình tìm một lối khác nhé?</h1>
        <p>
          Liên kết có thể đã thay đổi hoặc nội dung không còn được công khai. Bạn có thể quay về tìm
          phòng hoặc ghé cộng đồng.
        </p>
        <div className="inline-actions">
          <Link className="primary-btn" href="/bang-tin">
            Tìm phòng
          </Link>
          <Link className="secondary-btn" href="/thao-luan">
            Ghé thảo luận
          </Link>
          <Link className="text-link" href="/">
            Trang chủ
          </Link>
        </div>
      </main>
    </>
  );
}

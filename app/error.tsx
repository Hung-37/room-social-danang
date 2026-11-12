'use client';
import Link from 'next/link';
export default function ErrorPage({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="content-shell route-empty">
      <span className="section-eyebrow">Kết nối cần thêm một chút thời gian</span>
      <h1>Chưa thể mở nội dung lúc này</h1>
      <p>Bạn có thể thử tải lại. Nếu đang nhập nội dung, hãy giữ bản nháp trước khi rời trang.</p>
      <div className="inline-actions">
        <button className="primary-btn" onClick={reset}>
          Thử lại
        </button>
        <Link className="secondary-btn" href="/">
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}

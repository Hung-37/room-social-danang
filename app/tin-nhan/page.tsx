import Link from 'next/link';
import Header from '@/components/Header';
import Inbox from './Inbox';
export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ 'hoi-thoai'?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="content-shell explorer messaging-page"
      >
        <div className="messaging-heading">
          <div>
            <span className="section-eyebrow">Không gian riêng tư</span>
            <h1>Tin nhắn của bạn</h1>
            <p>
              Trao đổi trực tiếp về phòng và lịch xem. Chỉ những người tham gia
              cuộc trò chuyện mới có thể đọc nội dung.
            </p>
          </div>
          <Link className="secondary-btn" href="/lich-xem-phong">
            Mở lịch xem phòng
          </Link>
        </div>
        <aside className="message-safety-note">
          <span aria-hidden="true">✓</span>
          <p>
            <strong>Giao dịch an toàn</strong>
            <span>
              Không chuyển tiền đặt cọc trước khi xem phòng, xác minh người cho
              thuê và kiểm tra điều khoản hợp đồng.
            </span>
          </p>
        </aside>
        <Inbox initial={params['hoi-thoai'] || ''} />
      </main>
    </>
  );
}

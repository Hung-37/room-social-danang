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
      <main id="main-content" tabIndex={-1} className="content-shell explorer">
        <span className="section-eyebrow">Trao đổi riêng tư</span>
        <h1>Tin nhắn của bạn</h1>
        <p>
          Tin nhắn không hiển thị công khai; chỉ tài khoản tham gia được truy cập qua ứng dụng.
          Không chuyển tiền khi chưa kiểm tra phòng và hợp đồng.
        </p>
        <p>
          <Link className="text-link" href="/lich-xem-phong">
            Mở lịch xem phòng của bạn →
          </Link>
        </p>
        <Inbox initial={params['hoi-thoai'] || ''} />
      </main>
    </>
  );
}

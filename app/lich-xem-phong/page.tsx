import Header from '@/components/Header';
import Appointments from '@/components/Appointments';
export default function Page() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="content-shell explorer">
        <span className="section-eyebrow">Sắp xếp để tìm phòng thuận tiện hơn</span>
        <h1>Lịch xem phòng</h1>
        <p>
          Đề xuất giờ trong hội thoại với chủ trọ, theo dõi xác nhận và quản lý các buổi hẹn tại
          đây.
        </p>
        <Appointments />
      </main>
    </>
  );
}

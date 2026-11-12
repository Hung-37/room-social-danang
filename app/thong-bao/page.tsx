import Header from '@/components/Header';
import Notifications from './Notifications';
export default function Page() {
  return (
    <>
      <Header />
      <main className="content-shell explorer" id="main-content" tabIndex={-1}>
        <h1>Thông báo của bạn</h1>
        <Notifications />
      </main>
    </>
  );
}

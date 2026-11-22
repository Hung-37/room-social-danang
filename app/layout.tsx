import FavoritesProvider from '@/components/FavoritesProvider';
import SiteFooter from '@/components/SiteFooter';
import { ToastProvider } from '@/components/Toast';
import { LoginModalProvider } from '@/components/LoginModalProvider';
import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import './styles/experience.css';
import './styles/redesign.css';
import './styles/management.css';
import './styles/appointments.css';
import './styles/admin-controls.css';
import './styles/room-photos.css';
import './styles/header.css';

export const metadata: Metadata = {
  title: 'Room Đà Nẵng | Cộng đồng phòng trọ sinh viên',
  description: 'Tổng hợp phòng trọ, thảo luận và cảnh báo cho sinh viên Đà Nẵng.',
  keywords: ['phòng trọ', 'đà nẵng', 'tìm phòng', 'sinh viên', 'cho thuê phòng'],
  authors: [{ name: 'RoomĐàNẵng' }],
  openGraph: {
    title: 'Room Đà Nẵng | Cộng đồng phòng trọ sinh viên',
    description: 'Tổng hợp phòng trọ, thảo luận và cảnh báo cho sinh viên Đà Nẵng.',
    type: 'website',
    locale: 'vi_VN'
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <Script
        id="service-worker"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
              });
            }
          `
        }}
      />
      <body>
        <a className="skip-link" href="#main-content">
          Bỏ qua điều hướng
        </a>
        <ToastProvider>
          <LoginModalProvider>
            <FavoritesProvider>{children}</FavoritesProvider>
          </LoginModalProvider>
        </ToastProvider>
        <SiteFooter />
      </body>
    </html>
  );
}

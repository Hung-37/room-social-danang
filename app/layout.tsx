import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Room Đà Nẵng | Cộng đồng phòng trọ sinh viên',
  description: 'Tổng hợp phòng trọ, thảo luận và cảnh báo cho sinh viên Đà Nẵng.',
  keywords: ['phòng trọ', 'đà nẵng', 'tìm phòng', 'sinh viên', 'cho thuê phòng'],
  authors: [{ name: 'RoomĐàNẵng' }],
  openGraph: {
    title: 'Room Đà Nẵng | Cộng đồng phòng trọ sinh viên',
    description: 'Tổng hợp phòng trọ, thảo luận và cảnh báo cho sinh viên Đà Nẵng.',
    type: 'website',
    locale: 'vi_VN',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
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
          `,
        }}
      />
      <body>{children}</body>
    </html>
  );
}

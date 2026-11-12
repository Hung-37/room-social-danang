'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function StartChat({ listingId }: { listingId: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const router = useRouter();
  async function start() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId })
      });
      const p = await r.json();
      if (r.status === 401) {
        router.push('/dang-nhap?next=' + encodeURIComponent('/bai/' + listingId));
        return;
      }
      if (!r.ok) throw new Error(p.error);
      router.push('/tin-nhan?hoi-thoai=' + p.data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa thể mở tin nhắn.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="primary-btn" onClick={start} disabled={busy}>
        {busy ? 'Đang mở...' : 'Nhắn chủ trọ'}
      </button>
      {error && (
        <p className="feedback" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

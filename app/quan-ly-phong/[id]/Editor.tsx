'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import LandlordListingForm, { type ListingDraft } from '@/app/dang-phong/LandlordListingForm';
export default function Editor({ id }: { id: string }) {
  const [data, setData] = useState<ListingDraft | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    const c = new AbortController();
    fetch('/api/landlord/listings/' + encodeURIComponent(id), {
      cache: 'no-store',
      signal: c.signal
    })
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok) throw new Error(p.error);
        setData(p.data);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [id]);
  return data ? (
    <LandlordListingForm initial={data} />
  ) : (
    <div className="content-shell route-empty">
      {error ? (
        <>
          <h1>Chưa thể mở tin phòng</h1>
          <p role="alert">{error}</p>
          <Link className="primary-btn" href="/quan-ly-phong">
            Về quản lý phòng
          </Link>
        </>
      ) : (
        <p role="status">Đang mở tin của bạn...</p>
      )}
    </div>
  );
}

'use client';
import { useState } from 'react';
type Preview = {
  summary: string;
  phone: string | null;
  imageUrl: string | null;
  imageUrls: string[];
};
export default function ListingReviewPreview({ id }: { id: string }) {
  const [data, setData] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function load() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/admin/listings/' + encodeURIComponent(id) + '/preview', {
        cache: 'no-store'
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setData(p.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa thể mở tin.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="review-preview"
      onToggle={(e) => {
        if (e.currentTarget.open && !data && !busy) void load();
      }}
    >
      <summary>Xem nội dung và ảnh</summary>
      {busy ? (
        <p role="status">Đang mở nội dung...</p>
      ) : error ? (
        <>
          <p role="alert">{error}</p>
          <button className="secondary-btn" onClick={load}>
            Thử lại
          </button>
        </>
      ) : data ? (
        <>
          <p className="full-description">{data.summary}</p>
          {data.phone && <p>Liên hệ: {data.phone}</p>}
          <div className="review-photo-grid">
            {(data.imageUrls.length ? data.imageUrls : data.imageUrl ? [data.imageUrl] : []).map(
              (url, index) => (
                <a href={url} target="_blank" rel="noreferrer" key={url}>
                  <img src={url} alt={'Ảnh phòng ' + (index + 1)} />
                </a>
              )
            )}
          </div>
          {!data.imageUrl && !data.imageUrls.length && <p>Tin này chưa có ảnh.</p>}
        </>
      ) : null}
    </details>
  );
}

'use client';
import { useState, useEffect, useRef } from 'react';
type Result = { id: number; body: string; createdAt: string; senderId: string };
export default function MessageSearch({
  conversation,
  user
}: {
  conversation: string;
  user: string;
}) {
  const [query, setQuery] = useState(''),
    [items, setItems] = useState<Result[]>([]),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  async function search(q: string, before = 0, gen = generation.current) {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams({ q, ...(before ? { before: String(before) } : {}) });
      const r = await fetch('/api/chat/' + encodeURIComponent(conversation) + '/search?' + p, {
        cache: 'no-store',
        signal: c.signal
      });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error);
      if (gen === generation.current) {
        setItems((current) =>
          before ? [...current, ...value.data.messages] : value.data.messages
        );
        setMore(value.data.hasMore);
      }
    } catch (e) {
      if (!c.signal.aborted && gen === generation.current)
        setError(e instanceof Error ? e.message : 'Chưa tìm được tin nhắn.');
    } finally {
      if (!c.signal.aborted && gen === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    const gen = ++generation.current;
    controller.current?.abort();
    setItems([]);
    setMore(false);
    setLoading(false);
    setError('');
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => void search(query.trim(), 0, gen), 300);
    return () => {
      clearTimeout(timer);
      controller.current?.abort();
    };
  }, [query, conversation]);
  return (
    <details className="message-search">
      <summary>Tìm trong tin nhắn</summary>
      <label>
        Từ khóa tin nhắn
        <input
          type="search"
          value={query}
          maxLength={100}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Giá thuê, tiền điện, lịch hẹn..."
        />
      </label>
      {loading && <p role="status">Đang tìm...</p>}
      {error && <p role="alert">{error}</p>}
      {query.trim().length >= 2 && !loading && !error && !items.length && (
        <p>Chưa tìm thấy tin nhắn phù hợp.</p>
      )}
      <div
        className="message-results"
        tabIndex={items.length ? 0 : undefined}
        role="region"
        aria-label="Kết quả tìm tin nhắn"
      >
        {items.map((m) => (
          <article key={m.id}>
            <small>
              {m.senderId === user ? 'Bạn' : 'Người còn lại'} ·{' '}
              {new Date(m.createdAt).toLocaleString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
                dateStyle: 'short',
                timeStyle: 'short'
              })}
            </small>
            <p>{m.body}</p>
          </article>
        ))}
      </div>
      {more && (
        <button
          className="secondary-btn"
          disabled={loading}
          onClick={() => search(query.trim(), items.at(-1)?.id)}
        >
          Xem kết quả cũ hơn
        </button>
      )}
    </details>
  );
}

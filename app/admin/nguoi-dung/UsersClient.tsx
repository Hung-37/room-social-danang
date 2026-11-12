'use client';
import { useState, useEffect, type FormEvent } from 'react';
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  blocked: number;
  isDemo: number;
  version: number;
  reason: string;
  comments: number;
  listings: number;
};
export default function UsersClient() {
  const [users, setUsers] = useState<User[]>([]),
    [q, setQ] = useState(''),
    [role, setRole] = useState(''),
    [state, setState] = useState(''),
    [page, setPage] = useState(0),
    [total, setTotal] = useState(0),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState<User | null>(null),
    [reason, setReason] = useState(''),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const p = new URLSearchParams({ q, role, state, page: String(page) });
        const r = await fetch('/api/admin/users?' + p, { cache: 'no-store', signal: c.signal });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setUsers(data.data);
        setTotal(data.total);
      } catch (e) {
        if (!c.signal.aborted)
          setError(e instanceof Error ? e.message : 'Chưa tải được người dùng.');
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [q, role, state, page, reload]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: target.id,
          blocked: !target.blocked,
          version: Number(target.version),
          reason
        })
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setTarget(null);
      setReason('');
      setNotice(
        p.data.blocked
          ? 'Đã khóa tài khoản. Phiên cũ sẽ bị từ chối ở yêu cầu tiếp theo.'
          : 'Đã mở khóa tài khoản.'
      );
      setReload((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa cập nhật được tài khoản.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Quản lý người dùng</h1>
      <p>
        Tìm tài khoản, theo dõi hoạt động và tạm khóa khi cần. Xác minh chủ trọ được xử lý ở mục
        riêng; màn hình này không cấp quyền Admin hoặc đọc tin nhắn riêng.
      </p>
      <div className="user-filters">
        <label>
          Tìm người dùng
          <input
            type="search"
            maxLength={100}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Tên hoặc email..."
          />
        </label>
        <label>
          Vai trò
          <select
            aria-label="Vai trò"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tất cả</option>
            <option value="student">Người tìm phòng</option>
            <option value="landlord">Chủ trọ</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label>
          Trạng thái tài khoản
          <select
            aria-label="Trạng thái tài khoản"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tất cả</option>
            <option value="active">Đang hoạt động</option>
            <option value="blocked">Bị khóa</option>
            <option value="demo">Dữ liệu mẫu</option>
          </select>
        </label>
      </div>
      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="feedback" role="status">
          {notice}
        </p>
      )}
      {target && (
        <form
          className="user-action editor-section"
          role="region"
          aria-label="Xác nhận quản lý tài khoản"
          onSubmit={save}
        >
          <h2>{target.blocked ? 'Mở khóa tài khoản?' : 'Tạm khóa tài khoản?'}</h2>
          <p>
            {target.name} · {target.email}
          </p>
          <label>
            Lý do cập nhật
            <textarea
              value={reason}
              required
              minLength={5}
              maxLength={500}
              rows={3}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="inline-actions">
            <button
              className="secondary-btn"
              type="button"
              disabled={busy}
              onClick={() => setTarget(null)}
            >
              Hủy
            </button>
            <button className="primary-btn" disabled={busy}>
              Xác nhận cập nhật
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <p role="status">Đang tải người dùng...</p>
      ) : (
        <>
          <p>
            {total} tài khoản phù hợp · Trang {page + 1} · Tối đa 10 tài khoản/trang
          </p>
          <div className="user-grid">
            {users.map((u) => (
              <article className="user-card" key={u.id}>
                <div className="section-heading">
                  <h2>{u.name}</h2>
                  <span className="listing-status">{u.blocked ? 'Bị khóa' : 'Hoạt động'}</span>
                </div>
                <p className="user-email">{u.email}</p>
                <p>
                  {u.role === 'landlord'
                    ? 'Chủ trọ'
                    : u.role === 'admin'
                      ? 'Admin'
                      : 'Người tìm phòng'}
                  {u.isDemo ? ' · Dữ liệu mẫu' : ''}
                </p>
                <p>
                  Tham gia{' '}
                  {new Date(u.createdAt).toLocaleDateString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh'
                  })}
                </p>
                <div className="user-counts">
                  <span>{u.listings} tin phòng</span>
                  <span>{u.comments} bình luận</span>
                </div>
                {u.reason && <p>Lý do gần nhất: {u.reason}</p>}
                {u.role !== 'admin' && (
                  <button
                    className="secondary-btn"
                    disabled={busy}
                    onClick={() => {
                      setTarget(u);
                      setReason('');
                      setError('');
                    }}
                  >
                    {u.blocked ? 'Mở khóa' : 'Khóa tài khoản'}
                  </button>
                )}
              </article>
            ))}
          </div>
          {!users.length && <p>Không tìm thấy tài khoản phù hợp.</p>}
          <div className="pagination-controls">
            <button
              className="secondary-btn"
              disabled={page === 0 || busy}
              onClick={() => setPage((v) => v - 1)}
            >
              Trang trước
            </button>
            <button
              className="secondary-btn"
              disabled={(page + 1) * 10 >= total || busy}
              onClick={() => setPage((v) => v + 1)}
            >
              Trang sau
            </button>
          </div>
        </>
      )}
    </>
  );
}

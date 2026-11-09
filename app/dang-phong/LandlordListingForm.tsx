'use client';

import { useState } from 'react';
import Link from 'next/link';
import { clusters } from '@/lib/data';

export default function LandlordListingForm() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/listings/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) { setMessage(payload.error || 'Không thể đăng tin.'); return; }
    setMessage('Tin đã được gửi và đang chờ quản trị viên kiểm duyệt.');
    event.currentTarget.reset();
  }
  return <section className="section"><div className="container"><div className="auth-panel"><span className="eyebrow">Dành cho chủ trọ</span><h1>Đăng tin phòng</h1><p>Tin đăng sẽ được kiểm tra trước khi hiển thị công khai.</p><form className="auth-form" onSubmit={submit}>
    <label>Tiêu đề<input name="title" required maxLength={120} placeholder="Phòng studio gần Đại học Bách khoa" /></label>
    <label>Mô tả<textarea name="summary" required minLength={20} maxLength={3000} rows={5} placeholder="Mô tả tiện ích, điều kiện thuê và quy định..." /></label>
    <label>Địa chỉ<input name="address" required placeholder="Đường Nguyễn Lương Bằng, Liên Chiểu" /></label>
    <div className="form-row"><label>Giá thuê/tháng<input name="price" required type="number" min="1" /></label><label>Diện tích m²<input name="area" required type="number" min="1" /></label></div>
    <label>Khu vực<select name="clusterId" defaultValue="chua-phan-cum">{clusters.map((cluster) => <option value={cluster.id} key={cluster.id}>{cluster.name}</option>)}</select></label>
    <label>Số điện thoại<input name="phone" inputMode="tel" placeholder="Không bắt buộc" /></label>
    {message && <p className="auth-error" role="status">{message}</p>}
    <button className="primary-btn" disabled={loading}>{loading ? 'Đang gửi...' : 'Gửi tin chờ duyệt'}</button>
    <Link href="/" className="secondary-btn">Về bảng tin</Link>
  </form></div></div></section>;
}

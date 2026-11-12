'use client';
import { useState, useEffect, type FormEvent } from 'react';
import type { SiteSettings } from '@/lib/site-settings';
type Source = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  permission: string;
  listingSelectors?: Record<string, string>;
};
type Ai = {
  enabled: boolean;
  connected: boolean;
  modelAvailable: boolean;
  model: string;
  status: string;
};
export default function SettingsClient() {
  const [runtime, setRuntime] = useState<{ cronConfigured: boolean } | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null),
    [version, setVersion] = useState(0),
    [ai, setAi] = useState<Ai | null>(null),
    [sources, setSources] = useState<Source[]>([]),
    [source, setSource] = useState({
      sourceId: '',
      name: '',
      url: '',
      permission: 'public_html',
      enabled: false,
      itemSelector: '',
      titleSelector: ''
    }),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  async function load() {
    setError('');
    try {
      const [r, s] = await Promise.all([
        fetch('/api/admin/settings', { cache: 'no-store' }),
        fetch('/api/collector/check', { cache: 'no-store' })
      ]);
      const p = await r.json(),
        q = await s.json();
      if (!r.ok || !s.ok) throw new Error(p.error || q.error);
      setSettings(p.data.settings);
      setVersion(p.data.version);
      setAi(p.data.ai);
      setRuntime(p.data.runtime);
      setSources(q.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa tải được cấu hình.');
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const r = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, version })
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setSettings(p.data.settings);
      setVersion(p.data.version);
      setNotice('Đã lưu cấu hình vào MySQL.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được cấu hình.');
    } finally {
      setBusy(false);
    }
  }
  async function updateSource(b: object) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch('/api/collector/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b)
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setNotice('Đã lưu nguồn vào MySQL.');
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được nguồn.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  function change<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }
  return (
    <>
      <div className="section-heading">
        <h1>Cấu hình website & thu thập dữ liệu</h1>
        <button className="secondary-btn" disabled={busy} onClick={load}>
          Tải lại cấu hình
        </button>
      </div>
      <p>
        Các giá trị dưới đây được lưu trong database. Tin mới và tin sửa luôn cần kiểm duyệt; không
        thể bỏ qua phân quyền bằng cấu hình.
      </p>
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
      {!settings ? (
        <p>Chưa tải được cấu hình hoặc đang tải. Dùng nút tải lại để thử.</p>
      ) : (
        <form className="listing-form" onSubmit={save}>
          <section className="editor-section">
            <h2>Thông tin và quy định</h2>
            <label>
              Tên website
              <input
                value={settings.siteName}
                required
                minLength={2}
                maxLength={60}
                onChange={(e) => change('siteName', e.target.value)}
              />
            </label>
            <label>
              Email liên hệ
              <input
                type="email"
                value={settings.contactEmail}
                maxLength={254}
                onChange={(e) => change('contactEmail', e.target.value)}
              />
            </label>
            <label>
              Quy định đăng tin và bình luận
              <textarea
                aria-label="Quy định đăng tin và bình luận"
                value={settings.postingGuidelines}
                required
                minLength={20}
                maxLength={2000}
                rows={4}
                onChange={(e) => change('postingGuidelines', e.target.value)}
              />
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={settings.registrationEnabled}
                onChange={(e) => change('registrationEnabled', e.target.checked)}
              />
              Cho phép đăng ký tài khoản mới
            </label>
          </section>
          <section className="editor-section">
            <h2>Collector và AI</h2>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={settings.collectorEnabled}
                onChange={(e) => change('collectorEnabled', e.target.checked)}
              />
              Cho phép chạy collector
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={settings.daNangOnly}
                onChange={(e) => change('daNangOnly', e.target.checked)}
              />
              Chỉ nhận dữ liệu xác định thuộc Đà Nẵng
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={settings.aiEnabled}
                onChange={(e) => change('aiEnabled', e.target.checked)}
              />
              Bật phân tích AI cho dữ liệu nhập và collector
            </label>
            <label>
              Số tin AI phân tích tối đa mỗi lượt
              <input
                type="number"
                min={1}
                max={20}
                value={settings.aiMaxListings}
                onChange={(e) => change('aiMaxListings', Number(e.target.value))}
              />
            </label>
            <p>
              AI chỉ hỗ trợ nhận xét, không xác minh chủ trọ hay tự công khai tin. Nếu AI lỗi, dữ
              liệu vẫn ở hàng chờ và lượt chạy báo chưa hoàn tất.
            </p>
            <div className="ai-health">
              <p>
                Lịch chạy tự động phía máy chủ:{' '}
                {runtime?.cronConfigured
                  ? 'Đã có khóa cron; cần lịch gọi từ hosting'
                  : 'Chưa cấu hình khóa cron'}
                . Tự chạy khi mở trang Admin không thay thế lịch máy chủ.
              </p>
              <strong>
                AI:{' '}
                {ai?.connected
                  ? ai.modelAvailable
                    ? 'Đã kết nối, có mô hình'
                    : 'Đã kết nối, thiếu mô hình'
                  : 'Chưa kết nối dịch vụ'}
              </strong>
              <p>
                Mô hình: {ai?.model || 'Chưa đọc được'} ·{' '}
                {settings.aiEnabled ? 'Đang bật trong cấu hình' : 'Đang tắt trong cấu hình'}
              </p>
              <p>
                Địa chỉ dịch vụ, mô hình và secret được cấu hình ở máy chủ. Màn hình này không nhận
                mật khẩu hoặc token.
              </p>
            </div>
          </section>
          <button className="primary-btn" disabled={busy}>
            {busy ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </form>
      )}
      <section className="source-settings">
        <h2>Nguồn thu thập</h2>
        <p>
          Trạng thái bật là cấu hình cho phép chạy, không có nghĩa website nguồn đang hoạt động.
          Dùng chức năng xem thử trong Admin trước khi chạy; nguồn chặn truy cập hoặc robots sẽ được
          báo lỗi.
        </p>
        <div className="configured-sources">
          {sources.map((s) => (
            <article key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <p>{s.url || 'Chưa có URL'}</p>
                <small>
                  {s.enabled ? 'Đang bật' : 'Đang tắt'} · {s.permission}
                </small>
              </div>
              <div className="inline-actions">
                <button
                  className="secondary-btn"
                  disabled={busy}
                  onClick={() => void updateSource({ sourceId: s.id, enabled: !s.enabled })}
                >
                  {s.enabled ? 'Tắt nguồn' : 'Bật nguồn'}
                </button>
                {['public_html', 'public_api', 'public_feed'].includes(s.permission) && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      setSource({
                        sourceId: s.id,
                        name: s.name,
                        url: s.url,
                        permission: s.permission === 'public_api' ? 'public_feed' : s.permission,
                        enabled: s.enabled,
                        itemSelector: s.listingSelectors?.itemSelector || '',
                        titleSelector: s.listingSelectors?.titleSelector || ''
                      })
                    }
                  >
                    Chỉnh sửa nguồn
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
        <form
          className="listing-form editor-section"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await updateSource({
                ...source,
                ...(!source.sourceId ? { sourceId: undefined } : {}),
                selectors: {
                  ...(source.itemSelector ? { itemSelector: source.itemSelector } : {}),
                  ...(source.titleSelector ? { titleSelector: source.titleSelector } : {})
                }
              })
            )
              setSource({
                sourceId: '',
                name: '',
                url: '',
                permission: 'public_html',
                enabled: false,
                itemSelector: '',
                titleSelector: ''
              });
          }}
        >
          <h3>{source.sourceId ? 'Chỉnh sửa nguồn' : 'Thêm nguồn mới'}</h3>
          <label>
            Tên nguồn
            <input
              value={source.name}
              required
              minLength={2}
              maxLength={100}
              onChange={(e) => setSource({ ...source, name: e.target.value })}
            />
          </label>
          <label>
            URL nguồn HTTPS
            <input
              value={source.url}
              required
              type="url"
              maxLength={2000}
              onChange={(e) => setSource({ ...source, url: e.target.value })}
            />
          </label>
          <label>
            Định dạng nguồn
            <select
              aria-label="Định dạng nguồn"
              value={source.permission}
              onChange={(e) => setSource({ ...source, permission: e.target.value })}
            >
              <option value="public_html">Trang HTML công khai</option>
              <option value="public_feed">JSON / RSS công khai</option>
            </select>
          </label>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={source.enabled}
              onChange={(e) => setSource({ ...source, enabled: e.target.checked })}
            />
            Bật nguồn sau khi lưu
          </label>
          <details>
            <summary>Bộ chọn HTML nâng cao (không bắt buộc)</summary>
            <label>
              Bộ chọn thẻ tin
              <input
                value={source.itemSelector}
                maxLength={200}
                onChange={(e) => setSource({ ...source, itemSelector: e.target.value })}
              />
            </label>
            <label>
              Bộ chọn tiêu đề
              <input
                value={source.titleSelector}
                maxLength={200}
                onChange={(e) => setSource({ ...source, titleSelector: e.target.value })}
              />
            </label>
            <p>Để trống để hệ thống dùng JSON-LD và bộ nhận diện chung.</p>
          </details>
          <div className="inline-actions">
            <button className="primary-btn" disabled={busy}>
              Lưu nguồn
            </button>
            {source.sourceId && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  setSource({
                    sourceId: '',
                    name: '',
                    url: '',
                    permission: 'public_html',
                    enabled: false,
                    itemSelector: '',
                    titleSelector: ''
                  })
                }
              >
                Hủy chỉnh sửa
              </button>
            )}
          </div>
        </form>
      </section>
    </>
  );
}

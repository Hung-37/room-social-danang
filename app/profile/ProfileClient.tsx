"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  notifySessionChanged,
  signOut as endSession,
} from "@/lib/client-session";
import type { User } from "@/lib/types";
import { useRouter } from "next/navigation";
type Saved = {
  id: string;
  title: string | null;
  imageUrl: string | null;
  available: number;
};
type Profile = {
  user: User & { createdAt: string };
  stats: { comments: number; reactions: number };
};
export default function ProfileClient() {
  const router = useRouter();
  const [data, setData] = useState<Profile | null>(null),
    [saved, setSaved] = useState<Saved[]>([]),
    [name, setName] = useState(""),
    [editing, setEditing] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [unauthorized, setUnauthorized] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/profile", { cache: "no-store" });
      const p = await r.json();
      if (r.status === 401) setUnauthorized(true);
      if (!r.ok) throw new Error(p.error);
      setUnauthorized(false);
      setData(p.data);
      setName(p.data.user.name);
      const f = await fetch("/api/favorites", { cache: "no-store" });
      const list = await f.json();
      if (!f.ok) throw new Error(list.error);
      setSaved(list.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa tải được hồ sơ.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setData((current) =>
        current
          ? { ...current, user: { ...current.user, ...p.data } }
          : current,
      );
      notifySessionChanged();
      setEditing(false);
      setNotice("Đã lưu hồ sơ vào tài khoản.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa thể lưu hồ sơ.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/favorites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, saved: false }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setSaved((current) => current.filter((s) => s.id !== id));
      window.dispatchEvent(new Event("favorites-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa thể bỏ lưu.");
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    try {
      await endSession();
      router.push("/");
      router.refresh();
    } catch {
      setError("Chưa thể đăng xuất. Hãy thử lại.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-shell profile-v8">
      <span className="section-eyebrow">Không gian của bạn</span>
      <h1>Hồ sơ & phòng đã lưu</h1>
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
      {loading ? (
        <p role="status">Đang tải hồ sơ...</p>
      ) : unauthorized ? (
        <Link className="primary-btn" href="/dang-nhap?next=%2Fprofile">
          Đăng nhập để xem hồ sơ
        </Link>
      ) : !data ? (
        <button className="primary-btn" onClick={load}>
          Thử tải lại
        </button>
      ) : (
        <>
          <div className="account-panel">
            <div className="account-avatar" aria-hidden="true">
              {data.user.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h2>{data.user.name}</h2>
              <p>{data.user.email}</p>
              <p>
                {data.user.role === "landlord" ? "Chủ trọ" : "Thành viên"} ·
                Tham gia{" "}
                {new Date(data.user.createdAt).toLocaleDateString("vi-VN")}
              </p>
            </div>
            <button
              className="secondary-btn"
              disabled={busy}
              onClick={() => {
                setEditing(!editing);
                setName(data.user.name);
              }}
            >
              {" "}
              {editing ? "Hủy chỉnh sửa" : "Chỉnh sửa hồ sơ"}
            </button>
          </div>
          {editing && (
            <form className="account-panel account-form" onSubmit={save}>
              <label htmlFor="profile-name">Tên hiển thị</label>
              <input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={80}
                required
                autoComplete="name"
              />
              <button className="primary-btn" disabled={busy}>
                {busy ? "Đang lưu..." : "Lưu hồ sơ"}
              </button>
            </form>
          )}
          <div className="account-stats">
            <div>
              <strong>{saved.length}</strong>
              <span>Bài đã lưu</span>
            </div>
            <div>
              <strong>{data.stats.comments}</strong>
              <span>Bình luận đã gửi</span>
            </div>
            <div>
              <strong>{data.stats.reactions}</strong>
              <span>Bài đã tương tác</span>
            </div>
          </div>
          <div className="account-links">
            <Link className="secondary-btn" href="/bai-viet-cua-toi">
              Bài viết của tôi
            </Link>
            <Link className="secondary-btn" href="/lich-xem-phong">
              Lịch xem phòng
            </Link>
            <Link className="secondary-btn" href="/tin-nhan">
              Tin nhắn riêng
            </Link>
            <Link className="secondary-btn" href="/thong-bao">
              Thông báo
            </Link>
            {data.user.role === "landlord" && (
              <Link className="primary-btn" href="/quan-ly-phong">
                Quản lý phòng
              </Link>
            )}
            <button className="text-button" disabled={busy} onClick={signOut}>
              Đăng xuất
            </button>
          </div>
          <section className="account-saved">
            <div className="section-heading">
              <h2>Danh sách đã lưu</h2>
              <Link className="text-link" href="/bang-tin">
                Tìm thêm phòng →
              </Link>
            </div>
            <p>
              Danh sách gắn với tài khoản, có thể mở trên thiết bị khác sau khi
              đăng nhập.
            </p>
            {!saved.length ? (
              <div className="route-feedback">
                Bạn chưa lưu bài nào. Nhấn biểu tượng lưu ở thẻ phòng hoặc thảo
                luận để tìm lại tại đây.
              </div>
            ) : (
              <div className="saved-grid">
                {saved.map((p) => (
                  <article className="saved-card" key={p.id}>
                    {p.available ? (
                      <>
                        {p.imageUrl && (
                          <img src={p.imageUrl} alt="" loading="lazy" />
                        )}
                        <h3>
                          <Link href={"/bai/" + encodeURIComponent(p.id)}>
                            {p.title}
                          </Link>
                        </h3>
                        <Link
                          className="text-link"
                          href={"/bai/" + encodeURIComponent(p.id)}
                        >
                          Xem chi tiết →
                        </Link>
                      </>
                    ) : (
                      <>
                        <h3>Tin không còn công khai</h3>
                        <p>
                          Phòng có thể đã hết, bị ẩn hoặc đang chờ duyệt lại.
                        </p>
                      </>
                    )}
                    <button
                      className="secondary-btn"
                      disabled={busy}
                      onClick={() => remove(p.id)}
                      aria-label={
                        "Bỏ lưu: " + (p.title || "Tin không còn công khai")
                      }
                    >
                      Bỏ lưu
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

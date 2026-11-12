"use client";
import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
type Visit = {
  roomDeleted?: boolean | number;
  id: string;
  conversationId: string;
  buyerId: string;
  sellerId: string;
  status: string;
  version: number;
  note: string;
  startsAt: string;
  endsAt: string;
  title: string;
  otherName: string;
};
const labels: Record<string, string> = {
  requested: "Chờ chủ trọ xác nhận",
  confirmed: "Đã xác nhận",
  declined: "Đã từ chối",
  cancelled: "Đã hủy",
  completed: "Đã xem phòng",
  expired: "Đã qua giờ hẹn",
};
export default function Appointments({
  conversation = "",
  user = "",
  blocked = false,
  buyer = false,
  roomUnavailable = false,
}: {
  conversation?: string;
  user?: string;
  blocked?: boolean;
  buyer?: boolean;
  roomUnavailable?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<Visit[]>([]),
    [viewer, setViewer] = useState(user),
    [history, setHistory] = useState(false),
    [date, setDate] = useState(""),
    [note, setNote] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [authorized, setAuthorized] = useState(true),
    [confirm, setConfirm] = useState<{ item: Visit; action: string } | null>(
      null,
    );
  useEffect(() => {
    let live = true,
      inFlight = false;
    const c = new AbortController();
    async function load() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        if (!viewer) {
          const r = await fetch("/api/auth/me", {
            cache: "no-store",
            signal: c.signal,
          });
          if (!r.ok) {
            if (r.status === 401) setAuthorized(false);
            throw new Error("Vui lòng đăng nhập để xem lịch.");
          }
          const p = await r.json();
          if (live) setViewer(p.data.id);
        }
        const p = new URLSearchParams(
          conversation ? { conversation } : { history: history ? "1" : "0" },
        );
        const r = await fetch("/api/appointments?" + p, {
          cache: "no-store",
          signal: c.signal,
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (live) {
          setItems(data.data);
          setLoadError("");
        }
      } catch (e) {
        if (live && !c.signal.aborted)
          setLoadError(e instanceof Error ? e.message : "Chưa tải được lịch.");
      } finally {
        if (live) setLoading(false);
        inFlight = false;
      }
    }
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      live = false;
      c.abort();
      clearInterval(timer);
    };
  }, [conversation, history, revision, viewer]);
  async function request(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation,
          startsAt: date + ":00+07:00",
          note,
        }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setDate("");
      setNote("");
      setNotice("Đã gửi đề xuất. Lịch chỉ được chốt khi chủ trọ xác nhận.");
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa gửi được lịch.");
    } finally {
      setBusy(false);
    }
  }
  async function change() {
    if (!confirm || busy) return;
    const target = confirm;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(
        "/api/appointments/" + encodeURIComponent(target.item.id),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: target.action,
            version: target.item.version,
          }),
        },
      );
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setItems((current) =>
        current.map((i) => (i.id === p.data.id ? { ...i, ...p.data } : i)),
      );
      setConfirm(null);
      setNotice("Đã cập nhật lịch và thông báo cho người còn lại.");
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa cập nhật được lịch.");
      setRevision((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }
  const active = items.some(
    (i) =>
      ["requested", "confirmed"].includes(i.status) &&
      new Date(i.endsAt).getTime() > Date.now(),
  );
  return (
    <section className="viewing-panel" aria-label="Lịch xem phòng">
      <div className="section-heading">
        <h2>{conversation ? "Hẹn xem phòng" : "Lịch hẹn của bạn"}</h2>
        {conversation && (
          <Link className="text-link" href="/lich-xem-phong">
            Xem tất cả lịch →
          </Link>
        )}
      </div>
      <p className="viewing-help">
        Giờ Việt Nam (UTC+7) · mỗi lượt xem 30 phút.
      </p>
      {!conversation && (
        <label className="visit-filter">
          Hiển thị lịch
          <select
            aria-label="Hiển thị lịch"
            value={history ? "history" : "upcoming"}
            onChange={(e) => {
              setHistory(e.target.value === "history");
              setItems([]);
              setLoading(true);
              setConfirm(null);
            }}
          >
            <option value="upcoming">Sắp tới và đang chờ</option>
            <option value="history">Lịch sử và lịch đã hủy</option>
          </select>
        </label>
      )}
      {(error || loadError) && (
        <p className="feedback feedback-error" role="alert">
          {error || loadError}
        </p>
      )}
      {notice && (
        <p className="feedback" role="status">
          {notice}
        </p>
      )}
      {!authorized && (
        <Link className="primary-btn" href="/dang-nhap?next=%2Flich-xem-phong">
          Đăng nhập để xem lịch
        </Link>
      )}
      {loading ? (
        <p role="status">Đang tải lịch...</p>
      ) : !items.length && authorized ? (
        <p>Chưa có lịch xem phòng trong mục này.</p>
      ) : null}
      {confirm && (
        <div
          className="visit-confirm"
          role="region"
          aria-label="Xác nhận cập nhật lịch"
        >
          <h3>
            {confirm.action === "confirm"
              ? "Xác nhận giờ hẹn này?"
              : confirm.action === "decline"
                ? "Từ chối đề xuất này?"
                : confirm.action === "cancel"
                  ? "Hủy lịch xem phòng?"
                  : "Đánh dấu đã xem phòng?"}
          </h3>
          <p>
            {new Date(confirm.item.startsAt).toLocaleString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          <div className="inline-actions">
            <button
              className="secondary-btn"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Quay lại
            </button>
            <button className="primary-btn" disabled={busy} onClick={change}>
              Đồng ý cập nhật
            </button>
          </div>
        </div>
      )}
      <div className="visit-list">
        {(conversation && !expanded ? items.slice(0, 3) : items).map((i) => {
          const past = new Date(i.endsAt).getTime() < Date.now();
          const state =
            past && ["requested", "confirmed"].includes(i.status)
              ? "expired"
              : i.status;
          const owner = i.sellerId === viewer;
          return (
            <article className="visit-card" key={i.id}>
              <span className={"visit-state visit-" + state}>
                {labels[state]}
              </span>
              {!conversation && (
                <>
                  <h3>{i.title}</h3>
                  {Boolean(i.roomDeleted) && (
                    <p role="status">
                      Phòng đã bị xóa. Bạn có thể hủy lịch hoặc xem lại lịch sử.
                    </p>
                  )}
                  <p>Với {i.otherName}</p>
                </>
              )}
              <p className="visit-time">
                <time dateTime={i.startsAt}>
                  {new Date(i.startsAt).toLocaleString("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </p>
              {i.note && <p className="visit-note">{i.note}</p>}
              <div className="visit-actions">
                {!past && i.status === "requested" && owner && (
                  <>
                    <button
                      className="primary-btn"
                      disabled={
                        busy ||
                        blocked ||
                        roomUnavailable ||
                        Boolean(i.roomDeleted)
                      }
                      onClick={() => setConfirm({ item: i, action: "confirm" })}
                    >
                      Xác nhận lịch
                    </button>
                    <button
                      className="secondary-btn"
                      disabled={busy}
                      onClick={() => setConfirm({ item: i, action: "decline" })}
                    >
                      Từ chối
                    </button>
                  </>
                )}
                {!past && ["requested", "confirmed"].includes(i.status) && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => setConfirm({ item: i, action: "cancel" })}
                  >
                    Hủy lịch
                  </button>
                )}
                {i.status === "confirmed" &&
                  owner &&
                  new Date(i.startsAt).getTime() <= Date.now() && (
                    <button
                      className="secondary-btn"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({ item: i, action: "complete" })
                      }
                    >
                      Đã xem phòng
                    </button>
                  )}
                {!conversation && (
                  <Link
                    className="text-link"
                    href={
                      "/tin-nhan?hoi-thoai=" +
                      encodeURIComponent(i.conversationId)
                    }
                  >
                    Mở hội thoại →
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {conversation && items.length > 3 && (
        <button
          className="text-button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Thu gọn lịch" : "Xem thêm lịch cũ"}
        </button>
      )}
      {conversation &&
        buyer &&
        !blocked &&
        !roomUnavailable &&
        !active &&
        !loading && (
          <details className="visit-request">
            <summary>Đề xuất giờ xem phòng</summary>
            <form onSubmit={request}>
              <label>
                Ngày giờ xem phòng (giờ Việt Nam)
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
              <p>Chọn giờ cách hiện tại ít nhất 1 giờ, trong 60 ngày tới.</p>
              <label>
                Ghi chú cho chủ trọ
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Số người đi xem, lưu ý khi liên hệ..."
                />
              </label>
              <button className="primary-btn" disabled={busy}>
                Gửi đề xuất lịch
              </button>
            </form>
          </details>
        )}
    </section>
  );
}

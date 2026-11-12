"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import Link from "next/link";
import Appointments from "@/components/Appointments";
import MessageSearch from "@/components/MessageSearch";
type Chat = {
  id: string;
  title: string;
  otherName: string;
  unread: number;
  blockedBy: string | null;
  lastMessage: string | null;
};
type Message = {
  id: number;
  senderId: string;
  body: string;
  createdAt: string;
};
export default function Inbox({ initial }: { initial: string }) {
  const [chats, setChats] = useState<Chat[]>([]),
    [active, setActive] = useState(initial),
    [items, setItems] = useState<Message[]>([]),
    [user, setUser] = useState(""),
    [blocked, setBlocked] = useState<string | null>(null),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false),
    [report, setReport] = useState("");
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [listLoading, setListLoading] = useState(false);
  const options = useRef({ query: "", filter: "all" });
  const [selected, setSelected] = useState<{
    title: string;
    otherName: string;
    buyer: boolean;
    listingDeleted?: boolean;
  } | null>(null);
  const [threadReady, setThreadReady] = useState(false);
  const generation = useRef(0);
  const stream = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    if (follow.current && stream.current)
      stream.current.scrollTop = stream.current.scrollHeight;
  }, [items]);
  const latest = useRef(0);
  const historyLoaded = useRef(false);
  async function refreshInbox(signal?: AbortSignal) {
    const current = { ...options.current };
    const key = JSON.stringify(current);
    const params = new URLSearchParams({
      q: current.query,
      filter: current.filter,
    });
    const r = await fetch("/api/chat?" + params, { cache: "no-store", signal });
    const p = await r.json();
    if (!r.ok) throw new Error(p.error);
    if (key === JSON.stringify(options.current)) setChats(p.data);
  }
  useEffect(() => {
    let live = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Vui lòng đăng nhập để mở hộp thư.");
        const p = await r.json();
        if (live) {
          setUser(p.data.id);
          await refreshInbox();
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    options.current = { query: query.trim(), filter };
    if (!user) return;
    const c = new AbortController();
    setListLoading(true);
    const timer = setTimeout(() => {
      void refreshInbox(c.signal)
        .catch((e) => {
          if (!c.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!c.signal.aborted) setListLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [query, filter, user]);
  useEffect(() => {
    if (!user || active) return;
    let live = true;
    let inFlight = false;
    const controller = new AbortController();
    const timer = setInterval(async () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        await refreshInbox(controller.signal);
      } catch (e) {
        if (live)
          setError(e instanceof Error ? e.message : "Chưa thể tải hộp thư.");
      } finally {
        inFlight = false;
      }
    }, 5000);
    return () => {
      live = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [user, active]);
  useEffect(() => {
    const gen = ++generation.current;
    setItems([]);
    setSelected(null);
    setThreadReady(false);
    latest.current = 0;
    follow.current = true;
    historyLoaded.current = false;
    setError("");
    setNotice("");
    setText("");
    if (!active || !user) return;
    let live = true;
    let inFlight = false;
    const controller = new AbortController();
    async function load() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const r = await fetch(
          "/api/chat/" +
            encodeURIComponent(active) +
            (latest.current ? "?after=" + latest.current : ""),
          { cache: "no-store", signal: controller.signal },
        );
        const p = await r.json();
        if (!r.ok) throw new Error(p.error);
        if (live && gen === generation.current) {
          setItems((current) => {
            const ids = new Set(current.map((m) => m.id));
            return [
              ...current,
              ...p.data.messages.filter((m: Message) => !ids.has(m.id)),
            ].sort((a, b) => a.id - b.id);
          });
          setSelected(p.data.conversation);
          setThreadReady(true);
          setBlocked(p.data.conversation.blockedBy);
          if (!latest.current && !historyLoaded.current)
            setMore(p.data.hasMore);
          latest.current = Math.max(
            latest.current,
            ...p.data.messages.map((m: Message) => m.id),
          );
          await fetch("/api/chat/" + encodeURIComponent(active), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "read", upto: latest.current }),
            signal: controller.signal,
          });
          await refreshInbox();
        }
      } catch (e) {
        if (live && !controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Chưa thể tải tin nhắn.");
      } finally {
        inFlight = false;
      }
    }
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      live = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [active, user]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy || !text.trim()) return;
    const target = active;
    const gen = generation.current;
    follow.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/chat/" + encodeURIComponent(target), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      if (gen === generation.current) {
        setItems((current) =>
          [...current.filter((m) => m.id !== p.data.id), p.data].sort(
            (a, b) => a.id - b.id,
          ),
        );
        setText("");
      }
      await refreshInbox();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Chưa thể gửi tin. Nội dung được giữ lại.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function action(value: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/chat/" + encodeURIComponent(active), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: value, reason: report }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      if (value === "block") setBlocked(user);
      if (value === "unblock") setBlocked(null);
      if (value === "report") {
        setReport("");
        setNotice("Đã gửi báo cáo tới quản trị viên.");
      }
      await refreshInbox();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa thể xử lý.");
    } finally {
      setBusy(false);
    }
  }
  async function older() {
    if (!items[0]) return;
    follow.current = false;
    const height = stream.current?.scrollHeight ?? 0;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/chat/${encodeURIComponent(active)}?before=${items[0].id}`,
        {
          cache: "no-store",
        },
      );
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setItems((current) => [
        ...p.data.messages.filter(
          (m: Message) => !current.some((c) => c.id === m.id),
        ),
        ...current,
      ]);
      setMore(p.data.hasMore);
      historyLoaded.current = true;
      requestAnimationFrame(() => {
        if (stream.current)
          stream.current.scrollTop += stream.current.scrollHeight - height;
      });
    } catch {
      setError("Chưa thể tải tin cũ.");
    } finally {
      setBusy(false);
    }
  }
  const current = chats.find((c) => c.id === active);
  return (
    <>
      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      {!user && !loading ? (
        <Link className="primary-btn" href="/dang-nhap?next=%2Ftin-nhan">
          Đăng nhập để nhắn tin
        </Link>
      ) : (
        <div className="inbox-layout">
          <aside className="inbox-list" aria-label="Cuộc trò chuyện">
            <div className="inbox-filters">
              <label>
                Tìm hội thoại
                <input
                  type="search"
                  maxLength={100}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tên người hoặc tên phòng..."
                />
              </label>
              <label>
                Lọc hội thoại
                <select
                  aria-label="Lọc hội thoại"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Tất cả</option>
                  <option value="unread">Chưa đọc</option>
                  <option value="blocked">Đã chặn</option>
                </select>
              </label>
              {listLoading && <p role="status">Đang lọc...</p>}
            </div>
            {loading ? (
              <p role="status">Đang tải...</p>
            ) : !chats.length ? (
              <p>
                {query || filter !== "all"
                  ? "Không có hội thoại phù hợp. Hãy thử từ khóa hoặc bộ lọc khác."
                  : "Chưa có cuộc trò chuyện. Mở một phòng và chọn “Nhắn chủ trọ”."}
              </p>
            ) : (
              chats.map((c) => (
                <button
                  key={c.id}
                  className={
                    active === c.id ? "chat-preview selected" : "chat-preview"
                  }
                  disabled={busy}
                  aria-pressed={active === c.id}
                  onClick={() => setActive(c.id)}
                >
                  <strong>{c.otherName}</strong>
                  <span>{c.title}</span>
                  <small>
                    {c.lastMessage || "Bắt đầu trao đổi về phòng"}{" "}
                    {Number(c.unread) > 0 && <b> · {c.unread} chưa đọc</b>}
                  </small>
                </button>
              ))
            )}
          </aside>
          <section className="chat-panel" aria-label="Nội dung tin nhắn">
            {!active ? (
              <div className="route-feedback">
                <h2>Chọn một cuộc trò chuyện</h2>
                <Link href="/bang-tin" className="text-link">
                  Tìm phòng để bắt đầu
                </Link>
              </div>
            ) : (
              <>
                <div className="chat-title">
                  <h2>
                    {selected?.otherName ||
                      current?.otherName ||
                      "Cuộc trò chuyện"}
                  </h2>
                  <p>{selected?.title || current?.title}</p>
                </div>
                {selected?.listingDeleted && (
                  <p role="status" className="chat-hint">
                    Tin phòng đã bị xóa. Lịch sử trao đổi được giữ để đối chiếu;
                    không thể đặt lịch mới cho tin này.
                  </p>
                )}
                {threadReady && (
                  <MessageSearch
                    key={`search:${active}`}
                    conversation={active}
                    user={user}
                  />
                )}
                {more && (
                  <button
                    className="text-button"
                    onClick={older}
                    disabled={busy}
                  >
                    Xem tin nhắn cũ hơn
                  </button>
                )}
                <div
                  ref={stream}
                  onScroll={() => {
                    if (stream.current)
                      follow.current =
                        stream.current.scrollHeight -
                          stream.current.scrollTop -
                          stream.current.clientHeight <
                        80;
                  }}
                  className="chat-messages"
                  tabIndex={0}
                  role="log"
                  aria-label="Lịch sử tin nhắn"
                  aria-live="polite"
                >
                  {items.map((m) => (
                    <article
                      key={m.id}
                      className={
                        m.senderId === user
                          ? "chat-message mine"
                          : "chat-message"
                      }
                    >
                      <p>{m.body}</p>
                      <time dateTime={m.createdAt}>
                        {new Date(m.createdAt).toLocaleString("vi-VN", {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: "Asia/Ho_Chi_Minh",
                        })}
                      </time>
                    </article>
                  ))}
                </div>
                {!threadReady ? (
                  <p role="status">
                    Đang mở hội thoại hoặc chưa được cấp quyền.
                  </p>
                ) : blocked ? (
                  <p className="feedback">Cuộc trò chuyện đang bị chặn.</p>
                ) : (
                  <form onSubmit={send} className="chat-compose">
                    <label htmlFor="private-message">Tin nhắn riêng</label>
                    <textarea
                      id="private-message"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      required
                      maxLength={3000}
                      rows={3}
                      placeholder="Hỏi về giá thuê, phí điện nước hoặc lịch xem phòng..."
                    />
                    <button className="primary-btn" disabled={busy}>
                      Gửi tin nhắn
                    </button>
                  </form>
                )}
                {threadReady && (
                  <Appointments
                    key={`appointments:${active}`}
                    conversation={active}
                    user={user}
                    blocked={!!blocked}
                    buyer={selected?.buyer}
                    roomUnavailable={selected?.listingDeleted}
                  />
                )}
                <div className="chat-tools">
                  {blocked === user ? (
                    <button
                      className="secondary-btn"
                      disabled={busy}
                      onClick={() => action("unblock")}
                    >
                      Bỏ chặn
                    </button>
                  ) : (
                    !blocked && (
                      <button
                        className="secondary-btn"
                        disabled={busy}
                        onClick={() => action("block")}
                      >
                        Chặn hội thoại
                      </button>
                    )
                  )}
                  <details>
                    <summary>Báo cáo cuộc trò chuyện</summary>
                    <label>
                      Lý do báo cáo
                      <textarea
                        value={report}
                        onChange={(e) => setReport(e.target.value)}
                        minLength={5}
                        maxLength={1000}
                        rows={3}
                      />
                    </label>
                    <button
                      className="secondary-btn"
                      disabled={busy || report.trim().length < 5}
                      onClick={() => action("report")}
                    >
                      Gửi báo cáo
                    </button>
                  </details>
                </div>
                {notice && <p role="status">{notice}</p>}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

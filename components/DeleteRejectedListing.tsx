"use client";
import { useId, useRef, useState, type FormEvent } from "react";

export default function DeleteRejectedListing({
  id,
  title,
  onDeleted,
}: {
  id: string;
  title: string;
  onDeleted: (id: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId(),
    description = useId(),
    reasonId = useId();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove(event: FormEvent) {
    event.preventDefault();
    if (busy || reason.trim().length < 10) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/admin/listings/" + encodeURIComponent(id),
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Chưa thể xóa tin.");
      dialog.current?.close();
      await onDeleted(id);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Mất kết nối. Lý do đã nhập được giữ lại để thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="danger-btn"
        aria-label={`Xóa tin: ${title}`}
        onClick={() => {
          setReason("");
          setError("");
          dialog.current?.showModal();
        }}
      >
        Xóa tin
      </button>
      <dialog
        className="delete-listing-dialog"
        ref={dialog}
        aria-labelledby={heading}
        aria-describedby={description}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <h2 id={heading}>Xóa tin đã bị từ chối?</h2>
        <p className="delete-listing-title">{title}</p>
        <p id={description}>
          Tin, ảnh và bình luận của tin sẽ bị xóa; không thể hoàn tác trên giao
          diện. Tin cùng mã nguồn sẽ không tự nhập lại. Lịch sử chat và lịch hẹn
          được giữ để đối chiếu.
        </p>
        <form onSubmit={remove}>
          <label htmlFor={reasonId}>Lý do xóa (10–500 ký tự)</label>
          <textarea
            id={reasonId}
            rows={4}
            minLength={10}
            maxLength={500}
            required
            autoFocus
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
          {error && (
            <p role="alert" className="delete-listing-error">
              {error}
            </p>
          )}
          <div className="delete-listing-actions">
            <button
              type="button"
              className="secondary-btn"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Giữ lại
            </button>
            <button
              type="submit"
              className="danger-btn"
              disabled={busy || reason.trim().length < 10}
            >
              {busy ? "Đang xóa..." : "Xác nhận xóa tin"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

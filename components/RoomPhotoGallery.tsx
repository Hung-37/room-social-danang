"use client";
import { useEffect, useId, useRef, useState } from "react";
import { roomPhotos } from "@/lib/policies/room-photos.js";
import RoomPhoto from "./RoomPhoto";
import Icon from "./Icons";

export default function RoomPhotoGallery({
  cover,
  images,
  title,
}: {
  cover?: string;
  images?: string[];
  title: string;
}) {
  const photos = roomPhotos(cover, images);
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const index = Math.max(0, photos.indexOf(selected));
  const current = photos[index];
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  const move = (step: number) =>
    setSelected(photos[(index + step + photos.length) % photos.length]);
  return (
    <section className="room-media" aria-label="Hình ảnh phòng">
      {current ? (
        <button
          type="button"
          className="detail-cover photo-open"
          aria-label={`Xem ảnh phòng ${index + 1} kích thước đầy đủ`}
          onClick={() => {
            dialog.current?.showModal();
            setOpen(true);
          }}
        >
          <RoomPhoto src={current} alt={`Ảnh ${index + 1}: ${title}`} eager />
          <span className="photo-open-hint">Xem ảnh đầy đủ</span>
          <span className="photo-number">
            {index + 1} / {photos.length}
          </span>
        </button>
      ) : (
        <div className="detail-cover">
          <RoomPhoto alt={`Phòng: ${title}`} />
        </div>
      )}
      {photos.length > 1 && (
        <div className="room-gallery" aria-label="Chọn ảnh phòng">
          {photos.map((url, position) => (
            <button
              key={url}
              type="button"
              aria-label={`Xem ảnh phòng ${position + 1}`}
              aria-pressed={current === url}
              onClick={() => setSelected(url)}
            >
              <RoomPhoto src={url} />
              <span className="photo-thumb-number">{position + 1}</span>
            </button>
          ))}
        </div>
      )}
      {current && (
        <dialog
          ref={dialog}
          className="photo-dialog"
          aria-labelledby={heading}
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) dialog.current?.close();
          }}
          onKeyDown={(event) => {
            if (
              photos.length > 1 &&
              (event.key === "ArrowLeft" || event.key === "ArrowRight")
            ) {
              event.preventDefault();
              move(event.key === "ArrowLeft" ? -1 : 1);
            }
          }}
        >
          <div className="photo-dialog-heading">
            <h2 id={heading}>{title}</h2>
            <button
              type="button"
              className="quiet-icon"
              aria-label="Đóng ảnh"
              autoFocus
              onClick={() => dialog.current?.close()}
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="photo-dialog-image">
            <RoomPhoto src={current} alt={`Ảnh ${index + 1}: ${title}`} eager />
          </div>
          <div className="photo-dialog-footer">
            <button
              type="button"
              className="secondary-btn"
              disabled={photos.length < 2}
              onClick={() => move(-1)}
            >
              Ảnh trước
            </button>
            <span role="status" aria-live="polite">
              Ảnh {index + 1} / {photos.length}
            </span>
            <button
              type="button"
              className="secondary-btn"
              disabled={photos.length < 2}
              onClick={() => move(1)}
            >
              Ảnh tiếp
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}

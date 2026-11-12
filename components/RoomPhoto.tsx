"use client";
import { useState } from "react";
import Icon from "./Icons";

export default function RoomPhoto({
  src,
  alt = "",
  eager = false,
}: {
  src?: string;
  alt?: string;
  eager?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  if (!src || failedSource === src)
    return (
      <div
        className="room-photo-empty"
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
      >
        <Icon name="home" />
        <span>{src ? "Ảnh chưa tải được" : "Chưa có ảnh phòng"}</span>
      </div>
    );
  return (
    <img
      className="room-photo"
      src={src}
      alt={alt}
      width={1600}
      height={1200}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailedSource(src)}
    />
  );
}

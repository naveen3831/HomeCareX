import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { adminBookingApi } from "@/services/adminBookingApi";
import type { AdminStartMedia } from "@/types/adminBooking";
import "./StartMediaGallery.css";

interface Props {
  bookingId: string;
  items: AdminStartMedia[];
}

/**
 * Photos / videos the partner added when starting the job. Click one to open it full screen,
 * then use the arrows (or swipe, or the keyboard arrows) to move between them.
 * Files come through the authenticated API as blobs; images load up front, videos when opened.
 */
export function StartMediaGallery({ bookingId, items }: Props) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<number | null>(null);
  const urlsRef = useRef<Record<string, string>>({});
  const loading = useRef<Set<string>>(new Set());
  const touchX = useRef<number | null>(null);

  const load = useCallback(
    (item: AdminStartMedia) => {
      if (urlsRef.current[item.key] || loading.current.has(item.key)) return;
      loading.current.add(item.key);
      adminBookingApi
        .getStartMedia(bookingId, item.key)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          urlsRef.current[item.key] = url;
          setUrls((u) => ({ ...u, [item.key]: url }));
        })
        .catch(() => setFailed((f) => ({ ...f, [item.key]: true })))
        .finally(() => loading.current.delete(item.key));
    },
    [bookingId],
  );

  // Images load straight away for the thumbnails.
  useEffect(() => {
    items.filter((i) => i.kind === "image").forEach(load);
  }, [items, load]);

  // A video loads when it is opened.
  useEffect(() => {
    if (open !== null && items[open]) load(items[open]);
  }, [open, items, load]);

  // Free the blob URLs when the booking changes or the drawer closes.
  useEffect(
    () => () => {
      Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = {};
    },
    [bookingId],
  );

  const count = items.length;
  const prev = () => setOpen((i) => (i === null ? i : (i - 1 + count) % count));
  const next = () => setOpen((i) => (i === null ? i : (i + 1) % count));

  useEffect(() => {
    if (open === null) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + count) % count));
      else if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % count));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open === null, count]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = open !== null ? items[open] : null;

  return (
    <section className="bd__card" aria-label="Start photos and videos">
      <div className="bd__card-h">
        <span className="bd__chip">
          <Camera size={16} aria-hidden="true" />
        </span>
        <h2>Start photos &amp; videos</h2>
      </div>
      <div className="bd__card-b">
        {count === 0 ? (
          <p className="bd__empty">The partner has not added any photos or videos yet.</p>
        ) : (
          <div className="smg__grid">
            {items.map((item, i) => (
              <button
                key={item.key}
                type="button"
                className="smg__thumb"
                onClick={() => setOpen(i)}
                aria-label={`Open ${item.kind} ${i + 1} of ${count}`}
              >
                {item.kind === "image" && urls[item.key] ? (
                  <img src={urls[item.key]} alt="" />
                ) : item.kind === "video" ? (
                  <span className="smg__video">
                    <Play size={22} aria-hidden="true" />
                    Video
                  </span>
                ) : failed[item.key] ? (
                  <span className="smg__video">Not available</span>
                ) : (
                  <span className="smg__video smg__pulse" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {current && open !== null && (
        <div
          className="smg__viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Start photo viewer"
          onClick={() => setOpen(null)}
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null || count < 2) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (dx > 50) prev();
            else if (dx < -50) next();
          }}
        >
          <div className="smg__bar" onClick={(e) => e.stopPropagation()}>
            <span>
              {open + 1} / {count}
            </span>
            <button type="button" className="smg__btn" onClick={() => setOpen(null)} aria-label="Close viewer">
              <X size={22} aria-hidden="true" />
            </button>
          </div>

          <div className="smg__stage" onClick={(e) => e.stopPropagation()}>
            {urls[current.key] ? (
              current.kind === "image" ? (
                <img key={current.key} src={urls[current.key]} alt={`Start photo ${open + 1}`} />
              ) : (
                <video key={current.key} src={urls[current.key]} controls playsInline autoPlay />
              )
            ) : failed[current.key] ? (
              <p>This file could not be loaded.</p>
            ) : (
              <p>Loading…</p>
            )}
          </div>

          {count > 1 && (
            <>
              <button
                type="button"
                className="smg__btn smg__prev"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="Previous"
              >
                <ChevronLeft size={26} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="smg__btn smg__next"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="Next"
              >
                <ChevronRight size={26} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

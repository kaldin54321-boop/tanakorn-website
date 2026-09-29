"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const GAME_STORE_IMAGES: string[] = [
  "https://cdn2.steamgriddb.com/thumb/f39b781760a403dedaa05587e8889c1a.jpg",
  "https://cdn2.steamgriddb.com/grid/3940304b536796dcc176aa83203a3955.png",
  "https://cdn2.steamgriddb.com/grid/c039e6496e67fdb3d46e6d5877e01ed2.png",
  "https://cdn2.steamgriddb.com/grid/352b19056ce934568b956d68cbcde3b5.png",
  "https://cdn2.steamgriddb.com/grid/df2e17d074624f35890b85b5ec3c6ad2.png",
  "https://cdn2.steamgriddb.com/grid/d6e426b58b11ad75f45e137a499a1066.png",
  "https://cdn2.steamgriddb.com/grid/b6cc4153e11f0917be8b737751264588.png",
  "https://cdn2.steamgriddb.com/grid/a85d6bc329aeaf43fe76fbb48b8b9325.png",
];

const AUTOPLAY_MS = 4000;

export default function GameStoresCarousel({
  images = GAME_STORE_IMAGES,
}: {
  images?: string[];
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);

  const goTo = useCallback(
    (next: number) => {
      setIndex(((next % images.length) + images.length) % images.length);
    },
    [images.length]
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (paused || dragging || images.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, dragging, images.length]);

  const endDrag = useCallback(
    (clientX: number) => {
      if (startX.current === null) return;
      const dx = clientX - startX.current;
      const width = viewportRef.current?.clientWidth ?? 0;
      const threshold = Math.min(90, width * 0.2);
      if (dx <= -threshold) next();
      else if (dx >= threshold) prev();
      startX.current = null;
      setDragging(false);
      setDragX(0);
    },
    [next, prev]
  );

  if (images.length === 0) return null;

  return (
    <div
      className="game-stores-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={viewportRef}
        className="game-stores-viewport"
        onPointerDown={(e) => {
          startX.current = e.clientX;
          setDragging(true);
          setDragX(0);
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (startX.current === null) return;
          setDragX(e.clientX - startX.current);
        }}
        onPointerUp={(e) => endDrag(e.clientX)}
        onPointerCancel={() => {
          startX.current = null;
          setDragging(false);
          setDragX(0);
        }}
      >
        <div
          className="game-stores-track"
          style={{
            transform: `translateX(calc(${-index * 100}% + ${dragX}px))`,
            transition: dragging ? "none" : undefined,
          }}
        >
          {images.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="game-stores-slide"
              aria-hidden={i !== index}
            >
              <img
                src={src}
                alt=""
                aria-hidden
                className="game-stores-slide-backdrop"
                loading="lazy"
                draggable={false}
              />
              <img
                src={src}
                alt={`Featured game ${i + 1}`}
                className="game-stores-slide-image"
                loading={i === 0 ? "eager" : "lazy"}
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="game-stores-arrow game-stores-arrow-left"
        onClick={prev}
        aria-label="Previous featured game"
      >
        ‹
      </button>
      <button
        type="button"
        className="game-stores-arrow game-stores-arrow-right"
        onClick={next}
        aria-label="Next featured game"
      >
        ›
      </button>

      <div className="game-stores-dots" role="tablist" aria-label="Featured games">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Go to featured game ${i + 1}`}
            className={
              i === index ? "game-stores-dot is-active" : "game-stores-dot"
            }
            onClick={() => goTo(i)}
          />
        ))}
      </div>

      <div className="game-stores-counter">
        {index + 1} / {images.length}
      </div>
    </div>
  );
}

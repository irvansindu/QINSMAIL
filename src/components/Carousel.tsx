'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type CarouselItemData = {
  id: string | number;
  title: string;
  description: string;
  icon?: React.ReactNode;
  content?: React.ReactNode;
};

type Props = {
  items: CarouselItemData[];
  baseWidth?: number;
  autoplay?: boolean;
  autoplayDelay?: number;
  pauseOnHover?: boolean;
  loop?: boolean;
  round?: boolean;
};

export default function Carousel({
  items,
  baseWidth = 880,
  autoplay = false,
  autoplayDelay = 3000,
  pauseOnHover = false,
  loop = false,
  round = false,
}: Props) {
  const itemsForRender = useMemo(() => {
    if (!loop) return items;
    if (items.length === 0) return [];
    return [items[items.length - 1], ...items, items[0]];
  }, [items, loop]);

  const [position, setPosition] = useState<number>(() => (loop ? 1 : 0));
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef<number>(0);
  const dragDx = useRef<number>(0);

  const realCount = items.length;
  const effectiveCount = itemsForRender.length;

  useEffect(() => {
    if (!autoplay) return;
    if (effectiveCount <= 1) return;
    if (pauseOnHover && hovered) return;

    const t = setInterval(() => {
      setPosition((p) => Math.min(p + 1, effectiveCount - 1));
    }, autoplayDelay);

    return () => clearInterval(t);
  }, [autoplay, autoplayDelay, effectiveCount, hovered, pauseOnHover]);

  const cardW = 320;
  const gap = 16;

  const clampPos = (p: number) => Math.max(0, Math.min(p, effectiveCount - 1));

  const clampedPosition = clampPos(position);

  const commitLoopJumpIfNeeded = (next: number) => {
    if (!loop || effectiveCount <= 1) return;
    const last = effectiveCount - 1;
    if (next === last) {
      setTimeout(() => setPosition(1), 220);
      return;
    }
    if (next === 0) {
      setTimeout(() => setPosition(realCount), 220);
    }
  };

  const goTo = (index: number) => {
    const next = clampPos(index);
    setPosition(next);
    commitLoopJumpIfNeeded(next);
  };

  const prev = () => {
    goTo(position - 1);
  };

  const next = () => {
    goTo(position + 1);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    dragStartX.current = e.clientX;
    dragDx.current = 0;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    dragDx.current = e.clientX - dragStartX.current;
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const dx = dragDx.current;
    dragDx.current = 0;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) next();
    else prev();
  };

  const activeIndex =
    realCount === 0
      ? 0
      : loop
        ? (clampedPosition - 1 + realCount) % realCount
        : Math.min(clampedPosition, realCount - 1);

  const trackX = -(clampedPosition * (cardW + gap));

  return (
    <div
      className={
        `relative w-full max-w-5xl mx-auto rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl ` +
        `shadow-[0_20px_80px_rgba(0,0,0,0.35)] overflow-hidden ${round ? 'rounded-full' : ''}`
      }
      style={{ maxWidth: `${baseWidth}px` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-6 py-6 sm:px-8 sm:py-7 border-b border-white/10 bg-linear-to-r from-fuchsia-500/10 via-pink-500/10 to-rose-500/10">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold bg-white/5 text-white/70 ring-1 ring-white/10 mb-2">
              <span className="h-2 w-2 rounded-full bg-fuchsia-300/90 shadow-[0_0_12px_rgba(232,121,249,0.5)]" />
              Panduan & Info
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Panduan Singkat</div>
            <div className="text-sm sm:text-[15px] text-white/70 mt-2 max-w-3xl">
              Email sementara untuk menerima pesan dengan cepat tanpa memakai email utama. Cocok untuk testing, trial aplikasi,
              verifikasi newsletter, dan kebutuhan sementara lainnya.
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={prev}
              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
              aria-label="Sebelumnya"
              disabled={!loop && position <= 0}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={next}
              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
              aria-label="Berikutnya"
              disabled={!loop && position >= effectiveCount - 1}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <div
          className="relative"
          style={{ perspective: 1000 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="overflow-hidden">
            <div
              className="flex"
              style={{
                gap: `${gap}px`,
                transform: `translateX(${trackX}px)`,
                transition: dragging ? 'none' : 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            >
              {itemsForRender.map((it, idx) => {
                const dist = idx - clampedPosition;
                const rotate = Math.max(-1, Math.min(1, dist)) * -18;
                const scale = dist === 0 ? 1 : 0.96;
                const opacity = dist === 0 ? 1 : 0.82;

                return (
                  <div
                    key={`${it.id}-${idx}`}
                    className={
                      `shrink-0 rounded-2xl border border-white/10 bg-[#0d0716]/70 backdrop-blur ` +
                      `shadow-[0_10px_40px_rgba(0,0,0,0.35)] overflow-hidden select-none ${round ? 'rounded-full' : ''}`
                    }
                    style={{
                      width: cardW,
                      transform: `rotateY(${rotate}deg) scale(${scale})`,
                      opacity,
                      transition: dragging ? 'none' : 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 260ms',
                      cursor: dragging ? 'grabbing' : 'grab',
                    }}
                  >
                    <div className="p-5 border-b border-white/10 bg-white/5">
                      <div className="flex items-start gap-3">
                        {it.icon ? (
                          <div className="h-10 w-10 rounded-2xl bg-white text-[#060010] flex items-center justify-center ring-1 ring-white/10">
                            {it.icon}
                          </div>
                        ) : null}
                        <div className="min-w-0">
                          <div className="text-base font-extrabold text-white leading-tight">{it.title}</div>
                          <div className="text-xs text-white/60 mt-1">{it.description}</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 text-sm text-white/75">
                      {it.content ?? null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPosition(loop ? i + 1 : i)}
                  className={
                    `h-2 w-2 rounded-full transition ` +
                    (activeIndex === i
                      ? 'bg-white shadow-[0_0_14px_rgba(255,255,255,0.55)]'
                      : 'bg-white/30 hover:bg-white/50')
                  }
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 text-center text-xs text-white/45">
            Tips: geser kiri/kanan untuk pindah kartu.
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './GooeyNav.module.css';

export type GooeyNavItem = {
  label: string;
  href: string;
};

export default function GooeyNav({
  items,
  animationTime = 600,
  particleCount = 15,
  particleDistances = [90, 10],
  particleR = 100,
  timeVariance = 300,
  colors = [1, 2, 3, 1, 2, 3, 1, 4],
  initialActiveIndex = 0,
}: {
  items: GooeyNavItem[];
  animationTime?: number;
  particleCount?: number;
  particleDistances?: [number, number];
  particleR?: number;
  timeVariance?: number;
  colors?: number[];
  initialActiveIndex?: number;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLUListElement | null>(null);
  const filterRef = useRef<HTMLSpanElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);

  const rngSeedRef = useRef<number>(0x12345678);
  const rand01 = () => {
    let t = (rngSeedRef.current += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return r;
  };

  const noise = (n = 1) => n / 2 - rand01() * n;

  const getXY = (distance: number, pointIndex: number, totalPoints: number): [number, number] => {
    const angle = ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180);
    return [distance * Math.cos(angle), distance * Math.sin(angle)];
  };

  const createParticle = (i: number, t: number, d: [number, number], r: number) => {
    const rotate = noise(r / 10);
    return {
      start: getXY(d[0], particleCount - i, particleCount),
      end: getXY(d[1] + noise(7), particleCount - i, particleCount),
      time: t,
      scale: 1 + noise(0.2),
      color: colors[Math.floor(rand01() * colors.length)] ?? 1,
      rotate: rotate > 0 ? (rotate + r / 20) * 10 : (rotate - r / 20) * 10,
    };
  };

  const makeParticles = (element: HTMLElement) => {
    const d = particleDistances;
    const r = particleR;
    const bubbleTime = animationTime * 2 + timeVariance;
    element.style.setProperty('--time', `${bubbleTime}ms`);

    for (let i = 0; i < particleCount; i++) {
      const t = animationTime * 2 + noise(timeVariance * 2);
      const p = createParticle(i, t, d, r);
      element.classList.remove(styles.active);

      setTimeout(() => {
        const particle = document.createElement('span');
        const point = document.createElement('span');
        particle.classList.add(styles.particle);
        particle.style.setProperty('--start-x', `${p.start[0]}px`);
        particle.style.setProperty('--start-y', `${p.start[1]}px`);
        particle.style.setProperty('--end-x', `${p.end[0]}px`);
        particle.style.setProperty('--end-y', `${p.end[1]}px`);
        particle.style.setProperty('--time', `${p.time}ms`);
        particle.style.setProperty('--scale', `${p.scale}`);
        particle.style.setProperty('--color', `var(--color-${p.color}, white)`);
        particle.style.setProperty('--rotate', `${p.rotate}deg`);

        point.classList.add(styles.point);
        particle.appendChild(point);
        element.appendChild(particle);

        requestAnimationFrame(() => {
          element.classList.add(styles.active);
        });

        setTimeout(() => {
          try {
            element.removeChild(particle);
          } catch {
            // ignore
          }
        }, t);
      }, 30);
    }
  };

  const updateEffectPosition = (element: HTMLElement) => {
    if (!containerRef.current || !filterRef.current || !textRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const pos = element.getBoundingClientRect();

    const styleObj: Partial<CSSStyleDeclaration> = {
      left: `${pos.x - containerRect.x}px`,
      top: `${pos.y - containerRect.y}px`,
      width: `${pos.width}px`,
      height: `${pos.height}px`,
    };

    Object.assign(filterRef.current.style, styleObj);
    Object.assign(textRef.current.style, styleObj);
    textRef.current.innerText = element.innerText;
  };

  const clearParticles = () => {
    if (!filterRef.current) return;
    const particles = filterRef.current.querySelectorAll(`.${styles.particle}`);
    particles.forEach((p) => {
      try {
        filterRef.current?.removeChild(p);
      } catch {
        // ignore
      }
    });
  };

  const triggerText = () => {
    if (!textRef.current) return;
    textRef.current.classList.remove(styles.active);
    void textRef.current.offsetWidth;
    textRef.current.classList.add(styles.active);
  };

  const onActivate = (liEl: HTMLElement, index: number) => {
    if (activeIndex === index) return;
    setActiveIndex(index);
    updateEffectPosition(liEl);
    clearParticles();
    triggerText();
    if (filterRef.current) makeParticles(filterRef.current);
  };

  const anchors = useMemo(() => items.map((it) => it.href), [items]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, index: number) => {
    e.preventDefault();
    const liEl = e.currentTarget.parentElement;
    if (!liEl) return;
    onActivate(liEl, index);

    const href = anchors[index];
    if (!href) return;
    if (href.startsWith('#')) {
      const id = href.replace('#', '');
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const liEl = e.currentTarget.parentElement;
      if (liEl) onActivate(liEl, index);
    }
  };

  useEffect(() => {
    if (!navRef.current || !containerRef.current) return;
    const activeLi = navRef.current.querySelectorAll('li')[activeIndex] as HTMLElement | undefined;
    if (activeLi) {
      updateEffectPosition(activeLi);
      textRef.current?.classList.add(styles.active);
    }

    const resizeObserver = new ResizeObserver(() => {
      const currentActiveLi = navRef.current?.querySelectorAll('li')[activeIndex] as HTMLElement | undefined;
      if (currentActiveLi) updateEffectPosition(currentActiveLi);
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [activeIndex]);

  return (
    <div className={styles.container} ref={containerRef}>
      <svg className={styles.svg} width="0" height="0" aria-hidden="true">
        <filter id="gooey">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
            result="gooey"
          />
          <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
        </filter>
      </svg>

      <nav className={styles.nav}>
        <ul ref={navRef} className={styles.list}>
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`} className={index === activeIndex ? styles.liActive : ''}>
              <a href={item.href} onClick={(e) => handleClick(e, index)} onKeyDown={(e) => handleKeyDown(e, index)}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <span className={`${styles.effect} ${styles.filter}`} ref={filterRef} />
      <span className={`${styles.effect} ${styles.text}`} ref={textRef} />
    </div>
  );
}

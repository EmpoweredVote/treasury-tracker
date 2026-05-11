import { createPortal } from 'react-dom';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useTheme } from '../hooks/useTheme';

interface Props {
  visible: boolean;
}

interface Drawing {
  arrowPath: string;
  label1: { x: number; y: number };
  label2: { x: number; y: number };
}

let fontInjected = false;
function ensureCaveatFont() {
  if (fontInjected || document.querySelector('link[href*="Caveat"]')) { fontInjected = true; return; }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&display=swap';
  document.head.appendChild(link);
  fontInjected = true;
}

export default function DonateArrow({ visible }: Props) {
  const { isDark } = useTheme();
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);

  const measure = useCallback(() => {
    if (!visible || window.innerWidth < 768) { setDrawing(null); return; }

    const btn  = document.querySelector<HTMLElement>('[data-donate-btn]');
    const card = document.querySelector<HTMLElement>('[data-donate-target]');
    if (!btn || !card) return;

    const br = btn.getBoundingClientRect();
    const cr = card.getBoundingClientRect();

    const sx = cr.left + cr.width * 0.35;
    const sy = cr.top - 2;
    const ex = br.left + br.width * 0.5;
    const ey = br.bottom + 14;

    const cp1x = sx + 60;
    const cp1y = sy - 80;
    const cp2x = ex + 20;
    const cp2y = ey + 100;

    const arrowPath = `M ${sx},${sy} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`;
    const label1 = { x: sx - 18, y: sy - 12 };
    const label2 = { x: br.right + 10, y: br.top + br.height * 0.5 };

    setDrawing({ arrowPath, label1, label2 });
  }, [visible]);

  useEffect(() => { ensureCaveatFont(); }, []);

  // Poll until the card is in its final position, then measure + attach hover listeners.
  useEffect(() => {
    let attempts = 0;
    let raf: number;
    let ro: ResizeObserver | null = null;

    const onEnter = () => setHovered(true);
    const onLeave = () => setHovered(false);

    function attachListeners(card: HTMLElement) {
      if (cardRef.current === card) return; // already attached
      if (cardRef.current) {
        cardRef.current.removeEventListener('mouseenter', onEnter);
        cardRef.current.removeEventListener('mouseleave', onLeave);
      }
      card.addEventListener('mouseenter', onEnter);
      card.addEventListener('mouseleave', onLeave);
      cardRef.current = card;
    }

    function poll() {
      const card = document.querySelector<HTMLElement>('[data-donate-target]');
      if (card && card.getBoundingClientRect().bottom > 300) {
        measure();
        attachListeners(card);
        ro = new ResizeObserver(measure);
        ro.observe(card);
      } else if (attempts++ < 40) {
        raf = requestAnimationFrame(poll);
      }
    }
    raf = requestAnimationFrame(poll);

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
      ro?.disconnect();
      if (cardRef.current) {
        cardRef.current.removeEventListener('mouseenter', onEnter);
        cardRef.current.removeEventListener('mouseleave', onLeave);
      }
    };
  }, [measure]);

  if (!drawing || !visible) return null;

  const { arrowPath, label1, label2 } = drawing;
  const color = isDark ? '#FACC15' : '#3AABB8';
  const font  = "'Caveat', cursive";

  return createPortal(
    <svg
      style={{
        position: 'fixed', inset: 0, width: '100vw', height: '100vh',
        pointerEvents: 'none', zIndex: 30, overflow: 'visible',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}
      aria-hidden="true"
    >
      <defs>
        <marker id="donate-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={color} fillOpacity="0.85" />
        </marker>
      </defs>

      <path d={arrowPath} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeOpacity="0.85" markerEnd="url(#donate-arrowhead)" />

      <text x={label1.x} y={label1.y} textAnchor="end" dominantBaseline="auto"
        fontSize="26" fontFamily={font} fontWeight="500" fill={color} fillOpacity="0.9">
        If you want to watch this go up...
      </text>

      <text x={label2.x} y={label2.y} textAnchor="start" dominantBaseline="middle"
        fontSize="26" fontFamily={font} fontWeight="500" fill={color} fillOpacity="0.9">
        go here.
      </text>
    </svg>,
    document.body,
  );
}

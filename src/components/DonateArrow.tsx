import { createPortal } from 'react-dom';
import { useEffect, useState, useCallback } from 'react';

interface Props {
  visible: boolean;
}

interface Drawing {
  circlePath: string;
  arrowPath: string;
  label1: { x: number; y: number };  // "If you want to watch this go up..." — horizontal above circle
  label2: { x: number; y: number };  // "go here." — below arrow tip
}

// Inject Caveat handwriting font once.
let fontInjected = false;
function ensureCaveatFont() {
  if (fontInjected || document.querySelector('link[href*="Caveat"]')) { fontInjected = true; return; }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&display=swap';
  document.head.appendChild(link);
  fontInjected = true;
}

// Slightly wobbly closed ellipse — pen-circled look.
function roughEllipse(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.552;
  return [
    `M ${cx - rx},${cy + 3}`,
    `C ${cx - rx},${cy - k * ry - 3} ${cx - k * rx + 2},${cy - ry - 2} ${cx + 1},${cy - ry - 2}`,
    `C ${cx + k * rx},${cy - ry + 1} ${cx + rx + 2},${cy - k * ry} ${cx + rx + 1},${cy}`,
    `C ${cx + rx},${cy + k * ry + 2} ${cx + k * rx - 2},${cy + ry + 1} ${cx - 2},${cy + ry + 2}`,
    `C ${cx - k * rx + 1},${cy + ry} ${cx - rx + 1},${cy + k * ry - 2} ${cx - rx},${cy + 3}`,
    `Z`,
  ].join(' ');
}

export default function DonateArrow({ visible }: Props) {
  const [drawing, setDrawing] = useState<Drawing | null>(null);

  const measure = useCallback(() => {
    if (!visible || window.innerWidth < 768) { setDrawing(null); return; }

    const btn  = document.querySelector<HTMLElement>('[data-donate-btn]');
    const card = document.querySelector<HTMLElement>('[data-donate-target]');
    if (!btn || !card) return;

    const br = btn.getBoundingClientRect();
    const cr = card.getBoundingClientRect();

    // Circle: anchor by its top-left corner so the topmost point sits over "Money In".
    // The card has ~16px top padding before the label, so cy - ry ≈ cr.top + 16.
    const ry = cr.height * 0.52;
    const cy = cr.top + ry + 16;   // top of oval is over the "Money In" label
    const rx = cr.width  * 0.22;
    const cx = cr.left + rx + 18;  // left of oval hugs the card's left padding
    const circlePath = roughEllipse(cx, cy, rx, ry);

    // Arrow: from the upper-right of the circle up to just below the Donate button.
    const sx = cx + rx * 0.8;
    const sy = cy - ry;
    const ex = br.left + br.width  * 0.5;
    const ey = br.bottom + 18;

    // Curve sweeps right then up.
    const cp1x = sx + 90;
    const cp1y = sy - 60;
    const cp2x = ex + 30;
    const cp2y = ey + 120;

    const arrowPath = `M ${sx},${sy} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`;

    // Label 1: horizontal, centred above the circle.
    const label1 = { x: cx, y: cy - ry - 10 };

    // Label 2: well below the arrowhead so it doesn't overlap the arrow line.
    const label2 = { x: ex, y: ey + 28 };

    setDrawing({ circlePath, arrowPath, label1, label2 });
  }, [visible]);

  useEffect(() => {
    ensureCaveatFont();
  }, []);

  useEffect(() => {
    let attempts = 0;
    let raf: number;

    function poll() {
      const card = document.querySelector<HTMLElement>('[data-donate-target]');
      if (card && card.getBoundingClientRect().bottom > 300) {
        measure();
      } else if (attempts++ < 40) {
        raf = requestAnimationFrame(poll);
      }
    }
    raf = requestAnimationFrame(poll);

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });

    let ro: ResizeObserver | null = null;
    const card = document.querySelector<HTMLElement>('[data-donate-target]');
    if (card) { ro = new ResizeObserver(measure); ro.observe(card); }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
      ro?.disconnect();
    };
  }, [measure]);

  if (!drawing || !visible) return null;

  const { circlePath, arrowPath, label1, label2 } = drawing;
  const color = '#3AABB8';
  const font  = "'Caveat', cursive";

  return createPortal(
    <svg
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 30, overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        <marker id="donate-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={color} fillOpacity="0.85" />
        </marker>
      </defs>

      {/* Pen circle — tight around the dollar amount */}
      <path d={circlePath} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeOpacity="0.85" />

      {/* Arrow sweeping up to just below the Donate button */}
      <path d={arrowPath} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeOpacity="0.85" markerEnd="url(#donate-arrowhead)" />

      {/* "If you want to watch this go up..." — horizontal, above the circle */}
      <text
        x={label1.x}
        y={label1.y}
        textAnchor="middle"
        dominantBaseline="auto"
        fontSize="26"
        fontFamily={font}
        fontWeight="500"
        fill={color}
        fillOpacity="0.9"
      >
        If you want to watch this go up...
      </text>

      {/* "go here." — below the Donate button, right of arrow tip */}
      <text
        x={label2.x}
        y={label2.y}
        textAnchor="middle"
        dominantBaseline="hanging"
        fontSize="26"
        fontFamily={font}
        fontWeight="500"
        fill={color}
        fillOpacity="0.9"
      >
        go here.
      </text>
    </svg>,
    document.body,
  );
}

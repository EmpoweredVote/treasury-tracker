import { createPortal } from 'react-dom';
import { useEffect, useState, useCallback } from 'react';

interface Props {
  visible: boolean;
}

interface Drawing {
  circlePath: string;
  arrowPath: string;
  label1: { x: number; y: number; angle: number }; // "If you want to watch this go up..."
  label2: { x: number; y: number };                 // "go here"
}

// Slightly irregular closed ellipse path — looks like a quick pen circle.
function roughEllipse(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.552;
  return [
    `M ${cx - rx},${cy + 4}`,
    `C ${cx - rx},${cy - k * ry - 4} ${cx - k * rx + 3},${cy - ry} ${cx + 2},${cy - ry - 3}`,
    `C ${cx + k * rx},${cy - ry + 1} ${cx + rx + 3},${cy - k * ry} ${cx + rx + 2},${cy}`,
    `C ${cx + rx - 1},${cy + k * ry + 3} ${cx + k * rx - 2},${cy + ry + 2} ${cx - 3},${cy + ry + 1}`,
    `C ${cx - k * rx + 2},${cy + ry} ${cx - rx + 1},${cy + k * ry - 2} ${cx - rx},${cy + 4}`,
    `Z`,
  ].join(' ');
}

function bezierAt(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function bezierTangent(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
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

    // Pen circle around the Money In card
    const cx  = cr.left + cr.width  / 2;
    const cy  = cr.top  + cr.height / 2;
    const rx  = cr.width  / 2 + 10;
    const ry  = cr.height / 2 + 10;
    const circlePath = roughEllipse(cx, cy, rx, ry);

    // Arrow starts from the upper-right of the circle, ends just below the Donate button.
    const sx = cx + rx * 0.65;
    const sy = cy - ry;
    const ex = br.left + br.width  * 0.5;
    const ey = br.bottom + 16;

    // Control points: pull outward from each endpoint to create a sweeping S-curve.
    const cp1x = sx + 55;
    const cp1y = sy - 50;
    const cp2x = ex + 45;
    const cp2y = ey + 90;

    const arrowPath = `M ${sx},${sy} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`;

    // Label 1 — "If you want to watch this go up..." near the Money In card (t ≈ 0.08)
    const T1 = 0.08;
    const l1x    = bezierAt(T1, sx, cp1x, cp2x, ex);
    const l1y    = bezierAt(T1, sy, cp1y, cp2y, ey);
    const dx1    = bezierTangent(T1, sx, cp1x, cp2x, ex);
    const dy1    = bezierTangent(T1, sy, cp1y, cp2y, ey);
    const raw1   = Math.atan2(dy1, dx1) * (180 / Math.PI);
    const angle1 = dx1 < 0 ? raw1 + 180 : raw1;

    // Label 2 — "go here" just below the Donate button
    const l2x = ex;
    const l2y = ey + 6;

    setDrawing({ circlePath, arrowPath, label1: { x: l1x, y: l1y, angle: angle1 }, label2: { x: l2x, y: l2y } });
  }, [visible]);

  useEffect(() => {
    // Poll until the Money In card has settled into its final position.
    // The card starts near the top (y≈0) while React is still rendering, so we
    // keep trying until its bottom edge is meaningfully below the controls bar.
    let attempts = 0;
    let raf: number;

    function poll() {
      const card = document.querySelector<HTMLElement>('[data-donate-target]');
      // Require the card bottom to be at least 300px from the top of the viewport
      // before we trust the measurement.
      if (card && card.getBoundingClientRect().bottom > 300) {
        measure();
      } else if (attempts++ < 40) {
        raf = requestAnimationFrame(poll);
      }
    }
    raf = requestAnimationFrame(poll);

    // Re-measure on resize/scroll.
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });

    // Re-measure whenever the card itself changes size (e.g. data loads).
    let ro: ResizeObserver | null = null;
    const card = document.querySelector<HTMLElement>('[data-donate-target]');
    if (card) {
      ro = new ResizeObserver(measure);
      ro.observe(card);
    }

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

      {/* Pen circle around Money In card */}
      <path d={circlePath} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeOpacity="0.8" />

      {/* Sweeping arrow from circle → below Donate button */}
      <path d={arrowPath} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeOpacity="0.85" markerEnd="url(#donate-arrowhead)" />

      {/* "If you want to watch this go up..." — rotated to follow the arrow near the card */}
      <text
        transform={`translate(${label1.x},${label1.y}) rotate(${label1.angle})`}
        textAnchor="middle"
        dy="-9"
        fontSize="12"
        fontFamily="Georgia,'Times New Roman',serif"
        fontStyle="italic"
        fill={color}
        fillOpacity="0.85"
      >
        If you want to watch this go up...
      </text>

      {/* "go here" — below the Donate button */}
      <text
        x={label2.x}
        y={label2.y}
        textAnchor="middle"
        dominantBaseline="hanging"
        fontSize="12"
        fontFamily="Georgia,'Times New Roman',serif"
        fontStyle="italic"
        fill={color}
        fillOpacity="0.85"
      >
        go here.
      </text>
    </svg>,
    document.body,
  );
}

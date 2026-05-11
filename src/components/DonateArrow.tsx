import { createPortal } from 'react-dom';
import { useEffect, useState, useCallback } from 'react';

interface Props {
  visible: boolean;
}

interface Paths {
  fwd: string;   // card → button (arrowhead at button end)
  tmx: number;   // text midpoint x
  tmy: number;   // text midpoint y
  angle: number; // text rotation (degrees)
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
  const [paths, setPaths] = useState<Paths | null>(null);

  const measure = useCallback(() => {
    if (!visible || window.innerWidth < 768) { setPaths(null); return; }

    const btn  = document.querySelector<HTMLElement>('[data-donate-btn]');
    const card = document.querySelector<HTMLElement>('[data-donate-target]');
    if (!btn || !card) return;

    const br = btn.getBoundingClientRect();
    const cr = card.getBoundingClientRect();

    // Arrow: FROM the money-in card TO the donate button (arrowhead points at button).
    // Start at the upper-left area of the card; end at the bottom-center of the button.
    const sx = cr.left + cr.width * 0.38;
    const sy = cr.top + 10;
    const ex = br.left + br.width * 0.5;
    const ey = br.top + br.height * 0.5;

    // S-curve: initially pull leftward from the card, then sweep right/up to the button.
    // This mirrors the hand-drawn arc in the sketch.
    const cp1x = sx - 110;
    const cp1y = sy - 70;
    const cp2x = ex - 55;
    const cp2y = ey + 130;

    const fwd = `M ${sx},${sy} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`;

    // Text midpoint at t=0.45 (slightly before center, in the sweeping arc area)
    const T = 0.45;
    const tmx = bezierAt(T, sx, cp1x, cp2x, ex);
    const tmy = bezierAt(T, sy, cp1y, cp2y, ey);

    // Angle: use the tangent direction so the text tilts naturally with the curve.
    // When the path is going leftward (dx < 0) at the text position, flip 180° so
    // text reads left-to-right rather than appearing reversed.
    const dx = bezierTangent(T, sx, cp1x, cp2x, ex);
    const dy = bezierTangent(T, sy, cp1y, cp2y, ey);
    const rawAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    const angle = dx < 0 ? rawAngle + 180 : rawAngle;

    setPaths({ fwd, tmx, tmy, angle });
  }, [visible]);

  useEffect(() => {
    const t = setTimeout(measure, 200);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [measure]);

  if (!paths || !visible) return null;

  const { fwd, tmx, tmy, angle } = paths;

  // Teal brand color — visible in both light and dark mode.
  const color = '#3AABB8';

  return createPortal(
    <svg
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 30,
        overflow: 'visible',
      }}
      aria-hidden="true"
    >
      <defs>
        <marker
          id="donate-arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill={color} fillOpacity="0.85" />
        </marker>
      </defs>

      {/* Arrow curve */}
      <path
        d={fwd}
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeOpacity="0.85"
        markerEnd="url(#donate-arrowhead)"
      />

      {/* Annotation text, rotated to follow the curve at the midpoint */}
      <text
        transform={`translate(${tmx}, ${tmy}) rotate(${angle})`}
        textAnchor="middle"
        dominantBaseline="auto"
        dy="-9"
        fontSize="12.5"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fill={color}
        fillOpacity="0.85"
      >
        If you want to watch this go up, go here.
      </text>
    </svg>,
    document.body,
  );
}

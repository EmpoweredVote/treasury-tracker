/**
 * FeatureIconRow — the visible tethered feature-icon chip row (ICON-01/02),
 * ported from Essentials' `FeatureIconChip` (SectionBanner.jsx) to TT/TS.
 *
 * Each chip is a circular semi-transparent navy chip wrapping an external
 * link, with an accessible hover+keyboard-focus tooltip naming the product.
 * Icons always use the registry's `-light` SVG symbol on the navy chip in
 * BOTH themes (D-126-03) — the chip's own background guarantees legibility,
 * so this component never branches on TT's light/dark theme.
 */

import { useState } from 'react';
import {
  useFloating,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  offset,
  flip,
  shift,
  autoUpdate,
} from '@floating-ui/react';
import type { FeatureIcon } from '../utils/featureIcons';

export function FeatureIconChip({ icon }: { icon: FeatureIcon }) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'top',
    middleware: [offset(8), flip(), shift({ padding: 4 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context);
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  return (
    <>
      <a
        ref={refs.setReference}
        href={icon.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={icon.label}
        className="inline-flex items-center justify-center w-9 h-9 rounded-full"
        style={{
          // Semi-transparent navy chip — legible over any banner art in both
          // TT light and dark themes (D-126-03).
          background: 'rgba(13, 17, 23, 0.55)',
          backdropFilter: 'blur(2px)',
        }}
        {...getReferenceProps()}
      >
        {/* object-contain keeps non-square glyphs (e.g. the tall CTC trophy)
            from being distorted while a square symbol still fills the box. */}
        <img src={icon.iconSrc} alt="" aria-hidden="true" className="w-5 h-5 object-contain" />
      </a>

      {isOpen && (
        <FloatingPortal>
          <div
            // @floating-ui/react's refs.setFloating is a stable ref-callback
            // *setter*, not a mutable `.current` read; the compiler-based
            // react-hooks/refs rule false-positives on it (disabled below).
            ref={refs.setFloating} // eslint-disable-line react-hooks/refs
            style={{
              ...floatingStyles,
              zIndex: 70,
              background: '#2F3237',
              color: '#EBEDEF',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: "'Manrope', sans-serif",
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
            {...getFloatingProps()}
          >
            {icon.label}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

/**
 * FeatureIconRow — a right-aligned flex row of `FeatureIconChip`s. Layout-
 * neutral (no absolute positioning) — the parent wires bottom-right placement
 * on the hero banner (App.tsx). Renders nothing for an empty `icons` array
 * (ICON-03: no empty wrapper div for a location with no live icons).
 */
export function FeatureIconRow({ icons }: { icons: FeatureIcon[] }) {
  if (icons.length === 0) return null;

  return (
    <div className="flex items-center justify-end gap-2">
      {icons.map((icon) => (
        <FeatureIconChip key={icon.key} icon={icon} />
      ))}
    </div>
  );
}

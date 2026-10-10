import { useEffect, useState } from 'react';

/**
 * Track a CSS media query from React.
 *
 * @param query    any `window.matchMedia` query
 * @param fallback what to report where `matchMedia` does not exist — server
 *   rendering, and jsdom, which implements none of it.
 *
 * ⚠⚠ THE FALLBACK IS NOT A DETAIL. A caller that disables something below a
 * breakpoint must default to ENABLED, so that an environment which cannot
 * answer the question renders the fuller behaviour rather than silently
 * stripping it. `renderToStaticMarkup` takes this path on every render.
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  const read = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : fallback;

  const [matches, setMatches] = useState(read);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const sync = () => setMatches(mql.matches);
    sync();                                   // the query may differ from first paint
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, [query]);

  return matches;
}

/** Tailwind's `sm`. Kept here so the number lives in one place. */
export const SM_QUERY = '(min-width: 640px)';

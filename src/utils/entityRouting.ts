/**
 * What a `?entity=<slug>` deep link resolves to.
 *
 * Extracted from App.tsx's mount effect so the decision is pure and testable —
 * see entityRouting.test.ts. The slug format is owned by `toSlug` in App.tsx
 * (`<name-hyphenated>-<state>`); this module only compares against it.
 *
 * ── ⚠ WHY THIS IS NOT A `?? fallback` ──────────────────────────────────────
 *
 * It used to be. App.tsx resolved an unmatched slug as
 *
 *     matched ?? list.find(m => m.name === 'Bloomington' && m.state === 'IN') ?? list[0]
 *
 * so a stale or mistyped link silently rendered Bloomington, Indiana's budget,
 * with nothing on the page saying the requested entity was not found. Because
 * the slug derives from `name`, **renaming any entity invalidated every link
 * ever shared to it**, and every one of those landed on Bloomington.
 *
 * A real budget for the wrong place is worse than no budget: the page looks
 * authoritative and the numbers are someone else's. So an unmatched slug
 * resolves to `not_found` and the caller shows a landing state that names what
 * was asked for. `list[0]` is not an improvement — it has the identical
 * failure, just less obviously.
 */

import type { Municipality } from '../types/budget';

/**
 * The URL slug for an entity: `<name-hyphenated>-<state>`.
 *
 * The single definition — App.tsx imports this for `syncURL` rather than
 * keeping its own copy, so the writer and the reader of a `?entity=` link
 * cannot drift apart. Drift here is invisible: it does not throw, it just
 * stops matching, and before this module that meant landing on Bloomington.
 */
export function toSlug(m: Municipality): string {
  return slugify(m.name, m.state);
}

/**
 * The slug transform itself, over a bare name and state.
 *
 * ⚠ `toSlug` delegates here rather than the other way round, so alias slugs and
 * entity slugs cannot be computed differently. The docblock above is about
 * exactly this: a second copy of this transform does not throw when it drifts,
 * it just quietly stops matching. Aliases would then resolve to nothing and
 * look like missing data rather than a bug.
 */
function slugify(name: string, state: string): string {
  return `${name.toLowerCase().replace(/\s+/g, '-')}-${state.toLowerCase()}`;
}

/**
 * A name an entity used to be published under.
 *
 * Carries NAMES, not slugs, for the reason in `slugify`: the API that serves
 * these must not own a second implementation of the slug format. It states
 * what a publisher called the place; TT decides what that slugs to.
 */
export interface EntityAlias {
  aliasName: string;
  state: string;
  canonicalName: string;
}

export type EntityParamResolution =
  | { kind: 'matched'; entity: Municipality }
  | { kind: 'aliased'; entity: Municipality; requestedSlug: string; canonicalSlug: string }
  | { kind: 'not_found'; slug: string };

/**
 * Resolve a `?entity=` slug against the municipality list. Never substitutes a
 * different entity: no match means `not_found`, carrying the slug so the caller
 * can name it.
 */
export function resolveEntityParam(
  list: Municipality[],
  entityParam: string,
  aliases: EntityAlias[] = []
): EntityParamResolution {
  if (!entityParam) return { kind: 'not_found', slug: entityParam };

  // A LIVE ENTITY ALWAYS WINS. Checked first and unconditionally: a stale alias
  // row must never shadow a currently-published government. That would be the
  // Bloomington failure again, and harder to see, because an alias hit looks
  // deliberate rather than accidental.
  const entity = list.find(m => toSlug(m) === entityParam);
  if (entity) return { kind: 'matched', entity };

  // Group the aliases claiming this slug by what they point AT. One distinct
  // target is a rename; two is a contradiction in the data, and a contradiction
  // is resolved by refusing, never by picking. `aliases` defaults to empty, so
  // every existing caller keeps exactly the behaviour it had.
  const targets = new Set(
    aliases
      .filter(a => slugify(a.aliasName, a.state) === entityParam)
      .map(a => slugify(a.canonicalName, a.state))
      // A self-alias says nothing; if it matched a live entity we already
      // returned above, so here it can only add noise to the ambiguity count.
      .filter(canonicalSlug => canonicalSlug !== entityParam)
  );
  if (targets.size !== 1) return { kind: 'not_found', slug: entityParam };

  const canonicalSlug = [...targets][0];
  const target = list.find(m => toSlug(m) === canonicalSlug);
  // A dangling alias — the entity it names is not loaded. Not found is the
  // honest answer; inventing one would be the failure this module prevents.
  if (!target) return { kind: 'not_found', slug: entityParam };

  return { kind: 'aliased', entity: target, requestedSlug: entityParam, canonicalSlug };
}

/** Longest slug echoed back to the page before it is truncated. */
const MAX_DISPLAY_SLUG = 64;

/**
 * Make a slug safe to echo into the UI. React escapes markup already, so this
 * is not an XSS guard — it is a layout and legibility guard on a value that
 * comes straight from the address bar: strip control characters and whitespace,
 * and cap the length so a 5,000-character slug cannot blow out the banner.
 */
export function displaySlug(slug: string): string {
  const clean = slug.replace(/[\p{C}\s]/gu, '');
  return clean.length > MAX_DISPLAY_SLUG
    ? `${clean.slice(0, MAX_DISPLAY_SLUG - 1)}…`
    : clean;
}

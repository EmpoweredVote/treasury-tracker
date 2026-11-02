/**
 * Compare what the registries say against what the mirror table holds.
 *
 * NO SHEBANG — a test imports this module.
 *
 * ⚠⚠ SET-BASED, NOT FILE-BY-FILE. `diffFrozenExclusionMirror.mjs` reports the
 * same 81 ids forever because it compares file by file while the mirror
 * stores each id once; the arithmetic ties exactly and the tool can never be
 * clean. A diff that can never be clean teaches people to ignore it, so this
 * one keys on (axis, entry_id) and compares sets.
 */

/** @typedef {{axis: string, entry_id: string, pattern: string}} MirrorRow */

const key = (r) => `${r.axis}\u0000${r.entry_id}`;

/**
 * @param {MirrorRow[]} wanted what the registries say
 * @param {MirrorRow[]} actual what the table holds
 * @returns {{insert: MirrorRow[], update: MirrorRow[], remove: MirrorRow[], same: number}}
 */
export function diffMirror(wanted, actual) {
  const have = new Map((actual ?? []).map((r) => [key(r), r]));
  const want = new Map((wanted ?? []).map((r) => [key(r), r]));

  const insert = []; const update = []; const remove = [];
  let same = 0;

  for (const [k, w] of want) {
    const a = have.get(k);
    if (!a) insert.push(w);
    else if (a.pattern !== w.pattern) update.push(w);
    else same += 1;
  }
  for (const [k, a] of have) if (!want.has(k)) remove.push(a);

  return { insert, update, remove, same };
}

/** True when the mirror matches the registries exactly. */
export function mirrorIsClean(diff) {
  return diff.insert.length === 0 && diff.update.length === 0 && diff.remove.length === 0;
}

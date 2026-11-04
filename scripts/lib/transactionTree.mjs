/**
 * Rolling a transaction-backed budget up into its category tree.
 *
 * ⚠⚠⚠ WHY THIS EXISTS. McKinney, Frisco and Plano are TRANSACTION sources: the
 * loader writes `treasury.transactions` and `treasury_sync_transactions`
 * recomputes `budgets.total_budget` from them — and touches
 * `budget_categories` NOT AT ALL. Those trees were built once, by a migration
 * (`build_xlsx_budget_categories`) that was applied through the dashboard and
 * never committed. There has been no repeatable way to rebuild them since.
 *
 * That is the real fragility behind "the names won't survive a reload". The
 * names were never the brittle part — the whole TREE is a one-off artefact
 * sitting on top of transactions that a `--force-reload` deletes and rewrites
 * underneath it. Nothing re-derives it and nothing notices the drift.
 *
 * It had already happened. McKinney's second-largest FY2024 root ($79,113,310)
 * was keyed `unknown` while the transactions beneath it carried a NULL key, so
 * the drill-down returned `null` on the live site — a nine-figure category a
 * reader could click and get nothing from. See scripts/lib/publisherIds.mjs.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 *
 * One root per distinct `link_key`. Amount is the sum, `item_count` the count.
 * The caller supplies names; this file never invents one.
 */

/**
 * Group transactions into roots.
 *
 * `txns` is `[{ link_key, amount }]`. `resolveNames` takes the full array of
 * distinct keys and returns a `Map key -> name` — the whole set at once,
 * because some naming rules (McKinney's fund qualification) can only be
 * decided by looking across every sibling.
 *
 * ⚠⚠ A NULL LINK KEY IS A REFUSAL, NOT A BUCKET. Silently gathering unkeyed
 * rows under "Unknown" is precisely how $79.1M of McKinney spending acquired a
 * label nobody could trace and a drill-down that returned nothing. If a key is
 * missing, the loader lost it — fix the loader.
 */
export function rollUpTransactions(txns, resolveNames) {
  const groups = new Map();
  let unkeyed = 0;
  let unkeyedAmount = 0;

  for (const t of txns) {
    const key = t.link_key;
    if (key === null || key === undefined || key === '') {
      unkeyed++;
      unkeyedAmount += Number(t.amount) || 0;
      continue;
    }
    if (!groups.has(key)) groups.set(key, { link_key: key, amount: 0, item_count: 0 });
    const g = groups.get(key);
    g.amount += Number(t.amount) || 0;
    g.item_count += 1;
  }

  if (unkeyed) {
    throw new Error(
      `${unkeyed} transaction(s) totalling ${unkeyedAmount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} ` +
      `have NO link_key. They cannot be rolled up into a root a reader can click through. ` +
      `This is the falsy-zero defect (scripts/lib/publisherIds.mjs) or a column_mapping that ` +
      `names no key column — do NOT bucket them under "Unknown".`,
    );
  }

  if (!groups.size) throw new Error('no transactions to roll up — refusing to write an empty tree');

  const keys = [...groups.keys()];
  const names = resolveNames(keys);

  const missing = keys.filter((k) => !names.get(k));
  if (missing.length) {
    throw new Error(`the name resolver returned nothing for ${missing.length} key(s), first: ${missing[0]}`);
  }

  // ⚠ Round to cents ONCE, here, so the roots sum to the same number the
  // database total does. Summing floats and rounding per row does not.
  const total = [...groups.values()].reduce((a, g) => a + g.amount, 0);

  const roots = [...groups.values()]
    .map((g) => ({
      link_key: g.link_key,
      name: names.get(g.link_key),
      amount: round2(g.amount),
      // ⚠ A check or demand register records money ALREADY SPENT, so the
      // actual equals the amount — which is the convention every stored
      // transaction-backed root follows. Leaving it 0 (the column default)
      // shipped one root reading `actualAmount: 0` beside 93 siblings that
      // carried a figure, and only a sibling-by-sibling look found it.
      actual_amount: round2(g.amount),
      item_count: g.item_count,
      percentage: total === 0 ? 0 : Number(((g.amount / total) * 100).toFixed(4)),
    }))
    .sort((a, b) => b.amount - a.amount || a.link_key.localeCompare(b.link_key));

  // ⚠ 1-BASED, matching every transaction-backed tree already in the database
  // (Frisco 1..31, McKinney 1..97). A rebuild reproduces the existing
  // convention rather than imposing a new one — otherwise the first run
  // rewrites every row in the fleet to say the same thing differently, and a
  // no-change rebuild stops being a no-op, which is the property that makes
  // drift detectable at all.
  roots.forEach((r, i) => { r.sort_order = i + 1; });

  const dupes = roots.length - new Set(roots.map((r) => r.name)).size;
  if (dupes) {
    const counts = new Map();
    for (const r of roots) counts.set(r.name, (counts.get(r.name) || 0) + 1);
    const worst = [...counts].filter(([, n]) => n > 1).map(([n, c]) => `${JSON.stringify(n)} x${c}`);
    throw new Error(
      `the resolver produced ${dupes} duplicate root label(s): ${worst.join(', ')}. ` +
      `A breakdown that shows the reader one label twice is not publishable, and appending ` +
      `the key to separate them would make an unsourced name look sourced.`,
    );
  }

  return { roots, total: round2(total) };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * What to change to turn `existing` into `roots`, keyed on link_key.
 *
 * ⚠⚠ AN UPSERT, NOT A DELETE-AND-INSERT. `budget_categories` carries
 * `description` and `why_matters`, which are ENRICHMENT — written by a separate,
 * paid pipeline (see the enrichment cost memo: 11 years and $840-$10,800 to
 * drain the queue once). Rebuilding a tree by deleting its rows would discard
 * that silently and there would be no way to tell it had happened.
 */
export function diffTree(existing, roots) {
  const have = new Map(existing.map((c) => [c.link_key, c]));
  const want = new Map(roots.map((r) => [r.link_key, r]));

  const inserts = roots.filter((r) => !have.has(r.link_key));
  const deletes = existing.filter((c) => !want.has(c.link_key));
  const updates = [];

  for (const r of roots) {
    const c = have.get(r.link_key);
    if (!c) continue;
    const changed = c.name !== r.name
      || Number(c.amount) !== r.amount
      || Number(c.item_count ?? 0) !== r.item_count
      || Number(c.actual_amount ?? -1) !== r.actual_amount
      || Number(c.percentage ?? -1) !== r.percentage
      || Number(c.sort_order ?? -1) !== r.sort_order;
    if (changed) updates.push({ id: c.id, before: c, after: r });
  }

  return { inserts, updates, deletes };
}

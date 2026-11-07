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
 * Every column the loader writes from the publisher's own row.
 *
 * ⚠ `vendors.name` is NOT in this list and must not be. The loader writes
 * `cell(r, cm.vendor_column) || "Unknown"`, so a row with no vendor at all
 * comes out of the database carrying the string "Unknown" — an invented value
 * from the same falsy-coalescing family as the McKinney defect. A column that
 * is never empty cannot be evidence that a row is.
 */
const PUBLISHER_COLUMNS = [
  'description', 'payment_date', 'payment_method', 'payment_number',
  'invoice_number', 'fund', 'expense_category', 'department', 'program',
];

/**
 * A row the PUBLISHER published empty: zero amount, and nothing in any column
 * the loader fills from the source.
 *
 * ⚠⚠ THIS IS NOT A LOOPHOLE IN THE NULL-KEY REFUSAL BELOW, AND THE DIFFERENCE
 * IS THE WHOLE POINT. That refusal exists because an unkeyed row is MONEY IN
 * NO CATEGORY — McKinney's $79.1M. This is the opposite case: there is no
 * money and there is nothing to categorise. Requiring every publisher column
 * to be empty is what keeps the two apart; a row with $0 but a real date or
 * description HAS content the publisher declined to classify, and still
 * refuses.
 *
 * West Hollywood's FY2018-19 register contains exactly one such row,
 * `row-kt5z-k7g9.mzuf`, and fetching it from Socrata returns nothing but the
 * system fields and `retainage: "0"`. TT stores it because the Milledgeville
 * Rule says load what is published — and because dropping it would put
 * `verify:source-row-coverage` permanently red at 24,122 of 24,123.
 */
export function isEmptyPublishedRow(t) {
  if ((Number(t.amount) || 0) !== 0) return false;
  return PUBLISHER_COLUMNS.every((c) => t[c] === null || t[c] === undefined || t[c] === '');
}

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
 *
 * Returns `{ roots, total, emptyRows }`. ⚠ `emptyRows` is REPORTED, never
 * swallowed: a count the caller prints is the difference between a documented
 * exclusion and a silent one.
 */
export function rollUpTransactions(txns, resolveNames, opts = {}) {
  const groups = new Map();
  let unkeyed = 0;
  let unkeyedAmount = 0;
  let emptyRows = 0;

  for (const t of txns) {
    const key = t.link_key;
    if (key === null || key === undefined || key === '') {
      if (isEmptyPublishedRow(t)) { emptyRows++; continue; }
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

  // ⚠ Round to cents ONCE, here, so the roots sum to the same number the
  // database total does. Summing floats and rounding per row does not.
  // ⚠⚠ Computed BEFORE any bucketing, from every group, so the total cannot
  // depend on how the tail is gathered.
  const total = [...groups.values()].reduce((a, g) => a + g.amount, 0);

  /**
   * ── ⚠⚠ THE TAIL BUCKET ───────────────────────────────────────────────
   *
   * A vendor-keyed source has thousands of distinct payees and a readable
   * breakdown cannot have thousands of roots. Every transaction-backed tree
   * already in the database keeps the LARGEST `keepTop` and gathers the rest
   * into one bucket — Frisco is 30 named vendors + "Other Vendors" in all
   * eight of its years, measured, not chosen here.
   *
   * ⚠ This is opt-in. McKinney passes no `keepTop` and keeps one root per
   * department, exactly as before.
   *
   * ⚠⚠ The tail is gathered by AMOUNT and the bucket is NOT handed to the
   * resolver — its name is fixed. Asking a sourced naming rule to name an
   * aggregate TT invented is how an invented label starts looking sourced.
   */
  const { keepTop = null, tailKey = null, tailName = null } = opts;
  if (keepTop !== null && (!tailKey || !tailName)) {
    throw new Error('keepTop needs both tailKey and tailName — a bucket with no name is an invented label');
  }

  let tail = null;
  if (keepTop !== null && groups.size > keepTop) {
    const ranked = [...groups.values()].sort(
      (a, b) => b.amount - a.amount || a.link_key.localeCompare(b.link_key),
    );
    tail = { link_key: tailKey, amount: 0, item_count: 0 };
    for (const g of ranked.slice(keepTop)) {
      tail.amount += g.amount;
      tail.item_count += g.item_count;
      groups.delete(g.link_key);
    }
    // ⚠ A publisher may genuinely have a vendor whose own key collides with
    // the bucket's. Two roots with one key is a tree that cannot be diffed.
    if (groups.has(tailKey)) {
      throw new Error(`a real vendor already keys as ${JSON.stringify(tailKey)} — the tail bucket would collide with it`);
    }
  }

  const keys = [...groups.keys()];
  const names = resolveNames(keys);

  const missing = keys.filter((k) => !names.get(k));
  if (missing.length) {
    throw new Error(`the name resolver returned nothing for ${missing.length} key(s), first: ${missing[0]}`);
  }

  if (tail) {
    groups.set(tailKey, tail);
    names.set(tailKey, tailName);
  }

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
    /**
     * ⚠⚠ THE TAIL BUCKET SORTS LAST, HOWEVER LARGE IT IS. Every stored Frisco
     * year puts "Other Vendors" at sort_order 31 even though it outweighs
     * every named vendor — it is a remainder, and a remainder reads as the
     * bottom of a list, not the top of one.
     *
     * Found by measurement: sorting it by amount like any other root moved it
     * to position 1 and pushed all 30 named vendors down one, so a rebuild of
     * an ALREADY-CORRECT year rewrote all 31 rows. That would have destroyed
     * the property this file depends on — that a no-change rebuild is a
     * no-op, and therefore that a diff means real drift.
     */
    .sort((a, b) => {
      if (a.link_key === b.link_key) return 0;
      if (tailKey !== null && a.link_key === tailKey) return 1;
      if (tailKey !== null && b.link_key === tailKey) return -1;
      return b.amount - a.amount || a.link_key.localeCompare(b.link_key);
    });

  // ⚠ 1-BASED, matching every transaction-backed tree already in the database
  // (Frisco 1..31, McKinney 1..97). A rebuild reproduces the existing
  // convention rather than imposing a new one — otherwise the first run
  // rewrites every row in the fleet to say the same thing differently, and a
  // no-change rebuild stops being a no-op, which is the property that makes
  // drift detectable at all.
  roots.forEach((r, i) => { r.sort_order = i + 1; });

  /**
   * ── ⚠⚠⚠ NO ROOT KEY MAY BE A PREFIX OF ANOTHER ──────────────────────────
   *
   * The drill-down matches a link_key by PREFIX on the server
   * (`src/data/dataLoader.ts`: "so 'fire' returns all transactions"). So if one
   * root keys as "Debt Service" and another as "Debt Service Fees", clicking
   * the first silently returns BOTH — a category that overstates itself, with
   * every total still tying, which is the shape of defect this whole file
   * exists for.
   *
   * ⚠ Measured before adding: zero collisions across every stored McKinney,
   * Frisco and West Hollywood key, so this refuses nothing that works today.
   * It is cheap insurance on a rule whose keys are free-text publisher labels.
   *
   * Sorting puts a prefix immediately before the strings it prefixes, so
   * adjacent pairs are enough to find one.
   */
  const sortedKeys = roots.map((r) => String(r.link_key)).sort();
  for (let i = 1; i < sortedKeys.length; i++) {
    if (sortedKeys[i].startsWith(sortedKeys[i - 1])) {
      throw new Error(
        `root key ${JSON.stringify(sortedKeys[i - 1])} is a prefix of ${JSON.stringify(sortedKeys[i])}. ` +
        `The drill-down matches link_key by prefix, so the shorter category would return the longer ` +
        `one's transactions as well and quietly overstate itself. Re-key the source, or teach the API ` +
        `an exact match, before publishing this tree.`,
      );
    }
  }

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

  return { roots, total: round2(total), emptyRows };
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

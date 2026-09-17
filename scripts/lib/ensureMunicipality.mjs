/**
 * The one way a loader turns a published name into a TT entity id, and the one
 * way it proves it did not fork a city on the way.
 *
 * ── ⚠⚠ WHY THIS MODULE EXISTS ──────────────────────────────────────────────
 *
 * Loaders establish entity identity BY PUBLISHED NAME. When a publisher changes
 * the name it prints, the lookup misses, a SECOND entity is created, and every
 * year from that point lands on the new row — severing the city's history at
 * that boundary. It has happened twice, both from the Minnesota Office of the
 * State Auditor:
 *
 *   2026-09-14  Marine on Saint Croix / Marine On Saint Croix   "on" -> "On"
 *   2026-09-15  Birchwood            / Birchwood Village        a word added
 *
 * NOTHING FAILS WHEN IT HAPPENS. Both halves carry honest publisher data, every
 * total ties, and each half LOOKS COMPLETE. Only a reader who already knows the
 * missing years exist can tell — and no reader does. Neither incident was found
 * by looking; one surfaced through a duplicate geoid, the other while chasing an
 * unrelated one-row discrepancy.
 *
 * Two mechanisms, and they work at different times:
 *
 *   KNOWN renames are absorbed by treasury.municipality_aliases, consulted
 *   inside treasury_ensure_municipality before it creates anything.
 *
 *   UNKNOWN renames are caught by assertNoNewForks() at the END of a load.
 *
 * ⚠⚠ The check CANNOT run at insert time. Three of its five signals — one
 * shared publisher, adjacent non-overlapping year ranges — come from the budget
 * rows, which do not exist when the entity is created. An insert-time version
 * was written, measured against the live table, and abandoned: ten existing
 * pairs tripped its name-and-population rule and ALL TEN were distinct
 * governments (Bell/Bell Gardens, Avon/Avon Lake, Braddock/Braddock Hills, ...).
 * A 100% false-positive rate. The problem is timing, not threshold.
 *
 * Design: docs/superpowers/specs/2026-09-15-stable-key-loader-identity-design.md
 */

/**
 * Resolve a published name to a TT municipality id, creating the entity if it
 * is genuinely new.
 *
 * @param {{rpc: Function}} db        supabase client
 * @param {object}   entity
 * @param {string}   entity.name            the name as the PUBLISHER prints it
 * @param {string}   entity.state           two-letter state code
 * @param {string}  [entity.entityType]     defaults to 'city'
 * @param {number}  [entity.population]     defaults to 0
 * @param {string}  [entity.source]         the publisher, for approach C
 * @param {string}  [entity.sourceEntityKey] the publisher's own stable unit id
 * @returns {Promise<{id: string}>}
 *
 * ⭐ Passing `source` + `sourceEntityKey` is the only thing here that PREVENTS a
 * fork rather than catching one afterwards: a publisher's own id survives a
 * re-spelling, so the rename becomes a non-event. Use it wherever the source
 * exposes such an id.
 */
export async function ensureMunicipality(db, {
  name,
  state,
  entityType = 'city',
  population = 0,
  source = null,
  sourceEntityKey = null,
}) {
  const { data, error } = await db.rpc('treasury_ensure_municipality', {
    p_name: name,
    p_state: state,
    p_entity_type: entityType,
    p_population: population ?? 0,
    p_source: source,
    p_source_entity_key: sourceEntityKey,
  });

  if (error) {
    throw new Error(`ensureMunicipality(${name}, ${state}): ${error.message}`);
  }

  // ⚠ A null id used to flow onward and violate a NOT NULL foreign key
  // somewhere far from the cause. Fail here, while the entity name is still in
  // hand to name in the message.
  if (!data) {
    throw new Error(`ensureMunicipality(${name}, ${state}): returned no id`);
  }

  return { id: data };
}

/**
 * Run at the END of every load, after budgets are written and BEFORE reporting
 * success. Throws, naming both halves, if the load left a forked city behind.
 *
 * ⚠ A zero result only means something because 'distinct' adjudications are
 * suppressed inside treasury.detect_forked_entities() itself. Do not filter
 * here as well, or a cleared pair would be double-counted as cleared.
 *
 * @param {{rpc: Function}} db
 * @returns {Promise<void>}
 */
export async function assertNoNewForks(db) {
  const { data, error } = await db.rpc('detect_forked_entities');

  // ⚠ A check that silently does not run is worse than no check: it reports
  // health it never measured.
  if (error) {
    throw new Error(`fork check failed to run: ${error.message}`);
  }

  if (!data || data.length === 0) return;

  const lines = data.map(
    (r) => `  ${r.state}  "${r.name_a}" (${r.years_a})  <->  "${r.name_b}" (${r.years_b})`,
  );

  throw new Error(
    `${data.length} suspected forked ${data.length === 1 ? 'city' : 'cities'} after this load:\n` +
    `${lines.join('\n')}\n` +
    `Each is ONE city held as TWO entities, or two governments that need a ` +
    `'distinct' row in treasury.municipality_fork_reviews. Resolve before trusting this load.`,
  );
}

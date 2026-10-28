/**
 * Chunking for PostgREST `.in(column, values)` filters.
 *
 * NO SHEBANG — library module under scripts/lib/.
 *
 * ── ⚠⚠ A CHUNK COSTS ITS ENCODED LENGTH, NOT ITS MEMBER COUNT ──────────────
 *
 * supabase-js sends `.in()` as a URL QUERY STRING, so a chunk of 200 long
 * strings is a request line of tens of kilobytes and the server answers
 * `Bad Request`. The sweeps that write classification axes all used a bare
 * `IN_CHUNK = 200`, which is a count, and it held for twenty families and then
 * did not:
 *
 *     wrote basis=actual for ny-osc-city (6357 rows)
 *     Error: write basis for ny-osc-municipal: Bad Request
 *
 * The `ny-osc-municipal` strings average 104 characters and carry an em dash
 * and two commas apiece, each of which encodes to several bytes; the
 * `state-acfr-gf` strings average 75 and fit. Same constant, same code, two
 * answers — which is exactly the shape of bug a count cannot express.
 *
 * ⚠ The caller's loop must iterate THESE chunks rather than slicing by a
 * stride, or the bound is silently reimposed as a count.
 */

/** Members per chunk. Unchanged from the sweeps' long-standing value. */
export const IN_MAX_COUNT = 200;

/**
 * Encoded characters per chunk. Deliberately well under the ~8 KB request-line
 * limit typical of the proxies in front of PostgREST: the cost of being
 * conservative is one extra round trip per family, and the cost of being
 * wrong is a sweep that stops in the middle of a partitioned write.
 */
export const IN_MAX_ENCODED = 6000;

/**
 * Split `values` into chunks that satisfy BOTH bounds, preserving order and
 * membership exactly.
 *
 * ⚠ A single value that exceeds `maxEncoded` on its own cannot be split, so it
 * gets a chunk to itself and is still sent. Dropping it would leave its rows
 * unwritten and silent — and the partition gate reads the registry rather than
 * the table, so nothing downstream would notice.
 */
export function chunkForIn(values, maxCount = IN_MAX_COUNT, maxEncoded = IN_MAX_ENCODED) {
  const chunks = [];
  let current = [];
  let encoded = 0;

  for (const value of values) {
    // +3 for the quoting and separator PostgREST adds around each member.
    const cost = encodeURIComponent(String(value)).length + 3;
    if (current.length && (current.length >= maxCount || encoded + cost > maxEncoded)) {
      chunks.push(current);
      current = [];
      encoded = 0;
    }
    current.push(value);
    encoded += cost;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

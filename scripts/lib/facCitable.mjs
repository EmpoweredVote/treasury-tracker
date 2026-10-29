/**
 * Federal Audit Clearinghouse — the citable document endpoint, and the guard
 * that keeps a `source_url` clickable.
 *
 * NO SHEBANG — library module; tests import it.
 *
 * Extracted from `akBoroughSources.mjs` when Hawaii's counties became the
 * second state family fetching from FAC. Both families must apply the SAME
 * rule, because the defect below is a property of the publisher, not of
 * Alaska. `akBoroughSources.mjs` re-exports both symbols, so every existing
 * importer and `tests/akBoroughSources.test.mjs` are untouched by the move.
 */

export const FAC_PDF_BASE = 'https://app.fac.gov/dissemination/report/pdf/';

/**
 * ⚠⚠ A `source_url` IS A LINK A READER CLICKS, SO IT MUST STILL RESOLVE.
 *
 * FAC answers its PDF endpoint with a 302 to a PRESIGNED S3 OBJECT carrying
 * `X-Amz-Expires=30` — thirty SECONDS. `fetchAkBoroughs.mjs` recorded that
 * redirect target (`res.url`), following this repo's usual and usually-correct
 * rule of citing the URL that actually served the bytes, and so stamped a dead
 * link onto 253 Alaska borough rows across two loads.
 *
 * Nothing else could catch it. Not one of the five load guards, the frozen
 * invariant, the tie gate or the scope sweep reads a URL; every figure was
 * right and the only broken thing was the citation. So the check lives here,
 * at the point the manifest is written.
 *
 * Repaired in place by `scripts/repairAkBoroughSourceUrls.mjs`.
 */
export function assertCitable(url) {
  if (/[?&]X-Amz-(Expires|Signature)=/i.test(url)) {
    throw new Error(`source_url would be a PRESIGNED, EXPIRING link: ${String(url).slice(0, 80)}… `
      + 'Record the requested FAC URL, not the S3 object it redirects to.');
  }
  return url;
}

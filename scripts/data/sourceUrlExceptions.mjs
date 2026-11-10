/**
 * Citations a human has looked at by hand, and the reason the automated probe
 * cannot settle them.
 *
 * ⚠⚠⚠ WHAT A DECLARATION MAY AND MAY NOT EXCUSE — this is the whole point of
 * the file, and `tests/sourceUrlProbe.test.mjs` enforces every line of it:
 *
 * | verdict       | declarable? | why |
 * |---------------|-------------|-----|
 * | `unreachable` | ✅ YES      | the host refuses automated clients; a person can still click it |
 * | `dead`        | ⛔ NEVER    | a 404 is the publisher saying the document is GONE. Repair the URL. |
 * | `wrong-type`  | ⛔ NEVER    | the host served a block page where a document was promised. Same. |
 * | `uncitable`   | ⛔ NEVER    | a presigned/expiring link cannot work for a reader, whatever we write here |
 *
 * ⚠ A declaration is a claim about the live web, so it goes STALE. When a
 * declared URL starts answering again the gate fails until the entry is
 * deleted — the same rule as the xlsx registry and the out-of-period
 * exceptions. A repo that carries an out-of-date sentence about the web is
 * worse than one that carries none.
 *
 * ⭐ `checkedOn` is not decoration. It is the date a PERSON opened the link in
 * a browser and saw the document. Without it the entry says only "this was
 * annoying once", which is not evidence of anything.
 *
 * EMPTY IS THE CORRECT STATE. On 2026-11-09 all 1,857 stored citations were
 * asked and none needed declaring. Add an entry only after looking.
 *
 * @type {{id: string, url: string, why: string, checkedOn: string}[]}
 */
export const SOURCE_URL_EXCEPTIONS = [];

/**
 * curl, for the hosts that refuse Node outright.
 *
 * NO SHEBANG — imported by scripts and tests.
 *
 * ⚠⚠ mckinneytexas.org answers `fetch()` with a flat 403 — and NOT for want of
 * headers: the identical User-Agent, Sec-Fetch trio, Referer and Accept all
 * still 403 while curl is let straight through, so it is the TLS/client
 * fingerprint being matched, not anything Node can set. `xlsxRows.downloadXLSX`
 * already falls back this way. Without it a gate calls McKinney's own citation
 * dead and is reporting on Node rather than on McKinney.
 *
 * ⚠ EXTRACTED 2026-11-12 from scripts/verifySourceUrls.mjs, where it was a
 * private function. It now has TWO callers — that gate and
 * scripts/citeNonStatementSources.mjs — and a second copy would be a second
 * thing to drift. Behaviour is unchanged: same args, same single-byte range,
 * same 25s cap, same BROWSER_HEADERS.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { BROWSER_HEADERS } from './sourceUrlProbe.mjs';

/**
 * @param {string} url
 * @returns {{status: number, contentType: string}}
 */
export function curlProbe(url) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tt-url-'));
  const sink = path.join(dir, 'body.bin');
  try {
    const args = ['-sS', '-L', '-r', '0-0', '--max-time', '25', '-o', sink, '-w', '%{http_code} %{content_type}'];
    for (const [k, v] of Object.entries(BROWSER_HEADERS)) args.push('-H', `${k}: ${v}`);
    args.push(url);
    const r = spawnSync('curl', args, { encoding: 'utf8' });
    if (r.error) throw new Error(`curl is not available: ${r.error.message}`);
    if (r.status !== 0) throw new Error(r.stderr?.trim() || `curl exit ${r.status}`);
    const [code, ...rest] = String(r.stdout).trim().split(/\s+/);
    return { status: Number(code), contentType: rest.join(' ') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export default curlProbe;

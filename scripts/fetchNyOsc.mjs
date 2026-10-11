#!/usr/bin/env node
// This file is NOT imported by any test, so the shebang is safe here.
/**
 * Download the OSC city archive if it is not already on disk.
 *
 * ⚠ The whole 1995-2026 series is ONE 12.5 MB zip. There is no per-year
 * endpoint, so a present file is a complete file and re-downloading is pure
 * waste.
 *
 * ⚠ The download form at financial-data-for-local-governments.cfm LOOKS like a
 * stateful ColdFusion + ASP.NET app with a POST to detailedzip.cfm. It is not:
 * that POST merely 302s to this static file. Third ViewState-looking app in
 * TT's history that was a static file (PA DCED, Georgia, now NY). Probe before
 * classifying an app by its framework.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { ARCHIVE_PATH, ARCHIVE_URL } from './lib/nyOsc.mjs';

if (existsSync(ARCHIVE_PATH)) {
  console.log(`present, skipping: ${ARCHIVE_PATH}`);
  process.exit(0);
}

mkdirSync(dirname(ARCHIVE_PATH), { recursive: true });

const res = await fetch(ARCHIVE_URL);
if (!res.ok) throw new Error(`OSC fetch failed: ${res.status} ${res.statusText}`);

// ⚠ Read it as a BUFFER and fingerprint the magic bytes. Reading a binary
// response as text turns every high byte into U+FFFD while the file still
// "looks" like a plausible size -- the PA DCED lesson. Never trust Content-Type.
const buf = Buffer.from(await res.arrayBuffer());
if (buf.subarray(0, 2).toString('latin1') !== 'PK') {
  throw new Error(`not a zip — first bytes ${buf.subarray(0, 8).toString('hex')}`);
}

writeFileSync(ARCHIVE_PATH, buf);
console.log(`wrote ${ARCHIVE_PATH} (${buf.length} bytes)`);

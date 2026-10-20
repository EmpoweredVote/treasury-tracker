#!/usr/bin/env node
// This file is NOT imported by any test, so the shebang is safe here.
/**
 * Download an OSC archive if it is not already on disk. `--schools` selects
 * the school-district file; with no flag it is the cities', as before.
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

import { NY_OSC_ARCHIVES, archiveFor } from './lib/nyOsc.mjs';

/**
 * ⚠ The flag selects a MEMBER CLASS, which is the same token that names the
 * members inside the zip (`2024_Town.csv`). One table drives the fetcher, the
 * reader's range check and the loader, so a class cannot be known to one and
 * unknown to another.
 */
const BY_FLAG = {
  '--schools': 'SchoolDistrict',
  '--towns': 'Town',
  '--villages': 'Village',
  '--counties': 'County',
};

const flag = process.argv.slice(2).find((a) => a in BY_FLAG);
const unknown = process.argv.slice(2).filter((a) => a.startsWith('--') && !(a in BY_FLAG));
if (unknown.length) {
  throw new Error(`unknown flag(s) ${unknown.join(' ')} — expected one of `
    + `${Object.keys(BY_FLAG).join(', ')}, or none for the cities`);
}

const memberClass = flag ? BY_FLAG[flag] : 'City';
const archive = archiveFor(memberClass);
const WHICH = { path: archive.path, url: archive.url, label: memberClass };

if (!Object.hasOwn(NY_OSC_ARCHIVES, memberClass)) {
  throw new Error(`no archive declared for ${memberClass}`);
}

if (existsSync(WHICH.path)) {
  console.log(`present, skipping: ${WHICH.path} (${WHICH.label})`);
  process.exit(0);
}

mkdirSync(dirname(WHICH.path), { recursive: true });

const res = await fetch(WHICH.url);
if (!res.ok) throw new Error(`OSC fetch failed: ${res.status} ${res.statusText}`);

// ⚠ Read it as a BUFFER and fingerprint the magic bytes. Reading a binary
// response as text turns every high byte into U+FFFD while the file still
// "looks" like a plausible size -- the PA DCED lesson. Never trust Content-Type.
const buf = Buffer.from(await res.arrayBuffer());
if (buf.subarray(0, 2).toString('latin1') !== 'PK') {
  throw new Error(`not a zip — first bytes ${buf.subarray(0, 8).toString('hex')}`);
}

writeFileSync(WHICH.path, buf);
console.log(`wrote ${WHICH.path} (${buf.length} bytes)`);

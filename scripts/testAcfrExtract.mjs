#!/usr/bin/env node
// Quick harness: node scripts/testAcfrExtract.mjs <txtfile> — prints GF-column extraction summary.
import { readFileSync } from 'node:fs';
import { extractGovFundGeneralColumn } from './maAcfrExtract.mjs';
const f = process.argv[2];
const r = extractGovFundGeneralColumn(readFileSync(f, 'utf8'));
if (!r.found) { console.log('NOT FOUND'); process.exit(1); }
const revSum = r.revenues.reduce((a, c) => a + c.total, 0);
const expSum = r.expenditures.reduce((a, c) => a + c.total, 0);
console.log(`statementLine=${r.statementLine}`);
console.log(`REV total=${r.revTotal} sum=${revSum} diff=${revSum - r.revTotal} items=${r.revenues.length}`);
for (const c of r.revenues) console.log(`  R ${c.name}: ${c.total}`);
console.log(`EXP total=${r.expTotal} sum=${expSum} diff=${expSum - r.expTotal} items=${r.expenditures.length}`);
for (const c of r.expenditures) console.log(`  E ${c.name}: ${c.total}`);

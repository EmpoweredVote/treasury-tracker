/**
 * Massachusetts ACFR General-Fund extractor (Phase 108-02).
 *
 * MA's Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances is
 * DEPARTMENT-level (~44 expenditure line items) across a variable number of fund columns
 * (FY2025: General | Lotteries | MSBA | Federal Grants | Other Governmental | Total). The GENERAL
 * FUND is always the 1st numeric column. Hand-transcribing 44 depts × 25 yrs is impractical, so
 * this module parses the pdftotext -table output programmatically. Every extracted year is gated by
 * an exact GF-column total-tie in the loader — a year whose parse doesn't tie is skipped+logged
 * (honest hole per D-04), never mis-loaded.
 *
 * extractMAGeneralFund(txt) → { found, revenues:[{name,total}], revTotal, expenditures:[{name,total}], expTotal }
 *   all values in THOUSANDS (the loader ×1000 → dollars). null totals if not found.
 */

// Parse a statement line into { label, nums:[] } where nums are the numeric columns (thousands).
// Columns in -table output are separated by 2+ spaces; the label (with dotted leader) is col 0.
// "$" is dropped; "--"/"-" → 0; "(1,234)" → -1234.
function parseRow(line) {
  const cleaned = line.replace(/\$/g, ' ');
  const cols = cleaned.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
  if (!cols.length) return null;
  const nums = [];
  let firstNumIdx = -1;
  for (let i = 0; i < cols.length; i++) {
    const t = cols[i].replace(/\.+$/, '').trim(); // strip trailing dotted leader
    if (/^-{1,2}$/.test(t)) { nums.push(0); if (firstNumIdx < 0) firstNumIdx = i; }
    else if (/^\(?[\d,]+\)?$/.test(t) && /\d/.test(t)) {
      const neg = /^\(.*\)$/.test(t);
      const v = parseInt(t.replace(/[(),]/g, ''), 10);
      nums.push(neg ? -v : v); if (firstNumIdx < 0) firstNumIdx = i;
    }
  }
  // label = column tokens before the first numeric column, dots stripped
  let label = '';
  if (firstNumIdx > 0) label = cols.slice(0, firstNumIdx).join(' ').replace(/\.{2,}/g, ' ').replace(/\s+/g, ' ').trim();
  else if (firstNumIdx === 0) label = ''; // number-only line
  else label = cols.join(' ').replace(/\.{2,}/g, ' ').replace(/\s+/g, ' ').trim(); // pure text
  return { label, nums, hasNum: firstNumIdx >= 0 };
}

// Locate the basic Governmental Funds Rev/Exp/Changes statement and extract the General Fund (col 1).
export function extractMAGeneralFund(txt) {
  const lines = txt.split('\n');
  // Find candidate REVENUES headers past the MD&A/TOC (line > 1500), with a General-Fund header above
  // and a Total revenues / EXPENDITURES / Total expenditures sequence below.
  for (let i = 1500; i < lines.length; i++) {
    if (!/^\s*REVENUES:?\s*$/i.test(lines[i])) continue;
    // header region above must reference "General" and "Governmental Funds"
    const header = lines.slice(Math.max(0, i - 18), i).join(' ');
    if (!/General/.test(header) || !/Governmental Funds/i.test(header)) continue;
    // find Total revenues, EXPENDITURES, Total expenditures below
    let tRev = -1, expH = -1, tExp = -1;
    for (let j = i + 1; j < Math.min(lines.length, i + 400); j++) {
      if (tRev < 0 && /^\s*Total revenues/i.test(lines[j])) tRev = j;
      else if (tRev > 0 && expH < 0 && /^\s*EXPENDITURES:?\s*$/i.test(lines[j])) expH = j;
      else if (expH > 0 && /^\s*Total expenditures/i.test(lines[j])) { tExp = j; break; }
    }
    if (tRev < 0 || expH < 0 || tExp < 0) continue;

    // Extract revenue items (between REVENUES and Total revenues) — GF = 1st numeric column
    const revenues = [];
    for (let j = i + 1; j < tRev; j++) {
      const r = parseRow(lines[j]); if (!r || !r.hasNum || !r.label) continue;
      if (/^current$/i.test(r.label)) continue;
      revenues.push({ name: r.label, total: r.nums[0] });
    }
    const revTotalRow = parseRow(lines[tRev]);
    const revTotal = revTotalRow?.nums?.[0] ?? null;

    // Extract expenditure items (between EXPENDITURES and Total expenditures)
    const expenditures = [];
    let pending = '';
    for (let j = expH + 1; j < tExp; j++) {
      const r = parseRow(lines[j]); if (!r) continue;
      if (!r.hasNum) { // label continuation / heading like "Current:"
        if (r.label && !/^current:?$/i.test(r.label)) pending = pending ? `${pending} ${r.label}` : r.label;
        continue;
      }
      let name = r.label;
      if (pending) { name = name ? `${pending} ${name}` : pending; pending = ''; }
      if (!name) continue;
      expenditures.push({ name, total: r.nums[0] });
    }
    const expTotalRow = parseRow(lines[tExp]);
    const expTotal = expTotalRow?.nums?.[0] ?? null;

    if (revTotal && expTotal && revenues.length && expenditures.length) {
      return { found: true, statementLine: i, revenues, revTotal, expenditures, expTotal };
    }
  }
  return { found: false, revenues: [], revTotal: null, expenditures: [], expTotal: null };
}

// Generic alias — the extractor is state-agnostic (any Governmental Funds Statement of
// Rev/Exp/Changes whose GENERAL FUND is the 1st numeric column). Reused by North Carolina
// (Phase 108-03) — NC is functional-level (23 rev sources / 13 exp functions) but shares the exact
// Revenues/Total revenues/Expenditures/Total expenditures + "GOVERNMENTAL FUNDS"/"General" structure.
export const extractGovFundGeneralColumn = extractMAGeneralFund;

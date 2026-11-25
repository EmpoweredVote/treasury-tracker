import { test } from 'vitest';
import assert from 'node:assert/strict';
import { money, bankYear, bankISO, extractDebits, buildExpenseTree } from './loadEVBank.js';

test('money parses bank "-$39.99" format (sign kept, no double-negate)', () => {
  assert.equal(money('-$39.99'), -39.99);
  assert.equal(money('$1,706.77'), 1706.77);
  assert.equal(money(''), 0);
});

test('bankYear / bankISO parse M/D/YYYY', () => {
  assert.equal(bankYear('06/17/2026'), 2026);
  assert.equal(bankYear('01/06/2026'), 2026);
  assert.equal(bankISO('06/05/2026'), '2026-06-05');
  assert.equal(bankISO('1/6/2026'), '2026-01-06');
});

test('extractDebits: only negatives, only the target FY, returned as positive magnitudes', () => {
  const rows = [
    { Date: '06/05/2026', Description: 'RENDER.COM', Amount: '-$98.00', Balance: '$100' },
    { Date: '06/06/2026', Description: 'DEPOSIT GIVEBUTTER', Amount: '$50.00', Balance: '$150' }, // credit → excluded
    { Date: '12/01/2025', Description: 'ANTHROPIC', Amount: '-$10.00', Balance: '$90' },          // prior FY → excluded
  ];
  const d = extractDebits(rows, 2026);
  assert.equal(d.length, 1);
  assert.equal(d[0].amount, 98);
  assert.equal(d[0].desc, 'RENDER.COM');
});

test('buildExpenseTree: classifies by vendor, 2-level category→vendor, total reconciles', () => {
  const debits = [
    { date: '06/08/2026', desc: 'POS Signature Purchase  ANTHROPIC          ANTHROPIC.COM  CAUS', amount: 96 },
    { date: '01/12/2026', desc: 'POS Signature Purchase  OPENAI *CHATGPT SUBOPENAI.COM     CAUS', amount: 20 },
    { date: '06/05/2026', desc: 'POS Signature Purchase  RENDER.COM         RENDER.COM     CAUS', amount: 98 },
    { date: '05/26/2026', desc: 'POS Signature Purchase  SUPABASE           SINGAPORE      SGSG', amount: 34.35 },
    { date: '06/16/2026', desc: 'POS Signature Purchase  FIGMA              FIGMA.COM      CAUS', amount: 60 },
    { date: '01/22/2026', desc: 'International Fee US Funds International Fee US Funds', amount: 0.25 },
  ];
  const { categories, total } = buildExpenseTree(debits);
  assert.equal(total, 308.6);
  const ai = categories.find(c => c.name === 'AI & Research');
  assert.equal(ai.amount, 116); // 96 + 20
  assert.deepEqual(ai.subcategories.map(s => s.name).sort(), ['Anthropic (Claude)', 'OpenAI (ChatGPT)']);
  const infra = categories.find(c => c.name === 'Infrastructure & Hosting');
  assert.equal(infra.amount, 132.35); // 98 + 34.35
  assert.ok(categories.find(c => c.name === 'Design'));
  assert.ok(categories.find(c => c.name === 'Bank Fees'));
  // parent total == sum of children
  for (const c of categories) {
    const childSum = Math.round(c.subcategories.reduce((s, x) => s + x.amount, 0) * 100) / 100;
    assert.equal(c.amount, childSum);
  }
});

test('buildExpenseTree: names the four vendors that published as raw bank strings', () => {
  // These four had no VENDOR_RULES entry, so cleanVendor() put the raw bank
  // descriptor on the public page: "MEISTERLABS INC", "READ - MEETING
  // MANAREAD.AI", "GITHUB, INC.", "CA SECRETARY OF STA916-x1338". The
  // MindMeister and Read.ai logo tiles in CategoryList never rendered because
  // the names did not match.
  const debits = [
    { date: '10/05/2026', desc: 'POS Signature Purchase  MEISTERLABS INC    206-202-2886   DEUS', amount: 78 },
    { date: '07/14/2026', desc: 'POS Signature Purchase  READ - MEETING MANAREAD.AI      CAUS', amount: 270 },
    { date: '10/26/2026', desc: 'POS Signature Purchase  GITHUB, INC.       GITHUB.COM     CAUS', amount: 3.93 },
    { date: '03/02/2026', desc: 'POS Signature Purchase  CA SECRETARY OF STA916-x1338    CAUS', amount: 20 },
  ];
  const { categories } = buildExpenseTree(debits);
  const vendorNames = categories.flatMap(c => c.subcategories.map(s => s.name));
  assert.ok(vendorNames.includes('MindMeister'), 'MEISTERLABS INC should publish as MindMeister');
  assert.ok(vendorNames.includes('Read.ai'), 'READ - MEETING MAN... should publish as Read.ai');
  assert.ok(vendorNames.includes('GitHub'), 'GITHUB, INC. should publish as GitHub');
  assert.ok(vendorNames.includes('CA Secretary of State'), 'CA SECRETARY OF STA... should publish as CA Secretary of State');
});

test('buildExpenseTree: GitHub is infrastructure, the other three stay in Operations', () => {
  const debits = [
    { date: '10/26/2026', desc: 'POS Signature Purchase  GITHUB, INC.       GITHUB.COM     CAUS', amount: 3.93 },
    { date: '10/05/2026', desc: 'POS Signature Purchase  MEISTERLABS INC    206-202-2886   DEUS', amount: 78 },
  ];
  const { categories } = buildExpenseTree(debits);
  const infra = categories.find(c => c.name === 'Infrastructure & Hosting');
  assert.equal(infra.amount, 3.93);
  const ops = categories.find(c => c.name === 'Operations');
  assert.equal(ops.amount, 78);
});

test('buildExpenseTree: unknown vendor falls back to Operations with cleaned name', () => {
  const { categories } = buildExpenseTree([{ date: '06/01/2026', desc: 'POS Signature Purchase  SOMECO LLC         SOMEWHERE  US', amount: 12 }]);
  const ops = categories.find(c => c.name === 'Operations');
  assert.ok(ops);
  assert.equal(ops.amount, 12);
});

#!/usr/bin/env node
/**
 * Fetch WAF-protected documents through a real browser (Chrome DevTools Protocol).
 *
 * WHY THIS EXISTS
 * ---------------
 * Some city sites sit behind a WAF that rejects `curl` no matter what headers it
 * sends — Hillsboro and Tigard return 403 to GET *and* HEAD even with a complete
 * browser header set (UA, Accept, Accept-Language, Sec-Fetch-*,
 * Upgrade-Insecure-Requests) and a Referer. The block is not header-based; it is
 * almost certainly TLS/JA3 fingerprinting, which no curl invocation can defeat.
 *
 * The same request succeeds from Chromium. So this script:
 *   1. launches the Playwright-managed Chromium already cached on this machine
 *      (the `playwright` npm package is NOT resolvable from this repo, but the
 *      browser binary is present and needs no package),
 *   2. navigates to a real page on the target origin, which clears the WAF and
 *      sets whatever cookies it wants,
 *   3. runs `fetch()` from inside that page's JS context — SAME-ORIGIN, so no
 *      CORS problem, and it reuses the browser's TLS stack and cookie jar,
 *   4. returns the bytes as base64 over CDP and writes them to disk.
 *
 * Chromium is driven over the DevTools Protocol using Node's built-in WebSocket
 * (Node >= 22), so this adds no dependency.
 *
 * `--headless=new` plus a real `--user-agent` and
 * `--disable-blink-features=AutomationControlled` is required: the legacy
 * `--headless` mode advertises "HeadlessChrome" and is itself blocked.
 *
 * Usage:
 *   node scripts/fetchViaBrowser.mjs --origin <page-url> --out <dir> \
 *        --map "<name>=<url>" [--map ...]
 *
 * Example:
 *   node scripts/fetchViaBrowser.mjs \
 *     --origin "https://www.tigard-or.gov/your-government/departments/finance" \
 *     --out docs/Tigard \
 *     --map "tigard-2025-acfr.pdf=https://www.tigard-or.gov/home/showpublisheddocument/6307/639051272038830000"
 *
 * Only writes files whose bytes begin with the %PDF magic number — a WAF error
 * page saved as a .pdf would otherwise fail much later and much more confusingly.
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import path from 'node:path';
import os from 'node:os';

const CHROME_CANDIDATES = [
  path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'),
  path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe'),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const PORT = 9333;

function findChrome() {
  const hit = CHROME_CANDIDATES.find(p => existsSync(p));
  if (!hit) { console.error('No Chromium found. Looked in:\n  ' + CHROME_CANDIDATES.join('\n  ')); process.exit(2); }
  return hit;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForDevTools(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chromium DevTools endpoint never came up');
}

/** Minimal CDP client over Node's built-in WebSocket. */
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.sessionId = null;
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true });
                                      ws.addEventListener('error', rej, { once: true }); });
    return new CDP(ws);
  }
  send(method, params = {}, sessionId = this.sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`)); } }, 180_000);
    });
  }
}

async function main() {
  const { values: o } = parseArgs({
    options: { origin: { type: 'string' }, out: { type: 'string' },
               map: { type: 'string', multiple: true } },
    strict: false,
  });
  if (!o.origin || !o.out || !o.map?.length) {
    console.error('Usage: --origin <page-url> --out <dir> --map "name=url" [--map ...]');
    process.exit(1);
  }
  const targets = o.map.map(m => {
    const i = m.indexOf('=');
    if (i < 0) { console.error(`Bad --map (need name=url): ${m}`); process.exit(1); }
    return { name: m.slice(0, i), url: m.slice(i + 1) };
  });
  mkdirSync(o.out, { recursive: true });

  const chrome = spawn(findChrome(), [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    `--user-agent=${UA}`,
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${path.join(os.tmpdir(), 'cdp-fetch-profile')}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let failures = 0;
  try {
    const browserWs = await waitForDevTools();
    const cdp = await CDP.connect(browserWs);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    cdp.sessionId = sessionId;
    await cdp.send('Page.enable');

    console.log(`Clearing WAF via ${o.origin} ...`);
    await cdp.send('Page.navigate', { url: o.origin });
    await sleep(6000);

    const title = await cdp.send('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
    console.log(`  page title: ${title.result.value}`);
    if (/access denied|forbidden/i.test(title.result.value ?? '')) {
      console.error('  WAF still blocking the origin page — aborting.');
      process.exit(1);
    }

    for (const t of targets) {
      process.stdout.write(`  ${t.name} ... `);
      const expr = `
        (async () => {
          const r = await fetch(${JSON.stringify(t.url)}, { credentials: 'include' });
          if (!r.ok) return { error: 'HTTP ' + r.status };
          const buf = new Uint8Array(await r.arrayBuffer());
          let s = ''; const CH = 0x8000;
          for (let i = 0; i < buf.length; i += CH) s += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
          return { b64: btoa(s), len: buf.length, type: r.headers.get('content-type') || '' };
        })()`;
      let res;
      try {
        res = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      } catch (e) { console.log(`FAILED (${e.message})`); failures++; continue; }
      const v = res.result?.value;
      if (!v || v.error) { console.log(`FAILED (${v?.error ?? 'no value'})`); failures++; continue; }
      const bytes = Buffer.from(v.b64, 'base64');
      if (bytes.subarray(0, 4).toString('latin1') !== '%PDF') {
        console.log(`FAILED (not a PDF: ${v.type}, ${bytes.length} bytes)`); failures++; continue;
      }
      writeFileSync(path.join(o.out, t.name), bytes);
      console.log(`OK  ${bytes.length.toLocaleString()} bytes`);
    }
  } finally {
    chrome.kill();
  }
  if (failures) { console.error(`\n${failures} download(s) failed.`); process.exit(1); }
  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });

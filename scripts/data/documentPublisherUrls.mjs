/**
 * ⚠⚠⚠ WHERE EACH PARSED DOCUMENT ACTUALLY LIVES — AND WHY THESE LOADERS MAY NO
 * LONGER INVENT IT.
 *
 * Ten loaders in this directory used to write their provenance like this:
 *
 *     base_url: 'file://' + pdfAbsPath.replace(/[\\]/g, '/'),
 *
 * which records the path a PDF happened to sit at on one contributor's laptop.
 * 51 of those reached the production database (86 rows, 11 cities) and sat
 * there unnoticed until #381, because no gate had ever read `base_url`. They
 * are not a weak citation; they are the provenance never having been recorded,
 * and `docs/*` is gitignored, so the only copy of each document was on one
 * machine.
 *
 * ⛔⛔ REPAIRING THE DATA WOULD NOT HAVE HELD. The next run of any of those
 * loaders re-mints the laptop path over the repair — exactly what
 * `loadWICMREB.js` would have done to the Wisconsin citations in #379. So the
 * loaders now ASK THIS TABLE, and `publisherUrlFor()` THROWS on a document it
 * cannot vouch for rather than falling back to the filesystem. A loader that
 * cannot say where its document came from should stop, not quietly record the
 * operator's hard disk.
 *
 * ── ⭐ WHAT "PROVEN" MEANS HERE, AND IT IS THE STRONGEST RUNG ───────────────
 *
 * Every entry was settled by downloading the document from the publisher in
 * full and comparing **sha256 against the local file the loader parsed** —
 * not "the URL looks right", not "the page links it", not even "the byte count
 * matches". 23/23 identical on 2026-11-11.
 *
 * ⚠ A LENGTH MATCH IS A HINT. Fresno's budget page TODAY links an 11 MB file
 * for FY2024 while the document TT parsed is 53 MB and still sits at its
 * original upload path; FY2025's page link is a 52,234,448-byte re-upload of a
 * 52,343,956-byte document. Both would have passed a size eyeball and cited
 * the wrong file.
 *
 * ── WHAT IS MISSING, AND WHY ───────────────────────────────────────────────
 *
 * 28 documents (Fremont 7, Richardson 8, San José 5, Santa Ana 4, Anaheim 2,
 * Bakersfield 2) are absent because their publishers refuse every automated
 * client at the document endpoint — full browser headers, the `Sec-Fetch-*`
 * pair from #375, and real headless Chromium with a cookie-setting page visit
 * first all returned 403 on 2026-11-11 — and web.archive.org, the usual
 * fallback, was offline that day. Their loaders will now THROW instead of
 * writing a laptop path. See scripts/data/sourceEndpointBaseline.mjs.
 *
 * ⛔ Do NOT add an entry from a search result. The value of this file is that
 * every URL in it is proven; an unproven one is #380's defect (a plausible
 * link that is not the document) in a new costume.
 */

/** local repo path (POSIX, relative to the repo root) -> the proven publisher URL. */
export const PROVEN_DOCUMENT_URLS = Object.freeze({
  'docs/Fresno/fy2020-adopted-budget.pdf': {
    url: 'https://www.fresno.gov/wp-content/uploads/2023/04/FY2020AdoptedBudgetUpdated2.pdf',
    sha256: 'df81f7aeeff7fbe64a68af5f71af0d75cdc6e70fa67f8657e571623da6464837',
    bytes: 31916298,
    provenOn: '2026-11-11',
  },
  'docs/Fresno/fy2021-adopted-budget.pdf': {
    url: 'https://www.fresno.gov/wp-content/uploads/2023/04/FY-2021-Final-Revised-Budget_WEBPAGE.pdf',
    sha256: 'b59fb0bc7014a36c9d527eeb5166fd5b0b769f54a42033a63dabcde869c61769',
    bytes: 9114179,
    provenOn: '2026-11-11',
  },
  'docs/Fresno/fy2022-adopted-budget.pdf': {
    url: 'https://www.fresno.gov/wp-content/uploads/2023/04/FY2022AdoptedBudgetLINKS.pdf',
    sha256: '71bbed9af74c7993082f6ffe08715caa466937a8b40af339325749b6be60f8c6',
    bytes: 41667961,
    provenOn: '2026-11-11',
  },
  'docs/Fresno/fy2023-adopted-budget.pdf': {
    url: 'https://www.fresno.gov/wp-content/uploads/2023/04/upload_tempFY-2023-Adopted-Budget-1.pdf',
    sha256: '2fe1e7451031e2dc0a15fd69e60d2251f3cdedf87e2aded52b9e880aa18607ac',
    bytes: 48474479,
    provenOn: '2026-11-11',
  },
  'docs/Fresno/fy2024-adopted-budget.pdf': {
    url: 'https://www.fresno.gov/wp-content/uploads/2023/10/FY-2023-2024-Adopted-Budget.pdf',
    sha256: 'f0c4f0cccc129219fb77a3853b8a504623f407ad72abfd49995e260624851ee5',
    bytes: 52985177,
    provenOn: '2026-11-11',
  },
  'docs/Fresno/fy2025-adopted-budget.pdf': {
    url: 'https://www.fresno.gov/wp-content/uploads/2024/10/FY-2025-ADOPTED-BUDGET.pdf',
    sha256: 'c39e71d990c4003c4bc7f5d11edeb5978957610a5be05bf483507796e266d640',
    bytes: 52343956,
    provenOn: '2026-11-11',
  },
  'docs/Fresno/fy2026-adopted-budget.pdf': {
    url: 'https://www.fresno.gov/wp-content/uploads/2025/10/FY-2026-Adopted-Budget.pdf',
    sha256: '36eed0b99e75ee528b2cc24fecbca5ee5562f55554e8df310a0ca4fdc85f98b9',
    bytes: 131873504,
    provenOn: '2026-11-11',
  },

  'docs/Long Beach/fy22-fund-summary-gp.pdf': {
    url: 'https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/fy-22-adopted-budget/34-fund-summary-gp_22a-v2-gs',
    sha256: '9c9075f5e8d89308f118a9813a3aa186f80fce372d65145761d0c641e929525c',
    bytes: 414042,
    provenOn: '2026-11-11',
  },
  'docs/Long Beach/fy23-fund-summary-gp.pdf': {
    url: 'https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/fy-23-adopted-budget/34-fund-summary-gp_23a_v1',
    sha256: '4ada4f4a2423cc8f8c57ec2adaba95e1065a42d6ce3dfa8948d6c1d642b32e7f',
    bytes: 413752,
    provenOn: '2026-11-11',
  },
  'docs/Long Beach/fy24-fund-summary-gp.pdf': {
    url: 'https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/fy-24-adopted-budget/35-fund-summary-gp',
    sha256: '58d7b5c4db25ae5ba47e07409f080906dff3a0319549900ed57cc169cc3417f7',
    bytes: 414327,
    provenOn: '2026-11-11',
  },
  'docs/Long Beach/fy25-fund-summary-gp.pdf': {
    url: 'https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/fy-25-adopted-budget/35-fund-summary-gp',
    sha256: '14379151b523e495281725223c3c23850961b2298d2fb03b5234706bec062fa7',
    bytes: 414717,
    provenOn: '2026-11-11',
  },
  'docs/Long Beach/fy26-fund-summary-gp.pdf': {
    url: 'https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/fy-26-adopted-budget/33-fund-summary-gp',
    sha256: '067e2e5bfb4cbd7842b483ec90f520e7f74d0364f2333b66efd2568ffd371cae',
    bytes: 557826,
    provenOn: '2026-11-11',
  },

  'docs/Oakland/fy2023-25-adopted-budget.pdf': {
    url: 'https://cao-94612.s3.us-west-2.amazonaws.com/documents/FY23-25-Adopted-Budget-Book-FINAL-Reduced-Size.pdf',
    sha256: '3f21377d8b8e190a01daf6428ab52eb1fb2d5d37c0edda32e3fa30c9ff177dd8',
    bytes: 41502904,
    provenOn: '2026-11-11',
  },
  'docs/Oakland/fy2024-25-midcycle-adopted-budget.pdf': {
    url: 'https://cao-94612.s3.us-west-2.amazonaws.com/documents/FY24-25-Adopted-Budget-Book-FINAL-Reduced-Size.pdf',
    sha256: 'a5223e4200657f3239694d11f4e0c7c18bd7a9f00542889d2e4d65f225abccaa',
    bytes: 51358302,
    provenOn: '2026-11-11',
  },

  'docs/Plano/2018-19 Program of Service - Operating Budget (PDF).pdf': {
    url: 'https://content.civicplus.com/api/assets/tx-plano/4e5b3769-a935-4aee-8698-29e4d192ab98',
    sha256: 'd25c0d4c67698cdfc7f468a3103d3424d0917fe6193ab3aa2b4a06c1fb1b34e4',
    bytes: 42856906,
    provenOn: '2026-11-11',
  },
  'docs/Plano/2019-20 Program of Service - Operating Budget (PDF).pdf': {
    url: 'https://content.civicplus.com/api/assets/tx-plano/39ed8ea7-626b-4264-9465-f64a85c1244b',
    sha256: '341c229002546018fecde53b415601e99eeebfa77fe1ab2115f810108c8c6db3',
    bytes: 19531063,
    provenOn: '2026-11-11',
  },
  'docs/Plano/2021-22 Program of Service - Operating Budget (PDF).pdf': {
    url: 'https://content.civicplus.com/api/assets/tx-plano/5a4703dd-412b-4996-9d04-b7cf49eabedb',
    sha256: 'f71900243476b745b633f5da1f39ee9f20568aadc3524cc3998c14d2fd10e1a3',
    bytes: 8968285,
    provenOn: '2026-11-11',
  },
  'docs/Plano/2022-23 Program of Service - Operating Budget (PDF).pdf': {
    url: 'https://content.civicplus.com/api/assets/tx-plano/782a36c6-6b69-4329-a759-05e943ca8b63',
    sha256: 'df02ebe6963440a3ef4a4a3edf8534d3aa2363e3433cc7f936f5a8e8680be9a9',
    bytes: 12284724,
    provenOn: '2026-11-11',
  },
  'docs/Plano/2023-24 Program of Service - Operating Budget (PDF).pdf': {
    url: 'https://content.civicplus.com/api/assets/tx-plano/9fafb1c4-1096-444f-acd4-5499420af179',
    sha256: '7f70b4f55c51cb29ae657feac436d5b9930946c6437ecf20ebd9f74211ac3e43',
    bytes: 15568132,
    provenOn: '2026-11-11',
  },
  'docs/Plano/2024-25 Program of Service - Operating Budget (PDF).pdf': {
    url: 'https://content.civicplus.com/api/assets/tx-plano/f2f8d001-72a8-4bab-bfa2-70fb41e5ba91',
    sha256: '1f1a8cbb2fc3a7484488042874860964a4344c4f5b0bdd8e12820dd4ff559de8',
    bytes: 17215004,
    provenOn: '2026-11-11',
  },
  'docs/Plano/2025-26 Program of Service - Operating Budget (PDF).pdf': {
    url: 'https://content.civicplus.com/api/assets/tx-plano/d8ecb839-3e56-45eb-a2ae-87287b26e2f1',
    sha256: '3c94cdf2641cbcd5e920dac68de2fdc1b86b81cce77d2fd1b581355e7cb44961',
    bytes: 12172656,
    provenOn: '2026-11-11',
  },

  'docs/Riverside/fy2022-24-adopted-budget.pdf': {
    url: 'https://riversideca.gov/finance/FY%202022-2024%20Biennial%20Budget%20(2).pdf',
    sha256: '2123e63fddc22a784daad84319ed9c27d7f86f9e095365bd36d6c476108dfce0',
    bytes: 15455750,
    provenOn: '2026-11-11',
  },
  'docs/Riverside/fy2024-26-adopted-budget.pdf': {
    url: 'https://www.riversideca.gov/finance/PDF/FY24-26%20Budget/FY%202024-2026%20Budget%20Book.pdf',
    sha256: '919ca436b345aef2803d6bd9ba7f654e5788ac60e2ccd173a50f1c6e44ccc47d',
    bytes: 22699187,
    provenOn: '2026-11-11',
  },
});

/**
 * Normalise whatever a loader passes — an absolute Windows path, an absolute
 * POSIX path, or a repo-relative one — to the `docs/<City>/<file>` key above.
 */
export function documentKey(p) {
  const posix = String(p).split('\\').join('/');
  const i = posix.toLowerCase().lastIndexOf('/docs/');
  if (i !== -1) return posix.slice(i + 1);
  return posix.replace(/^\.\//, '');
}

/**
 * ⛔ THROWS for a document whose publisher URL has not been PROVEN. That is the
 * point: the alternative a loader used to reach for was the operator's
 * filesystem, and a `file://` path in a served column is worse than a failed
 * run — it looks like provenance and is not.
 */
export function publisherUrlFor(localPath) {
  const key = documentKey(localPath);
  const hit = PROVEN_DOCUMENT_URLS[key];
  if (hit) return hit.url;
  throw new Error([
    `No PROVEN publisher URL for ${key}.`,
    '  This loader may NOT fall back to a file:// path — that records the',
    '  operator’s filesystem as provenance, which is what #381 found 51 of',
    '  sitting in production.',
    '  Find the document on the publisher, download it IN FULL, confirm its',
    '  sha256 matches the local copy, then add it to',
    '  scripts/data/documentPublisherUrls.mjs with the date you proved it.',
  ].join('\n'));
}

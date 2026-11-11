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
 * matches". 23/23 identical on 2026-11-11, and 18/18 more the same day once
 * the Internet Archive came back and three of the six refusing hosts turned
 * out to have moved rather than closed.
 *
 * ⚠ A LENGTH MATCH IS A HINT. Fresno's budget page TODAY links an 11 MB file
 * for FY2024 while the document TT parsed is 53 MB and still sits at its
 * original upload path; FY2025's page link is a 52,234,448-byte re-upload of a
 * 52,343,956-byte document. Both would have passed a size eyeball and cited
 * the wrong file.
 *
 * ── ⚠⚠ `archived: true` — WHAT IT MEANS AND WHEN IT IS ALLOWED ─────────────
 *
 * Eleven entries carry `archived: true`, a `publisher` field, and a
 * `web.archive.org/web/<ts>id_/<publisher url>` link. That is the ONLY form an
 * archive citation may take here, and it is allowed only where the publisher
 * refuses every client we have:
 *
 *   • fremont.gov, cor.net and sanjoseca.gov answer an identical 466-byte WAF
 *     page to curl, to the full browser header set, and to the real headless
 *     Chromium `npm run e2e` installs. They do not say the document is gone;
 *     they decline to say anything.
 *   • So the publisher URL can be proven to have served these bytes AT CAPTURE
 *     TIME, while the `id_` URL is proven to serve them TODAY. Publishing the
 *     first would hand a reader a 403 and call it provenance.
 *
 * ⭐ Nothing is hidden by this: the publisher's own URL is inside the link, and
 * repeated in `publisher` so it is data rather than a comment. The rule's other
 * half is in scripts/lib/ncAcfrSources.mjs — never an archive URL when the
 * publisher will serve the live one, which is why Anaheim and Santa Ana below
 * cite their own hosts.
 *
 * ── WHAT IS MISSING, AND WHY ───────────────────────────────────────────────
 *
 * 10 documents are still absent, each for a reason that is now specific:
 *
 *   Bakersfield  2  FOUND, not fetchable — Laserfiche WebLink DocView ids
 *                   1957514 and 1957516. WebLink builds its download link at
 *                   runtime and checks a CookieCheck.aspx cookie, so three
 *                   constructed endpoints each returned `200` with an EMPTY
 *                   body. ⚠ The city's current page also serves RE-COMPRESSED
 *                   renditions (18,973,665 bytes vs the 23,164,475 parsed), so
 *                   the parsed bytes may not be published anywhere now.
 *   San José     4  The city publishes ~90 per-section PDFs; TT parsed single
 *                   whole-book files. 246 captures in the right size band were
 *                   hashed and exactly one (FY2021-22) is the book.
 *   Richardson   3  FY2024/25/26 "Downloadable Budget" — no capture exists.
 *   Fremont      1  FY2024/25 Proposed — the only capture is TRUNCATED, 1.96 MB
 *                   of a 12.85 MB document.
 *
 * Their loaders will THROW instead of writing a laptop path. See
 * scripts/data/sourceEndpointBaseline.mjs.
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
  'docs/Anaheim/fy2025-adopted-budget.pdf': {
    url: 'https://www.anaheim.net/ArchiveCenter/ViewFile/Item/926',
    sha256: 'a6f35d3e16a3dc54a975101b60fd24cf2f308a68ef9689549fc491b31981fd12',
    bytes: 14094391,
    provenOn: '2026-11-11',
  },
  'docs/Anaheim/fy2026-adopted-budget.pdf': {
    url: 'https://www.anaheim.net/ArchiveCenter/ViewFile/Item/964',
    sha256: '98ec330df1ba387ac1065548e93576198d002158320974a785fa9f829f9a054a',
    bytes: 22831979,
    provenOn: '2026-11-11',
  },
  'docs/Fremont/202526 Adopted Budget_20250829_Webposting.pdf': {
    url: 'https://web.archive.org/web/20260106085335id_/https://www.fremont.gov/home/showpublisheddocument/18666',
    sha256: '2788e0132f907d2d423de19ea872c47ff5e2a018629d4ce868c6a5936c318702',
    bytes: 13394677,
    provenOn: '2026-11-11',
    archived: true,
    publisher: 'https://www.fremont.gov/home/showpublisheddocument/18666',
  },
  'docs/Fremont/FY 201920 Adopted Budget.pdf': {
    url: 'https://web.archive.org/web/20250403010318id_/https://www.fremont.gov/home/showpublisheddocument/1085/637751659290400000',
    sha256: 'c672d522448a96053bb234ce70696302ca0e4b1957ead199992af97f12e4da79',
    bytes: 12249795,
    provenOn: '2026-11-11',
    archived: true,
    publisher: 'https://www.fremont.gov/home/showpublisheddocument/1085/637751659290400000',
  },
  'docs/Fremont/FY 202021 Adopted Budget.pdf': {
    url: 'https://web.archive.org/web/20250331093044id_/https://www.fremont.gov/home/showpublisheddocument/1087/637751659300230000',
    sha256: '648c51f7d9c1daec49f0e130c5381904b4ef7e8b8b63baba66ee11572ef33bfc',
    bytes: 9283838,
    provenOn: '2026-11-11',
    archived: true,
    publisher: 'https://www.fremont.gov/home/showpublisheddocument/1087/637751659300230000',
  },
  'docs/Fremont/FY 202122 Adopted Budget.pdf': {
    url: 'https://web.archive.org/web/20250331031126id_/https://www.fremont.gov/home/showpublisheddocument/1089/637806234781330000',
    sha256: '852c77aa925759677ef8db095894cb29e5ffd683ad236f1c16946261c13714b0',
    bytes: 12194517,
    provenOn: '2026-11-11',
    archived: true,
    publisher: 'https://www.fremont.gov/home/showpublisheddocument/1089/637806234781330000',
  },
  'docs/Fremont/FY 202223 Adopted Operating Budget.pdf': {
    url: 'https://web.archive.org/web/20250403010309id_/https://www.fremont.gov/home/showpublisheddocument/11387/638003863935300000',
    sha256: '817e737739fceacea9ed733410b2ce4354ccaf162e4b46714290736c4a9e11fe',
    bytes: 14430404,
    provenOn: '2026-11-11',
    archived: true,
    publisher: 'https://www.fremont.gov/home/showpublisheddocument/11387/638003863935300000',
  },
  'docs/Fremont/FY 202324 Adopted Operating Budget.pdf': {
    url: 'https://web.archive.org/web/20250401114729id_/https://www.fremont.gov/home/showpublisheddocument/13972/638387490392300000',
    sha256: 'c56b13331ac8b76efc70789456ccd5d6c0f7e7a8e590f6921ae2fc585d3aae01',
    bytes: 11109586,
    provenOn: '2026-11-11',
    archived: true,
    publisher: 'https://www.fremont.gov/home/showpublisheddocument/13972/638387490392300000',
  },
  'docs/Richardson/2019 Approved Budget FINAL.xlsx': {
    url: 'https://web.archive.org/web/20230309070128id_/https://www.cor.net/home/showpublisheddocument/24779/636752176563970000',
    sha256: '8f4851e02c1c0eb5b721799bebf5bdf11f315d18a15cafbd9f152606112d58a5',
    bytes: 145939,
    provenOn: '2026-11-11',
    archived: true,
    publisher: 'https://www.cor.net/home/showpublisheddocument/24779/636752176563970000',
  },
  'docs/Richardson/2020 Approved Budget FINAL.xlsx': {
    url: 'https://web.archive.org/web/20230309070104id_/https://www.cor.net/home/showpublisheddocument/28085/637160743022970000',
    sha256: 'd060f822166bfa996ea9c00fa410b0fd7cbd8b4482384073af44030ad7415e99',
    bytes: 171971,
    provenOn: '2026-11-11',
    archived: true,
    publisher: 'https://www.cor.net/home/showpublisheddocument/28085/637160743022970000',
  },
  'docs/Richardson/2021 Approved Budget Final.xlsx': {
    url: 'https://web.archive.org/web/20230309070044id_/https://www.cor.net/home/showpublisheddocument/30364/637462966851830000',
    sha256: '352a256fbab30e5ef936efc5e48e5c6cac06c73cdb8f59dbee524498744797d8',
    bytes: 172636,
    provenOn: '2026-11-11',
    archived: true,
    publisher: 'https://www.cor.net/home/showpublisheddocument/30364/637462966851830000',
  },
  'docs/Richardson/2021-2022 Downloadable Budget.xlsx': {
    url: 'https://web.archive.org/web/20230309070045id_/https://www.cor.net/home/showpublisheddocument/33788/637684340157330000',
    sha256: '5aeb482b1a5d5ada5e1418d1c04623fb0de8d524f4bf4b4dca1fe68f2632b534',
    bytes: 143209,
    provenOn: '2026-11-11',
    archived: true,
    publisher: 'https://www.cor.net/home/showpublisheddocument/33788/637684340157330000',
  },
  'docs/Richardson/FY 2018 Downloadable Budget.xlsx': {
    url: 'https://web.archive.org/web/20230309070126id_/https://www.cor.net/home/showpublisheddocument/21012/636650028366200000',
    sha256: '3ab09f84b070ef876d9ff328dd957ce9e7f7097b1fb1568c5c69c98bd429645e',
    bytes: 173938,
    provenOn: '2026-11-11',
    archived: true,
    publisher: 'https://www.cor.net/home/showpublisheddocument/21012/636650028366200000',
  },
  'docs/SanJose/20212022 Adopted Operating Book MASTER.pdf': {
    url: 'https://web.archive.org/web/20250725223944id_/https://www.sanjoseca.gov/home/showpublisheddocument/78329/637837085648370000',
    sha256: 'fb1a5d44fa07bc36806d6f02c08b555e1d775b3fb8b9d987edfe67dd16ab1b7b',
    bytes: 27687431,
    provenOn: '2026-11-11',
    archived: true,
    publisher: 'https://www.sanjoseca.gov/home/showpublisheddocument/78329/637837085648370000',
  },
  'docs/Santa Ana/fy2023-adopted-budget.pdf': {
    url: 'https://storage.googleapis.com/proudcity/santaanaca/uploads/2022/07/FY-22-23-Budget-Detail-Adopted-FINAL-WEB-v2.pdf',
    sha256: 'dcf4a8b3be28c853c5223b90367ff51cf22dbd321c648b9010405bf2fc5498b6',
    bytes: 38084101,
    provenOn: '2026-11-11',
  },
  'docs/Santa Ana/fy2024-adopted-budget.pdf': {
    url: 'https://storage.googleapis.com/proudcity/santaanaca/uploads/2023/08/FY-2023-24-Adopted-Budget-Book-June-20th-2023-V13-compressed.pdf',
    sha256: '2749b5ec50bd130b40efa3986298fa670292ca719971777d60da2bace00673f8',
    bytes: 12770053,
    provenOn: '2026-11-11',
  },
  'docs/Santa Ana/fy2025-adopted-budget.pdf': {
    url: 'https://storage.googleapis.com/proudcity/santaanaca/2024/08/07-30-Budget-Book-Draft_V6_Hyperlinked_Compressed.pdf',
    sha256: '222edca8df38e8d918b74d694371eefe4da08c0c351ba4c38f13d20519bfd4c3',
    bytes: 18089469,
    provenOn: '2026-11-11',
  },
  'docs/Santa Ana/fy2026-adopted-budget.pdf': {
    url: 'https://storage.googleapis.com/proudcity/santaanaca/2025/07/FY25-26-Budget-Book-Draft_V26_Compressed.pdf',
    sha256: 'cfd21e338cbc11d581a9095332440261f82006a2a4ad702edc34e92adffd215a',
    bytes: 20203871,
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

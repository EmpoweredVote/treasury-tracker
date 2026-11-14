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
 * ⭐ EMPTY IS THE PREFERRED STATE, AND IT WAS EMPTY UNTIL 2026-11-12. On
 * 2026-11-09 all 1,857 stored citations were asked and none needed declaring.
 * Three days later the fleet run (2,047 citations) could not ask 26 of them,
 * across four hosts that had each changed their minds about automated clients.
 * A person opened one link per host in a browser on 2026-11-12 and saw the
 * document; those four checks are what the `checkedOn` dates below record.
 *
 * ⚠⚠ THESE HOSTS FLAKE. Myrtle Beach and Richmond County were reachable in the
 * partial run of 2026-11-12 and refusing hours later. Expect entries here to go
 * stale — that is the mechanism working, not a bug. Delete them when they do.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⭐⭐⭐ 26 → 8: BEND'S EIGHTEEN WERE DELETED ON 2026-11-13, AND WHY THEY WERE
 * EVER WRITTEN IS THE LESSON
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Every Bend entry said the same thing: *"bendoregon.gov answers 403 text/html
 * to every automated client tried — node and curl, with and without the
 * Sec-Fetch headers."* That sentence was honest and it was wrong, because the
 * client is not the only variable. Measured on the same URL in the same
 * minute, 2026-11-13:
 *
 *   curl   Range: bytes=0-0   →  206 application/pdf          ✅
 *   curl   full GET           →  403 + 1,575 B "Checking your browser…"
 *   node   Range: bytes=0-0   →  403 + 103 B
 *   node   HEAD / full GET    →  403
 *
 * ⚠⚠⚠ TWO INDEPENDENT REFUSALS, AND THE 2026-11-12 CHECK HIT BOTH AT ONCE:
 *
 *   1. **Node's fetch is fingerprinted and refused outright.** Not a rate
 *      limit, not a header — the same shape `sourceUrlProbe.mjs` already
 *      records for mckinneytexas.org (403) and web.archive.org (429). Headers
 *      change nothing: curl serves with and without Sec-Fetch, node is refused
 *      with and without it.
 *   2. **Whole-file GETs are challenged** whatever the client, which is an
 *      ordinary bandwidth policy and not a statement about the document.
 *
 * ⭐⭐ SO THE PROBE THAT ANSWERS IS THE ONE THAT ASKS FOR A BYTE. The missing
 * variable on 2026-11-12 was never a header; it was `Range`. A reader clicking
 * the link gets the PDF, and so does anything that asks the way a range
 * request asks.
 *
 * ⛔⛔ AND THE GREEN RUN IS LOAD-BEARING ON THE curl FALLBACK. The gate reaches
 * 206 on all eighteen only because `probeOnce` climbs HEAD → ranged GET → curl
 * and the first two rungs are refused. Delete that fallback (#387) and
 * eighteen correct Bend citations go red the same day.
 *
 * ⚠ A WRONG DIAGNOSIS WAS TRIED FIRST AND IS RECORDED SO IT IS NOT RETRIED:
 * the 403s looked like a bot score provoked by downloading eighteen ACFRs in a
 * burst, so the host was left in silence for fifteen minutes and re-asked
 * cold. It answered 403 to all eighteen, because nothing was draining. The
 * Archive's cumulative-limiter shape is real (#387) and this was not it.
 *
 * ⭐⭐⭐ NONE OF THE EIGHTEEN WAS DELETED ON A 206 ALONE. `extractBend.py` read
 * these ACFRs out of `docs/Bend/` at load time and the files are still there,
 * so the whole ladder was climbed without costing Bend a download:
 *   · 32 of 36 budgets: the stored figure appears verbatim in that year's ACFR.
 *   · 4 of 36 differ by exactly $1 — FY2010 revenue, FY2013 operating, FY2014
 *     both — and all four are already registered in `extractBend.py`'s
 *     `source_rounding` with that exact delta. They are Bend's own printed
 *     total disagreeing with Bend's own printed components; the extractor
 *     stores the component sum so the drill-down adds up.
 *   · 18 of 18 `Content-Range` totals equal the local file's size byte for
 *     byte, which is what makes the figure tie a statement about the document
 *     AT THAT URL rather than about a file on one laptop.
 *
 * @type {{id: string, url: string, why: string, checkedOn: string}[]}
 */
export const SOURCE_URL_EXCEPTIONS = [
  {
    id: "ohio-oh-fy2025",
    url: "https://archives.obm.ohio.gov/Files//State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2025/ACFR%20FY25.pdf",
    why: "Ohio, OH FY2025 \u2014 archives.obm.ohio.gov omits its TLS intermediate certificate, so curl and node abort the handshake (\"unable to get local issuer certificate\"); browsers fetch the missing certificate themselves via AIA and the file serves. A person opened it in a browser on 2026-11-12 and the PDF renders; with the chain ignored the server returns 200 application/pdf, 11.7 MB. The defect is the publisher's to fix.",
    checkedOn: '2026-11-12',
  },
  {
    id: "ohio-oh-fy2020",
    url: "https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2020/CAFR_2020.pdf",
    why: "Ohio, OH FY2020 \u2014 archives.obm.ohio.gov omits its TLS intermediate certificate, so curl and node abort the handshake (\"unable to get local issuer certificate\"); browsers fetch the missing certificate themselves via AIA and the file serves. A person opened it in a browser on 2026-11-12 and the PDF renders; with the chain ignored the server returns 200 application/pdf, 11.7 MB. The defect is the publisher's to fix.",
    checkedOn: '2026-11-12',
  },
  {
    id: "ohio-oh-fy2021",
    url: "https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2021/ACFR_2021.pdf",
    why: "Ohio, OH FY2021 \u2014 archives.obm.ohio.gov omits its TLS intermediate certificate, so curl and node abort the handshake (\"unable to get local issuer certificate\"); browsers fetch the missing certificate themselves via AIA and the file serves. A person opened it in a browser on 2026-11-12 and the PDF renders; with the chain ignored the server returns 200 application/pdf, 11.7 MB. The defect is the publisher's to fix.",
    checkedOn: '2026-11-12',
  },
  {
    id: "ohio-oh-fy2022",
    url: "https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2022/ACFR_2022.pdf",
    why: "Ohio, OH FY2022 \u2014 archives.obm.ohio.gov omits its TLS intermediate certificate, so curl and node abort the handshake (\"unable to get local issuer certificate\"); browsers fetch the missing certificate themselves via AIA and the file serves. A person opened it in a browser on 2026-11-12 and the PDF renders; with the chain ignored the server returns 200 application/pdf, 11.7 MB. The defect is the publisher's to fix.",
    checkedOn: '2026-11-12',
  },
  {
    id: "ohio-oh-fy2023",
    url: "https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2023/ACFR_2023.pdf",
    why: "Ohio, OH FY2023 \u2014 archives.obm.ohio.gov omits its TLS intermediate certificate, so curl and node abort the handshake (\"unable to get local issuer certificate\"); browsers fetch the missing certificate themselves via AIA and the file serves. A person opened it in a browser on 2026-11-12 and the PDF renders; with the chain ignored the server returns 200 application/pdf, 11.7 MB. The defect is the publisher's to fix.",
    checkedOn: '2026-11-12',
  },
  {
    id: "ohio-oh-fy2024",
    url: "https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2024/ACFR_2024.pdf",
    why: "Ohio, OH FY2024 \u2014 archives.obm.ohio.gov omits its TLS intermediate certificate, so curl and node abort the handshake (\"unable to get local issuer certificate\"); browsers fetch the missing certificate themselves via AIA and the file serves. A person opened it in a browser on 2026-11-12 and the PDF renders; with the chain ignored the server returns 200 application/pdf, 11.7 MB. The defect is the publisher's to fix.",
    checkedOn: '2026-11-12',
  },
  {
    id: "myrtle-beach-sc-fy2018",
    url: "https://cms6.revize.com/revize/myrtlebeachsc/CAFR.pdf",
    why: "Myrtle Beach, SC FY2018 \u2014 cms6.revize.com answers 403 text/html to automated clients. A person opened it in a browser on 2026-11-12 and the PDF renders.",
    checkedOn: '2026-11-12',
  },
  {
    id: "richmond-county-va-fy2024",
    url: "https://data.virginia.gov/dataset/2024-amended-comparative-report-of-local-government-revenues-and-expenditures",
    why: "Richmond County, VA FY2024 \u2014 data.virginia.gov answers 403 to automated clients. This citation is a dataset landing page rather than a file; a person opened it in a browser on 2026-11-12 and it serves the amended comparative report.",
    checkedOn: '2026-11-12',
  },
];

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
    id: "bend-or-fy2014",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/2013-2014-CAFR.pdf",
    why: "Bend, OR FY2014 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2016",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/20152016CAFR.pdf",
    why: "Bend, OR FY2016 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2024",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/2023-2024-Annual-Financial-Report-with-Links.pdf",
    why: "Bend, OR FY2024 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2013",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/CAFR-12_13-as-of-121613-Final-with-dividers-tabs.pdf",
    why: "Bend, OR FY2013 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2019",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/City-Of-Bend-Oregon-FY2018-2019-CAFR-FINAL-ORIGINAL.pdf",
    why: "Bend, OR FY2019 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2025",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/City-of-Bend-ACFR-FY20242025.pdf",
    why: "Bend, OR FY2025 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2017",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/City-of-Bend-CAFR-2016-2017.pdf",
    why: "Bend, OR FY2017 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2011",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/City-of-Bend-FY10-11-CAFR-12-20-11.pdf",
    why: "Bend, OR FY2011 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2020",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/CityOfBendOregonFY20192020.pdf",
    why: "Bend, OR FY2020 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2021",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/CityOfBendOregonFY20202021.pdf",
    why: "Bend, OR FY2021 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2008",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/City_of_Bend_07_08_CAFR_for_Web.pdf",
    why: "Bend, OR FY2008 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2022",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/CityofBend-ACFR-FY2021-2022.pdf",
    why: "Bend, OR FY2022 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2023",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/CityofBend-ACFR-FY2022-2023-for-Web_Updated.pdf",
    why: "Bend, OR FY2023 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2006",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/FY-2006-CAFR-for-web.pdf",
    why: "Bend, OR FY2006 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2012",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/FY-2011-12-City-of-Bend-CAFR-122112.pdf",
    why: "Bend, OR FY2012 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2018",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/FY17-18-CAFR-COB-FINAL.pdf",
    why: "Bend, OR FY2018 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2009",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/FY2008_09_City_of_Bend_CAFR.pdf",
    why: "Bend, OR FY2009 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
    checkedOn: '2026-11-12',
  },
  {
    id: "bend-or-fy2010",
    url: "https://bendoregon.gov/wp-content/uploads/2025/12/FY2009_10_City_of_Bend_Oregon_CAFR.pdf",
    why: "Bend, OR FY2010 \u2014 bendoregon.gov answers 403 text/html to every automated client tried \u2014 node and curl, with and without the Sec-Fetch and Upgrade-Insecure-Requests headers this repo's own Oregon loader used to get through. A person opened it in a browser on 2026-11-12 and the PDF renders. A bot challenge tightened since the files were loaded, not a missing document.",
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

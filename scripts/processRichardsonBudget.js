#!/usr/bin/env node
/**
 * Richardson TX Operating Budget Loader — SKIPPED
 *
 * Richardson TX's website (cor.net) blocks all automated HTTP requests (HTTP 403).
 * The CivicLive CDN URL used during Phase 10-01 research served a Roseville, CA PDF
 * (Server_7964838 belongs to Roseville, not Richardson).
 *
 * Action required before this script can be implemented:
 *   1. Visit https://www.cor.net/departments/budget in a browser
 *   2. Find the direct PDF download URL for the Annual Budget document
 *   3. Implement this script following the processGarlandBudget.js pattern
 *
 * Placeholder data_source rows were seeded in Phase 10-01 via seedPDFDataSources.js:
 *   - Richardson Operating Budget FY2025
 *   - Richardson Operating Budget FY2026
 *
 * GF total estimate (from research): ~$150–200M
 * Sanity range when implemented: $100M–$250M
 */

console.log('Richardson TX budget loader is not yet implemented.');
console.log('The PDF URL must be sourced manually from https://www.cor.net/departments/budget');
console.log('See .planning/phases/10-collin-county/10-01-DRYRUN-NOTES.md for details.');
process.exit(1);

/**
 * Phase 66 — SoCal Enrichment Parity (ENR-03) authoring overrides.
 *
 * The SoCal op/rev taxonomy and most salary departments are ALREADY covered by the
 * Phase 61 universal category_enrichment rows (name_key-keyed, dataset-independent).
 * The residual is the salary department name_keys shared by >=2 SoCal cities that
 * Phase 61 did not cover. The worklist is derived LIVE from the production DB by
 * scripts/loadSoCalEnrichment66.mjs (all years, depth-0 budget_categories.link_key,
 * uncovered, >=2 distinct cities) — not hardcoded — so it stays reproducible.
 *
 * Each worklist key is resolved via the reused Phase 61 resolver
 * (SOCAL_EXACT/EXACT_OVERRIDE -> EXPLICIT_ROWS -> keyword ROUTE_RULES -> general_dept).
 * SOCAL_EXACT below maps department names that would otherwise hit the generic
 * `general_dept` fallback onto a more specific EXISTING Phase 61 CONCEPT. Every target
 * is an existing generic concept — no fabricated, city-specific, or $-bearing text.
 * Genuinely ambiguous or position-level names intentionally fall through to
 * `general_dept` ("City Department"), which is still a valid bleed-safe generic row.
 */

// name_key -> existing Phase 61 CONCEPT key. All targets are generic + bleed-safe.
export const SOCAL_EXACT = {
  // umbrella / services
  'government services':  'general_services',
  'municipal services':   'general_services',
  'stores':               'general_services',     // central stores / supply / warehouse
  'cemetery':             'general_services',
  // management / governance
  'town manager':         'city_manager',
  'governing body':       'city_council',
  // planning / development
  'land development':     'planning',
  'development':          'community_development',
  'com dev':              'community_development',
  'city planner':         'planning',
  'associate planner':    'planning',
  // IT
  'information tech':     'information_technology',
  'info technology':      'information_technology',
  'info systems':         'information_technology',
  'it applications':      'information_technology',
  'data processing':      'information_technology',
  // engineering / utilities / sewer
  'engineer':             'engineering',
  'wwtp':                 'sewer',                 // wastewater treatment plant
  'npdes':                'sewer',                 // stormwater discharge permit program
  'dwp':                  'utilities',             // dept of water & power
  // finance / admin / hr
  'fiscal services':      'finance',
  'business office':      'administration',
  'government affairs':   'administration',
  'administratin':        'administration',        // source typo
  'hr':                   'human_resources',
  // enforcement / youth
  'code':                 'code_enforcement',
  'teen center':          'youth_services',
};

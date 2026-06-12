# 43-02 Summary — Frontend Federal Support

**Executed:** 2026-06-12 | **Status:** Complete — both tasks pass

## Changes

**src/types/budget.ts** — `'federal'` added as 12th member of the `Municipality.entity_type` union.

**src/components/EntitySwitcher.tsx** — all five planned changes:
1. `ENTITY_TYPE_LABELS`: `federal: 'Federal Government'` (first entry)
2. Grouping memo: `federalEntities` pre-filter added; `cityEntities` filter now excludes both `'state'` and `'federal'` (prevents "US > Cities > United States" nesting); federal entities sorted and returned from memo
3. Empty-state check includes `grouped.federalEntities.length === 0`
4. FEDERAL GOVERNMENT section renders above STATE GOVERNMENTS — JSX copied verbatim from the state section (sticky header + option buttons showing `entity.name`)
5. Header pill: `'state' || 'federal'` → name only (selected federal shows "United States", not "United States, US")

## Verification

- `npx tsc --noEmit` → pass
- `npm run build` → pass (5.63s; pre-existing chunk-size warning only)
- With zero federal entities, both new render blocks are `length > 0`-gated → behavior identical to before

## Deviations from plan

None.

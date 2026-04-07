# Image Sources: Municipality Heroes & Politician Headshots

This document is written for the Civic Spaces team (and the Claude instances working with it)
to explain where EmpoweredVote currently sources and stores images, so we can avoid duplicating
that work and potentially centralize assets.

---

## 1. Municipality Hero Images

### Where they come from

Hero images for cities, counties, and townships are fetched live from the **Wikipedia REST API**:

```
GET https://en.wikipedia.org/api/rest_v1/page/summary/{article_title}
```

The response includes `originalimage.source` (preferred, higher resolution) and
`thumbnail.source` (fallback). The image is whatever Wikipedia uses as the lead image
for that municipality's article — typically a skyline, landmark, or aerial photo.

### How article titles are constructed

The treasury-tracker builds the Wikipedia article title based on `entity_type`:

| Entity type | Title pattern | Example |
|---|---|---|
| city / town / library / school_district | `{name}, {StateFull}` | `Bloomington, Indiana` |
| county | `{name}, {StateFull}` or `{name} County, {StateFull}` | `Monroe County, Indiana` |
| township | `{name}, {StateFull}` or `{name} Township, {StateFull}` | `Perry Township, Indiana` |

If no image is found, it falls back to just the state name (e.g. `Indiana`).

Source: `C:/treasury-tracker/src/utils/wikiImage.ts`

### Override via database

The `Municipality` record in ev-accounts can include a `hero_image_url` field.
If that field is set, it takes priority over Wikipedia — no API call is made.
This is the right place to store a curated or centrally-hosted image for a given entity.

### Caching

Images are cached **in-memory per browser session** only. There is no persistent cache —
every new session re-fetches from Wikipedia unless `hero_image_url` is set in the DB.

---

## 2. Politician / Candidate Headshots

These live in **ev-accounts** (Supabase, `essentials` schema).

### Database tables

**`essentials.politicians`** — one row per politician
- `photo_origin_url` (TEXT) — primary source image URL (e.g. official government photo)
- `photo_custom_url` (TEXT) — override URL; takes precedence over `photo_origin_url`

**`essentials.politician_images`** — one row per image (supports multiple per politician)
- `politician_id` (UUID FK)
- `url` (TEXT)
- `type` (TEXT) — e.g. `'default'`
- `photo_license` (TEXT)
- `focal_point` (VARCHAR 50) — CSS `object-position` value for cropping, e.g. `"center 30%"`

**`essentials.race_candidates`** — for challengers without a full politician record
- `photo_url` (TEXT)

### URL resolution precedence

When serving a politician's image, the system uses:
```sql
COALESCE(p.photo_custom_url, p.photo_origin_url, '') AS photo_origin_url
```
Custom override wins; origin URL is fallback; empty string if neither exists.

### API endpoints

All under `{EV_ACCOUNTS_API_BASE}/api/essentials/`:

| Endpoint | What it returns |
|---|---|
| `GET /politicians` | Flat list with nested `images: [{ id, url, type, photo_license, focal_point }]` |
| `GET /politicians/:id` | Full profile including `images[]`, contacts, etc. |
| `GET /essentials/race-candidates/:id` | Candidate record with `photo_url` |
| `PATCH /politicians/:id` | Update `photo_origin_url` (requires `essentials_data_editor` role) |

Filters on the list endpoint: `?include_candidates=true`, `?q=`, `?state=`, `?limit=`, `?offset=`

### Audit tooling

ev-accounts has a headshot audit script:
```
C:/EV-Accounts/backend/scripts/auditHeadshots.ts
```
Run with `npx tsx scripts/auditHeadshots.ts`. Outputs CSV to stdout with columns:
`politician_id, name, issue, url, details`. Flags missing headshots, broken CDN URLs,
oversized files (>500KB), undersized files (<2KB), and bad aspect ratios.

### Key source files in ev-accounts

| File | Purpose |
|---|---|
| `backend/src/routes/essentialsPoliticians.ts` | GET endpoints for politicians + images |
| `backend/src/routes/essentialsEditor.ts` | PATCH endpoint (editor role required) |
| `backend/src/lib/essentialsService.ts` | `batchFetchImages()` service function |
| `backend/scripts/auditHeadshots.ts` | Headshot audit/validation script |
| `backend/migrations/033_politician_schema.sql` | Politicians table schema |
| `backend/migrations/050_image_focal_point.sql` | focal_point column migration |
| `backend/migrations/042_election_schema.sql` | Race candidates schema |

---

## Recommendation for centralization

If Civic Spaces wants to share these assets:

- **Municipality images**: Set `hero_image_url` on the `Municipality` record in ev-accounts.
  All apps that respect that field will use the centrally-hosted image instead of hitting Wikipedia.
- **Politician images**: Already in `essentials.politician_images` with CDN URLs.
  Use `GET /api/essentials/politicians` (or `/:id`) to consume them. No separate fetch needed.

If a shared CDN bucket is established, both `hero_image_url` and `photo_custom_url`/`url`
in `politician_images` are the right columns to point at it.

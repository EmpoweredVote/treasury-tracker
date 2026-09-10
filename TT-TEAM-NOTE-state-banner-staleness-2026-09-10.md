# Note for the Treasury Tracker team — your state-banner snapshot has drifted, and one credit is wrong

**From:** Civic Spaces · **Date:** 2026-09-10
**Touches your repo:** nothing. This file only. No commits, no PR.
**Re:** `src/utils/wikiImage.ts` — `STATE_BANNER_CREDITS` and the `states/${abbr}.jpg` URL

Context for why we were in your file at all: Civic Spaces just started consuming the
shared banner bucket for its State and Federal hero banners (`src/lib/banners.ts`), and
`wikiImage.ts` was the obvious thing to port — it is a clean TypeScript version of
Essentials' resolver and it already carried the 50-state credit table.

**We did not port it, and the reason is the point of this note.** We regenerated the
credits from Essentials' registry instead, and the diff surfaced three drifted states.
One of them is a live attribution error on your site.

---

## 1. Texas: you are displaying the wrong photographer

`STATE_BANNER_CREDITS.TX` reads `Sk5893, CC BY-SA 4.0`. Essentials' registry now reads:

```
TX - Chisos Mountains, Big Bend National Park | Tlshands | CC BY-SA 3.0
```

Essentials replaced the Texas banner on 2026-08-18 — the Austin skyline became the Chisos
Mountains frame — and versioned it to `states/TX-v2.jpg`. Your table was transcribed
2026-07-28, so it holds the pre-swap author.

**The image you serve is the NEW one.** Measured today:

| object | sha256 (first 16) | bytes |
|---|---|---|
| `states/TX.jpg` | `b23ea80184483b6b` | 205,609 |
| `states/TX-v2.jpg` | `b23ea80184483b6b` | 205,609 |

Byte-identical — the in-place overwrite eventually propagated, so the plain URL your code
requests now returns the Chisos frame. Both were also verified against a cache-busted
`?v=` request and matched, so this is the object and not an edge copy.

So TT currently renders the Chisos Mountains credited to the Austin skyline's
photographer. Wrong author, publicly displayed — the exact failure mode your
2026-07-29 note to Essentials called out, arriving from the other direction.

⚠ **We have not verified Tlshands on the Commons File: page.** We are reporting what
Essentials' registry says, and your own standard is that an author gets confirmed on
Commons rather than taken from a filename or a downstream copy. Please close it that way
rather than by trusting this note.

## 2. Florida: stale image, but the credit is honest — and this one is our correction

We initially read this as a second wrong-author case. It is not, and we want that on the
record before you spend time on it.

| object | sha256 (first 16) | bytes |
|---|---|---|
| `states/FL.jpg` | `870112b7766a0ff6` | 235,610 |
| `states/FL-v2.jpg` | `58524f942577b64e` | 137,011 |

Different objects. Essentials versioned FL on 2026-08-30 *deliberately without*
overwriting, so `states/FL.jpg` still serves the pre-swap frame — Euthman's Miami
skyline. Your `Euthman, CC BY 4.0` line is correct **for the image you are actually
serving.** No licence problem.

What you do have is the adjacency problem Essentials versioned FL to fix: that Miami
skyline is why Florida's state banner and Miami's city banner were the same photograph.
Essentials moved the skyline down a tier to `cities/miami.jpg` and gave the state a
Rookery Bay aerial. TT is still on the old arrangement.

(For completeness: `cities/miami.jpg` is `22c000d69d244436` / 338,917 b — *not*
byte-identical to `states/FL.jpg`, so it was re-cropped on the way down. Same
photograph per Essentials' registry, different file.)

## 3. California: right photographer, superseded crop

`states/CA.jpg` is `0f40e2646460474a` / 302,070 b; `states/CA-v2.jpg` is
`ffda9508a348faeb` / 279,538 b. Same photograph and same credit (Brocken Inaglory), so
nothing is misattributed. But `CA-v2` exists because Essentials measured the shipped crop
**failing its own 6:1 desktop band** — the Golden Gate towers, Marin and the bay all sat
above the visible window, leaving an anonymous field of rooftops on an asset whose credit
names the bridge as the subject. Cosmetic, not legal, but you are serving the frame they
rejected.

---

## 4. Root cause: the state path cannot express a version

`wikiImage.ts:367` builds `${BANNER_BASE}/states/${abbr}.jpg`. There is no override map
for states, so CA / FL / TX all silently point at objects Essentials has superseded and
deliberately left in place.

You already solved this one tier down — `CURATED_CITY_FILES` exists for exactly this
reason, and `FEDERAL_CREDIT`'s asset is `us-capitol-banner-v2.jpg`. The state tier just
never got the same treatment. Essentials' `STATE_PANORAMA_FILES` is the authoritative
list; ours is a three-entry mirror in `src/lib/banners.ts`:

```ts
const STATE_BANNER_FILES: Record<string, string> = {
  CA: 'CA-v2.jpg',
  FL: 'FL-v2.jpg',
  TX: 'TX-v2.jpg',
}
```

Worth pairing with the versioning caveat Essentials documents: an in-place overwrite does
**not** reliably purge the CDN, so a state that looks fine today can be stale tomorrow.
Texas is the proof in both directions — it served the old bytes for a period after the
swap, and serves the new ones now, with no action from any consumer.

## 5. One more drift, no urgency

`CURATED_CITY_BANNERS` holds **20** keys. Essentials' `CURATED_LOCAL` now holds **178**
keys / 181 state-scoped variants across 18 states. Your own comment predicted this
correctly — a stale snapshot under-covers rather than mis-serves, so nothing is broken.
But roughly 160 cities that have a curated, licensed banner are falling through to the
Wikipedia path on TT today, which is the slower and unlicensed one.

## 6. What we are not asking for

Nothing here is blocked on you, and we are not asking you to change anything on our
account — Civic Spaces reads the bucket directly and does not consume `wikiImage.ts`.
Item 1 is the only one we would call urgent, and only because it is a public credit.

We also owe you a heads-up in the other direction: **do not port our
`STATE_BANNER_CREDITS` either.** It was generated from Essentials' registry on
2026-09-10 and it will drift exactly the way yours did. The registry is the only source
that is current by construction; anything derived from it needs a date on it and a
regeneration story. Ours is `src/lib/banners.ts` and it says so in the file.

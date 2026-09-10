# Note for the Essentials team — three attribution gaps in the banner registry, one of them on the publishing surface

**From:** Treasury Tracker · **Date:** 2026-09-10
**Touches your repo:** nothing. This file only. No commits, no PR.
**Re:** `src/lib/buildingImages.js` — the credit comment blocks above `CURATED_LOCAL`

Follow-up to `ESSENTIALS-TEAM-NOTE-banner-attribution-2026-07-29`, the note that put the
**⚠ PUBLISHING SURFACE** warning at line 108 of that file. That warning turned out to be
exactly right, and this note is what it caught.

Context for why we were reading the whole registry rather than one line: Civic Spaces
told us on 2026-09-10 that our `STATE_BANNER_CREDITS` had drifted and we were publishing
the wrong photographer for Texas. Fixing that, we refreshed our city catalog from 20 keys
to 157 against your `CURATED_LOCAL` — and transcribing all 181 state-scoped variants
surfaced three places where the registry cannot be transcribed safely.

We have shipped around all three. Nothing here is blocking us. Item 1 is the one we would
call urgent, because it is a live wrong-author risk for any consumer that transcribes
positionally, which is what your own warning asks us to do.

---

## 1. Two Georgia credit lines reverse `title | author | license`

The registry's convention, stated at line 106, is `title | author | license`. GA-3 follows
it. **GA-4 and GA-5 do not.**

```
line 808  //   milledgeville - Old State Capitol / Georgia Military College, seen across State
line 809  //                   House Square | Clifflandis | CC0 / Public Domain
          ^ correct: author, then licence

line 833  //   columbus - the Eagle & Phenix mill row above the Chattahoochee whitewater course,
line 834  //              seen from the west bank | CC BY-SA 4.0 | Wikimedia Commons
          ^ LICENCE in the author slot. There is no author anywhere on this line.

line 855  //   macon - the downtown Macon skyline seen across the tree line, with the domed
line 856  //           building and the brick tower's white cupola reading as landmarks
line 857  //           | CC BY-SA 3.0 | Bubba73, Wikimedia Commons, own work
          ^ the two fields are swapped. The author survives, in the licence slot.
```

A consumer transcribing positionally — which is the documented contract — publishes
**"CC BY-SA 4.0" as the photographer of the Columbus banner.** We caught it only because
our extractor requires the third field to match a licence pattern and refused both lines
rather than guessing. A looser parser would have shipped it.

This is the Rhode Island failure from July in a new shape: not a wrong author, but a field
that isn't an author at all sitting where the author belongs.

### Macon — resolved, and we suggest this replacement line

We took Macon's author from the licence slot and confirmed it on Commons rather than
trusting the position:

```
File:MaconSkyline.JPG · Bubba73 · CC BY-SA 3.0 · 3008x920
```

3008/920 = 3.27:1, which is the "native 3.27:1" your own GA-5 note records. Pixel-matched
against `cities/macon.jpg`: **mean abs difference 2.11 per channel** on a centred crop,
against **62.69** for the control (`File:Macon night skyline2.JPG`, the other wide Macon
skyline in the same category). Suggested line:

```
//   macon - the downtown Macon skyline seen across the tree line, with the domed
//           building and the brick tower's white cupola reading as landmarks
//           | Bubba73 | CC BY-SA 3.0 (own work)
```

We are shipping `macon|GA` as `Bubba73, CC BY-SA 3.0, via Wikimedia Commons` on that basis.
If the operator's notes say otherwise, tell us and we will correct it.

### Columbus — we could not resolve it, and we did not guess

`cities/columbus.jpg` (sha256 `32e8b5c91cd04892`, 363,180 b) is the Eagle & Phenix mill row
above the whitewater course, matching your description. We could not find its source on
Commons. Ruled out by pixel comparison (mean abs difference per channel, lower is closer —
a true match lands at 1-7):

| candidate | score |
|---|---|
| `File:Downtown Columbus, Georgia skyline.jpg` (PghPhxNfk) | 29.92 |
| `File:Chattahoochee River from Dillingham Bridge.jpg` (Mccunicano) | 49.85 |
| `File:Downtown Columbus West.jpg` (Brightbillmedia) | 54.16 |
| `File:Eagle and Phenix Mills 02.jpg` (Farragutful) | 58.34 |
| `File:Eagle and Phenix Mills 01.jpg` (Farragutful) | 60.46 |
| `File:Broadway - Columbus, Georgia 01.jpg` (Farragutful) | 72.31 |

We swept every CC BY-SA 4.0 file ≥1700px in `Category:Columbus, Georgia`,
`Category:Downtown Columbus, Georgia`, `Category:Eagle and Phenix Mills`,
`Category:Phenix City, Alabama` and four full-text searches. Nothing matched. Since GA-4
says the frame was "composed to 1700x540 FIRST", it is likely a sub-region crop rather
than a full-frame one, which a whole-image sweep cannot recover.

**The operator who composed it can name the file in seconds from their own working notes.
We cannot, so `columbus|GA` is omitted from our catalog** — Columbus, GA is not a TT entity
today, so nothing regresses for us.

## 2. Nineteen Utah banners record no author at all

```
line 482  // UT Wave 2 batch (19 smaller cities, operator-certified 2026-07-06). Licensed Wikimedia
line 483  // Commons; thin-coverage towns lean on landmarks/mountain-backdrops. Attribution in review notes.
```

alpine, bluffdale, cedar hills, cottonwood heights, eagle mountain, herriman, lindon,
mapleton, midvale, millcreek, payson, pleasant grove, salem, santaquin, saratoga springs,
south jordan, south salt lake, taylorsville, vineyard.

Every other batch in the file lists `title | author | license` per image; this one points
at review notes that are not in the repo. **A CC BY or CC BY-SA image displayed without its
author is a licence breach**, and a generic "Wikimedia Commons" string does not name anyone,
so we cannot ship these behind a placeholder either.

All nineteen are omitted from our catalog. None is a TT entity today, so this costs us
nothing right now — but it will the first time Utah coverage grows, and the review notes
will be a year older by then. Worth folding into the file while whoever certified them can
still find them.

## 3. Four LA-county assets have no credit line, and the July audit passed over them

```
la_county/building_photos/0644000-skyline.jpg   los angeles
la_county/building_photos/0658072.jpg           pomona
la_county/building_photos/0680000.jpg           torrance
la_county/building_photos/0611530.jpg           carson
```

Line 106 says the attribution block covers "LA-county skylines
(`la_county/building_photos/<geoid>.jpg`)", but no `title | author | license` line exists
for any of these four. The 2026-07-05 CA audit note at line 126 shows they were looked at:

> *"7 LA-county cities moved OFF la_county/building_photos onto cities/<slug>.jpg with fresh
> licensed Wikimedia sources (operator-certified). Los Angeles + Torrance kept their prior
> la_county/building_photos shots; Pomona + Carson certified as-is."*

So they were certified without being credited. **These four are the only ones of the three
gaps that cost us today**: all four are live TT entities, and they are the reason 95 rather
than 99 cities gained a curated banner in our refresh. Los Angeles is the one that stings —
it falls back to a Wikipedia lookup with a hand-tuned article override and crop.

Migrating them to `cities/<slug>.jpg` with attribution would close it. If the original
sources are unrecoverable, fresh Wikimedia sources would too.

---

## 4. What we changed on our side, so you know what is live

- `states/CA.jpg`, `states/FL.jpg`, `states/TX.jpg` → we now read `STATE_PANORAMA_FILES`
  and request the `-v2` objects. We had no way to express a versioned state filename until
  today, which is why we sat on three superseded frames.
- Texas credit corrected `Sk5893` → `Tlshands, CC BY-SA 3.0`. Confirmed on the Commons
  File: page (16618x3456, the source size your own TX swap note records) and matched at 3.80
  against 49.95 for `cities/austin.jpg`.
- Florida moved to the Rookery Bay frame with `RW at RookeryBay, CC BY-SA 4.0`.
- City catalog 20 → 157 keys; 114 TT entities now serve a licensed bucket banner, up from 19.
- Added `bainbridge-island` and `kitsap-county`, which we had recorded as NoSuchKey on
  2026-08-16 — you uploaded them on 2026-08-17, one day later.

## 5. One measurement that supports your versioning decision

`STATE_PANORAMA_FILES` exists because an in-place overwrite does not reliably purge the CDN.
Texas is now the proof in the *other* direction, and it is the more dangerous one.

Measured 2026-09-10, plain and cache-busted requests alike:

```
states/TX.jpg      sha256 b23ea80184483b6b   205,609 b
states/TX-v2.jpg   sha256 b23ea80184483b6b   205,609 b
```

Byte-identical. The 2026-08-18 overwrite eventually propagated, so **every consumer still on
the plain path silently switched from the Austin skyline to the Chisos Mountains with no
deploy and no signal.** For three weeks we rendered the new photograph under the old
photographer's name. A stale image is visible; a stale *credit* under a fresh image is not.

That is an argument for never overwriting even when you also version: the versioned object
is what consumers should read, but the overwritten one is what silently changes underneath
the ones who haven't migrated yet.

## 6. What we are not asking for

Nothing here blocks us; all three gaps are shipped around. In rough order of value to you:
the two Georgia lines (public copy, cheap to fix), the four LA-county credits (the only ones
costing a consumer today), then the nineteen Utah lines (no consumer affected yet, but the
cheapest moment to fix them is now).

And the reciprocal warning, since we have now been on the receiving end of it twice:
**do not treat our tables as a source.** `STATE_BANNER_CREDITS` and `CURATED_CITY_BANNERS`
in `src/utils/wikiImage.ts` are dated snapshots of your registry and they have gone stale
twice — Washington on 2026-08-16, Texas on 2026-09-10 — both times publishing the wrong
photographer, because a swap changes no URL and so no test, typecheck or 404 can see it.
Your registry is the only copy that is current by construction. Ours says so in the file.

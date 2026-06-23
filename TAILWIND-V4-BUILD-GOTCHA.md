# ⚠️ Tailwind v4 + committed-docs build-crash gotcha

**Audience:** the Claude session (and humans) working on `treasury-tracker`.
**TL;DR:** A committed text/markdown file that contains a raw **Windows backslash path** can make the **production `vite build` crash** with `RangeError: Invalid code point`, because Tailwind v4 reads part of the path as a CSS hex escape. This bit Empowered Essentials (a real prod outage) on 2026-06-23. `treasury-tracker` is on Tailwind v4 and builds from the repo root, so it is **exposed**.

> Note: this doc deliberately writes every example with forward slashes / split tokens so the doc itself does **not** contain the dangerous byte sequence and is safe to commit.

---

## Root cause

Tailwind v4's automatic source detection scans the **entire git-tracked tree** for class-name candidates — not just `src/`. That includes `.planning/**`, `README`s, and any committed `.md`/`.txt`/`.sql`/`.json` docs (it respects `.gitignore` and skips `node_modules`).

CSS lets you escape a character as a backslash followed by **1–6 hex digits** (e.g. `\1F600`). When Tailwind's candidate scanner hits a **backslash immediately followed by 6 hex characters**, it tries to decode that as a code point via `String.fromCodePoint(...)`. If the value exceeds the max Unicode code point `0x10FFFF` (1,114,111), `String.fromCodePoint` throws `RangeError: Invalid code point`, and the whole `vite build` aborts. Every commit after the offending doc landed then fails to deploy.

### What a dangerous token looks like

A Windows path segment where a **backslash** is immediately followed by ≥6 hex characters. Two real-world shapes that crashed builds:

- A memory/docs path segment — backslash, then a word starting with `feedback`. The first six chars after the backslash, `f e e d b a`, are **all valid hex** → `0xFEEDBA` = 16,707,002 (> 0x10FFFF) → crash.
- A migration filename — backslash, then a timestamp like `20260609000005...`. The first six digits `2 0 2 6 0 6` are valid hex → `0x202606` = 2,107,910 (> 0x10FFFF) → crash.

Hex digits are `0-9` and `a-f`/`A-F`. So `backslash + data` is *fine* (`d`,`a`,`t`,`a` → `t` isn't hex, escape is only `\da`), but `backslash + decade`, `backslash + facade`, `backslash + feedba…`, or `backslash + 6 digits` are landmines.

---

## Detect it

Scan tracked text files for "backslash followed by 6 hex chars". Use **ripgrep** (or your editor's regex) — note that Git Bash's `echo`/`grep` mangle backslashes, so prefer `git grep` / `rg` which read raw file bytes:

```bash
git grep -nE '\\[0-9a-fA-F]{6}' -- '*.md' '*.txt' '*.sql' '*.json'
```

Any hit in a tracked, non-`node_modules` file is a potential build-crasher. (Watch especially for `.planning/` docs and anything pasted from a Windows terminal.) Review each hit: it only crashes if those 6 hex chars evaluate to > `0x10FFFF`, but the safe move is to neutralize all of them.

---

## Fix / prevent (two layers)

**1. Immediate unblock** — forward-slash the offending path in the committed doc (or otherwise break the backslash-then-hex run). Windows accepts forward slashes in nearly all contexts, and docs don't need real paths anyway.

**2. Hardening (recommended)** — tell Tailwind v4 to stop scanning docs. In the main CSS entry (the file with `@import "tailwindcss";`, e.g. `src/index.css`), add `@source not` exclusions:

```css
@import "tailwindcss";

/* Don't scan planning/docs for class candidates — a Windows path in a .md there
   can contain a CSS hex-escape sequence that crashes the production build. */
@source not "../.planning";
@source not "../**/*.md";
```

Adjust the relative paths to match where your CSS lives vs. the repo root. Verify utilities still generate after adding these (they should — your real class names are in `src/`).

**Habit:** avoid pasting raw `C:\...` Windows paths into committed files; use forward slashes.

---

## Why treasury-tracker specifically is exposed

`treasury-tracker` uses `@tailwindcss/vite` with a single app at the repo root, so Tailwind's scan base **is** the repo root and it **will** scan root-level + `.planning/` docs. (Contrast: a monorepo whose frontend builds from a subdirectory, e.g. `cd app && vite build`, anchors the scan at that subdir and is *not* exposed to repo-root docs.) So the detection scan above is worth running before any deploy where the build errors with `RangeError: Invalid code point` or `String.fromCodePoint`.

---

*Captured 2026-06-23 from the Essentials outage post-mortem (fixes: forward-slash the path for the immediate unblock, then `@source not` exclusions for hardening).*

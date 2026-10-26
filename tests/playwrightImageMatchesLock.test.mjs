import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ⚠ The `journeys` job runs in Playwright's own container image, which ships
 * one exact browser build. The tests drive it through the @playwright/test
 * version in package-lock.json. If the two drift (a dependency bump that moves
 * the lock and not the image), Playwright refuses to start: "Executable
 * doesn't exist", on every PR. This turns that into one red test, in the
 * bump's own PR, that names the line to change.
 */

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

describe('the journeys container image matches the installed Playwright', () => {
  it('uses mcr.microsoft.com/playwright at the locked @playwright/test version', () => {
    const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
    const locked = lock.packages['node_modules/@playwright/test']?.version;
    expect(locked, '@playwright/test is not in package-lock.json').toBeTruthy();

    const workflow = readFileSync(join(ROOT, '.github/workflows/build-check.yml'), 'utf8');
    const tags = [...workflow.matchAll(/mcr\.microsoft\.com\/playwright:v([\w.-]+?)-\w+\b/g)].map((m) => m[1]);
    expect(tags, 'build-check.yml names no Playwright image').not.toEqual([]);
    for (const tag of tags) {
      expect(tag, `build-check.yml: set the image to mcr.microsoft.com/playwright:v${locked}-noble`).toBe(locked);
    }
  });
});

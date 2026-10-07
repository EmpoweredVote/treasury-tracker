import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  decide,
  parseConfig,
  verifySignature,
} from '../supabase/functions/github-pr-review-relay/logic.ts';

// ev-cto decision 0030: only PRs that a non-founder opens, reopens or marks
// ready reach the founders' private review channel.

const config = parseConfig((name) =>
  ({ FOUNDER_LOGINS: 'chrisandrewsedu, EmpoweredChris' })[name],
);

function pr(login, { action = 'opened', draft = false, type = 'User' } = {}) {
  return { action, pull_request: { draft, user: { login, type } } };
}

describe('verifySignature', () => {
  const secret = 'test-secret';
  const body = '{"action":"opened"}';
  const good = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

  it('accepts a correct signature', async () => {
    expect(await verifySignature(secret, body, good)).toBe(true);
  });
  it('rejects a wrong signature', async () => {
    expect(await verifySignature(secret, body, good.replace(/.$/, '0'))).toBe(false);
  });
  it('rejects a body that was changed', async () => {
    expect(await verifySignature(secret, body + ' ', good)).toBe(false);
  });
  it('rejects a missing header', async () => {
    expect(await verifySignature(secret, body, null)).toBe(false);
  });
  it('rejects everything when no secret is configured', async () => {
    const unsigned = 'sha256=' + createHmac('sha256', '').update(body).digest('hex');
    expect(await verifySignature('', body, unsigned)).toBe(false);
  });
});

describe('decide', () => {
  it('forwards a teammate opening a PR', () => {
    expect(decide('pull_request', pr('teammate'), config)).toEqual({ forward: true });
  });
  it('forwards reopened and ready_for_review', () => {
    expect(decide('pull_request', pr('teammate', { action: 'reopened' }), config).forward).toBe(true);
    expect(decide('pull_request', pr('teammate', { action: 'ready_for_review' }), config).forward).toBe(true);
  });
  it('skips founders, case-insensitively', () => {
    expect(decide('pull_request', pr('chrisandrewsedu'), config).forward).toBe(false);
    expect(decide('pull_request', pr('empoweredchris'), config).forward).toBe(false);
  });
  it('skips a teammate draft', () => {
    expect(decide('pull_request', pr('teammate', { draft: true }), config).forward).toBe(false);
  });
  it('skips other actions', () => {
    for (const action of ['edited', 'synchronize', 'closed', 'labeled']) {
      expect(decide('pull_request', pr('teammate', { action }), config).forward).toBe(false);
    }
  });
  it('skips other events', () => {
    expect(decide('push', pr('teammate'), config).forward).toBe(false);
  });
  it('skips bots by default, and forwards them when switched on', () => {
    const bots = [pr('dependabot[bot]', { type: 'Bot' }), pr('ev-ui-autobump')];
    for (const p of bots) expect(decide('pull_request', p, config).forward).toBe(false);
    const withBots = { ...config, includeBots: true };
    for (const p of bots) expect(decide('pull_request', p, withBots).forward).toBe(true);
  });
});

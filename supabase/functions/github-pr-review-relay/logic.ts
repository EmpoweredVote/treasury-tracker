// Pure logic for github-pr-review-relay (ev-cto decision 0030).
//
// No Deno APIs here, only Web Crypto, so vitest can import this file under
// Node (tests/githubPrReviewRelay.test.mjs). index.ts is the Deno wrapper.

export interface RelayConfig {
  founderLogins: string[]
  includeBots: boolean
}

// Bots that do not end in "[bot]" because they push through a GitHub App
// token under their own login.
const EXTRA_BOT_LOGINS = ['ev-ui-autobump']

// Only these pull_request actions mean "a PR now needs a look". Every other
// action (edited, synchronize, labeled, closed, ...) already shows in
// #dev-activity through the existing org webhook.
const FORWARD_ACTIONS = ['opened', 'reopened', 'ready_for_review']

export function parseConfig(env: (name: string) => string | undefined): RelayConfig {
  const founderLogins = (env('FOUNDER_LOGINS') ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return { founderLogins, includeBots: env('INCLUDE_BOTS') === 'true' }
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Check GitHub's X-Hub-Signature-256 header: "sha256=" + HMAC-SHA256(secret, raw body). */
export async function verifySignature(
  secret: string,
  rawBody: string,
  header: string | null,
): Promise<boolean> {
  if (!secret || !header || !header.startsWith('sha256=')) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
  return timingSafeEqual(header, 'sha256=' + toHex(mac))
}

interface PullRequestPayload {
  action?: string
  pull_request?: { draft?: boolean; user?: { login?: string; type?: string } }
}

export type Decision = { forward: true } | { forward: false; reason: string }

export function decide(
  event: string | null,
  payload: unknown,
  config: RelayConfig,
): Decision {
  if (event !== 'pull_request') return { forward: false, reason: `event ${event}` }
  const p = (payload ?? {}) as PullRequestPayload
  const action = p.action ?? ''
  if (!FORWARD_ACTIONS.includes(action)) return { forward: false, reason: `action ${action}` }
  const pr = p.pull_request
  if (!pr) return { forward: false, reason: 'no pull_request' }
  if (pr.draft === true) return { forward: false, reason: 'draft' }
  const login = String(pr.user?.login ?? '').toLowerCase()
  if (!login) return { forward: false, reason: 'no author' }
  if (config.founderLogins.includes(login)) return { forward: false, reason: 'founder' }
  const isBot =
    pr.user?.type === 'Bot' || login.endsWith('[bot]') || EXTRA_BOT_LOGINS.includes(login)
  if (isBot && !config.includeBots) return { forward: false, reason: 'bot' }
  return { forward: true }
}

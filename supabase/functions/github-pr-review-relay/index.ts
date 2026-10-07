// github-pr-review-relay — ev-cto decision 0030.
//
// A second EmpoweredVote org webhook ("Pull requests" events only) points
// here. When someone other than the founders opens a PR (or reopens it, or
// marks it ready for review), the payload is forwarded unchanged to a private
// Discord channel's `/github` webhook, so Discord renders its usual GitHub
// card. Everything else is acknowledged and dropped. #dev-activity keeps its
// own, separate org webhook and is not touched by this function.
//
// Secrets (Supabase function secrets, never in git):
//   GITHUB_WEBHOOK_SECRET  shared secret set on the GitHub org webhook
//   DISCORD_REVIEW_URL     Discord webhook URL with `/github` appended
//   FOUNDER_LOGINS         "chrisandrewsedu,EmpoweredChris"
//   INCLUDE_BOTS           "true" to also forward bot PRs (default off)
//
// Deploy with verify_jwt = false: GitHub sends no Supabase JWT; the HMAC
// signature check below is the authentication.

import { decide, parseConfig, verifySignature } from './logic.ts'

const WEBHOOK_SECRET = Deno.env.get('GITHUB_WEBHOOK_SECRET') ?? ''
const DISCORD_URL = Deno.env.get('DISCORD_REVIEW_URL') ?? ''
const config = parseConfig((name) => Deno.env.get(name))

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  // Raw body first: the signature is computed over the exact bytes sent.
  const rawBody = await req.text()
  if (!(await verifySignature(WEBHOOK_SECRET, rawBody, req.headers.get('X-Hub-Signature-256')))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const event = req.headers.get('X-GitHub-Event')
  if (event === 'ping') return new Response('pong', { status: 200 })

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const decision = decide(event, payload, config)
  if (!decision.forward) {
    console.log('github-pr-review-relay: skipped', decision.reason)
    return new Response(`skipped: ${decision.reason}`, { status: 200 })
  }

  if (!DISCORD_URL) {
    console.error('github-pr-review-relay: DISCORD_REVIEW_URL is not set')
    return new Response('Not configured', { status: 500 })
  }

  const res = await fetch(DISCORD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-GitHub-Event': event ?? '' },
    body: rawBody,
  })
  console.log('github-pr-review-relay: forwarded, discord status', res.status)
  return new Response(`forwarded: ${res.status}`, { status: res.ok ? 200 : 502 })
})

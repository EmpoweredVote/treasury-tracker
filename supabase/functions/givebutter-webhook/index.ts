import { createClient } from 'npm:@supabase/supabase-js@2'

const SIGNING_SECRET = Deno.env.get('GIVEBUTTER_SIGNING_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
/**
 * Supabase client credential for this function.
 *
 * Prefers the named new-format secret key `supabase_edge_functions`, which the
 * platform exposes as a JSON object in SUPABASE_SECRET_KEYS (keyed by key name).
 * Falls back to the platform-injected legacy SUPABASE_SERVICE_ROLE_KEY so this
 * deploys safely BEFORE legacy keys are disabled and keeps working AFTER (Part B,
 * ev-cto decision 0014). Logs which source was used — the NAME only, never the value —
 * so the switch is verifiable from function logs.
 */
function resolveSecretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    if (typeof keys?.supabase_edge_functions === 'string' && keys.supabase_edge_functions) {
      console.log('supabase client key: SUPABASE_SECRET_KEYS.supabase_edge_functions');
      return keys.supabase_edge_functions;
    }
  } catch (_) { /* malformed or absent — fall through */ }
  console.log('supabase client key: legacy SUPABASE_SERVICE_ROLE_KEY');
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}
const SUPABASE_SECRET_KEY = resolveSecretKey()

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  db: { schema: 'treasury' },
})

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const aBytes = enc.encode(a)
  const bBytes = enc.encode(b)
  if (aBytes.length !== bBytes.length) return false
  let diff = 0
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i]
  return diff === 0
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    // Read raw body BEFORE any JSON parsing (critical for signature verification)
    const rawBody = await req.text()

    // Signature verification
    const sig = req.headers.get('Signature') ?? ''
    if (!sig || !SIGNING_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }
    if (!timingSafeEqual(sig, SIGNING_SECRET)) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Parse JSON
    let payload: { event?: string; data?: Record<string, unknown> }
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return new Response('Bad Request', { status: 400 })
    }

    // Discard unrecognized events silently
    if (payload.event !== 'transaction.succeeded') {
      return new Response('OK', { status: 200 })
    }

    // Extract transaction fields
    const tx = payload.data ?? {}
    const externalId = String(tx['id'] ?? '')
    const amount = Number(tx['amount'] ?? 0)
    const transactedAt = String(tx['transacted_at'] ?? '')

    // ⚠⚠ `amount` IS IN DOLLARS, NOT CENTS.
    //
    // This log used to claim cents and print `amountDollars: amount / 100`, while the
    // RPC call below passed `amount` straight through as dollars. The CODE was right
    // and the COMMENT was wrong: the first donation this webhook ever recorded — a $2
    // test on 2026-09-22 — arrived as `amount: 2` and landed as $2.00 (revenue
    // total_budget 6138.40 -> 6140.40, Give Butter 1946 -> 1948). So the log printed
    // "amountDollars: 0.02" for a $2 gift, understating every donation 100x in the
    // one place a human would look to check it.
    //
    // ⛔ DO NOT "fix" the RPC call below to divide by 100 to match the old comment.
    // That would make every recorded donation 100x too small. The comment was the bug.
    console.log('givebutter-webhook: transaction.succeeded', {
      externalId,
      amountDollars: amount,
      signatureHeader: sig,
      transactedAt,
    })

    if (!externalId) {
      console.warn('givebutter-webhook: missing external_id, discarding event')
      return new Response('OK', { status: 200 })
    }

    // Resolve category IDs dynamically rather than hard-coding them.
    //
    // ⚠ The original reason given here — "UUIDs change on loadEVFinances.js re-import"
    // — is now doubly stale: loadEVFinances.js is RETIRED, and since PR #207 the
    // loaders UPDATE the budget row in place rather than deleting and recreating it,
    // so the budget id no longer changes on a refresh. Category ids still do (the tree
    // is cleared and rebuilt), so resolving dynamically remains correct — the
    // justification changed, not the behaviour.
    const { data: muniData, error: muniError } = await supabase
      .from('municipalities')
      .select('id')
      .eq('name', 'Empowered Vote')
      .maybeSingle()

    if (muniError || !muniData) {
      console.error('givebutter-webhook: municipality lookup failed', muniError)
      return new Response('Internal Server Error', { status: 500 })
    }

    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .select('id')
      .eq('municipality_id', muniData.id)
      .eq('dataset_type', 'revenue')
      .order('fiscal_year', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (budgetError || !budget) {
      console.error('givebutter-webhook: budget lookup failed', budgetError)
      return new Response('Internal Server Error', { status: 500 })
    }

    const { data: categories, error: catError } = await supabase
      .from('budget_categories')
      .select('id, name, depth')
      .eq('budget_id', budget.id)
      .in('name', ['Donations', 'Give Butter'])

    if (catError || !categories) {
      console.error('givebutter-webhook: category lookup failed', catError)
      return new Response('Internal Server Error', { status: 500 })
    }

    const leafCat = categories.find((c: { name: string }) => c.name === 'Give Butter')
    const parentCat = categories.find((c: { name: string }) => c.name === 'Donations')

    if (!leafCat || !parentCat) {
      console.error('givebutter-webhook: category IDs not found', { categories })
      return new Response('Internal Server Error', { status: 500 })
    }

    const description = 'GiveButter donation'

    // Call atomic Postgres RPC
    const { error: rpcError } = await supabase.rpc('record_givebutter_donation', {
      p_external_id: externalId,
      p_leaf_category_id: leafCat.id,
      p_parent_category_id: parentCat.id,
      p_budget_id: budget.id,
      p_description: description,
      p_amount: amount,
      p_date: transactedAt.slice(0, 10) || new Date().toISOString().slice(0, 10),
      p_vendor: 'GiveButter',
    })

    if (rpcError) {
      console.error('givebutter-webhook: RPC error', rpcError)
      return new Response('Internal Server Error', { status: 500 })
    }

    console.log('givebutter-webhook: donation recorded', { externalId, amount })
    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('givebutter-webhook: uncaught error', err)
    return new Response('Internal Server Error', { status: 500 })
  }
})

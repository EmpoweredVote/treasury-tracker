import { createClient } from 'npm:@supabase/supabase-js@2'

const SIGNING_SECRET = Deno.env.get('GIVEBUTTER_SIGNING_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
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
    let payload: { type?: string; data?: Record<string, unknown> }
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return new Response('Bad Request', { status: 400 })
    }

    // Discard unrecognized events silently
    if (payload.type !== 'transaction.succeeded') {
      return new Response('OK', { status: 200 })
    }

    // Extract transaction fields
    const tx = payload.data ?? {}
    const externalId = String(tx['id'] ?? '')
    const amount = Number(tx['amount'] ?? 0)
    const firstName = String(tx['first_name'] ?? '')
    const lastName = String(tx['last_name'] ?? '')
    const transactedAt = String(tx['transacted_at'] ?? '')

    // Log everything — primary diagnostic for $1 test (amount unit + signature algorithm)
    console.log('givebutter-webhook: transaction.succeeded', {
      externalId,
      amount,
      rawAmount: tx['amount'],
      signatureHeader: sig,
      transactedAt,
    })

    if (!externalId) {
      console.warn('givebutter-webhook: missing external_id, discarding event')
      return new Response('OK', { status: 200 })
    }

    // Resolve category IDs dynamically — UUIDs change on loadEVFinances.js re-import
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

    const description = firstName
      ? `Donation from ${firstName} ${lastName}`.trim()
      : 'GiveButter donation'

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

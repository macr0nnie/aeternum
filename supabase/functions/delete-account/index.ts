// =============================================================================
// Aeternum — delete-account Edge Function
// =============================================================================
// Permanently deletes the caller's account and game data (Google Play requires
// in-app account deletion). Deleting the auth user cascades to `players` and
// every table that references it with ON DELETE CASCADE. The rows below
// reference players WITHOUT cascade, so they're cleared first or the delete
// would fail.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'Server configuration error' }, 500)
  }

  // Only ever delete the caller — identity comes from their JWT, never the body.
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'Missing authorization header' }, 401)
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const db = createClient(supabaseUrl, serviceRoleKey)
  const id = user.id

  const cleanup = await Promise.all([
    db.from('territory_attacks').delete().or(`attacker_id.eq.${id},defender_id.eq.${id}`),
    db.from('resource_nodes').update({ last_harvested_by: null }).eq('last_harvested_by', id),
  ])
  const cleanupError = cleanup.find((r: { error: { message: string } | null }) => r.error)?.error
  if (cleanupError) return json({ error: cleanupError.message }, 500)

  const { error } = await db.auth.admin.deleteUser(id)
  if (error) return json({ error: error.message }, 500)

  return json({ deleted: true })
})

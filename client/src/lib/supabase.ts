import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SyncPayload } from './sync'

const URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Accounts are entirely optional. With no Supabase credentials configured the
 * client stays null and the app runs exactly as it does today — local-only.
 *
 * The anon key is designed to be public; per-user isolation is enforced by
 * row-level security in the database, not by this code.
 */
export const supabase: SupabaseClient | null =
  URL && ANON_KEY ? createClient(URL, ANON_KEY) : null

export const isSyncConfigured = supabase !== null

const TABLE = 'user_data'

export async function fetchRemote(userId: string): Promise<SyncPayload | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data?.payload as SyncPayload) ?? null
}

export async function pushRemote(userId: string, payload: SyncPayload): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

  if (error) throw new Error(error.message)
}

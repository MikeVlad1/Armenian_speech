import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { fetchRemote, isSyncConfigured, pushRemote, supabase } from './supabase'
import { mergePayload, migratePayload, type SyncPayload } from './sync'

const PUSH_DEBOUNCE_MS = 2000

type Options = {
  data: SyncPayload
  onMerged: (payload: SyncPayload) => void
}

export type SyncState = {
  configured: boolean
  session: Session | null
  email: string | null
  busy: boolean
  error: string
  lastSyncedAt: number | null
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  syncNow: () => Promise<void>
  clearError: () => void
}

export function useSync({ data, onMerged }: Options): SyncState {
  const [session, setSession] = useState<Session | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)

  // Latest data without making every callback depend on it.
  const dataRef = useRef(data)
  dataRef.current = data

  // Suppresses the push that would otherwise fire from applying a merge result.
  const skipNextPush = useRef(false)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasSyncedOnce = useRef(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data: d }) => setSession(d.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) hasSyncedOnce.current = false
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const runSync = useCallback(async () => {
    if (!supabase || !session) return
    setBusy(true)
    setError('')
    try {
      const raw = await fetchRemote(session.user.id)
      const remote = raw ? migratePayload(raw) : null
      const merged = remote ? mergePayload(dataRef.current, remote) : dataRef.current
      if (remote) {
        skipNextPush.current = true
        onMerged(merged)
      }
      await pushRemote(session.user.id, merged)
      setLastSyncedAt(Date.now())
      hasSyncedOnce.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setBusy(false)
    }
  }, [session, onMerged])

  // Full reconcile once per sign-in.
  useEffect(() => {
    if (session && !hasSyncedOnce.current) void runSync()
  }, [session, runSync])

  // Debounced push of subsequent local edits.
  useEffect(() => {
    if (!supabase || !session || !hasSyncedOnce.current) return
    if (skipNextPush.current) {
      skipNextPush.current = false
      return
    }
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => {
      pushRemote(session.user.id, dataRef.current)
        .then(() => setLastSyncedAt(Date.now()))
        .catch((err) => setError(err instanceof Error ? err.message : 'Sync failed'))
    }, PUSH_DEBOUNCE_MS)

    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current)
    }
  }, [data, session])

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return
    setBusy(true)
    setError('')
    try {
      const { error: err } = await supabase.auth.signUp({ email, password })
      if (err) throw new Error(err.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setBusy(false)
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return
    setBusy(true)
    setError('')
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw new Error(err.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setLastSyncedAt(null)
  }, [])

  return {
    configured: isSyncConfigured,
    session,
    email: session?.user.email ?? null,
    busy,
    error,
    lastSyncedAt,
    signUp,
    signIn,
    signOut,
    syncNow: runSync,
    clearError: () => setError(''),
  }
}

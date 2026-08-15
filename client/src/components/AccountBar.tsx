import { useRef, useState } from 'react'
import type { SyncState } from '../lib/useSync'
import { isValidPayload, mergePayload, type SyncPayload } from '../lib/sync'

type Props = {
  sync: SyncState
  data: SyncPayload
  onImport: (payload: SyncPayload) => void
}

function relativeTime(ts: number): string {
  const secs = Math.round((Date.now() - ts) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export default function AccountBar({ sync, data, onImport }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  function handleExport() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `asa-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(file: File) {
    setImportMsg('')
    try {
      const parsed = JSON.parse(await file.text())
      if (!isValidPayload(parsed)) {
        setImportMsg('That file is not an ASA backup.')
        return
      }
      // Merge rather than replace: restoring an older backup must never
      // silently discard progress made since it was taken.
      const merged = mergePayload(data, parsed)
      const added = merged.cards.length - data.cards.length
      onImport(merged)
      setImportMsg(
        added > 0
          ? `Restored — added ${added} card${added === 1 ? '' : 's'} (${merged.cards.length} total).`
          : `Restored — your ${merged.cards.length} cards were already up to date.`
      )
    } catch {
      setImportMsg('Could not read that file.')
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'signup') await sync.signUp(email, password)
    else await sync.signIn(email, password)
    setPassword('')
  }

  return (
    <div className="account-bar">
      <div className="account-row">
        {sync.configured ? (
          sync.session ? (
            <>
              <span className="account-email" title={sync.email ?? ''}>
                ☁ {sync.email}
              </span>
              <span className="sync-status">
                {sync.busy
                  ? 'Syncing…'
                  : sync.lastSyncedAt
                    ? `Synced ${relativeTime(sync.lastSyncedAt)}`
                    : 'Not synced yet'}
              </span>
              <button className="link small" onClick={() => void sync.syncNow()} disabled={sync.busy}>
                Sync now
              </button>
              <button className="link small" onClick={() => void sync.signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <button className="link small" onClick={() => setOpen((v) => !v)}>
              ☁ Sign in to sync across devices
            </button>
          )
        ) : (
          <span className="sync-status">Progress is saved on this device</span>
        )}

        <span className="account-spacer" />
        <button className="link small" onClick={handleExport}>
          ⭳ Backup
        </button>
        <button className="link small" onClick={() => fileRef.current?.click()}>
          ⭱ Restore
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleImportFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {importMsg && <p className="sync-status">{importMsg}</p>}
      {sync.error && (
        <div className="error-banner">
          {sync.error}
          <button className="link" onClick={sync.clearError}>
            Dismiss
          </button>
        </div>
      )}

      {open && sync.configured && !sync.session && (
        <form className="card auth-form" onSubmit={submit}>
          <div className="side-toggle">
            <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>
              Sign in
            </button>
            <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
              Create account
            </button>
          </div>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </label>

          <button className="primary" type="submit" disabled={sync.busy}>
            {sync.busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
          <p className="empty-note">
            Your cards, decks and review history sync to every device you sign in on.
          </p>
        </form>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import './App.css'
import aprImg from './assets/apr.png'
import pomImg from './assets/pom.png'


type Direction = 'en-hy' | 'hy-en'

type TranslateResult = {
  translated: string
  transliteration: string
  notes: string
}



type HistoryEntry = TranslateResult & {
  id: string
  direction: Direction
  input: string
  timestamp: number
}

const HISTORY_KEY = 'armenian-speaker-history'
const HISTORY_LIMIT = 12
const ACCESS_CODE_KEY = 'armenian-speaker-access-code'
const THEME_KEY = 'armenian-speaker-theme'
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

type Theme = 'light' | 'dark'

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function loadTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Parses our server's Server-Sent Events framing (event:/data: lines
// separated by blank lines) and invokes onDelta with each decoded text chunk.
async function readSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onDelta: (text: string) => void,
): Promise<'done' | 'error'> {
  const decoder = new TextDecoder()
  let sseBuffer = ''
  let outcome: 'done' | 'error' = 'done'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    sseBuffer += decoder.decode(value, { stream: true })

    let idx: number
    while ((idx = sseBuffer.indexOf('\n\n')) !== -1) {
      const block = sseBuffer.slice(0, idx)
      sseBuffer = sseBuffer.slice(idx + 2)
      const lines = block.split('\n')
      const eventType = lines.find((l) => l.startsWith('event: '))?.slice('event: '.length)
      const dataLine = lines.find((l) => l.startsWith('data: '))

      if (eventType === 'error') {
        outcome = 'error'
      } else if (eventType === 'done') {
        // no-op — { } marker payload, not translation text
      } else if (dataLine) {
        try {
          onDelta(JSON.parse(dataLine.slice('data: '.length)))
        } catch {
          // ignore malformed SSE line
        }
      }
    }
  }

  return outcome
}

function parseStreamBuffer(buffer: string): TranslateResult {
  const armIdx = buffer.indexOf('[ARMENIAN]')
  const translitIdx = buffer.indexOf('[TRANSLITERATION]')
  const notesIdx = buffer.indexOf('[NOTES]')

  if (armIdx === -1) {
    // Avoid flashing a partial marker fragment (e.g. "[ARM") as text.
    const looksLikePartialMarker = buffer.trimStart().startsWith('[')
    return { translated: looksLikePartialMarker ? '' : buffer.trim(), transliteration: '', notes: '' }
  }

  const translated = buffer
    .slice(armIdx + '[ARMENIAN]'.length, translitIdx === -1 ? buffer.length : translitIdx)
    .trim()
  const transliteration =
    translitIdx === -1
      ? ''
      : buffer.slice(translitIdx + '[TRANSLITERATION]'.length, notesIdx === -1 ? buffer.length : notesIdx).trim()
  const notes = notesIdx === -1 ? '' : buffer.slice(notesIdx + '[NOTES]'.length).trim()

  return { translated, transliteration, notes }
}

function App() {
  const [direction, setDirection] = useState<Direction>('en-hy')
  const [input, setInput] = useState('')
  const [result, setResult] = useState<TranslateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const [accessCode, setAccessCode] = useState<string | null>(() => localStorage.getItem(ACCESS_CODE_KEY))
  const [isPro, setIsPro] = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [showRestore, setShowRestore] = useState(false)
  const [restoreEmail, setRestoreEmail] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => loadTheme())
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }, [history])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')

    async function finishCheckout(id: string) {
      try {
        const res = await fetch(`${API_BASE}/api/verify-session?session_id=${encodeURIComponent(id)}`)
        const data = await res.json()
        if (data.active && data.accessCode) {
          localStorage.setItem(ACCESS_CODE_KEY, data.accessCode)
          setAccessCode(data.accessCode)
          setIsPro(true)
        }
      } finally {
        window.history.replaceState({}, '', window.location.pathname)
      }
    }

    if (params.get('checkout') === 'success' && sessionId) {
      finishCheckout(sessionId)
    } else if (params.get('checkout')) {
      window.history.replaceState({}, '', window.location.pathname)
    } else if (accessCode) {
      fetch(`${API_BASE}/api/check-access`, { headers: { 'x-access-code': accessCode } })
        .then((res) => res.json())
        .then((data) => {
          if (data.active) {
            setIsPro(true)
          } else {
            localStorage.removeItem(ACCESS_CODE_KEY)
            setAccessCode(null)
          }
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isEnToHy = direction === 'en-hy'
  // The Armenian-script text relevant to the current view — used for speech.
  const armenianText = isEnToHy ? result?.translated ?? '' : input

  function swapDirection() {
    setDirection((d) => (d === 'en-hy' ? 'hy-en' : 'en-hy'))
    setInput(result?.translated ?? '')
    setResult(null)
    setError('')
  }

  function authHeaders(): HeadersInit {
    return accessCode ? { 'x-access-code': accessCode } : {}
  }

  async function handleTranslate() {
    if (!input.trim() || loading) return
    setLoading(true)
    setError('')
    setLimitReached(false)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text: input, direction }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 429) setLimitReached(true)
        throw new Error(body.error || 'Translation failed')
      }

      const reader = res.body?.getReader()
      let data: TranslateResult = { translated: '', transliteration: '', notes: '' }
      let textBuffer = ''

      if (!reader) {
        // Fallback for environments without a readable stream.
        data = parseStreamBuffer(await res.text())
        setResult(data)
      } else {
        const outcome = await readSseStream(reader, (delta) => {
          textBuffer += delta
          data = parseStreamBuffer(textBuffer)
          setResult({ ...data })
        })
        if (outcome === 'error' && !textBuffer.trim()) {
          throw new Error('Translation failed')
        }
      }

      setHistory((prev) => [
        { ...data, id: crypto.randomUUID(), direction, input, timestamp: Date.now() },
        ...prev,
      ].slice(0, HISTORY_LIMIT))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleSpeak() {
    if (!armenianText.trim() || speaking) return
    setSpeaking(true)
    setError('')
    setLimitReached(false)
    try {
      const res = await fetch(`${API_BASE}/api/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text: armenianText }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 429) setLimitReached(true)
        throw new Error(body.error || 'Speech request failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (audioRef.current) {
        audioRef.current.src = url
        await audioRef.current.play()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSpeaking(false)
    }
  }

  async function handleUpgrade() {
    if (upgrading) return
    setUpgrading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/create-checkout-session`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setUpgrading(false)
    }
  }

  async function handleRestoreAccess() {
    if (!restoreEmail.trim() || restoring) return
    setRestoring(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/restore-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: restoreEmail.trim() }),
      })
      const data = await res.json()
      if (data.active && data.accessCode) {
        localStorage.setItem(ACCESS_CODE_KEY, data.accessCode)
        setAccessCode(data.accessCode)
        setIsPro(true)
        setShowRestore(false)
      } else {
        setError('No active subscription found for that email.')
      }
    } catch {
      setError('Something went wrong restoring access.')
    } finally {
      setRestoring(false)
    }
  }

  async function handleCopy() {
    if (!result?.translated) return
    await navigator.clipboard.writeText(result.translated)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function restoreEntry(entry: HistoryEntry) {
    setDirection(entry.direction)
    setInput(entry.input)
    setResult({
      translated: entry.translated,
      transliteration: entry.transliteration,
      notes: entry.notes,
    })
    setError('')
  }

  function clearHistory() {
    setHistory([])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleTranslate()
    }
  }

  return (
    <div className="page">
      <div className="app">
        <header>
  <button
    className="theme-toggle"
    onClick={toggleTheme}
    aria-label={theme === 'dark' ? 'Switch to apricot (light) theme' : 'Switch to pomegranate (dark) theme'}
    title={theme === 'dark' ? 'Switch to apricot theme' : 'Switch to pomegranate theme'}
  >
    <img
      src={theme === 'dark' ? pomImg : aprImg}
      alt={theme === 'dark' ? 'Pomegranate' : 'Apricot'}
      className="theme-icon-img"
    />
  </button>
  <h1>ASA</h1>
  <p className="subtitle">Ասա — Armenian for "say." Translate and hear Eastern Armenian.</p>
</header>

        <div className="plan-bar">
          {isPro ? (
            <span className="plan-badge pro">✓ Pro — unlimited</span>
          ) : (
            <>
              <span className="plan-badge">Free plan — 15 translations/day</span>
              <button className="upgrade-btn" onClick={handleUpgrade} disabled={upgrading}>
                {upgrading ? 'Redirecting…' : 'Upgrade to Pro — $3.99/mo'}
              </button>
              <button className="link small" onClick={() => setShowRestore((v) => !v)}>
                Already subscribed?
              </button>
            </>
          )}
        </div>

        {showRestore && !isPro && (
          <div className="restore-bar">
            <input
              type="email"
              value={restoreEmail}
              onChange={(e) => setRestoreEmail(e.target.value)}
              placeholder="Email used at checkout"
            />
            <button className="ghost" onClick={handleRestoreAccess} disabled={restoring || !restoreEmail.trim()}>
              {restoring ? 'Checking…' : 'Restore access'}
            </button>
          </div>
        )}

        <div className="direction-bar">
          <span className={`lang-pill ${isEnToHy ? 'active' : ''}`}>English</span>
          <button className="swap-btn" onClick={swapDirection} aria-label="Swap direction" title="Swap direction">
            ⇄
          </button>
          <span className={`lang-pill ${!isEnToHy ? 'active' : ''}`}>Armenian</span>
        </div>

        <div className="card">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isEnToHy ? 'Type an English sentence…' : 'Հայերեն գրիր այստեղ…'}
            rows={4}
          />

          <div className="card-footer">
            <span className="hint">⌘/Ctrl + Enter to translate</span>
            <button className="primary" onClick={handleTranslate} disabled={loading || !input.trim()}>
              {loading && <span className="spinner" />}
              {loading ? 'Translating' : 'Translate'}
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            {error}
            {limitReached && (
              <button className="upgrade-btn inline" onClick={handleUpgrade} disabled={upgrading}>
                {upgrading ? 'Redirecting…' : 'Upgrade to Pro'}
              </button>
            )}
          </div>
        )}

        {result && (
          <div className="card result-card">
            <p className="translated">{result.translated}</p>
            {result.transliteration && <p className="transliteration">{result.transliteration}</p>}
            {result.notes && <p className="notes">{result.notes}</p>}

            <div className="result-actions">
              <button className="ghost" onClick={handleSpeak} disabled={speaking || loading || !armenianText.trim()}>
                {speaking ? <span className="spinner dark" /> : '🔊'} Speak
              </button>
              <button className="ghost" onClick={handleCopy} disabled={loading}>
                {copied ? '✓ Copied' : '⧉ Copy'}
              </button>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="history">
            <div className="history-header">
              <h2>Recent</h2>
              <button className="link" onClick={clearHistory}>
                Clear
              </button>
            </div>
            <ul>
              {history.map((entry) => (
                <li key={entry.id} onClick={() => restoreEntry(entry)}>
                  <span className="history-input">{entry.input}</span>
                  <span className="history-arrow">→</span>
                  <span className="history-output">{entry.translated}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <audio ref={audioRef} />
      </div>
    </div>
  )
}



export default App

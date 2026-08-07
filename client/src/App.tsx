import { useEffect, useRef, useState } from 'react'
import './App.css'

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
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
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
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }, [history])

  const isEnToHy = direction === 'en-hy'
  // The Armenian-script text relevant to the current view — used for speech.
  const armenianText = isEnToHy ? result?.translated ?? '' : input

  function swapDirection() {
    setDirection((d) => (d === 'en-hy' ? 'hy-en' : 'en-hy'))
    setInput(result?.translated ?? '')
    setResult(null)
    setError('')
  }

  async function handleTranslate() {
    if (!input.trim() || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, direction }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Translation failed')
      }
      const data: TranslateResult = await res.json()
      setResult(data)
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
    try {
      const res = await fetch(`${API_BASE}/api/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: armenianText }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
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
          <h1>Armenian Speaker</h1>
          <p className="subtitle">Translate and hear Eastern Armenian, spoken aloud</p>
        </header>

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

        {error && <div className="error-banner">{error}</div>}

        {result && (
          <div className="card result-card">
            <p className="translated">{result.translated}</p>
            {result.transliteration && <p className="transliteration">{result.transliteration}</p>}
            {result.notes && <p className="notes">{result.notes}</p>}

            <div className="result-actions">
              <button className="ghost" onClick={handleSpeak} disabled={speaking || !armenianText.trim()}>
                {speaking ? <span className="spinner dark" /> : '🔊'} Speak
              </button>
              <button className="ghost" onClick={handleCopy}>
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

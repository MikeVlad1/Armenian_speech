import { useEffect, useState } from 'react'
import type { Deck, Direction, TranslateResult } from '../lib/types'
import { ApiError, breakdown, translate, type BreakdownWord } from '../lib/api'
import { useAudio } from '../lib/useAudio'
import { MY_PHRASES_DECK_ID } from '../lib/storage'

const HISTORY_KEY = 'armenian-speaker-history'
const HISTORY_LIMIT = 12

type HistoryEntry = TranslateResult & {
  id: string
  direction: Direction
  input: string
  timestamp: number
}

export type NewCardFields = {
  armenian: string
  english: string
  transliteration: string
  notes: string
}

type Props = {
  accessCode: string | null
  decks: Deck[]
  onAddCards: (cards: NewCardFields[], deckId: string) => void
  onLimitReached: () => void
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export default function TranslateView({ accessCode, decks, onAddCards, onLimitReached }: Props) {
  const [direction, setDirection] = useState<Direction>('en-hy')
  const [input, setInput] = useState('')
  const [result, setResult] = useState<TranslateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const [words, setWords] = useState<BreakdownWord[] | null>(null)
  const [breakingDown, setBreakingDown] = useState(false)
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set())

  const audio = useAudio(accessCode)

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }, [history])

  const isEnToHy = direction === 'en-hy'
  const armenianText = isEnToHy ? result?.translated ?? '' : input
  const englishText = isEnToHy ? input : result?.translated ?? ''

  function handleError(err: unknown) {
    if (err instanceof ApiError && err.limitReached) onLimitReached()
    setError(err instanceof Error ? err.message : 'Something went wrong')
  }

  function swapDirection() {
    setDirection((d) => (d === 'en-hy' ? 'hy-en' : 'en-hy'))
    setInput(result?.translated ?? '')
    setResult(null)
    setError('')
    setWords(null)
  }

  async function handleTranslate() {
    if (!input.trim() || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    setWords(null)
    setSaved(false)
    setSavedWords(new Set())
    try {
      const data = await translate(input, direction, accessCode)
      setResult(data)
      setHistory((prev) =>
        [
          { ...data, id: crypto.randomUUID(), direction, input, timestamp: Date.now() },
          ...prev,
        ].slice(0, HISTORY_LIMIT)
      )
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleBreakdown() {
    if (!armenianText.trim() || breakingDown) return
    setBreakingDown(true)
    setError('')
    try {
      setWords(await breakdown(armenianText, accessCode))
    } catch (err) {
      handleError(err)
    } finally {
      setBreakingDown(false)
    }
  }

  function handleSavePhrase() {
    if (!result) return
    onAddCards(
      [
        {
          armenian: armenianText,
          english: englishText,
          transliteration: result.transliteration,
          notes: result.notes,
        },
      ],
      MY_PHRASES_DECK_ID
    )
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  function handleSaveWord(word: BreakdownWord) {
    onAddCards(
      [
        {
          armenian: word.armenian,
          english: word.english,
          transliteration: word.transliteration,
          notes: word.partOfSpeech ?? '',
        },
      ],
      MY_PHRASES_DECK_ID
    )
    setSavedWords((prev) => new Set(prev).add(word.armenian))
  }

  function handleSaveAllWords() {
    if (!words?.length) return
    onAddCards(
      words.map((w) => ({
        armenian: w.armenian,
        english: w.english,
        transliteration: w.transliteration,
        notes: w.partOfSpeech ?? '',
      })),
      MY_PHRASES_DECK_ID
    )
    setSavedWords(new Set(words.map((w) => w.armenian)))
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
    setWords(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleTranslate()
  }

  const deckName = decks.find((d) => d.id === MY_PHRASES_DECK_ID)?.name ?? 'My Phrases'

  return (
    <>
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

      {(error || audio.error) && <div className="error-banner">{error || audio.error}</div>}

      {result && (
        <div className="card result-card">
          <p className="translated">{result.translated}</p>
          {result.transliteration && <p className="transliteration">{result.transliteration}</p>}
          {result.notes && <p className="notes">{result.notes}</p>}

          <div className="result-actions">
            <button
              className="ghost"
              onClick={() => audio.play(armenianText)}
              disabled={audio.playing || !armenianText.trim()}
            >
              {audio.playing ? <span className="spinner dark" /> : '🔊'} Speak
            </button>
            <button
              className="ghost"
              onClick={() => audio.play(armenianText, { rate: 'slow' })}
              disabled={audio.playing || !armenianText.trim()}
            >
              🐢 Slow
            </button>
            <button className="ghost" onClick={handleCopy}>
              {copied ? '✓ Copied' : '⧉ Copy'}
            </button>
            <button className="ghost" onClick={handleSavePhrase}>
              {saved ? `✓ Saved to ${deckName}` : '＋ Save phrase'}
            </button>
            <button className="ghost" onClick={handleBreakdown} disabled={breakingDown}>
              {breakingDown ? <span className="spinner dark" /> : '🔤'} Break into words
            </button>
          </div>
        </div>
      )}

      {words && (
        <div className="card breakdown-card">
          <div className="breakdown-header">
            <h2>Vocabulary</h2>
            {words.length > 0 && (
              <button className="link" onClick={handleSaveAllWords}>
                Save all as cards
              </button>
            )}
          </div>
          {words.length === 0 ? (
            <p className="empty-note">No individual words could be extracted from that phrase.</p>
          ) : (
            <ul className="word-list">
              {words.map((word) => (
                <li key={`${word.armenian}-${word.english}`}>
                  <div className="word-main">
                    <span className="word-arm">{word.armenian}</span>
                    <span className="word-translit">{word.transliteration}</span>
                  </div>
                  <div className="word-meta">
                    <span className="word-en">{word.english}</span>
                    {word.partOfSpeech && <span className="word-pos">{word.partOfSpeech}</span>}
                  </div>
                  <div className="word-actions">
                    <button className="icon-btn" onClick={() => audio.play(word.armenian)} title="Play">
                      🔊
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => handleSaveWord(word)}
                      disabled={savedWords.has(word.armenian)}
                      title="Save as flashcard"
                    >
                      {savedWords.has(word.armenian) ? '✓' : '＋'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="history">
          <div className="history-header">
            <h2>Recent</h2>
            <button className="link" onClick={() => setHistory([])}>
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
    </>
  )
}

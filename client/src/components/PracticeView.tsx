import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Deck } from '../lib/types'
import { ApiError, transcribe } from '../lib/api'
import { compareWords, scoreLabel, similarity, type WordComparison } from '../lib/text'
import { useAudio } from '../lib/useAudio'
import { encodeWav16kMono } from '../lib/wavEncode'
import ArmenianKeyboard from './ArmenianKeyboard'

type Props = {
  accessCode: string | null
  cards: Card[]
  decks: Deck[]
  onAnswer: (correct: boolean) => void
  onLimitReached: () => void
}

type Mode = 'speaking' | 'listening'

/**
 * Recording format doesn't need to match what Azure accepts - checkRecording
 * converts to WAV before upload (see lib/wavEncode.ts) - so this just picks
 * whatever the browser itself can record.
 */
const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function PracticeView({ accessCode, cards, decks, onAnswer, onLimitReached }: Props) {
  const [mode, setMode] = useState<Mode>('speaking')
  const [deckId, setDeckId] = useState('all')
  const [order, setOrder] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [error, setError] = useState('')

  // Speaking state
  const [recording, setRecording] = useState(false)
  const [checking, setChecking] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [wordResults, setWordResults] = useState<WordComparison[]>([])

  // Listening state
  const [typed, setTyped] = useState('')
  const [listenChecked, setListenChecked] = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(true)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const audio = useAudio(accessCode)
  const mimeType = useMemo(pickMimeType, [])

  const pool = useMemo(
    () => (deckId === 'all' ? cards : cards.filter((c) => c.deckId === deckId)),
    [cards, deckId]
  )

  useEffect(() => {
    setOrder(shuffle(pool))
    setIndex(0)
    resetAttempt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length, deckId, mode])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const current = order[index]

  function resetAttempt() {
    setTranscript(null)
    setScore(null)
    setWordResults([])
    setTyped('')
    setListenChecked(false)
    setError('')
  }

  function nextCard() {
    resetAttempt()
    setIndex((i) => (i + 1 >= order.length ? 0 : i + 1))
  }

  async function startRecording() {
    if (!mimeType) {
      setError('This browser cannot record audio in a format the speech service accepts. Try Chrome, Edge, or Firefox.')
      return
    }
    setError('')
    resetAttempt()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        void checkRecording(new Blob(chunksRef.current, { type: mimeType }))
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setError('Microphone access was blocked. Allow it in your browser settings to practice speaking.')
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }

  async function checkRecording(blob: Blob) {
    if (!current) return
    setChecking(true)
    try {
      let wav: Blob
      try {
        wav = await encodeWav16kMono(blob)
      } catch {
        setError('Could not process that recording. Please try again.')
        return
      }
      const { transcript: heard, status } = await transcribe(wav, accessCode)
      if (!heard) {
        setTranscript('')
        setScore(0)
        setWordResults([])
        setError(
          status === 'InitialSilenceTimeout'
            ? "We didn't hear anything - try again a little louder."
            : "We couldn't make out any Armenian in that recording. Try again."
        )
        return
      }
      const pct = similarity(current.armenian, heard)
      setTranscript(heard)
      setScore(pct)
      setWordResults(compareWords(current.armenian, heard))
      onAnswer(pct >= 65)
    } catch (err) {
      if (err instanceof ApiError && err.limitReached) onLimitReached()
      setError(err instanceof Error ? err.message : 'Could not check that recording')
    } finally {
      setChecking(false)
    }
  }

  function checkListening() {
    if (!current) return
    const pct = similarity(current.armenian, typed)
    setScore(pct)
    setWordResults(compareWords(current.armenian, typed))
    setListenChecked(true)
    onAnswer(pct >= 65)
  }

  const deckOptions = useMemo(
    () => decks.filter((deck) => cards.some((c) => c.deckId === deck.id)),
    [cards, decks]
  )

  if (cards.length === 0) {
    return (
      <div className="card empty-state">
        <h2>Nothing to practice yet</h2>
        <p>Save a few phrases or open a built-in deck, then come back to practice saying them out loud.</p>
      </div>
    )
  }

  return (
    <>
      <div className="study-toolbar">
        <div className="side-toggle">
          <button className={mode === 'speaking' ? 'active' : ''} onClick={() => setMode('speaking')}>
            🎙 Speaking
          </button>
          <button className={mode === 'listening' ? 'active' : ''} onClick={() => setMode('listening')}>
            👂 Listening
          </button>
        </div>

        <select value={deckId} onChange={(e) => setDeckId(e.target.value)} className="deck-select">
          <option value="all">All decks</option>
          {deckOptions.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deck.name}
            </option>
          ))}
        </select>
      </div>

      {(error || audio.error) && <div className="error-banner">{error || audio.error}</div>}

      {current && (
        <div className="card practice-card">
          {mode === 'speaking' ? (
            <>
              <span className="flashcard-hint">Say this out loud</span>
              <p className="flashcard-front">{current.armenian}</p>
              {current.transliteration && <p className="transliteration">{current.transliteration}</p>}
              <p className="notes">{current.english}</p>

              <div className="result-actions center">
                <button className="ghost" onClick={() => audio.play(current.armenian)} disabled={audio.playing}>
                  {audio.playing ? <span className="spinner dark" /> : '🔊'} Hear it
                </button>
                <button
                  className="ghost"
                  onClick={() => audio.play(current.armenian, { rate: 'slow' })}
                  disabled={audio.playing}
                >
                  🐢 Slow
                </button>
              </div>

              <button
                className={`record-btn ${recording ? 'recording' : ''}`}
                onClick={recording ? stopRecording : startRecording}
                disabled={checking}
              >
                {checking ? (
                  <>
                    <span className="spinner" /> Checking…
                  </>
                ) : recording ? (
                  '⏹ Stop & check'
                ) : (
                  '🎙 Record'
                )}
              </button>
            </>
          ) : (
            <>
              <span className="flashcard-hint">Listen, then type what you hear</span>
              <button className="ghost big" onClick={() => audio.play(current.armenian)} disabled={audio.playing}>
                {audio.playing ? <span className="spinner dark" /> : '🔊'} Play audio
              </button>
              <button
                className="ghost"
                onClick={() => audio.play(current.armenian, { rate: 'slow' })}
                disabled={audio.playing}
              >
                🐢 Slower
              </button>

              <input
                className="dictation-input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !listenChecked && checkListening()}
                placeholder="Type the Armenian you heard…"
                disabled={listenChecked}
              />

              {!listenChecked && (
                <>
                  <button className="link small" onClick={() => setShowKeyboard((v) => !v)}>
                    {showKeyboard ? 'Hide Armenian keyboard' : '⌨ Show Armenian keyboard'}
                  </button>
                  {showKeyboard && (
                    <ArmenianKeyboard
                      onInsert={(char) => setTyped((t) => t + char)}
                      onBackspace={() => setTyped((t) => t.slice(0, -1))}
                    />
                  )}
                  <button className="primary" onClick={checkListening} disabled={!typed.trim()}>
                    Check
                  </button>
                </>
              )}
            </>
          )}

          {score !== null && (mode === 'speaking' ? transcript !== null : listenChecked) && (
            <div className={`attempt-result ${scoreLabel(score).tone}`}>
              <div className="attempt-score">
                <strong>{score}%</strong> · {scoreLabel(score).label}
              </div>

              {wordResults.length > 0 && (
                <p className="word-diff">
                  {wordResults.map((w, i) => (
                    <span key={`${w.word}-${i}`} className={w.correct ? 'w-ok' : 'w-bad'}>
                      {w.word}
                    </span>
                  ))}
                </p>
              )}

              {mode === 'speaking' && transcript && (
                <p className="heard">We heard: “{transcript}”</p>
              )}
              {mode === 'listening' && <p className="heard">Answer: {current.armenian}</p>}

              <button className="primary" onClick={nextCard}>
                Next phrase
              </button>
            </div>
          )}

          {score === null && (
            <button className="link" onClick={nextCard}>
              Skip →
            </button>
          )}
        </div>
      )}
    </>
  )
}

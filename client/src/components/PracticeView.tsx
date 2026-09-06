import { useEffect, useMemo, useState } from 'react'
import type { Card, Deck, LangCode } from '../lib/types'
import { LANGUAGES } from '../lib/languages'
import { ApiError, transcribe } from '../lib/api'
import { compareWords, scoreLabel, similarity, type WordComparison } from '../lib/text'
import { useAudio } from '../lib/useAudio'
import { useSpeechRecorder } from '../lib/useSpeechRecorder'
import { canUseAudio } from '../lib/plan'
import { KEYBOARDS } from '../data/keyboards'
import Keyboard from './Keyboard'

type Props = {
  accessCode: string | null
  lang: LangCode
  cards: Card[]
  decks: Deck[]
  isPro: boolean
  onAnswer: (correct: boolean) => void
  onLimitReached: () => void
  onUpgrade: () => void
}

type Mode = 'speaking' | 'listening'

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function PracticeView({
  accessCode,
  lang,
  cards,
  decks,
  isPro,
  onAnswer,
  onLimitReached,
  onUpgrade,
}: Props) {
  const [mode, setMode] = useState<Mode>('speaking')
  const [deckId, setDeckId] = useState('all')
  const [order, setOrder] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [error, setError] = useState('')

  // Speaking state
  const [checking, setChecking] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [wordResults, setWordResults] = useState<WordComparison[]>([])

  // Listening state
  const [typed, setTyped] = useState('')
  const [listenChecked, setListenChecked] = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(true)

  const audio = useAudio(accessCode)
  const recorder = useSpeechRecorder({ onResult: checkRecording, onError: setError })

  const pool = useMemo(
    () => (deckId === 'all' ? cards : cards.filter((c) => c.deckId === deckId)),
    [cards, deckId]
  )

  useEffect(() => {
    setOrder(shuffle(pool))
    setIndex(0)
    resetAttempt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length, deckId, mode, lang])

  useEffect(() => {
    return () => recorder.cleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const current = order[index]
  const keyboard = KEYBOARDS[lang]
  const needsKeyboard = LANGUAGES[lang].needsKeyboard && !!keyboard
  const audioAllowed = !current || canUseAudio(current, decks, isPro)

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

  function startRecording() {
    setError('')
    resetAttempt()
    void recorder.start()
  }

  async function checkRecording(wav: Blob) {
    if (!current) return
    setChecking(true)
    try {
      const { transcript: heard, status } = await transcribe(wav, accessCode, lang)
      if (!heard) {
        setTranscript('')
        setScore(0)
        setWordResults([])
        setError(
          status === 'InitialSilenceTimeout'
            ? "We didn't hear anything - try again a little louder."
            : `We couldn't make out any ${LANGUAGES[lang].name} in that recording. Try again.`
        )
        return
      }
      const pct = similarity(current.target, heard, current.lang)
      setTranscript(heard)
      setScore(pct)
      setWordResults(compareWords(current.target, heard, current.lang))
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
    const pct = similarity(current.target, typed, current.lang)
    setScore(pct)
    setWordResults(compareWords(current.target, typed, current.lang))
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

      {current && !audioAllowed && (
        <div className="card practice-card locked-card">
          <span className="flashcard-hint">🔒 Pro feature</span>
          <p className="flashcard-front">{current.target}</p>
          <p className="notes">
            Speaking and listening practice on your own cards is a Pro feature — free accounts can
            practice the built-in decks. Upgrade to Pro to practice pronunciation on everything you save.
          </p>
          <div className="result-actions center">
            <button className="primary" onClick={onUpgrade}>
              Upgrade to Pro - $3.99/mo
            </button>
            <button className="link" onClick={nextCard}>
              Skip →
            </button>
          </div>
        </div>
      )}

      {current && audioAllowed && (
        <div className="card practice-card">
          {mode === 'speaking' ? (
            <>
              <span className="flashcard-hint">Say this out loud</span>
              <p className="flashcard-front">{current.target}</p>
              {current.transliteration && <p className="transliteration">{current.transliteration}</p>}
              <p className="notes">{current.native}</p>

              <div className="result-actions center">
                <button
                  className="ghost"
                  onClick={() => audio.play(current.target, { lang: current.lang })}
                  disabled={audio.playing}
                >
                  {audio.playing ? <span className="spinner dark" /> : '🔊'} Hear it
                </button>
                <button
                  className="ghost"
                  onClick={() => audio.play(current.target, { lang: current.lang, rate: 'slow' })}
                  disabled={audio.playing}
                >
                  🐢 Slow
                </button>
              </div>

              <button
                className={`record-btn ${recorder.recording ? 'recording' : ''}`}
                onClick={recorder.recording ? recorder.stop : startRecording}
                disabled={checking}
              >
                {checking ? (
                  <>
                    <span className="spinner" /> Checking…
                  </>
                ) : recorder.recording ? (
                  '⏹ Stop & check'
                ) : (
                  '🎙 Record'
                )}
              </button>
            </>
          ) : (
            <>
              <span className="flashcard-hint">Listen, then type what you hear</span>
              <button
                className="ghost big"
                onClick={() => audio.play(current.target, { lang: current.lang })}
                disabled={audio.playing}
              >
                {audio.playing ? <span className="spinner dark" /> : '🔊'} Play audio
              </button>
              <button
                className="ghost"
                onClick={() => audio.play(current.target, { lang: current.lang, rate: 'slow' })}
                disabled={audio.playing}
              >
                🐢 Slower
              </button>

              <input
                className="dictation-input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !listenChecked && checkListening()}
                placeholder={`Type the ${LANGUAGES[lang].name} you heard…`}
                disabled={listenChecked}
              />

              {!listenChecked && (
                <>
                  {needsKeyboard && (
                    <button className="link small" onClick={() => setShowKeyboard((v) => !v)}>
                      {showKeyboard ? 'Hide keyboard' : `⌨ Show ${LANGUAGES[lang].name} keyboard`}
                    </button>
                  )}
                  {needsKeyboard && showKeyboard && keyboard && (
                    <Keyboard
                      lower={keyboard.lower}
                      upper={keyboard.upper}
                      marks={keyboard.marks}
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
              {mode === 'listening' && <p className="heard">Answer: {current.target}</p>}

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

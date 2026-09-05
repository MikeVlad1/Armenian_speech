import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Card, Deck, LangCode } from '../lib/types'
import { LANGUAGES } from '../lib/languages'
import { useAudio } from '../lib/useAudio'

type Props = {
  accessCode: string | null
  lang: LangCode
  cards: Card[]
  decks: Deck[]
  onAnswer: (correct: boolean) => void
}

type QuizDirection = 'target-native' | 'native-target'

type Question = {
  card: Card
  direction: QuizDirection
  options: string[]
  answer: string
}

const QUIZ_LENGTH = 10
const OPTION_COUNT = 4

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function buildQuestions(pool: Card[], allCards: Card[], direction: QuizDirection | 'mixed'): Question[] {
  const selected = shuffle(pool).slice(0, QUIZ_LENGTH)

  return selected.map((card) => {
    const dir: QuizDirection =
      direction === 'mixed' ? (Math.random() < 0.5 ? 'target-native' : 'native-target') : direction
    const valueOf = (c: Card) => (dir === 'target-native' ? c.native : c.target)
    const answer = valueOf(card)

    // Prefer distractors from the same deck; fall back to the full collection
    // so small decks still produce four plausible options.
    const sameDeck = pool.filter((c) => c.id !== card.id && valueOf(c) !== answer)
    const fallback = allCards.filter((c) => c.id !== card.id && valueOf(c) !== answer)
    const distractorSource = sameDeck.length >= OPTION_COUNT - 1 ? sameDeck : fallback

    const distractors: string[] = []
    for (const candidate of shuffle(distractorSource)) {
      const value = valueOf(candidate)
      if (!distractors.includes(value)) distractors.push(value)
      if (distractors.length === OPTION_COUNT - 1) break
    }

    return { card, direction: dir, answer, options: shuffle([answer, ...distractors]) }
  })
}

export default function QuizView({ accessCode, lang, cards, decks, onAnswer }: Props) {
  const [deckId, setDeckId] = useState('all')
  const [direction, setDirection] = useState<QuizDirection | 'mixed'>('target-native')
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)

  const audio = useAudio(accessCode)

  // Switching the active learning language mid-quiz would otherwise keep
  // quizzing the previous language's cards, since nothing else here depends
  // on `lang` directly.
  useEffect(() => {
    setQuestions(null)
  }, [lang])

  const pool = useMemo(
    () => (deckId === 'all' ? cards : cards.filter((c) => c.deckId === deckId)),
    [cards, deckId]
  )

  const start = useCallback(() => {
    setQuestions(buildQuestions(pool, cards, direction))
    setIndex(0)
    setPicked(null)
    setScore(0)
  }, [pool, cards, direction])

  const deckOptions = useMemo(
    () => decks.filter((deck) => cards.some((c) => c.deckId === deck.id)),
    [cards, decks]
  )

  if (cards.length < OPTION_COUNT) {
    return (
      <div className="card empty-state">
        <h2>Not enough cards yet</h2>
        <p>You need at least {OPTION_COUNT} saved cards to build a quiz. Save a few more phrases first.</p>
      </div>
    )
  }

  if (!questions) {
    return (
      <div className="card quiz-setup">
        <h2>Multiple choice quiz</h2>
        <label className="field">
          <span>Deck</span>
          <select value={deckId} onChange={(e) => setDeckId(e.target.value)}>
            <option value="all">All decks ({cards.length} cards)</option>
            {deckOptions.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name} ({cards.filter((c) => c.deckId === deck.id).length})
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Direction</span>
          <select value={direction} onChange={(e) => setDirection(e.target.value as QuizDirection | 'mixed')}>
            <option value="target-native">{LANGUAGES[lang].name} → English</option>
            <option value="native-target">English → {LANGUAGES[lang].name}</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>

        <button className="primary" onClick={start} disabled={pool.length < OPTION_COUNT}>
          Start quiz
        </button>
        {pool.length < OPTION_COUNT && (
          <p className="empty-note">That deck needs at least {OPTION_COUNT} cards.</p>
        )}
      </div>
    )
  }

  if (index >= questions.length) {
    const pct = Math.round((score / questions.length) * 100)
    return (
      <div className="card empty-state">
        <h2>{pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚'} {score} / {questions.length}</h2>
        <p>You scored {pct}%.</p>
        <div className="result-actions center">
          <button className="primary" onClick={start}>
            Try again
          </button>
          <button className="ghost" onClick={() => setQuestions(null)}>
            Change settings
          </button>
        </div>
      </div>
    )
  }

  const question = questions[index]
  const prompt = question.direction === 'target-native' ? question.card.target : question.card.native
  const answered = picked !== null

  function choose(option: string) {
    if (answered) return
    setPicked(option)
    const correct = option === question.answer
    if (correct) setScore((s) => s + 1)
    onAnswer(correct)
  }

  return (
    <>
      <div className="quiz-progress">
        <div className="quiz-progress-bar" style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>
      <div className="queue-counts">
        <span className="count-chip learn">
          Question {index + 1} of {questions.length}
        </span>
        <span className="count-chip done">{score} correct</span>
      </div>

      <div className="card quiz-card">
        <span className="flashcard-hint">
          {question.direction === 'target-native' ? 'What does this mean?' : 'How do you say this?'}
        </span>
        <p className="flashcard-front">{prompt}</p>

        {question.direction === 'target-native' && (
          <button
            className="ghost"
            onClick={() => audio.play(question.card.target, { lang: question.card.lang })}
            disabled={audio.playing}
          >
            {audio.playing ? <span className="spinner dark" /> : '🔊'} Listen
          </button>
        )}

        <div className="options">
          {question.options.map((option) => {
            const isAnswer = option === question.answer
            const isPicked = option === picked
            const state = !answered ? '' : isAnswer ? 'correct' : isPicked ? 'wrong' : 'dimmed'
            return (
              <button key={option} className={`option ${state}`} onClick={() => choose(option)} disabled={answered}>
                {option}
                {answered && isAnswer && <span className="option-mark">✓</span>}
                {answered && isPicked && !isAnswer && <span className="option-mark">✕</span>}
              </button>
            )
          })}
        </div>

        {answered && (
          <div className="quiz-feedback">
            {question.card.transliteration && (
              <p className="transliteration">{question.card.transliteration}</p>
            )}
            <button
              className="primary"
              onClick={() => {
                setPicked(null)
                setIndex((i) => i + 1)
              }}
            >
              {index + 1 === questions.length ? 'See results' : 'Next'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

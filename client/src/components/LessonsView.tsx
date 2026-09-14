import { useCallback, useEffect, useState } from 'react'
import type { Card, Deck, LangCode } from '../lib/types'
import { buildLessonSession, MIN_CARDS_FOR_LESSON, type Exercise } from '../lib/lessons'
import WordOrderExercise from './lessons/WordOrderExercise'
import FillBlankExercise from './lessons/FillBlankExercise'
import MultipleChoiceExercise from './lessons/MultipleChoiceExercise'
import ListenSelectExercise from './lessons/ListenSelectExercise'
import { playComplete } from '../lib/sound'

type Props = {
  accessCode: string | null
  lang: LangCode
  cards: Card[]
  decks: Deck[]
  isPro: boolean
  onAnswer: (correct: boolean) => void
}

export default function LessonsView({ accessCode, lang, cards, decks, isPro, onAnswer }: Props) {
  const [session, setSession] = useState<Exercise[] | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(false)

  // Switching the active learning language mid-lesson would otherwise keep
  // drilling the previous language's cards, since nothing else here depends
  // on `lang` directly.
  useEffect(() => {
    setSession(null)
  }, [lang])

  const start = useCallback(() => {
    setSession(buildLessonSession(cards, decks, isPro))
    setIndex(0)
    setScore(0)
    setAnswered(false)
  }, [cards, decks, isPro])

  function handleResult(correct: boolean) {
    if (answered) return
    setAnswered(true)
    if (correct) setScore((s) => s + 1)
    onAnswer(correct)
  }

  function next() {
    if (session && index + 1 === session.length) playComplete()
    setAnswered(false)
    setIndex((i) => i + 1)
  }

  if (cards.length < MIN_CARDS_FOR_LESSON) {
    return (
      <div className="card empty-state">
        <h2>Not enough cards yet</h2>
        <p>You need at least {MIN_CARDS_FOR_LESSON} saved cards to build a lesson. Save a few more phrases first.</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="card quiz-setup">
        <h2>🎓 Lessons</h2>
        <p className="empty-note">
          A quick mixed session — unscramble sentences, fill in blanks, multiple choice and listening,
          pulled from everything you've saved in {lang.toUpperCase()}.
        </p>
        <button className="primary" onClick={start}>
          Start lesson
        </button>
      </div>
    )
  }

  if (index >= session.length) {
    const pct = Math.round((score / session.length) * 100)
    return (
      <div className="card empty-state">
        <h2>
          {pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚'} {score} / {session.length}
        </h2>
        <p>You scored {pct}%.</p>
        <div className="result-actions center">
          <button className="primary" onClick={start}>
            New lesson
          </button>
        </div>
      </div>
    )
  }

  const exercise = session[index]

  return (
    <>
      <div className="quiz-progress">
        <div className="quiz-progress-bar" style={{ width: `${(index / session.length) * 100}%` }} />
      </div>
      <div className="queue-counts">
        <span className="count-chip learn">
          Exercise {index + 1} of {session.length}
        </span>
        <span className="count-chip done">{score} correct</span>
      </div>

      {exercise.type === 'word-order' && (
        <WordOrderExercise key={index} exercise={exercise} onResult={handleResult} />
      )}
      {exercise.type === 'fill-blank' && (
        <FillBlankExercise key={index} exercise={exercise} lang={lang} onResult={handleResult} />
      )}
      {exercise.type === 'multiple-choice' && (
        <MultipleChoiceExercise key={index} exercise={exercise} onResult={handleResult} />
      )}
      {exercise.type === 'listen-select' && (
        <ListenSelectExercise key={index} exercise={exercise} accessCode={accessCode} onResult={handleResult} />
      )}

      {answered && (
        <div className="quiz-feedback">
          <button className="primary" onClick={next}>
            {index + 1 === session.length ? 'See results' : 'Next'}
          </button>
        </div>
      )}
    </>
  )
}

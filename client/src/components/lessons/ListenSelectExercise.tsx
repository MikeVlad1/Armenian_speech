import { useState } from 'react'
import type { ListenSelectExercise as ListenSelectExerciseType } from '../../lib/lessons'
import { useAudio } from '../../lib/useAudio'

type Props = {
  exercise: ListenSelectExerciseType
  accessCode: string | null
  onResult: (correct: boolean) => void
}

export default function ListenSelectExercise({ exercise, accessCode, onResult }: Props) {
  const [picked, setPicked] = useState<string | null>(null)
  const audio = useAudio(accessCode)
  const answered = picked !== null

  function choose(option: string) {
    if (answered) return
    setPicked(option)
    onResult(option === exercise.answer)
  }

  return (
    <div className="card lesson-exercise">
      <span className="flashcard-hint">Listen, then pick what you heard</span>
      <button
        className="ghost big"
        onClick={() => audio.play(exercise.card.target, { lang: exercise.card.lang })}
        disabled={audio.playing}
      >
        {audio.playing ? <span className="spinner dark" /> : '🔊'} Play audio
      </button>
      {audio.error && <div className="error-banner">{audio.error}</div>}

      <div className="options">
        {exercise.options.map((option) => {
          const isAnswer = option === exercise.answer
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
    </div>
  )
}

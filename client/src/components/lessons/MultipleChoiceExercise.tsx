import { useState } from 'react'
import type { MultipleChoiceExercise as MultipleChoiceExerciseType } from '../../lib/lessons'

type Props = {
  exercise: MultipleChoiceExerciseType
  onResult: (correct: boolean) => void
}

export default function MultipleChoiceExercise({ exercise, onResult }: Props) {
  const [picked, setPicked] = useState<string | null>(null)
  const answered = picked !== null
  const prompt = exercise.direction === 'target-native' ? exercise.card.target : exercise.card.native

  function choose(option: string) {
    if (answered) return
    setPicked(option)
    onResult(option === exercise.answer)
  }

  return (
    <div className="card lesson-exercise">
      <span className="flashcard-hint">
        {exercise.direction === 'target-native' ? 'What does this mean?' : 'How do you say this?'}
      </span>
      <p className="flashcard-front">{prompt}</p>

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

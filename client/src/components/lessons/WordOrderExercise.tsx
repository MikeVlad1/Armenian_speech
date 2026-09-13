import { useState } from 'react'
import type { WordOrderExercise as WordOrderExerciseType } from '../../lib/lessons'

type Tile = { word: string; id: number }

type Props = {
  exercise: WordOrderExerciseType
  onResult: (correct: boolean) => void
}

export default function WordOrderExercise({ exercise, onResult }: Props) {
  const [bank, setBank] = useState<Tile[]>(exercise.tiles.map((word, id) => ({ word, id })))
  const [assembled, setAssembled] = useState<Tile[]>([])
  const [checked, setChecked] = useState(false)
  const [correct, setCorrect] = useState(false)

  function moveUp(tile: Tile) {
    if (checked) return
    setBank((b) => b.filter((t) => t.id !== tile.id))
    setAssembled((a) => [...a, tile])
  }

  function moveDown(tile: Tile) {
    if (checked) return
    setAssembled((a) => a.filter((t) => t.id !== tile.id))
    setBank((b) => [...b, tile])
  }

  function check() {
    if (checked || assembled.length !== exercise.answerTokens.length) return
    const isCorrect = assembled.map((t) => t.word).join(' ') === exercise.answerTokens.join(' ')
    setChecked(true)
    setCorrect(isCorrect)
    onResult(isCorrect)
  }

  return (
    <div className="card lesson-exercise">
      <span className="flashcard-hint">Put the words in order</span>
      <p className="notes">{exercise.card.native}</p>

      <div className="word-order-assembled">
        {assembled.length === 0 && <span className="word-order-placeholder">Tap the words below</span>}
        {assembled.map((tile) => (
          <button
            key={tile.id}
            className={`word-tile ${checked ? (correct ? 'correct' : 'wrong') : ''}`}
            onClick={() => moveDown(tile)}
            disabled={checked}
          >
            {tile.word}
          </button>
        ))}
      </div>

      <div className="word-order-bank">
        {bank.map((tile) => (
          <button key={tile.id} className="word-tile bank" onClick={() => moveUp(tile)} disabled={checked}>
            {tile.word}
          </button>
        ))}
      </div>

      {!checked && (
        <button className="primary" onClick={check} disabled={assembled.length !== exercise.answerTokens.length}>
          Check
        </button>
      )}

      {checked && !correct && <p className="notes">Correct answer: {exercise.answerTokens.join(' ')}</p>}
    </div>
  )
}

import { useState } from 'react'
import type { FillBlankExercise as FillBlankExerciseType } from '../../lib/lessons'
import type { LangCode } from '../../lib/types'
import { normalize } from '../../lib/text'
import { LANGUAGES } from '../../lib/languages'
import { KEYBOARDS } from '../../data/keyboards'
import Keyboard from '../Keyboard'
import { playCorrect, playIncorrect } from '../../lib/sound'

type Props = {
  exercise: FillBlankExerciseType
  lang: LangCode
  onResult: (correct: boolean) => void
}

export default function FillBlankExercise({ exercise, lang, onResult }: Props) {
  const [value, setValue] = useState('')
  const [checked, setChecked] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(true)

  const keyboard = KEYBOARDS[lang]
  const needsKeyboard = LANGUAGES[lang].needsKeyboard && !!keyboard

  function check() {
    if (checked || !value.trim()) return
    const isCorrect = normalize(value, lang) === normalize(exercise.answer, lang)
    setChecked(true)
    setCorrect(isCorrect)
    onResult(isCorrect)
    if (isCorrect) playCorrect()
    else playIncorrect()
  }

  return (
    <div className="card lesson-exercise">
      <span className="flashcard-hint">Fill in the blank</span>
      <p className="flashcard-front">
        {exercise.tokens.map((token, i) => (i === exercise.blankIndex ? ' ____ ' : `${token} `))}
      </p>
      <p className="notes">{exercise.card.native}</p>

      <input
        className="dictation-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !checked && check()}
        placeholder="Type the missing word…"
        disabled={checked}
      />

      {!checked && needsKeyboard && (
        <button className="link small" onClick={() => setShowKeyboard((v) => !v)}>
          {showKeyboard ? 'Hide keyboard' : `⌨ Show ${LANGUAGES[lang].name} keyboard`}
        </button>
      )}
      {!checked && needsKeyboard && showKeyboard && keyboard && (
        <Keyboard
          lower={keyboard.lower}
          upper={keyboard.upper}
          marks={keyboard.marks}
          onInsert={(char) => setValue((v) => v + char)}
          onBackspace={() => setValue((v) => v.slice(0, -1))}
        />
      )}

      {!checked ? (
        <button className="primary" onClick={check} disabled={!value.trim()}>
          Check
        </button>
      ) : (
        !correct && <p className="notes">Correct answer: {exercise.answer}</p>
      )}
    </div>
  )
}

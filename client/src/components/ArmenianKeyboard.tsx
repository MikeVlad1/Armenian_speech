import { useState } from 'react'

/** The 38 letters of the Armenian alphabet, plus the և ligature. */
const LOWER = [
  'ա', 'բ', 'գ', 'դ', 'ե', 'զ', 'է', 'ը', 'թ', 'ժ',
  'ի', 'լ', 'խ', 'ծ', 'կ', 'հ', 'ձ', 'ղ', 'ճ', 'մ',
  'յ', 'ն', 'շ', 'ո', 'չ', 'պ', 'ջ', 'ռ', 'ս', 'վ',
  'տ', 'ր', 'ց', 'ւ', 'փ', 'ք', 'օ', 'ֆ', 'և',
]

const UPPER = [
  'Ա', 'Բ', 'Գ', 'Դ', 'Ե', 'Զ', 'Է', 'Ը', 'Թ', 'Ժ',
  'Ի', 'Լ', 'Խ', 'Ծ', 'Կ', 'Հ', 'Ձ', 'Ղ', 'Ճ', 'Մ',
  'Յ', 'Ն', 'Շ', 'Ո', 'Չ', 'Պ', 'Ջ', 'Ռ', 'Ս', 'Վ',
  'Տ', 'Ր', 'Ց', 'Ւ', 'Փ', 'Ք', 'Օ', 'Ֆ', 'Եւ',
]

/** Marks a learner can't easily reach: full stop, question, exclamation, emphasis, comma. */
const MARKS = ['։', '՞', '՜', '՛', '՝', ',']

type Props = {
  onInsert: (text: string) => void
  onBackspace: () => void
}

export default function ArmenianKeyboard({ onInsert, onBackspace }: Props) {
  const [shift, setShift] = useState(false)
  const letters = shift ? UPPER : LOWER

  function press(char: string) {
    onInsert(char)
    // Behave like a real shift key: capitalise one letter, then release.
    if (shift) setShift(false)
  }

  return (
    <div className="keyboard">
      <div className="keyboard-keys">
        {letters.map((char, i) => (
          <button
            key={char + i}
            type="button"
            className="key"
            onClick={() => press(char)}
            tabIndex={-1}
          >
            {char}
          </button>
        ))}
      </div>

      <div className="keyboard-row">
        <button
          type="button"
          className={`key wide ${shift ? 'active' : ''}`}
          onClick={() => setShift((s) => !s)}
          tabIndex={-1}
        >
          ⇧ Shift
        </button>
        {MARKS.map((mark) => (
          <button key={mark} type="button" className="key" onClick={() => press(mark)} tabIndex={-1}>
            {mark}
          </button>
        ))}
        <button type="button" className="key wide" onClick={() => press(' ')} tabIndex={-1}>
          Space
        </button>
        <button type="button" className="key wide" onClick={onBackspace} tabIndex={-1}>
          ⌫
        </button>
      </div>
    </div>
  )
}

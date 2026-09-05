import { useState } from 'react'
import type { KeyboardLayout } from '../data/keyboards'

type Props = KeyboardLayout & {
  onInsert: (text: string) => void
  onBackspace: () => void
}

export default function Keyboard({ lower, upper, marks, onInsert, onBackspace }: Props) {
  const [shift, setShift] = useState(false)
  const letters = shift ? upper : lower

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
        {marks.map((mark) => (
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

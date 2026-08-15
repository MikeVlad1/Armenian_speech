import { useMemo, useState } from 'react'
import type { Card, Deck } from '../lib/types'
import { dueCards, intervalPreview, isNew, type Grade } from '../lib/srs'
import { useAudio } from '../lib/useAudio'

type Props = {
  accessCode: string | null
  cards: Card[]
  decks: Deck[]
  onGrade: (card: Card, grade: Grade) => void
}

type CardSide = 'armenian' | 'english'

const GRADES: { grade: Grade; label: string; className: string }[] = [
  { grade: 'again', label: 'Again', className: 'again' },
  { grade: 'hard', label: 'Hard', className: 'hard' },
  { grade: 'good', label: 'Good', className: 'good' },
  { grade: 'easy', label: 'Easy', className: 'easy' },
]

export default function FlashcardsView({ accessCode, cards, decks, onGrade }: Props) {
  const [deckId, setDeckId] = useState<string>('all')
  const [front, setFront] = useState<CardSide>('armenian')
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)

  const audio = useAudio(accessCode)

  const scoped = useMemo(
    () => (deckId === 'all' ? cards : cards.filter((c) => c.deckId === deckId)),
    [cards, deckId]
  )
  const queue = useMemo(() => dueCards(scoped), [scoped])
  const current = queue[0]

  const counts = useMemo(() => {
    const due = queue.length
    const fresh = queue.filter(isNew).length
    return { due, fresh, learning: due - fresh }
  }, [queue])

  function handleGrade(grade: Grade) {
    if (!current) return
    onGrade(current, grade)
    setRevealed(false)
    setReviewed((n) => n + 1)
  }

  const deckOptions = useMemo(
    () =>
      decks
        .map((deck) => ({
          deck,
          due: dueCards(cards.filter((c) => c.deckId === deck.id)).length,
          total: cards.filter((c) => c.deckId === deck.id).length,
        }))
        .filter((d) => d.total > 0),
    [cards, decks]
  )

  if (cards.length === 0) {
    return (
      <div className="card empty-state">
        <h2>No cards yet</h2>
        <p>Translate a phrase and tap “Save phrase”, or browse the built-in decks to get started.</p>
      </div>
    )
  }

  return (
    <>
      <div className="study-toolbar">
        <select value={deckId} onChange={(e) => setDeckId(e.target.value)} className="deck-select">
          <option value="all">All decks ({dueCards(cards).length} due)</option>
          {deckOptions.map(({ deck, due, total }) => (
            <option key={deck.id} value={deck.id}>
              {deck.name} ({due} due / {total})
            </option>
          ))}
        </select>

        <div className="side-toggle">
          <button
            className={front === 'armenian' ? 'active' : ''}
            onClick={() => {
              setFront('armenian')
              setRevealed(false)
            }}
          >
            HY → EN
          </button>
          <button
            className={front === 'english' ? 'active' : ''}
            onClick={() => {
              setFront('english')
              setRevealed(false)
            }}
          >
            EN → HY
          </button>
        </div>
      </div>

      {audio.error && <div className="error-banner">{audio.error}</div>}

      {!current ? (
        <div className="card empty-state">
          <h2>🎉 All caught up</h2>
          <p>
            {reviewed > 0
              ? `You reviewed ${reviewed} card${reviewed === 1 ? '' : 's'} in this session.`
              : 'Nothing is due in this deck right now. Come back later, or pick another deck.'}
          </p>
        </div>
      ) : (
        <>
          <div className="queue-counts">
            <span className="count-chip new">{counts.fresh} new</span>
            <span className="count-chip learn">{counts.learning} review</span>
            <span className="count-chip done">{reviewed} done</span>
          </div>

          <div className="card flashcard" onClick={() => !revealed && setRevealed(true)}>
            <span className="flashcard-hint">
              {front === 'armenian' ? 'Armenian' : 'English'}
            </span>

            <p className="flashcard-front">
              {front === 'armenian' ? current.armenian : current.english}
            </p>

            {front === 'armenian' && (
              <button
                className="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  audio.play(current.armenian)
                }}
                disabled={audio.playing}
              >
                {audio.playing ? <span className="spinner dark" /> : '🔊'} Listen
              </button>
            )}

            {revealed ? (
              <div className="flashcard-back">
                <p className="flashcard-answer">
                  {front === 'armenian' ? current.english : current.armenian}
                </p>
                {current.transliteration && (
                  <p className="transliteration">{current.transliteration}</p>
                )}
                {current.notes && <p className="notes">{current.notes}</p>}
                {front === 'english' && (
                  <button
                    className="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      audio.play(current.armenian)
                    }}
                    disabled={audio.playing}
                  >
                    {audio.playing ? <span className="spinner dark" /> : '🔊'} Listen
                  </button>
                )}
              </div>
            ) : (
              <p className="reveal-prompt">Tap to reveal</p>
            )}
          </div>

          {revealed && (
            <div className="grade-row">
              {GRADES.map(({ grade, label, className }) => (
                <button key={grade} className={`grade-btn ${className}`} onClick={() => handleGrade(grade)}>
                  <span className="grade-label">{label}</span>
                  <span className="grade-interval">{intervalPreview(current, grade)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

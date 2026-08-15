import { useMemo, useState } from 'react'
import type { Card, Deck } from '../lib/types'
import { isNew } from '../lib/srs'
import { useAudio } from '../lib/useAudio'
import type { NewCardFields } from './TranslateView'

type Props = {
  accessCode: string | null
  cards: Card[]
  decks: Deck[]
  onAddCards: (cards: NewCardFields[], deckId: string) => void
  onDeleteCard: (id: string) => void
  onMoveCard: (id: string, deckId: string) => void
  onCreateDeck: (name: string) => string
  onDeleteDeck: (id: string) => void
}

function dueLabel(card: Card): string {
  if (isNew(card)) return 'New'
  const diff = card.due - Date.now()
  if (diff <= 0) return 'Due now'
  const days = Math.round(diff / (24 * 60 * 60 * 1000))
  if (days >= 1) return `in ${days}d`
  const hours = Math.round(diff / (60 * 60 * 1000))
  if (hours >= 1) return `in ${hours}h`
  return `in ${Math.max(1, Math.round(diff / 60000))}m`
}

export default function LibraryView({
  accessCode,
  cards,
  decks,
  onAddCards,
  onDeleteCard,
  onMoveCard,
  onCreateDeck,
  onDeleteDeck,
}: Props) {
  const [query, setQuery] = useState('')
  const [deckId, setDeckId] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [draft, setDraft] = useState<NewCardFields & { deckId: string }>({
    armenian: '',
    english: '',
    transliteration: '',
    notes: '',
    deckId: decks[0]?.id ?? '',
  })

  const audio = useAudio(accessCode)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cards
      .filter((c) => (deckId === 'all' ? true : c.deckId === deckId))
      .filter((c) =>
        !q
          ? true
          : c.armenian.toLowerCase().includes(q) ||
            c.english.toLowerCase().includes(q) ||
            c.transliteration.toLowerCase().includes(q)
      )
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [cards, deckId, query])

  function handleAdd() {
    if (!draft.armenian.trim() || !draft.english.trim()) return
    const target = draft.deckId || decks[0]?.id
    if (!target) return
    onAddCards(
      [
        {
          armenian: draft.armenian.trim(),
          english: draft.english.trim(),
          transliteration: draft.transliteration.trim(),
          notes: draft.notes.trim(),
        },
      ],
      target
    )
    setDraft({ armenian: '', english: '', transliteration: '', notes: '', deckId: target })
    setShowAdd(false)
  }

  function handleCreateDeck() {
    const name = newDeckName.trim()
    if (!name) return
    const id = onCreateDeck(name)
    setNewDeckName('')
    setDeckId(id)
  }

  const activeDeck = decks.find((d) => d.id === deckId)

  return (
    <>
      <div className="study-toolbar">
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search phrases…"
        />
        <select value={deckId} onChange={(e) => setDeckId(e.target.value)} className="deck-select">
          <option value="all">All decks ({cards.length})</option>
          {decks.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deck.name} ({cards.filter((c) => c.deckId === deck.id).length})
            </option>
          ))}
        </select>
      </div>

      <div className="library-actions">
        <button className="ghost" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? 'Cancel' : '＋ Add card'}
        </button>
        <div className="new-deck">
          <input
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateDeck()}
            placeholder="New deck name…"
          />
          <button className="ghost" onClick={handleCreateDeck} disabled={!newDeckName.trim()}>
            Create
          </button>
        </div>
        {activeDeck && !activeDeck.builtin && (
          <button
            className="link danger"
            onClick={() => {
              onDeleteDeck(activeDeck.id)
              setDeckId('all')
            }}
          >
            Delete “{activeDeck.name}”
          </button>
        )}
      </div>

      {audio.error && <div className="error-banner">{audio.error}</div>}

      {showAdd && (
        <div className="card add-card-form">
          <label className="field">
            <span>Armenian</span>
            <input
              value={draft.armenian}
              onChange={(e) => setDraft({ ...draft, armenian: e.target.value })}
              placeholder="Բարև"
            />
          </label>
          <label className="field">
            <span>English</span>
            <input
              value={draft.english}
              onChange={(e) => setDraft({ ...draft, english: e.target.value })}
              placeholder="Hello"
            />
          </label>
          <label className="field">
            <span>Transliteration</span>
            <input
              value={draft.transliteration}
              onChange={(e) => setDraft({ ...draft, transliteration: e.target.value })}
              placeholder="Barev"
            />
          </label>
          <label className="field">
            <span>Deck</span>
            <select value={draft.deckId} onChange={(e) => setDraft({ ...draft, deckId: e.target.value })}>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            onClick={handleAdd}
            disabled={!draft.armenian.trim() || !draft.english.trim()}
          >
            Add card
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card empty-state">
          <h2>Nothing here yet</h2>
          <p>
            {query
              ? 'No phrases match that search.'
              : 'Save phrases from the Translate tab, or add a card manually above.'}
          </p>
        </div>
      ) : (
        <ul className="library-list">
          {filtered.map((card) => (
            <li key={card.id} className="library-item">
              <div className="library-main">
                <span className="library-arm">{card.armenian}</span>
                <span className="library-en">{card.english}</span>
                {card.transliteration && <span className="library-translit">{card.transliteration}</span>}
              </div>
              <div className="library-side">
                <span className={`due-chip ${isNew(card) ? 'new' : card.due <= Date.now() ? 'due' : ''}`}>
                  {dueLabel(card)}
                </span>
                <div className="library-buttons">
                  <button className="icon-btn" onClick={() => audio.play(card.armenian)} title="Play">
                    🔊
                  </button>
                  <select
                    className="move-select"
                    value={card.deckId}
                    onChange={(e) => onMoveCard(card.id, e.target.value)}
                    title="Move to deck"
                  >
                    {decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {deck.name}
                      </option>
                    ))}
                  </select>
                  <button className="icon-btn danger" onClick={() => onDeleteCard(card.id)} title="Delete">
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

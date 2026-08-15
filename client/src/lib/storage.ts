import type { Card, Deck, Stats } from './types'
import { newCard } from './srs'
import { STARTER_DECKS } from '../data/starterDecks'

const DECKS_KEY = 'asa.decks.v1'
const CARDS_KEY = 'asa.cards.v1'
const STATS_KEY = 'asa.stats.v1'
const SEEDED_KEY = 'asa.seeded.v1'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage disabled — non-fatal, the session keeps working.
  }
}

export function loadDecks(): Deck[] {
  return read<Deck[]>(DECKS_KEY, [])
}

export function saveDecks(decks: Deck[]): void {
  write(DECKS_KEY, decks)
}

export function loadCards(): Card[] {
  return read<Card[]>(CARDS_KEY, [])
}

export function saveCards(cards: Card[]): void {
  write(CARDS_KEY, cards)
}

export function loadStats(): Stats {
  return read<Stats>(STATS_KEY, { byDay: {} })
}

export function saveStats(stats: Stats): void {
  write(STATS_KEY, stats)
}

export function todayKey(now: number = Date.now()): string {
  const d = new Date(now)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export function recordReview(stats: Stats, correct: boolean, now: number = Date.now()): Stats {
  const key = todayKey(now)
  const day = stats.byDay[key] ?? { reviews: 0, correct: 0 }
  return {
    byDay: {
      ...stats.byDay,
      [key]: { reviews: day.reviews + 1, correct: day.correct + (correct ? 1 : 0) },
    },
  }
}

/** Consecutive days (ending today or yesterday) with at least one review. */
export function currentStreak(stats: Stats, now: number = Date.now()): number {
  let streak = 0
  const cursor = new Date(now)

  // Allow the streak to still count if today hasn't been studied yet.
  if (!stats.byDay[todayKey(cursor.getTime())]) {
    cursor.setDate(cursor.getDate() - 1)
  }

  for (;;) {
    const key = todayKey(cursor.getTime())
    if (!stats.byDay[key] || stats.byDay[key].reviews === 0) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

/**
 * Seeds built-in decks the first time the app runs. Returns the full deck and
 * card set so callers can hydrate state in one pass.
 */
export function ensureSeeded(): { decks: Deck[]; cards: Card[] } {
  const alreadySeeded = localStorage.getItem(SEEDED_KEY) === 'true'
  let decks = loadDecks()
  let cards = loadCards()

  if (!alreadySeeded) {
    const seededDecks: Deck[] = STARTER_DECKS.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      builtin: true,
    }))

    const seededCards: Card[] = STARTER_DECKS.flatMap((deck) =>
      deck.cards.map((c) =>
        newCard({
          deckId: deck.id,
          armenian: c.armenian,
          english: c.english,
          transliteration: c.transliteration,
          notes: c.notes ?? '',
        })
      )
    )

    const existingDeckIds = new Set(decks.map((d) => d.id))
    decks = [...decks, ...seededDecks.filter((d) => !existingDeckIds.has(d.id))]
    cards = [...cards, ...seededCards]

    saveDecks(decks)
    saveCards(cards)
    localStorage.setItem(SEEDED_KEY, 'true')
  }

  // Always guarantee a destination for user-saved phrases.
  if (!decks.some((d) => d.id === MY_PHRASES_DECK_ID)) {
    decks = [
      { id: MY_PHRASES_DECK_ID, name: 'My Phrases', description: 'Phrases you saved from translations.', builtin: false },
      ...decks,
    ]
    saveDecks(decks)
  }

  return { decks, cards }
}

export const MY_PHRASES_DECK_ID = 'my-phrases'

export type TranslateResult = {
  translated: string
  transliteration: string
  notes: string
}

export type Deck = {
  id: string
  name: string
  description: string
  builtin: boolean
}

export type Card = {
  id: string
  deckId: string
  armenian: string
  english: string
  transliteration: string
  notes: string
  createdAt: number
  /** Bumped on every edit or review; used to resolve local/remote sync conflicts. */
  updatedAt: number
  /** Days until next review once graduated. */
  interval: number
  repetitions: number
  easeFactor: number
  /** Timestamp the card is next due. */
  due: number
  lapses: number
  /** Index into the learning steps; -1 once graduated to long-term review. */
  learningStep: number
}

export type DayStats = {
  reviews: number
  correct: number
}

export type Stats = {
  /** Keyed by local YYYY-MM-DD. */
  byDay: Record<string, DayStats>
}

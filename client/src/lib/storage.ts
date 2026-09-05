import { LANG_CODES, type Card, type Deck, type LangCode, type Stats } from './types'
import { newCard } from './srs'
import { migrateCard, migrateDeck } from './sync'
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
  return read<Deck[]>(DECKS_KEY, []).map(migrateDeck)
}

export function saveDecks(decks: Deck[]): void {
  write(DECKS_KEY, decks)
}

export function loadCards(): Card[] {
  // Cards saved before multi-language/sync existed are missing lang/target/
  // native/updatedAt; migrateCard backfills all of that from the legacy shape.
  return read<Card[]>(CARDS_KEY, []).map(migrateCard)
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
 * The "My Phrases" deck keeps its original unqualified id for Armenian so
 * existing users' saved phrases need no id migration; new languages get their
 * own deck via a `-${lang}` suffix.
 */
export function myPhrasesDeckId(lang: LangCode): string {
  return lang === 'hy' ? 'my-phrases' : `my-phrases-${lang}`
}

/**
 * Which languages' starter decks have already been seeded on this device.
 * Tracked per-language (not a single flag) so that an existing install whose
 * lone "true" predates multi-language support still gets es/fr/ru seeded
 * retroactively, without ever re-seeding (or duplicating) Armenian's.
 */
function loadSeededLangs(): Set<LangCode> {
  const raw = localStorage.getItem(SEEDED_KEY)
  if (raw === 'true') return new Set<LangCode>(['hy'])
  if (!raw) return new Set()
  try {
    const parsed = JSON.parse(raw) as string[]
    return new Set(parsed.filter((l): l is LangCode => (LANG_CODES as string[]).includes(l)))
  } catch {
    return new Set()
  }
}

function saveSeededLangs(langs: Set<LangCode>): void {
  localStorage.setItem(SEEDED_KEY, JSON.stringify([...langs]))
}

/**
 * Seeds built-in decks the first time each learning language is encountered
 * on this device. Unused decks for a language a user never picks are just
 * inert data, so a fresh install seeds all 4 languages at once; an existing
 * install only backfills whichever languages it's missing. Returns the full
 * deck and card set so callers can hydrate state in one pass.
 */
export function ensureSeeded(): { decks: Deck[]; cards: Card[] } {
  const seededLangs = loadSeededLangs()
  let decks = loadDecks()
  let cards = loadCards()

  const toSeed = LANG_CODES.filter((lang) => !seededLangs.has(lang))
  if (toSeed.length > 0) {
    const seededDecks: Deck[] = toSeed.flatMap((lang) =>
      STARTER_DECKS[lang].map((d) => ({
        id: d.id,
        lang,
        name: d.name,
        description: d.description,
        builtin: true,
      }))
    )

    const seededCards: Card[] = toSeed.flatMap((lang) =>
      STARTER_DECKS[lang].flatMap((deck) =>
        deck.cards.map((c) =>
          newCard({
            deckId: deck.id,
            lang,
            target: c.target,
            native: c.native,
            transliteration: c.transliteration,
            notes: c.notes ?? '',
          })
        )
      )
    )

    const existingDeckIds = new Set(decks.map((d) => d.id))
    decks = [...decks, ...seededDecks.filter((d) => !existingDeckIds.has(d.id))]
    cards = [...cards, ...seededCards]

    saveDecks(decks)
    saveCards(cards)
    saveSeededLangs(new Set([...seededLangs, ...toSeed]))
  }

  // Always guarantee a "My Phrases" destination per language.
  const missingPhraseDecks = LANG_CODES.filter(
    (lang) => !decks.some((d) => d.id === myPhrasesDeckId(lang))
  ).map(
    (lang): Deck => ({
      id: myPhrasesDeckId(lang),
      lang,
      name: 'My Phrases',
      description: 'Phrases you saved from translations.',
      builtin: false,
    })
  )
  if (missingPhraseDecks.length > 0) {
    decks = [...missingPhraseDecks, ...decks]
    saveDecks(decks)
  }

  return { decks, cards }
}

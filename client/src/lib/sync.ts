import type { Card, Deck, Stats } from './types'

export type SyncPayload = {
  cards: Card[]
  decks: Deck[]
  stats: Stats
}

/**
 * Pre-multi-language records only ever had `armenian`/`english` and no `lang`.
 * Every card/deck is normalized to the current shape at read time (never at
 * write time) so this stays idempotent and safe even after a rollback.
 */
export function migrateCard(card: Card & { armenian?: string; english?: string }): Card {
  return {
    ...card,
    lang: card.lang ?? 'hy',
    target: card.target ?? card.armenian ?? '',
    native: card.native ?? card.english ?? '',
    updatedAt: card.updatedAt ?? card.createdAt ?? 0,
  }
}

export function migrateDeck(deck: Deck): Deck {
  return { ...deck, lang: deck.lang ?? 'hy' }
}

export function migratePayload(payload: SyncPayload): SyncPayload {
  return {
    cards: payload.cards.map(migrateCard),
    decks: payload.decks.map(migrateDeck),
    stats: payload.stats,
  }
}

/**
 * Union by id, keeping whichever copy was touched most recently. Cards are the
 * only records that carry meaningful per-field state (scheduling), so this is
 * where conflict resolution actually matters.
 */
export function mergeCards(local: Card[], remote: Card[]): Card[] {
  const byId = new Map<string, Card>()
  for (const card of remote) byId.set(card.id, card)
  for (const card of local) {
    const existing = byId.get(card.id)
    if (!existing || card.updatedAt >= existing.updatedAt) byId.set(card.id, card)
  }
  return [...byId.values()]
}

/** Union by id; a deck is just a label, so the local name wins on collision. */
export function mergeDecks(local: Deck[], remote: Deck[]): Deck[] {
  const byId = new Map<string, Deck>()
  for (const deck of remote) byId.set(deck.id, deck)
  for (const deck of local) byId.set(deck.id, deck)
  return [...byId.values()]
}

/**
 * Per-day maximum rather than a sum: a device that syncs twice would otherwise
 * double-count the same study session.
 */
export function mergeStats(local: Stats, remote: Stats): Stats {
  const byDay: Stats['byDay'] = { ...remote.byDay }
  for (const [day, localDay] of Object.entries(local.byDay)) {
    const remoteDay = byDay[day]
    byDay[day] = remoteDay
      ? {
          reviews: Math.max(localDay.reviews, remoteDay.reviews),
          correct: Math.max(localDay.correct, remoteDay.correct),
        }
      : localDay
  }
  return { byDay }
}

export function mergePayload(local: SyncPayload, remote: SyncPayload): SyncPayload {
  return {
    cards: mergeCards(local.cards, remote.cards),
    decks: mergeDecks(local.decks, remote.decks),
    stats: mergeStats(local.stats, remote.stats),
  }
}

/** Structural check so a corrupt or foreign file can't be imported blindly. */
export function isValidPayload(value: unknown): value is SyncPayload {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<SyncPayload>
  return (
    Array.isArray(p.cards) &&
    Array.isArray(p.decks) &&
    !!p.stats &&
    typeof p.stats === 'object' &&
    typeof (p.stats as Stats).byDay === 'object'
  )
}

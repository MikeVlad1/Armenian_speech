import type { Card, Deck } from './types'

/** Free users can create this many custom decks per language; Pro is unlimited. */
export const FREE_CUSTOM_DECK_LIMIT = 2

/**
 * Custom decks a user has made in the current language — excludes the
 * always-present "My Phrases" deck, since that's provisioned automatically,
 * not something the user chose to create.
 */
export function customDeckCount(decks: Deck[], myPhrasesId: string): number {
  return decks.filter((d) => !d.builtin && d.id !== myPhrasesId).length
}

export function isBuiltinDeck(deckId: string, decks: Deck[]): boolean {
  return decks.find((d) => d.id === deckId)?.builtin ?? false
}

/**
 * Speak (TTS) and Record (pronunciation-check STT) cost real money per call,
 * and built-in deck content is bounded while user-authored cards are not —
 * so free accounts get audio only on built-in decks; Pro unlocks it
 * everywhere, including "My Phrases" and any deck the user created.
 */
export function canUseAudio(card: Card, decks: Deck[], isPro: boolean): boolean {
  return isPro || isBuiltinDeck(card.deckId, decks)
}

export const PRO_BENEFITS: string[] = [
  'Unlimited translations every day (free: 15/day)',
  'Unlimited pronunciation playback & speech checks (free: 30 listens, 20 recordings/day)',
  'Speak & practice pronunciation on your own custom cards, not just built-in decks',
  'Unlimited custom decks per language (free: 2)',
  "15% of your subscription supports Armath's STEM education programs in Armenia",
]

import type { Card } from './types'

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Picks `count` unique wrong answers for a multiple-choice-style question.
 * Prefers distractors from the same deck/pool; falls back to the full card
 * collection so small decks still produce enough plausible options.
 */
export function pickDistractors(
  pool: Card[],
  allCards: Card[],
  excludeId: string,
  valueOf: (c: Card) => string,
  answer: string,
  count: number
): string[] {
  const sameDeck = pool.filter((c) => c.id !== excludeId && valueOf(c) !== answer)
  const fallback = allCards.filter((c) => c.id !== excludeId && valueOf(c) !== answer)
  const distractorSource = sameDeck.length >= count ? sameDeck : fallback

  const distractors: string[] = []
  for (const candidate of shuffle(distractorSource)) {
    const value = valueOf(candidate)
    if (!distractors.includes(value)) distractors.push(value)
    if (distractors.length === count) break
  }
  return distractors
}

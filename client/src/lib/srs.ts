import type { Card } from './types'

export type Grade = 'again' | 'hard' | 'good' | 'easy'

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

/** Anki-style learning steps, in minutes, before a card graduates. */
const LEARNING_STEPS = [1, 10]
const GRADUATING_INTERVAL = 1 // days
const EASY_INTERVAL = 4 // days
const MIN_EASE = 1.3
const MAX_INTERVAL = 365 // days

export function newCard(
  fields: Pick<Card, 'deckId' | 'armenian' | 'english' | 'transliteration' | 'notes'>
): Card {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    interval: 0,
    repetitions: 0,
    easeFactor: 2.5,
    due: Date.now(),
    lapses: 0,
    learningStep: 0,
    ...fields,
  }
}

function clampEase(ease: number): number {
  return Math.max(MIN_EASE, ease)
}

function clampInterval(days: number): number {
  return Math.min(MAX_INTERVAL, Math.max(1, Math.round(days)))
}

/**
 * SM-2 with Anki-style learning steps. Cards start in a short-interval
 * learning phase, then graduate to exponentially growing intervals scaled
 * by an ease factor that rises on easy answers and falls on hard ones.
 */
export function schedule(card: Card, grade: Grade, now: number = Date.now()): Card {
  const next: Card = { ...card, updatedAt: now }
  const isLearning = card.learningStep >= 0

  if (isLearning) {
    switch (grade) {
      case 'again':
        next.learningStep = 0
        next.due = now + LEARNING_STEPS[0] * MINUTE
        break
      case 'hard':
        next.due = now + LEARNING_STEPS[Math.min(card.learningStep, LEARNING_STEPS.length - 1)] * MINUTE
        break
      case 'good': {
        const step = card.learningStep + 1
        if (step >= LEARNING_STEPS.length) {
          next.learningStep = -1
          next.interval = GRADUATING_INTERVAL
          next.repetitions = 1
          next.due = now + GRADUATING_INTERVAL * DAY
        } else {
          next.learningStep = step
          next.due = now + LEARNING_STEPS[step] * MINUTE
        }
        break
      }
      case 'easy':
        next.learningStep = -1
        next.interval = EASY_INTERVAL
        next.repetitions = 1
        next.due = now + EASY_INTERVAL * DAY
        break
    }
    return next
  }

  // Graduated card — standard SM-2 style progression.
  switch (grade) {
    case 'again':
      next.lapses = card.lapses + 1
      next.repetitions = 0
      next.easeFactor = clampEase(card.easeFactor - 0.2)
      next.learningStep = 0
      next.interval = 0
      next.due = now + LEARNING_STEPS[0] * MINUTE
      break
    case 'hard':
      next.easeFactor = clampEase(card.easeFactor - 0.15)
      next.interval = clampInterval(Math.max(card.interval, 1) * 1.2)
      next.repetitions = card.repetitions + 1
      next.due = now + next.interval * DAY
      break
    case 'good':
      next.interval = clampInterval(Math.max(card.interval, 1) * card.easeFactor)
      next.repetitions = card.repetitions + 1
      next.due = now + next.interval * DAY
      break
    case 'easy':
      next.easeFactor = clampEase(card.easeFactor + 0.15)
      next.interval = clampInterval(Math.max(card.interval, 1) * next.easeFactor * 1.3)
      next.repetitions = card.repetitions + 1
      next.due = now + next.interval * DAY
      break
  }

  return next
}

/** Human-readable preview of when each grade would schedule the card. */
export function intervalPreview(card: Card, grade: Grade, now: number = Date.now()): string {
  const scheduled = schedule(card, grade, now)
  const deltaMs = scheduled.due - now
  const minutes = Math.round(deltaMs / MINUTE)
  if (minutes < 60) return `${Math.max(1, minutes)}m`
  const hours = Math.round(deltaMs / (60 * MINUTE))
  if (hours < 24) return `${hours}h`
  const days = Math.round(deltaMs / DAY)
  if (days < 30) return `${days}d`
  return `${Math.round(days / 30)}mo`
}

export function isDue(card: Card, now: number = Date.now()): boolean {
  return card.due <= now
}

export function dueCards(cards: Card[], now: number = Date.now()): Card[] {
  return cards.filter((c) => isDue(c, now)).sort((a, b) => a.due - b.due)
}

export function isNew(card: Card): boolean {
  return card.repetitions === 0 && card.learningStep === 0 && card.lapses === 0
}

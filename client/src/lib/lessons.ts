import type { Card, Deck } from './types'
import { canUseAudio } from './plan'
import { pickDistractors, shuffle } from './quiz'

export type ExerciseType = 'word-order' | 'multiple-choice' | 'fill-blank' | 'listen-select'

export type WordOrderExercise = {
  type: 'word-order'
  card: Card
  tiles: string[]
  answerTokens: string[]
}

export type FillBlankExercise = {
  type: 'fill-blank'
  card: Card
  tokens: string[]
  blankIndex: number
  answer: string
}

export type MultipleChoiceExercise = {
  type: 'multiple-choice'
  card: Card
  direction: 'target-native' | 'native-target'
  prompt: string
  options: string[]
  answer: string
}

export type ListenSelectExercise = {
  type: 'listen-select'
  card: Card
  options: string[]
  answer: string
}

export type Exercise = WordOrderExercise | FillBlankExercise | MultipleChoiceExercise | ListenSelectExercise

const LESSON_LENGTH = 8
const OPTION_COUNT = 4
/** Below this many phrase-shaped cards, word-order/fill-blank are skipped rather than starved for variety. */
const MIN_PHRASE_CARDS = 3
/** Same floor QuizView uses — below this there aren't enough cards for plausible multiple-choice options. */
export const MIN_CARDS_FOR_LESSON = OPTION_COUNT

export function tokenize(target: string): string[] {
  return target.trim().split(/\s+/).filter(Boolean)
}

export function isPhraseCard(card: Card): boolean {
  return tokenize(card.target).length >= 2
}

function buildWordOrder(card: Card): WordOrderExercise {
  const answerTokens = tokenize(card.target)
  let tiles = shuffle(answerTokens)
  // A shuffle can land back on the original order — reshuffle once so the
  // exercise isn't accidentally already solved.
  if (answerTokens.length > 1 && tiles.join(' ') === answerTokens.join(' ')) {
    tiles = shuffle(answerTokens)
  }
  return { type: 'word-order', card, tiles, answerTokens }
}

function buildFillBlank(card: Card): FillBlankExercise {
  const tokens = tokenize(card.target)
  // Prefer blanking a real word over a stray single character.
  const eligible = tokens.map((_, i) => i).filter((i) => tokens[i].length > 1)
  const candidates = eligible.length > 0 ? eligible : tokens.map((_, i) => i)
  const blankIndex = candidates[Math.floor(Math.random() * candidates.length)]
  return { type: 'fill-blank', card, tokens, blankIndex, answer: tokens[blankIndex] }
}

function buildMultipleChoice(card: Card, cards: Card[]): MultipleChoiceExercise {
  const direction: 'target-native' | 'native-target' = Math.random() < 0.5 ? 'target-native' : 'native-target'
  const valueOf = (c: Card) => (direction === 'target-native' ? c.native : c.target)
  const answer = valueOf(card)
  const prompt = direction === 'target-native' ? card.target : card.native
  const distractors = pickDistractors(cards, cards, card.id, valueOf, answer, OPTION_COUNT - 1)
  return { type: 'multiple-choice', card, direction, prompt, options: shuffle([answer, ...distractors]), answer }
}

function buildListenSelect(card: Card, cards: Card[]): ListenSelectExercise {
  const valueOf = (c: Card) => c.target
  const answer = card.target
  const distractors = pickDistractors(cards, cards, card.id, valueOf, answer, OPTION_COUNT - 1)
  return { type: 'listen-select', card, options: shuffle([answer, ...distractors]), answer }
}

/**
 * Builds a lesson session by picking a random applicable exercise type per
 * card, rather than one fixed type for the whole session — a Numbers-only
 * pool still produces a full lesson, it just leans on multiple-choice/
 * listen-select since word-order/fill-blank need multi-word phrases.
 * `decks`/`isPro` decide per-card whether listen-select's audio is allowed
 * (the same custom-content Pro gate Flashcards/Practice already use) — a
 * card that fails that check just never offers listen-select, no lock
 * screen, so Lessons itself never shows a paywall.
 */
export function buildLessonSession(
  cards: Card[],
  decks: Deck[],
  isPro: boolean,
  length: number = LESSON_LENGTH
): Exercise[] {
  const phraseCount = cards.filter(isPhraseCard).length
  const canUsePhraseTypes = phraseCount >= MIN_PHRASE_CARDS

  return shuffle(cards)
    .slice(0, length)
    .map((card) => {
      const availableTypes: ExerciseType[] = ['multiple-choice']
      if (canUsePhraseTypes && isPhraseCard(card)) availableTypes.push('word-order', 'fill-blank')
      if (canUseAudio(card, decks, isPro)) availableTypes.push('listen-select')

      const type = availableTypes[Math.floor(Math.random() * availableTypes.length)]
      switch (type) {
        case 'word-order':
          return buildWordOrder(card)
        case 'fill-blank':
          return buildFillBlank(card)
        case 'listen-select':
          return buildListenSelect(card, cards)
        default:
          return buildMultipleChoice(card, cards)
      }
    })
}

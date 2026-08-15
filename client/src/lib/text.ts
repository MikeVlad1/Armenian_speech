/**
 * Armenian intonation marks sit *inside* a word, above its stressed vowel —
 * ինչպե՞ս is one word, not two. They must be deleted outright; replacing them
 * with a space would split the word and wreck both scoring and word diffing.
 */
const INTRA_WORD_MARKS = /[՞՜՛՚]/g

/** Marks that genuinely separate words or sentences. */
const SEPARATORS = /[։՝֊«»""''.,!?;:()[\]{}\-–—…]/g

/**
 * Armenian ligatures are single codepoints that stand for two letters. A phrase
 * can legitimately be written either way — and speech recognition returns the
 * ligature form — so both must compare as equal.
 */
const LIGATURES: [RegExp, string][] = [
  [/և/g, 'եւ'],
  [/ﬓ/g, 'մն'],
  [/ﬔ/g, 'մե'],
  [/ﬕ/g, 'մի'],
  [/ﬖ/g, 'վն'],
  [/ﬗ/g, 'մխ'],
]

function expandLigatures(text: string): string {
  return LIGATURES.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text)
}

export function normalize(text: string): string {
  return expandLigatures(text.toLowerCase())
    .replace(INTRA_WORD_MARKS, '')
    .replace(SEPARATORS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }

  return prev[b.length]
}

/** 0–100 character-level similarity between two phrases, punctuation-insensitive. */
export function similarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na && !nb) return 100
  if (!na || !nb) return 0
  const maxLen = Math.max(na.length, nb.length)
  return Math.round((1 - levenshtein(na, nb) / maxLen) * 100)
}

export type WordComparison = {
  word: string
  correct: boolean
}

/**
 * Word-by-word comparison so the UI can highlight exactly which words were
 * missed. Each target word counts as correct if a reasonably close match
 * appears anywhere in the attempt (order-tolerant, since ASR word order can
 * wobble on short utterances).
 */
export function compareWords(target: string, attempt: string): WordComparison[] {
  const targetWords = normalize(target).split(' ').filter(Boolean)
  const attemptWords = normalize(attempt).split(' ').filter(Boolean)
  const remaining = [...attemptWords]

  return targetWords.map((word) => {
    const idx = remaining.findIndex((candidate) => {
      if (candidate === word) return true
      const maxLen = Math.max(word.length, candidate.length)
      return maxLen > 2 && levenshtein(word, candidate) / maxLen <= 0.34
    })
    if (idx !== -1) {
      remaining.splice(idx, 1)
      return { word, correct: true }
    }
    return { word, correct: false }
  })
}

export function scoreLabel(score: number): { label: string; tone: 'great' | 'ok' | 'poor' } {
  if (score >= 85) return { label: 'Excellent', tone: 'great' }
  if (score >= 65) return { label: 'Close', tone: 'ok' }
  return { label: 'Keep practicing', tone: 'poor' }
}

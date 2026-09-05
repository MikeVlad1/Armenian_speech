import type { LangCode } from '../lib/types'

export type KeyboardLayout = {
  lower: string[]
  upper: string[]
  marks: string[]
}

/** The 38 letters of the Armenian alphabet, plus the և ligature. */
const HY_LOWER = [
  'ա', 'բ', 'գ', 'դ', 'ե', 'զ', 'է', 'ը', 'թ', 'ժ',
  'ի', 'լ', 'խ', 'ծ', 'կ', 'հ', 'ձ', 'ղ', 'ճ', 'մ',
  'յ', 'ն', 'շ', 'ո', 'չ', 'պ', 'ջ', 'ռ', 'ս', 'վ',
  'տ', 'ր', 'ց', 'ւ', 'փ', 'ք', 'օ', 'ֆ', 'և',
]

const HY_UPPER = [
  'Ա', 'Բ', 'Գ', 'Դ', 'Ե', 'Զ', 'Է', 'Ը', 'Թ', 'Ժ',
  'Ի', 'Լ', 'Խ', 'Ծ', 'Կ', 'Հ', 'Ձ', 'Ղ', 'Ճ', 'Մ',
  'Յ', 'Ն', 'Շ', 'Ո', 'Չ', 'Պ', 'Ջ', 'Ռ', 'Ս', 'Վ',
  'Տ', 'Ր', 'Ց', 'Ւ', 'Փ', 'Ք', 'Օ', 'Ֆ', 'Եւ',
]

/** Marks a learner can't easily reach: full stop, question, exclamation, emphasis, comma. */
const HY_MARKS = ['։', '՞', '՜', '՛', '՝', ',']

/** The 33 letters of the modern Russian (Cyrillic) alphabet. */
const RU_LOWER = [
  'а', 'б', 'в', 'г', 'д', 'е', 'ё', 'ж', 'з', 'и',
  'й', 'к', 'л', 'м', 'н', 'о', 'п', 'р', 'с', 'т',
  'у', 'ф', 'х', 'ц', 'ч', 'ш', 'щ', 'ъ', 'ы', 'ь',
  'э', 'ю', 'я',
]

const RU_UPPER = [
  'А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ё', 'Ж', 'З', 'И',
  'Й', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т',
  'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ы', 'Ь',
  'Э', 'Ю', 'Я',
]

const RU_MARKS = ['.', ',', '!', '?', '-']

export const KEYBOARDS: Partial<Record<LangCode, KeyboardLayout>> = {
  hy: { lower: HY_LOWER, upper: HY_UPPER, marks: HY_MARKS },
  ru: { lower: RU_LOWER, upper: RU_UPPER, marks: RU_MARKS },
}

import type { LangCode } from './types'

export const LANGUAGES: Record<LangCode, { name: string; placeholder: string; needsKeyboard: boolean }> = {
  hy: { name: 'Armenian', placeholder: 'Հայերեն գրիր այստեղ…', needsKeyboard: true },
  es: { name: 'Spanish', placeholder: 'Escribe una oración en español…', needsKeyboard: false },
  fr: { name: 'French', placeholder: 'Écrivez une phrase en français…', needsKeyboard: false },
  ru: { name: 'Russian', placeholder: 'Напишите предложение на русском…', needsKeyboard: true },
}

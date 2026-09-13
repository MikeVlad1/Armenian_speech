import type { LangCode } from './types'

type LanguageConfig = {
  name: string
  placeholder: string
  needsKeyboard: boolean
  /** Non-Latin-script languages get a fetched-after-the-fact pronunciation aid. */
  needsTransliteration: boolean
  /**
   * The informal imperative "say!" in this language - what the ASA wordmark
   * itself is named after (Ասա, "say" in Armenian). `latin` drives the big
   * header wordmark so it stays a consistent Latin-alphabet brand mark across
   * scripts; `native` is shown alongside it in the language's own script.
   */
  sayWord: { latin: string; native: string }
}

export const LANGUAGES: Record<LangCode, LanguageConfig> = {
  hy: {
    name: 'Armenian',
    placeholder: 'Հայերեն գրիր այստեղ…',
    needsKeyboard: true,
    needsTransliteration: true,
    sayWord: { latin: 'ASA', native: 'Ասա' },
  },
  es: {
    name: 'Spanish',
    placeholder: 'Escribe una oración en español…',
    needsKeyboard: false,
    needsTransliteration: false,
    sayWord: { latin: 'DI', native: 'Di' },
  },
  fr: {
    name: 'French',
    placeholder: 'Écrivez une phrase en français…',
    needsKeyboard: false,
    needsTransliteration: false,
    sayWord: { latin: 'DIS', native: 'Dis' },
  },
  ru: {
    name: 'Russian',
    placeholder: 'Напишите предложение на русском…',
    needsKeyboard: true,
    needsTransliteration: true,
    sayWord: { latin: 'SKAZHI', native: 'Скажи' },
  },
  az: {
    name: 'Azerbaijani',
    placeholder: 'Azərbaycan dilində cümlə yazın…',
    needsKeyboard: false,
    needsTransliteration: false,
    sayWord: { latin: 'DE', native: 'De' },
  },
}

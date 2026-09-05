import { useEffect, useState } from 'react'
import { LANG_CODES, type LangCode } from './types'

const LANGUAGE_KEY = 'armenian-speaker-language'

function loadLanguage(): LangCode {
  const stored = localStorage.getItem(LANGUAGE_KEY)
  return (LANG_CODES as string[]).includes(stored ?? '') ? (stored as LangCode) : 'hy'
}

export function useActiveLanguage(): [LangCode, (lang: LangCode) => void] {
  const [lang, setLang] = useState<LangCode>(loadLanguage)

  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, lang)
  }, [lang])

  return [lang, setLang]
}

export type OtherLang = 'en' | 'es' | 'fr' | 'ru'

/**
 * Every pair always has Armenian on one side - the app teaches Armenian, it
 * isn't a general translator - so a direction is fully described by which
 * language is on the other side and which way the arrow points.
 */
export type Direction = `${OtherLang}-hy` | `hy-${OtherLang}`

export const OTHER_LANGS: OtherLang[] = ['en', 'es', 'fr', 'ru']

export const LANGUAGES: Record<OtherLang, { name: string; placeholder: string }> = {
  en: { name: 'English', placeholder: 'Type an English sentence…' },
  es: { name: 'Spanish', placeholder: 'Escribe una oración en español…' },
  fr: { name: 'French', placeholder: 'Écrivez une phrase en français…' },
  ru: { name: 'Russian', placeholder: 'Напишите предложение на русском…' },
}

const ARMENIAN_PLACEHOLDER = 'Հայերեն գրիր այստեղ…'

export function isToArmenian(direction: Direction): boolean {
  return direction.endsWith('-hy')
}

export function otherLangOf(direction: Direction): OtherLang {
  const code = isToArmenian(direction) ? direction.slice(0, -3) : direction.slice(3)
  return code as OtherLang
}

export function directionFor(otherLang: OtherLang, toArmenian: boolean): Direction {
  return (toArmenian ? `${otherLang}-hy` : `hy-${otherLang}`) as Direction
}

export function placeholderFor(direction: Direction): string {
  return isToArmenian(direction) ? LANGUAGES[otherLangOf(direction)].placeholder : ARMENIAN_PLACEHOLDER
}

/** Guards a value loaded from localStorage before it's trusted as a Direction. */
export function isValidDirection(value: unknown): value is Direction {
  if (typeof value !== 'string') return false
  const toArmenian = value.endsWith('-hy')
  const fromArmenian = value.startsWith('hy-')
  if (toArmenian === fromArmenian) return false // exactly one must hold, never both/neither
  const code = toArmenian ? value.slice(0, -3) : value.slice(3)
  return (OTHER_LANGS as string[]).includes(code)
}

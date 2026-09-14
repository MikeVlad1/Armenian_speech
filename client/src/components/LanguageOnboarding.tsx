import { useCallback, useEffect, useRef, useState } from 'react'
import { LANG_CODES, type LangCode } from '../lib/types'
import { LANGUAGES } from '../lib/languages'

type Props = {
  theme: 'light' | 'dark'
  leaving: boolean
  onSelect: (lang: LangCode) => void
}

const ITEM_HEIGHT = 72
const WHEEL_HEIGHT = ITEM_HEIGHT * 3
// Centers the first and last item in the wheel, so every language can reach
// the middle rather than being stuck flush against the top/bottom edge.
const PAD = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * A vertically-scrolling picker - Armenian first, one language per slot -
 * where the item nearest the center grows and the rest shrink with distance,
 * so it reads at a glance as "you're choosing one thing" rather than a list.
 */
export default function LanguageOnboarding({ theme, leaving, onSelect }: Props) {
  const [centerIndex, setCenterIndex] = useState(0)
  const wheelRef = useRef<HTMLDivElement>(null)
  const frame = useRef<number | null>(null)

  const readScroll = useCallback(() => {
    frame.current = null
    const el = wheelRef.current
    if (!el) return
    setCenterIndex(clamp(el.scrollTop / ITEM_HEIGHT, 0, LANG_CODES.length - 1))
  }, [])

  const onScroll = useCallback(() => {
    if (frame.current !== null) return
    frame.current = requestAnimationFrame(readScroll)
  }, [readScroll])

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
  }, [])

  function scrollToIndex(index: number) {
    wheelRef.current?.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' })
  }

  function onWheelKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      scrollToIndex(clamp(Math.round(centerIndex) + 1, 0, LANG_CODES.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      scrollToIndex(clamp(Math.round(centerIndex) - 1, 0, LANG_CODES.length - 1))
    }
  }

  const activeLang = LANG_CODES[clamp(Math.round(centerIndex), 0, LANG_CODES.length - 1)]

  const handleContinue = useCallback(() => {
    onSelect(activeLang)
  }, [onSelect, activeLang])

  // Previews the dark theme of whichever language is centered, live as the
  // user scrolls - a taste of each language's look before they've committed
  // to one. Switches back to the real theme (read from a prop, not
  // snapshotted from the DOM - on first mount the app's own theme effect
  // hasn't necessarily run yet, since child effects fire before the
  // parent's, so a DOM read then can catch "unset" instead of the real
  // value) as soon as `leaving` goes true, rather than waiting for unmount -
  // otherwise the fade-out would reveal the real app still tinted by this
  // preview for a moment before snapping to its actual theme. data-lang
  // doesn't need the same care: picking a language always calls onSelect,
  // which sets the real active language immediately.
  useEffect(() => {
    if (leaving) {
      document.documentElement.setAttribute('data-theme', theme)
      return
    }
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.setAttribute('data-lang', activeLang)
  }, [activeLang, leaving, theme])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleContinue()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handleContinue])

  return (
    <div
      className={`modal-backdrop onboarding-backdrop ${leaving ? 'leaving' : ''}`}
      role="presentation"
      onClick={handleContinue}
    >
      <div
        className="card modal onboarding-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a language to learn"
      >
        <h2 className="modal-title">What language are we learning today?</h2>
        <p className="modal-sub">Scroll or tap to pick one - you can always switch later.</p>

        <div
          className="lang-wheel"
          ref={wheelRef}
          onScroll={onScroll}
          onKeyDown={onWheelKeyDown}
          tabIndex={0}
          role="listbox"
          aria-activedescendant={`lang-wheel-${activeLang}`}
          style={{ height: WHEEL_HEIGHT }}
        >
          <div className="lang-wheel-pad" style={{ height: PAD }} aria-hidden="true" />
          {LANG_CODES.map((code, i) => {
            const distance = i - centerIndex
            const scale = clamp(1.28 - Math.abs(distance) * 0.28, 0.72, 1.28)
            const opacity = clamp(1 - Math.abs(distance) * 0.45, 0.3, 1)
            return (
              <button
                key={code}
                id={`lang-wheel-${code}`}
                type="button"
                role="option"
                aria-selected={code === activeLang}
                className={`lang-wheel-item ${code === activeLang ? 'active' : ''}`}
                style={{ height: ITEM_HEIGHT, transform: `scale(${scale})`, opacity }}
                onClick={() => scrollToIndex(i)}
              >
                {LANGUAGES[code].name}
              </button>
            )
          })}
          <div className="lang-wheel-pad" style={{ height: PAD }} aria-hidden="true" />
        </div>

        <button className="primary onboarding-continue" onClick={handleContinue}>
          Start learning {LANGUAGES[activeLang].name}
        </button>
      </div>
    </div>
  )
}

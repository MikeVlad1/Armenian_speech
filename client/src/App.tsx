import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import aprImg from './assets/apr.png'
import pomImg from './assets/pom.png'

import TranslateView, { type NewCardFields } from './components/TranslateView'
import LibraryView from './components/LibraryView'
import FlashcardsView from './components/FlashcardsView'
import QuizView from './components/QuizView'
import PracticeView from './components/PracticeView'
import AccountBar from './components/AccountBar'
import { useSync } from './lib/useSync'
import type { SyncPayload } from './lib/sync'

import type { Card, Deck, Stats } from './lib/types'
import { newCard, schedule, dueCards, type Grade } from './lib/srs'
import {
  ensureSeeded,
  loadStats,
  saveCards,
  saveDecks,
  saveStats,
  recordReview,
  currentStreak,
  todayKey,
} from './lib/storage'
import { API_BASE } from './lib/api'

const ACCESS_CODE_KEY = 'armenian-speaker-access-code'
const THEME_KEY = 'armenian-speaker-theme'

type Theme = 'light' | 'dark'
type Tab = 'translate' | 'library' | 'flashcards' | 'quiz' | 'practice'

/**
 * Single-task views that read better narrow and centred — a flashcard or quiz
 * question stretched across a wide screen is harder to scan, not easier.
 */
const FOCUS_TABS = new Set<Tab>(['flashcards', 'quiz', 'practice'])

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'translate', label: 'Translate', icon: '⇄' },
  { id: 'flashcards', label: 'Cards', icon: '🗂' },
  { id: 'practice', label: 'Practice', icon: '🎙' },
  { id: 'quiz', label: 'Quiz', icon: '✓' },
  { id: 'library', label: 'Library', icon: '📚' },
]

function loadTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function App() {
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [tab, setTab] = useState<Tab>('translate')

  const [accessCode, setAccessCode] = useState<string | null>(() => localStorage.getItem(ACCESS_CODE_KEY))
  const [isPro, setIsPro] = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [showRestore, setShowRestore] = useState(false)
  const [restoreEmail, setRestoreEmail] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [billingError, setBillingError] = useState('')

  const seed = useMemo(ensureSeeded, [])
  const [decks, setDecks] = useState<Deck[]>(seed.decks)
  const [cards, setCards] = useState<Card[]>(seed.cards)
  const [stats, setStats] = useState<Stats>(loadStats)

  useEffect(() => saveDecks(decks), [decks])
  useEffect(() => saveCards(cards), [cards])
  useEffect(() => saveStats(stats), [stats])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')

    async function finishCheckout(id: string) {
      try {
        const res = await fetch(`${API_BASE}/api/verify-session?session_id=${encodeURIComponent(id)}`)
        const data = await res.json()
        if (data.active && data.accessCode) {
          localStorage.setItem(ACCESS_CODE_KEY, data.accessCode)
          setAccessCode(data.accessCode)
          setIsPro(true)
        }
      } finally {
        window.history.replaceState({}, '', window.location.pathname)
      }
    }

    if (params.get('checkout') === 'success' && sessionId) {
      void finishCheckout(sessionId)
    } else if (params.get('checkout')) {
      window.history.replaceState({}, '', window.location.pathname)
    } else if (accessCode) {
      fetch(`${API_BASE}/api/check-access`, { headers: { 'x-access-code': accessCode } })
        .then((res) => res.json())
        .then((data) => {
          if (data.active) {
            setIsPro(true)
          } else {
            localStorage.removeItem(ACCESS_CODE_KEY)
            setAccessCode(null)
          }
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addCards = useCallback((fields: NewCardFields[], deckId: string) => {
    setCards((prev) => [...prev, ...fields.map((f) => newCard({ ...f, deckId }))])
  }, [])

  const deleteCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const moveCard = useCallback((id: string, deckId: string) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, deckId, updatedAt: Date.now() } : c)))
  }, [])

  const createDeck = useCallback((name: string): string => {
    const deck: Deck = { id: crypto.randomUUID(), name, description: '', builtin: false }
    setDecks((prev) => [...prev, deck])
    return deck.id
  }, [])

  const deleteDeck = useCallback((id: string) => {
    setDecks((prev) => prev.filter((d) => d.id !== id))
    setCards((prev) => prev.filter((c) => c.deckId !== id))
  }, [])

  const gradeCard = useCallback((card: Card, grade: Grade) => {
    setCards((prev) => prev.map((c) => (c.id === card.id ? schedule(c, grade) : c)))
    setStats((prev) => recordReview(prev, grade !== 'again'))
  }, [])

  const recordAnswer = useCallback((correct: boolean) => {
    setStats((prev) => recordReview(prev, correct))
  }, [])

  const syncData: SyncPayload = useMemo(() => ({ cards, decks, stats }), [cards, decks, stats])

  const applyPayload = useCallback((payload: SyncPayload) => {
    setCards(payload.cards)
    setDecks(payload.decks)
    setStats(payload.stats)
  }, [])

  const sync = useSync({ data: syncData, onMerged: applyPayload })

  async function handleUpgrade() {
    if (upgrading) return
    setUpgrading(true)
    setBillingError('')
    try {
      const res = await fetch(`${API_BASE}/api/create-checkout-session`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout')
      window.location.href = data.url
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Something went wrong')
      setUpgrading(false)
    }
  }

  async function handleRestoreAccess() {
    if (!restoreEmail.trim() || restoring) return
    setRestoring(true)
    setBillingError('')
    try {
      const res = await fetch(`${API_BASE}/api/restore-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: restoreEmail.trim() }),
      })
      const data = await res.json()
      if (data.active && data.accessCode) {
        localStorage.setItem(ACCESS_CODE_KEY, data.accessCode)
        setAccessCode(data.accessCode)
        setIsPro(true)
        setShowRestore(false)
      } else {
        setBillingError('No active subscription found for that email.')
      }
    } catch {
      setBillingError('Something went wrong restoring access.')
    } finally {
      setRestoring(false)
    }
  }

  const due = useMemo(() => dueCards(cards).length, [cards])
  const streak = useMemo(() => currentStreak(stats), [stats])
  const todayReviews = stats.byDay[todayKey()]?.reviews ?? 0

  return (
    <div className="page">
      <div className="app">
        <div className="hero">
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Switch to apricot (light) theme' : 'Switch to pomegranate (dark) theme'}
            title={theme === 'dark' ? 'Switch to apricot theme' : 'Switch to pomegranate theme'}
          >
            <img
              src={theme === 'dark' ? pomImg : aprImg}
              alt={theme === 'dark' ? 'Pomegranate' : 'Apricot'}
              className="theme-icon-img"
            />
          </button>

          <header>
            <h1>ASA</h1>
            <p className="subtitle">Ասա — Armenian for “say.” Learn, practice and speak Eastern Armenian.</p>
          </header>

          <div className="stat-strip">
            <span className="stat">
              <strong>{streak}</strong> day streak
            </span>
            <span className="stat">
              <strong>{due}</strong> due
            </span>
            <span className="stat">
              <strong>{todayReviews}</strong> today
            </span>
            <span className="stat">
              <strong>{cards.length}</strong> cards
            </span>
          </div>
        </div>

        <nav className="tab-bar">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              className={`tab ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
              aria-current={tab === id}
            >
              <span className="tab-icon">{icon}</span>
              <span className="tab-label">{label}</span>
              {id === 'flashcards' && due > 0 && <span className="tab-badge">{due}</span>}
            </button>
          ))}
        </nav>

        <div className="plan-bar">
          {isPro ? (
            <span className="plan-badge pro">✓ Pro — unlimited</span>
          ) : (
            <>
              <span className="plan-badge">Free plan — 15 translations/day</span>
              <button className="upgrade-btn" onClick={handleUpgrade} disabled={upgrading}>
                {upgrading ? 'Redirecting…' : 'Upgrade to Pro — $3.99/mo'}
              </button>
              <button className="link small" onClick={() => setShowRestore((v) => !v)}>
                Already subscribed?
              </button>
            </>
          )}
        </div>

        {showRestore && !isPro && (
          <div className="restore-bar">
            <input
              type="email"
              value={restoreEmail}
              onChange={(e) => setRestoreEmail(e.target.value)}
              placeholder="Email used at checkout"
            />
            <button className="ghost" onClick={handleRestoreAccess} disabled={restoring || !restoreEmail.trim()}>
              {restoring ? 'Checking…' : 'Restore access'}
            </button>
          </div>
        )}

        <AccountBar sync={sync} data={syncData} onImport={applyPayload} />

        {billingError && <div className="error-banner">{billingError}</div>}

        {limitReached && !isPro && (
          <div className="error-banner">
            Free daily limit reached.
            <button className="upgrade-btn inline" onClick={handleUpgrade} disabled={upgrading}>
              {upgrading ? 'Redirecting…' : 'Upgrade to Pro'}
            </button>
          </div>
        )}

        <main className={`tab-panel ${FOCUS_TABS.has(tab) ? 'focus' : ''}`}>
          {tab === 'translate' && (
            <TranslateView
              accessCode={accessCode}
              decks={decks}
              dueCount={due}
              onAddCards={addCards}
              onLimitReached={() => setLimitReached(true)}
              onStudy={() => setTab('flashcards')}
            />
          )}

          {tab === 'flashcards' && (
            <FlashcardsView accessCode={accessCode} cards={cards} decks={decks} onGrade={gradeCard} />
          )}

          {tab === 'practice' && (
            <PracticeView
              accessCode={accessCode}
              cards={cards}
              decks={decks}
              onAnswer={recordAnswer}
              onLimitReached={() => setLimitReached(true)}
            />
          )}

          {tab === 'quiz' && (
            <QuizView accessCode={accessCode} cards={cards} decks={decks} onAnswer={recordAnswer} />
          )}

          {tab === 'library' && (
            <LibraryView
              accessCode={accessCode}
              cards={cards}
              decks={decks}
              onAddCards={addCards}
              onDeleteCard={deleteCard}
              onMoveCard={moveCard}
              onCreateDeck={createDeck}
              onDeleteDeck={deleteDeck}
            />
          )}
        </main>

        <footer className="give-back">
          🇦🇲 15% of every ASA Pro subscription is donated to{' '}
          <a href="https://birthrightarmenia.org" target="_blank" rel="noopener noreferrer">
            Birthright Armenia
          </a>
          , a nonprofit connecting diaspora Armenian youth with their homeland through volunteer service.
        </footer>
      </div>
    </div>
  )
}

export default App

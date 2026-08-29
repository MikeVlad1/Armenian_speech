import { useEffect, useState } from 'react'
import {
  ApiError,
  createDonationSession,
  fetchDonationConfig,
  type DonationConfig,
  type DonationInterval,
} from '../lib/api'

type Props = {
  onClose: () => void
}

const QUICK_AMOUNTS = [3, 5, 10, 25]

const INTERVALS: { id: DonationInterval; label: string; suffix: string }[] = [
  { id: 'once', label: 'One-time', suffix: '' },
  { id: 'month', label: 'Monthly', suffix: '/mo' },
  { id: 'year', label: 'Yearly', suffix: '/yr' },
]

/** Dollars → integer cents, without the rounding drift of `amount * 100`. */
function toCents(dollars: string): number | null {
  const trimmed = dollars.trim().replace(/^\$/, '')
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  return Math.round(Number(trimmed) * 100)
}

export default function DonateModal({ onClose }: Props) {
  const [config, setConfig] = useState<DonationConfig | null>(null)
  const [amount, setAmount] = useState('5')
  const [interval, setInterval] = useState<DonationInterval>('once')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDonationConfig()
      .then(setConfig)
      .catch(() => setError('Donations are unavailable right now.'))
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const cents = toCents(amount)
  const valid =
    cents !== null && (!config || (cents >= config.minCents && cents <= config.maxCents))

  async function handleDonate() {
    if (cents === null || busy) return
    setBusy(true)
    setError('')
    try {
      window.location.href = await createDonationSession(cents, interval)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the donation.')
      setBusy(false)
    }
  }

  const suffix = INTERVALS.find((i) => i.id === interval)?.suffix ?? ''

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="card modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Support ASA"
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h2 className="modal-title">Support ASA</h2>
        <p className="modal-sub">
          {config
            ? `${config.charitySharePercent}% of every donation goes to Armenian charity. The rest keeps ASA running and free to use.`
            : 'Loading…'}
        </p>

        <div className="side-toggle donate-intervals">
          {INTERVALS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={interval === id ? 'active' : ''}
              onClick={() => setInterval(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="quick-amounts">
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              className={`quick-amount ${amount === String(value) ? 'active' : ''}`}
              onClick={() => setAmount(String(value))}
            >
              ${value}
              <span className="quick-suffix">{suffix}</span>
            </button>
          ))}
        </div>

        <label className="field">
          <span>Custom amount</span>
          <div className="amount-input">
            <span className="amount-prefix">$</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && valid && handleDonate()}
              placeholder="0.00"
              aria-label="Custom donation amount in dollars"
            />
            {suffix && <span className="amount-suffix">{suffix}</span>}
          </div>
        </label>

        {error && <div className="error-banner">{error}</div>}

        {config && !config.enabled && (
          <div className="error-banner">
            Donations aren't set up yet - please check back soon.
          </div>
        )}

        <button
          className="primary donate-submit"
          onClick={handleDonate}
          disabled={!valid || busy || !config?.enabled}
        >
          {busy && <span className="spinner" />}
          {busy
            ? 'Redirecting…'
            : interval === 'once'
              ? `Donate $${amount || '0'}`
              : `Donate $${amount || '0'}${suffix}`}
        </button>

        {!valid && amount.trim() !== '' && (
          <p className="empty-note">
            {config
              ? `Enter an amount between $${config.minCents / 100} and $${config.maxCents / 100}.`
              : 'Enter a valid amount.'}
          </p>
        )}

        <p className="modal-fineprint">
          Payments are handled by Stripe - ASA never sees your card details.
          {interval !== 'once' && ' You can cancel a recurring donation at any time.'}
        </p>
      </div>
    </div>
  )
}

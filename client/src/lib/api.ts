import type { TranslateResult } from './types'
import type { Direction } from './languages'

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  limitReached: boolean
  constructor(message: string, limitReached = false) {
    super(message)
    this.name = 'ApiError'
    this.limitReached = limitReached
  }
}

function authHeaders(accessCode: string | null): Record<string, string> {
  return accessCode ? { 'x-access-code': accessCode } : {}
}

async function throwForResponse(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}))
  throw new ApiError(body.error || fallback, res.status === 429)
}

export async function translate(
  text: string,
  direction: Direction,
  accessCode: string | null
): Promise<TranslateResult> {
  const res = await fetch(`${API_BASE}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(accessCode) },
    body: JSON.stringify({ text, direction }),
  })
  if (!res.ok) await throwForResponse(res, 'Translation failed')
  return res.json()
}

export async function speak(
  text: string,
  accessCode: string | null,
  opts: { voice?: 'female' | 'male'; rate?: 'normal' | 'slow' } = {}
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(accessCode) },
    body: JSON.stringify({ text, voice: opts.voice ?? 'female', rate: opts.rate ?? 'normal' }),
  })
  if (!res.ok) await throwForResponse(res, 'Speech request failed')
  return res.blob()
}

export async function transcribe(
  audio: Blob,
  accessCode: string | null
): Promise<{ transcript: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': audio.type || 'audio/webm', ...authHeaders(accessCode) },
    body: audio,
  })
  if (!res.ok) await throwForResponse(res, 'Transcription failed')
  return res.json()
}

export async function cancelSubscription(
  accessCode: string
): Promise<{ canceled: boolean; periodEnd: number | null }> {
  const res = await fetch(`${API_BASE}/api/cancel-subscription`, {
    method: 'POST',
    headers: { 'x-access-code': accessCode },
  })
  if (!res.ok) await throwForResponse(res, 'Could not cancel the subscription')
  return res.json()
}

export type DonationInterval = 'once' | 'month' | 'year'

export type DonationConfig = {
  enabled: boolean
  charitySharePercent: number
  minCents: number
  maxCents: number
}

export async function fetchDonationConfig(): Promise<DonationConfig> {
  const res = await fetch(`${API_BASE}/api/donation-config`)
  if (!res.ok) await throwForResponse(res, 'Could not load donation options')
  return res.json()
}

export async function createDonationSession(
  amountCents: number,
  interval: DonationInterval
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/create-donation-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountCents, interval }),
  })
  if (!res.ok) await throwForResponse(res, 'Could not start the donation')
  const data = await res.json()
  if (!data.url) throw new ApiError('Could not start the donation')
  return data.url
}

export type BreakdownWord = {
  armenian: string
  english: string
  transliteration: string
  partOfSpeech: string
}

export async function breakdown(
  text: string,
  accessCode: string | null
): Promise<BreakdownWord[]> {
  const res = await fetch(`${API_BASE}/api/breakdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(accessCode) },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) await throwForResponse(res, 'Breakdown failed')
  const data = await res.json()
  return data.words ?? []
}

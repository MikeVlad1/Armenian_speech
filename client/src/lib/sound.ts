const SOUND_KEY = 'armenian-speaker-sound'

let ctx: AudioContext | null = null
let enabled = (() => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'false'
  } catch {
    return true
  }
})()

/** Created lazily, on the first sound a real user interaction triggers - browsers block audio before that. */
function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function setSoundEnabled(value: boolean): void {
  enabled = value
  try {
    localStorage.setItem(SOUND_KEY, String(value))
  } catch {
    // Non-fatal - the preference just won't survive a reload.
  }
}

export function isSoundEnabled(): boolean {
  return enabled
}

/** One short envelope-shaped tone, scheduled at an exact Web Audio clock time. */
function tone(startTime: number, freq: number, duration: number, type: OscillatorType, peakGain: number) {
  const audio = getContext()
  if (!audio) return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.value = freq
  // exponentialRamp can't start from exactly 0, hence the near-zero floor.
  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  osc.connect(gain).connect(audio.destination)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.03)
}

/** A bright two-note rise - the "yes, that's it" chime for a correct answer. */
export function playCorrect(): void {
  if (!enabled) return
  const audio = getContext()
  if (!audio) return
  const now = audio.currentTime
  tone(now, 587.33, 0.11, 'sine', 0.16) // D5
  tone(now + 0.09, 880, 0.17, 'sine', 0.16) // A5
}

/** A single soft, low tone - informative rather than a harsh buzzer. */
export function playIncorrect(): void {
  if (!enabled) return
  const audio = getContext()
  if (!audio) return
  tone(audio.currentTime, 220, 0.2, 'triangle', 0.11) // A3
}

/** A short rising fanfare for finishing a whole quiz/lesson session. */
export function playComplete(): void {
  if (!enabled) return
  const audio = getContext()
  if (!audio) return
  const now = audio.currentTime
  tone(now, 523.25, 0.1, 'sine', 0.14) // C5
  tone(now + 0.08, 659.25, 0.1, 'sine', 0.14) // E5
  tone(now + 0.16, 783.99, 0.1, 'sine', 0.14) // G5
  tone(now + 0.24, 1046.5, 0.24, 'sine', 0.17) // C6
}

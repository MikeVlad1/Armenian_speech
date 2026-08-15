import { useCallback, useEffect, useRef, useState } from 'react'
import { speak } from './api'

/**
 * Plays Armenian TTS audio, reusing a single <audio> element and revoking
 * blob URLs as it goes so long study sessions don't leak memory.
 */
export function useAudio(accessCode: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    audioRef.current = new Audio()
    return () => {
      audioRef.current?.pause()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  const play = useCallback(
    async (text: string, opts: { voice?: 'female' | 'male'; rate?: 'normal' | 'slow' } = {}) => {
      if (!text.trim() || playing) return
      setPlaying(true)
      setError('')
      try {
        const blob = await speak(text, accessCode, opts)
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        const el = audioRef.current
        if (el) {
          el.src = url
          await el.play()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Playback failed')
      } finally {
        setPlaying(false)
      }
    },
    [accessCode, playing]
  )

  return { play, playing, error }
}

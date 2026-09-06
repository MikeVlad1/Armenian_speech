import { useRef, useState } from 'react'
import { encodeWav16kMono } from './wavEncode'

/**
 * Recording format doesn't need to match what Azure accepts - the caller
 * gets a real WAV out of this hook regardless (see wavEncode.ts) - so this
 * just picks whatever the browser itself can record.
 */
const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null
}

type Options = {
  onResult: (wav: Blob) => void | Promise<void>
  onError: (message: string) => void
}

/** Microphone capture -> 16kHz mono WAV, shared by Practice and Translate. */
export function useSpeechRecorder({ onResult, onError }: Options) {
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  async function start() {
    const mimeType = pickMimeType()
    if (!mimeType) {
      onError('This browser cannot record audio in a format the speech service accepts. Try Chrome, Edge, or Firefox.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        const blob = new Blob(chunksRef.current, { type: mimeType })
        void (async () => {
          try {
            onResult(await encodeWav16kMono(blob))
          } catch {
            onError('Could not process that recording. Please try again.')
          }
        })()
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      onError('Microphone access was blocked. Allow it in your browser settings to use your voice.')
    }
  }

  function stop() {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }

  function cleanup() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }

  return { recording, start, stop, cleanup }
}

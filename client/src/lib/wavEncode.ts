/**
 * Azure's short-audio speech-to-text REST endpoint only accepts two formats:
 * WAV/PCM or OGG/Opus, both at 16 kHz mono. It does not document WebM as a
 * supported container - and browsers (Chrome in particular) record via
 * MediaRecorder as WebM/Opus almost universally, regardless of what
 * Content-Type header we claim when forwarding the bytes.
 *
 * Sending WebM audio labelled as one of the accepted types isn't rejected
 * outright; Azure appears to attempt to parse it anyway and can return a
 * confident, complete, but wrong transcription - exactly the "it heard a
 * different word" symptom this fixes. Converting to real 16 kHz mono PCM WAV
 * in the browser before upload sidesteps the container question entirely.
 */
export async function encodeWav16kMono(input: Blob): Promise<Blob> {
  const AudioContextCtor: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext

  const decodeCtx = new AudioContextCtor()
  let decoded: AudioBuffer
  try {
    decoded = await decodeCtx.decodeAudioData(await input.arrayBuffer())
  } finally {
    await decodeCtx.close()
  }

  const sampleRate = 16000
  // Rendering through an OfflineAudioContext handles resampling and the
  // stereo-to-mono downmix in one pass, using the browser's own resampler
  // rather than a hand-rolled one.
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate)
  const source = offlineCtx.createBufferSource()
  source.buffer = decoded
  source.connect(offlineCtx.destination)
  source.start(0)
  const rendered = await offlineCtx.startRendering()

  return encodePcm16Wav(rendered.getChannelData(0), sampleRate)
}

function encodePcm16Wav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2
  const blockAlign = bytesPerSample // mono
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample)
  const view = new DataView(buffer)

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * bytesPerSample, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // byte rate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // bits per sample
  writeString(36, 'data')
  view.setUint32(40, samples.length * bytesPerSample, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
  }

  return new Blob([buffer], { type: 'audio/wav; codecs=audio/pcm; samplerate=16000' })
}

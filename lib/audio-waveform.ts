export function peaksFromAudioBuffer(audioBuffer: AudioBuffer, barCount: number): number[] {
  const channel = audioBuffer.getChannelData(0)
  const len = channel.length
  const block = Math.max(1, Math.floor(len / barCount))
  const peaks: number[] = []
  for (let i = 0; i < barCount; i++) {
    let max = 0
    const start = i * block
    const end = Math.min(start + block, len)
    for (let j = start; j < end; j++) {
      const v = Math.abs(channel[j] ?? 0)
      if (v > max) max = v
    }
    peaks.push(max)
  }
  const norm = Math.max(...peaks, 1e-6)
  return peaks.map((p) => Math.min(1, p / norm))
}

export async function computeWaveformPeaksFromBlob(blob: Blob, barCount = 40): Promise<number[]> {
  const buf = await blob.arrayBuffer()
  const ctx = new AudioContext()
  try {
    const audioBuf = await ctx.decodeAudioData(buf.slice(0))
    return peaksFromAudioBuffer(audioBuf, barCount)
  } finally {
    await ctx.close()
  }
}

export async function computeWaveformPeaksFromUrl(url: string, barCount = 40): Promise<number[]> {
  const res = await fetch(url, { mode: "cors" })
  if (!res.ok) throw new Error("fetch failed")
  const buf = await res.arrayBuffer()
  const ctx = new AudioContext()
  try {
    const audioBuf = await ctx.decodeAudioData(buf.slice(0))
    return peaksFromAudioBuffer(audioBuf, barCount)
  } finally {
    await ctx.close()
  }
}

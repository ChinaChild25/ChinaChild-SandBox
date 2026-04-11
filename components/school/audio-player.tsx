"use client"

import type { AudioTrack } from "@/lib/courses/types"

type Props = {
  tracks: AudioTrack[]
}

export function AudioPlayer({ tracks }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-1">
      {tracks.map((t) => (
        <div key={t.id} className="cc-lesson-audio">
          <div>
            <p className="text-[15px] font-semibold leading-snug text-[var(--cc-hsk-text)]">{t.title}</p>
            <p className="mt-1 text-xs text-[var(--cc-hsk-muted)]">{t.author}</p>
          </div>
          <audio controls preload="metadata" src={t.url}>
            Ваш браузер не поддерживает воспроизведение аудио.
          </audio>
        </div>
      ))}
    </div>
  )
}

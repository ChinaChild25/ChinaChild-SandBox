"use client"

import { cn } from "@/lib/utils"
import type { AudioTrack } from "@/lib/courses/types"
import { LessonAudioPlayerRow } from "@/components/lesson-builder/lesson-audio-waveform"

type Props = {
  tracks: AudioTrack[]
}

/** Единая серая «пилюля»: заголовок + ряд управления в одном шейпе, нейтральная палитра. */
export function AudioPlayer({ tracks }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-1">
      {tracks.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-[22px] bg-neutral-200/80 px-4 pb-3.5 pt-3.5",
            "transition-[background-color,box-shadow] duration-200 ease-out",
            "hover:bg-neutral-300/85 hover:shadow-sm",
            "dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:hover:shadow-none",
          )}
        >
          <div className="mb-2.5 min-w-0 px-0.5">
            <p className="text-[15px] font-semibold leading-snug tracking-tight text-neutral-900 dark:text-neutral-50">
              {t.title}
            </p>
            <p className="mt-0.5 text-[12px] font-medium text-neutral-500 dark:text-neutral-400">{t.author}</p>
          </div>

          <LessonAudioPlayerRow
            src={t.url}
            peaks={null}
            seekable
            volumeControl
            transportIconMode="solid"
            transportIconClassName="text-neutral-300 dark:text-neutral-700"
            barCount={48}
            containerClassName={cn(
              "gap-2.5 rounded-none border-0 bg-transparent p-0 shadow-none",
              "dark:bg-transparent",
            )}
            buttonClassName={cn(
              "h-9 w-9 shrink-0 border-0 shadow-none",
              "bg-neutral-900 shadow-none",
              "hover:bg-neutral-800 hover:shadow-sm",
              "dark:bg-neutral-100",
              "dark:hover:bg-white dark:hover:shadow-sm",
            )}
            playedBarClassName="bg-neutral-900 dark:bg-neutral-100"
            idleBarClassName="bg-neutral-400/45 dark:bg-neutral-500/40"
            liveActiveBarClassName="bg-neutral-900 dark:bg-neutral-100"
            liveIdleBarClassName="bg-neutral-400/45"
            timeClassName="text-neutral-500 dark:text-neutral-400"
          />
        </div>
      ))}
    </div>
  )
}

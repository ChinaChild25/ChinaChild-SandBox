"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown, ChevronLeft, Clock3, Eye, GripVertical, Loader2, Medal, Pencil, Plus, Trash2 } from "lucide-react"
import type { TeacherCustomCourse, TeacherLessonBlock } from "@/lib/types"
import {
  asRecord,
  asString,
  createDefaultBlockData,
  createDefaultBlockMeta,
  getNormalizedBlockSubtitle,
  normalizeLessonBlockData,
  normalizeTeacherLessonBlock,
  type HomeworkResponseMode,
  type LessonBlockMeta
} from "@/lib/lesson-builder-blocks"
import { BlockEditors } from "@/components/lesson-builder/block-editors"
import {
  type BuilderPaletteItem,
  getBlockVisual,
  getBlockVariantBehavior,
  getBlockVariantId,
  getPaletteItemVisual,
  LESSON_BUILDER_PALETTE_SECTIONS
} from "@/components/lesson-builder/block-registry"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type TeacherLessonPayload = {
  lesson?: { id: string; title: string; course_id: string; task_badge_color?: string | null }
  error?: string
}

type TeacherBlocksPayload = {
  blocks?: TeacherLessonBlock[]
  error?: string
}

function snapshotForSave(blocks: TeacherLessonBlock[]) {
  return JSON.stringify(
    blocks.map((block, index) => ({
      type: block.type,
      order: index,
      data: block.data ?? {}
    }))
  )
}

function SettingsLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ds-text-tertiary">{children}</div>
}

function SettingsToggle({
  checked,
  onChange
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-ds-ink" : "bg-[var(--ds-neutral-chrome)]"
      )}
    >
      <span
        className={cn(
          "inline-block h-[18px] w-[18px] rounded-full bg-[var(--ds-surface)] shadow-[0_2px_6px_rgba(0,0,0,0.16)] transition-transform",
          checked ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  )
}

function responseModeLabel(mode: HomeworkResponseMode) {
  if (mode === "text") return "Текст"
  if (mode === "file") return "Файл"
  return "Текст + Файл"
}

function PalettePreview({ item }: { item: BuilderPaletteItem }) {
  const shellClass = "rounded-[18px] bg-[var(--ds-neutral-row)] p-3"
  const chipClass = "rounded-[10px] border border-black/[0.08] bg-[var(--ds-surface)] px-2.5 py-1 text-[13px] text-ds-text-secondary dark:border-white/[0.1]"
  const slotClass = "h-8 min-w-[48px] rounded-[10px] border border-black/[0.08] bg-[var(--ds-surface)] dark:border-white/[0.1]"

  switch (item.id) {
    case "images-stack":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="grid gap-2">
              <div className="h-14 rounded-[14px] bg-[#d7ebf9]" />
              <div className="h-14 rounded-[14px] bg-[#f7dfdf]" />
              <div className="h-14 rounded-[14px] bg-[#ddeed4]" />
            </div>
          </div>
          <p className="text-[13px] leading-5 text-ds-text-secondary">Несколько изображений идут одно под другим.</p>
        </div>
      )
    case "images-carousel":
      return (
        <div className="space-y-3">
          <div className={cn(shellClass, "flex items-center gap-2")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ds-surface)] text-ds-text-secondary">‹</div>
            <div className="h-20 flex-1 rounded-[14px] bg-[#d7ebf9]" />
            <div className="h-20 w-16 rounded-[14px] bg-[#f7dfdf]" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ds-surface)] text-ds-text-secondary">›</div>
          </div>
          <p className="text-[13px] leading-5 text-ds-text-secondary">Ученик перелистывает изображения как слайды.</p>
        </div>
      )
    case "images-gif":
      return (
        <div className="space-y-3">
          <div className={cn(shellClass, "relative")}>
            <div className="h-24 rounded-[16px] bg-[linear-gradient(135deg,#fde9dd,#ffe8c8)]" />
            <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
              <span className="rounded-[14px] bg-[var(--ds-surface)] px-4 py-2 text-[18px] font-semibold text-ds-text-secondary shadow-[0_10px_24px_-18px_rgba(0,0,0,0.4)]">GIF</span>
            </div>
          </div>
          <p className="text-[13px] leading-5 text-ds-text-secondary">Анимированное изображение для объяснения движения или эмоции.</p>
        </div>
      )
    case "media-video":
      return (
        <div className="space-y-3">
          <div className={cn(shellClass, "relative overflow-hidden")}>
            <div className="h-24 rounded-[16px] bg-[linear-gradient(135deg,#d6e7f8,#e8dcff)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ds-surface)]/90 text-[22px] text-ds-text-secondary shadow-[0_12px_24px_-18px_rgba(0,0,0,0.35)]">▶</div>
            </div>
          </div>
          <p className="text-[13px] leading-5 text-ds-text-secondary">Видео-фрагмент с обложкой и кнопкой воспроизведения.</p>
        </div>
      )
    case "media-audio-playback":
      return (
        <div className="space-y-3">
          <div className={cn(shellClass, "space-y-3")}>
            <div className="flex items-center justify-between text-[13px] font-medium text-[#5a6276]">
              <span>Аудио</span>
              <span>00:15 / 00:30</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#4bb567]">❚❚</span>
              <div className="h-2 flex-1 rounded-full bg-[#dfe4ef]">
                <div className="h-2 w-1/2 rounded-full bg-[#81b85f]" />
              </div>
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Готовый аудиотрек для прослушивания учеником.</p>
        </div>
      )
    case "media-audio-record":
      return (
        <div className="space-y-3">
          <div className={cn(shellClass, "space-y-3")}>
            <div className="flex items-center justify-between text-[13px] font-medium text-[#d46a78]">
              <span>Запись...</span>
              <span>00:15 / 00:30</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#f07a90]">●</span>
              <div className="h-2 flex-1 rounded-full bg-[#f0d6db]">
                <div className="h-2 w-[40%] rounded-full bg-[#ef8da0]" />
              </div>
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Ученик записывает свой голос прямо в задании.</p>
        </div>
      )
    case "fill-drag-word":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="mb-3 flex flex-wrap gap-2">
              {["你好", "学生", "老师"].map((word) => (
                <span key={word} className={chipClass}>{word}</span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[15px] text-[#4e566b]">
              <span>我 是</span>
              <span className="rounded-[10px] border-2 border-[#7eb0e8] bg-white px-3 py-1 text-[#4e566b]">学生</span>
              <span>。</span>
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Слово перетаскивается в пустое место предложения.</p>
        </div>
      )
    case "fill-type-word":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="flex flex-wrap items-center gap-2 text-[15px] leading-7 text-[#4e566b]">
              <span>Привет! Я</span>
              <span className="rounded-[10px] border-2 border-[#7eb0e8] bg-white px-3 py-1 text-[#4e566b]">学生</span>
              <span>из Китая.</span>
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Ученик вписывает слово вручную в выделенный пропуск.</p>
        </div>
      )
    case "fill-choose-form":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="flex flex-wrap items-center gap-2 text-[15px] leading-7 text-[#4e566b]">
              <span>Сегодня я</span>
              <span className="inline-flex items-center gap-2 rounded-[10px] border-2 border-[#7eb0e8] bg-white px-3 py-1">учусь ▾</span>
              <span>китайскому.</span>
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Вместо ввода ученик выбирает нужную форму слова из списка.</p>
        </div>
      )
    case "fill-image-drag":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="mb-3 flex flex-wrap gap-2">
              {["猫", "狗", "人"].map((word) => (
                <span key={word} className={chipClass}>{word}</span>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((index) => (
                <div key={index} className="space-y-2">
                  <div className="h-14 rounded-[12px] bg-[#d7ebf9]" />
                  <div className={slotClass} />
                </div>
              ))}
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Слово перетаскивается под подходящее изображение.</p>
        </div>
      )
    case "fill-image-type":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((index) => (
                <div key={index} className="space-y-2">
                  <div className="h-14 rounded-[12px] bg-[#f7dfdf]" />
                  <div className="h-8 rounded-[10px] border-2 border-[#7eb0e8] bg-white" />
                </div>
              ))}
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Под картинкой появляется поле, куда ученик вводит слово.</p>
        </div>
      )
    case "fill-image-form":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((index) => (
                <div key={index} className="space-y-2">
                  <div className="h-14 rounded-[12px] bg-[#ddeed4]" />
                  <div className="inline-flex h-8 w-full items-center justify-between rounded-[10px] border border-[#d9deea] bg-white px-3 text-[13px] text-[#4e566b]">
                    <span>选择</span>
                    <span>▾</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Под изображением ученик выбирает нужную форму слова из списка.</p>
        </div>
      )
    case "quiz-no-timer":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="mb-3 text-[15px] font-medium text-[#4e566b]">Выберите правильный перевод</div>
            <div className="space-y-2">
              {["Привет", "Пока", "Спасибо"].map((answer, index) => (
                <div key={answer} className="flex items-center gap-2 text-[14px] text-[#5a6276]">
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-[6px] border", index === 0 ? "border-[#35c672] text-[#35c672]" : "border-[#d9deea]")} />
                  {answer}
                </div>
              ))}
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Обычный тест без ограничений по времени.</p>
        </div>
      )
    case "quiz-timer":
      return (
        <div className="space-y-3">
          <div className={cn(shellClass, "overflow-hidden p-0")}>
            <div className="flex items-center justify-between bg-[#7eb0e8] px-3 py-2 text-[13px] font-semibold text-white">
              <span>Тест начат</span>
              <span>00:30</span>
            </div>
            <div className="p-3">
              <div className="mb-3 text-[15px] font-medium text-[#4e566b]">Выберите правильный ответ</div>
              <div className="space-y-2 text-[14px] text-[#5a6276]">
                <div className="flex items-center gap-2"><span className="flex h-5 w-5 rounded-[6px] border border-[#35c672]" />你好</div>
                <div className="flex items-center gap-2"><span className="flex h-5 w-5 rounded-[6px] border border-[#d9deea]" />谢谢</div>
              </div>
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Тот же тест, но с таймером и шапкой отсчёта.</p>
        </div>
      )
    case "answer-true-false-unknown":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="mb-3 text-center text-[15px] font-medium text-[#4e566b]">地球是一颗行星。</div>
            <div className="flex flex-wrap justify-center gap-2">
              {["Ложь", "Истина", "Неизвестно"].map((answer, index) => (
                <span key={answer} className={cn("rounded-[10px] border px-3 py-1.5 text-[13px]", index === 1 ? "border-[#35c672] bg-white text-[#4e566b]" : "border-[#d9deea] bg-white text-[#7b8091]")}>
                  {answer}
                </span>
              ))}
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Ученик определяет: ложь, истина или информации недостаточно.</p>
        </div>
      )
    case "order-sentence":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="mb-3 flex flex-wrap gap-2">
              {["我们", "学习", "中文"].map((word) => (
                <span key={word} className={chipClass}>{word}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2].map((index) => <div key={index} className={slotClass} />)}
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Слова раскладываются в правильном порядке, чтобы собрать предложение.</p>
        </div>
      )
    case "order-columns":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="mb-3 flex flex-wrap gap-2">
              {["Apple", "Cat", "Banana"].map((word) => (
                <span key={word} className={chipClass}>{word}</span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[14px] border border-[#d9deea] bg-white p-3 text-center text-[13px] font-medium text-[#4e566b]">Животные</div>
              <div className="rounded-[14px] border-2 border-[#7eb0e8] bg-white p-3 text-center text-[13px] font-medium text-[#4e566b]">Фрукты</div>
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Слова распределяются по колонкам-категориям.</p>
        </div>
      )
    case "order-text":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="space-y-2">
              {["Сначала мы завтракаем.", "Потом идём на урок.", "Вечером делаем домашнее задание."].map((row, index) => (
                <div key={row} className={cn("rounded-[10px] border bg-white px-3 py-2 text-[13px] text-[#4e566b]", index === 0 ? "border-2 border-[#7eb0e8]" : "border-[#d9deea]")}>{row}</div>
              ))}
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Строки текста перетаскиваются вверх и вниз до правильной последовательности.</p>
        </div>
      )
    case "order-letters":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="mb-3 flex flex-wrap gap-2">
              {["s", "u", "m", "m", "e", "r"].map((letter, index) => (
                <span key={`${letter}-${index}`} className={chipClass}>{letter}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5].map((index) => <div key={index} className="h-8 w-8 rounded-[10px] border border-[#d9deea] bg-white" />)}
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Из набора букв нужно составить правильное слово.</p>
        </div>
      )
    case "order-match-words":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="space-y-2">
              {[["English", "你好"], ["Russian", "Привет"]].map(([left, right]) => (
                <div key={left} className="grid grid-cols-2 gap-2">
                  <div className="rounded-[10px] border-2 border-[#7eb0e8] bg-white px-3 py-2 text-[13px] text-[#4e566b]">{left}</div>
                  <div className="rounded-[10px] border border-[#d9deea] bg-white px-3 py-2 text-[13px] text-[#4e566b]">{right}</div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Слова или фразы соединяются в правильные пары.</p>
        </div>
      )
    case "text-article":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="mb-2 text-[15px] font-medium text-[#4e566b]">Магия путешествий</div>
            <div className="space-y-2 text-[13px] leading-6 text-[#646c7f]">
              <p>Каждое путешествие открывает новые культуры и впечатления.</p>
              <p className="opacity-65">Мы замечаем детали, которые раньше проходили мимо.</p>
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Большой читательский материал в формате статьи.</p>
        </div>
      )
    case "text-essay":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="mb-2 flex items-center justify-between text-[14px] font-medium text-[#b4b8ca]">
              <span>My unforgettable journey</span>
              <span>заметки</span>
            </div>
            <div className="min-h-[84px] rounded-[12px] border-2 border-[#39b9ff] bg-white p-3 text-[13px] leading-6 text-[#4e566b]">
              Last summer, I went on a trip that changed the way I see the world...
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Поле для развёрнутого письменного ответа ученика.</p>
        </div>
      )
    case "text-default":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="space-y-2 text-[13px] leading-6 text-[#646c7f]">
              <p>今天的天气很好，我们和朋友一起去公园散步。</p>
              <p className="opacity-65">Это обычный текстовый блок для объяснения темы урока.</p>
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Простой текст без отдельного сценария взаимодействия.</p>
        </div>
      )
    case "other-wordset":
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="space-y-2">
              {[
                ["项目", "Project"],
                ["系统", "System"]
              ].map(([cnWord, enWord]) => (
                <div key={cnWord} className="flex items-center justify-between rounded-[10px] bg-white px-3 py-2 text-[13px] text-[#4e566b]">
                  <span>{cnWord}</span>
                  <span className="text-[#9aa0ad]">{enWord}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Компактный список слов для запоминания и повторения.</p>
        </div>
      )
    case "other-note":
      return (
        <div className="space-y-3">
          <div className="rounded-[18px] bg-[#eaf7ff] p-4 text-[#35b0e8]">
            <div className="text-[14px] font-semibold">Заметка перед началом</div>
            <p className="mt-2 text-[13px] leading-6 text-[#54b9eb]">Перед выполнением внимательно прочитайте инструкцию и пример.</p>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Информационный блок с важной подсказкой или правилом.</p>
        </div>
      )
    case "other-link":
      return (
        <div className="space-y-3">
          <div className={cn(shellClass, "flex min-h-[116px] flex-col items-center justify-center gap-3 text-center")}>
            <div className="max-w-[220px] text-[14px] leading-6 text-[#4e566b]">Перейдите по ссылке, чтобы изучить дополнительный материал урока.</div>
            <span className="rounded-[10px] bg-[#39b9ff] px-3 py-1.5 text-[13px] font-medium text-white">Открыть ссылку</span>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Кнопка ведёт на внешний ресурс или дополнительное задание.</p>
        </div>
      )
    case "other-divider":
      return (
        <div className="space-y-3">
          <div className={cn(shellClass, "flex min-h-[116px] flex-col items-center justify-center gap-4")}>
            <div className="flex items-center gap-3 text-[16px] font-semibold text-[#4e566b]">
              <span className="rounded-[10px] bg-[#eaf7ff] px-3 py-1.5 text-[#39b9ff]">1.1</span>
              Упражнение 1
            </div>
            <div className="h-px w-[70%] border-t border-dashed border-[#d9deea]" />
            <div className="flex items-center gap-3 text-[16px] font-semibold text-[#4e566b]">
              <span className="rounded-[10px] bg-[#eaf7ff] px-3 py-1.5 text-[#39b9ff]">2.1</span>
              Упражнение 2
            </div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Визуально разделяет этапы урока или крупные части задания.</p>
        </div>
      )
    default:
      return (
        <div className="space-y-3">
          <div className={shellClass}>
            <div className="text-[15px] font-medium text-[#4e566b]">{item.label}</div>
          </div>
          <p className="text-[13px] leading-5 text-[#70788a]">Пример отображения блока в уроке.</p>
        </div>
      )
  }
}

const metricFieldShellClass =
  "mt-2 flex h-10 items-center rounded-[var(--ds-radius-md)] border border-transparent bg-[var(--ds-surface-muted)] px-3.5 transition-colors hover:bg-[var(--ds-neutral-row-hover)] focus-within:bg-[var(--ds-neutral-row-hover)]"

const metricFieldInputClass =
  "min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ds-ink outline-none [appearance:textfield] placeholder:text-ds-text-tertiary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

const chromeIconButtonClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-ds-text-tertiary transition-colors hover:bg-[var(--ds-neutral-row)] hover:text-ds-ink"

function SortableBlockCard({
  block,
  selected,
  subtitle,
  onSelect,
  onDelete,
  children
}: {
  block: TeacherLessonBlock
  selected: boolean
  subtitle: string
  onSelect: () => void
  onDelete: () => void
  children?: React.ReactNode
}) {
  const variantId = asString(asRecord(block.data).exercise_variant_id).trim()
  const visual = getBlockVisual(block.type, variantId)
  const Icon = visual.icon
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const meta = asRecord(block.data).meta ? (asRecord(block.data).meta as LessonBlockMeta) : createDefaultBlockMeta(block.type)
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "overflow-hidden rounded-[var(--ds-radius-xl)] bg-[var(--ds-surface)] transition-[box-shadow,border-color]",
        selected
          ? "border border-[#1f1f1f] shadow-none dark:border-white/[0.18]"
          : "border border-black/[0.06] hover:border-black/[0.09] dark:border-white/[0.08] dark:hover:border-white/[0.12]",
        isDragging && "shadow-[0_20px_40px_-20px_rgba(0,0,0,0.24)]"
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <button
          type="button"
          className={chromeIconButtonClass}
          aria-label="Перетащить блок"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-[18px] w-[18px]" />
        </button>
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-4 text-left">
          <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", visual.circleClass)}>
            <Icon className={cn("h-5 w-5", visual.iconClass)} strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-ds-body-lg font-semibold leading-none text-ds-ink">{meta.title}</span>
            <span className="mt-1.5 block line-clamp-2 text-[13px] leading-[1.35] text-ds-text-secondary">{subtitle}</span>
          </span>
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onDelete}
            className={chromeIconButtonClass}
            aria-label="Удалить блок"
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={onSelect}
            className={chromeIconButtonClass}
            aria-label={selected ? "Свернуть блок" : "Открыть блок"}
          >
            <ChevronDown className={cn("h-[18px] w-[18px] transition-transform", selected && "rotate-180")} />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          selected ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "px-4 py-4 transition-[opacity,transform] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-5",
              selected ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </article>
  )
}

function BlockSettingsPanel({
  block,
  onMetaChange,
  onBlockChange,
  onDelete
}: {
  block: TeacherLessonBlock | null
  onMetaChange: (patch: Partial<LessonBlockMeta>) => void
  onBlockChange: (updater: (data: Record<string, unknown>) => Record<string, unknown>) => void
  onDelete: () => void
}) {
  if (!block) {
    return (
      <aside className="overflow-hidden rounded-[32px] border border-black/[0.06] bg-[var(--ds-surface)] xl:sticky xl:top-3 dark:border-white/[0.08]">
        <div className="px-7 py-8 text-center text-ds-body text-ds-text-secondary">
          Выберите и раскройте блок для настройки
        </div>
      </aside>
    )
  }

  const data = asRecord(block.data)
  const meta = asRecord(data.meta) as LessonBlockMeta
  const variantId = getBlockVariantId(data)
  const variantBehavior = getBlockVariantBehavior({ type: block.type, data, variantId })
  const showTimerSetting = variantBehavior.showTimerSetting !== false
  const audioItems = Array.isArray(asRecord(data.audio).items) ? (asRecord(data.audio).items as unknown[]) : []
  const pdfItems = Array.isArray(asRecord(data.pdf).items) ? (asRecord(data.pdf).items as unknown[]) : []
  const speakingItems = Array.isArray(asRecord(data.speaking).items) ? (asRecord(data.speaking).items as unknown[]) : []
  const audioFirstItem = asRecord(audioItems[0])
  const pdfFirstItem = asRecord(pdfItems[0])
  const speakingFirstItem = asRecord(speakingItems[0])
  const matchingData = asRecord(data.matching)

  return (
    <aside className="overflow-hidden rounded-[32px] border border-black/[0.06] bg-[var(--ds-surface)] xl:sticky xl:top-3 dark:border-white/[0.08]">
      <div className="px-7 py-7">
        <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-ds-ink">Настройки блока</h2>

        <div className="mt-4 space-y-4">
          <div>
            <SettingsLabel>Название</SettingsLabel>
            <Input
              value={meta.title}
              onChange={(event) => onMetaChange({ title: event.target.value })}
              className="ds-lesson-editor-control-field mt-2 h-10 rounded-[var(--ds-radius-md)] border border-transparent bg-[var(--ds-surface-muted)] px-3.5 text-ds-body text-ds-ink shadow-none transition-colors hover:bg-[var(--ds-neutral-row-hover)] focus-visible:border-transparent focus-visible:bg-[var(--ds-neutral-row-hover)] focus-visible:ring-0"
            />
          </div>

          <div>
            <SettingsLabel>Инструкция</SettingsLabel>
            <Textarea
              value={meta.instruction}
              onChange={(event) => onMetaChange({ instruction: event.target.value })}
              className="ds-lesson-editor-control-field mt-2 min-h-[96px] rounded-[var(--ds-radius-md)] border border-transparent bg-[var(--ds-surface-muted)] px-3.5 py-3 text-ds-body text-ds-ink shadow-none transition-colors hover:bg-[var(--ds-neutral-row-hover)] focus-visible:border-transparent focus-visible:bg-[var(--ds-neutral-row-hover)] focus-visible:ring-0"
            />
          </div>

          <div className={cn("grid gap-3", showTimerSetting ? "sm:grid-cols-2" : "sm:grid-cols-1")}>
            <div>
              <div className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-ds-text-tertiary">
                <Medal className="h-3.5 w-3.5" />
                Баллы
              </div>
              <div className={metricFieldShellClass}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={meta.points}
                  onChange={(event) => onMetaChange({ points: Number(event.target.value.replace(/\D+/g, "") || 0) })}
                  className={metricFieldInputClass}
                />
              </div>
            </div>
            {showTimerSetting ? (
              <div>
                <div className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-ds-text-tertiary">
                  <Clock3 className="h-3.5 w-3.5" />
                  Таймер
                </div>
                <div className={metricFieldShellClass}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={meta.timerMinutes}
                    onChange={(event) => onMetaChange({ timerMinutes: Number(event.target.value.replace(/\D+/g, "") || 0) })}
                    className={cn(metricFieldInputClass, "max-w-[44px]")}
                  />
                  <span className="ml-3 shrink-0 text-[13px] font-medium text-ds-text-secondary">
                    мин
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface-muted)] px-3.5 py-3 transition-colors hover:bg-[var(--ds-neutral-row-hover)]">
              <div>
                <div className="text-ds-body font-semibold text-ds-ink">Обязательный</div>
                <div className="mt-1 text-[13px] leading-5 text-ds-text-secondary">Студент должен пройти блок</div>
              </div>
              <SettingsToggle checked={meta.required} onChange={(next) => onMetaChange({ required: next })} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface-muted)] px-3.5 py-3 transition-colors hover:bg-[var(--ds-neutral-row-hover)]">
              <div>
                <div className="text-ds-body font-semibold text-ds-ink">Перемешать</div>
                <div className="mt-1 text-[13px] leading-5 text-ds-text-secondary">Случайный порядок для ученика</div>
              </div>
              <SettingsToggle checked={meta.shuffle} onChange={(next) => onMetaChange({ shuffle: next })} />
            </div>
          </div>

          <div>
            <SettingsLabel>Попыток</SettingsLabel>
            <Select value={String(meta.attempts)} onValueChange={(value) => onMetaChange({ attempts: Number(value) })}>
              <SelectTrigger className="ds-lesson-editor-control-field mt-2 h-10 w-full rounded-[var(--ds-radius-md)] border border-transparent bg-[var(--ds-surface-muted)] px-3.5 text-ds-body text-ds-ink shadow-none transition-colors hover:bg-[var(--ds-neutral-row-hover)] focus-visible:border-transparent focus-visible:bg-[var(--ds-neutral-row-hover)] focus-visible:ring-0">
                <SelectValue />
              </SelectTrigger>
                <SelectContent className="rounded-[var(--ds-radius-md)] border border-black/[0.08] bg-[var(--ds-surface)] p-1 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.2)] dark:border-white/[0.08]">
                {[1, 2, 3, 5, 10].map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value} {value === 1 ? "попытка" : value < 5 ? "попытки" : "попыток"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {block.type === "matching" && variantBehavior.matchingMode === "columns" ? (
            <div className="space-y-4">
              <div>
                <SettingsLabel>Название колонки 1</SettingsLabel>
                <Input
                  value={asString(matchingData.leftColumnTitle)}
                  onChange={(event) =>
                    onBlockChange((current) => ({
                      ...current,
                      matching: {
                        ...asRecord(current.matching),
                        leftColumnTitle: event.target.value
                      }
                    }))
                  }
                  className="ds-lesson-editor-control-field mt-2 h-10 rounded-[var(--ds-radius-md)] border border-transparent bg-[var(--ds-surface-muted)] px-3.5 text-ds-body text-ds-ink shadow-none transition-colors hover:bg-[var(--ds-neutral-row-hover)] focus-visible:border-transparent focus-visible:bg-[var(--ds-neutral-row-hover)] focus-visible:ring-0"
                />
              </div>
              <div>
                <SettingsLabel>Название колонки 2</SettingsLabel>
                <Input
                  value={asString(matchingData.rightColumnTitle)}
                  onChange={(event) =>
                    onBlockChange((current) => ({
                      ...current,
                      matching: {
                        ...asRecord(current.matching),
                        rightColumnTitle: event.target.value
                      }
                    }))
                  }
                  className="ds-lesson-editor-control-field mt-2 h-10 rounded-[var(--ds-radius-md)] border border-transparent bg-[var(--ds-surface-muted)] px-3.5 text-ds-body text-ds-ink shadow-none transition-colors hover:bg-[var(--ds-neutral-row-hover)] focus-visible:border-transparent focus-visible:bg-[var(--ds-neutral-row-hover)] focus-visible:ring-0"
                />
              </div>
            </div>
          ) : null}

          {block.type === "homework" ? (
            <>
              <div>
                <SettingsLabel>Тип ответа</SettingsLabel>
                <div className="mt-2.5 grid gap-2">
                  {(["text", "file", "text_file"] as HomeworkResponseMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        onBlockChange((current) => ({
                          ...current,
                          homework: {
                            ...asRecord(current.homework),
                            responseMode: mode
                          }
                        }))
                      }
                      className={cn(
                        "flex h-10 items-center justify-center rounded-[var(--ds-radius-md)] text-ds-body font-medium transition-colors",
                        asString(asRecord(data.homework).responseMode || "text") === mode
                          ? "bg-ds-ink text-[var(--ds-surface)]"
                          : "bg-[var(--ds-surface-muted)] text-ds-text-secondary hover:bg-[var(--ds-neutral-row-hover)]"
                      )}
                    >
                      {responseModeLabel(mode)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <SettingsLabel>Дедлайн</SettingsLabel>
                <Input
                  type="date"
                  value={asString(asRecord(data.homework).deadline)}
                  onChange={(event) =>
                    onBlockChange((current) => ({
                      ...current,
                      homework: {
                        ...asRecord(current.homework),
                        deadline: event.target.value
                      }
                    }))
                  }
                  className="ds-lesson-editor-control-field mt-2 h-10 rounded-[var(--ds-radius-md)] border border-transparent bg-[var(--ds-surface-muted)] px-3.5 text-ds-body text-ds-ink shadow-none transition-colors hover:bg-[var(--ds-neutral-row-hover)] focus-visible:border-transparent focus-visible:bg-[var(--ds-neutral-row-hover)] focus-visible:ring-0"
                />
              </div>
            </>
          ) : null}

          {block.type === "audio" ? (
            <div className="space-y-4">
              <div>
                <SettingsLabel>Название аудио</SettingsLabel>
                <Input
                  value={asString(audioFirstItem.title)}
                  onChange={(event) =>
                    onBlockChange((current) => {
                      const audio = asRecord(current.audio)
                      const items = Array.isArray(audio.items) ? [...(audio.items as Record<string, unknown>[])] : [{}]
                      items[0] = { ...asRecord(items[0]), title: event.target.value }
                      return { ...current, audio: { ...audio, items } }
                    })
                  }
                  className="ds-lesson-editor-control-field mt-2 h-10 rounded-[var(--ds-radius-md)] border border-transparent bg-[var(--ds-surface-muted)] px-3.5 text-ds-body text-ds-ink shadow-none transition-colors hover:bg-[var(--ds-neutral-row-hover)] focus-visible:border-transparent focus-visible:bg-[var(--ds-neutral-row-hover)] focus-visible:ring-0"
                />
              </div>
              <div>
                <SettingsLabel>URL аудио</SettingsLabel>
                <Input
                  value={asString(audioFirstItem.url)}
                  onChange={(event) =>
                    onBlockChange((current) => {
                      const audio = asRecord(current.audio)
                      const items = Array.isArray(audio.items) ? [...(audio.items as Record<string, unknown>[])] : [{}]
                      items[0] = { ...asRecord(items[0]), url: event.target.value }
                      return { ...current, audio: { ...audio, items } }
                    })
                  }
                  className="ds-lesson-editor-control-field mt-2 h-10 rounded-[var(--ds-radius-md)] border border-transparent bg-[var(--ds-surface-muted)] px-3.5 text-ds-body text-ds-ink shadow-none transition-colors hover:bg-[var(--ds-neutral-row-hover)] focus-visible:border-transparent focus-visible:bg-[var(--ds-neutral-row-hover)] focus-visible:ring-0"
                />
              </div>
            </div>
          ) : null}

          {block.type === "pdf" ? (
            <div className="space-y-4">
              <div>
                <SettingsLabel>Название PDF</SettingsLabel>
                <Input
                  value={asString(pdfFirstItem.title)}
                  onChange={(event) =>
                    onBlockChange((current) => {
                      const pdf = asRecord(current.pdf)
                      const items = Array.isArray(pdf.items) ? [...(pdf.items as Record<string, unknown>[])] : [{}]
                      items[0] = { ...asRecord(items[0]), title: event.target.value }
                      return { ...current, pdf: { ...pdf, items } }
                    })
                  }
                  className="ds-lesson-editor-control-field mt-2 h-10 rounded-[var(--ds-radius-md)] border border-transparent bg-[var(--ds-surface-muted)] px-3.5 text-ds-body text-ds-ink shadow-none transition-colors hover:bg-[var(--ds-neutral-row-hover)] focus-visible:border-transparent focus-visible:bg-[var(--ds-neutral-row-hover)] focus-visible:ring-0"
                />
              </div>
              <div>
                <SettingsLabel>URL PDF</SettingsLabel>
                <Input
                  value={asString(pdfFirstItem.url)}
                  onChange={(event) =>
                    onBlockChange((current) => {
                      const pdf = asRecord(current.pdf)
                      const items = Array.isArray(pdf.items) ? [...(pdf.items as Record<string, unknown>[])] : [{}]
                      items[0] = { ...asRecord(items[0]), url: event.target.value }
                      return { ...current, pdf: { ...pdf, items } }
                    })
                  }
                  className="ds-lesson-editor-control-field mt-2 h-10 rounded-[var(--ds-radius-md)] border border-transparent bg-[var(--ds-surface-muted)] px-3.5 text-ds-body text-ds-ink shadow-none transition-colors hover:bg-[var(--ds-neutral-row-hover)] focus-visible:border-transparent focus-visible:bg-[var(--ds-neutral-row-hover)] focus-visible:ring-0"
                />
              </div>
            </div>
          ) : null}

          {block.type === "speaking" ? (
            <div className="space-y-4">
              <div>
                <SettingsLabel>Задание</SettingsLabel>
                <Textarea
                  value={asString(speakingFirstItem.prompt)}
                  onChange={(event) =>
                    onBlockChange((current) => {
                      const speaking = asRecord(current.speaking)
                      const items = Array.isArray(speaking.items) ? [...(speaking.items as Record<string, unknown>[])] : [{}]
                      items[0] = { ...asRecord(items[0]), prompt: event.target.value }
                      return { ...current, speaking: { ...speaking, items } }
                    })
                  }
                  className="ds-lesson-editor-control-field mt-2 min-h-[96px] rounded-[var(--ds-radius-md)] border border-transparent bg-[var(--ds-surface-muted)] px-3.5 py-3 text-ds-body text-ds-ink shadow-none transition-colors hover:bg-[var(--ds-neutral-row-hover)] focus-visible:border-transparent focus-visible:bg-[var(--ds-neutral-row-hover)] focus-visible:ring-0"
                />
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onDelete}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-[var(--ds-radius-md)] bg-[#fff4f6] text-ds-body font-semibold text-[#a63c4a] transition-colors hover:bg-[#ffe8ec] dark:bg-[#3f252c] dark:text-[#ffd9e0] dark:hover:bg-[#4b2b33]"
          >
            <Trash2 className="h-4 w-4" />
            Удалить блок
          </button>
        </div>
      </div>
    </aside>
  )
}

export function LessonEditor({ lessonId }: { lessonId: string }) {
  const [title, setTitle] = useState("Урок")
  const [courseTitle, setCourseTitle] = useState("Кастомный курс")
  const [courseId, setCourseId] = useState("")
  const [blocks, setBlocks] = useState<TeacherLessonBlock[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titleRef = useRef<HTMLInputElement | null>(null)
  const paletteRef = useRef<HTMLDivElement | null>(null)
  const blocksRef = useRef<TeacherLessonBlock[]>([])
  const saveInFlightRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const lastSavedSnapshotRef = useRef("")
  const lastSavedTitleRef = useRef("")

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const normalizedBlocks = useMemo(
    () => [...blocks].map(normalizeTeacherLessonBlock).sort((left, right) => left.order - right.order),
    [blocks]
  )

  const selectedBlock = normalizedBlocks.find((block) => block.id === selectedBlockId) ?? null

  useEffect(() => {
    blocksRef.current = normalizedBlocks
  }, [normalizedBlocks])

  useEffect(() => {
    void loadLesson()
  }, [lessonId])

  useEffect(() => {
    if (normalizedBlocks.length === 0) {
      setSelectedBlockId(null)
      return
    }
    if (selectedBlockId && !normalizedBlocks.some((block) => block.id === selectedBlockId)) {
      setSelectedBlockId(null)
    }
  }, [normalizedBlocks, selectedBlockId])

  useEffect(() => {
    if (isLoading) return
    const snapshot = snapshotForSave(normalizedBlocks)
    if (snapshot === lastSavedSnapshotRef.current) return
    const timer = window.setTimeout(() => {
      void saveBlocks("autosave", normalizedBlocks)
    }, 550)
    return () => window.clearTimeout(timer)
  }, [normalizedBlocks, isLoading])

  useEffect(() => {
    if (isLoading) return
    if (title.trim() === lastSavedTitleRef.current.trim()) return
    const timer = window.setTimeout(() => {
      void saveTitle(title)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [title, isLoading])

  async function loadLesson() {
    setIsLoading(true)
    setError(null)

    const [lessonRes, blocksRes] = await Promise.all([
      fetch(`/api/teacher/lessons/${lessonId}`, { cache: "no-store" }),
      fetch(`/api/teacher/lessons/${lessonId}/blocks`, { cache: "no-store" })
    ])

    const lessonJson = (await lessonRes.json().catch(() => null)) as TeacherLessonPayload | null
    const blocksJson = (await blocksRes.json().catch(() => null)) as TeacherBlocksPayload | null

    if (!lessonRes.ok || !lessonJson?.lesson) {
      setError(lessonJson?.error ?? "Не удалось загрузить урок")
      setIsLoading(false)
      return
    }

    if (!blocksRes.ok) {
      setError(blocksJson?.error ?? "Не удалось загрузить блоки")
      setIsLoading(false)
      return
    }

    setTitle(lessonJson.lesson.title)
    setCourseId(lessonJson.lesson.course_id ?? "")
    lastSavedTitleRef.current = lessonJson.lesson.title
    const serverBlocks = (blocksJson?.blocks ?? []).map(normalizeTeacherLessonBlock).sort((left, right) => left.order - right.order)
    setBlocks(serverBlocks)
    lastSavedSnapshotRef.current = snapshotForSave(serverBlocks)
    setSelectedBlockId(null)
    setIsLoading(false)

    if (lessonJson.lesson.course_id) {
      const courseRes = await fetch(`/api/teacher/courses/${lessonJson.lesson.course_id}`, { cache: "no-store" })
      const courseJson = (await courseRes.json().catch(() => null)) as { course?: TeacherCustomCourse } | null
      if (courseJson?.course?.title) setCourseTitle(courseJson.course.title)
    }
  }

  async function saveTitle(nextTitle: string) {
    const safeTitle = nextTitle.trim()
    if (!safeTitle || safeTitle === lastSavedTitleRef.current.trim()) return true
    const res = await fetch(`/api/teacher/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: safeTitle })
    })
    const json = (await res.json().catch(() => null)) as TeacherLessonPayload | null
    if (!res.ok || !json?.lesson) {
      setError(json?.error ?? "Не удалось сохранить название")
      return false
    }
    lastSavedTitleRef.current = safeTitle
    return true
  }

  async function saveBlocks(source: "manual" | "autosave" | "pending" = "manual", candidateBlocks?: TeacherLessonBlock[]) {
    const nextBlocks = candidateBlocks ?? blocksRef.current
    const nextSnapshot = snapshotForSave(nextBlocks)
    if (nextSnapshot === lastSavedSnapshotRef.current && source !== "manual") return true
    if (saveInFlightRef.current) {
      pendingSaveRef.current = true
      if (source === "manual") {
        while (saveInFlightRef.current) {
          await new Promise((resolve) => window.setTimeout(resolve, 60))
        }
        return saveBlocks("manual", candidateBlocks ?? blocksRef.current)
      }
      return false
    }

    saveInFlightRef.current = true
    setIsSaving(true)

    const res = await fetch(`/api/teacher/lessons/${lessonId}/blocks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: nextBlocks.map((block, index) => ({
          type: block.type,
          order: index,
          data: block.data
        }))
      })
    })
    const json = (await res.json().catch(() => null)) as TeacherBlocksPayload | null

    if (!res.ok) {
      setError(json?.error ?? "Не удалось сохранить блоки")
      saveInFlightRef.current = false
      setIsSaving(false)
      return false
    }

    lastSavedSnapshotRef.current = nextSnapshot
    saveInFlightRef.current = false
    setIsSaving(false)
    if (pendingSaveRef.current) {
      pendingSaveRef.current = false
      void saveBlocks("pending", blocksRef.current)
    }
    return true
  }

  async function publishLesson() {
    setIsPublishing(true)
    setError(null)
    const titleSaved = await saveTitle(title)
    const blocksSaved = await saveBlocks("manual", blocksRef.current)
    setIsPublishing(false)
    return titleSaved && blocksSaved
  }

  async function openPreview() {
    const previewWindow = window.open("", "_blank")
    const success = await publishLesson()
    if (!success) {
      previewWindow?.close()
      return
    }
    if (previewWindow) {
      previewWindow.location.href = `/lesson/${lessonId}`
      return
    }
    window.open(`/lesson/${lessonId}`, "_blank")
  }

  function updateBlockData(blockId: string, updater: (current: Record<string, unknown>) => Record<string, unknown>) {
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId
          ? normalizeTeacherLessonBlock({
              ...block,
              data: updater(asRecord(block.data))
            })
          : block
      )
    )
  }

  function updateSelectedBlockData(updater: (current: Record<string, unknown>) => Record<string, unknown>) {
    if (!selectedBlockId) return
    updateBlockData(selectedBlockId, updater)
  }

  function updateSelectedBlockMeta(patch: Partial<LessonBlockMeta>) {
    updateSelectedBlockData((current) => ({
      ...current,
      meta: {
        ...asRecord(current.meta),
        ...patch
      }
    }))
  }

  function addBlock(item: BuilderPaletteItem) {
    const id = `tmp-${crypto.randomUUID()}`
    const baseData = createDefaultBlockData(item.type)
    const nextData = normalizeLessonBlockData(item.type, {
      ...baseData,
      ...item.initialData,
      meta: {
        ...asRecord(baseData.meta),
        title: item.label,
        ...item.initialMeta
      },
      exercise_variant_id: item.id,
      exercise_variant_label: item.label
    })
    const nextBlock: TeacherLessonBlock = normalizeTeacherLessonBlock({
      id,
      lesson_id: lessonId,
      type: item.type,
      order: normalizedBlocks.length,
      data: nextData
    })
    setBlocks((prev) => [...prev, nextBlock])
    setSelectedBlockId(id)
  }

  function removeSelectedBlock() {
    if (!selectedBlockId) return
    removeBlock(selectedBlockId)
  }

  function removeBlock(blockId: string) {
    setBlocks((prev) => prev.filter((block) => block.id !== blockId).map((block, index) => ({ ...block, order: index })))
    setSelectedBlockId((current) => (current === blockId ? null : current))
  }

  function toggleBlock(blockId: string) {
    setSelectedBlockId((current) => (current === blockId ? null : blockId))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = normalizedBlocks.findIndex((block) => block.id === active.id)
    const newIndex = normalizedBlocks.findIndex((block) => block.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    setBlocks(arrayMove(normalizedBlocks, oldIndex, newIndex).map((block, index) => ({ ...block, order: index })))
  }

  function isPaletteItemActive(item: BuilderPaletteItem) {
    if (!selectedBlock || selectedBlock.type !== item.type) return false
    const data = asRecord(selectedBlock.data)
    const variantId = asString(data.exercise_variant_id).trim()
    if (variantId) return variantId === item.id
    const meta = asRecord(data.meta)
    return asString(meta.title).trim() === item.label
  }

  function renderPaletteButton(item: BuilderPaletteItem) {
    const visual = getPaletteItemVisual(item)
    const Icon = visual.icon
    const active = isPaletteItemActive(item)

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => addBlock(item)}
        className={cn(
          "flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition-colors",
          active ? "bg-[var(--ds-neutral-row)]" : "hover:bg-[var(--ds-neutral-row)]"
        )}
      >
        <Tooltip delayDuration={80}>
          <TooltipTrigger asChild>
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", visual.circleClass)}>
              <Icon className={cn("h-[18px] w-[18px]", visual.iconClass)} strokeWidth={1.9} />
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            align="start"
            sideOffset={12}
            className="!w-[320px] !max-w-[320px] !rounded-[22px] !border !border-black/[0.08] !bg-[var(--ds-surface)] !px-4 !py-4 !text-left !text-ds-ink !shadow-[0_24px_60px_-28px_rgba(0,0,0,0.28)] dark:!border-white/[0.08]"
          >
            <div className="mb-3 text-[15px] font-semibold text-ds-ink">{item.label}</div>
            <PalettePreview item={item} />
          </TooltipContent>
        </Tooltip>
        <span className="text-[14px] font-medium leading-[1.25] text-ds-ink">{item.label}</span>
      </button>
    )
  }

  if (isLoading) {
    return (
      <div className="ds-figma-page ds-lesson-editor-page md:-mx-10">
        <div className="mx-auto flex min-h-[60vh] w-full items-center justify-center text-ds-body text-ds-text-secondary">
          Загрузка урока...
        </div>
      </div>
    )
  }

  return (
    <div className="ds-figma-page ds-lesson-editor-page">
      <div className="w-full">
        <div className="grid min-h-[calc(100dvh-5rem)] gap-4 md:grid-cols-[minmax(0,1fr)_264px] xl:grid-cols-[220px_minmax(0,1fr)_272px] 2xl:grid-cols-[228px_minmax(0,1fr)_288px]">
          <aside className="order-2 overflow-hidden rounded-[32px] border border-black/[0.06] bg-[var(--ds-surface)] md:order-3 md:col-span-2 xl:order-1 xl:col-span-1 dark:border-white/[0.08]">
            <div className="border-b border-black/[0.06] px-7 py-6 dark:border-white/[0.08]">
              <Link
                href={courseId ? `/teacher/courses/${courseId}` : "/teacher/courses"}
                className="inline-flex items-center gap-2 text-[16px] font-semibold tracking-[-0.02em] text-ds-ink transition-colors hover:text-ds-text-secondary"
              >
                <ChevronLeft className="h-4 w-4" />
                Назад к курсу
              </Link>
            </div>

            <div className="px-7 pb-3 pt-6">
              <button
                type="button"
                onClick={() => paletteRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="inline-flex items-center gap-3 text-[16px] font-semibold tracking-[-0.02em] text-ds-ink transition-colors hover:text-ds-text-secondary"
              >
                <Plus className="h-5 w-5" />
                Добавить блок
              </button>
            </div>

            <div ref={paletteRef} className="space-y-5 px-5 pb-5">
              {LESSON_BUILDER_PALETTE_SECTIONS.map((section) => (
                <section key={section.id}>
                  <div className="mb-2 px-3">
                      <div className="text-[13px] font-semibold leading-[1.25] tracking-[-0.01em] text-ds-text-tertiary">
                      {section.label}
                    </div>
                      <div className="mt-2 h-px border-t border-dotted border-black/[0.08] dark:border-white/[0.1]" />
                  </div>
                  <div className="space-y-1">{section.items.map((item) => renderPaletteButton(item))}</div>
                </section>
              ))}
            </div>
          </aside>

          <main className="order-1 min-w-0 md:order-1">
            <div className="w-full overflow-hidden rounded-[32px] border border-black/[0.06] bg-[var(--ds-surface)] dark:border-white/[0.08]">
              <div className="px-6 py-6 xl:px-7">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5">
                  <div className="min-w-0">
                    <div className="text-ds-body text-ds-text-secondary">{courseTitle}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Input
                        ref={titleRef}
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        className="ds-lesson-editor-title-field h-auto min-w-0 max-w-full border-0 bg-transparent px-0 text-[clamp(1.95rem,3.2vw,2.55rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-ds-ink shadow-none focus-visible:ring-0"
                      />
                      <button
                        type="button"
                        onClick={() => titleRef.current?.focus()}
                        className={chromeIconButtonClass}
                        aria-label="Редактировать название урока"
                      >
                        <Pencil className="h-[18px] w-[18px]" />
                      </button>
                    </div>
                    {error ? <p className="mt-2 text-[13px] text-[#c0394b]">{error}</p> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => paletteRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      className="inline-flex h-10 items-center gap-2 rounded-[var(--ds-radius-md)] border border-black/[0.08] bg-[var(--ds-surface)] px-4 text-[14px] font-medium text-ds-ink transition-colors hover:bg-[var(--ds-neutral-row)] dark:border-white/[0.08] xl:hidden"
                    >
                      <Plus className="h-4 w-4" />
                      Добавить блок
                    </button>
                    <button
                      type="button"
                      onClick={() => void openPreview()}
                      className="inline-flex h-10 items-center gap-2 rounded-[var(--ds-radius-md)] border border-black/[0.08] bg-[var(--ds-surface)] px-4 text-[14px] font-medium text-ds-ink transition-colors hover:bg-[var(--ds-neutral-row)] dark:border-white/[0.08]"
                    >
                      <Eye className="h-4 w-4" />
                      Превью
                    </button>
                    <button
                      type="button"
                      onClick={() => void publishLesson()}
                      className="inline-flex h-10 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--ds-sage)] px-5 text-[14px] font-semibold text-ds-ink transition-opacity hover:opacity-90"
                    >
                      {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Опубликовать"}
                    </button>
                  </div>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={normalizedBlocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3.5">
                      {normalizedBlocks.map((block) => (
                        <SortableBlockCard
                          key={block.id}
                          block={block}
                          selected={block.id === selectedBlockId}
                          subtitle={getNormalizedBlockSubtitle(block)}
                          onSelect={() => toggleBlock(block.id)}
                          onDelete={() => removeBlock(block.id)}
                        >
                          <BlockEditors
                            block={block}
                            onChange={(nextData) => updateBlockData(block.id, () => nextData)}
                          />
                        </SortableBlockCard>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <div className="mt-3 text-right text-[12px] text-ds-text-secondary">
                  {isSaving ? "Автосохранение..." : "Изменения сохраняются автоматически"}
                </div>
              </div>
            </div>
          </main>

          <div className="order-3 md:order-2 xl:order-3">
            <BlockSettingsPanel
              block={selectedBlock}
              onMetaChange={updateSelectedBlockMeta}
              onBlockChange={updateSelectedBlockData}
              onDelete={removeSelectedBlock}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

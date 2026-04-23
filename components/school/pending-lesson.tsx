import type { CourseLessonFile } from "@/lib/courses/types"

type Props = {
  title: string
  file: CourseLessonFile
}

export function PendingLesson({ title, file }: Props) {
  return (
    <section className="cc-lesson-card">
      <span className="cc-lesson-eyebrow">
        {file.kind === "final_test" ? "Тест" : "Контент в импорте"}
      </span>
      <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      <p className="cc-lesson-note mt-4">
        Материал для этого маршрута ещё не извлечён из исходных презентаций и PDF. Ниже — ссылки на файлы-источники в
        рабочей базе Playground (после пайплайна PPTX/PDF сюда подставится JSON урока).
      </p>
      {file.source?.note ? <p className="cc-lesson-note mt-3">{file.source.note}</p> : null}
      {file.source?.markdown?.length ? (
        <div className="mt-6">
          <p className="cc-lesson-subtitle">Markdown</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--cc-hsk-text)]">
            {file.source.markdown.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {file.source?.htmlBlocks?.length ? (
        <div className="mt-6">
          <p className="cc-lesson-subtitle">HTML-блоки</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--cc-hsk-text)]">
            {file.source.htmlBlocks.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

import Link from "next/link"

export default function TeacherMessagesPage() {
  return (
    <div className="ds-figma-page">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-[26px] font-bold text-ds-ink">Сообщения</h1>
        <p className="mt-3 text-[15px] text-ds-text-secondary">
          Единый чат с учениками для преподавателя подключим на бэкенде. Сейчас используйте кабинет ученика для демо-чатов.
        </p>
        <Link
          href="/teacher/dashboard"
          className="mt-6 inline-block rounded-[var(--ds-radius-md)] bg-ds-ink px-5 py-2.5 text-[15px] font-medium text-white no-underline dark:bg-white dark:text-ds-ink"
        >
          На главную
        </Link>
      </div>
    </div>
  )
}

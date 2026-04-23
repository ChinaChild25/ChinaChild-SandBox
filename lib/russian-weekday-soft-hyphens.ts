const SHY = "\u00AD"

/** Полные названия дней недели (рус.) с мягкими переносами по слогам для узких колонок. */
const MAP: Record<string, string> = {
  Понедельник: `По${SHY}не${SHY}дель${SHY}ник`,
  Вторник: `Вто${SHY}рник`,
  Среда: `Сре${SHY}да`,
  Четверг: `Чет${SHY}верг`,
  Пятница: `Пят${SHY}ни${SHY}ца`,
  Суббота: `Суб${SHY}бо${SHY}та`,
  Воскресенье: `Во${SHY}скре${SHY}се${SHY}нье`
}

export function russianWeekdayWithSoftHyphens(day: string): string {
  return MAP[day] ?? day
}

export function hasSoftHyphens(text: string): boolean {
  return text.includes(SHY)
}

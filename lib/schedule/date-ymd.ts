/** Следующий календарный день YYYY-MM-DD (без часовых поясов — чистая дата). */
export function addOneDayYmd(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((x) => parseInt(x, 10))
  if (![y, m, d].every((n) => Number.isFinite(n))) return dateKey
  const x = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  x.setUTCDate(x.getUTCDate() + 1)
  const yy = x.getUTCFullYear()
  const mm = String(x.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(x.getUTCDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

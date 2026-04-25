import type { UiLocale } from "@/lib/ui-messages"

type DailyErrorRecord = Record<string, unknown>

function pickLocale<T>(locale: UiLocale, values: { ru: T; en: T; zh: T }): T {
  if (locale === "en") return values.en
  if (locale === "zh") return values.zh
  return values.ru
}

function readObjectStringValue(record: DailyErrorRecord, key: string): string | undefined {
  const value = record[key]
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

export function extractDailyErrorCode(input: unknown): string | undefined {
  if (!input) return undefined
  if (typeof input === "string") {
    const value = input.trim()
    return value || undefined
  }
  if (typeof input !== "object") return undefined

  const record = input as DailyErrorRecord
  const direct =
    readObjectStringValue(record, "errorMsg") ??
    readObjectStringValue(record, "error") ??
    readObjectStringValue(record, "message") ??
    readObjectStringValue(record, "reason") ??
    readObjectStringValue(record, "details")

  if (direct) return direct

  const nestedError = record.error
  if (nestedError && typeof nestedError === "object") {
    return extractDailyErrorCode(nestedError)
  }

  return undefined
}

export function humanizeDailyError(
  input: unknown,
  locale: UiLocale,
  fallback?: string
): string {
  const code = extractDailyErrorCode(input)

  if (code === "account-missing-payment-method") {
    return pickLocale(locale, {
      ru: "Аккаунт Daily еще не готов к звонкам: в Daily нужно добавить способ оплаты. Пока этого нет, Daily отклоняет подключение к комнате.",
      en: "The Daily account is not ready for calls yet: add a payment method in Daily. Until then, Daily will reject room joins.",
      zh: "Daily 账号目前还不能用于通话：需要先在 Daily 中添加付款方式。否则 Daily 会拒绝加入房间。"
    })
  }

  if (code === "The teacher has not started this lesson yet.") {
    return pickLocale(locale, {
      ru: "Преподаватель еще не начал занятие.",
      en: "The teacher has not started the lesson yet.",
      zh: "老师还没有开始上课。"
    })
  }

  if (code === "permissions") {
    return pickLocale(locale, {
      ru: "Браузер не дал доступ к камере или микрофону.",
      en: "The browser did not grant access to the camera or microphone.",
      zh: "浏览器没有授予摄像头或麦克风权限。"
    })
  }

  if (code === "not-found") {
    return pickLocale(locale, {
      ru: "Камера или микрофон не найдены на устройстве.",
      en: "No camera or microphone was found on this device.",
      zh: "设备上未找到摄像头或麦克风。"
    })
  }

  if (code && code !== "[object Object]") {
    return code
  }

  return (
    fallback ??
    pickLocale(locale, {
      ru: "Не удалось подключиться к звонку.",
      en: "Unable to join the call.",
      zh: "无法加入通话。"
    })
  )
}

const YOOKASSA_API_BASE = "https://api.yookassa.ru/v3"

type YooKassaAmount = {
  value: string
  currency: "RUB"
}

type YooKassaPaymentMetadata = Record<string, string>

export type YooKassaPayment = {
  id: string
  status: string
  paid?: boolean
  amount: YooKassaAmount
  description?: string
  metadata?: YooKassaPaymentMetadata
  confirmation?: {
    type?: string
    confirmation_token?: string
  }
}

function getYooKassaShopId(): string | undefined {
  return process.env.YOOKASSA_SHOP_ID?.trim() || undefined
}

function getYooKassaSecretKey(): string | undefined {
  return process.env.YOOKASSA_SECRET_KEY?.trim() || undefined
}

function getAuthHeader(): string {
  const shopId = getYooKassaShopId()
  const secretKey = getYooKassaSecretKey()

  if (!shopId || !secretKey) {
    throw new Error("YooKassa env vars are not set")
  }

  return `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`
}

function asRubAmount(value: number): string {
  return value.toFixed(2)
}

async function requestYooKassa<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${YOOKASSA_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  })

  const payload = (await res.json().catch(() => null)) as
    | (T & { description?: string })
    | { type?: string; description?: string }
    | null

  if (!res.ok || !payload) {
    const description =
      payload && typeof payload === "object" && "description" in payload && typeof payload.description === "string"
        ? payload.description
        : `YooKassa request failed with status ${res.status}`
    throw new Error(description)
  }

  return payload as T
}

export async function createYooKassaPayment(params: {
  amountRub: number
  description: string
  metadata: YooKassaPaymentMetadata
  idempotenceKey: string
}) {
  return requestYooKassa<YooKassaPayment>("/payments", {
    method: "POST",
    headers: {
      "Idempotence-Key": params.idempotenceKey
    },
    body: JSON.stringify({
      amount: {
        value: asRubAmount(params.amountRub),
        currency: "RUB"
      },
      capture: true,
      confirmation: {
        type: "embedded"
      },
      description: params.description,
      metadata: params.metadata
    })
  })
}

export async function fetchYooKassaPayment(paymentId: string) {
  return requestYooKassa<YooKassaPayment>(`/payments/${encodeURIComponent(paymentId)}`)
}


export function getAppEnvironment(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase()
  if (explicit) return explicit

  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase()
  if (vercelEnv === "preview") return "preview"

  return undefined
}

export function getAppEnvironmentLabel(): string | undefined {
  const explicitLabel = process.env.NEXT_PUBLIC_APP_ENV_LABEL?.trim()
  if (explicitLabel) return explicitLabel

  const appEnvironment = getAppEnvironment()
  if (appEnvironment === "sandbox" || appEnvironment === "staging") {
    return "Песочница"
  }
  if (appEnvironment === "preview") {
    return "Preview"
  }

  return undefined
}

export function isSandboxEnvironment(): boolean {
  return Boolean(getAppEnvironmentLabel())
}

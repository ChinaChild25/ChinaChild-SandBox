import type { SupabaseClient } from "@supabase/supabase-js"
import type { User as SupabaseAuthUser } from "@supabase/supabase-js"
import type { User, UserRole } from "@/lib/types"
import { mockTeacherUser, mockUser } from "@/lib/mock-data"

export type ProfileRow = {
  id: string
  role: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  ui_accent?: "sage" | "pink" | "blue" | "orange" | null
  online_meeting_url: string | null
  /** 0–5, только для role = student */
  hsk_level?: number | null
  /** 1–5, цель экзамена */
  hsk_goal?: number | null
  created_at: string | null
  updated_at: string | null
}

/** Явный список колонок ломает вход, если в удалённой БД ещё нет миграций (например hsk_goal). `*` возвращает только существующие поля. */
const PROFILE_SELECT = "*"

function parseRole(raw: string): UserRole | null {
  const r = String(raw).trim().toLowerCase()
  if (r === "student" || r === "teacher" || r === "curator") return r
  return null
}

/** Для UI (чат, списки), без привязки к auth user. */
export function displayNameFromProfileFields(
  profile: Pick<ProfileRow, "first_name" | "last_name" | "full_name">,
  emailFallback?: string | null
): string {
  const fn = profile.first_name?.trim() ?? ""
  const ln = profile.last_name?.trim() ?? ""
  const combined = [fn, ln].filter(Boolean).join(" ").trim()
  const full = profile.full_name?.trim() ?? ""
  return full || combined || emailFallback?.split("@")[0] || "Пользователь"
}

function displayNameFromProfile(profile: ProfileRow, email: string | null): string {
  return displayNameFromProfileFields(profile, email)
}

export function mapProfileRowToAppUser(profile: ProfileRow, email: string | null): User {
  const role = parseRole(profile.role) ?? "student"
  const template = role === "teacher" || role === "curator" ? mockTeacherUser : mockUser
  const name = displayNameFromProfile(profile, email)
  const avatar =
    typeof profile.avatar_url === "string" && profile.avatar_url.trim()
      ? profile.avatar_url.trim()
      : template.avatar

  const joinFromProfile =
    profile.created_at && !Number.isNaN(Date.parse(profile.created_at))
      ? profile.created_at.slice(0, 10)
      : template.joinDate

  const meetingUrl = profile.online_meeting_url?.trim()

  return {
    ...template,
    id: profile.id,
    email: email ?? template.email,
    name,
    role,
    avatar,
    uiAccent: profile.ui_accent ?? null,
    phone: profile.phone?.trim() || undefined,
    firstName: profile.first_name?.trim() || undefined,
    lastName: profile.last_name?.trim() || undefined,
    profileFullName: profile.full_name?.trim() || undefined,
    joinDate: joinFromProfile,
    hskLevel: role === "student" ? profile.hsk_level ?? null : undefined,
    hskGoal: role === "student" ? profile.hsk_goal ?? null : undefined,
    onlineMeetingUrl:
      role === "teacher" && meetingUrl && /^https?:\/\//i.test(meetingUrl) ? meetingUrl : undefined
  }
}

export type ProfileFetchResult =
  | { ok: true; user: User }
  | { ok: false; message: string }

export async function fetchProfileForAuthUser(
  supabase: SupabaseClient,
  authUser: SupabaseAuthUser
): Promise<ProfileFetchResult> {
  let { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", authUser.id)
    .maybeSingle()

  if (error) {
    console.error("[fetchProfileForAuthUser]", error.code ?? "", error.message)
    return {
      ok: false,
      message:
        "Не удалось загрузить профиль из базы. Проверьте подключение и политики RLS для таблицы profiles."
    }
  }

  if (!data) {
    const rpcHeal = await supabase.rpc("ensure_profile_for_current_user")
    if (!rpcHeal.error) {
      const refetch = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("id", authUser.id)
        .maybeSingle()
      if (!refetch.error && refetch.data) {
        data = refetch.data
        error = null
      } else {
        error = refetch.error
      }
    }
  }

  if (!data) {
    const fullNameFromMeta =
      typeof authUser.user_metadata?.full_name === "string" ? authUser.user_metadata.full_name.trim() : ""
    const fallbackName = authUser.email?.split("@")[0] ?? "Пользователь"
    const seedName = fullNameFromMeta || fallbackName
    const parts = seedName.split(/\s+/).filter(Boolean)
    const firstName = parts[0] ?? null
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null

    const insertAttempt = await supabase.from("profiles").insert({
      id: authUser.id,
      role: "student",
      full_name: seedName,
      first_name: firstName,
      last_name: lastName
    })

    if (!insertAttempt.error) {
      const refetch = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("id", authUser.id)
        .maybeSingle()
      if (!refetch.error && refetch.data) {
        data = refetch.data
        error = null
      } else {
        error = refetch.error
      }
    }
  }

  if (!data) {
    const hint = error?.message ?? "для вашего аккаунта нет строки в public.profiles и auto-provision не сработал."
    return {
      ok: false,
      message: `Профиль не найден: ${hint}`
    }
  }

  const row = data as ProfileRow
  if (!parseRole(row.role)) {
    return {
      ok: false,
      message: `В профиле указана неподдерживаемая роль («${row.role}»). Допустимо: student, teacher или curator.`
    }
  }

  return { ok: true, user: mapProfileRowToAppUser(row, authUser.email ?? null) }
}

export type ProfileWritableFields = {
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  phone?: string | null
  avatar_url?: string | null
  ui_accent?: "sage" | "pink" | "blue" | "orange" | null
  /** Только для преподавателя; пустая строка → null */
  online_meeting_url?: string | null
  /** Только ученик — своя цель HSK 1–5 */
  hsk_goal?: number | null
}

export async function updateProfileFields(
  supabase: SupabaseClient,
  userId: string,
  fields: ProfileWritableFields
): Promise<{ error: Error | null }> {
  const payload: Record<string, string | number | null> = {}
  if (fields.first_name !== undefined) payload.first_name = fields.first_name
  if (fields.last_name !== undefined) payload.last_name = fields.last_name
  if (fields.full_name !== undefined) payload.full_name = fields.full_name
  if (fields.phone !== undefined) payload.phone = fields.phone
  if (fields.avatar_url !== undefined) payload.avatar_url = fields.avatar_url
  if (fields.ui_accent !== undefined) payload.ui_accent = fields.ui_accent
  if (fields.online_meeting_url !== undefined) payload.online_meeting_url = fields.online_meeting_url
  if (fields.hsk_goal !== undefined) payload.hsk_goal = fields.hsk_goal

  if (Object.keys(payload).length === 0) return { error: null }

  const { error } = await supabase.from("profiles").update(payload).eq("id", userId)
  return { error: error ? new Error(error.message) : null }
}

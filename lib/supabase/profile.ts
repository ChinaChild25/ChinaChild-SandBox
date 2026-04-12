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
  created_at: string | null
  updated_at: string | null
}

const PROFILE_COLUMNS =
  "id, role, first_name, last_name, full_name, phone, avatar_url, created_at, updated_at"

function parseRole(raw: string): UserRole | null {
  const r = String(raw).trim().toLowerCase()
  if (r === "student" || r === "teacher") return r
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
  const template = role === "teacher" ? mockTeacherUser : mockUser
  const name = displayNameFromProfile(profile, email)
  const avatar =
    typeof profile.avatar_url === "string" && profile.avatar_url.trim()
      ? profile.avatar_url.trim()
      : template.avatar

  const joinFromProfile =
    profile.created_at && !Number.isNaN(Date.parse(profile.created_at))
      ? profile.created_at.slice(0, 10)
      : template.joinDate

  return {
    ...template,
    id: profile.id,
    email: email ?? template.email,
    name,
    role,
    avatar,
    phone: profile.phone?.trim() || undefined,
    firstName: profile.first_name?.trim() || undefined,
    lastName: profile.last_name?.trim() || undefined,
    profileFullName: profile.full_name?.trim() || undefined,
    joinDate: joinFromProfile
  }
}

export type ProfileFetchResult =
  | { ok: true; user: User }
  | { ok: false; message: string }

export async function fetchProfileForAuthUser(
  supabase: SupabaseClient,
  authUser: SupabaseAuthUser
): Promise<ProfileFetchResult> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
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
    return {
      ok: false,
      message:
        "Профиль не найден: для вашего аккаунта нет строки в public.profiles. Обычно она создаётся триггером при регистрации — обратитесь к администратору."
    }
  }

  const row = data as ProfileRow
  if (!parseRole(row.role)) {
    return {
      ok: false,
      message: `В профиле указана неподдерживаемая роль («${row.role}»). Допустимо: student или teacher.`
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
}

export async function updateProfileFields(
  supabase: SupabaseClient,
  userId: string,
  fields: ProfileWritableFields
): Promise<{ error: Error | null }> {
  const payload: Record<string, string | null> = {}
  if (fields.first_name !== undefined) payload.first_name = fields.first_name
  if (fields.last_name !== undefined) payload.last_name = fields.last_name
  if (fields.full_name !== undefined) payload.full_name = fields.full_name
  if (fields.phone !== undefined) payload.phone = fields.phone
  if (fields.avatar_url !== undefined) payload.avatar_url = fields.avatar_url

  if (Object.keys(payload).length === 0) return { error: null }

  const { error } = await supabase.from("profiles").update(payload).eq("id", userId)
  return { error: error ? new Error(error.message) : null }
}

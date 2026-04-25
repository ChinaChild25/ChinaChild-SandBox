import { NextResponse } from "next/server"
import {
  createDailyLessonMeetingToken,
  createDailyLessonRoomName,
  createOrGetDailyLessonRoom,
  createOrGetDailyScheduleSlotRoom,
  createDailyScheduleSlotRoomName,
  getDailyRoomNameFromUrl,
  isDailyConfigured,
  isDailyUserPresentInRoom,
  shouldEnforceTeacherStart,
} from "@/lib/daily/server"
import { wallClockFromSlotAt } from "@/lib/schedule-display-tz"
import { displayNameFromProfileFields } from "@/lib/supabase/profile"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type ProfileRole = "student" | "teacher" | "curator"

type CreateRoomBody = {
  lessonId?: string
  scheduleSlotId?: string
}

type LessonAccessRow = {
  id: string
  title: string
  room_url: string | null
  courses: {
    id: string
    title: string | null
    teacher_id: string | null
  } | null
}

type ScheduleSlotAccessRow = {
  id: string
  slot_at: string
  teacher_id: string
  booked_student_id: string | null
  status: "free" | "busy" | "booked"
}

type ProfileRow = {
  id: string
  role: ProfileRole
  first_name: string | null
  last_name: string | null
  full_name: string | null
}

function isTeacherRole(role: ProfileRole): boolean {
  return role === "teacher" || role === "curator"
}

function formatScheduleSlotSubtitle(slotAt: string): string {
  const { dateKey, time } = wallClockFromSlotAt(slotAt)
  const [year, month, day] = dateKey.split("-").map((value) => Number.parseInt(value, 10))
  const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC"
  }).format(anchor)

  return `${dateLabel} · ${time}`
}

export async function POST(request: Request) {
  if (!isDailyConfigured()) {
    return NextResponse.json(
      { error: "Daily не настроен на сервере. Добавьте DAILY_API_KEY." },
      { status: 500 }
    )
  }

  const body = (await request.json().catch(() => null)) as CreateRoomBody | null
  const lessonId = body?.lessonId?.trim()
  const scheduleSlotId = body?.scheduleSlotId?.trim()
  if (!lessonId && !scheduleSlotId) {
    return NextResponse.json({ error: "Нужно передать lessonId или scheduleSlotId." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Нужна авторизация." }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name, full_name")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  if (!profile) {
    return NextResponse.json({ error: "Профиль не найден." }, { status: 404 })
  }

  if (lessonId) {
    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("id, title, room_url, courses(id, title, teacher_id)")
      .eq("id", lessonId)
      .maybeSingle<LessonAccessRow>()

    if (lessonError) {
      return NextResponse.json({ error: lessonError.message }, { status: 400 })
    }

    if (!lesson) {
      return NextResponse.json({ error: "Урок не найден." }, { status: 404 })
    }

    let roomUrl = lesson.room_url?.trim() || ""
    let roomName = getDailyRoomNameFromUrl(roomUrl) ?? createDailyLessonRoomName(lessonId)

    if (!roomUrl) {
      try {
        const room = await createOrGetDailyLessonRoom(lessonId)
        roomUrl = room.url
        roomName = room.name

        const adminSupabase = createAdminSupabaseClient()
        const { error: updateError } = await adminSupabase
          .from("lessons")
          .update({ room_url: roomUrl })
          .eq("id", lessonId)

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 })
        }
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Не удалось создать комнату Daily." },
          { status: 500 }
        )
      }
    }

    if (!isTeacherRole(profile.role) && shouldEnforceTeacherStart()) {
      const teacherId = lesson.courses?.teacher_id?.trim()
      if (teacherId) {
        try {
          const teacherHasStarted = await isDailyUserPresentInRoom(roomName, teacherId)
          if (!teacherHasStarted) {
            return NextResponse.json(
              {
                error: "Преподаватель еще не начал занятие.",
                roomUrl,
                teacherHasStarted: false
              },
              { status: 409 }
            )
          }
        } catch (error) {
          return NextResponse.json(
            { error: error instanceof Error ? error.message : "Не удалось проверить присутствие преподавателя." },
            { status: 500 }
          )
        }
      }
    }

    const userName = displayNameFromProfileFields(profile, user.email ?? null)

    try {
      const token = await createDailyLessonMeetingToken({
        roomName,
        userId: profile.id,
        userName,
        isOwner: isTeacherRole(profile.role)
      })

      return NextResponse.json({
        roomUrl,
        token,
        role: profile.role,
        context: {
          title: lesson.title,
          subtitle: lesson.courses?.title ?? null
        },
        teacherHasStarted: true
      })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Не удалось создать токен Daily." },
        { status: 500 }
      )
    }
  }

  const { data: scheduleSlot, error: scheduleSlotError } = await supabase
    .from("teacher_schedule_slots")
    .select("id, slot_at, teacher_id, booked_student_id, status")
    .eq("id", scheduleSlotId!)
    .maybeSingle<ScheduleSlotAccessRow>()

  if (scheduleSlotError) {
    return NextResponse.json({ error: scheduleSlotError.message }, { status: 400 })
  }

  if (!scheduleSlot) {
    return NextResponse.json({ error: "Слот занятия не найден." }, { status: 404 })
  }

  if (scheduleSlot.status !== "booked" || !scheduleSlot.booked_student_id) {
    return NextResponse.json({ error: "Для этого слота еще нет активного занятия." }, { status: 409 })
  }

  if (isTeacherRole(profile.role)) {
    if (scheduleSlot.teacher_id !== profile.id) {
      return NextResponse.json({ error: "У вас нет доступа к этому занятию." }, { status: 403 })
    }
  } else if (scheduleSlot.booked_student_id !== profile.id) {
    return NextResponse.json({ error: "У вас нет доступа к этому занятию." }, { status: 403 })
  }

  const scheduleRoomName = createDailyScheduleSlotRoomName(scheduleSlot.id)
  let scheduleRoomUrl = ""
  try {
    const room = await createOrGetDailyScheduleSlotRoom(scheduleSlot.id)
    scheduleRoomUrl = room.url
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать комнату Daily." },
      { status: 500 }
    )
  }

  if (!isTeacherRole(profile.role) && shouldEnforceTeacherStart()) {
    try {
      const teacherHasStarted = await isDailyUserPresentInRoom(scheduleRoomName, scheduleSlot.teacher_id)
      if (!teacherHasStarted) {
        return NextResponse.json(
          {
            error: "Преподаватель еще не начал занятие.",
            roomUrl: scheduleRoomUrl,
            teacherHasStarted: false
          },
          { status: 409 }
        )
      }
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Не удалось проверить присутствие преподавателя." },
        { status: 500 }
      )
    }
  }

  const scheduleUserName = displayNameFromProfileFields(profile, user.email ?? null)

  try {
    const token = await createDailyLessonMeetingToken({
      roomName: scheduleRoomName,
      userId: profile.id,
      userName: scheduleUserName,
      isOwner: isTeacherRole(profile.role)
    })

    return NextResponse.json({
      roomUrl: scheduleRoomUrl,
      token,
      role: profile.role,
      context: {
        title: "Онлайн-занятие",
        subtitle: formatScheduleSlotSubtitle(scheduleSlot.slot_at)
      },
      teacherHasStarted: true
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать токен Daily." },
      { status: 500 }
    )
  }
}

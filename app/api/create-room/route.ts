import { NextResponse } from "next/server"
import {
  createDailyLessonMeetingToken,
  isDailyConfigured,
  isDailyUserPresentInRoom,
  shouldEnforceTeacherStart,
} from "@/lib/daily/server"
import {
  ensureActiveLessonSession,
  isTeacherProfileRole,
  resolveRoomForLesson,
  resolveRoomForScheduleSlot,
} from "@/lib/live-lessons/server"
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

  const adminSupabase = createAdminSupabaseClient()

  if (lessonId) {
    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("id, title, courses(id, title, teacher_id)")
      .eq("id", lessonId)
      .maybeSingle<LessonAccessRow>()

    if (lessonError) {
      return NextResponse.json({ error: lessonError.message }, { status: 400 })
    }

    if (!lesson) {
      return NextResponse.json({ error: "Урок не найден." }, { status: 404 })
    }

    const lessonTeacherId = lesson.courses?.teacher_id?.trim() || null
    const lessonStudentId = isTeacherProfileRole(profile.role) ? null : profile.id
    let room: Awaited<ReturnType<typeof resolveRoomForLesson>>
    let session: Awaited<ReturnType<typeof ensureActiveLessonSession>>

    try {
      room = await resolveRoomForLesson({
        adminSupabase,
        lessonId,
        teacherId: lessonTeacherId,
        studentId: lessonStudentId,
      })
      session = await ensureActiveLessonSession({
        adminSupabase,
        roomId: room.id,
        lessonId,
        teacherId: lessonTeacherId,
        studentId: lessonStudentId,
        context: {
          source: "lesson",
          lesson_title: lesson.title,
          course_title: lesson.courses?.title ?? null,
          room_scope: room.room_type,
        },
      })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Не удалось подготовить live-сессию." },
        { status: 500 }
      )
    }

    if (!isTeacherProfileRole(profile.role) && shouldEnforceTeacherStart()) {
      const teacherId = lessonTeacherId
      if (teacherId) {
        try {
          const teacherHasStarted = await isDailyUserPresentInRoom(room.daily_room_name, teacherId)
          if (!teacherHasStarted) {
            return NextResponse.json(
              {
                error: "Преподаватель еще не начал занятие.",
                roomUrl: room.daily_room_url,
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
        roomName: room.daily_room_name,
        userId: profile.id,
        userName,
        isOwner: isTeacherProfileRole(profile.role)
      })

      return NextResponse.json({
        roomUrl: room.daily_room_url,
        token,
        sessionId: session.id,
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

  if (isTeacherProfileRole(profile.role)) {
    if (scheduleSlot.teacher_id !== profile.id) {
      return NextResponse.json({ error: "У вас нет доступа к этому занятию." }, { status: 403 })
    }
  } else if (scheduleSlot.booked_student_id !== profile.id) {
    return NextResponse.json({ error: "У вас нет доступа к этому занятию." }, { status: 403 })
  }

  let room: Awaited<ReturnType<typeof resolveRoomForScheduleSlot>>
  let session: Awaited<ReturnType<typeof ensureActiveLessonSession>>
  try {
    room = await resolveRoomForScheduleSlot({
      adminSupabase,
      scheduleSlotId: scheduleSlot.id,
      teacherId: scheduleSlot.teacher_id,
      studentId: scheduleSlot.booked_student_id,
    })
    session = await ensureActiveLessonSession({
      adminSupabase,
      roomId: room.id,
      scheduleSlotId: scheduleSlot.id,
      teacherId: scheduleSlot.teacher_id,
      studentId: scheduleSlot.booked_student_id,
      context: {
        source: "schedule",
        slot_at: scheduleSlot.slot_at,
        room_scope: room.room_type,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось подготовить live-сессию." },
      { status: 500 }
    )
  }

  if (!isTeacherProfileRole(profile.role) && shouldEnforceTeacherStart()) {
    try {
      const teacherHasStarted = await isDailyUserPresentInRoom(room.daily_room_name, scheduleSlot.teacher_id)
      if (!teacherHasStarted) {
        return NextResponse.json(
          {
            error: "Преподаватель еще не начал занятие.",
            roomUrl: room.daily_room_url,
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
      roomName: room.daily_room_name,
      userId: profile.id,
      userName: scheduleUserName,
      isOwner: isTeacherProfileRole(profile.role)
    })

    return NextResponse.json({
      roomUrl: room.daily_room_url,
      token,
      sessionId: session.id,
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

import { NextResponse } from "next/server"
import {
  createDailyLessonMeetingToken,
  createDailyLessonRoomName,
  createOrGetDailyLessonRoom,
  getDailyRoomNameFromUrl,
  isDailyConfigured,
  isDailyUserPresentInRoom,
  shouldEnforceTeacherStart,
} from "@/lib/daily/server"
import { displayNameFromProfileFields } from "@/lib/supabase/profile"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type ProfileRole = "student" | "teacher" | "curator"

type CreateRoomBody = {
  lessonId?: string
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

export async function POST(request: Request) {
  if (!isDailyConfigured()) {
    return NextResponse.json(
      { error: "Daily is not configured. Set DAILY_API_KEY on the server." },
      { status: 500 }
    )
  }

  const body = (await request.json().catch(() => null)) as CreateRoomBody | null
  const lessonId = body?.lessonId?.trim()
  if (!lessonId) {
    return NextResponse.json({ error: "lessonId is required" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, title, room_url, courses(id, title, teacher_id)")
    .eq("id", lessonId)
    .maybeSingle<LessonAccessRow>()

  if (lessonError) {
    return NextResponse.json({ error: lessonError.message }, { status: 400 })
  }

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
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
        { error: error instanceof Error ? error.message : "Unable to create Daily room" },
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
              error: "The teacher has not started this lesson yet.",
              roomUrl,
              teacherHasStarted: false
            },
            { status: 409 }
          )
        }
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Unable to verify teacher presence" },
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
      lesson: {
        id: lesson.id,
        title: lesson.title,
        courseTitle: lesson.courses?.title ?? null
      },
      teacherHasStarted: true
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create Daily meeting token" },
      { status: 500 }
    )
  }
}

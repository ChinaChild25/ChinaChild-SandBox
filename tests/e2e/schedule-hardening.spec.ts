import { expect, test } from "@playwright/test"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

type TeacherSlot = {
  teacher_id: string
  slot_at: string
  status: "free" | "busy" | "booked"
  booked_student_id: string | null
}

const supabaseUrl = process.env.E2E_SUPABASE_URL
const anonKey = process.env.E2E_SUPABASE_ANON_KEY
const teacherEmail = process.env.E2E_TEACHER_EMAIL
const teacherPassword = process.env.E2E_TEACHER_PASSWORD
const studentAEmail = process.env.E2E_STUDENT_A_EMAIL
const studentAPassword = process.env.E2E_STUDENT_A_PASSWORD
const studentBEmail = process.env.E2E_STUDENT_B_EMAIL
const studentBPassword = process.env.E2E_STUDENT_B_PASSWORD
const targetTeacherId = process.env.E2E_TEACHER_ID
const targetSlotAt = process.env.E2E_SLOT_AT_UTC
const targetNewSlotAt = process.env.E2E_NEW_SLOT_AT_UTC

const missingEnv = [
  ["E2E_SUPABASE_URL", supabaseUrl],
  ["E2E_SUPABASE_ANON_KEY", anonKey],
  ["E2E_TEACHER_EMAIL", teacherEmail],
  ["E2E_TEACHER_PASSWORD", teacherPassword],
  ["E2E_STUDENT_A_EMAIL", studentAEmail],
  ["E2E_STUDENT_A_PASSWORD", studentAPassword],
  ["E2E_STUDENT_B_EMAIL", studentBEmail],
  ["E2E_STUDENT_B_PASSWORD", studentBPassword],
  ["E2E_TEACHER_ID", targetTeacherId],
  ["E2E_SLOT_AT_UTC", targetSlotAt],
  ["E2E_NEW_SLOT_AT_UTC", targetNewSlotAt]
]
  .filter(([, value]) => !value)
  .map(([name]) => name)

test.skip(missingEnv.length > 0, `Missing env for e2e: ${missingEnv.join(", ")}`)

async function authClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(supabaseUrl!, anonKey!)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return client
}

async function getSlot(client: SupabaseClient, teacherId: string, slotAt: string): Promise<TeacherSlot> {
  const { data, error } = await client
    .from("teacher_schedule_slots")
    .select("teacher_id, slot_at, status, booked_student_id")
    .eq("teacher_id", teacherId)
    .eq("slot_at", slotAt)
    .single<TeacherSlot>()
  if (error || !data) throw new Error(error?.message ?? "Slot not found")
  return data
}

test.describe("schedule hardening smoke suite", () => {
  test("student booking/cancel/reschedule flow stays consistent", async () => {
    const studentA = await authClient(studentAEmail!, studentAPassword!)
    const teacher = await authClient(teacherEmail!, teacherPassword!)

    await test.step("book free slot", async () => {
      const { data: me } = await studentA.auth.getUser()
      const { error } = await studentA.rpc("book_slot_atomic", {
        p_teacher_id: targetTeacherId!,
        p_slot_at: targetSlotAt!,
        p_student_id: me.user!.id
      })
      expect(error?.message).toBeFalsy()
      const slot = await getSlot(teacher, targetTeacherId!, targetSlotAt!)
      expect(slot.status).toBe("booked")
      expect(slot.booked_student_id).toBe(me.user!.id)
    })

    await test.step("double booking is rejected", async () => {
      const { data: me } = await studentA.auth.getUser()
      const { error } = await studentA.rpc("book_slot_atomic", {
        p_teacher_id: targetTeacherId!,
        p_slot_at: targetSlotAt!,
        p_student_id: me.user!.id
      })
      expect(error?.message).toContain("slot is not available")
    })

    await test.step("reschedule moves ownership atomically", async () => {
      const { data: me } = await studentA.auth.getUser()
      const { error } = await studentA.rpc("reschedule_slot_atomic", {
        p_old_slot_at: targetSlotAt!,
        p_new_slot_at: targetNewSlotAt!,
        p_teacher_id: targetTeacherId!,
        p_student_id: me.user!.id
      })
      expect(error?.message).toBeFalsy()

      const oldSlot = await getSlot(teacher, targetTeacherId!, targetSlotAt!)
      const newSlot = await getSlot(teacher, targetTeacherId!, targetNewSlotAt!)
      expect(oldSlot.status).toBe("free")
      expect(oldSlot.booked_student_id).toBeNull()
      expect(newSlot.status).toBe("booked")
      expect(newSlot.booked_student_id).toBe(me.user!.id)
    })

    await test.step("cancel frees slot and removes booking", async () => {
      const { data: me } = await studentA.auth.getUser()
      const { error } = await studentA.rpc("cancel_slot_atomic", {
        p_slot_at: targetNewSlotAt!,
        p_teacher_id: targetTeacherId!,
        p_student_id: me.user!.id
      })
      expect(error?.message).toBeFalsy()
      const slot = await getSlot(teacher, targetTeacherId!, targetNewSlotAt!)
      expect(slot.status).toBe("free")
      expect(slot.booked_student_id).toBeNull()
    })
  })

  test("race: only one of two parallel bookings succeeds", async () => {
    const studentA = await authClient(studentAEmail!, studentAPassword!)
    const studentB = await authClient(studentBEmail!, studentBPassword!)
    const teacher = await authClient(teacherEmail!, teacherPassword!)
    const { data: meA } = await studentA.auth.getUser()
    const { data: meB } = await studentB.auth.getUser()

    const [resultA, resultB] = await Promise.allSettled([
      studentA.rpc("book_slot_atomic", {
        p_teacher_id: targetTeacherId!,
        p_slot_at: targetSlotAt!,
        p_student_id: meA.user!.id
      }),
      studentB.rpc("book_slot_atomic", {
        p_teacher_id: targetTeacherId!,
        p_slot_at: targetSlotAt!,
        p_student_id: meB.user!.id
      })
    ])

    const errors = [resultA, resultB].map((result) => {
      if (result.status === "rejected") return result.reason?.message ?? "rejected"
      return result.value.error?.message ?? ""
    })
    const successCount = errors.filter((message) => !message).length
    expect(successCount).toBe(1)

    const slot = await getSlot(teacher, targetTeacherId!, targetSlotAt!)
    expect(slot.status).toBe("booked")
    expect([meA.user!.id, meB.user!.id]).toContain(slot.booked_student_id)
  })
})

import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"

import type { CourseLessonFile } from "@/lib/courses/types"

export async function loadCourseLessonJson(
  courseId: string,
  slug: string
): Promise<CourseLessonFile | null> {
  const file = path.join(process.cwd(), "data", "courses", courseId, `${slug}.json`)
  try {
    const raw = await readFile(file, "utf-8")
    return JSON.parse(raw) as CourseLessonFile
  } catch {
    return null
  }
}

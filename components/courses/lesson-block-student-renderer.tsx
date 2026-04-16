import type { TeacherLessonBlock } from "@/lib/types"
import { BlockRenderer } from "@/components/lesson-builder/block-renderer"

export function LessonBlockStudentRenderer({ blocks }: { blocks: TeacherLessonBlock[] }) {
  return <BlockRenderer blocks={blocks} />
}

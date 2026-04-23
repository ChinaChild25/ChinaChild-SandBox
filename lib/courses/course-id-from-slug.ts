/** Map URL lesson slug to folder under data/courses (hsk-1 lives under hsk1). */
export function courseIdFromLessonSlug(slug: string): "hsk1" | "hsk2" | null {
  if (slug === "hsk-1" || slug.startsWith("hsk1-")) return "hsk1"
  if (slug.startsWith("hsk2-")) return "hsk2"
  return null
}

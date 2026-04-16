export type LessonVideoEmbed =
  | { mode: "iframe"; src: string; title: string }
  | { mode: "native" }

function normalizeVideoUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const iframeSrcMatch = trimmed.match(/src=(['"])(.*?)\1/i)
  if (iframeSrcMatch?.[2]) {
    return iframeSrcMatch[2].trim()
  }

  if (/^(youtu\.be|(?:www\.)?(?:m\.|music\.)?youtube\.com|(?:www\.)?youtube-nocookie\.com|(?:www\.)?vimeo\.com)\//i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, "")}`
  }

  return trimmed
}

function youtubeVideoId(raw: string): string | null {
  const trimmed = normalizeVideoUrl(raw)
  if (!trimmed) return null
  try {
    const u = new URL(trimmed)
    const host = u.hostname.replace(/^www\./, "")
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0]
      return id && /^[\w-]{6,}$/.test(id) ? id : null
    }
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (u.pathname.startsWith("/watch")) {
        const id = u.searchParams.get("v")
        return id && /^[\w-]{6,}$/.test(id) ? id : null
      }
      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.split("/")[2]
        return id && /^[\w-]{6,}$/.test(id) ? id : null
      }
      if (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/live/")) {
        const id = u.pathname.split("/")[2]
        return id && /^[\w-]{6,}$/.test(id) ? id : null
      }
    }
  } catch {
    /* relative or invalid */
  }
  return null
}

function vimeoVideoId(raw: string): string | null {
  const trimmed = normalizeVideoUrl(raw)
  if (!trimmed) return null
  try {
    const u = new URL(trimmed)
    const host = u.hostname.replace(/^www\./, "")
    if (host !== "vimeo.com") return null
    const parts = u.pathname.split("/").filter(Boolean)
    const id = parts[0] === "video" ? parts[1] : parts[0]
    return id && /^\d+$/.test(id) ? id : null
  } catch {
    return null
  }
}

/** YouTube / Vimeo → iframe; иначе — тег video с прямой ссылкой на файл. */
export function parseLessonVideoEmbed(url: string): LessonVideoEmbed {
  const trimmed = url.trim()
  const yt = youtubeVideoId(trimmed)
  if (yt) {
    return {
      mode: "iframe",
      // Some environments block youtube-nocookie.com; use youtube.com/embed for reliability.
      src: `https://www.youtube.com/embed/${yt}`,
      title: "Видео YouTube"
    }
  }
  const vm = vimeoVideoId(trimmed)
  if (vm) {
    return {
      mode: "iframe",
      src: `https://player.vimeo.com/video/${vm}`,
      title: "Видео Vimeo"
    }
  }
  return { mode: "native" }
}

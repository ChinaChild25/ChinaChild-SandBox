export type ParsedDailyTranscriptSegment = {
  cueIndex: number
  speakerLabel: string | null
  text: string
  startedAtSec: number | null
  endedAtSec: number | null
}

const TIMESTAMP_PATTERN =
  /(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})/

function parseCueTimestamp(
  hoursRaw: string | undefined,
  minutesRaw: string,
  secondsRaw: string,
  millisRaw: string
): number {
  const hours = Number(hoursRaw ?? "0")
  const minutes = Number(minutesRaw)
  const seconds = Number(secondsRaw)
  const millis = Number(millisRaw)
  return hours * 3600 + minutes * 60 + seconds + millis / 1000
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
}

function stripMarkup(value: string): string {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function parseVoiceTaggedSegments(
  payload: string
): Array<{ speakerLabel: string | null; text: string }> {
  const matches = [...payload.matchAll(/<v(?:\.[^ >]+)?\s+([^>]+)>([\s\S]*?)(?=(?:<v(?:\.[^ >]+)?\s+[^>]+>)|$)/g)]
  if (matches.length === 0) {
    return []
  }

  return matches
    .map((match) => {
      const speakerLabel = match[1]?.trim() || null
      const text = stripMarkup(match[2] ?? "")
      return {
        speakerLabel,
        text,
      }
    })
    .filter((segment) => segment.text)
}

export function parseDailyTranscriptVtt(vttContent: string): ParsedDailyTranscriptSegment[] {
  const normalized = vttContent.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
  const blocks = normalized.split(/\n{2,}/)
  const parsed: ParsedDailyTranscriptSegment[] = []
  let cueIndex = 0

  for (const rawBlock of blocks) {
    const lines = rawBlock
      .split("\n")
      .map((line) => line.trimEnd())
      .filter(Boolean)

    if (lines.length === 0) continue
    if (lines[0] === "WEBVTT") continue
    if (lines[0]?.startsWith("NOTE") || lines[0] === "STYLE" || lines[0] === "REGION") continue

    const timeLineIndex = lines.findIndex((line) => line.includes("-->"))
    if (timeLineIndex < 0) continue

    const timeLine = lines[timeLineIndex]
    const match = timeLine.match(TIMESTAMP_PATTERN)
    if (!match) continue

    const startedAtSec = parseCueTimestamp(match[1], match[2] ?? "00", match[3] ?? "00", match[4] ?? "000")
    const endedAtSec = parseCueTimestamp(match[5], match[6] ?? "00", match[7] ?? "00", match[8] ?? "000")
    const payload = lines.slice(timeLineIndex + 1).join("\n").trim()
    if (!payload) continue

    const voiceSegments = parseVoiceTaggedSegments(payload)
    const segments =
      voiceSegments.length > 0
        ? voiceSegments
        : [
            {
              speakerLabel: null,
              text: stripMarkup(payload),
            },
          ]

    for (const segment of segments) {
      if (!segment.text) continue
      parsed.push({
        cueIndex,
        speakerLabel: segment.speakerLabel,
        text: segment.text,
        startedAtSec,
        endedAtSec,
      })
    }

    cueIndex += 1
  }

  return parsed
}

import { SubtitleCue } from "../types";

/**
 * Parses time format from SRT ("00:01:23,456" or "01:23,456") or VTT ("00:01:23.456" or "01:23.456") into seconds
 */
export function parseTimestampToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().replace(",", ".");
  const parts = clean.split(":");

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } else if (parts.length === 1) {
    return parseFloat(parts[0]) || 0;
  }
  return 0;
}

/**
 * Formats seconds into "MM:SS" or "HH:MM:SS"
 */
export function formatSecondsToTime(secs: number, showHoursAlways = false): string {
  if (isNaN(secs) || secs < 0) return "00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);

  if (h > 0 || showHoursAlways) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Formats seconds to SRT timestamp: "00:01:23,456"
 */
export function formatSecondsToSrtTime(secs: number): string {
  if (isNaN(secs) || secs < 0) secs = 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 1000);

  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}

/**
 * Formats seconds to WebVTT timestamp: "00:01:23.456"
 */
export function formatSecondsToVttTime(secs: number): string {
  if (isNaN(secs) || secs < 0) secs = 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 1000);

  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

/**
 * Robust parser for SRT, VTT, SBV, and timestamped TXT files
 */
export function parseSubtitleContent(rawContent: string): SubtitleCue[] {
  if (!rawContent || !rawContent.trim()) return [];

  // Normalize line endings
  const content = rawContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const cues: SubtitleCue[] = [];

  // Check if content is JSON
  if (content.trim().startsWith("[") || content.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(content);
      const list = Array.isArray(parsed) ? parsed : parsed.cues || parsed.subtitles || [];
      if (Array.isArray(list)) {
        return list.map((item, idx) => ({
          id: item.id || `cue-${idx + 1}`,
          startTime: typeof item.startTime === "number" ? item.startTime : parseTimestampToSeconds(item.start || item.startTime || "0"),
          endTime: typeof item.endTime === "number" ? item.endTime : parseTimestampToSeconds(item.end || item.endTime || "0"),
          text: (item.text || item.content || "").trim()
        })).filter(c => c.text.length > 0);
      }
    } catch {
      // Continue to regex parsing
    }
  }

  // Regex pattern for standard SRT / VTT time ranges:
  // e.g. "00:01:20.000 --> 00:01:25.500" or "01:20,000 --> 01:25,500"
  const timeArrowRegex = /((?:\d{1,2}:)?\d{1,2}:\d{1,2}[,\.]\d{1,3}|\d{1,2}:\d{1,2})\s*(?:-->|->)\s*((?:\d{1,2}:)?\d{1,2}:\d{1,2}[,\.]\d{1,3}|\d{1,2}:\d{1,2})/;

  // Split into blocks by double newlines or single newlines
  const blocks = content.split(/\n\s*\n/);

  let cueIndex = 1;
  for (const block of blocks) {
    const lines = block.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let timeLineIndex = -1;
    let match: RegExpMatchArray | null = null;

    for (let i = 0; i < lines.length; i++) {
      match = lines[i].match(timeArrowRegex);
      if (match) {
        timeLineIndex = i;
        break;
      }
    }

    if (match && timeLineIndex !== -1) {
      const startTime = parseTimestampToSeconds(match[1]);
      const endTime = parseTimestampToSeconds(match[2]);
      const textLines = lines.slice(timeLineIndex + 1);
      const text = textLines
        .join(" ")
        .replace(/<[^>]+>/g, "") // Strip HTML tags like <b> or <c>
        .trim();

      if (text) {
        cues.push({
          id: `cue-${cueIndex++}`,
          startTime,
          endTime: endTime > startTime ? endTime : startTime + 3,
          text
        });
      }
    } else {
      // Alternative fallback: Check if lines have "[00:15] text" or "(01:30) text" format
      for (const line of lines) {
        const bracketMatch = line.match(/^\[?\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?\]?\s*[-:]?\s*(.+)$/);
        if (bracketMatch) {
          const startTime = parseTimestampToSeconds(bracketMatch[1]);
          const text = bracketMatch[2].trim();
          if (text) {
            cues.push({
              id: `cue-${cueIndex++}`,
              startTime,
              endTime: startTime + 3.5,
              text
            });
          }
        }
      }
    }
  }

  // If standard block parsing yielded nothing, try line by line matching
  if (cues.length === 0) {
    const allLines = content.split("\n");
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i].trim();
      const match = line.match(timeArrowRegex);
      if (match) {
        const startTime = parseTimestampToSeconds(match[1]);
        const endTime = parseTimestampToSeconds(match[2]);
        let text = "";
        let j = i + 1;
        while (j < allLines.length && allLines[j].trim() !== "" && !allLines[j].match(timeArrowRegex) && !allLines[j].match(/^\d+$/)) {
          text += (text ? " " : "") + allLines[j].trim();
          j++;
        }
        text = text.replace(/<[^>]+>/g, "").trim();
        if (text) {
          cues.push({
            id: `cue-${cueIndex++}`,
            startTime,
            endTime: endTime > startTime ? endTime : startTime + 3,
            text
          });
        }
      }
    }
  }

  // Sort cues chronologically
  cues.sort((a, b) => a.startTime - b.startTime);

  // Fix overlapping or missing endTimes
  for (let i = 0; i < cues.length; i++) {
    if (i < cues.length - 1 && cues[i].endTime > cues[i + 1].startTime) {
      cues[i].endTime = Math.max(cues[i].startTime + 0.5, cues[i + 1].startTime - 0.05);
    }
  }

  return cues;
}

/**
 * Exports cues list to a standard SRT string
 */
export function exportCuesToSrt(cues: SubtitleCue[]): string {
  return cues
    .map((cue, idx) => {
      const start = formatSecondsToSrtTime(cue.startTime);
      const end = formatSecondsToSrtTime(cue.endTime);
      return `${idx + 1}\n${start} --> ${end}\n${cue.text}\n`;
    })
    .join("\n");
}

/**
 * Exports cues list to a standard WebVTT string
 */
export function exportCuesToVtt(cues: SubtitleCue[]): string {
  const header = "WEBVTT\n\n";
  const body = cues
    .map((cue, idx) => {
      const start = formatSecondsToVttTime(cue.startTime);
      const end = formatSecondsToVttTime(cue.endTime);
      return `${idx + 1}\n${start} --> ${end}\n${cue.text}\n`;
    })
    .join("\n");
  return header + body;
}

/**
 * Exports cues list to plain formatted transcript text with timestamps
 */
export function exportCuesToPlainText(cues: SubtitleCue[]): string {
  return cues
    .map((cue) => `[${formatSecondsToTime(cue.startTime)}] ${cue.text}`)
    .join("\n");
}

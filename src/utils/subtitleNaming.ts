/**
 * بروتوكول تسمية مسارات الترجمة القياسي:
 * [الوقت والتاريخ بشكل بسيط]_[أول 3 أحرف كبيرة حسب نوع المصدر]_[اللغة]
 * 
 * الأنواع:
 * - UPL: رفع ملف ترجمة (Upload)
 * - TRN: تفريغ صوتي (Transcription)
 * - GEM: ذكاء اصطناعي (AI / Gemini Translation & Generation)
 * 
 * اللغات:
 * - الرفع والتفريغ دائماً: DE (ألماني)
 * - الذكاء الاصطناعي: حسب اللغة المحددة (افتراضياً AR للترجمة أو DE للتوليد)
 */

export type SubtitleTrackSourceType = 
  | "UPL" 
  | "TRN" 
  | "GEM" 
  | "upload" 
  | "uploaded" 
  | "transcribe" 
  | "transcription" 
  | "ai" 
  | "translate" 
  | "manual";

export function formatSubtitleTrackProtocol(
  type: SubtitleTrackSourceType,
  lang?: string,
  date: Date = new Date()
): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yy = pad(date.getFullYear() % 100);
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());

  const timeDateStr = `${yy}${MM}${dd}_${hh}${mm}`;

  let typeCode = "UPL";
  const normalizedType = String(type).toUpperCase();
  if (normalizedType === "UPL" || normalizedType === "UPLOAD" || normalizedType === "UPLOADED" || normalizedType === "MANUAL") {
    typeCode = "UPL";
  } else if (
    normalizedType === "TRN" ||
    normalizedType === "TRANSCRIBE" ||
    normalizedType === "TRANSCRIPTION" ||
    normalizedType === "TRA"
  ) {
    typeCode = "TRN";
  } else if (
    normalizedType === "GEM" ||
    normalizedType === "AI" ||
    normalizedType === "GEN" ||
    normalizedType === "TRANSLATE" ||
    normalizedType === "GENERATION"
  ) {
    typeCode = "GEM";
  }

  // تحديد كود اللغة (الرفع والتفريغ دائماً ألماني DE ما لم يحدد خلاف ذلك)
  let langCode = "DE";
  if (typeCode === "UPL" || typeCode === "TRN") {
    langCode = "DE";
    if (lang && lang.toLowerCase() !== "de" && lang.toLowerCase() !== "german" && lang.toLowerCase() !== "deutsch") {
      const l = lang.toLowerCase().trim();
      if (l.includes("ar") || l.includes("عرب")) langCode = "AR";
      else if (l.includes("en") || l.includes("إنجل") || l.includes("eng")) langCode = "EN";
      else if (l.includes("fr") || l.includes("فرنس")) langCode = "FR";
      else if (l.includes("es") || l.includes("إسبان")) langCode = "ES";
      else if (l.includes("tr") || l.includes("ترك")) langCode = "TR";
      else if (l.includes("it") || l.includes("إيطال")) langCode = "IT";
      else langCode = l.substring(0, 3).toUpperCase();
    }
  } else {
    // للذكاء الاصطناعي (ترجمة أو توليد)
    if (!lang) {
      langCode = type === "translate" ? "AR" : "DE";
    } else {
      const l = lang.toLowerCase().trim();
      if (l.includes("ar") || l.includes("عرب")) langCode = "AR";
      else if (l.includes("de") || l.includes("ألمان") || l.includes("germ")) langCode = "DE";
      else if (l.includes("en") || l.includes("إنجل") || l.includes("eng")) langCode = "EN";
      else if (l.includes("fr") || l.includes("فرنس")) langCode = "FR";
      else if (l.includes("es") || l.includes("إسبان")) langCode = "ES";
      else if (l.includes("tr") || l.includes("ترك")) langCode = "TR";
      else if (l.includes("it") || l.includes("إيطال")) langCode = "IT";
      else langCode = l.substring(0, 3).toUpperCase();
    }
  }

  return `${timeDateStr}_${typeCode}_${langCode}`;
}

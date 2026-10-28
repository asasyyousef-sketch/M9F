import React from "react";

export interface Folder {
  id: string;
  userId?: string;
  parentId?: string; // Optional field for nested subfolders
  name: string;
  description?: string;
  color: string; // Hex color or styling class
  coverImage?: string;
  coverImagePosition?: string; // CSS object-position e.g. "50% 50%"
  frontLang: string; // e.g. "de", "en", "ar"
  backLang: string; // e.g. "ar", "en", "de"
  createdAt: string;
  updatedAt: string;
}

export interface Flashcard {
  id: string;
  userId?: string;
  folderId: string;
  frontText: string;
  frontLang: string;
  frontImage?: string;
  frontImagePosition?: string; // CSS object-position e.g. "50% 50%"
  frontAudioUrl?: string;
  backText: string;
  backLang: string;
  backImage?: string;
  backImagePosition?: string; // CSS object-position e.g. "50% 50%"
  backAudioUrl?: string;
  isArticleMode?: boolean; // German der/die/das mode
  correctArticle?: "der" | "die" | "das" | "die-plural" | "" | string; // der, die, das, die-plural
  isPluralMode?: boolean; // Toggle for plural form inputs
  pluralText?: string; // German plural text (e.g., "Tische")
  pluralLang?: string; // Pronunciation language for the plural
  translationHint?: string; // Arabic or English short translation shown under front text
  createdAt: string;
  streak: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  autoImageCandidates?: string[];
  imageSearchQuery?: string;
}

export interface SharedDeckData {
  id: string;
  folder: Folder;
  cards: Flashcard[];
  subfolders?: Folder[];
  cardCount: number;
  authorName?: string;
  createdAt: string;
  views?: number;
}


export function getCardSearchQuery(
  card: { frontText?: string; backText?: string; imageSearchQuery?: string }
): string {
  let sourceMode = "smart_auto";
  try {
    sourceMode = localStorage.getItem("settings_image_search_query_source") || "smart_auto";
  } catch (e) {}

  const front = card.frontText?.trim() || "";
  const back = card.backText?.trim() || "";
  const subject = front || back || "";
  const custom = card.imageSearchQuery?.trim() || "";

  let queryResult = "";
  if (sourceMode === "front_text_only") {
    queryResult = front || custom || subject || "flashcard";
  } else if (sourceMode === "back_text_only") {
    queryResult = back || custom || subject || "flashcard";
  } else if (sourceMode === "combined_front_back") {
    queryResult = [front, back].filter(Boolean).join(" ") || custom || subject || "flashcard";
  } else if (sourceMode === "custom_query_only") {
    queryResult = custom || front || subject || "flashcard";
  } else {
    // smart_auto (default): Use exact imageSearchQuery returned by AI if present!
    queryResult = custom || front || back || subject || "flashcard";
  }

  // Ensure cartoon/illustration is not forced unless explicitly desired
  return cleanImageSearchQuery(queryResult);
}

export function isGermanSentence(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (/[.!?]$/.test(trimmed)) return true;
  const clean = trimmed.replace(/\([^)]*\)/g, "").replace(/\s*\/.*$/, "").trim();
  const tokens = clean.split(/\s+/).filter(Boolean);
  
  if (tokens.length <= 1) return false;
  
  const firstLower = tokens[0].toLowerCase();
  const isFirstArticle = ["der", "die", "das", "ein", "eine", "einen", "einem", "einer", "eines"].includes(firstLower);
  
  if (tokens.length === 2 && isFirstArticle) {
    const secondLower = tokens[1].toLowerCase();
    const commonVerbs = ["ist", "sind", "war", "waren", "hat", "haben", "wird", "werden", "geht", "kommt", "kann", "muss"];
    if (!commonVerbs.includes(secondLower)) {
      return false; // It's an article + single noun (e.g., "Das Handy", "Der Tisch")
    }
  }

  return true; // 3+ tokens, or 2 tokens without leading article/with verb (e.g. "Das Buch ist schön")
}

export function sanitizeCardArticleAndSentence<T extends {
  frontText?: string;
  correctArticle?: string;
  isArticleMode?: boolean;
  isPluralMode?: boolean;
  pluralText?: string;
  translationHint?: string;
  backText?: string;
}>(card: T): T {
  if (!card) return card;
  let frontText = typeof card.frontText === "string" ? card.frontText.trim() : "";
  let correctArticle = typeof card.correctArticle === "string" ? card.correctArticle.trim() : "";
  let isArticleMode = Boolean(card.isArticleMode);
  let isPluralMode = Boolean(card.isPluralMode);
  let pluralText = typeof card.pluralText === "string" ? card.pluralText.trim() : "";

  // 1. Normalize correctArticle input variations (e.g. from external LLMs, imports, or APIs)
  // Protocol: "der" (masculine), "die" (feminine), "das" (neuter), "die-plural" (plural noun)
  const rawArtLower = correctArticle.toLowerCase().trim();
  if (
    [
      "die-plural", "die_plural", "plural", "pl", "pl.", "die (plural)",
      "die (pl)", "die (pl.)", "die pl", "die plural", "die (جمع)", "جمع"
    ].includes(rawArtLower)
  ) {
    correctArticle = "die-plural";
    isPluralMode = true;
  } else if (["der", "m", "masculine", "maskulin"].includes(rawArtLower)) {
    correctArticle = "der";
  } else if (["das", "n", "neuter", "neutral"].includes(rawArtLower)) {
    correctArticle = "das";
  } else if (["die", "f", "feminine", "feminin"].includes(rawArtLower)) {
    correctArticle = "die";
  }

  // 2. Check for explicit plural markers in frontText (e.g., "Kinder (Pl.)" or "(die) Kinder (Plural)")
  const plMarkerRegex = /\s*[\(\[]\s*(?:pl\.|plural|اسم جمع|صيغة جمع|\(جمع\))\s*[\)\]]/i;
  const hasPlMarkerInFront = plMarkerRegex.test(frontText);
  if (hasPlMarkerInFront) {
    frontText = frontText.replace(plMarkerRegex, "").trim();
    if (!correctArticle || correctArticle === "die" || correctArticle === "") {
      correctArticle = "die-plural";
    }
    isPluralMode = true;
  }

  // 3. Protocol Safety for Singular vs Plural:
  // If pluralText is provided and differs from frontText, this card is DEFINITELY a singular noun with a plural form!
  // Therefore, its correctArticle (der / die / das) must NEVER be turned into "die-plural".
  const hasDistinctPlural = Boolean(pluralText && pluralText.toLowerCase() !== frontText.toLowerCase());

  // Only consider translationHint/backText for plural card classification if the card is NOT already established
  // as a singular noun with a distinct plural, and only if explicitly referring to the card itself being a plural noun.
  if (!hasDistinctPlural && (!correctArticle || correctArticle === "die")) {
    const hintOrBack = `${card.translationHint || ""} ${card.backText || ""}`;
    const isExplicitPluralNoun = /\b(?:اسم جمع|بطاقة جمع|صيغة جمع فقط|plural noun|plural only)\b/i.test(hintOrBack);
    if (isExplicitPluralNoun) {
      correctArticle = "die-plural";
      isPluralMode = true;
    }
  }

  const isSentence = isGermanSentence(frontText);

  if (isSentence) {
    // SCENARIO 1: IT IS A SENTENCE (e.g., "Das Buch ist schön" or "Die Kinder spielen")
    // If the article was stripped into correctArticle, restore it to frontText
    if (correctArticle && ["der", "die", "das", "die-plural"].includes(correctArticle.toLowerCase())) {
      const art = correctArticle.toLowerCase() === "die-plural" ? "Die" : (correctArticle.charAt(0).toUpperCase() + correctArticle.slice(1).toLowerCase());
      if (!frontText.toLowerCase().startsWith(art.toLowerCase() + " ")) {
        frontText = `${art} ${frontText}`;
      }
    }
    // Sentence: article mode is always disabled, and correctArticle is empty
    correctArticle = "";
    isArticleMode = false;
  } else {
    // SCENARIO 2: IT IS A SINGLE NOUN / VOCABULARY (e.g., "Handy", "Tisch", "Katze", "Kinder")
    // The article belongs strictly in correctArticle, NOT inside frontText!
    const match = frontText.match(/^(der|die|das)\s+(.+)$/i);
    if (match) {
      const extractedArticle = match[1].toLowerCase();
      const cleanNoun = match[2].trim();
      frontText = cleanNoun;
      if (!correctArticle || correctArticle === "") {
        // If extracted is "die", check if this is an inherent plural noun without a separate plural form
        if (extractedArticle === "die" && !hasDistinctPlural && (hasPlMarkerInFront || rawArtLower.includes("plural"))) {
          correctArticle = "die-plural";
        } else {
          correctArticle = extractedArticle;
        }
      }
      isArticleMode = true;
    } else {
      if (correctArticle && ["der", "die", "das", "die-plural"].includes(correctArticle.toLowerCase())) {
        isArticleMode = true;
      }
    }
  }

  return {
    ...card,
    frontText,
    correctArticle,
    isArticleMode,
    isPluralMode,
    pluralText
  };
}

export function cleanImageSearchQuery(query: string, userInstruction?: string): string {
  if (!query) return "";
  let clean = query.trim();
  const userWantsCartoon = userInstruction && (
    /cartoon|vector|illustration|clipart|كرتون|رسومات|انمي|أنمي/i.test(userInstruction)
  );

  if (!userWantsCartoon) {
    clean = clean
      .replace(/\b(cartoon\s+illustration|flat\s+vector\s+illustration|vector\s+illustration|cartoon|vector|clipart|anime|illustration)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  return clean;
}

export type ReviewMethod = 'challenge' | 'write' | 'listen' | 'article' | 'match' | 'classic' | 'puzzles' | 'repetition' | 'spoken_challenge';

export interface SpeakingChallengeItem {
  id: number | string;
  arabic_prompt: string;      // ما يطلب من المستخدم قوله بالعربي
  target_german: string;      // الجملة الأصلية بالألماني
  estimated_seconds: number;  // الزمن المقدر للقول بالثواني
  image_prompt: string;       // وصف توليد/بحث الصورة
  imageUrl?: string;          // رابط الصورة المحملة
  cefr_level: string;         // المستوى اللغوي (A1, A2, B1, ...)
  grammar_focus: string;      // القاعدة اللغوية المستهدفة
  vocab_focus: string[];      // الكلمات والمفردات المستهدفة من المجلد
}

export interface ReviewSessionState {
  method: ReviewMethod;
  cards: Flashcard[];
  currentIndex: number;
  score: number;
  startTime: number;
  isCompleted: boolean;
  history: { cardId: string; correct: boolean }[];
}

export interface DbStatus {
  supabaseActive: boolean;
  tablesExist: boolean;
  error: string | null;
}

export function getSafeImageStyle(positionString?: string): React.CSSProperties {
  if (!positionString) {
    return { objectPosition: "50% 50%" };
  }
  const parts = positionString.trim().split(/\s+/);
  const xStr = parts[0] || "50%";
  const yStr = parts[1] || "50%";
  const zoomStr = parts[2];
  
  const style: React.CSSProperties = {
    objectPosition: `${xStr} ${yStr}`,
  };
  
  if (zoomStr) {
    const zoom = parseFloat(zoomStr);
    if (!isNaN(zoom) && zoom !== 1) {
      // Extract numeric value from percentages (e.g. "52.4%" -> 52.4)
      const posX = parseFloat(xStr) || 50;
      const posY = parseFloat(yStr) || 50;
      
      // Calculate perfect centering offset shift based on zoom scale
      const translateX = (50 - posX) * (zoom - 1);
      const translateY = (50 - posY) * (zoom - 1);
      
      style.transform = `scale(${zoom}) translate(${translateX.toFixed(2)}%, ${translateY.toFixed(2)}%)`;
    }
  }
  
  return style;
}

export interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

export interface TranscriptDocument {
  id: string;
  title: string;
  videoId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  languageCode?: string;
  languageLabel?: string;
  segments: TranscriptSegment[];
  createdAt: string;
  updatedAt: string;
}

export interface CorrectionItem {
  originalSegment: string;
  correctedSegment: string;
  type: "spelling" | "grammar" | "vocabulary" | "style";
  reasonAr: string;
}

export interface CorrectorAnalysis {
  score: number;
  gradeLabel: string;
  originalText: string;
  correctedText: string;
  hasErrors: boolean;
  corrections: CorrectionItem[];
  nativeVersion: string;
  improvedExpressionText?: string;
  improvedExpressionExplanationAr?: string;
  positiveFeedbackAr: string;
  grammarSummaryAr: string;
  explanationAr?: string;
}

export interface Persona {
  id: string;
  name: string;
  avatar: string; // Emoji or image URL
  job: string; // عمله / مهنته
  age: string; // عمره
  origin: string; // أصله / جنسيته
  relationship?: string; // صلة القرابة / العلاقة بالمستخدم (اختياري)
  toneStyle: string; // أسلوبه في الكلام
  backgroundTopics: string; // مواضيع أخرى مهمة عن الشخصية
  isDefault?: boolean;
}

export interface PersonaReply {
  personaId?: string;
  personaName: string;
  personaAvatar?: string;
  personaJob?: string;
  replyText: string;
  replyTextArabic?: string;
  imageQueries?: string[];
  imageUrls?: string[];
  userCorrection?: CorrectorAnalysis;
}

export interface CorrectorMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  sendMode?: "correct" | "chat" | "persona";
  personaId?: string;
  personaName?: string;
  aiModelName?: string;
  analysis?: CorrectorAnalysis;
  chatReply?: {
    title: string;
    replyText: string;
  };
  personaReply?: PersonaReply;
  targetLanguage?: string;
  isFollowUp?: boolean;
}

export interface ExercisePersona {
  id: string;
  name: string;
  job: string;
  avatar: string;
  origin?: string;
  toneStyle?: string;
  backgroundTopics?: string;
  relationship?: string;
  roleDescriptionAr?: string;
  imageSearchQuery?: string;
  promptInstructions?: string;
}

export interface ExerciseChecklistItem {
  id: string;
  speakerName: string;
  objective: string;
  isCompleted: boolean;
}

export interface CorrectorSession {
  id: string;
  title: string;
  targetLanguage: string;
  createdAt: string;
  messages: CorrectorMessage[];
  personaId?: string;
  chatType?: "free" | "exercise";
  exerciseContext?: string;
  exerciseVariables?: string;
  exerciseTitle?: string;
  userRole?: string;
  exercisePersonas?: ExercisePersona[];
  exerciseChecklist?: ExerciseChecklistItem[];
  isExerciseCompleted?: boolean;
}

export interface GradioVoice {
  id: string;
  name: string;
  lang: string;
  gender: "male" | "female";
  description: string;
  sampleText?: string;
}

export const DEFAULT_GRADIO_VOICES: GradioVoice[] = [
  { id: "ryan", name: "Ryan (ذكوري)", lang: "en/de", gender: "male", description: "", sampleText: "Guten Tag! Ich bin Ryan." },
  { id: "serena", name: "Serena (أنثوي)", lang: "en/de", gender: "female", description: "", sampleText: "Hallo! Das ist Serena." },
  { id: "vivian", name: "Vivian (أنثوي)", lang: "en/de", gender: "female", description: "", sampleText: "Guten Tag! Wie kann ich Ihnen heute helfen?" },
  { id: "aiden", name: "Aiden (ذكوري)", lang: "en/de", gender: "male", description: "", sampleText: "Hey! Ready to practice flashcards today?" },
  { id: "eric", name: "Eric (ذكوري)", lang: "en/de", gender: "male", description: "", sampleText: "Guten Tag. Lassen Sie uns üben." },
  { id: "dylan", name: "Dylan (ذكوري)", lang: "en/de", gender: "male", description: "", sampleText: "Hi there! Let's get started." },
  { id: "uncle_fu", name: "Uncle Fu (ذكوري)", lang: "zh/en", gender: "male", description: "", sampleText: "Hello my friend." },
  { id: "ono_anna", name: "Ono Anna (أنثوي)", lang: "ja/en", gender: "female", description: "", sampleText: "Konnichiwa! Welcome." },
  { id: "sohee", name: "Sohee (أنثوي)", lang: "ko/en", gender: "female", description: "", sampleText: "Annyeonghaseyo!" }
];

export const GRADIO_LANGUAGES = [
  { id: "german", name: "🇩🇪 الألمانية (Deutsch / German)", code: "de" },
  { id: "english", name: "🇺🇸 الإنجليزية (English)", code: "en" },
  { id: "arabic", name: "🇯🇴 العربية (Arabic)", code: "ar" },
  { id: "french", name: "🇫🇷 الفرنسية (Français)", code: "fr" },
  { id: "italian", name: "🇮🇹 الإيطالية (Italiano)", code: "it" },
  { id: "spanish", name: "🇪🇸 الإسبانية (Español)", code: "es" },
  { id: "chinese", name: "🇨🇳 الصينية (Chinese)", code: "zh" },
  { id: "japanese", name: "🇯🇵 اليابانية (Japanese)", code: "ja" },
  { id: "korean", name: "🇰🇷 الكورية (Korean)", code: "ko" },
  { id: "portuguese", name: "🇵🇹 البرتغالية (Português)", code: "pt" },
  { id: "russian", name: "🇷🇺 الروسية (Russian)", code: "ru" }
];

export interface SubtitleCue {
  id: string;
  startTime: number; // in seconds (e.g. 1.25)
  endTime: number;   // in seconds (e.g. 4.80)
  text: string;
}

export interface MediaSubtitleTrack {
  id: string;
  label: string;      // e.g. "العربية (SRT)" or "English"
  language?: string;  // e.g. "ar", "en"
  cues: SubtitleCue[];
  source?: "uploaded" | "ai" | "manual" | "transcribe";
  uploadedAt?: string;
}

export interface MediaFolder {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  parentId?: string | null;
}

export interface MediaBookContext {
  bookId: string;
  bookTitle?: string;
  pageIndex: number;
  pageNumber?: number;
  displayLabel?: string;
}

export interface MediaFile {
  id: string;
  filename: string;
  originalName: string;
  title: string;
  size: number;
  mimeType: string;
  type: "video" | "audio";
  uploadedAt: string;
  url: string;
  duration?: number;
  thumbnailUrl?: string;
  author?: string;
  description?: string;
  subtitles?: MediaSubtitleTrack[];
  folderId?: string;
  primaryTrackId?: string;
  secondaryTrackId?: string;
  showDualSubtitles?: boolean;
  bookContext?: MediaBookContext;
}

export type PaperStyle = "plain" | "ruled" | "grid" | "ivory" | "legal" | "dark" | "white";

export interface NoteItem {
  id: string;
  title: string;
  content: string; // HTML content
  plainText?: string;
  category?: string; // e.g. "عام", "مفردات", "قواعد", "مذكرات", "أفكار"
  tags?: string[];
  isPinned: boolean;
  color?: string; // card accent color
  paperStyle?: PaperStyle;
  paperWidth?: "normal" | "wide" | "compact";
  fontSize?: "sm" | "base" | "lg" | "xl";
  fontFamily?: "cairo" | "amiri" | "tajawal" | "inter" | "mono";
  dir?: "rtl" | "ltr";
  zoom?: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteCategory {
  id: string;
  name: string;
  color: string;
}

export type UserRole = "admin" | "user";

export interface AppUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  createdAt?: string;
}

export interface AIModelOption {
  key: string;
  name: string;
  desc: string;
  badge: string;
  group?: "high_quota" | "general";
}

export const ALL_AVAILABLE_MODELS: AIModelOption[] = [
  // High Quota Models (500 RPD)
  { key: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite ⚡ (500 RPD)", desc: "سريع مع 500 طلب يومياً", badge: "500 RPD", group: "high_quota" },
  { key: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite ⚡ (500 RPD)", desc: "خفيف واقتصادي مع 500 طلب يومياً", badge: "500 RPD", group: "high_quota" },
  // General & Advanced Models
  { key: "gemini-3.6-flash", name: "Gemini 3.6 Flash ⚡", desc: "أحدث معالجة ذكية ومستقرة (موصى به)", badge: "موصى به", group: "general" },
  { key: "gemini-3.5-flash", name: "Gemini 3.5 Flash ⚡", desc: "نموذج فلاش فائق الاستقرار", badge: "مستقر", group: "general" },
  { key: "gemini-3.7-flash", name: "Gemini 3.7 Flash ⚡", desc: "تفكير متقدم واستنتاج تحليلي", badge: "تفكير متقدم", group: "general" },
  { key: "groq-llama-3.3-70b", name: "Groq Llama 3.3 70B 🚀", desc: "محرك جروك الفائق في السرعة والتصحيح", badge: "فائق السرعة", group: "general" },
  { key: "grok-2", name: "Grok 2 🤖", desc: "أسلوب تفاعلي وحوار طبيعي", badge: "تفاعلي", group: "general" },
  { key: "gemini-2.5-flash", name: "Gemini 2.5 Flash ⚡", desc: "نموذج فلاش القياسي السريع", badge: "خفيف وسريع", group: "general" },
  { key: "gemini-2.5-pro", name: "Gemini 2.5 Pro 💎", desc: "تحليل لغوي وبلاغي عميق جداً", badge: "تحليل عميق", group: "general" },
  { key: "gemini-1.5-pro", name: "Gemini 1.5 Pro 💎", desc: "سياق واسع وفهم دقيق للجمل", badge: "سياق كبير", group: "general" },
  { key: "gemini-1.5-flash", name: "Gemini 1.5 Flash ⚡", desc: "نموذج فلاش القياسي الكلاسيكي", badge: "مستقر", group: "general" }
];

export interface BookPageMedia {
  id: string;
  trackNumber?: string;
  title: string;
  type: "audio" | "video";
  fileName: string;
  url?: string;
  blob?: Blob;
  pageNumber?: number;
  subtitles?: MediaSubtitleTrack[];
}

export interface BookPage {
  pageNumber: number;
  displayLabel?: string;
  pageImage: string;
  imageBlob?: Blob;
  media: BookPageMedia[];
}

export interface InteractiveBook {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  coverImage?: string;
  totalPages: number;
  pages: BookPage[];
  allMedia?: BookPageMedia[];
  createdAt: string;
}



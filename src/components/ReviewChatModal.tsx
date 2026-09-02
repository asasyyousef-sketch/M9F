import React, { useState, useEffect, useRef, memo } from "react";
import {
  X,
  Send,
  Sparkles,
  Bot,
  Volume2,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Layers,
  Trash2,
  Loader2,
  CheckCircle2,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  ZoomIn,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertCircle,
  Settings,
  Play,
  Clock,
  Film,
  Music
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Flashcard, Folder } from "../types";
import { speakClient } from "./Modals";

export interface ReviewChatMessage {
  id: string;
  role: "user" | "assistant" | "model";
  content: string;
  modelUsed?: string;
  timestamp: number;
  images?: string[];
  imageUrls?: string[];
  suggestions?: string[];
}

export interface ReviewChatCardItem {
  id: string;
  frontText: string;
  backText?: string;
  translationHint?: string;
  correctArticle?: string;
  pluralText?: string;
  frontLang?: string;
  backLang?: string;
  audioUrl?: string;
  [key: string]: any;
}

export interface ReviewChatModalMediaContext {
  mediaId?: string;
  mediaTitle: string;
  originalName?: string;
  mediaType: "video" | "audio";
  duration?: number;
  cueStartTime?: number;
  cueEndTime?: number;
  onPlayMediaSegment?: (startTime: number, endTime?: number) => void;
  onSeekMedia?: (time: number) => void;
}

export interface ReviewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Flashcard | ReviewChatCardItem;
  previousCards?: (Flashcard | ReviewChatCardItem)[];
  nextCards?: (Flashcard | ReviewChatCardItem)[];
  folderInfo?: {
    name?: string;
    description?: string;
    targetLanguage?: string;
    sourceLanguage?: string;
  };
  onPlayPronunciation?: (text: string, lang?: string, voice?: string) => void;
  mediaContext?: ReviewChatModalMediaContext;
}

const AVAILABLE_MODELS = [
  // High quota models (500 RPD / lightweight)
  { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite ⚡", desc: "أداء ممتاز وخفيف مع حصة يومية عالية (500 طلب/يوم)", tag: "500 RPD" },
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite ⚡", desc: "سريع وخفيف جداً للمحادثات اليومية (500 طلب/يوم)", tag: "500 RPD" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite ⚡", desc: "اقتصادي وسريع جداً للمحادثات الفورية", tag: "خفيف" },
  
  // General & Advanced Models
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash ⚡", desc: "أحدث وأقوى نموذج لمعالجة اللغات والشرح الدقيق (موصى به)", tag: "موصى به" },
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash ⚡", desc: "نموذج مستقر وفائق السرعة في الردود والشروحات", tag: "مستقر" },
  { id: "groq-llama-3.3-70b", name: "Groq Llama 3.3 70B 🚀", desc: "سرعة استجابة فائقة وخارقة عبر Groq API", tag: "Groq" },
  { id: "grok-2", name: "Grok 2 🤖", desc: "نموذج تفاعلي متقدم لشرح المصطلحات والأمثلة", tag: "تفاعلي" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash ⚡", desc: "سريع وخفيف ودقيق في صياغة الجمل والتمارين", tag: "خفيف" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro 💎", desc: "أعلى دقة لغوية وتحليل نحوي متعمق وشامل", tag: "تحليل عميق" }
];

const AVAILABLE_VOICES = [
  { id: "default", name: "الصوت الافتراضي (حسب البطاقة)", flag: "⚙️", desc: "يتبع الصوت الأساسي أو الثانوي المحدد للبطاقة الحالية" },
  { id: "google", name: "Google Translate TTS", flag: "⚡", desc: "خدمة نطق سريعة ومباشرة من جوجل" },
  { id: "webspeech", name: "Web Speech API", flag: "🌐", desc: "محرك نطق المتصفح الداخلي المباشر" },
  // German Piper Voices
  { id: "de_DE-thorsten-medium", name: "🇩🇪 Thorsten (ألماني - رجالي)", flag: "🇩🇪", desc: "صوت ألماني نقي عالي الدقة والوضوح" },
  { id: "de_DE-thorsten_emotional-medium", name: "🇩🇪 Thorsten Emotional (ألماني - معبر)", flag: "🇩🇪", desc: "نبرة معبرة طبيعية للمحادثات" },
  { id: "de_DE-ramona-medium", name: "🇩🇪 Ramona (ألماني - أنثوي)", flag: "🇩🇪", desc: "صوت نسائي ألماني واضح" },
  { id: "de_DE-amany-medium", name: "🇩🇪 Amany (ألماني - أنثوي)", flag: "🇩🇪", desc: "صوت نسائي ألماني مميز" },
  { id: "de_DE-kerstin-low", name: "🇩🇪 Kerstin (ألماني - خفيف)", flag: "🇩🇪", desc: "صوت نسائي ألماني خفيف وسريع" },
  { id: "de_DE-pavoque-low", name: "🇩🇪 Pavoque (ألماني)", flag: "🇩🇪", desc: "صوت ألماني خفيف" },
  // English Piper Voices
  { id: "en_US-lessac-medium", name: "🇺🇸 Lessac (إنجليزي - أنثوي)", flag: "🇺🇸", desc: "صوت إنجليزي أمريكي قياسي عالي النقاء" },
  { id: "en_US-ryan-medium", name: "🇺🇸 Ryan (إنجليزي - رجالي)", flag: "🇺🇸", desc: "صوت إنجليزي رجالي متزن" },
  { id: "en_US-amy-medium", name: "🇺🇸 Amy (إنجليزي - أنثوي)", flag: "🇺🇸", desc: "صوت إنجليزي أمريكي أنثوي واضح" },
  { id: "en_US-danny-low", name: "🇺🇸 Danny (إنجليزي - رجالي)", flag: "🇺🇸", desc: "صوت إنجليزي رجالي سريع" },
  { id: "en_GB-alan-medium", name: "🇬🇧 Alan (إنجليزي بريطاني)", flag: "🇬🇧", desc: "نبرة بريطانية مميزة ودقيقة" },
  { id: "en_GB-southern_english_female-low", name: "🇬🇧 Southern English (بريطاني)", flag: "🇬🇧", desc: "لهجة بريطانية جنوبية" },
  // Arabic Piper Voices
  { id: "ar_JO-kareem-medium", name: "🇯🇴 Kareem (عربي - فصيح)", flag: "🇯🇴", desc: "صوت عربي فصيح واضح المخارج" },
  { id: "ar_AR-fahad-medium", name: "🇸🇦 Fahad (عربي)", flag: "🇸🇦", desc: "صوت عربي خليجي متزن" },
  // Other Piper Languages
  { id: "fr_FR-siwis-medium", name: "🇫🇷 Siwis (فرنسي)", flag: "🇫🇷", desc: "صوت فرنسي عالي الوضوح" },
  { id: "es_ES-carlfm-medium", name: "🇪🇸 Carlfm (إسباني)", flag: "🇪🇸", desc: "صوت إسباني متقن" },
  { id: "tr_TR-dfki-medium", name: "🇹🇷 Dfki (تركي)", flag: "🇹🇷", desc: "صوت تركي واضح" },
  // Gradio TTS Models
  { id: "gradio:ryan", name: "🚀 Gradio: Ryan (رجالي متقدم)", flag: "🚀", desc: "نطق عالي الواقعية عبر خادم Gradio الخارجي" },
  { id: "gradio:serena", name: "🚀 Gradio: Serena (أنثوي متقدم)", flag: "🚀", desc: "نطق أنثوي واقعي عبر خادم Gradio الخارجي" },
  { id: "gradio:vivian", name: "🚀 Gradio: Vivian (أنثوي)", flag: "🚀", desc: "صوت أنثوي عبر خادم Gradio الخارجي" },
  { id: "gradio:aiden", name: "🚀 Gradio: Aiden (رجالي)", flag: "🚀", desc: "صوت رجالي عبر خادم Gradio الخارجي" },
  { id: "gradio:eric", name: "🚀 Gradio: Eric (رجالي)", flag: "🚀", desc: "صوت رجالي عبر خادم Gradio الخارجي" },
  { id: "gradio:dylan", name: "🚀 Gradio: Dylan (رجالي)", flag: "🚀", desc: "صوت رجالي عبر خادم Gradio الخارجي" }
];

// Interactive Quoted Span with Floating Bubble Tooltip (ONLY for quoted text!)
const QuotedTextInteractiveSpan: React.FC<{
  quotedText: string;
  onSpeak?: (text: string) => void;
  onCopy?: (text: string) => void;
  onCreateCard?: (text: string) => Promise<void> | void;
}> = ({ quotedText, onSpeak, onCopy, onCreateCard }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const cleanText = quotedText.trim();

  const handleTouchStart = () => {
    isLongPressRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setShowTooltip(true);
    }, 380);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowTooltip((prev) => !prev);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setShowTooltip((prev) => !prev);
  };

  const handleCopyAction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onCopy) {
      onCopy(cleanText);
    } else {
      navigator.clipboard.writeText(cleanText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeakAction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSpeak) {
      onSpeak(cleanText);
    } else {
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(cleanText);
          window.speechSynthesis.speak(u);
        }
      } catch (err) {
        console.error("Speech error:", err);
      }
    }
  };

  const handleCreateCardAction = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onCreateCard || isCreatingCard) return;
    setIsCreatingCard(true);
    try {
      await onCreateCard(cleanText);
      setShowTooltip(false);
    } catch (err) {
      console.error("Card creation error:", err);
    } finally {
      setIsCreatingCard(false);
    }
  };

  return (
    <span className="relative inline-block">
      <bdi
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
        className={`transition-all duration-150 cursor-pointer select-text font-semibold ${
          showTooltip
            ? "text-amber-400 font-bold underline decoration-amber-400 decoration-2 underline-offset-2"
            : "text-amber-300 hover:text-amber-200 active:text-amber-400 underline decoration-amber-400/40 decoration-1 underline-offset-2"
        }`}
        title="انقر لإظهار خيارات: استماع، نسخ، أو إضافة كبطاقة فلاش كارد"
        dir="auto"
      >
        "{cleanText}"
      </bdi>

      {/* Floating Action Bubble */}
      {showTooltip && (
        <>
          {/* Backdrop to close popup on outside click */}
          <div
            className="fixed inset-0 z-[999999] bg-black/25 backdrop-blur-3xs"
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(false);
            }}
          />

          <div
            dir="rtl"
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-[1000000] bg-slate-950 text-white p-1.5 rounded-2xl shadow-2xl border border-slate-700/90 flex items-center gap-1.5 animate-scale-up whitespace-nowrap text-xs font-sans select-none ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tail arrow pointing down */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-950" />

            {/* 1. Listen / Speak Button */}
            <button
              type="button"
              onClick={handleSpeakAction}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
              title="استماع للنطق الصوتي"
            >
              <Volume2 className="w-3.5 h-3.5 text-blue-100" />
              <span>استماع</span>
            </button>

            {/* 2. Copy Button */}
            <button
              type="button"
              onClick={handleCopyAction}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold transition-all active:scale-95 cursor-pointer border shadow-xs ${
                copied
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700"
              }`}
              title="نسخ النص"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-300" />
              )}
              <span>نسخ</span>
            </button>

            {/* 3. Make Flashcard Button */}
            {onCreateCard && (
              <button
                type="button"
                onClick={handleCreateCardAction}
                disabled={isCreatingCard}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition-all active:scale-95 cursor-pointer shadow-xs border border-amber-500/80 disabled:opacity-50"
                title="توليد وحفظ كبطاقة فلاش كارد في المجلد"
              >
                {isCreatingCard ? (
                  <Loader2 className="w-3.5 h-3.5 text-amber-100 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5 text-amber-100" />
                )}
                <span>بطاقة</span>
              </button>
            )}
          </div>
        </>
      )}
    </span>
  );
};

// Helper to parse inline formatting recursively (bold, inline code, italics, and quotes)
const parseInlineChatContent = (
  lineText: string,
  onSpeak?: (text: string) => void,
  onCopy?: (text: string) => void,
  onCreateCard?: (text: string) => Promise<void> | void
): React.ReactNode => {
  if (!lineText) return null;

  // Regex matches:
  // 1. Double double-quotes: ""..."" (plain text without quotes)
  // 2. Single pair quotes: "..." | «...» | „...“ | “...” (interactive with bubble)
  // 3. Bold text: **...** (strong text, parsed recursively)
  // 4. Inline code: `...` (code badge, parsed recursively)
  // 5. Italic text: *...* (emphasis, parsed recursively)
  const regex = /(""(.*?)""|"([^"\n]+)"|«([^»]+)»|„([^“]+)“|“([^”]+)”|\*\*(.*?)\*\*|`([^`]+)`|\*([^*\n]+)\*)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(lineText)) !== null) {
    if (match.index > lastIndex) {
      parts.push(lineText.substring(lastIndex, match.index));
    }

    const fullMatch = match[0];
    const isDoubleDoubleQuote = fullMatch.startsWith('""') && fullMatch.endsWith('""');
    const isBold = fullMatch.startsWith("**") && fullMatch.endsWith("**");
    const isCode = fullMatch.startsWith("`") && fullMatch.endsWith("`");
    const isItalic = !isBold && fullMatch.startsWith("*") && fullMatch.endsWith("*");

    if (isDoubleDoubleQuote) {
      const inner = match[2] || "";
      parts.push(
        <span key={match.index} className="font-semibold text-slate-200" dir="ltr">
          {inner}
        </span>
      );
    } else if (isBold) {
      const inner = match[7] || "";
      parts.push(
        <strong key={match.index} className="font-extrabold text-white">
          {parseInlineChatContent(inner, onSpeak, onCopy, onCreateCard)}
        </strong>
      );
    } else if (isCode) {
      const inner = match[8] || "";
      parts.push(
        <code
          key={match.index}
          className="px-1 py-0.5 rounded text-indigo-300 font-mono text-xs mx-0.5 inline-block"
          dir="ltr"
        >
          {parseInlineChatContent(inner, onSpeak, onCopy, onCreateCard)}
        </code>
      );
    } else if (isItalic) {
      const inner = match[9] || "";
      parts.push(
        <em key={match.index} className="italic text-slate-300">
          {parseInlineChatContent(inner, onSpeak, onCopy, onCreateCard)}
        </em>
      );
    } else {
      // Single pair quoted text ("word", «word», „word“, “word”) -> ONLY these show the floating bubble!
      const quotedInner = match[3] ?? match[4] ?? match[5] ?? match[6] ?? "";
      if (quotedInner && quotedInner.trim().length > 0) {
        parts.push(
          <QuotedTextInteractiveSpan
            key={match.index}
            quotedText={quotedInner.trim()}
            onSpeak={onSpeak}
            onCopy={onCopy}
            onCreateCard={onCreateCard}
          />
        );
      } else {
        parts.push(fullMatch);
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < lineText.length) {
    parts.push(lineText.substring(lastIndex));
  }

  return parts.length > 0 ? parts : lineText;
};

// Helper structures and utilities for Chat Images and Markdown Table parsing
export interface ChatImageItem {
  query: string;
  size?: "small" | "medium" | "large";
  caption?: string;
  keyword?: string;
}

interface ImageBlock {
  type: "image";
  items: ChatImageItem[];
}

interface TableBlock {
  type: "table";
  headers: string[];
  alignments: Array<"right" | "center" | "left" | "auto">;
  rows: string[][];
}

interface LineBlock {
  type: "line";
  line: string;
}

type ParsedBlock = TableBlock | LineBlock | ImageBlock;

// Global memory cache for image search queries to avoid repeated fetches
const chatImageQueryCache = new Map<string, string[]>();
const brokenChatImagesSet = new Set<string>();
const brokenChatImageListeners = new Set<(url: string) => void>();

export const markBrokenChatImage = (url: string) => {
  if (!url || brokenChatImagesSet.has(url)) return;
  brokenChatImagesSet.add(url);
  // Prune from query cache
  chatImageQueryCache.forEach((urls, q) => {
    if (urls.includes(url)) {
      chatImageQueryCache.set(q, urls.filter((u) => u !== url));
    }
  });
  brokenChatImageListeners.forEach((fn) => {
    try {
      fn(url);
    } catch (e) {}
  });
};

export const registerBrokenChatImageListener = (fn: (url: string) => void) => {
  brokenChatImageListeners.add(fn);
  return () => {
    brokenChatImageListeners.delete(fn);
  };
};

export const fetchImagesForChatQuery = async (query: string): Promise<string[]> => {
  const cleanQ = query.trim();
  if (!cleanQ) return [];
  if (chatImageQueryCache.has(cleanQ)) {
    const cached = chatImageQueryCache.get(cleanQ)!.filter((u) => !brokenChatImagesSet.has(u));
    chatImageQueryCache.set(cleanQ, cached);
    return cached;
  }

  // 1. Try DuckDuckGo / Pixabay unified endpoint
  try {
    const res = await fetch(`/api/images?q=${encodeURIComponent(cleanQ)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.hits) && data.hits.length > 0) {
        const urls = data.hits
          .map((h: any) => h.largeImageURL || h.webformatURL || h.previewURL)
          .filter((u: any) => typeof u === "string" && u.startsWith("http") && !brokenChatImagesSet.has(u));
        if (urls.length > 0) {
          chatImageQueryCache.set(cleanQ, urls);
          return urls;
        }
      }
    }
  } catch (e) {}

  // 2. Try DuckDuckGo direct fallback endpoint
  try {
    const res2 = await fetch(`/api/duckduckgo-images?q=${encodeURIComponent(cleanQ)}`);
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2 && Array.isArray(data2.results) && data2.results.length > 0) {
        const urls2 = data2.results
          .map((r: any) => r.image || r.thumbnail)
          .filter((u: any) => typeof u === "string" && u.startsWith("http") && !brokenChatImagesSet.has(u));
        if (urls2.length > 0) {
          chatImageQueryCache.set(cleanQ, urls2);
          return urls2;
        }
      }
    }
  } catch (e) {}

  return [];
};

// Parse image tags like $$IMAGE:{...}$$ or $$IMAGES:[{...}]$$ or $$IMAGE|query:...$$
export const parseImageTag = (tagStr: string): ChatImageItem[] | null => {
  const trimmed = tagStr.trim();

  // 1. JSON format: $$IMAGE:{...}$$ or $$IMAGES:[{...}]$$
  const jsonMatch = trimmed.match(/^\$\$(?:IMAGES?|PHOTOS?|IMGS?):\s*(\[[\s\S]*\]|\{[\s\S]*\})\s*\$\$$/i);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => ({
            query: String(item.query || item.q || item.title || item.keyword || "").trim(),
            size: (item.size || "small") as "small" | "medium" | "large",
            caption: String(item.caption || item.desc || item.title || "").trim(),
            keyword: String(item.keyword || item.word || "").trim()
          }))
          .filter((x) => x.query.length > 0);
      } else if (typeof parsed === "object" && parsed !== null) {
        const q = String(parsed.query || parsed.q || parsed.title || parsed.keyword || "").trim();
        if (q) {
          return [
            {
              query: q,
              size: (parsed.size || "large") as "small" | "medium" | "large",
              caption: String(parsed.caption || parsed.desc || parsed.title || "").trim(),
              keyword: String(parsed.keyword || parsed.word || "").trim()
            }
          ];
        }
      }
    } catch (e) {
      // JSON parse error, fall through to pipe format
    }
  }

  // 2. Pipe format: $$IMAGE|query:...|caption:...|size:...$$ or $$IMAGE|query|size|caption$$
  const pipeMatch = trimmed.match(/^\$\$(?:IMAGE|IMAGES|PHOTO|PHOTOS|IMG)\s*\|\s*([^$]+)\$\$$/i);
  if (pipeMatch) {
    const content = pipeMatch[1].trim();
    if (content.includes(":") || content.includes("=")) {
      const parts = content.split(/\|/);
      const item: ChatImageItem = { query: "" };
      parts.forEach((p) => {
        const [k, ...v] = p.split(/[:=]/);
        const key = k?.trim().toLowerCase();
        const val = v.join(":").trim();
        if (key === "query" || key === "q" || key === "search") item.query = val;
        else if (key === "size" || key === "s") item.size = val as any;
        else if (key === "caption" || key === "c" || key === "title") item.caption = val;
        else if (key === "keyword" || key === "word" || key === "k") item.keyword = val;
      });
      if (item.query) {
        return [
          {
            query: item.query,
            size: item.size || "large",
            caption: item.caption || "",
            keyword: item.keyword || ""
          }
        ];
      }
    } else {
      const parts = content.split("|").map((s) => s.trim());
      if (parts[0]) {
        return [
          {
            query: parts[0],
            size: (parts[1] as any) || "large",
            caption: parts[2] || "",
            keyword: parts[3] || ""
          }
        ];
      }
    }
  }

  return null;
};

// Preload images into memory cache for 0ms instant flipping with instant error/block detection
const preloadImageUrls = (urls: string[], limit = 10) => {
  if (typeof window === "undefined" || !Array.isArray(urls)) return;
  // Preload up to 10 images in background and validate health immediately
  urls.slice(0, limit).forEach((url) => {
    if (!url || brokenChatImagesSet.has(url)) return;
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      if (img.naturalWidth === 0) {
        markBrokenChatImage(url);
      }
    };
    img.onerror = () => {
      markBrokenChatImage(url);
    };
    img.src = url;
  });
};

// Interactive Single Image Card with Loading Skeleton, Multi-photo carousel, Audio Pronunciation, and Lightbox trigger
const ChatImageCard: React.FC<{
  item: ChatImageItem;
  onSpeak?: (text: string) => void;
  onOpenLightbox?: (imgUrl: string, caption?: string, keyword?: string, query?: string, allImages?: string[], currentIndex?: number) => void;
}> = ({ item, onSpeak, onOpenLightbox }) => {
  const [images, setImages] = useState<string[]>(() => {
    const cached = (chatImageQueryCache.get(item.query.trim()) || []).filter((u) => !brokenChatImagesSet.has(u));
    if (cached.length > 0) preloadImageUrls(cached, 10);
    return cached;
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(() => images.length === 0);
  const [hasError, setHasError] = useState(false);

  // Instant image skip handler when an image fails or is blocked
  const handleImageError = (failedUrl: string) => {
    if (!failedUrl) return;
    markBrokenChatImage(failedUrl);
    setImages((prev) => {
      const filtered = prev.filter((u) => u !== failedUrl && !brokenChatImagesSet.has(u));
      if (filtered.length === 0) {
        setHasError(true);
      }
      return filtered;
    });
    setCurrentIndex((prev) => {
      const remainingCount = images.filter((u) => u !== failedUrl && !brokenChatImagesSet.has(u)).length;
      if (remainingCount === 0) return 0;
      return prev >= remainingCount ? Math.max(0, remainingCount - 1) : prev;
    });
  };

  // Subscribe to background broken image events to purge failed preloaded images instantly
  useEffect(() => {
    return registerBrokenChatImageListener((brokenUrl) => {
      setImages((prev) => {
        if (!prev.includes(brokenUrl)) return prev;
        const filtered = prev.filter((u) => u !== brokenUrl);
        if (filtered.length === 0) setHasError(true);
        return filtered;
      });
      setCurrentIndex((prev) => {
        const remaining = images.filter((u) => u !== brokenUrl);
        if (remaining.length === 0) return 0;
        return prev >= remaining.length ? Math.max(0, remaining.length - 1) : prev;
      });
    });
  }, [images]);

  // Dynamically preload next 10 images as user navigates
  useEffect(() => {
    if (images.length > 0) {
      const nextBatch = images.slice(currentIndex, currentIndex + 10);
      preloadImageUrls(nextBatch, 10);
    }
  }, [currentIndex, images]);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartXRef.current === null || images.length <= 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = dragStartXRef.current - touchEndX;
    if (Math.abs(diffX) > 35) {
      if (diffX > 0) {
        // Swiped left -> next
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      } else {
        // Swiped right -> prev
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      }
    }
    dragStartXRef.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (images.length <= 1) return;
    dragStartXRef.current = e.clientX;
    setIsDragging(true);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging || dragStartXRef.current === null || images.length <= 1) {
      setIsDragging(false);
      dragStartXRef.current = null;
      return;
    }
    const endX = e.clientX;
    const diffX = dragStartXRef.current - endX;
    if (Math.abs(diffX) > 35) {
      if (diffX > 0) {
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      } else {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      }
    }
    setIsDragging(false);
    dragStartXRef.current = null;
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    dragStartXRef.current = null;
  };

  useEffect(() => {
    let isMounted = true;
    const cleanQ = item.query.trim();
    if (!cleanQ) return;

    const cached = (chatImageQueryCache.get(cleanQ) || []).filter((u) => !brokenChatImagesSet.has(u));
    if (cached && cached.length > 0) {
      setImages(cached);
      preloadImageUrls(cached, 10);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    fetchImagesForChatQuery(cleanQ)
      .then((urls) => {
        if (!isMounted) return;
        const validUrls = urls.filter((u) => !brokenChatImagesSet.has(u));
        if (validUrls.length > 0) {
          setImages(validUrls);
          preloadImageUrls(validUrls, 10);
        } else {
          setHasError(true);
        }
      })
      .catch(() => {
        if (isMounted) setHasError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [item.query]);

  const currentImg = images[currentIndex] || images[0];
  const size = item.size || "large";

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div
        className={`w-full rounded-2xl bg-slate-900/90 border border-slate-800/80 p-3 my-2.5 flex items-center gap-3 animate-pulse ${
          size === "large" ? "min-h-[140px]" : size === "medium" ? "min-h-[110px]" : "min-h-[72px]"
        }`}
      >
        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400/70 shrink-0">
          <ImageIcon className="w-6 h-6 animate-spin" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-slate-700/70 rounded w-2/3"></div>
          <div className="h-2.5 bg-slate-800/80 rounded w-1/3"></div>
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            جاري تحميل الصورة التوضيحية...
          </span>
        </div>
      </div>
    );
  }

  // Error / No image found fallback
  if (hasError || !currentImg || images.length === 0) {
    return null;
  }

  // 1. Small Layout (Grid item or compact word representation)
  if (size === "small") {
    const speakTargetText = item.keyword || item.caption || item.query;
    return (
      <div
        className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-700/70 bg-slate-900/90 hover:border-emerald-500/60 hover:bg-slate-900 transition-all group cursor-grab active:cursor-grabbing shadow-sm select-none"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onOpenLightbox?.(currentImg, item.caption, item.keyword, item.query, images, currentIndex);
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        title="اسحب يميناً ويساراً للتنقل بين الصور • انقر نقراً مزدوجاً للتكبير"
      >
        {/* Thumbnail Image Stack with instant 0ms flipping and error skipping */}
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-slate-800">
          {images.map((imgUrl, idx) => (
            <img
              key={imgUrl + idx}
              src={imgUrl}
              alt={item.caption || item.keyword || "الصورة"}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => handleImageError(imgUrl)}
              onLoad={(e) => {
                if (e.currentTarget.naturalWidth === 0) {
                  handleImageError(imgUrl);
                }
              }}
              className={`absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-200 pointer-events-none ${
                idx === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            />
          ))}
        </div>

        {/* Text Content - Left Aligned */}
        <div className="flex-1 min-w-0 text-left" dir="ltr">
          {item.keyword && (
            <div className="font-bold text-indigo-300 font-sans text-xs sm:text-sm truncate text-left mb-0.5">
              {item.keyword}
            </div>
          )}
          {item.caption && (
            <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed font-medium text-left" dir="auto">
              {item.caption}
            </p>
          )}
        </div>

        {/* Full-Height Audio Listen Button */}
        {onSpeak && speakTargetText && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSpeak(speakTargetText);
            }}
            className="self-stretch w-10 sm:w-11 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 active:scale-95 text-indigo-300 hover:text-white border border-indigo-500/40 hover:border-indigo-400/80 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm"
            title={`استماع للنطق: ${speakTargetText}`}
          >
            <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
      </div>
    );
  }

  // 2. Medium Layout (Aspect 4:3 balanced contextual illustration)
  if (size === "medium") {
    const speakTargetText = item.keyword || item.caption || item.query;
    return (
      <div
        className="w-full max-w-md mx-auto my-2.5 rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900/90 shadow-md group transition-all select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative w-full aspect-[4/3] max-h-[280px] bg-slate-950/90 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onOpenLightbox?.(currentImg, item.caption, item.keyword, item.query, images, currentIndex);
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          title="اسحب يميناً ويساراً للتنقل بين الصور • انقر نقراً مزدوجاً للتكبير"
        >
          {images.map((imgUrl, idx) => (
            <img
              key={imgUrl + idx}
              src={imgUrl}
              alt={item.caption || item.keyword || "الصورة"}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => handleImageError(imgUrl)}
              onLoad={(e) => {
                if (e.currentTarget.naturalWidth === 0) {
                  handleImageError(imgUrl);
                }
              }}
              className={`absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-opacity duration-150 pointer-events-none ${
                idx === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            />
          ))}
        </div>

        {(item.caption || item.keyword) && (
          <div className="p-2.5 border-t border-slate-800 bg-slate-900/95 flex items-stretch justify-between gap-2.5 text-xs">
            {/* Text Content - Left Aligned */}
            <div className="flex-1 min-w-0 text-left" dir="ltr">
              {item.keyword && (
                <div className="font-bold text-indigo-300 font-sans text-xs truncate text-left mb-0.5">
                  {item.keyword}
                </div>
              )}
              {item.caption && (
                <p className="text-xs text-slate-200 leading-snug font-medium text-left" dir="auto">
                  {item.caption}
                </p>
              )}
            </div>

            {/* Full-Height Audio Listen Button */}
            {onSpeak && speakTargetText && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSpeak(speakTargetText);
                }}
                className="self-stretch px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 active:scale-95 text-indigo-300 hover:text-white border border-indigo-500/40 hover:border-indigo-400/80 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm"
                title={`استماع للنطق: ${speakTargetText}`}
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // 3. Large Layout (Balanced 4:3 Proportion Hero Image with rich caption and audio)
  const speakTargetText = item.keyword || item.caption || item.query;
  return (
    <div
      className="w-full max-w-lg mx-auto my-3 rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900/90 shadow-xl group transition-all select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="relative w-full aspect-[4/3] max-h-[380px] bg-slate-950/90 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onOpenLightbox?.(currentImg, item.caption, item.keyword, item.query, images, currentIndex);
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        title="اسحب يميناً ويساراً للتنقل بين الصور • انقر نقراً مزدوجاً للتكبير"
      >
        {images.map((imgUrl, idx) => (
          <img
            key={imgUrl + idx}
            src={imgUrl}
            alt={item.caption || item.keyword || "الصورة"}
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => handleImageError(imgUrl)}
            onLoad={(e) => {
              if (e.currentTarget.naturalWidth === 0) {
                handleImageError(imgUrl);
              }
            }}
            className={`absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-opacity duration-150 pointer-events-none ${
              idx === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          />
        ))}
      </div>

      {(item.caption || item.keyword) && (
        <div className="p-3 sm:p-3.5 border-t border-slate-800 bg-slate-900/95 flex items-stretch justify-between gap-3 text-xs sm:text-sm">
          {/* Text Content - Left Aligned */}
          <div className="flex-1 min-w-0 text-left" dir="ltr">
            {item.keyword && (
              <div className="font-bold text-indigo-300 font-sans text-xs sm:text-sm truncate text-left mb-0.5">
                {item.keyword}
              </div>
            )}
            {item.caption && (
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium text-left" dir="auto">
                {item.caption}
              </p>
            )}
          </div>

          {/* Full-Height Audio Listen Button */}
          {onSpeak && speakTargetText && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSpeak(speakTargetText);
              }}
              className="self-stretch px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 active:scale-95 text-indigo-300 hover:text-white border border-indigo-500/40 hover:border-indigo-400/80 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm"
              title={`استماع للنطق: ${speakTargetText}`}
            >
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Gallery of Images (renders single card or multiple cards in a responsive grid)
const ChatImageGallery: React.FC<{
  items: ChatImageItem[];
  onSpeak?: (text: string) => void;
  onOpenLightbox?: (imgUrl: string, caption?: string, keyword?: string, query?: string, allImages?: string[], currentIndex?: number) => void;
}> = ({ items, onSpeak, onOpenLightbox }) => {
  if (!items || items.length === 0) return null;

  // Single Image Item
  if (items.length === 1) {
    return (
      <ChatImageCard
        item={items[0]}
        onSpeak={onSpeak}
        onOpenLightbox={onOpenLightbox}
      />
    );
  }

  // Multiple Items Gallery Grid
  return (
    <div className="my-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {items.map((item, idx) => (
          <ChatImageCard
            key={idx}
            item={{ ...item, size: item.size || "small" }}
            onSpeak={onSpeak}
            onOpenLightbox={onOpenLightbox}
          />
        ))}
      </div>
    </div>
  );
};

const splitTableRow = (rowStr: string): string[] => {
  let cleaned = rowStr.trim();
  if (cleaned.startsWith("|")) cleaned = cleaned.substring(1);
  if (cleaned.endsWith("|")) cleaned = cleaned.substring(0, cleaned.length - 1);
  return cleaned.split("|").map((cell) => cell.trim());
};

const isSeparatorRow = (rowStr: string): boolean => {
  const trimmed = rowStr.trim();
  if (!trimmed.includes("|") && !trimmed.startsWith("-")) return false;
  const cells = splitTableRow(trimmed);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{1,}:?$/.test(cell.trim()));
};

const getAlignments = (sepStr: string): Array<"right" | "center" | "left" | "auto"> => {
  const cells = splitTableRow(sepStr);
  return cells.map((cell) => {
    const c = cell.trim();
    const startColon = c.startsWith(":");
    const endColon = c.endsWith(":");
    if (startColon && endColon) return "center";
    if (endColon) return "left";
    if (startColon) return "right";
    return "auto";
  });
};

const parseMarkdownBlocks = (lines: string[]): ParsedBlock[] => {
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for Image Tags ($$IMAGE:...$$ or $$IMAGES:[...]$$)
    if (
      trimmed.startsWith("$$IMAGE") ||
      trimmed.startsWith("$$PHOTO") ||
      trimmed.startsWith("$$IMG")
    ) {
      if (trimmed.endsWith("$$")) {
        const imageItems = parseImageTag(trimmed);
        if (imageItems && imageItems.length > 0) {
          blocks.push({ type: "image", items: imageItems });
          i++;
          continue;
        }
      } else {
        // Multi-line JSON image tag collection
        let accumulated = line;
        let j = i + 1;
        let foundEnd = false;
        while (j < lines.length && j < i + 25) {
          accumulated += "\n" + lines[j];
          if (lines[j].trim().endsWith("$$")) {
            foundEnd = true;
            break;
          }
          j++;
        }
        if (foundEnd) {
          const imageItems = parseImageTag(accumulated);
          if (imageItems && imageItems.length > 0) {
            blocks.push({ type: "image", items: imageItems });
            i = j + 1;
            continue;
          }
        }
      }
    }

    // Check for inline image tag in line: split line if it contains $$IMAGE...$$
    if (trimmed.includes("$$IMAGE") || trimmed.includes("$$PHOTO") || trimmed.includes("$$IMG")) {
      const inlineTagMatch = trimmed.match(/(\$\$(?:IMAGE|IMAGES|PHOTO|PHOTOS|IMG)[\s\S]*?\$\$)/);
      if (inlineTagMatch) {
        const tagText = inlineTagMatch[1];
        const parsedItems = parseImageTag(tagText);
        if (parsedItems && parsedItems.length > 0) {
          const before = trimmed.substring(0, inlineTagMatch.index).trim();
          const after = trimmed.substring(inlineTagMatch.index! + tagText.length).trim();
          if (before) blocks.push({ type: "line", line: before });
          blocks.push({ type: "image", items: parsedItems });
          if (after) blocks.push({ type: "line", line: after });
          i++;
          continue;
        }
      }
    }

    // Check for standard markdown table: header row + separator row
    const looksLikeTable = trimmed.includes("|") && splitTableRow(trimmed).length >= 2;
    const nextLineIsSep = i + 1 < lines.length && isSeparatorRow(lines[i + 1]);

    if (looksLikeTable && nextLineIsSep) {
      const headers = splitTableRow(trimmed);
      const alignments = getAlignments(lines[i + 1]);
      const rows: string[][] = [];
      i += 2; // skip header and separator

      while (i < lines.length) {
        const rowLine = lines[i].trim();
        if (rowLine === "" || !rowLine.includes("|")) {
          break;
        }
        if (isSeparatorRow(rowLine)) {
          i++;
          continue;
        }
        rows.push(splitTableRow(rowLine));
        i++;
      }

      blocks.push({
        type: "table",
        headers,
        alignments,
        rows
      });
      continue;
    }

    // Check for consecutive pipe lines (even if separator line was missing)
    if (looksLikeTable && i + 1 < lines.length && lines[i + 1].trim().includes("|")) {
      const firstCells = splitTableRow(trimmed);
      const secondCells = splitTableRow(lines[i + 1].trim());
      if (firstCells.length >= 2 && firstCells.length === secondCells.length) {
        const headers = firstCells;
        const alignments: Array<"right" | "center" | "left" | "auto"> = headers.map(() => "auto");
        const rows: string[][] = [];
        i += 1;
        while (i < lines.length) {
          const rowLine = lines[i].trim();
          if (rowLine === "" || !rowLine.includes("|")) {
            break;
          }
          if (isSeparatorRow(rowLine)) {
            i++;
            continue;
          }
          rows.push(splitTableRow(rowLine));
          i++;
        }
        blocks.push({
          type: "table",
          headers,
          alignments,
          rows
        });
        continue;
      }
    }

    blocks.push({ type: "line", line });
    i++;
  }

  return blocks;
};

// FormattedChatMessage Component for full Markdown parsing (images, tables, headings, dividers, indented lists, bold, code, quotes)
const FormattedChatMessage: React.FC<{
  text: string;
  className?: string;
  onSpeak?: (text: string) => void;
  onCopy?: (text: string) => void;
  onCreateCard?: (text: string) => Promise<void> | void;
  onOpenLightbox?: (imgUrl: string, caption?: string, keyword?: string, query?: string, allImages?: string[], currentIndex?: number) => void;
}> = ({ text, className = "", onSpeak, onCopy, onCreateCard, onOpenLightbox }) => {
  if (!text) return null;

  const cleanedText = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&lt;br\s*\/?&gt;/gi, "\n");

  const rawLines = cleanedText.split("\n");
  const blocks = parseMarkdownBlocks(rawLines);

  return (
    <div dir="auto" className={`space-y-1.5 text-slate-100 leading-relaxed text-start select-text ${className}`}>
      {blocks.map((block, bIdx) => {
        // Render Embedded Images Gallery Block
        if (block.type === "image") {
          return (
            <ChatImageGallery
              key={bIdx}
              items={block.items}
              onSpeak={onSpeak}
              onOpenLightbox={onOpenLightbox}
            />
          );
        }

        // Render Markdown Table with auto-fitted columns and smooth slim horizontal scroll (RTL order: Column 1 on Right)
        if (block.type === "table") {
          return (
            <div
              key={bIdx}
              dir="rtl"
              className="w-full my-3 overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/90 shadow-sm max-w-full table-scrollbar-thin pb-0.5 touch-pan-x"
            >
              <table dir="rtl" className="w-max min-w-full text-xs sm:text-sm text-right border-collapse">
                <thead className="bg-slate-800/95 text-indigo-300 border-b border-slate-700 font-bold">
                  <tr>
                    {block.headers.map((h, hIdx) => {
                      const align = block.alignments[hIdx] || "auto";
                      return (
                        <th
                          key={hIdx}
                          dir="rtl"
                          className={`px-3.5 py-2.5 whitespace-nowrap border-l border-slate-700/60 last:border-l-0 ${
                            align === "center"
                              ? "text-center"
                              : align === "left"
                              ? "text-left"
                              : align === "right"
                              ? "text-right"
                              : "text-right"
                          }`}
                        >
                          {parseInlineChatContent(h, onSpeak, onCopy, onCreateCard)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {block.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={rIdx % 2 === 1 ? "bg-slate-800/35 hover:bg-slate-800/70 transition-colors" : "hover:bg-slate-800/50 transition-colors"}
                    >
                      {row.map((cell, cIdx) => {
                        const align = block.alignments[cIdx] || "auto";
                        return (
                          <td
                            key={cIdx}
                            dir="rtl"
                            className={`px-3.5 py-2.5 whitespace-nowrap text-slate-200 border-l border-slate-800/60 last:border-l-0 ${
                              align === "center"
                                ? "text-center"
                                : align === "left"
                                ? "text-left"
                                : align === "right"
                                ? "text-right"
                                : "text-right"
                            }`}
                          >
                            {parseInlineChatContent(cell, onSpeak, onCopy, onCreateCard)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        const line = block.line;
        const trimmed = line.trim();

        // 1. Horizontal Rule (---, ***, ___, –--)
        if (trimmed === "---" || trimmed === "***" || trimmed === "___" || trimmed === "–--" || trimmed === "- - -") {
          return <hr key={bIdx} className="my-3 border-t border-slate-700/80" />;
        }

        // 2. Heading lines (# title, ## title, ### title, #### title)
        const headingMatch = line.match(/^(\s*)(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[2].length;
          const title = headingMatch[3];
          if (level === 1) {
            return (
              <h1
                key={bIdx}
                dir="auto"
                className="font-black text-white text-base sm:text-lg mt-3 mb-1.5 border-r-3 border-blue-500 pr-2.5 text-start"
              >
                {parseInlineChatContent(title, onSpeak, onCopy, onCreateCard)}
              </h1>
            );
          }
          if (level === 2) {
            return (
              <h2
                key={bIdx}
                dir="auto"
                className="font-extrabold text-white text-sm sm:text-base mt-2.5 mb-1.5 border-r-3 border-blue-500 pr-2.5 text-start"
              >
                {parseInlineChatContent(title, onSpeak, onCopy, onCreateCard)}
              </h2>
            );
          }
          return (
            <h3
              key={bIdx}
              dir="auto"
              className="font-bold text-blue-300 text-xs sm:text-sm mt-2 mb-1 border-r-3 border-blue-500/80 pr-2.5 text-start"
            >
              {parseInlineChatContent(title, onSpeak, onCopy, onCreateCard)}
            </h3>
          );
        }

        // 3. Bullet lists (* item, - item, • item, with support for nested indentation)
        const bulletMatch = line.match(/^(\s*)([-*•])\s+(.+)$/);
        if (bulletMatch) {
          const indent = bulletMatch[1].length;
          const isSub = indent >= 2;
          return (
            <div
              key={bIdx}
              dir="auto"
              className={`flex items-start gap-2 my-1 text-start ${
                isSub ? "mr-4 sm:mr-6 text-slate-300" : "pr-1 text-slate-200"
              }`}
            >
              <span className={`shrink-0 mt-0.5 font-bold ${isSub ? "text-blue-300 text-xs" : "text-blue-400"}`}>
                {isSub ? "◦" : "•"}
              </span>
              <div className="flex-1 leading-relaxed">
                {parseInlineChatContent(bulletMatch[3], onSpeak, onCopy, onCreateCard)}
              </div>
            </div>
          );
        }

        // 4. Numbered lists (1. item, 2. item, 1) item, with support for indentation)
        const numMatch = line.match(/^(\s*)(\d+[\.\)])\s+(.+)$/);
        if (numMatch) {
          const indent = numMatch[1].length;
          const isSub = indent >= 2;
          return (
            <div
              key={bIdx}
              dir="auto"
              className={`flex items-start gap-2 my-1 text-start ${
                isSub ? "mr-4 sm:mr-6 text-slate-300" : "pr-1 text-slate-200"
              }`}
            >
              <span className="text-blue-300 font-extrabold shrink-0 text-xs mt-0.5 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-800/80 font-mono">
                {numMatch[2]}
              </span>
              <div className="flex-1 leading-relaxed">
                {parseInlineChatContent(numMatch[3], onSpeak, onCopy, onCreateCard)}
              </div>
            </div>
          );
        }

        // 5. Empty line (paragraph gap)
        if (trimmed === "") {
          return <div key={bIdx} className="h-1.5" />;
        }

        // 6. Regular text line
        return (
          <div key={bIdx} dir="auto" className="min-h-[1.25em] text-start text-slate-200 leading-relaxed">
            {parseInlineChatContent(line, onSpeak, onCopy, onCreateCard)}
          </div>
        );
      })}
    </div>
  );
};

export const ReviewChatModal: React.FC<ReviewChatModalProps> = ({
  isOpen,
  onClose,
  card,
  previousCards = [],
  nextCards = [],
  folderInfo,
  onPlayPronunciation,
  mediaContext
}) => {
  const [messages, setMessages] = useState<ReviewChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(`review_chat_history_${card.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem("settings_review_chat_model") || "gemini-2.5-flash";
  });
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem("settings_review_chat_voice") || "default";
  });
  const [responseLength, setResponseLength] = useState<"concise" | "auto" | "balanced" | "detailed">(() => {
    return (localStorage.getItem("settings_review_chat_length") as any) || "auto";
  });
  const [useStructuredTemplate, setUseStructuredTemplate] = useState<boolean>(() => {
    const saved = localStorage.getItem("settings_review_chat_structured_template");
    return saved !== null ? saved === "true" : true; // Default is true (enabled like now)
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPromptsMenuOpen, setIsPromptsMenuOpen] = useState(false);
  const [isImageMenuOpen, setIsImageMenuOpen] = useState(false);
  const [isImageMode, setIsImageMode] = useState(true);
  const [activeLightbox, setActiveLightbox] = useState<{
    url: string;
    caption?: string;
    keyword?: string;
    query?: string;
    images: string[];
    currentIndex: number;
  } | null>(null);
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isInitialOpenRef = useRef(true);

  // Reset pagination and reload chat history when card or modal changes
  useEffect(() => {
    if (isOpen) {
      setVisibleCount(10);
      isInitialOpenRef.current = true;
      setIsImageMenuOpen(false);
      setIsPromptsMenuOpen(false);
      try {
        const saved = localStorage.getItem(`review_chat_history_${card.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setMessages(parsed);
            return;
          }
        }
      } catch (e) {}
      setMessages([]);
    }
  }, [isOpen, card.id]);

  // Save response length setting
  useEffect(() => {
    localStorage.setItem("settings_review_chat_length", responseLength);
  }, [responseLength]);

  // Save template structure setting
  useEffect(() => {
    localStorage.setItem("settings_review_chat_structured_template", String(useStructuredTemplate));
  }, [useStructuredTemplate]);

  // Save model selection
  useEffect(() => {
    localStorage.setItem("settings_review_chat_model", selectedModel);
  }, [selectedModel]);

  // Save voice selection purely for Chat without touching global card settings
  useEffect(() => {
    localStorage.setItem("settings_review_chat_voice", selectedVoice);
  }, [selectedVoice]);

  // Save chat history per card (max 30 messages)
  useEffect(() => {
    if (messages.length > 0) {
      try {
        const trimmed = messages.slice(-30);
        localStorage.setItem(`review_chat_history_${card.id}`, JSON.stringify(trimmed));
      } catch (e) {}
    }
  }, [messages, card.id]);

  // Scroll to bottom: instant on open (no animation), smooth on subsequent new messages
  useEffect(() => {
    if (isOpen) {
      if (isInitialOpenRef.current) {
        // Instant jump to bottom without animation
        if (chatScrollContainerRef.current) {
          chatScrollContainerRef.current.scrollTop = chatScrollContainerRef.current.scrollHeight;
        }
        isInitialOpenRef.current = false;
      } else {
        // Smooth scroll for subsequent user/AI messages
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages, isOpen, visibleCount]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Dedicated Chat Audio Player that respects selectedVoice from chat settings
  const handlePlayChatVoice = (text: string, customLang?: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    const lang = customLang || card.frontLang || folderInfo?.targetLanguage || "de";
    
    if (selectedVoice && selectedVoice !== "default") {
      // User explicitly picked a voice for the chat (e.g. Thorsten Emotional, Ramona, Ryan, Google, Gradio, etc.)
      speakClient(cleanText, lang, selectedVoice);
    } else if (onPlayPronunciation) {
      // Fall back to card's active voice target (primary or secondary)
      onPlayPronunciation(cleanText, lang);
    } else {
      speakClient(cleanText, lang);
    }
  };

  const handleSendMessage = async (textToSend?: string, forceImages?: boolean) => {
    const query = (textToSend !== undefined ? textToSend : inputMessage).trim();
    if (!query || isLoading) return;

    const shouldIncludeImages = forceImages || isImageMode;

    const userMsg: ReviewChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev.slice(-29), userMsg]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const customGeminiKey = localStorage.getItem("gemini_api_key") || localStorage.getItem("settings_gemini_api_key") || "";
      const customGroqKey = localStorage.getItem("groq_api_key") || localStorage.getItem("settings_groq_api_key") || "";

      const historyPayload = messages.slice(-28).map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch("/api/ai/review-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card: {
            id: card.id,
            frontText: card.frontText,
            backText: card.backText,
            translationHint: card.translationHint,
            correctArticle: card.correctArticle,
            pluralText: card.pluralText,
            frontLang: card.frontLang,
            backLang: card.backLang
          },
          previousCards: (previousCards || []).slice(-5).map((c) => ({
            frontText: c.frontText,
            backText: c.backText,
            translationHint: c.translationHint,
            correctArticle: c.correctArticle
          })),
          nextCards: (nextCards || []).slice(0, 5).map((c) => ({
            frontText: c.frontText,
            backText: c.backText,
            translationHint: c.translationHint,
            correctArticle: c.correctArticle
          })),
          folderInfo: {
            name: folderInfo?.name || (mediaContext ? mediaContext.mediaTitle : "مجموعة البطاقات"),
            description: folderInfo?.description || (mediaContext ? `مقطع ${mediaContext.mediaType === 'audio' ? 'صوتي' : 'فيديو'}` : ""),
            targetLanguage: card.frontLang || folderInfo?.targetLanguage || "de",
            sourceLanguage: card.backLang || folderInfo?.sourceLanguage || "ar"
          },
          mediaInfo: mediaContext ? {
            id: mediaContext.mediaId,
            title: mediaContext.mediaTitle,
            originalName: mediaContext.originalName,
            type: mediaContext.mediaType,
            duration: mediaContext.duration,
            cueStartTime: mediaContext.cueStartTime,
            cueEndTime: mediaContext.cueEndTime
          } : undefined,
          chatHistory: historyPayload,
          message: query,
          includeImages: shouldIncludeImages,
          selectedModel: selectedModel,
          responseLength: responseLength,
          useStructuredTemplate: useStructuredTemplate,
          geminiApiKey: customGeminiKey,
          groqApiKey: customGroqKey
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `خطأ في الخادم (${res.status})`);
      }

      const data = await res.json();
      const aiReply: ReviewChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.reply || "لم أستطع صياغة رد واضح، يرجى المحاولة ثانية.",
        modelUsed: data.usedModel || selectedModel,
        timestamp: Date.now()
      };

      setMessages((prev) => [...prev.slice(-29), aiReply]);
    } catch (err: any) {
      const errorMsg: ReviewChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `⚠️ تعذر إكمال الطلب: ${err.message || "يرجى التحقق من اتصالك بالإنترنت أو مفتاح الـ API."}`,
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Create flashcard from token with smart AI backend call & DB sync
  const handleCreateCardFromToken = async (tokenText: string) => {
    const customGeminiKey = localStorage.getItem("gemini_api_key") || localStorage.getItem("settings_gemini_api_key") || "";
    const customGroqKey = localStorage.getItem("groq_api_key") || localStorage.getItem("settings_groq_api_key") || "";
    const langToUse = card.frontLang === "de" ? "German" : "English";

    try {
      const res = await fetch("/api/ai/make-card-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotedText: tokenText,
          targetLanguage: langToUse,
          geminiApiKey: customGeminiKey,
          groqApiKey: customGroqKey,
          model: selectedModel
        })
      });

      let cardData: Omit<Flashcard, "id" | "folderId" | "createdAt" | "streak">;

      if (res.ok) {
        const data = await res.json();
        if (data.card) {
          cardData = data.card;
        } else {
          throw new Error("Invalid response format");
        }
      } else {
        throw new Error("Failed to fetch card from AI");
      }

      // Determine target folder: current folder or folder named "بطاقات"
      let cachedFolders: Folder[] = [];
      let cachedCards: Flashcard[] = [];
      try {
        cachedFolders = JSON.parse(localStorage.getItem("cached_folders") || "[]");
        cachedCards = JSON.parse(localStorage.getItem("cached_cards") || "[]");
      } catch (e) {}

      let targetFolderId = card.folderId;
      if (!targetFolderId) {
        const existingFolder = cachedFolders.find((f) => f.name && f.name.trim().toLowerCase() === "بطاقات");
        if (existingFolder) {
          targetFolderId = existingFolder.id;
        } else {
          const newFolder: Folder = {
            id: `folder-${Date.now()}`,
            name: "بطاقات",
            description: "",
            color: "#3b82f6",
            frontLang: card.frontLang || "de",
            backLang: "ar",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          cachedFolders = [newFolder, ...cachedFolders];
          targetFolderId = newFolder.id;
        }
      }

      const newCard: Flashcard = {
        ...cardData,
        id: `card-${Date.now()}`,
        folderId: targetFolderId,
        createdAt: new Date().toISOString(),
        streak: 0
      };

      const updatedCards = [newCard, ...cachedCards];

      // Save to localStorage & database
      try {
        localStorage.setItem("cached_folders", JSON.stringify(cachedFolders));
        localStorage.setItem("cached_cards", JSON.stringify(updatedCards));
      } catch (e) {}

      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folders: cachedFolders, cards: updatedCards })
      }).catch(console.error);

      setToastMessage(`تمت إضافة البطاقة "${newCard.frontText}" بنجاح إلى المجلد 🎴`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.warn("Fallback local card creation:", err);
      // Fallback local card
      const matchArt = tokenText.trim().match(/^(der|die|das)\s+(.+)$/i);
      const cleanFront = matchArt ? matchArt[2].trim() : tokenText.trim();
      const articleFound = matchArt ? matchArt[1].toLowerCase() : "";

      let cachedFolders: Folder[] = [];
      let cachedCards: Flashcard[] = [];
      try {
        cachedFolders = JSON.parse(localStorage.getItem("cached_folders") || "[]");
        cachedCards = JSON.parse(localStorage.getItem("cached_cards") || "[]");
      } catch (e) {}

      const newCard: Flashcard = {
        id: `card-${Date.now()}`,
        folderId: card.folderId || (cachedFolders[0]?.id || ""),
        frontText: cleanFront,
        frontLang: card.frontLang || "de",
        backText: tokenText.trim(),
        backLang: "ar",
        translationHint: "بطاقة مضافة من جلسة المراجعة الذكية",
        isArticleMode: !!articleFound,
        correctArticle: articleFound,
        frontImage: `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanFront)}%20clear%20photo%20isolated%20educational?width=512&height=512&nologo=true`,
        autoImageCandidates: [`https://image.pollinations.ai/prompt/${encodeURIComponent(cleanFront)}%20clear%20photo%20isolated%20educational?width=512&height=512&nologo=true`],
        difficulty: "medium",
        createdAt: new Date().toISOString(),
        streak: 0
      };

      const updatedCards = [newCard, ...cachedCards];
      try {
        localStorage.setItem("cached_cards", JSON.stringify(updatedCards));
      } catch (e) {}

      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folders: cachedFolders, cards: updatedCards })
      }).catch(console.error);

      setToastMessage(`تمت إضافة البطاقة "${tokenText}" بنجاح 🎴`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    if (window.confirm("هل ترغب في مسح سجل محادثة هذه البطاقة؟")) {
      setMessages([]);
      localStorage.removeItem(`review_chat_history_${card.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Lightbox error skip handler for blocked or failed images
  const handleLightboxImageError = (failedUrl: string) => {
    if (!failedUrl) return;
    markBrokenChatImage(failedUrl);
    setActiveLightbox((prev) => {
      if (!prev) return null;
      const filtered = (prev.images || [prev.url]).filter((u) => u !== failedUrl && !brokenChatImagesSet.has(u));
      if (filtered.length === 0) return null;
      const nextIdx = prev.currentIndex >= filtered.length ? Math.max(0, filtered.length - 1) : prev.currentIndex;
      return {
        ...prev,
        images: filtered,
        currentIndex: nextIdx,
        url: filtered[nextIdx] || filtered[0]
      };
    });
  };

  // Lightbox flip handlers
  const handleLightboxPrev = () => {
    if (!activeLightbox || !activeLightbox.images || activeLightbox.images.length <= 1) return;
    setActiveLightbox((prev) => {
      if (!prev) return null;
      const newIdx = prev.currentIndex > 0 ? prev.currentIndex - 1 : prev.images.length - 1;
      return {
        ...prev,
        currentIndex: newIdx,
        url: prev.images[newIdx] || prev.url
      };
    });
  };

  const handleLightboxNext = () => {
    if (!activeLightbox || !activeLightbox.images || activeLightbox.images.length <= 1) return;
    setActiveLightbox((prev) => {
      if (!prev) return null;
      const newIdx = prev.currentIndex < prev.images.length - 1 ? prev.currentIndex + 1 : 0;
      return {
        ...prev,
        currentIndex: newIdx,
        url: prev.images[newIdx] || prev.url
      };
    });
  };

  // Preload lightbox images dynamically
  useEffect(() => {
    if (activeLightbox?.images && activeLightbox.images.length > 0) {
      preloadImageUrls(activeLightbox.images, 10);
    }
  }, [activeLightbox?.images]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!activeLightbox) return;
    const handleLightboxKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveLightbox(null);
      } else if (e.key === "ArrowLeft") {
        handleLightboxNext();
      } else if (e.key === "ArrowRight") {
        handleLightboxPrev();
      }
    };
    window.addEventListener("keydown", handleLightboxKeyDown);
    return () => window.removeEventListener("keydown", handleLightboxKeyDown);
  }, [activeLightbox]);

  // Lightbox gesture navigation identical to ReviewSession
  const getSwipeSensitivity = () => {
    try {
      const saved = localStorage.getItem("settings_swipe_sensitivity");
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch (e) {}
    return 30;
  };

  const lightboxTouchStartX = useRef<number | null>(null);
  const lightboxTouchStartY = useRef<number | null>(null);
  const isLightboxSwiping = useRef<boolean>(false);
  const lightboxSwipeTriggered = useRef<boolean>(false);
  const lightboxGestureDirection = useRef<'none' | 'horizontal' | 'vertical'>('none');

  const handleLightboxTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    lightboxTouchStartX.current = touch.clientX;
    lightboxTouchStartY.current = touch.clientY;
    isLightboxSwiping.current = true;
    lightboxSwipeTriggered.current = false;
    lightboxGestureDirection.current = 'none';
  };

  const handleLightboxTouchMove = (e: React.TouchEvent) => {
    if (!lightboxTouchStartX.current || !lightboxTouchStartY.current || !isLightboxSwiping.current) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - lightboxTouchStartX.current;
    const diffY = touch.clientY - lightboxTouchStartY.current;
    const sensitivity = getSwipeSensitivity();

    if (lightboxGestureDirection.current === 'none') {
      const absX = Math.abs(diffX);
      const absY = Math.abs(diffY);
      if (absX > 8 || absY > 8) {
        if (absX > absY) {
          lightboxGestureDirection.current = 'horizontal';
        } else {
          lightboxGestureDirection.current = 'vertical';
        }
      }
      return;
    }

    if (lightboxGestureDirection.current === 'vertical') {
      // Swipe down to exit (same as ReviewSession fullscreen)
      if (diffY > sensitivity * 1.4) {
        e.stopPropagation();
        lightboxSwipeTriggered.current = true;
        isLightboxSwiping.current = false;
        setActiveLightbox(null);
      }
    } else if (lightboxGestureDirection.current === 'horizontal') {
      // Horizontal swipe to navigate previous / next continuously
      if (Math.abs(diffX) > sensitivity) {
        e.stopPropagation();
        lightboxSwipeTriggered.current = true;
        // Update anchor position to allow effortless consecutive multi-image flips in one swipe!
        lightboxTouchStartX.current = touch.clientX;
        lightboxTouchStartY.current = touch.clientY;
        if (diffX > 0) {
          handleLightboxPrev();
        } else {
          handleLightboxNext();
        }
      }
    }
  };

  const handleLightboxTouchEnd = (e: React.TouchEvent) => {
    // If not already triggered during move, check final flick
    if (
      !lightboxSwipeTriggered.current &&
      lightboxTouchStartX.current !== null &&
      lightboxGestureDirection.current === 'horizontal'
    ) {
      const endX = e.changedTouches[0].clientX;
      const diffX = endX - lightboxTouchStartX.current;
      const sensitivity = getSwipeSensitivity();
      if (Math.abs(diffX) > sensitivity * 0.8) {
        if (diffX > 0) {
          handleLightboxPrev();
        } else {
          handleLightboxNext();
        }
      }
    }
    isLightboxSwiping.current = false;
    lightboxTouchStartX.current = null;
    lightboxTouchStartY.current = null;
    lightboxGestureDirection.current = 'none';
  };

  const lightboxMouseStartX = useRef<number | null>(null);
  const lightboxMouseStartY = useRef<number | null>(null);
  const isLightboxMouseDown = useRef<boolean>(false);

  const handleLightboxMouseDown = (e: React.MouseEvent) => {
    lightboxMouseStartX.current = e.clientX;
    lightboxMouseStartY.current = e.clientY;
    isLightboxMouseDown.current = true;
    lightboxSwipeTriggered.current = false;
    lightboxGestureDirection.current = 'none';
  };

  const handleLightboxMouseMove = (e: React.MouseEvent) => {
    if (!lightboxMouseStartX.current || !lightboxMouseStartY.current || !isLightboxMouseDown.current) return;
    const diffX = e.clientX - lightboxMouseStartX.current;
    const diffY = e.clientY - lightboxMouseStartY.current;
    const sensitivity = getSwipeSensitivity();

    if (lightboxGestureDirection.current === 'none') {
      const absX = Math.abs(diffX);
      const absY = Math.abs(diffY);
      if (absX > 8 || absY > 8) {
        if (absX > absY) {
          lightboxGestureDirection.current = 'horizontal';
        } else {
          lightboxGestureDirection.current = 'vertical';
        }
      }
      return;
    }

    if (lightboxGestureDirection.current === 'vertical') {
      if (diffY > sensitivity * 1.4) {
        e.stopPropagation();
        lightboxSwipeTriggered.current = true;
        isLightboxMouseDown.current = false;
        setActiveLightbox(null);
      }
    } else if (lightboxGestureDirection.current === 'horizontal') {
      if (Math.abs(diffX) > sensitivity) {
        e.stopPropagation();
        lightboxSwipeTriggered.current = true;
        lightboxMouseStartX.current = e.clientX;
        lightboxMouseStartY.current = e.clientY;
        if (diffX > 0) {
          handleLightboxPrev();
        } else {
          handleLightboxNext();
        }
      }
    }
  };

  const handleLightboxMouseUp = (e: React.MouseEvent) => {
    if (
      !lightboxSwipeTriggered.current &&
      lightboxMouseStartX.current !== null &&
      lightboxGestureDirection.current === 'horizontal'
    ) {
      const diffX = e.clientX - lightboxMouseStartX.current;
      const sensitivity = getSwipeSensitivity();
      if (Math.abs(diffX) > sensitivity * 0.8) {
        if (diffX > 0) {
          handleLightboxPrev();
        } else {
          handleLightboxNext();
        }
      }
    }
    isLightboxMouseDown.current = false;
    lightboxMouseStartX.current = null;
    lightboxMouseStartY.current = null;
    lightboxGestureDirection.current = 'none';
  };

  const handleLightboxMouseLeave = () => {
    isLightboxMouseDown.current = false;
    lightboxMouseStartX.current = null;
    lightboxMouseStartY.current = null;
    lightboxGestureDirection.current = 'none';
  };

  if (!isOpen) return null;

  const formatSeconds = (sec?: number) => {
    if (sec === undefined || isNaN(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const quickPrompts = mediaContext
    ? (responseLength === "concise" ? [
        { icon: "💡", label: "معنى وسياق سريع", prompt: `وضح لي باختصار شديد المعنى الدقيق لجملة "${card.frontText}" وسياق استخدامها في هذا المشهد مع الترجمة.` },
        { icon: "🔊", label: "نطق ونبرة الجملة", prompt: `كيف ينطق المتحدثون الأصليون جملة "${card.frontText}" وما هي نبرتها وسرعتها الطبيعية؟` },
        { icon: "🔍", label: "القواعد والتراكيب", prompt: `وضح لي باختصار القواعد النحوية وتصريف الأفعال في الجملة "${card.frontText}".` },
        { icon: "✍️", label: "أقرب بديل يومي", prompt: `ما هو البديل الأكثر شيوعاً وعفوية عند الناطقين الأصليين للتعبير عن "${card.frontText}"؟` },
        { icon: "🎯", label: "اختبار فهم المشهد", prompt: `اطرح علي سؤال اختبار سريع للتأكد من فهمي لمقصد جملة "${card.frontText}" في هذا المقطع.` }
      ] : [
        { icon: "💡", label: "شرح الجملة وسياق المشهد", prompt: `اشرح لي بالتفصيل المعنى الدقيق لجملة "${card.frontText}" وسياق استخدامها في هذا المشهد وما تحمله من دلالات.` },
        { icon: "✍️", label: "3 بدائل حوارية واقعية", prompt: `أعطني 3 بدائل يومية متنوعة مستخدمة من قبل الناطقين الأصليين للتعبير عن معنى "${card.frontText}" مع الترجمة.` },
        { icon: "🔍", label: "القواعد والتراكيب والإعراب", prompt: `اشرح القواعد النحوية والتراكيب المستخدمة في جملة "${card.frontText}" وتصريفات الأفعال وأدوات الربط بالتفصيل.` },
        { icon: "⚖️", label: "الفروقات والتعبيرات الاصطلاحية", prompt: `هل تحتوي الجملة "${card.frontText}" على تعبيرات اصطلاحية (Idioms) أو مفردات مميزة؟ وضحها بدقة.` },
        { icon: "🎯", label: "اختبرني بسؤال أو تمرين", prompt: `اطرح علي سؤالاً أو تمرين إكمال فراغ لاختبار فهمي لجملة "${card.frontText}" واستخدامها الصحيح.` }
      ])
    : (responseLength === "concise" ? [
        { icon: "💡", label: "معنى سريع ومباشر", prompt: `وضح لي باختصار شديد معنى وأصل الكلمة "${card.frontText}" وترجمتها الدقيقة.` },
        { icon: "✍️", label: "مثال سياقي واحد", prompt: `أعطني مثالاً واقعياً واحداً فقط يحتوي على "${card.frontText}" مع الترجمة.` },
        { icon: "🔍", label: "الأداة والقاعدة بإيجاز", prompt: `وضح لي باختصار الأداة وقاعدة "${card.frontText}" ${card.correctArticle ? `(${card.correctArticle})` : ''}.` },
        { icon: "⚖️", label: "أقرب مرادف", prompt: `ما هو أقرب مرادف لـ "${card.frontText}" في جملة سريعة؟` },
        { icon: "🎯", label: "سؤال اختبار سريع", prompt: `اطرح علي سؤال اختبار سريع في سطر لاختبار فهمي للكلمة "${card.frontText}".` }
      ] : [
        { icon: "💡", label: "شرح الكلمة والأصل", prompt: `اشرح لي بالتفصيل معنى وأصل الكلمة "${card.frontText}" واستخداماتها الدقيقة.` },
        { icon: "✍️", label: "3 جمل سياقية واقعية", prompt: `أعطني 3 جمل يومية واقعية ومتنوعة مستخدمة من قبل الناطقين الأصليين تحتوي على "${card.frontText}" مع الترجمة.` },
        { icon: "🔍", label: "القواعد والإعراب والأداة", prompt: `اشرح لي القواعد النحوية المرتبطة بـ "${card.frontText}" ${card.correctArticle ? `(أداة التعريف ${card.correctArticle})` : ''} وصيغ الجمع أو تصريفات الفعل مع الضمائر.` },
        { icon: "⚖️", label: "الفروقات والمرادفات", prompt: `ما هي أهم المرادفات لـ "${card.frontText}" وما الفرق الدقيق بينها في الاستخدام اليومي؟` },
        { icon: "🎯", label: "اختبرني بسؤال أو تمرين", prompt: `اطرح علي سؤالاً أو تمرين إكمال فراغ لاختبار فهمي للكلمة "${card.frontText}".` }
      ]);

  const imageQuickPrompts = mediaContext ? [
    {
      icon: "🖼️",
      label: "شرح بصري للمشهد مع صور",
      prompt: `اشرح لي الجملة "${card.frontText}" بالتفصيل مع إرفاق صور توضيحية عالية الجودة للأشياء والمفاهيم المرتبطة بسياقها.`
    },
    {
      icon: "🧩",
      label: "صور للمفاهيم والكلمات الرئيسية",
      prompt: `اعرض لي صوراً توضيحية للمفردات والمفاهيم الرئيسية في "${card.frontText}" مع تسمية ونطق كل جزء باللغة ${card.frontLang === 'de' ? 'الألمانية' : 'الإنجليزية'}.`
    },
    {
      icon: "📸",
      label: "صور لمواقف وسياقات الاستخدام",
      prompt: `أريد صوراً توضيحية لمواقف وسياقات واقعية تُستخدم فيها هذه العبارة "${card.frontText}" في الحياة اليومية.`
    },
    {
      icon: "⚖️",
      label: "مقارنة بصرية بالصور",
      prompt: `قارن بالصور التوضيحية بين معاني ومفردات "${card.frontText}" وتطبيقاتها الحياتية المختلفة.`
    }
  ] : [
    {
      icon: "🖼️",
      label: "شرح بصري شامل مع صور",
      prompt: `اشرح لي الكلمة "${card.correctArticle ? card.correctArticle + ' ' : ''}${card.frontText}" بالتفصيل مع إرفاق صور توضيحية عالية الجودة للأشياء والمفاهيم المرتبطة بها.`
    },
    {
      icon: "🧩",
      label: "صور لمكونات وأجزاء الكلمة",
      prompt: `اعرض لي صوراً توضيحية لمكونات وتفاصيل "${card.frontText}" مع تسمية ونطق كل جزء باللغة ${card.frontLang === 'de' ? 'الألمانية' : 'الإنجليزية'}.`
    },
    {
      icon: "📸",
      label: "صور لسياقات الاستخدام الواقعية",
      prompt: `أريد صوراً توضيحية لمواقف وسياقات استخدام "${card.frontText}" في الحياة اليومية مع أمثلة عملية.`
    },
    {
      icon: "⚖️",
      label: "مقارنة مرئية بالصور مع كلمات مشابهة",
      prompt: `قارن بالصور التوضيحية بين "${card.frontText}" وأقرب الكلمات المشابهة أو المرادفات مع توضيح الفروقات بدقة.`
    }
  ];

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md select-none animate-fadeIn"
      dir="rtl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* High-Resolution Fullscreen Lightbox Modal with Touch/Drag Navigation */}
      <AnimatePresence>
        {activeLightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000002] bg-black/92 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 select-none cursor-grab active:cursor-grabbing"
            onClick={(e) => {
              e.stopPropagation();
            }}
            onTouchStart={handleLightboxTouchStart}
            onTouchMove={handleLightboxTouchMove}
            onTouchEnd={handleLightboxTouchEnd}
            onMouseDown={handleLightboxMouseDown}
            onMouseMove={handleLightboxMouseMove}
            onMouseUp={handleLightboxMouseUp}
            onMouseLeave={handleLightboxMouseLeave}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveLightbox(null);
              }}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shadow-lg z-20 pointer-events-auto"
              title="إغلاق الصورة المكبرة"
            >
              <X className="w-5 h-5" />
            </button>

            <div
              className="w-full max-w-4xl h-[88vh] flex flex-col items-center justify-between gap-4 select-none pointer-events-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Floating Image Container without background box or heavy border */}
              <div className="relative flex-1 min-h-0 w-full flex items-center justify-center pointer-events-none">
                <div className="relative w-full h-full flex items-center justify-center">
                  {(activeLightbox.images && activeLightbox.images.length > 0 ? activeLightbox.images : [activeLightbox.url]).map((imgUrl, idx) => (
                    <img
                      key={imgUrl + idx}
                      src={imgUrl}
                      alt={activeLightbox.caption || activeLightbox.query || "الصورة"}
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => handleLightboxImageError(imgUrl)}
                      onLoad={(e) => {
                        if (e.currentTarget.naturalWidth === 0) {
                          handleLightboxImageError(imgUrl);
                        }
                      }}
                      className={`absolute max-h-[72vh] max-w-full object-contain rounded-2xl drop-shadow-[0_20px_35px_rgba(0,0,0,0.85)] pointer-events-none transition-opacity duration-200 ${
                        idx === (activeLightbox.currentIndex ?? 0) ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Fixed Stable Bottom Caption Card */}
              {(activeLightbox.caption || activeLightbox.keyword) && (
                <div className="w-full max-w-xl shrink-0 bg-slate-900/90 border border-slate-700/70 rounded-2xl p-3.5 text-center space-y-2 shadow-2xl backdrop-blur-md pointer-events-auto">
                  {activeLightbox.caption && (
                    <div className="text-sm sm:text-base font-bold text-white leading-relaxed line-clamp-2" dir="auto">
                      {activeLightbox.caption}
                    </div>
                  )}
                  {activeLightbox.keyword && (
                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-300">
                      <button
                        type="button"
                        onClick={() => {
                          handlePlayChatVoice(activeLightbox.keyword!, card.frontLang || "de");
                        }}
                        className="flex items-center gap-1.5 font-bold font-sans text-indigo-300 hover:text-white bg-indigo-950/80 border border-indigo-500/40 px-3 py-1.5 rounded-xl transition-colors cursor-pointer active:scale-95 shadow-xs"
                      >
                        <span>{activeLightbox.keyword}</span>
                        <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Toast Alert Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000001] bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 border border-emerald-400/60 text-xs sm:text-sm font-bold"
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="w-full max-w-3xl h-[92vh] max-h-[850px] bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="px-4 sm:px-6 py-3 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
          {/* Right: AI Title & Active Word/Sentence */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              {mediaContext ? (
                mediaContext.mediaType === "audio" ? <Music className="w-4 h-4 text-emerald-400" /> : <Film className="w-4 h-4 text-blue-400" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <h3 className="font-bold text-xs sm:text-sm text-white shrink-0">
                {mediaContext ? "مساعد المشهد والسكربت" : "المساعد اللغوي"}
              </h3>
            </div>
          </div>

          {/* Left: Actions (Play clip, Pronounce, Settings, Context, Clear, Close) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Play Media Segment / Audio Clip Button */}
            {mediaContext?.onPlayMediaSegment && mediaContext.cueStartTime !== undefined && (
              <button
                type="button"
                onClick={() => mediaContext.onPlayMediaSegment!(mediaContext.cueStartTime!, mediaContext.cueEndTime)}
                title="سماع المقطع الصوتي/الفيديو الحقيقي من المشهد"
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                <span className="hidden sm:inline">سماع المقطع</span>
              </button>
            )}

            {/* TTS Pronunciation Button */}
            <button
              type="button"
              onClick={() => handlePlayChatVoice(card.frontText, card.frontLang || "de")}
              title="نطق الجملة بصوت الذكاء الاصطناعي"
              className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 text-xs font-medium transition-all cursor-pointer flex items-center gap-1"
            >
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">نطق</span>
            </button>

            {/* Context Drawer Button */}
            <button
              type="button"
              onClick={() => setIsContextDrawerOpen(!isContextDrawerOpen)}
              title={mediaContext ? "عرض سياق السكربت والجمل السابقة والتالية" : "عرض سياق البطاقات السابقة والتالية"}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1 border ${
                isContextDrawerOpen
                  ? "bg-indigo-600/25 text-indigo-300 border-indigo-500/50"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/60"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs font-medium">
                {mediaContext ? "السكربت" : "السياق"}
              </span>
            </button>

            {/* Model & Settings Button */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              title="اختيار الموديل والإعدادات"
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1 border ${
                isSettingsOpen
                  ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/40"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/60"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs font-medium">الموديل</span>
            </button>

            {/* Clear History */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                title="مسح المحادثة"
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 border border-slate-700/60 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Exit Button */}
            <button
              type="button"
              onClick={onClose}
              title="إغلاق"
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* COMPACT SENTENCE REFERENCE (Simple text box, zero clutter, minimal vertical height) */}
        {card.frontText && (
          <div className="px-3.5 py-1 bg-slate-950/70 border-b border-slate-800/60 flex items-center gap-2 text-xs shrink-0 select-text">
            <span className="text-slate-400 text-[11px] font-medium shrink-0">الجملة:</span>
            <div className="text-slate-200 text-xs font-normal truncate dir-ltr min-w-0 flex-1 flex items-center gap-1.5" title={card.frontText}>
              <span className="font-medium text-slate-100 truncate">
                {card.correctArticle ? `${card.correctArticle} ` : ''}{card.frontText}
              </span>
              {card.backText ? (
                <span className="text-slate-400 text-[11px] font-normal truncate shrink-0 max-w-[200px] border-r border-slate-800 pr-2 mr-1">
                  ({card.backText})
                </span>
              ) : null}
            </div>
          </div>
        )}

        {/* CONTEXT INSPECTOR DRAWER */}
        <AnimatePresence>
          {isContextDrawerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-slate-950/95 border-b border-slate-800 p-4 shrink-0 overflow-y-auto max-h-64 z-20 text-xs"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-1.5">
                  <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                    {mediaContext ? (
                      <>
                        <Film className="w-3.5 h-3.5 text-blue-400" />
                        <span>سياق السكربت والمشهد (Script & Scene Context):</span>
                      </>
                    ) : (
                      <>
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        <span>سياق البيئة والبطاقات (Context Awareness):</span>
                      </>
                    )}
                  </span>
                  <span className="truncate max-w-[200px]">
                    {mediaContext ? `🎬 ${mediaContext.mediaTitle}` : `المجلد: ${folderInfo?.name || "بدون اسم"}`}
                  </span>
                </div>

                {/* Previous 5 Items */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">
                    {mediaContext ? "⏮️ الجمل السابقة في السكربت:" : "⏮️ البطاقات السابقة (الـ 5 السابقة):"}
                  </span>
                  {(previousCards && previousCards.length > 0) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {previousCards.slice(-5).map((c, i) => (
                        <div key={c.id || i} className="bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 rounded-lg text-[11px] flex items-center justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            <span className="font-sans font-bold text-slate-300 truncate dir-ltr">{c.correctArticle ? `${c.correctArticle} ` : ''}{c.frontText}</span>
                            {c.backText && <span className="text-[10px] text-slate-400 truncate">{c.backText}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePlayChatVoice(c.frontText, c.frontLang || "de")}
                            className="p-1 text-slate-400 hover:text-white shrink-0"
                            title="استماع"
                          >
                            <Volume2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500 text-[10px]">لا توجد عناصر سابقة</span>
                  )}
                </div>

                {/* Current Active Item */}
                <div className="p-2.5 bg-indigo-950/40 border border-indigo-600/40 rounded-xl">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                      {mediaContext ? "🎬 الجملة الحالية في المشهد:" : "🃏 البطاقة الحالية النشطة:"}
                    </span>
                    {mediaContext?.onPlayMediaSegment && mediaContext.cueStartTime !== undefined && (
                      <button
                        type="button"
                        onClick={() => mediaContext.onPlayMediaSegment!(mediaContext.cueStartTime!, mediaContext.cueEndTime)}
                        className="px-2 py-0.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-2.5 h-2.5 fill-emerald-400" />
                        <span>تشغيل المقطع</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-white font-bold font-sans gap-2">
                    <span className="dir-ltr text-xs sm:text-sm">{card.correctArticle ? `${card.correctArticle} ` : ''}{card.frontText} {card.pluralText ? `(جمع: ${card.pluralText})` : ''}</span>
                    <span className="text-indigo-200 font-normal text-xs">{card.backText}</span>
                  </div>
                  {card.translationHint && (
                    <p className="text-[10px] text-slate-400 mt-1">تلميح/وصف: {card.translationHint}</p>
                  )}
                </div>

                {/* Next 5 Items */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">
                    {mediaContext ? "⏭️ الجمل التالية في السكربت:" : "⏭️ البطاقات التالية (الـ 5 التالية):"}
                  </span>
                  {(nextCards && nextCards.length > 0) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {nextCards.slice(0, 5).map((c, i) => (
                        <div key={c.id || i} className="bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 rounded-lg text-[11px] flex items-center justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            <span className="font-sans font-bold text-slate-300 truncate dir-ltr">{c.correctArticle ? `${c.correctArticle} ` : ''}{c.frontText}</span>
                            {c.backText && <span className="text-[10px] text-slate-400 truncate">{c.backText}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePlayChatVoice(c.frontText, c.frontLang || "de")}
                            className="p-1 text-slate-400 hover:text-white shrink-0"
                            title="استماع"
                          >
                            <Volume2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500 text-[10px]">لا توجد عناصر تالية</span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CHAT MESSAGES BODY */}
        <div
          ref={chatScrollContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 select-text"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto my-auto space-y-4 py-8">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-7 h-7" />
              </div>
              <p className="text-sm text-slate-300 font-medium">
                اسأل عن القواعد، المعاني، أو اطلب جمل وأمثلة توضيحية
              </p>

              {/* Quick Prompts */}
              <div className="w-full flex flex-wrap items-center justify-center gap-2 pt-2">
                {quickPrompts.map((qp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(qp.prompt)}
                    className="px-3 py-1.5 bg-slate-800/90 hover:bg-indigo-600/20 hover:border-indigo-500/50 border border-slate-700/80 rounded-xl text-xs text-slate-200 transition-all cursor-pointer active:scale-95 text-right shadow-sm flex items-center gap-1.5"
                  >
                    <span>{qp.icon}</span>
                    <span>{qp.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* LOAD MORE MESSAGES BUTTON (PAGINATION) */}
              {messages.length > visibleCount && (
                <div className="flex justify-center pb-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 10)}
                    className="px-3.5 py-1.5 bg-slate-800/90 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-300 font-bold text-xs rounded-full border border-slate-700 hover:border-indigo-500/50 transition-all cursor-pointer shadow-sm flex items-center gap-1.5 active:scale-95"
                    title="تحميل 10 رسائل سابقة"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
                    <span>عرض 10 رسائل أقدم ({messages.length - visibleCount} متبقية)</span>
                  </button>
                </div>
              )}

              {messages.slice(-visibleCount).map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === "user" ? "items-start" : "items-end"}`}
                >
                  <div
                    className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-xs font-medium"
                        : "bg-slate-800/90 border border-slate-700/70 text-slate-100 rounded-bl-xs"
                    }`}
                  >
                    {/* Render message with clean layout */}
                    {msg.role === "user" ? (
                      <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="pt-1">
                        <FormattedChatMessage
                          text={msg.content}
                          onSpeak={(txt) => {
                            handlePlayChatVoice(txt, card.frontLang || "de");
                          }}
                          onCopy={(txt) => {
                            navigator.clipboard.writeText(txt);
                          }}
                          onCreateCard={handleCreateCardFromToken}
                          onOpenLightbox={(imgUrl, caption, keyword, query, allImages, currentIndex) => {
                            setActiveLightbox({
                              url: imgUrl,
                              caption,
                              keyword,
                              query,
                              images: allImages && allImages.length > 0 ? allImages : [imgUrl],
                              currentIndex: currentIndex !== undefined ? currentIndex : 0
                            });
                          }}
                        />

                        {/* Model name indicator matching message background */}
                        <div className="mt-2 pt-1 flex items-center justify-between select-none bg-transparent">
                          <span className="text-[8.5px] text-slate-400/70 font-normal tracking-wide">
                            {AVAILABLE_MODELS.find((m) => m.id === (msg.modelUsed || selectedModel))?.name || msg.modelUsed || selectedModel}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 text-indigo-400 bg-slate-800/60 border border-slate-700/50 px-4 py-2 rounded-2xl w-fit animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-xs font-semibold">جارٍ صياغة الرد...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* INPUT FOOTER WITH TELEGRAM/WHATSAPP STYLE PROMPT MENU & IMAGES MENU */}
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 bg-slate-950/90 border-t border-slate-800/80 shrink-0 relative">
          {/* Telegram-style Quick Prompts Popup Window */}
          <AnimatePresence>
            {isPromptsMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.96 }}
                transition={{ duration: 0.16 }}
                className="absolute bottom-full mb-3 right-3 left-3 sm:right-4 sm:left-auto sm:w-[420px] bg-slate-900/98 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden z-30 p-2 space-y-1.5"
              >
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800 text-xs font-bold text-slate-300">
                  <div className="flex items-center gap-1.5 text-indigo-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>اقتراحات وأسئلة سريعة</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPromptsMenuOpen(false)}
                    className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1 p-0.5 custom-scrollbar">
                  {quickPrompts.map((qp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setIsPromptsMenuOpen(false);
                        handleSendMessage(qp.prompt);
                      }}
                      className="w-full text-right p-2.5 rounded-xl hover:bg-indigo-600/15 hover:border-indigo-500/40 border border-transparent transition-all flex items-start gap-2.5 group cursor-pointer"
                    >
                      <span className="text-base shrink-0 mt-0.5">{qp.icon}</span>
                      <div className="flex-1">
                        <div className="text-xs font-extrabold text-slate-200 group-hover:text-indigo-300 transition-colors">
                          {qp.label}
                        </div>
                        <div className="text-[10.5px] text-slate-400 font-normal line-clamp-1 mt-0.5">
                          {qp.prompt}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Telegram-style Images Menu Popup Window */}
          <AnimatePresence>
            {isImageMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.96 }}
                transition={{ duration: 0.16 }}
                className="absolute bottom-full mb-3 right-3 left-3 sm:right-28 sm:left-auto sm:w-[420px] bg-slate-900/98 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden z-30 p-2 space-y-1.5"
              >
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800 text-xs font-bold text-slate-300">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>طلب صور توضيحية</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsImageMenuOpen(false)}
                    className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Toggle Mode Option */}
                <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                  <div className="text-start">
                    <div className="text-xs font-bold text-slate-200">تضمين صور مع كل رسالة</div>
                    <div className="text-[10px] text-slate-400">يجلب الذكاء صوراً بصرية داعمة تلقائياً</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsImageMode(!isImageMode)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      isImageMode
                        ? "bg-emerald-600 border-emerald-400 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {isImageMode ? "مفعّل ✓" : "معطّل"}
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1 p-0.5 custom-scrollbar">
                  {imageQuickPrompts.map((iqp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setIsImageMenuOpen(false);
                        handleSendMessage(iqp.prompt, true);
                      }}
                      className="w-full text-right p-2.5 rounded-xl hover:bg-emerald-600/15 hover:border-emerald-500/40 border border-transparent transition-all flex items-start gap-2.5 group cursor-pointer"
                    >
                      <span className="text-base shrink-0 mt-0.5">{iqp.icon}</span>
                      <div className="flex-1">
                        <div className="text-xs font-extrabold text-slate-200 group-hover:text-emerald-300 transition-colors">
                          {iqp.label}
                        </div>
                        <div className="text-[10.5px] text-slate-400 font-normal line-clamp-1 mt-0.5">
                          {iqp.prompt}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Small borderless/transparent quick prompts and images trigger above textarea */}
          <div className="flex items-center justify-between px-1 mb-1.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsPromptsMenuOpen(!isPromptsMenuOpen);
                  setIsImageMenuOpen(false);
                }}
                title="فتح قائمة الاقتراحات السريعة"
                className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-indigo-300 transition-colors bg-transparent border-0 p-0 cursor-pointer select-none"
              >
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>اقتراحات سريعة</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsImageMenuOpen(!isImageMenuOpen);
                  setIsPromptsMenuOpen(false);
                }}
                title="فتح قائمة طلب الصور"
                className={`flex items-center gap-1 text-[11px] font-bold transition-colors bg-transparent border-0 p-0 cursor-pointer select-none ${
                  isImageMode ? "text-emerald-400 font-extrabold" : "text-slate-400 hover:text-emerald-300"
                }`}
              >
                <ImageIcon className="w-3 h-3 text-emerald-400" />
                <span>صور {isImageMode && "✓"}</span>
              </button>
            </div>
          </div>

          <div className="flex items-end gap-2 bg-slate-900/90 border border-slate-700/60 focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-2xl p-2 sm:p-2.5 transition-all shadow-inner">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder=""
              rows={2}
              className="flex-1 min-h-[64px] sm:min-h-[76px] bg-transparent border-0 outline-none resize-none text-sm sm:text-base font-semibold text-slate-100 p-1.5 leading-relaxed"
            />

            <button
              type="button"
              disabled={!inputMessage.trim() || isLoading}
              onClick={() => handleSendMessage()}
              className={`h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                inputMessage.trim() && !isLoading
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 active:scale-95"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
              }`}
              title="إرسال"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 rtl:rotate-180" />
                  <span className="hidden sm:inline">إرسال</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* SETTINGS POPUP MODAL (نافذة منبثقة بدل نافذة منسدلة) */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">إعدادات المحادثة والذكاء الاصطناعي</h4>
                      <p className="text-[11px] text-slate-400">تخصيص النموذج وصوت النطق وطول الإجابات</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 space-y-4 overflow-y-auto flex-1 text-right">
                  {/* 1. AI Model Dropdown */}
                  <div>
                    <label className="text-xs font-bold text-slate-200 block mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-indigo-400" />
                        <span>نموذج الذكاء الاصطناعي (AI Model):</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
                        {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.tag || "محدد"}
                      </span>
                    </label>
                    <div className="relative">
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-semibold cursor-pointer appearance-none pl-8"
                      >
                        {AVAILABLE_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} — [{m.tag}]
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.desc}
                    </p>
                  </div>

                  {/* 2. Voice Model Dropdown (اختيار صوت الموديل المحدد) */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <label className="text-xs font-bold text-slate-200 block mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                        <span>صوت محرك النطق (Voice Model):</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const sample = (card.frontLang === "ar" || folderInfo?.targetLanguage === "ar")
                            ? "مرحباً! هذا اختبار للنطق الصوتي المحدد في المحادثة"
                            : ((card.frontLang === "en" || folderInfo?.targetLanguage === "en")
                              ? "Hello! This is a test for the AI chat voice"
                              : "Hallo! Das ist ein Hörtest für die Chat-Stimme");
                          handlePlayChatVoice(sample, card.frontLang || folderInfo?.targetLanguage || "de");
                        }}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/60 border border-emerald-800/50 cursor-pointer active:scale-95 transition-all shadow-xs"
                        title="استمع لتجربة الصوت المحدد حالياً"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>تجربة الصوت</span>
                      </button>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <select
                          value={selectedVoice}
                          onChange={(e) => {
                            setSelectedVoice(e.target.value);
                            localStorage.setItem("settings_review_chat_voice", e.target.value);
                          }}
                          className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-semibold cursor-pointer appearance-none pl-8"
                        >
                          {AVAILABLE_VOICES.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.flag} {v.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const sample = (card.frontLang === "ar" || folderInfo?.targetLanguage === "ar")
                            ? "مرحباً! تجربة الصوت"
                            : ((card.frontLang === "en" || folderInfo?.targetLanguage === "en")
                              ? "Hello! Voice test"
                              : "Hallo! Sprachtest");
                          handlePlayChatVoice(sample, card.frontLang || folderInfo?.targetLanguage || "de");
                        }}
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-emerald-600/30 text-slate-200 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/50 cursor-pointer transition-all active:scale-95 shrink-0"
                        title="استمع لتجربة الصوت"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {AVAILABLE_VOICES.find(v => v.id === selectedVoice)?.desc}
                    </p>
                  </div>

                  {/* 3. Response Length Selector */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <label className="text-xs font-bold text-slate-200 block mb-1.5">
                      📏 حجم وطبيعة الإجابة:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "concise", label: "⚡ مختصر", desc: "لب المعنى فقط" },
                        { id: "auto", label: "🎯 تلقائي", desc: "حسب نوع السؤال" },
                        { id: "balanced", label: "⚖️ متوازن", desc: "أمثلة وشرح" },
                        { id: "detailed", label: "📚 مفصل", desc: "جداول وسياق" }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setResponseLength(item.id as any);
                            localStorage.setItem("settings_review_chat_length", item.id);
                          }}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                            responseLength === item.id
                              ? "bg-indigo-600/25 border-indigo-500 text-indigo-300 font-bold ring-1 ring-indigo-500/50"
                              : "bg-slate-950 hover:bg-slate-800 border-slate-700/60 text-slate-400"
                          }`}
                        >
                          <span className="text-xs font-bold">{item.label}</span>
                          <span className="text-[9px] text-slate-400 mt-0.5">{item.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. Structured Template Toggle (تفعيل/إلغاء القالب الهيكلي الإلزامي) */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <div className="flex-1 text-right">
                        <span className="text-xs font-bold text-slate-200 block flex items-center gap-1.5">
                          <span>📋 القالب الهيكلي والتفاصيل الإلزامية</span>
                        </span>
                        <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed">
                          {useStructuredTemplate
                            ? "مفعل: تقسيم الردود إلى عناوين وجداول وأقسام مفصلة (الافتراضي)."
                            : "معطل: إجابة مباشرة وحرة تركز فقط على ما سألت عنه دون حشو أو أقسام زائدة."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUseStructuredTemplate(!useStructuredTemplate)}
                        className={`w-11 h-6 shrink-0 rounded-full transition-colors relative cursor-pointer ${
                          useStructuredTemplate ? "bg-indigo-600" : "bg-slate-700"
                        }`}
                        title={useStructuredTemplate ? "إلغاء القالب الهيكلي" : "تفعيل القالب الهيكلي"}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            useStructuredTemplate ? "right-1" : "right-6"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    حفظ وإغلاق
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

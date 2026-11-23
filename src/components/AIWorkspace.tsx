import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft,
  FolderPlus, 
  HelpCircle, 
  Check, 
  Loader2, 
  Volume2, 
  Folder, 
  Layers, 
  BookOpen, 
  ChevronRight, 
  Compass, 
  Trash2, 
  Pencil, 
  Plus, 
  X, 
  AlertCircle,
  Play,
  FileText,
  Image as ImageIcon,
  Image,
  Download,
  Maximize2,
  Save,
  CheckSquare,
  Square,
  Code,
  Globe,
  ChevronLeft,
  RectangleVertical,
  RefreshCw,
  Sliders,
  ChevronDown,
  Wand2,
  Menu,
  Cpu,
  Activity,
  Coins,
  Gauge,
  Clock,
  Info,
  Hash,
  Copy,
  Clipboard,
  ExternalLink,
  Upload,
  DownloadCloud,
  CheckCircle2,
  Search,
  Bookmark
} from "lucide-react";
import { Folder as FolderType, Flashcard, getSafeImageStyle, TranscriptDocument, getCardSearchQuery, sanitizeCardArticleAndSentence, cleanImageSearchQuery, isGermanSentence, isImageUrlBroken, healBrokenCardImage, promoteCandidateListToCard } from "../types";
import { ImageWithSkeleton, brokenImagesSet } from "./ReviewSession";
import { speakClient, EditCardModal, ImagePickerModal, preloadImage } from "./Modals";
import { BrowseCard } from "./BrowseCard";
import { motion, AnimatePresence } from "motion/react";
import { CodeViewer } from "./CodeViewer";

interface AIWorkspaceProps {
  folders: FolderType[];
  cards: Flashcard[];
  activeFolderId: string;
  onSelectFolder: (id: string) => void;
  onImportGenerated: (
    generatedFolder: Omit<FolderType, "id" | "createdAt" | "updatedAt"> | null,
    generatedCards: Omit<Flashcard, "id" | "folderId" | "createdAt" | "streak">[],
    targetFolderId: string | null
  ) => void;
  onBackToLibrary: () => void;
  aiRefineFolderId?: string | null;
  onClearAiRefineFolderId?: () => void;
  onSaveRefinedFolder?: (
    folderId: string,
    updatedFolder: { name: string; description?: string; color: string; coverImage?: string; coverImagePosition?: string },
    updatedCards: Omit<Flashcard, "id" | "folderId" | "createdAt" | "streak">[]
  ) => void;
  onTrashAiFolder?: (folder: AIFolder, cards: AICard[]) => void;
  onTrashAiCard?: (card: AICard) => void;
  onTrashAiCards?: (cards: AICard[]) => void;
  onToggleSidebar?: () => void;
  transcripts?: TranscriptDocument[];
  initialSelectedTranscriptId?: string | null;
  onClearInitialSelectedTranscriptId?: () => void;
}

export interface AIFolder {
  id: string;
  name: string;
  description?: string;
  color: string;
  frontLang: string;
  backLang: string;
  prompt: string;
  createdAt: string;
  frontInstructions?: string;
  backInstructions?: string;
  descInstructions?: string;
  imageInstructions?: string;
  descriptionMode?: "on" | "off" | "auto";
  imagesMode?: "on" | "off" | "auto";
  germanArticlesMode?: "on" | "off" | "auto";
  germanPluralMode?: "on" | "off" | "auto";
  germanPluralInstruction?: string;
  customFolderName?: string;
  customFolderDesc?: string;
  folderDescMode?: "on" | "off" | "auto";
  folderDescCondition?: string;
  coverImage?: string;
  coverImagePosition?: string;
}

export interface InstructionPreset {
  id: string;
  name: string;
  prompt?: string;
  frontInstructions: string;
  backInstructions: string;
  folderDescMode: "on" | "off" | "auto";
  folderDescCondition: string;
  descriptionMode: "on" | "off" | "auto";
  descInstructions: string;
  imagesMode: "on" | "off" | "auto";
  imageInstructions: string;
  germanArticlesMode: "on" | "off" | "auto";
  germanPluralMode: "on" | "off" | "auto";
  germanPluralInstruction: string;
  cardsCount: number | "auto";
}

export interface AICard {
  id: string;
  folderId: string;
  frontText: string;
  backText: string;
  frontLang?: string;
  backLang?: string;
  createdAt?: string;
  streak?: number;
  isArticleMode?: boolean;
  correctArticle?: "der" | "die" | "das" | "die-plural" | "" | string;
  translationHint?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  frontImage?: string;
  frontImagePosition?: string;
  backImage?: string;
  backImagePosition?: string;
  isPluralMode?: boolean;
  pluralText?: string;
  pluralLang?: string;
  autoImageCandidates?: string[];
  imageSearchQuery?: string;
}

const SUGGESTIONS = [
  {
    title: "مفردات السفر بالفرنسية",
    prompt: "أنشئ لي 8 بطاقات لتعلم مفردات السفر الأساسية باللغة الفرنسية مع الترجمة العربية وتلميحات النطق.",
    icon: "🇫🇷"
  },
  {
    title: "مفردات الطقس بالألمانية",
    prompt: "أنشئ لي مجلداً لتعلم كلمات الطقس بالألمانية مع تفعيل وضع أدوات التعريف der/die/das للأسماء.",
    icon: "🇩🇪"
  },
  {
    title: "مصطلحات الذكاء الاصطناعي",
    prompt: "أنشئ لي بطاقات دراسية لشرح مصطلحات الذكاء الاصطناعي المعقدة بالإنجليزية مع ترجمتها ومفهومها بالعربية.",
    icon: "🤖"
  },
  {
    title: "صيغ الكيمياء غير العضوية",
    prompt: "أنشئ لي 6 بطاقات للمركبات الكيميائية وصيغها (مثال: الماء H2O، ثاني أكسيد الكربون CO2) مع شرح بسيط.",
    icon: "🧪"
  }
];

const formatArabicResetTime = (timeStr: string) => {
  if (!timeStr) return "";
  const val = timeStr.trim();
  
  const hoursMatch = val.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minsMatch = val.match(/(\d+(?:\.\d+)?)\s*m(?!s)/i);
  const secsMatch = val.match(/(\d+(?:\.\d+)?)\s*s/i);
  const msMatch = val.match(/(\d+(?:\.\d+)?)\s*ms/i);

  const parts: string[] = [];
  if (hoursMatch) {
    parts.push(`${hoursMatch[1]} س`);
  }
  if (minsMatch) {
    parts.push(`${minsMatch[1]} د`);
  }
  if (secsMatch) {
    const secVal = parseFloat(secsMatch[1]);
    let secFormatted;
    if (Number.isInteger(secVal)) {
      secFormatted = secVal;
    } else if (secVal < 1) {
      secFormatted = secVal.toFixed(2);
    } else {
      secFormatted = secVal.toFixed(1);
    }
    parts.push(`${secFormatted} ث`);
  } else if (msMatch) {
    parts.push(`${msMatch[1]} م.ث`);
  }

  if (parts.length === 0) {
    return val
      .replace(/h/gi, " س")
      .replace(/m(?!s)/gi, " د")
      .replace(/ms/gi, " م.ث")
      .replace(/s/gi, " ث");
  }

  return parts.join(" و ");
};

export interface AIRequestLog {
  id: string;
  timestamp: string;
  prompt: string;
  rawPrompt?: string;
  response?: string;
  provider: "gemini" | "groq";
  model: string;
  status: "success" | "failed";
  cardsCount: number | "auto";
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  rateLimitInfo?: {
    limitType?: string;
    limit?: number;
    used?: number;
    requested?: number;
    resetIn?: string;
  };
  rawRequestBody?: string;
  rawResponseBody?: string;
}

export interface ParsedRateLimit {
  model?: string;
  limitType?: string;
  limit?: number;
  used?: number;
  requested?: number;
  resetIn?: string;
}

export const parseRateLimitError = (errorMsg: string): ParsedRateLimit | null => {
  if (!errorMsg) return null;
  const res: ParsedRateLimit = {};
  
  // Extract model name
  const modelMatch = errorMsg.match(/model `([^`]+)`/) || errorMsg.match(/model ([^\s]+)/);
  if (modelMatch) {
    res.model = modelMatch[1];
  }
  
  // Extract limit type
  const limitTypeMatch = errorMsg.match(/\(([A-Z]{3,4})\)/);
  if (limitTypeMatch) {
    res.limitType = limitTypeMatch[1];
  } else if (errorMsg.includes("tokens per day")) {
    res.limitType = "TPD";
  } else if (errorMsg.includes("requests per minute")) {
    res.limitType = "RPM";
  } else if (errorMsg.includes("tokens per minute")) {
    res.limitType = "TPM";
  } else if (errorMsg.includes("requests per day")) {
    res.limitType = "RPD";
  }
  
  // Extract Limit, Used, Requested numbers
  const limitMatch = errorMsg.match(/Limit\s+([0-9]+)/i);
  if (limitMatch) {
    res.limit = parseInt(limitMatch[1], 10);
  }
  
  const usedMatch = errorMsg.match(/Used\s+([0-9]+)/i);
  if (usedMatch) {
    res.used = parseInt(usedMatch[1], 10);
  }
  
  const requestedMatch = errorMsg.match(/Requested\s+([0-9]+)/i);
  if (requestedMatch) {
    res.requested = parseInt(requestedMatch[1], 10);
  }
  
  // Extract reset in time
  const resetMatch = errorMsg.match(/try again in\s+([a-zA-Z0-9\.]+)/i);
  if (resetMatch) {
    res.resetIn = resetMatch[1];
  }
  
  if (res.limit || res.used || res.resetIn || res.limitType) {
    return res;
  }
  return null;
};

export const AIWorkspace: React.FC<AIWorkspaceProps> = React.memo(({
  folders,
  cards,
  activeFolderId,
  onSelectFolder,
  onImportGenerated,
  onBackToLibrary,
  aiRefineFolderId,
  onClearAiRefineFolderId,
  onSaveRefinedFolder,
  onTrashAiFolder,
  onTrashAiCard,
  onTrashAiCards,
  onToggleSidebar,
  transcripts = [],
  initialSelectedTranscriptId = null,
  onClearInitialSelectedTranscriptId
}) => {
  const [prompt, setPrompt] = useState("");
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string>(() => {
    return initialSelectedTranscriptId || "";
  });

  // Synchronize initial selection if passed from parent
  useEffect(() => {
    if (initialSelectedTranscriptId) {
      setSelectedTranscriptId(initialSelectedTranscriptId);
    }
  }, [initialSelectedTranscriptId]);

  // Pre-fill prompt if a transcript is selected and prompt is empty
  useEffect(() => {
    if (selectedTranscriptId && transcripts && transcripts.length > 0) {
      const found = transcripts.find(t => t.id === selectedTranscriptId);
      if (found && !prompt) {
        setPrompt(`استخرج أهم المفردات والمفاهيم والأسئلة الدراسية من وثيقة التفريغ: ${found.title}`);
      }
    }
  }, [selectedTranscriptId, transcripts]);

  const [cardsCount, setCardsCount] = useState<number | "auto">("auto");
  const [frontInstructions, setFrontInstructions] = useState("");
  const [backInstructions, setBackInstructions] = useState("");
  const [descInstructions, setDescInstructions] = useState("");
  const [imageInstructions, setImageInstructions] = useState("");
  const [descriptionMode, setDescriptionMode] = useState<"on" | "off" | "auto">("auto");
  const [imagesMode, setImagesMode] = useState<"on" | "off" | "auto">("auto");
  const [germanArticlesMode, setGermanArticlesMode] = useState<"on" | "off" | "auto">("auto");
  const [germanPluralMode, setGermanPluralMode] = useState<"on" | "off" | "auto">("auto");
  const [germanPluralInstruction, setGermanPluralInstruction] = useState("");
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [advancedTab, setAdvancedTab] = useState<"general" | "smart" | "german">("general");
  const [cardPluralToggle, setCardPluralToggle] = useState<Record<string, boolean>>({});
  const [customFolderName, setCustomFolderName] = useState("");
  const [customFolderDesc, setCustomFolderDesc] = useState("");
  const [folderDescMode, setFolderDescMode] = useState<"on" | "off" | "auto">("auto");
  const [folderDescCondition, setFolderDescCondition] = useState("");

  // Saved Instruction Presets (secondary)
  const [instructionPresets, setInstructionPresets] = useState<InstructionPreset[]>(() => {
    try {
      const saved = localStorage.getItem("ai_instruction_presets");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showSavePresetInput, setShowSavePresetInput] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [activePresetId, setActivePresetId] = useState<string>("");

  // Quick Single-Card Add & Open-Folder Card Filter (secondary)
  const [showQuickAddCard, setShowQuickAddCard] = useState(false);
  const [quickAddInput, setQuickAddInput] = useState("");
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [cardFilterMode, setCardFilterMode] = useState<"all" | "no_image" | "has_article">("all");
  const [cardSearchQuery, setCardSearchQuery] = useState("");
  
  // Image Fetching & Storage Options States
  const [primaryImageTiming, setPrimaryImageTiming] = useState<"auto_after_ai" | "manual_download">(() => {
    try {
      return (localStorage.getItem("settings_primary_image_timing") as any) || "auto_after_ai";
    } catch {
      return "auto_after_ai";
    }
  });

  const [primaryImageStorageMode, setPrimaryImageStorageMode] = useState<"direct_url" | "data_url">(() => {
    try {
      return (localStorage.getItem("settings_primary_image_storage") as any) || "data_url";
    } catch {
      return "data_url";
    }
  });

  const [secondaryImagesStorageMode, setSecondaryImagesStorageMode] = useState<"direct_urls" | "data_urls">(() => {
    try {
      return (localStorage.getItem("settings_secondary_images_storage") as any) || "data_urls";
    } catch {
      return "data_urls";
    }
  });

  const [imageSearchQuerySource, setImageSearchQuerySource] = useState<"smart_auto" | "front_text_only" | "back_text_only" | "combined_front_back" | "custom_query_only">(() => {
    try {
      return (localStorage.getItem("settings_image_search_query_source") as any) || "smart_auto";
    } catch {
      return "smart_auto";
    }
  });

  const getCardQueryTerm = React.useCallback((card: { frontText?: string; backText?: string; imageSearchQuery?: string }) => {
    return getCardSearchQuery(card);
  }, []);

  const [showImageOptionsModal, setShowImageOptionsModal] = useState(false);
  const [includeAuto10Images, setIncludeAuto10Images] = useState(true);

  // Image fetch progress & storage states matching Library (المكتبة)
  const [isFetchingImages, setIsFetchingImages] = useState(false);
  const [imageFetchProgress, setImageFetchProgress] = useState<{
    current: number;
    total: number;
    currentItem: string;
    currentPreview?: string;
  }>({ current: 0, total: 0, currentItem: "", currentPreview: undefined });
  const [imageFetchSuccess, setImageFetchSuccess] = useState(false);

  const handleDownloadSingleImageFile = React.useCallback(async (imageUrl: string, filename: string) => {
    try {
      if (imageUrl.startsWith("data:")) {
        const a = document.createElement("a");
        a.href = imageUrl;
        a.download = `${filename || "image"}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      const response = await fetch(imageUrl, { mode: "cors" });
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${filename || "image"}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } else {
        window.open(imageUrl, "_blank");
      }
    } catch (e) {
      window.open(imageUrl, "_blank");
    }
  }, []);

  // Helper to convert external image URL to Data URL (base64) for offline persistence fast & safely
  const convertUrlToDataUrl = async (url: string): Promise<string> => {
    if (!url) return "";
    if (url.startsWith("data:")) return url;

    try {
      const proxyBase = "/api/proxy-image";
      const proxyUrl = `${proxyBase}?url=${encodeURIComponent(url)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // Fast 3.5s timeout

      let res = await fetch(proxyUrl, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);

      if (!res || !res.ok) {
        // Fallback retry direct fetch with short timeout
        const ctrl2 = new AbortController();
        const tid2 = setTimeout(() => ctrl2.abort(), 2000);
        res = await fetch(url, { signal: ctrl2.signal }).catch(() => null);
        clearTimeout(tid2);
      }

      if (res && res.ok) {
        const blob = await res.blob();
        if (blob.size > 100) {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string) || url);
            reader.onerror = () => resolve(url);
            reader.readAsDataURL(blob);
          });
        }
      }
    } catch (err) {
      console.warn("Data URL conversion fallback to original URL:", err);
    }
    return url;
  };
  
  // External Prompt & Data Import Mode States
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [externalTab, setExternalTab] = useState<"prompt" | "import">("prompt");
  const [externalJsonInput, setExternalJsonInput] = useState("");
  const [externalError, setExternalError] = useState<string | null>(null);
  const [externalCopySuccess, setExternalCopySuccess] = useState(false);
  const [externalPasteSuccess, setExternalPasteSuccess] = useState(false);
  const [externalPasteHint, setExternalPasteHint] = useState<string | null>(null);
  const [externalImporting, setExternalImporting] = useState(false);
  const [externalImportProgress, setExternalImportProgress] = useState("");
  const jsonTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const fetchImageForQuery = async (query: string, timeoutMs = 8000): Promise<string | undefined> => {
    if (!query || !query.trim() || imagesMode === "off") return undefined;
    
    let finalQuery = query.trim();
    if (imageInstructions && imageInstructions.trim()) {
      finalQuery = `${finalQuery} ${imageInstructions.trim()}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`/api/images?q=${encodeURIComponent(finalQuery)}&page=1`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const data = await res.json();
      if (data && data.hits && data.hits.length > 0) {
        return data.hits[0].largeImageURL || data.hits[0].webformatURL || undefined;
      }
      return undefined;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  const constructFullExternalPrompt = (userPrompt: string): string => {
    const isAuto = cardsCount === "auto";
    const requestedCardsCount = typeof cardsCount === "number" ? Math.min(Math.max(cardsCount, 1), 50) : 10;
    
    let transcriptText = "";
    if (selectedTranscriptId && transcripts && transcripts.length > 0) {
      const found = transcripts.find(t => t.id === selectedTranscriptId);
      if (found) {
        transcriptText = found.segments.map(s => s.text).join(" ");
      }
    }

    let promptText = `أنت مساعد ذكي متخصص في توليد البطاقات التعليمية (Flashcards) والمجلدات لمساعدة الطلاب على الدراسة والمذاكرة بذكاء (StudySmarter).
تلقيت طلباً بلغة عربية لإنشاء بطاقات تعليمية موضوعها: "${userPrompt.trim() || 'موضوع تعليمي عام'}"

المطلوب منك إرجاع كود JSON مجرد فقط (Valid Raw JSON Object) بالهيكل والتنسيق الدقيق التالي:

{
  "folder": {
    "name": "${customFolderName.trim() || 'اسم المجلد باللغة العربية'}",
    "description": "${customFolderDesc.trim() || 'وصف المجلد باللغة العربية'}",
    "color": "#0056f6",
    "frontLang": "en",
    "backLang": "ar",
    "imageSearchQuery": "كلمة بالإنجليزية لغلاف المجلد"
  },
  "cards": [
    {
      "frontText": "Handy",
      "backText": "هاتف محمول / جوال",
      "isArticleMode": true,
      "correctArticle": "das",
      "isPluralMode": true,
      "pluralText": "Handys",
      "pluralLang": "de",
      "translationHint": "تلميح: داس هاندي",
      "difficulty": "medium",
      "imageSearchQuery": "modern smartphone photo"
    },
    {
      "frontText": "Kinder",
      "backText": "أطفال / أولاد",
      "isArticleMode": true,
      "correctArticle": "die-plural",
      "isPluralMode": true,
      "pluralText": "Kinder",
      "pluralLang": "de",
      "translationHint": "اسم جمع: دي كيندر (أداة الجمع die-plural)",
      "difficulty": "easy",
      "imageSearchQuery": "group of happy children playing"
    },
    {
      "frontText": "Das Buch ist sehr schön.",
      "backText": "الكتاب جميل جداً.",
      "isArticleMode": false,
      "correctArticle": "",
      "isPluralMode": false,
      "pluralText": "",
      "pluralLang": "de",
      "translationHint": "جملة كاملة بأداتها",
      "difficulty": "easy",
      "imageSearchQuery": "open book on desk"
    }
  ]
}

⚠️ القواعد والتفاصيل الهامة المحددة:
`;

    if (!isAuto) {
      promptText += `- عدد البطاقات المطلوبة في مصفوفة cards هو بالضبط ${requestedCardsCount} بطاقة دون زيادة أو نقصان.\n`;
    } else {
      promptText += `- قم بإنشاء عدد كافٍ ومناسب من البطاقات لشمول الموضوع وتغطيته تلقائياً.\n`;
    }

    if (descriptionMode === "on") {
      promptText += `- يجب كتابة وصف/تلميح translationHint مفيد لكل بطاقة.\n`;
    } else if (descriptionMode === "off") {
      promptText += `- اجعل حقل translationHint دائماً نصاً فارغاً "".\n`;
    }

    if (germanArticlesMode !== "off") {
      promptText += `\n🚨 بروتوكول وقواعد إلزامية صارمة لتصنيف أدوات التعريف الألمانية (der / die / das / die-plural):
1. بروتوكول تصنيف الكلمات والمفردات (Nouns Vocabulary Protocol):
   - يجب تجريد حقل "frontText" تماماً من أداة التعريف (اكتب "Januar" وليس "der Januar"، واكتب "Katze" وليس "die Katze"، واكتب "Kind" وليس "das Kind"، واكتب "Kinder" وليس "die Kinder").
   - الأداة توضع حصراً في حقل "correctArticle" مع وضع "isArticleMode": true وفق القواعد الأربع التالية:
     * [المذكر - Maskulin]: ضع "correctArticle": "der" (أمثلة: Tisch, Januar, Hund, Mann).
     * [المؤنث - Feminin]: ضع "correctArticle": "die" (أمثلة: Katze, Frau, Sonne, Lampe).
     * [المحايد - Neutral]: ضع "correctArticle": "das" (أمثلة: Handy, Buch, Kind, Auto).
     * [الجمع - Plural Noun]: ضع "correctArticle": "die-plural" فقط وحصراً إذا كانت الكلمة في frontText بحد ذاتها اسم جمع (أمثلة: Kinder, Eltern, Leute, Ferien, Geschwister).
   - ⚠️ قاعدة حاسمة جداً لعلاقة المفرد بالجمع:
     * إذا كانت الكلمة اسماً مفرداً (مثل: Januar أو Tisch أو Katze)، فإن أداتها في correctArticle تبقى دائماً أداتها المفردة الأصلية ("der" أو "die" أو "das") ولا تتغير أبداً إلى "die-plural"، حتى لو تم تفعيل الجمع (isPluralMode: true) وتوفير صيغة الجمع (pluralText: "Januare" أو "Tische" أو "Katzen")!
     * صيغة الجمع تذهب حصراً لحقل "pluralText" ولا تؤثر أبداً على قيمة "correctArticle" للاسم المفرد.
2. للجمل والعبارات الكاملة (Sentences & Expressions مثل: "Das Buch ist schön", "Die Kinder spielen"):
   - الجملة يجب أن تبقى كاملة بجميع كلماتها وأداتها الطبيعية مدمجة داخل "frontText" (مثال: "Das Buch ist schön").
   - ممنوع تماماً عزل الأداة من الجملة! يجب إلزامياً وضع "isArticleMode": false و "correctArticle": "" كفارغ تماماً.\n`;
    } else {
      promptText += `- إيقاف أدوات التعريف (isArticleMode = false) و correctArticle = "".\n`;
    }

    if (germanPluralMode !== "off") {
      promptText += `\n🚨 قواعد إلزامية لصيغة الجمع الألمانية (pluralText و isPluralMode):
- لكل اسم أو مفردة ألمانية مفردة (Single Noun)، يجب عليك حتماً وتلقائياً توفير صيغة الجمع الصحيحة مجردة في حقل "pluralText" مع وضع "isPluralMode": true (مثال: لـ Tisch اكتب "Tische"، لـ Katze اكتب "Katzen"، لـ Januar اكتب "Januare").
- يمنع منعاً باتاً ترك حقل pluralText فارغاً لأي اسم مفرد! أما الجمل والعبارات الكاملة فاجعل لها "isPluralMode": false و "pluralText": "".\n`;
    } else {
      promptText += `- إيقاف صيغة الجمع (isPluralMode = false) و pluralText = "".\n`;
    }

    if (imagesMode === "off") {
      promptText += `- اجعل حقل imageSearchQuery دائماً نصاً فارغاً "".\n`;
    } else {
      if (imageInstructions.trim()) {
        promptText += `- حقل imageSearchQuery في كل بطاقة: كلمة مفتاحية بالإنجليزية تعبر بدقة عن الشيء مدمجة مع النمط المطلوب: "${imageInstructions.trim()}".\n`;
      } else {
        promptText += `- حقل imageSearchQuery في كل بطاقة: كلمة أو عبارة بالإنجليزية تمثل صورة واقعية وحقيقية عالية الدقة (Realistic Photography) للشيء (مثال للتفاحة: "fresh red apple photo", للهاتف: "modern smartphone", للكتاب: "open book on wooden desk"). يمنع تماماً وضع كلمات رسومات أو كرتون (مثل cartoon أو illustration أو vector أو clipart) ما لم يطلب المستخدم ذلك صراحة!\n`;
      }
    }

    if (frontInstructions.trim()) {
      promptText += `- تعليمات الوجه الأمامي: ${frontInstructions.trim()}\n`;
    }
    if (backInstructions.trim()) {
      promptText += `- تعليمات الوجه الخلفي: ${backInstructions.trim()}\n`;
    }
    if (descInstructions.trim()) {
      promptText += `- تعليمات التلميح/الوصف: ${descInstructions.trim()}\n`;
    }
    if (imageInstructions.trim()) {
      promptText += `- تعليمات كلمات بحث الصور والنمط المطلوب: ${imageInstructions.trim()}\n`;
    }
    if (germanPluralInstruction.trim()) {
      promptText += `- تعليمات صيغة الجمع: ${germanPluralInstruction.trim()}\n`;
    }

    if (folderDescMode === "on") {
      promptText += `- يرجى توليد وصف غني وشامل للمجلد في حقل description داخل folder.\n`;
    } else if (folderDescMode === "off") {
      promptText += `- اجعل وصف المجلد حتمياً نصاً فارغاً "".\n`;
    }
    if (folderDescCondition.trim()) {
      promptText += `- شروط وصف المجلد: ${folderDescCondition.trim()}\n`;
    }

    if (transcriptText.trim()) {
      promptText += `\n⚠️ نص التفريغ المصاحب المرفق (spT):\n"""\n${transcriptText.trim()}\n"""\n`;
    }

    promptText += `\nرجاءً أرجِع فقط كود JSON صريح ومباشر بدون أي مقدمات أو شروحات نصية خارجية.`;

    return promptText;
  };

  // دالة نسخ فائقة التوافق مع هواتف الآيفون ومتصفحات الويب وWebKit
  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    // 1. محاولة استخدام Clipboard API الحديثة
    if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn("navigator.clipboard.writeText failed, falling back to execCommand:", err);
      }
    }

    // 2. بديل متوافق 100% مع iOS Safari ومتصفحات الموبايل (execCommand)
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";
      textArea.style.opacity = "0.01";
      textArea.style.zIndex = "-1";
      textArea.setAttribute("readonly", "");
      document.body.appendChild(textArea);

      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);

      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (successful) return true;
    } catch (err) {
      console.warn("execCommand fallback copy failed:", err);
    }

    return false;
  };

  const handleCopyExternalPrompt = async (transitionToImport = true) => {
    const fullPrompt = constructFullExternalPrompt(prompt);
    await copyTextToClipboard(fullPrompt);
    setExternalCopySuccess(true);
    setExternalPasteHint(null);

    if (transitionToImport) {
      // الانتقال الفوري لتبويب الاستيراد ولصق JSON
      setExternalTab("import");
      // تركيز المؤشر وتمرير الشاشة تلقائياً لصندوق JSON لراحة مستخدمي الموبايل
      setTimeout(() => {
        if (jsonTextareaRef.current) {
          jsonTextareaRef.current.focus();
          jsonTextareaRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 120);
    }

    setTimeout(() => {
      setExternalCopySuccess(false);
    }, 3500);
  };

  const handlePasteExternalJson = async () => {
    setExternalPasteSuccess(false);
    setExternalPasteHint(null);
    setExternalError(null);

    // محاولة قراءة الحافظة مباشرة
    if (typeof navigator !== "undefined" && navigator?.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setExternalJsonInput(text);
          setExternalPasteSuccess(true);
          setTimeout(() => setExternalPasteSuccess(false), 2500);
          if (jsonTextareaRef.current) {
            jsonTextareaRef.current.focus();
          }
          return;
        }
      } catch (err) {
        console.warn("navigator.clipboard.readText error (restricted permission):", err);
      }
    }

    // في حال قيود أمان متصفح Safari على أجهزة الآيفون، تركيز المؤشر للمستخدم
    if (jsonTextareaRef.current) {
      jsonTextareaRef.current.focus();
    }
    setExternalPasteHint("المتصفح يطلب إذناً يدوياً: انقر نقرة مطولة داخل المربع أدناه ثم اضغط «لصق» (Paste).");
  };

  const handleImportExternalJson = async () => {
    setExternalError(null);
    if (!externalJsonInput.trim()) {
      setExternalError("الرجاء لصق كود JSON أولاً قبل الضغط على الاستيراد.");
      return;
    }

    setExternalImporting(true);
    setExternalImportProgress("جاري تحليل بيانات JSON وتجهيز البطاقات...");

    try {
      let clean = externalJsonInput.trim();
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.slice(firstBrace, lastBrace + 1);
      }

      const data = JSON.parse(clean);

      let cardsList: any[] = [];
      let folderInfo: any = {};

      if (Array.isArray(data)) {
        cardsList = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.cards)) {
          cardsList = data.cards;
        }
        if (data.folder && typeof data.folder === 'object') {
          folderInfo = data.folder;
        }
      }

      if (!Array.isArray(cardsList) || cardsList.length === 0) {
        throw new Error("لم نتمكن من العثور على قائمة بطاقات (cards) صحيحة في كود JSON.");
      }

      // 1. Fetch Folder Cover Image if images mode is not off
      let folderCoverImage: string | undefined = undefined;
      if (imagesMode !== "off") {
        const folderImageQuery = folderInfo.imageSearchQuery || folderInfo.name || customFolderName.trim() || prompt.trim();
        if (folderImageQuery) {
          setExternalImportProgress(`جاري البحث عن صورة غلاف للمجلد: "${folderInfo.name || 'المجلد'}"...`);
          try {
            folderCoverImage = await fetchImageForQuery(folderImageQuery);
          } catch (e) {
            console.warn("Folder cover image fetch failed:", e);
          }
        }
      }

      const folderId = `ai-folder-${Date.now()}`;
      const newCards: AICard[] = cardsList.map((c: any, index: number) => {
        const frontImg = c.frontImage || c.image || undefined;

        // Smart extraction of plural text from various keys used by different LLMs
        let plText = typeof (c.pluralText || c.plural || c.plural_de || c.plural_text || c.germanPlural || c.pluralForm) === "string"
          ? (c.pluralText || c.plural || c.plural_de || c.plural_text || c.germanPlural || c.pluralForm).trim()
          : "";

        const rawFront = String(c.frontText || c.front || c.question || c.word || c.german || "").trim();
        const rawBack = String(c.backText || c.back || c.answer || c.arabic || c.translation || "").trim();
        const rawHint = String(c.translationHint || c.hint || "").trim();
        const hintCombined = `${rawHint} ${rawBack}`;

        if (!plText) {
          // Check if plural was embedded in hint or back text
          const plMatch = hintCombined.match(/(?:plural|pl\.|الجمع|جمع)\s*[:=\-–]\s*([A-Za-zÄÖÜäöüß]+)/i);
          if (plMatch) {
            plText = plMatch[1].trim();
          }
        }
        if (plText.toLowerCase().startsWith("die ")) {
          plText = plText.slice(4).trim();
        }

        // Comprehensive gender, article, and plural detection from external formats
        const rawGender = String(c.gender || c.type || c.category || c.number || "").trim().toLowerCase();
        let rawArt = String(c.correctArticle || c.article || c.art || "").trim().toLowerCase();

        let cleanFront = rawFront.replace(/\s*[\(\[]\s*(?:pl\.|plural|جمع)\s*[\)\]]/i, "").trim();
        const hasDistinctPlural = Boolean(plText && cleanFront && plText.toLowerCase() !== cleanFront.toLowerCase());

        // Check if card indicates that the front word itself is inherently a plural noun
        const hasPluralMarkerInFront = /\s*[\(\[]\s*(?:pl\.|plural|جمع)\s*[\)\]]/i.test(rawFront);
        const isPluralCardExplicit = Boolean(
          c.isPluralCard ||
          c.isPluralNoun ||
          rawGender === "plural" ||
          rawGender === "pl" ||
          rawGender === "die-plural" ||
          rawArt.includes("die-plural") ||
          rawArt === "die (جمع)" ||
          rawArt === "die (pl)" ||
          rawArt === "die pl" ||
          (hasPluralMarkerInFront && !hasDistinctPlural)
        );

        // Determine correctArticle according to the unified German protocol:
        // [der] Masculine, [die] Feminine, [das] Neuter, [die-plural] Plural Noun Card
        let art = "";
        if (rawArt === "der" || rawGender === "m" || rawGender === "masculine" || rawGender === "maskulin") {
          art = "der";
        } else if (rawArt === "das" || rawGender === "n" || rawGender === "neuter" || rawGender === "neutral") {
          art = "das";
        } else if (rawArt === "die-plural" || (isPluralCardExplicit && !hasDistinctPlural)) {
          art = "die-plural";
        } else if (rawArt === "die" || rawGender === "f" || rawGender === "feminine" || rawGender === "feminin") {
          art = "die";
        } else if (rawArt) {
          art = rawArt;
        }

        const isPlural = Boolean(isPluralCardExplicit || (plText && plText.length > 0));

        const rawCard: AICard = {
          id: `ai-card-${Date.now()}-${index}`,
          folderId: folderId,
          frontText: cleanFront || rawFront,
          backText: rawBack,
          isArticleMode: Boolean(c.isArticleMode || art),
          correctArticle: art,
          isPluralMode: isPlural,
          pluralText: plText || (isPluralCardExplicit ? cleanFront : ""),
          pluralLang: c.pluralLang || "de",
          translationHint: rawHint,
          difficulty: c.difficulty || "medium",
          imageSearchQuery: cleanImageSearchQuery(c.imageSearchQuery || "", imageInstructions) || undefined,
          frontImage: frontImg,
          frontImagePosition: frontImg ? "50% 50%" : undefined,
          autoImageCandidates: c.autoImageCandidates || (frontImg ? [frontImg] : undefined)
        };
        return sanitizeCardArticleAndSentence(rawCard);
      });

      const newFolder: AIFolder = {
        id: folderId,
        name: folderInfo.name || customFolderName.trim() || prompt.trim() || "مجلد خارجي مستورد 🌐",
        description: folderInfo.description || customFolderDesc.trim() || "تم استيراده من نموذج ذكاء اصطناعي خارجي",
        color: folderInfo.color || "#8b5cf6",
        frontLang: folderInfo.frontLang || "en",
        backLang: folderInfo.backLang || "ar",
        coverImage: folderCoverImage || undefined,
        coverImagePosition: folderCoverImage ? "50% 50%" : undefined,
        prompt: prompt.trim() || "استيراد خارجي",
        frontInstructions: frontInstructions || undefined,
        backInstructions: backInstructions || undefined,
        descInstructions: descInstructions || undefined,
        imageInstructions: imageInstructions || undefined,
        germanPluralInstruction: germanPluralInstruction || undefined,
        descriptionMode: descriptionMode,
        imagesMode: imagesMode,
        germanArticlesMode: germanArticlesMode,
        germanPluralMode: germanPluralMode,
        customFolderName: customFolderName || undefined,
        customFolderDesc: customFolderDesc || undefined,
        folderDescMode: folderDescMode,
        folderDescCondition: folderDescCondition || undefined,
        createdAt: new Date().toISOString()
      };

      const updatedFolders = [newFolder, ...aiFolders];
      const updatedCards = [...newCards, ...aiCards];

      setAiFolders(updatedFolders);
      setAiCards(updatedCards);
      localStorage.setItem("ai_workspace_folders", JSON.stringify(updatedFolders));
      localStorage.setItem("ai_workspace_cards", JSON.stringify(updatedCards));

      setActiveAiFolderId(folderId);
      setShowExternalModal(false);
      setExternalJsonInput("");
      setExternalCopySuccess(false);

      logAiRequest({
        prompt: prompt || "استيراد خارجي (External Mode)",
        rawPrompt: "استيراد يدوي لكود JSON المجلوب من نموذج خارجي مع تفعيل محرك جلب الصور",
        response: `تم استيراد ${newCards.length} بطاقة للمجلد "${newFolder.name}" بنجاح`,
        provider: "gemini",
        model: "external-json-import",
        cardsCount: newCards.length,
        status: "success"
      });

      // 2. Fetch Card Images via Centralized Unified Image Fetcher & Downloader
      if (imagesMode !== "off" && primaryImageTiming === "auto_after_ai") {
        setLoadingStatus("تم استيراد كود JSON بنجاح! جاري التوليد والجلب التلقائي الموحد للصور والروابط...");
        await handleUnifiedImageFetchAndDownload(newCards, folderId);
      }

    } catch (err: any) {
      setExternalError(`فشل تحليل كود JSON: ${err.message || 'يرجى التأكد من أن الكود الملصق هو صيغة JSON متوافقة'}`);
    } finally {
      setExternalImporting(false);
      setExternalImportProgress("");
    }
  };
  const [aiProvider, setAiProvider] = useState<"gemini" | "groq">(() => {
    try {
      return (localStorage.getItem("settings_ai_provider") as any) || "gemini";
    } catch {
      return "gemini";
    }
  });

  const handleProviderChange = (provider: "gemini" | "groq") => {
    setAiProvider(provider);
    localStorage.setItem("settings_ai_provider", provider);
  };

  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("الذكاء الاصطناعي يستعد للعمل...");
  const [error, setError] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  const [aiRequestHistory, setAiRequestHistory] = useState<AIRequestLog[]>(() => {
    try {
      const saved = localStorage.getItem("ai_request_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const logAiRequest = (params: {
    prompt: string;
    rawPrompt?: string;
    response?: string;
    provider: "gemini" | "groq";
    model: string;
    cardsCount: number | "auto";
    status: "success" | "failed";
    error?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    rawRequestBody?: string;
    rawResponseBody?: string;
  }) => {
    try {
      const parsedLimits = params.error ? parseRateLimitError(params.error) : undefined;
      const newLog: AIRequestLog = {
        id: `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        prompt: params.prompt,
        rawPrompt: params.rawPrompt,
        response: params.response,
        provider: params.provider,
        model: params.model,
        status: params.status,
        cardsCount: params.cardsCount,
        error: params.error,
        usage: params.usage,
        rateLimitInfo: parsedLimits ? {
          limitType: parsedLimits.limitType,
          limit: parsedLimits.limit,
          used: parsedLimits.used,
          requested: parsedLimits.requested,
          resetIn: parsedLimits.resetIn
        } : undefined,
        rawRequestBody: params.rawRequestBody,
        rawResponseBody: params.rawResponseBody
      };
      
      setAiRequestHistory(prev => {
        const updated = [newLog, ...prev].slice(0, 50);
        localStorage.setItem("ai_request_history", JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      console.error("Failed to log AI request:", e);
    }
  };

  // Persistent AI Folders & Cards
  const [aiFolders, setAiFolders] = useState<AIFolder[]>(() => {
    try {
      const saved = localStorage.getItem("ai_workspace_folders");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [aiCards, setAiCards] = useState<AICard[]>(() => {
    try {
      const saved = localStorage.getItem("ai_workspace_cards");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeAiFolderId, setActiveAiFolderId] = useState<string>("");

  // Synchronize with localStorage to reflect any restorations made in the Recycle Bin
  useEffect(() => {
    try {
      const savedFolders = localStorage.getItem("ai_workspace_folders");
      const savedCards = localStorage.getItem("ai_workspace_cards");
      if (savedFolders) setAiFolders(JSON.parse(savedFolders));
      if (savedCards) setAiCards(JSON.parse(savedCards));
    } catch (e) {
      console.error("Failed to sync restored AI elements from localStorage:", e);
    }
  }, []);

  // Telemetry & Token Usage States
  const [lastAiUsage, setLastAiUsage] = useState<{
    model: string;
    provider: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null>(() => {
    try {
      const saved = localStorage.getItem("stats_last_ai_usage");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [totalRequests, setTotalRequests] = useState(0);
  const [accumulatedPromptTokens, setAccumulatedPromptTokens] = useState(0);
  const [accumulatedCompletionTokens, setAccumulatedCompletionTokens] = useState(0);
  const [accumulatedTotalTokens, setAccumulatedTotalTokens] = useState(0);

  const [serverQuotas, setServerQuotas] = useState<any>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [showTelemetryDrawer, setShowTelemetryDrawer] = useState(false);
  const [telemetryTab, setTelemetryTab] = useState<"logs" | "quotas">("logs");

  const fetchServerQuotas = async (forceRefresh = false) => {
    setQuotaLoading(true);
    try {
      const savedApiKey = localStorage.getItem("custom_api_key") || "";
      const response = await fetch(`/api/ai-quota-check?refresh=${forceRefresh}&customApiKey=${encodeURIComponent(savedApiKey)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success" && data.cache) {
          setServerQuotas(data.cache);
        }
      }
    } catch (err) {
      console.error("Failed to load server AI quotas:", err);
    } finally {
      setQuotaLoading(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    const mStr = m < 10 ? `0${m}` : m;
    const sStr = s < 10 ? `0${s}` : s;
    
    if (h > 0) {
      return `${h}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
  };

  const fetchUsageStats = async () => {
    try {
      const response = await fetch("/api/ai-usage-stats");
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success") {
          if (data.isBlocked && data.resetInSeconds > 0) {
            setCountdownSeconds(data.resetInSeconds);
          } else {
            setCountdownSeconds(null);
          }
          // Also set server quotas info
          setServerQuotas(prev => {
            const base = prev || {};
            return {
              ...base,
              usageStats: data
            };
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch usage stats:", err);
    }
  };

  // Active Countdown Timer Effect
  useEffect(() => {
    if (countdownSeconds === null) return;
    if (countdownSeconds <= 0) {
      setCountdownSeconds(null);
      setError(null);
      return;
    }
    const timer = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev === null || prev <= 1) {
          setError(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdownSeconds]);

  // Load accumulated stats and quotas on mount
  useEffect(() => {
    setTotalRequests(Number(localStorage.getItem("stats_total_requests") || "0"));
    setAccumulatedPromptTokens(Number(localStorage.getItem("stats_total_prompt_tokens") || "0"));
    setAccumulatedCompletionTokens(Number(localStorage.getItem("stats_total_completion_tokens") || "0"));
    setAccumulatedTotalTokens(Number(localStorage.getItem("stats_total_tokens") || "0"));
    
    // Fetch initial server quotas and usage stats
    fetchServerQuotas(false);
    fetchUsageStats();
  }, []);

  const accumulateUsage = (usage: { model: string; provider: string; promptTokens: number; completionTokens: number; totalTokens: number }) => {
    const newReqs = Number(localStorage.getItem("stats_total_requests") || "0") + 1;
    const newPrompt = Number(localStorage.getItem("stats_total_prompt_tokens") || "0") + (usage.promptTokens || 0);
    const newComp = Number(localStorage.getItem("stats_total_completion_tokens") || "0") + (usage.completionTokens || 0);
    const newTotal = Number(localStorage.getItem("stats_total_tokens") || "0") + (usage.totalTokens || 0);

    localStorage.setItem("stats_total_requests", String(newReqs));
    localStorage.setItem("stats_total_prompt_tokens", String(newPrompt));
    localStorage.setItem("stats_total_completion_tokens", String(newComp));
    localStorage.setItem("stats_total_tokens", String(newTotal));
    localStorage.setItem("stats_last_ai_usage", JSON.stringify(usage));

    setTotalRequests(newReqs);
    setAccumulatedPromptTokens(newPrompt);
    setAccumulatedCompletionTokens(newComp);
    setAccumulatedTotalTokens(newTotal);
    setLastAiUsage(usage);

    // Refresh server quotas cache right after a successful usage event
    fetchServerQuotas(false);
  };

  const [showTelemetry, setShowTelemetry] = useState(true);

  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [editingCard, setEditingCard] = useState<AICard | null>(null);
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);
  const [imageSearchInitialQuery, setImageSearchInitialQuery] = useState("");
  const [imageSearchCallback, setImageSearchCallback] = useState<((url: string) => void) | null>(null);
  const [nextBatchDirection, setNextBatchDirection] = useState("");
  const [showNextBatchDirection, setShowNextBatchDirection] = useState(false);

  const isRefiningExistingFolder = aiRefineFolderId && activeAiFolderId === aiRefineFolderId;

  // Synchronize folder from main library if we are in AI refinement mode
  useEffect(() => {
    if (aiRefineFolderId) {
      const libFolder = folders.find(f => f.id === aiRefineFolderId);
      if (libFolder) {
        const mapArabicNameToCode = (name: string): string => {
          const mapping: Record<string, string> = {
            "الألمانية": "de",
            "الألماني": "de",
            "الإنجليزية": "en",
            "الإنجليزي": "en",
            "العربية": "ar",
            "العربي": "ar",
            "الإسبانية": "es",
            "الإسباني": "es",
            "الفرنسية": "fr",
            "الفرنسي": "fr"
          };
          return mapping[name] || name || "en";
        };

        const mappedFolder: AIFolder = {
          id: libFolder.id,
          name: libFolder.name,
          description: libFolder.description,
          color: libFolder.color,
          frontLang: mapArabicNameToCode(libFolder.frontLang),
          backLang: mapArabicNameToCode(libFolder.backLang),
          coverImage: libFolder.coverImage,
          coverImagePosition: libFolder.coverImagePosition,
          prompt: `تعديل المجلد ${libFolder.name} بالذكاء الاصطناعي 🪄`,
          createdAt: libFolder.createdAt || new Date().toISOString()
        };

        const exists = aiFolders.some(f => f.id === libFolder.id);
        let newAiFolders = [...aiFolders];
        if (!exists) {
          newAiFolders = [mappedFolder, ...aiFolders];
        } else {
          newAiFolders = aiFolders.map(f => f.id === libFolder.id ? { ...f, ...mappedFolder } : f);
        }

        const libCards = cards.filter(c => c.folderId === aiRefineFolderId);
        const mappedCards: AICard[] = libCards.map(c => ({
          id: c.id,
          folderId: libFolder.id,
          frontText: c.frontText,
          backText: c.backText,
          isArticleMode: c.isArticleMode,
          correctArticle: c.correctArticle,
          isPluralMode: c.isPluralMode,
          pluralText: c.pluralText,
          pluralLang: c.pluralLang,
          translationHint: c.translationHint,
          difficulty: c.difficulty,
          frontImage: c.frontImage,
          frontImagePosition: c.frontImagePosition
        }));

        let newAiCards = aiCards.filter(c => c.folderId !== libFolder.id);
        newAiCards = [...newAiCards, ...mappedCards];

        setAiFolders(newAiFolders);
        setAiCards(newAiCards);
        try {
          localStorage.setItem("ai_workspace_folders", JSON.stringify(newAiFolders));
          localStorage.setItem("ai_workspace_cards", JSON.stringify(newAiCards));
        } catch (e) {
          console.error("Local storage sync failed:", e);
        }

        setActiveAiFolderId(libFolder.id);
      }
    }
  }, [aiRefineFolderId, folders, cards]);

  // AI Folder Selection State
  const [selectedAiFolderIds, setSelectedAiFolderIds] = useState<string[]>([]);

  // Custom IFrame-safe Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "folder" | "card" | "selected_cards" | "all_folder_cards" | "selected_folders";
    id?: string;
    message: string;
  } | null>(null);

  // Interactive Review Mode State
  const [reviewMode, setReviewMode] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [reviewFlipped, setReviewFlipped] = useState(false);
  const [reviewDirection, setReviewDirection] = useState(0);

  // Import Dialog State
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importTargetMode, setImportTargetMode] = useState<"new" | "existing">("new");
  const [selectedExistingFolderId, setSelectedExistingFolderId] = useState("");
  const [parentFolderIdForNew, setParentFolderIdForNew] = useState("");
  const [customImportName, setCustomImportName] = useState("");

  // AI Batch Refinement/Modification States
  const [showRefinePanel, setShowRefinePanel] = useState(false);
  const [refineModifyDescription, setRefineModifyDescription] = useState(false);
  const [refineDescriptionIssue, setRefineDescriptionIssue] = useState("");
  const [refineDescriptionInstruction, setRefineDescriptionInstruction] = useState("");
  const [refineModifyImages, setRefineModifyImages] = useState(false);
  const [refineImageInstruction, setRefineImageInstruction] = useState("");
  const [refineModifyFrontText, setRefineModifyFrontText] = useState(false);
  const [refineFrontTextInstruction, setRefineFrontTextInstruction] = useState("");
  const [refineModifyBackText, setRefineModifyBackText] = useState(false);
  const [refineBackTextInstruction, setRefineBackTextInstruction] = useState("");
  const [refineGermanArticlesMode, setRefineGermanArticlesMode] = useState<"keep" | "on" | "off" | "auto">("keep");
  const [refineGermanPluralMode, setRefineGermanPluralMode] = useState<"keep" | "on" | "off" | "auto">("keep");
  const [refineGermanPluralInstruction, setRefineGermanPluralInstruction] = useState("");
  const [refineAiProvider, setRefineAiProvider] = useState<"gemini" | "groq">(() => {
    try {
      return (localStorage.getItem("settings_refine_ai_provider") as any) || "gemini";
    } catch {
      return "gemini";
    }
  });
  const [nextBatchAiProvider, setNextBatchAiProvider] = useState<"gemini" | "groq">(() => {
    try {
      return (localStorage.getItem("settings_next_batch_ai_provider") as any) || "gemini";
    } catch {
      return "gemini";
    }
  });

  const activeAiFolder = aiFolders.find(f => f.id === activeAiFolderId);
  const folderCards = aiCards.filter(c => c.folderId === activeAiFolderId);
  const filteredFolderCards = folderCards.filter((card) => {
    if (cardFilterMode === "no_image" && card.frontImage) return false;
    if (cardFilterMode === "has_article" && (!card.isArticleMode || !card.correctArticle)) return false;
    if (cardSearchQuery.trim()) {
      const q = cardSearchQuery.trim().toLowerCase();
      const matchFront = (card.frontText || "").toLowerCase().includes(q);
      const matchBack = (card.backText || "").toLowerCase().includes(q);
      const matchHint = (card.translationHint || "").toLowerCase().includes(q);
      const matchPlural = (card.pluralText || "").toLowerCase().includes(q);
      if (!matchFront && !matchBack && !matchHint && !matchPlural) return false;
    }
    return true;
  });

  // Synchronize options when active folder changes
  useEffect(() => {
    setCardFilterMode("all");
    setCardSearchQuery("");
    setShowQuickAddCard(false);
    setQuickAddInput("");
    setQuickAddError(null);
    setShowSavePresetInput(false);

    if (activeAiFolder) {
      setCustomImportName(activeAiFolder.name);
      setDescriptionMode(activeAiFolder.descriptionMode || "auto");
      setImagesMode(activeAiFolder.imagesMode || "auto");
      setGermanArticlesMode(activeAiFolder.germanArticlesMode || "auto");
      setGermanPluralMode(activeAiFolder.germanPluralMode || "auto");
      setGermanPluralInstruction(activeAiFolder.germanPluralInstruction || "");
      setFrontInstructions(activeAiFolder.frontInstructions || "");
      setBackInstructions(activeAiFolder.backInstructions || "");
      setDescInstructions(activeAiFolder.descInstructions || "");
      setImageInstructions(activeAiFolder.imageInstructions || "");
      // Auto-select all cards in active folder
      setSelectedCardIds(aiCards.filter(c => c.folderId === activeAiFolder.id).map(c => c.id));
      setShowImportDialog(false);
      
      // Reset refinement states
      setShowRefinePanel(false);
      setRefineModifyDescription(false);
      setRefineDescriptionIssue("");
      setRefineDescriptionInstruction("");
      setRefineModifyImages(false);
      setRefineImageInstruction("");
      setRefineModifyFrontText(false);
      setRefineFrontTextInstruction("");
      setRefineModifyBackText(false);
      setRefineBackTextInstruction("");
    } else {
      setReviewMode(false);
      setCurrentReviewIndex(0);
      setReviewFlipped(false);
    }
  }, [activeAiFolderId]);

  // Update folder in local storage when user edits advanced options while a folder is active
  useEffect(() => {
    if (!activeAiFolderId) return;
    const currentFolder = aiFolders.find(f => f.id === activeAiFolderId);
    if (!currentFolder) return;

    if (
      currentFolder.descriptionMode !== descriptionMode ||
      currentFolder.imagesMode !== imagesMode ||
      currentFolder.germanArticlesMode !== germanArticlesMode ||
      currentFolder.germanPluralMode !== germanPluralMode ||
      (currentFolder.frontInstructions || "") !== frontInstructions ||
      (currentFolder.backInstructions || "") !== backInstructions ||
      (currentFolder.descInstructions || "") !== descInstructions ||
      (currentFolder.imageInstructions || "") !== imageInstructions ||
      (currentFolder.germanPluralInstruction || "") !== germanPluralInstruction
    ) {
      const updated = aiFolders.map(f => {
        if (f.id === activeAiFolderId) {
          return {
            ...f,
            descriptionMode,
            imagesMode,
            germanArticlesMode,
            germanPluralMode,
            frontInstructions: frontInstructions || undefined,
            backInstructions: backInstructions || undefined,
            descInstructions: descInstructions || undefined,
            imageInstructions: imageInstructions || undefined,
            germanPluralInstruction: germanPluralInstruction || undefined
          };
        }
        return f;
      });
      setAiFolders(updated);
      localStorage.setItem("ai_workspace_folders", JSON.stringify(updated));
    }
  }, [
    activeAiFolderId,
    descriptionMode,
    imagesMode,
    germanArticlesMode,
    germanPluralMode,
    frontInstructions,
    backInstructions,
    descInstructions,
    imageInstructions,
    germanPluralInstruction
  ]);

  // Set default existing folder if available
  useEffect(() => {
    if (folders.length > 0 && !selectedExistingFolderId) {
      setSelectedExistingFolderId(folders[0].id);
    }
  }, [folders]);

  const readNdjson = async (
    response: Response,
    onStatus: (msg: string) => void,
    onRawChunk?: (text: string) => void
  ) => {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("لا يمكن قراءة مجرى البيانات من الخادم.");
    }
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalData = null;
    let finalUsage = null;
    let rawResponseText = "";
    let rawModelResponse = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        rawResponseText += chunkText;
        if (onRawChunk) {
          onRawChunk(rawResponseText);
        }

        buffer += chunkText;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            if (chunk.type === "status") {
              onStatus(chunk.message);
            } else if (chunk.type === "complete") {
              finalData = chunk.data;
              if (chunk.rawModelResponse) {
                rawModelResponse = chunk.rawModelResponse;
              }
              if (chunk.usage) {
                finalUsage = chunk.usage;
                accumulateUsage(chunk.usage);
              }
            } else if (chunk.type === "error") {
              throw new Error(chunk.error);
            }
          } catch (err) {
            console.error("Error parsing stream chunk:", err);
            const errMsg = (err as Error).message || "";
            if (errMsg.includes("failed") || errMsg.includes("error") || errMsg.includes("فشل") || errMsg.includes("Gemini") || errMsg.toLowerCase().includes("limit") || errMsg.toLowerCase().includes("rate")) {
              throw err;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { data: finalData, usage: finalUsage, rawResponseText, rawModelResponse };
  };

  const handleGenerate = async (targetPrompt: string) => {
    if (!targetPrompt.trim()) return;
    setLoading(true);
    setError(null);
    setLoadingStatus("جاري استدعاء خوارزميات الذكاء الاصطناعي من Google Gemini...");

    let finalPromptToSend = targetPrompt;
    let rawReqBody = "";
    let rawResBody = "";
    try {
      // Build detailed structured prompt containing the custom parameters
      const extraInstructionsList: string[] = [];
      if (frontInstructions.trim()) {
        extraInstructionsList.push(`- بالنسبة للوجه الأمامي للبطاقات (frontText): ${frontInstructions.trim()}`);
      }
      if (backInstructions.trim()) {
        extraInstructionsList.push(`- بالنسبة للوجه الخلفي للبطاقات (backText): ${backInstructions.trim()}`);
      }
      if (descInstructions.trim()) {
        extraInstructionsList.push(`- بالنسبة للوصف أو تلميحات الترجمة والمساعدة (translationHint): ${descInstructions.trim()}`);
      }
      if (imageInstructions.trim()) {
        extraInstructionsList.push(`- بالنسبة للكلمة الدليليلة للبحث عن الصور (imageSearchQuery) للبطاقات وغلاف المجلد: ${imageInstructions.trim()}`);
      }
      if (germanPluralMode !== "off" && germanPluralInstruction.trim()) {
        extraInstructionsList.push(`- بالنسبة لصيغة الجمع الألمانية (pluralText): ${germanPluralInstruction.trim()}`);
      }

      if (extraInstructionsList.length > 0) {
        finalPromptToSend += "\n\n⚠️ تعليمات تفصيلية مخصصة يجب دمجها والالتزام بها في توليد البطاقات:\n" + extraInstructionsList.join("\n");
      }

      const activeProvider = aiProvider;
      const customApiKey = activeProvider === "groq"
        ? localStorage.getItem("settings_groq_api_key") || ""
        : localStorage.getItem("settings_gemini_api_key") || "";

      // Compile selected transcript text if any
      let transcriptText = "";
      if (selectedTranscriptId && transcripts && transcripts.length > 0) {
        const found = transcripts.find(t => t.id === selectedTranscriptId);
        if (found) {
          transcriptText = found.segments.map(s => s.text).join(" ");
        }
      }

      const requestPayload = { 
        prompt: finalPromptToSend,
        customApiKey: customApiKey || undefined,
        descriptionMode,
        imagesMode: imagesMode,
        germanArticlesMode,
        germanPluralMode,
        germanPluralInstruction: germanPluralInstruction.trim() || undefined,
        aiProvider: activeProvider,
        customFolderName: customFolderName.trim() || undefined,
        customFolderDesc: customFolderDesc.trim() || undefined,
        folderDescMode,
        folderDescCondition: folderDescCondition.trim() || undefined,
        cardsCount: cardsCount,
        transcriptText: transcriptText || undefined
      };
      rawReqBody = JSON.stringify(requestPayload, null, 2);

      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawReqBody
      });

      if (!response.ok) {
        const errText = await response.text();
        rawResBody = errText;
        let errMsg = "فشل الذكاء الاصطناعي في توليد المجلد والبطاقات";
        try {
          const parsed = JSON.parse(errText);
          errMsg = parsed.error || errMsg;
        } catch {
          errMsg = errText || errMsg;
        }
        throw new Error(errMsg);
      }

      // Read real-time progress update stream!
      const { data, usage, rawModelResponse } = await readNdjson(response, (statusMessage) => {
        setLoadingStatus(statusMessage);
      }, (rawText) => {
        rawResBody = rawText;
      });

      if (rawModelResponse) {
        rawResBody = rawModelResponse;
      }

      if (data && data.cards && data.cards.length > 0) {
        const folderId = `ai-folder-${Date.now()}`;
        const newFolder: AIFolder = {
          id: folderId,
          name: data.folder?.name || "مجلد ذكي مؤقت",
          description: data.folder?.description || "تم توليده بالكامل عبر الذكاء الاصطناعي",
          color: data.folder?.color || "#0056f6",
          frontLang: data.folder?.frontLang || "en",
          backLang: data.folder?.backLang || "ar",
          coverImage: data.folder?.coverImage || undefined,
          coverImagePosition: data.folder?.coverImagePosition || undefined,
          prompt: targetPrompt,
          frontInstructions: frontInstructions || undefined,
          backInstructions: backInstructions || undefined,
          descInstructions: descInstructions || undefined,
          imageInstructions: imageInstructions || undefined,
          germanPluralInstruction: germanPluralInstruction || undefined,
          descriptionMode: descriptionMode,
          imagesMode: imagesMode,
          germanArticlesMode: germanArticlesMode,
          germanPluralMode: germanPluralMode,
          customFolderName: customFolderName || undefined,
          customFolderDesc: customFolderDesc || undefined,
          folderDescMode: folderDescMode,
          folderDescCondition: folderDescCondition || undefined,
          createdAt: new Date().toISOString()
        };

        const newCards: AICard[] = data.cards.map((c: any, index: number) => {
          const raw: AICard = {
            id: `ai-card-${Date.now()}-${index}`,
            folderId: folderId,
            frontText: c.frontText,
            backText: c.backText,
            isArticleMode: c.isArticleMode || false,
            correctArticle: c.correctArticle || "",
            isPluralMode: c.isPluralMode || false,
            pluralText: c.pluralText || "",
            pluralLang: c.pluralLang || "de",
            translationHint: c.translationHint || "",
            difficulty: c.difficulty || "medium",
            frontImage: c.frontImage || undefined,
            frontImagePosition: c.frontImagePosition || undefined
          };
          return sanitizeCardArticleAndSentence(raw);
        });

        const updatedFolders = [newFolder, ...aiFolders];
        const updatedCards = [...newCards, ...aiCards];

        setAiFolders(updatedFolders);
        setAiCards(updatedCards);
        localStorage.setItem("ai_workspace_folders", JSON.stringify(updatedFolders));
        localStorage.setItem("ai_workspace_cards", JSON.stringify(updatedCards));

        // Log successful request
        const responseSummary = `مجلد: ${data.folder?.name || "مجلد ذكي مؤقت"} (${data.folder?.description || ""})
البطاقات المولدة (${data.cards?.length || 0} بطاقة):
` + (data.cards || []).map((c: any, i: number) => {
  return `${i + 1}. الوجه الأمامي: "${c.frontText}" | الوجه الخلفي: "${c.backText}"${c.translationHint ? ` | تلميح: "${c.translationHint}"` : ""}`;
}).join("\n");

        logAiRequest({
          prompt: targetPrompt,
          rawPrompt: finalPromptToSend,
          response: responseSummary,
          provider: activeProvider,
          model: activeProvider === "groq" ? "llama-3.3-70b-versatile" : "gemini-3.5-flash",
          cardsCount: cardsCount,
          status: "success",
          usage: usage || undefined,
          rawRequestBody: rawReqBody,
          rawResponseBody: rawResBody
        });

        setActiveAiFolderId(folderId);
        setPrompt(""); // Clear prompt
        setFrontInstructions("");
        setBackInstructions("");
        setDescInstructions("");
        fetchUsageStats();

        if (imagesMode !== "off" && primaryImageTiming === "auto_after_ai") {
          setLoadingStatus("تم استلام استجابة الذكاء الاصطناعي بنجاح! جاري التوليد والجلب التلقائي للصور الأساسية والروابط الآن...");
          await handleUnifiedImageFetchAndDownload(newCards, folderId);
        }
      } else {
        throw new Error("لم يتمكن الذكاء الاصطناعي من صياغة بطاقات. يرجى تجربة برومبت مختلف.");
      }
    } catch (err) {
      console.error(err);
      const errMsg = (err as Error).message || "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.";
      setError(errMsg);
      
      // Log failed request
      logAiRequest({
        prompt: targetPrompt,
        rawPrompt: finalPromptToSend,
        provider: aiProvider,
        model: aiProvider === "groq" ? "llama-3.3-70b-versatile" : "gemini-3.5-flash",
        cardsCount: cardsCount,
        status: "failed",
        error: errMsg,
        rawRequestBody: rawReqBody,
        rawResponseBody: rawResBody
      });
      fetchUsageStats();
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateNextBatch = async () => {
    if (!activeAiFolder) return;
    setLoading(true);
    setError(null);
    setLoadingStatus("جاري استدعاء الذكاء الاصطناعي وتجهيز الوجبة الإضافية مع استبعاد الكلمات السابقة...");

    // Collect existing card front texts to send as exclude list
    const combinedExcludeList = folderCards.map(c => c.frontText);

    let finalPromptToSend = activeAiFolder.prompt;
    let rawReqBody = "";
    let rawResBody = "";
    try {
      // Build detailed structured prompt containing the custom parameters from active folder
      
      if (nextBatchDirection.trim()) {
        finalPromptToSend += `\n\n🎯 تركيز وتوجيه خاص ومحدد لهذه الوجبة المحددة:\n${nextBatchDirection.trim()}`;
      }

      const extraInstructionsList: string[] = [];
      if (activeAiFolder.frontInstructions?.trim()) {
        extraInstructionsList.push(`- بالنسبة للوجه الأمامي للبطاقات (frontText): ${activeAiFolder.frontInstructions.trim()}`);
      }
      if (activeAiFolder.backInstructions?.trim()) {
        extraInstructionsList.push(`- بالنسبة للوجه الخلفي للبطاقات (backText): ${activeAiFolder.backInstructions.trim()}`);
      }
      if (activeAiFolder.descInstructions?.trim()) {
        extraInstructionsList.push(`- بالنسبة للوصف أو تلميحات الترجمة والمساعدة (translationHint): ${activeAiFolder.descInstructions.trim()}`);
      }
      if (activeAiFolder.imageInstructions?.trim()) {
        extraInstructionsList.push(`- بالنسبة للكلمة الدليليلة للبحث عن الصور (imageSearchQuery) للبطاقات وغلاف المجلد: ${activeAiFolder.imageInstructions.trim()}`);
      }
      if (activeAiFolder.germanPluralInstruction?.trim()) {
        extraInstructionsList.push(`- بالنسبة لصيغة الجمع الألمانية (pluralText): ${activeAiFolder.germanPluralInstruction.trim()}`);
      }

      if (extraInstructionsList.length > 0) {
        finalPromptToSend += "\n\n⚠️ تعليمات تفصيلية مخصصة يجب دمجها والالتزام بها في توليد البطاقات:\n" + extraInstructionsList.join("\n");
      }

      const activeProvider = nextBatchAiProvider;
      const customApiKey = activeProvider === "groq"
        ? localStorage.getItem("settings_groq_api_key") || ""
        : localStorage.getItem("settings_gemini_api_key") || "";

      const requestPayload = { 
        prompt: finalPromptToSend,
        excludeList: combinedExcludeList,
        customApiKey: customApiKey || undefined,
        descriptionMode: activeAiFolder.descriptionMode || "auto",
        imagesMode: activeAiFolder.imagesMode || "auto",
        germanArticlesMode: activeAiFolder.germanArticlesMode || "auto",
        germanPluralMode: activeAiFolder.germanPluralMode || "auto",
        germanPluralInstruction: activeAiFolder.germanPluralInstruction || undefined,
        aiProvider: activeProvider,
        cardsCount: cardsCount
      };
      rawReqBody = JSON.stringify(requestPayload, null, 2);

      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawReqBody
      });

      if (!response.ok) {
        const errText = await response.text();
        rawResBody = errText;
        let errMsg = "فشل الذكاء الاصطناعي في توليد الوجبة الإضافية";
        try {
          const parsed = JSON.parse(errText);
          errMsg = parsed.error || errMsg;
        } catch {
          errMsg = errText || errMsg;
        }
        throw new Error(errMsg);
      }

      // Read real-time progress update stream!
      const { data, usage, rawModelResponse } = await readNdjson(response, (statusMessage) => {
        setLoadingStatus(statusMessage);
      }, (rawText) => {
        rawResBody = rawText;
      });

      if (rawModelResponse) {
        rawResBody = rawModelResponse;
      }

      if (data && data.cards && data.cards.length > 0) {
        const newCards: AICard[] = data.cards.map((c: any, index: number) => {
          const raw: AICard = {
            id: `ai-card-${Date.now()}-${index}`,
            folderId: activeAiFolder.id,
            frontText: c.frontText,
            backText: c.backText,
            isArticleMode: c.isArticleMode || false,
            correctArticle: c.correctArticle || "",
            isPluralMode: c.isPluralMode || false,
            pluralText: c.pluralText || "",
            pluralLang: c.pluralLang || "de",
            translationHint: c.translationHint || "",
            difficulty: c.difficulty || "medium",
            frontImage: c.frontImage || undefined,
            frontImagePosition: c.frontImagePosition || undefined
          };
          return sanitizeCardArticleAndSentence(raw);
        });

        const updatedCards = [...aiCards, ...newCards];
        setAiCards(updatedCards);
        localStorage.setItem("ai_workspace_cards", JSON.stringify(updatedCards));

        // Log successful request
        const responseSummary = `تم توليد وجبة إضافية من البطاقات (${newCards.length} بطاقة):
` + newCards.map((c: any, i: number) => {
  return `${i + 1}. الوجه الأمامي: "${c.frontText}" | الوجه الخلفي: "${c.backText}"${c.translationHint ? ` | تلميح: "${c.translationHint}"` : ""}`;
}).join("\n");

        logAiRequest({
          prompt: `${activeAiFolder.prompt} (وجبة إضافية)`,
          rawPrompt: finalPromptToSend,
          response: responseSummary,
          provider: activeProvider,
          model: activeProvider === "groq" ? "llama-3.3-70b-versatile" : "gemini-3.5-flash",
          cardsCount: cardsCount,
          status: "success",
          usage: usage || undefined,
          rawRequestBody: rawReqBody,
          rawResponseBody: rawResBody
        });

        // Auto select newly added cards
        setSelectedCardIds(prev => [...prev, ...newCards.map(c => c.id)]);
        setNextBatchDirection("");
        setShowNextBatchDirection(false);
        fetchUsageStats();

        if (activeAiFolder.imagesMode !== "off" && primaryImageTiming === "auto_after_ai") {
          setLoadingStatus("تم استلام الوجبة الإضافية بنجاح! جاري التوليد والجلب التلقائي للصور الأساسية والروابط الآن...");
          await handleUnifiedImageFetchAndDownload(newCards, activeAiFolder.id);
        }
      } else {
        throw new Error("لم يقم الذكاء الاصطناعي بإرجاع بطاقات إضافية جديدة. يبدو أنك استنفدت جميع المفاهيم!");
      }
    } catch (err) {
      console.error(err);
      const errMsg = (err as Error).message || "حدث خطأ أثناء توليد الوجبة الإضافية.";
      setError(errMsg);
      
      // Log failed request
      logAiRequest({
        prompt: `${activeAiFolder.prompt} (وجبة إضافية)`,
        rawPrompt: finalPromptToSend,
        provider: nextBatchAiProvider,
        model: nextBatchAiProvider === "groq" ? "llama-3.3-70b-versatile" : "gemini-3.5-flash",
        cardsCount: cardsCount,
        status: "failed",
        error: errMsg,
        rawRequestBody: rawReqBody,
        rawResponseBody: rawResBody
      });
      fetchUsageStats();
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreset = () => {
    const trimmed = newPresetName.trim();
    if (!trimmed) return;
    const preset: InstructionPreset = {
      id: `preset-${Date.now()}`,
      name: trimmed,
      prompt: prompt,
      frontInstructions,
      backInstructions,
      folderDescMode,
      folderDescCondition,
      descriptionMode,
      descInstructions,
      imagesMode,
      imageInstructions,
      germanArticlesMode,
      germanPluralMode,
      germanPluralInstruction,
      cardsCount
    };
    const updated = [preset, ...instructionPresets];
    setInstructionPresets(updated);
    try {
      localStorage.setItem("ai_instruction_presets", JSON.stringify(updated));
    } catch {}
    setActivePresetId(preset.id);
    setNewPresetName("");
    setShowSavePresetInput(false);
  };

  const handleApplyPreset = (preset: InstructionPreset) => {
    if (typeof preset.prompt === "string" && preset.prompt.trim()) {
      setPrompt(preset.prompt);
    }
    setFrontInstructions(preset.frontInstructions || "");
    setBackInstructions(preset.backInstructions || "");
    setFolderDescMode(preset.folderDescMode || "auto");
    setFolderDescCondition(preset.folderDescCondition || "");
    setDescriptionMode(preset.descriptionMode || "auto");
    setDescInstructions(preset.descInstructions || "");
    setImagesMode(preset.imagesMode || "auto");
    setImageInstructions(preset.imageInstructions || "");
    setGermanArticlesMode(preset.germanArticlesMode || "auto");
    setGermanPluralMode(preset.germanPluralMode || "auto");
    setGermanPluralInstruction(preset.germanPluralInstruction || "");
    setCardsCount(preset.cardsCount ?? "auto");
    setActivePresetId(preset.id);
  };

  const handleDeletePreset = (presetId: string) => {
    const updated = instructionPresets.filter(p => p.id !== presetId);
    setInstructionPresets(updated);
    try {
      localStorage.setItem("ai_instruction_presets", JSON.stringify(updated));
    } catch {}
    if (activePresetId === presetId) {
      setActivePresetId("");
    }
  };

  const handleQuickAddSingleCard = async () => {
    const term = quickAddInput.trim();
    if (!activeAiFolder || !term || quickAddLoading) return;

    setQuickAddLoading(true);
    setQuickAddError(null);

    const combinedExcludeList = folderCards.map(c => c.frontText);
    let finalPromptToSend = `أنشئ بطاقة تعليمية واحدة فقط (1 card) للمفهوم أو الكلمة التالية: "${term}"\nلغة الوجه الأمامي: ${activeAiFolder.frontLang || "de"} | لغة الوجه الخلفي: ${activeAiFolder.backLang || "ar"}\nالسياق العام للمجلد: ${activeAiFolder.prompt}`;

    const extraInstructionsList: string[] = [];
    if (activeAiFolder.frontInstructions?.trim()) {
      extraInstructionsList.push(`- بالنسبة للوجه الأمامي للبطاقة (frontText): ${activeAiFolder.frontInstructions.trim()}`);
    }
    if (activeAiFolder.backInstructions?.trim()) {
      extraInstructionsList.push(`- بالنسبة للوجه الخلفي للبطاقة (backText): ${activeAiFolder.backInstructions.trim()}`);
    }
    if (activeAiFolder.descInstructions?.trim()) {
      extraInstructionsList.push(`- بالنسبة للوصف أو التلميح (translationHint): ${activeAiFolder.descInstructions.trim()}`);
    }
    if (activeAiFolder.imageInstructions?.trim()) {
      extraInstructionsList.push(`- بالنسبة لكلمة البحث عن الصورة (imageSearchQuery): ${activeAiFolder.imageInstructions.trim()}`);
    }
    if (activeAiFolder.germanPluralInstruction?.trim()) {
      extraInstructionsList.push(`- بالنسبة لصيغة الجمع الألمانية (pluralText): ${activeAiFolder.germanPluralInstruction.trim()}`);
    }
    if (extraInstructionsList.length > 0) {
      finalPromptToSend += "\n\nتعليمات المجلد المخصصة:\n" + extraInstructionsList.join("\n");
    }

    const activeProvider = nextBatchAiProvider;
    const customApiKey = activeProvider === "groq"
      ? localStorage.getItem("settings_groq_api_key") || ""
      : localStorage.getItem("settings_gemini_api_key") || "";

    let rawReqBody = "";
    let rawResBody = "";

    try {
      const requestPayload = {
        prompt: finalPromptToSend,
        excludeList: combinedExcludeList,
        customApiKey: customApiKey || undefined,
        descriptionMode: activeAiFolder.descriptionMode || "auto",
        imagesMode: activeAiFolder.imagesMode || "auto",
        germanArticlesMode: activeAiFolder.germanArticlesMode || "auto",
        germanPluralMode: activeAiFolder.germanPluralMode || "auto",
        germanPluralInstruction: activeAiFolder.germanPluralInstruction || undefined,
        aiProvider: activeProvider,
        cardsCount: 1
      };
      rawReqBody = JSON.stringify(requestPayload, null, 2);

      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawReqBody
      });

      if (!response.ok) {
        const errText = await response.text();
        rawResBody = errText;
        let errMsg = "فشل الذكاء الاصطناعي في إنشاء البطاقة السريعة";
        try {
          const parsed = JSON.parse(errText);
          errMsg = parsed.error || errMsg;
        } catch {
          errMsg = errText || errMsg;
        }
        throw new Error(errMsg);
      }

      const { data, usage, rawModelResponse } = await readNdjson(response, undefined, (rawText) => {
        rawResBody = rawText;
      });
      if (rawModelResponse) rawResBody = rawModelResponse;

      if (data && data.cards && data.cards.length > 0) {
        const c = data.cards[0];
        let newCard = sanitizeCardArticleAndSentence({
          id: `ai-card-${Date.now()}-quick`,
          folderId: activeAiFolder.id,
          frontText: c.frontText,
          backText: c.backText,
          isArticleMode: c.isArticleMode || false,
          correctArticle: c.correctArticle || "",
          isPluralMode: c.isPluralMode || false,
          pluralText: c.pluralText || "",
          pluralLang: c.pluralLang || "de",
          translationHint: c.translationHint || "",
          difficulty: c.difficulty || "medium",
          frontImage: c.frontImage || undefined,
          frontImagePosition: c.frontImagePosition || undefined,
          imageSearchQuery: c.imageSearchQuery || undefined
        });

        setAiCards((prev) => {
          const updated = [newCard, ...prev];
          try {
            localStorage.setItem("ai_workspace_cards", JSON.stringify(updated));
          } catch {}
          return updated;
        });

        setSelectedCardIds(prev => [newCard.id, ...prev]);
        setQuickAddInput("");

        logAiRequest({
          prompt: `بطاقة سريعة: ${term}`,
          rawPrompt: finalPromptToSend,
          response: `1. الوجه الأمامي: "${newCard.frontText}" | الوجه الخلفي: "${newCard.backText}"`,
          provider: activeProvider,
          model: activeProvider === "groq" ? "llama-3.3-70b-versatile" : "gemini-3.5-flash",
          cardsCount: 1,
          status: "success",
          usage: usage || undefined,
          rawRequestBody: rawReqBody,
          rawResponseBody: rawResBody
        });
        fetchUsageStats();

        if (activeAiFolder.imagesMode !== "off" && primaryImageTiming === "auto_after_ai") {
          try {
            const q = getCardQueryTerm(newCard);
            if (q) {
              const imgRes = await fetch(`/api/images?q=${encodeURIComponent(q)}&page=1&provider=duckduckgo`);
              if (imgRes.ok) {
                const imgData = await imgRes.json();
                const hits = (imgData.hits || []).slice(0, 10);
                const candidateUrls = hits
                  .map((h: any) => h.largeImageURL || h.webformatURL || h.image || h.url)
                  .filter((u: string) => typeof u === "string" && u.startsWith("http"));
                if (candidateUrls.length > 0) {
                  try {
                    localStorage.setItem(`auto_images_${newCard.id}`, JSON.stringify(candidateUrls));
                  } catch {}
                  const topUrl = candidateUrls[0];
                  preloadImage(topUrl).catch(() => {});
                  setAiCards((prev) => {
                    const updated = prev.map(item =>
                      item.id === newCard.id
                        ? {
                            ...item,
                            frontImage: item.frontImage || topUrl,
                            frontImagePosition: "50% 50%",
                            autoImageCandidates: candidateUrls
                          }
                        : item
                    );
                    try {
                      localStorage.setItem("ai_workspace_cards", JSON.stringify(updated));
                    } catch {}
                    return updated;
                  });
                }
              }
            }
          } catch {}
        }
      } else {
        throw new Error("لم يرجع الذكاء الاصطناعي بطاقة صالحة.");
      }
    } catch (err) {
      const errMsg = (err as Error).message || "تعذر إنشاء البطاقة السريعة.";
      setQuickAddError(errMsg);
      logAiRequest({
        prompt: `بطاقة سريعة: ${term}`,
        rawPrompt: finalPromptToSend,
        provider: activeProvider,
        model: activeProvider === "groq" ? "llama-3.3-70b-versatile" : "gemini-3.5-flash",
        cardsCount: 1,
        status: "failed",
        error: errMsg,
        rawRequestBody: rawReqBody,
        rawResponseBody: rawResBody
      });
      fetchUsageStats();
    } finally {
      setQuickAddLoading(false);
    }
  };

  const parseImageProgress = (status: string) => {
    if (!status) return null;
    const isImageRelated = status.includes("صورة") || status.includes("الصور") || status.includes("غلاف") || status.includes("تنزيل");
    if (!isImageRelated) return null;

    const countMatch = status.match(/تم\s+جلب\s+(\d+)\s+من\s+(\d+)/i) || status.match(/(\d+)\s+من\s+(\d+)/i);
    let currentFetched = 0;
    let totalCards = 0;
    if (countMatch) {
      currentFetched = parseInt(countMatch[1], 10);
      totalCards = parseInt(countMatch[2], 10);
    }

    const roundMatch = status.match(/الجولة\s+(\d+)\/(\d+)/i);
    let currentRound = 1;
    let maxRounds = 10;
    if (roundMatch) {
      currentRound = parseInt(roundMatch[1], 10);
      maxRounds = parseInt(roundMatch[2], 10);
    }

    const cooldownMatch = status.match(/متبقي\s+(\d+)\s+ثوان/i);
    let cooldownSec = 0;
    if (cooldownMatch) {
      cooldownSec = parseInt(cooldownMatch[1], 10);
    }

    const isListFetching = status.includes("قائمة") || status.includes("قوائم") || status.includes("بدء جلب");

    return {
      isImageRelated: true,
      isListFetching,
      currentFetched,
      totalCards,
      percent: totalCards > 0 ? Math.round((currentFetched / totalCards) * 100) : 0,
      currentRound,
      maxRounds,
      cooldownSec,
      rawMessage: status
    };
  };

  const handleUnifiedImageFetchAndDownload = async (
    targetCards?: AICard[],
    folderIdOverride?: string
  ) => {
    const cardsToProcess = targetCards || (activeAiFolder ? folderCards : aiCards);
    if (cardsToProcess.length === 0 && !activeAiFolder?.coverImage) return;

    const currentFolderObj = (folderIdOverride ? aiFolders.find(f => f.id === folderIdOverride) : undefined) || activeAiFolder;

    setShowImageOptionsModal(true);
    setLoading(true);
    setError(null);
    setIsFetchingImages(true);
    setImageFetchSuccess(false);

    const isDataUrlPrimary = primaryImageStorageMode === "data_url";
    const isDataUrlSecondary = secondaryImagesStorageMode === "data_urls";
    const queue: { url: string; label: string; cardId: string }[] = [];

    if (isDataUrlPrimary && currentFolderObj?.coverImage) {
      queue.push({ url: currentFolderObj.coverImage, label: `غلاف المجلد: ${currentFolderObj.name}`, cardId: "folder-cover" });
    }

    if (isDataUrlPrimary) {
      cardsToProcess.forEach((card) => {
        if (card.frontImage && card.frontImage.trim()) {
          queue.push({ url: card.frontImage, label: `الصورة الأساسية (وجه): ${card.frontText || "بدون عنوان"}`, cardId: card.id });
        }
        if (card.backImage && card.backImage.trim()) {
          queue.push({ url: card.backImage, label: `الصورة الأساسية (ظهر): ${card.backText || "بدون عنوان"}`, cardId: card.id });
        }
      });
    }

    const updatedCardCandidatesMap: { [cardId: string]: { topImage?: string; candidates: string[] } } = {};

    try {
      const totalCards = cardsToProcess.length;

      // Phase 1: Fetch candidate lists of 10 images for each card
      if (totalCards > 0) {
        for (let idx = 0; idx < totalCards; idx++) {
          const card = cardsToProcess[idx];
          const queryTerm = getCardQueryTerm(card);
          if (!queryTerm) continue;

          setImageFetchProgress({
            current: idx + 1,
            total: totalCards,
            currentItem: `مرحلة 1/2 (جلب القوائم): جلب الـ 10 صور للبطاقة (${idx + 1}/${totalCards}): "${card.frontText || queryTerm}"...`,
            currentPreview: card.frontImage || undefined
          });

          setLoadingStatus(`مرحلة 1/2 (جلب القوائم): جلب الـ 10 صور للبطاقة (${idx + 1}/${totalCards}): "${card.frontText || queryTerm}"...`);

          try {
            const apiBase = "/api/images";
            const res = await fetch(`${apiBase}?q=${encodeURIComponent(queryTerm)}&page=1&provider=duckduckgo`);

            if (res.ok) {
              const data = await res.json();
              const hits = (data.hits || []).slice(0, 10);

              const urls = hits
                .map((h: any) => h.largeImageURL || h.webformatURL || h.image || h.url)
                .filter((u: string) => typeof u === "string" && u.startsWith("http"));

              if (urls.length > 0) {
                updatedCardCandidatesMap[card.id] = {
                  topImage: urls[0],
                  candidates: urls
                };

                // Immediately show the first candidate as preview
                setImageFetchProgress((prev) => ({
                  ...prev,
                  currentPreview: urls[0]
                }));

                // Save candidate images list in localStorage
                try {
                  localStorage.setItem(`auto_images_${card.id}`, JSON.stringify(urls));
                } catch (e) {}

                // Only add images to download queue if user chose Data URLs / Memory cache storage mode
                if (includeAuto10Images && isDataUrlSecondary) {
                  urls.forEach((imgUrl: string, imgIdx: number) => {
                    if (imgUrl && !queue.some(q => q.url === imgUrl)) {
                      queue.push({
                        url: imgUrl,
                        label: `صورة تلقائية #${imgIdx + 1} لـ "${card.frontText || queryTerm}"`,
                        cardId: card.id
                      });
                    }
                  });
                } else if (!card.frontImage && urls[0] && isDataUrlPrimary && !queue.some(q => q.url === urls[0])) {
                  queue.push({
                    url: urls[0],
                    label: `الصورة التلقائية المقترحة لـ "${card.frontText || queryTerm}"`,
                    cardId: card.id
                  });
                }
              }
            }
          } catch (err) {
            console.warn("Failed to fetch 10 auto images for card:", queryTerm, err);
          }

          // Polite rate-limit delay between search requests
          await new Promise((r) => setTimeout(r, 120));
        }
      }

      // Always update state and state persistence for cards with topImage & autoImageCandidates
      setAiCards((prevCards) => {
        const cardMap = new Map<string, AICard>();
        prevCards.forEach((c) => cardMap.set(c.id, c));

        cardsToProcess.forEach((tc) => {
          const match = updatedCardCandidatesMap[tc.id];
          const existing = cardMap.get(tc.id) || tc;
          const finalImg = existing.frontImage || match?.topImage || tc.frontImage || undefined;
          const finalCandidates = (match?.candidates && match.candidates.length > 0)
            ? match.candidates
            : (existing.autoImageCandidates || tc.autoImageCandidates || []);

          cardMap.set(tc.id, {
            ...existing,
            frontImage: finalImg,
            frontImagePosition: finalImg ? "50% 50%" : existing.frontImagePosition,
            autoImageCandidates: finalCandidates
          });
        });

        const mergedCardsArray = Array.from(cardMap.values());
        try {
          localStorage.setItem("ai_workspace_cards", JSON.stringify(mergedCardsArray));
        } catch (e) {}
        return mergedCardsArray;
      });

      if (queue.length === 0) {
        setIsFetchingImages(false);
        setImageFetchSuccess(true);
        setLoading(false);
        setLoadingStatus("تم جلب وحفظ كافة روابط الصور بنجاح!");
        return;
      }

      // Phase 2: Preload & Cache all queued images locally
      setImageFetchProgress({ current: 0, total: queue.length, currentItem: "مرحلة 2/2: التنزيل والتخزين المحلي...", currentPreview: queue[0]?.url });
      setLoadingStatus("مرحلة 2/2: التنزيل والتخزين المحلي في الذاكرة...");

      const concurrency = 2;
      let completed = 0;

      for (let i = 0; i < queue.length; i += concurrency) {
        const chunk = queue.slice(i, i + concurrency);
        await Promise.all(
          chunk.map(async (item) => {
            try {
              await preloadImage(item.url);
            } catch (err) {
              console.warn("Failed to download/cache image:", item.url, err);
            } finally {
              completed++;
              setImageFetchProgress({
                current: completed,
                total: queue.length,
                currentItem: item.label,
                currentPreview: item.url
              });
            }
          })
        );
        await new Promise((r) => setTimeout(r, 40));
      }

      setIsFetchingImages(false);
      setImageFetchSuccess(true);
      setLoadingStatus("تم اكتمال عملية جلب وتخزين الصور بنجاح!");
    } catch (err) {
      console.error("Unified image fetch error:", err);
      setError("حدث خطأ أثناء جلب وتخزين الصور للبطاقات");
      setIsFetchingImages(false);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchImagesForFolderCards = async () => {
    return handleUnifiedImageFetchAndDownload();
  };

  const handleFetchImageForSingleCard = async (cardId: string) => {
    const card = aiCards.find(c => c.id === cardId);
    if (!card) return;

    setLoading(true);
    setError(null);
    setLoadingStatus(`جاري البحث وجلب قائمة الـ 10 صور وتنزيل الأفضل للبطاقة "${card.frontText}"...`);

    try {
      const q = getCardQueryTerm(card);
      const res = await fetch(`/api/images?q=${encodeURIComponent(q)}&page=1&provider=duckduckgo`);
      if (!res.ok) throw new Error("فشل جلب قائمة الصور للبطاقة");

      const data = await res.json();
      if (data && data.hits && data.hits.length > 0) {
        const hits = data.hits.slice(0, 10);
        const candidateUrls = hits
          .map((h: any) => h.largeImageURL || h.webformatURL || h.image || h.url)
          .filter((u: string) => typeof u === "string" && u.startsWith("http"));

        // Save auto images list in localStorage
        try {
          localStorage.setItem(`auto_images_${cardId}`, JSON.stringify(candidateUrls));
        } catch (e) {}

        const topUrl = candidateUrls[0];
        if (topUrl) {
          const updatedAiCards = aiCards.map(c => c.id === cardId ? {
            ...c,
            frontImage: topUrl,
            frontImagePosition: "50% 50%"
          } : c);
          setAiCards(updatedAiCards);
          localStorage.setItem("ai_workspace_cards", JSON.stringify(updatedAiCards));

          candidateUrls.forEach((u: string) => preloadImage(u).catch(() => {}));
        } else {
          alert("لم نتمكن من العثور على صورة مناسبة لهذه البطاقة");
        }
      } else {
        alert("لم يتم العثور على صور مطابقة للبطاقة");
      }
    } catch (err) {
      console.error("Single card image fetch failed:", err);
      setError("فشل جلب صورة للبطاقة");
    } finally {
      setLoading(false);
    }
  };

  const healingAiCardUrlsRef = React.useRef<Set<string>>(new Set());

  const handleHealAiCardImage = React.useCallback((cardId: string, failedUrl: string) => {
    if (!cardId || !failedUrl) return;
    const key = `${cardId}::${failedUrl}`;
    if (healingAiCardUrlsRef.current.has(key)) return;
    healingAiCardUrlsRef.current.add(key);

    brokenImagesSet.add(failedUrl);
    let healedTarget: AICard | null = null;
    let needsFetch = false;

    setAiCards((prevCards) => {
      const target = prevCards.find(c => c.id === cardId);
      if (!target) return prevCards;
      const { updatedCard, replacementUrl, changed } = healBrokenCardImage(target, failedUrl);
      healedTarget = updatedCard;
      needsFetch = !replacementUrl;
      if (!changed) return prevCards;
      const updated = prevCards.map(c => (c.id === cardId ? updatedCard : c));
      try {
        localStorage.setItem("ai_workspace_cards", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setTimeout(() => {
      if (!needsFetch || !healedTarget) return;
      const qTerm = getCardQueryTerm(healedTarget);
      if (!qTerm) return;
      fetch(`/api/images?q=${encodeURIComponent(qTerm)}&page=1&provider=duckduckgo`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.hits?.length) return;
          const urls = data.hits.slice(0, 10)
            .map((h: any) => h.largeImageURL || h.webformatURL || h.image || h.url)
            .filter((u: string) => typeof u === "string" && u.startsWith("http") && !brokenImagesSet.has(u) && !isImageUrlBroken(u));
          if (urls.length > 0) {
            setAiCards((prevCards) => {
              const target = prevCards.find(c => c.id === cardId);
              if (!target) return prevCards;
              const { updatedCard: promotedCard, promotedUrl } = promoteCandidateListToCard(target, urls);
              if (!promotedUrl) return prevCards;
              const updated = prevCards.map(c => (c.id === cardId ? promotedCard : c));
              try {
                localStorage.setItem("ai_workspace_cards", JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        })
        .catch(() => {});
    }, 0);
  }, [getCardQueryTerm]);

  const handleRefineCards = async () => {
    if (!activeAiFolder || folderCards.length === 0) return;
    
    // Check if at least one refinement choice is selected
    const hasActiveChoice = refineModifyDescription || refineModifyImages || refineModifyFrontText || refineModifyBackText || refineGermanArticlesMode !== "keep" || refineGermanPluralMode !== "keep";
    if (!hasActiveChoice) {
      alert("الرجاء اختيار جانب واحد على الأقل لتعديله (الوصف، الصور، النصوص الأمامية، الخلفية، ضبط أدوات التعريف، أو صيغ الجمع)!");
      return;
    }

    if (refineModifyDescription && !refineDescriptionInstruction.trim()) {
      alert("توجيهات الوصف الجديد مطلوبة وإجبارية عند تفعيل تعديل الوصف!");
      return;
    }

    if (refineModifyImages && !refineImageInstruction.trim()) {
      alert("نمط وتوجيهات الصور الجديدة مطلوبة وإجبارية عند تفعيل تعديل الصور!");
      return;
    }

    if (refineModifyFrontText && !refineFrontTextInstruction.trim()) {
      alert("توجيهات تعديل النص الأمامي مطلوبة وإجبارية عند تفعيل تعديل النص الأمامي!");
      return;
    }

    if (refineModifyBackText && !refineBackTextInstruction.trim()) {
      alert("توجيهات تعديل النص الخلفي مطلوبة وإجبارية عند تفعيل تعديل النص الخلفي!");
      return;
    }

    setLoading(true);
    setError(null);
    const activeProvider = refineAiProvider;
    const providerNameArabic = activeProvider === "groq" ? "Groq" : "جيميناي";
    setLoadingStatus(`جاري تحضير البطاقات الحالية وإرسال توجيهات التعديل لـ ${providerNameArabic}...`);

    let refinePromptSummary = `طلب تعديل وتحسين مجلد بطاقات:
`;
    if (refineModifyDescription) {
      refinePromptSummary += `- تعديل وصف المجلد: "${refineDescriptionInstruction}"\n`;
    }
    if (refineModifyImages) {
      refinePromptSummary += `- تعديل الصور: "${refineImageInstruction}"\n`;
    }
    if (refineModifyFrontText) {
      refinePromptSummary += `- تعديل النص الأمامي: "${refineFrontTextInstruction}"\n`;
    }
    if (refineModifyBackText) {
      refinePromptSummary += `- تعديل النص الخلفي: "${refineBackTextInstruction}"\n`;
    }
    if (refineGermanArticlesMode !== "keep") {
      refinePromptSummary += `- نمط أدوات التعريف الألمانية: ${refineGermanArticlesMode}\n`;
    }
    if (refineGermanPluralMode !== "keep") {
      refinePromptSummary += `- نمط صيغ الجمع الألمانية: ${refineGermanPluralMode} (${refineGermanPluralInstruction})\n`;
    }

    let rawReqBody = "";
    let rawResBody = "";
    try {
      const customApiKey = activeProvider === "groq"
        ? localStorage.getItem("settings_groq_api_key") || ""
        : localStorage.getItem("settings_gemini_api_key") || "";

      const requestPayload = {
        cards: folderCards.map(c => ({
          frontText: c.frontText,
          backText: c.backText,
          isArticleMode: c.isArticleMode || false,
          correctArticle: c.correctArticle || "",
          isPluralMode: c.isPluralMode || false,
          pluralText: c.pluralText || "",
          pluralLang: c.pluralLang || "de",
          translationHint: c.translationHint || "",
          difficulty: c.difficulty || "medium",
          frontImage: c.frontImage || "",
          frontImagePosition: c.frontImagePosition || "",
          imageSearchQuery: "" 
        })),
        customApiKey: customApiKey || undefined,
        modifyDescription: refineModifyDescription,
        descriptionIssue: refineDescriptionIssue,
        descriptionInstruction: refineDescriptionInstruction,
        modifyImages: refineModifyImages,
        imageInstruction: refineImageInstruction,
        modifyFrontText: refineModifyFrontText,
        frontTextInstruction: refineFrontTextInstruction,
        modifyBackText: refineModifyBackText,
        backTextInstruction: refineBackTextInstruction,
        germanArticlesMode: refineGermanArticlesMode,
        germanPluralMode: refineGermanPluralMode,
        germanPluralInstruction: refineGermanPluralInstruction,
        aiProvider: activeProvider
      };
      rawReqBody = JSON.stringify(requestPayload, null, 2);

      const response = await fetch("/api/ai/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawReqBody
      });

      if (!response.ok) {
        const errText = await response.text();
        rawResBody = errText;
        let errMsg = "فشل الذكاء الاصطناعي في تعديل وإعادة صياغة البطاقات";
        try {
          const parsed = JSON.parse(errText);
          errMsg = parsed.error || errMsg;
        } catch {
          errMsg = errText || errMsg;
        }
        throw new Error(errMsg);
      }

      // Read real-time progress update stream!
      const { data, usage, rawModelResponse } = await readNdjson(response, (statusMessage) => {
        setLoadingStatus(statusMessage);
      }, (rawText) => {
        rawResBody = rawText;
      });

      if (rawModelResponse) {
        rawResBody = rawModelResponse;
      }

      if (data && data.cards && data.cards.length > 0) {
        // Map back to our AICards structure, keeping original IDs so we update existing cards in-place!
        const refinedCards: AICard[] = data.cards.map((c: any, index: number) => {
          const originalCard = folderCards[index];
          return {
            id: originalCard ? originalCard.id : `ai-card-${Date.now()}-${index}`,
            folderId: activeAiFolder.id,
            frontText: c.frontText,
            backText: c.backText,
            isArticleMode: c.isArticleMode || false,
            correctArticle: c.correctArticle || "",
            isPluralMode: c.isPluralMode || false,
            pluralText: c.pluralText || "",
            pluralLang: c.pluralLang || "de",
            translationHint: c.translationHint || "",
            difficulty: c.difficulty || "medium",
            frontImage: c.frontImage || undefined,
            frontImagePosition: c.frontImagePosition || undefined
          };
        });

        // Filter out old folder cards and insert the refined ones!
        const otherCards = aiCards.filter(c => c.folderId !== activeAiFolder.id);
        const updatedCards = [...otherCards, ...refinedCards];
        
        setAiCards(updatedCards);
        localStorage.setItem("ai_workspace_cards", JSON.stringify(updatedCards));

        // Log successful request
        const responseSummary = `تم تعديل وتحسين البطاقات بنجاح (${refinedCards.length} بطاقة):
` + refinedCards.map((c: any, i: number) => {
  return `${i + 1}. الوجه الأمامي: "${c.frontText}" | الوجه الخلفي: "${c.backText}"${c.translationHint ? ` | تلميح: "${c.translationHint}"` : ""}`;
}).join("\n");

        logAiRequest({
          prompt: `تعديل وتحسين البطاقات للمجلد "${activeAiFolder.name}"`,
          rawPrompt: refinePromptSummary,
          response: responseSummary,
          provider: activeProvider,
          model: activeProvider === "groq" ? "llama-3.3-70b-versatile" : "gemini-3.5-flash",
          cardsCount: folderCards.length,
          status: "success",
          usage: usage || undefined,
          rawRequestBody: rawReqBody,
          rawResponseBody: rawResBody
        });

        // Keep all updated cards selected
        setSelectedCardIds(refinedCards.map(c => c.id));
        
        // Hide panel
        setShowRefinePanel(false);
        fetchUsageStats();
      } else {
        throw new Error("لم يرجع الذكاء الاصطناعي أي بطاقات معدلة.");
      }
    } catch (err) {
      console.error(err);
      const errMsg = (err as Error).message || "حدث خطأ أثناء تعديل البطاقات بالذكاء الاصطناعي.";
      setError(errMsg);

      // Log failed request
      logAiRequest({
        prompt: `تعديل وتحسين البطاقات للمجلد "${activeAiFolder.name}"`,
        rawPrompt: refinePromptSummary,
        provider: refineAiProvider,
        model: refineAiProvider === "groq" ? "llama-3.3-70b-versatile" : "gemini-3.5-flash",
        cardsCount: folderCards.length,
        status: "failed",
        error: errMsg,
        rawRequestBody: rawReqBody,
        rawResponseBody: rawResBody
      });
      fetchUsageStats();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAiCard = (cardId: string) => {
    setDeleteConfirm({
      type: "card",
      id: cardId,
      message: "هل أنت متأكد من رغبتك في حذف هذه البطاقة الدراسية المؤقتة؟"
    });
  };

  const handleDeleteSelectedCards = () => {
    if (selectedCardIds.length === 0) return;
    setDeleteConfirm({
      type: "selected_cards",
      message: `هل أنت متأكد من رغبتك في حذف ${selectedCardIds.length} من البطاقات المحددة؟`
    });
  };

  const handleDeleteAllFolderCards = () => {
    setDeleteConfirm({
      type: "all_folder_cards",
      message: "هل أنت متأكد من رغبتك في حذف جميع البطاقات في هذا المجلد الذكي المؤقت؟"
    });
  };

  const handleReviewDelete = (cardId: string) => {
    // Delete the card from main list
    const cardToDelete = aiCards.find(c => c.id === cardId);
    if (cardToDelete && onTrashAiCard) {
      onTrashAiCard(cardToDelete);
    }
    const updated = aiCards.filter(c => c.id !== cardId);
    setAiCards(updated);
    localStorage.setItem("ai_workspace_cards", JSON.stringify(updated));
    setSelectedCardIds(prev => prev.filter(id => id !== cardId));

    // Calculate remaining cards in this folder
    const remainingCards = folderCards.filter(c => c.id !== cardId);
    if (remainingCards.length === 0) {
      setReviewMode(false);
      setCurrentReviewIndex(0);
    } else {
      // Adjust index if we were on the last card
      if (currentReviewIndex >= remainingCards.length) {
        setCurrentReviewIndex(remainingCards.length - 1);
      }
    }
    setReviewFlipped(false);
  };

  const handleReviewNext = () => {
    if (currentReviewIndex < folderCards.length - 1) {
      setReviewDirection(1);
      setCurrentReviewIndex(prev => prev + 1);
      setReviewFlipped(false);
    }
  };

  const handleReviewPrev = () => {
    if (currentReviewIndex > 0) {
      setReviewDirection(-1);
      setCurrentReviewIndex(prev => prev - 1);
      setReviewFlipped(false);
    }
  };

  const handleToggleSelectAiFolder = (folderId: string) => {
    setSelectedAiFolderIds(prev => 
      prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]
    );
  };

  const handleSelectAllAiFolders = () => {
    if (aiFolders.length === 0) return;
    const allSelected = aiFolders.every(f => selectedAiFolderIds.includes(f.id));
    if (allSelected) {
      setSelectedAiFolderIds([]);
    } else {
      setSelectedAiFolderIds(aiFolders.map(f => f.id));
    }
  };

  const handleBulkDeleteAiFolders = () => {
    if (selectedAiFolderIds.length === 0) return;
    setDeleteConfirm({
      type: "selected_folders",
      message: `هل أنت متأكد من رغبتك في حذف ${selectedAiFolderIds.length} من المجلدات المؤقتة المحددة مع جميع بطاقاتها؟`
    });
  };

  const handleDeleteAiFolder = (folderId: string) => {
    const folder = aiFolders.find(f => f.id === folderId);
    setDeleteConfirm({
      type: "folder",
      id: folderId,
      message: `هل أنت متأكد من رغبتك في حذف المجلد المؤقت "${folder?.name || ''}" بالكامل مع جميع بطاقاته؟`
    });
  };

  const executeConfirmedDelete = () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === "card" && deleteConfirm.id) {
      const cardId = deleteConfirm.id;
      const cardToDelete = aiCards.find(c => c.id === cardId);
      if (cardToDelete && onTrashAiCard) {
        onTrashAiCard(cardToDelete);
      }
      const updated = aiCards.filter(c => c.id !== cardId);
      setAiCards(updated);
      localStorage.setItem("ai_workspace_cards", JSON.stringify(updated));
      setSelectedCardIds(prev => prev.filter(id => id !== cardId));
    } else if (deleteConfirm.type === "selected_cards") {
      const cardsToTrash = aiCards.filter(c => selectedCardIds.includes(c.id));
      if (cardsToTrash.length > 0 && onTrashAiCards) {
        onTrashAiCards(cardsToTrash);
      }
      const updated = aiCards.filter(c => !selectedCardIds.includes(c.id));
      setAiCards(updated);
      localStorage.setItem("ai_workspace_cards", JSON.stringify(updated));
      setSelectedCardIds([]);
    } else if (deleteConfirm.type === "all_folder_cards") {
      const cardsToTrash = aiCards.filter(c => c.folderId === activeAiFolderId);
      if (cardsToTrash.length > 0 && onTrashAiCards) {
        onTrashAiCards(cardsToTrash);
      }
      const updated = aiCards.filter(c => c.folderId !== activeAiFolderId);
      setAiCards(updated);
      localStorage.setItem("ai_workspace_cards", JSON.stringify(updated));
      setSelectedCardIds([]);
    } else if (deleteConfirm.type === "folder" && deleteConfirm.id) {
      const folderId = deleteConfirm.id;
      const folderToDelete = aiFolders.find(f => f.id === folderId);
      const cardsToTrash = aiCards.filter(c => c.folderId === folderId);
      if (folderToDelete && onTrashAiFolder) {
        onTrashAiFolder(folderToDelete, cardsToTrash);
      }
      const updatedFolders = aiFolders.filter(f => f.id !== folderId);
      const updatedCards = aiCards.filter(c => c.folderId !== folderId);
      setAiFolders(updatedFolders);
      setAiCards(updatedCards);
      localStorage.setItem("ai_workspace_folders", JSON.stringify(updatedFolders));
      localStorage.setItem("ai_workspace_cards", JSON.stringify(updatedCards));
      if (activeAiFolderId === folderId) {
        setActiveAiFolderId("");
      }
      setSelectedCardIds([]);
      setSelectedAiFolderIds(prev => prev.filter(id => id !== folderId));
    } else if (deleteConfirm.type === "selected_folders") {
      const foldersToDelete = aiFolders.filter(f => selectedAiFolderIds.includes(f.id));
      if (onTrashAiFolder) {
        foldersToDelete.forEach(folder => {
          const folderCardsList = aiCards.filter(c => c.folderId === folder.id);
          onTrashAiFolder(folder, folderCardsList);
        });
      } else if (onTrashAiCards) {
        const cardsToTrash = aiCards.filter(c => selectedAiFolderIds.includes(c.folderId));
        if (cardsToTrash.length > 0) {
          onTrashAiCards(cardsToTrash);
        }
      }

      const updatedFolders = aiFolders.filter(f => !selectedAiFolderIds.includes(f.id));
      const updatedCards = aiCards.filter(c => !selectedAiFolderIds.includes(c.folderId));

      setAiFolders(updatedFolders);
      setAiCards(updatedCards);
      localStorage.setItem("ai_workspace_folders", JSON.stringify(updatedFolders));
      localStorage.setItem("ai_workspace_cards", JSON.stringify(updatedCards));

      if (selectedAiFolderIds.includes(activeAiFolderId)) {
        setActiveAiFolderId("");
      }
      setSelectedAiFolderIds([]);
    }

    setDeleteConfirm(null);
  };

  const adaptAICardToFlashcard = (aiCard: AICard): Flashcard => {
    const sanitized = sanitizeCardArticleAndSentence(aiCard);
    const isSingleWord = !isGermanSentence(sanitized.frontText || "");

    let isArticle = isSingleWord && (sanitized.isArticleMode ?? (activeAiFolder?.germanArticlesMode === "on"));
    let correctArt = isArticle ? (sanitized.correctArticle || "") : "";

    return {
      id: sanitized.id,
      folderId: sanitized.folderId,
      frontText: sanitized.frontText,
      frontLang: activeAiFolder?.frontLang || "de",
      frontImage: sanitized.frontImage,
      frontImagePosition: sanitized.frontImagePosition || "50% 50%",
      backText: sanitized.backText,
      backLang: activeAiFolder?.backLang || "ar",
      isArticleMode: isArticle,
      correctArticle: correctArt,
      isPluralMode: isSingleWord ? (sanitized.isPluralMode ?? (activeAiFolder?.germanPluralMode === "on")) : false,
      pluralText: isSingleWord ? (sanitized.pluralText || "") : "",
      pluralLang: sanitized.pluralLang || "de",
      translationHint: sanitized.translationHint || "",
      createdAt: new Date().toISOString(),
      streak: 0,
      difficulty: sanitized.difficulty || "medium"
    };
  };

  const handleOpenImageSearch = (onSelect: (url: string) => void, initialQuery?: string) => {
    setImageSearchCallback(() => onSelect);
    setImageSearchInitialQuery(initialQuery || "");
    setIsImageSearchOpen(true);
  };

  const handleSaveEditCard = (id: string, updatedFields: Omit<Flashcard, "id" | "createdAt">) => {
    const updatedCards = aiCards.map(c => {
      if (c.id === id) {
        return {
          ...c,
          frontText: updatedFields.frontText,
          backText: updatedFields.backText,
          isArticleMode: updatedFields.isArticleMode,
          correctArticle: updatedFields.correctArticle || "",
          isPluralMode: updatedFields.isPluralMode,
          pluralText: updatedFields.pluralText || "",
          pluralLang: updatedFields.pluralLang || "de",
          translationHint: updatedFields.translationHint || "",
          difficulty: updatedFields.difficulty,
          frontImage: updatedFields.frontImage,
          frontImagePosition: updatedFields.frontImagePosition || "50% 50%"
        };
      }
      return c;
    });
    setAiCards(updatedCards);
    localStorage.setItem("ai_workspace_cards", JSON.stringify(updatedCards));
    setEditingCard(null);
  };

  const toggleCardSelection = (cardId: string) => {
    if (selectedCardIds.includes(cardId)) {
      setSelectedCardIds(selectedCardIds.filter(id => id !== cardId));
    } else {
      setSelectedCardIds([...selectedCardIds, cardId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedCardIds.length === folderCards.length) {
      setSelectedCardIds([]);
    } else {
      setSelectedCardIds(folderCards.map(c => c.id));
    }
  };

  const handleImport = () => {
    if (!activeAiFolder) return;
    const cardsToImport = folderCards
      .filter(c => selectedCardIds.includes(c.id))
      .map(c => {
        let candidates = c.autoImageCandidates;
        if (!candidates && c.id) {
          try {
            const raw = localStorage.getItem(`auto_images_${c.id}`);
            if (raw) candidates = JSON.parse(raw);
          } catch (e) {}
        }
        return {
          frontText: c.frontText,
          backText: c.backText,
          frontLang: activeAiFolder.frontLang,
          backLang: activeAiFolder.backLang,
          isArticleMode: c.isArticleMode || false,
          correctArticle: c.correctArticle || "",
          isPluralMode: c.isPluralMode || false,
          pluralText: c.pluralText || "",
          pluralLang: c.pluralLang || "de",
          translationHint: c.translationHint || "",
          difficulty: c.difficulty || "medium",
          frontImage: c.frontImage || undefined,
          frontImagePosition: c.frontImagePosition || undefined,
          autoImageCandidates: candidates,
          imageSearchQuery: c.imageSearchQuery || undefined,
          oldCardId: c.id
        };
      });

    if (cardsToImport.length === 0) {
      alert("الرجاء تحديد بطاقة واحدة على الأقل للاستيراد");
      return;
    }

    if (importTargetMode === "new") {
      const mapCodeToArabicName = (code: string): string => {
        const mapping: Record<string, string> = {
          de: "الألمانية",
          en: "الإنجليزية",
          ar: "العربية",
          es: "الإسبانية",
          fr: "الفرنسية"
        };
        return mapping[(code || "").toLowerCase()] || "الألمانية";
      };

      const folderData = {
        name: customImportName.trim() || activeAiFolder.name,
        description: activeAiFolder.description || "تم إنشاؤه بواسطة صانع البطاقات الذكي",
        color: activeAiFolder.color,
        frontLang: mapCodeToArabicName(activeAiFolder.frontLang),
        backLang: mapCodeToArabicName(activeAiFolder.backLang),
        coverImage: activeAiFolder.coverImage || undefined,
        coverImagePosition: activeAiFolder.coverImagePosition || undefined,
        parentId: parentFolderIdForNew || undefined
      };
      onImportGenerated(folderData, cardsToImport, null);
    } else {
      const targetId = selectedExistingFolderId || (folders[0]?.id || null);
      onImportGenerated(null, cardsToImport, targetId);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface text-on-surface text-right font-sans" dir="rtl">

      {/* Clean Sticky Top Header */}
      <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur-md border-b border-[#c7daf6] px-4 sm:px-6 flex items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="h-9 w-9 flex items-center justify-center text-on-surface-variant hover:text-[#004ac6] hover:bg-[#edf4ff] rounded-xl cursor-pointer transition-colors active:scale-95 shrink-0"
              title="القائمة الجانبية"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {activeAiFolderId ? (
            <button
              type="button"
              onClick={() => {
                if (onClearAiRefineFolderId) onClearAiRefineFolderId();
                setActiveAiFolderId("");
              }}
              className="h-9 px-3 rounded-xl border border-[#cdddf5] bg-[#f4f8ff] hover:bg-[#e6effe] text-xs font-bold text-on-surface transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <ChevronRight className="w-3.5 h-3.5 text-[#004ac6]" />
              <span>المساعد الذكي</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (onClearAiRefineFolderId) onClearAiRefineFolderId();
                onBackToLibrary();
              }}
              className="h-9 px-3 rounded-xl border border-[#cdddf5] bg-[#f4f8ff] hover:bg-[#e6effe] text-xs font-bold text-on-surface transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Compass className="w-3.5 h-3.5 text-[#004ac6]" />
              <span>المكتبة</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm font-black text-on-surface truncate">
            {activeAiFolder ? activeAiFolder.name : "المساعد الذكي"}
          </h1>
          <span className="w-7 h-7 rounded-lg bg-[#e8f0fe] text-[#004ac6] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* LOADING INDICATOR */}
        {loading && (
          <div className="bg-white rounded-[24px] border border-[#c7daf6] p-7 flex flex-col items-center justify-center text-center shadow-elevation-3 space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#e8f0fe] text-[#004ac6] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>

            <div className="space-y-1">
              <h4 className="font-black text-on-surface text-sm">
                جاري التوليد
              </h4>
              <p className="text-xs text-on-surface-variant font-medium">
                {loadingStatus}
              </p>
            </div>

            {(() => {
              const imgProg = parseImageProgress(loadingStatus);
              if (imgProg && imgProg.isImageRelated && imgProg.totalCards > 0) {
                return (
                  <div className="w-full space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-on-surface tabular-nums">
                      <span>{imgProg.isListFetching ? "جلب قوائم الصور" : "تنزيل الصور"}</span>
                      <span>{imgProg.currentFetched} / {imgProg.totalCards}</span>
                    </div>
                    <div className="w-full bg-[#dce8fb] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#004ac6] h-full transition-all duration-300 rounded-full"
                        style={{ width: `${imgProg.percent}%` }}
                      />
                    </div>
                    {imgProg.cooldownSec > 0 && (
                      <p className="text-[11px] text-amber-700 font-bold tabular-nums">
                        انتظار مؤقت: {imgProg.cooldownSec} ثانية
                      </p>
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* ERROR DISPLAY */}
        {error && !loading && (() => {
          const isQuotaError = error.includes("429") ||
                               error.includes("RESOURCE_EXHAUSTED") ||
                               error.toLowerCase().includes("quota") ||
                               error.toLowerCase().includes("limit") ||
                               error.toLowerCase().includes("rate") ||
                               error.includes("توقّف مؤقت") ||
                               error.includes("توقف مؤقت") ||
                               error.includes("الحد اليومي") ||
                               countdownSeconds !== null;

          const parsedLimit = parseRateLimitError(error);

          let limitName = "الحصة المؤقتة";
          if (parsedLimit?.limitType === "TPD") limitName = "الحد اليومي للتوكنات";
          else if (parsedLimit?.limitType === "RPM") limitName = "حد الطلبات بالدقيقة";
          else if (parsedLimit?.limitType === "TPM") limitName = "حد التوكنات بالدقيقة";
          else if (parsedLimit?.limitType === "RPD") limitName = "الحد اليومي للطلبات";

          if (isQuotaError) {
            return (
              <div className="bg-white border border-[#c7daf6] text-on-surface p-6 rounded-[24px] text-center space-y-4 max-w-md mx-auto shadow-elevation-3" dir="rtl">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-on-surface">تم بلوغ الحد المؤقت</h3>
                  <p className="text-xs text-on-surface-variant font-medium">
                    {limitName} — انتظر إعادة التفعيل أو بدّل المزود.
                  </p>
                </div>

                <div className="py-3 px-6 bg-[#f4f8ff] border border-[#d5e3f8] rounded-2xl inline-block">
                  <span className="text-2xl font-black font-mono tabular-nums text-on-surface">
                    {countdownSeconds !== null
                      ? formatCountdown(countdownSeconds)
                      : (parsedLimit?.resetIn ? formatArabicResetTime(parsedLimit.resetIn) : "--:--")}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleProviderChange(aiProvider === "groq" ? "gemini" : "groq");
                      setError(null);
                      setCountdownSeconds(null);
                    }}
                    className="h-10 px-4 bg-[#004ac6] hover:bg-[#003da6] text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>التبديل إلى {aiProvider === "groq" ? "Gemini" : "Groq"}</span>
                  </button>
                  <a
                    href="https://console.groq.com/settings/billing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-4 bg-[#f4f8ff] hover:bg-[#e6effe] border border-[#cdddf5] text-on-surface font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <span>الترقية</span>
                  </a>
                </div>
              </div>
            );
          }

          return (
            <div className="bg-white border border-rose-300 text-rose-800 p-4 rounded-2xl text-xs space-y-3 text-right shadow-elevation-1" dir="rtl">
              <div className="flex items-center justify-between gap-2 font-black">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>تعذر إتمام الطلب</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleProviderChange(aiProvider === "groq" ? "gemini" : "groq");
                    setError(null);
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-[11px] cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>تبديل إلى {aiProvider === "groq" ? "Gemini" : "Groq"}</span>
                </button>
              </div>
              <p className="font-mono text-[11px] break-words text-rose-900 bg-rose-50/70 p-2.5 rounded-xl border border-rose-100">{error}</p>
            </div>
          );
        })()}

        {/* MAIN VIEWS */}
        {!loading && !activeAiFolderId ? (
          /* =========================================================================
             1. HOME VIEW: Prompt box + Organized Controls + Temporary AI Folders
             ========================================================================= */
          <>
            {/* Elevated Main Generator Card */}
            <div className="bg-white rounded-[24px] border border-[#c7daf6] p-5 sm:p-6 space-y-5 shadow-elevation-3">
              {/* Zone 1: Card Header */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#e5eefb]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#e8f0fe] text-[#004ac6] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h2 className="font-black text-sm text-on-surface">توليد مجلد جديد</h2>
                </div>

                {/* Compact Provider Pill in Header */}
                <div className="flex items-center gap-1 bg-[#e6effd] p-1 rounded-xl border border-[#d0dff7]" dir="rtl">
                  <button
                    type="button"
                    onClick={() => handleProviderChange("gemini")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      aiProvider === "gemini"
                        ? "bg-white text-[#004ac6] shadow-2xs"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    Gemini
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProviderChange("groq")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      aiProvider === "groq"
                        ? "bg-white text-orange-600 shadow-2xs"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    Groq
                  </button>
                </div>
              </div>

              {/* Zone 2: Prompt Input */}
              <div className="space-y-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="مثال: أهم 15 فعلاً ألمانياً مع الترجمة..."
                  className="w-full min-h-[96px] p-3.5 bg-[#f5f9ff] border border-[#cdddf5] rounded-2xl text-xs font-semibold text-on-surface placeholder-[#627289] focus:outline-none focus:border-[#004ac6] focus:bg-white focus:ring-2 focus:ring-[#004ac6]/12 transition-all resize-y leading-relaxed"
                />

                {/* Optional YT Transcript Selector */}
                {transcripts && transcripts.length > 0 && (
                  <div className="bg-[#f4f8ff] border border-[#dbe7fa] rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#004ac6]" />
                        <span>ربط وثيقة تفريغ (اختياري)</span>
                      </label>
                      {selectedTranscriptId && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTranscriptId("");
                            if (onClearInitialSelectedTranscriptId) {
                              onClearInitialSelectedTranscriptId();
                            }
                          }}
                          className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          إلغاء الربط
                        </button>
                      )}
                    </div>

                    <select
                      value={selectedTranscriptId}
                      onChange={(e) => setSelectedTranscriptId(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-[#cdddf5] rounded-xl text-xs font-semibold text-on-surface focus:outline-none focus:border-[#004ac6] cursor-pointer"
                    >
                      <option value="">بدون وثيقة تفريغ</option>
                      {transcripts.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.segments.length} فقرة)
                        </option>
                      ))}
                    </select>

                    {selectedTranscriptId && (() => {
                      const sel = transcripts.find(t => t.id === selectedTranscriptId);
                      if (!sel) return null;
                      return (
                        <p className="text-[11px] text-on-surface-variant line-clamp-1 px-1">
                          {sel.title} · {sel.segments.map(s => s.text).join(" ")}
                        </p>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Zone 3: Quick Settings Strip (Card Count + Advanced Toggle) */}
              <div className="bg-[#f4f8ff] border border-[#dbe7fa] rounded-2xl p-3.5 space-y-3">
                {/* Card Count Row */}
                <div className="flex flex-wrap items-center justify-between gap-3" dir="rtl">
                  <span className="text-xs font-bold text-on-surface">عدد البطاقات</span>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-[#e3edfc] p-1 rounded-xl border border-[#d0dff7]" dir="rtl">
                      <button
                        type="button"
                        onClick={() => setCardsCount("auto")}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          cardsCount === "auto"
                            ? "bg-white text-[#004ac6] shadow-2xs"
                            : "text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        تلقائي
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (cardsCount === "auto") setCardsCount(10);
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          cardsCount !== "auto"
                            ? "bg-white text-[#004ac6] shadow-2xs"
                            : "text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        محدد
                      </button>
                    </div>

                    {cardsCount !== "auto" && (
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded-xl border border-[#cdddf5]">
                          <button
                            type="button"
                            onClick={() => setCardsCount(prev => typeof prev === "number" ? Math.max(1, prev - 1) : 9)}
                            className="w-7 h-7 flex items-center justify-center text-on-surface hover:bg-[#edf4ff] rounded-lg text-sm font-bold cursor-pointer transition-colors"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={cardsCount}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) {
                                setCardsCount(Math.min(Math.max(val, 1), 50));
                              } else {
                                setCardsCount(10);
                              }
                            }}
                            className="w-10 text-center text-xs font-mono font-black tabular-nums text-on-surface bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => setCardsCount(prev => typeof prev === "number" ? Math.min(50, prev + 1) : 11)}
                            className="w-7 h-7 flex items-center justify-center text-on-surface hover:bg-[#edf4ff] rounded-lg text-sm font-bold cursor-pointer transition-colors"
                          >
                            +
                          </button>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="50"
                          value={cardsCount}
                          onChange={(e) => setCardsCount(parseInt(e.target.value, 10) || 10)}
                          className="w-24 sm:w-28 h-1.5 bg-[#cdddf5] rounded-lg appearance-none cursor-pointer accent-[#004ac6]"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Advanced Options Collapsible */}
                <div className="pt-2 border-t border-[#e0ebfb]">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    className={`w-full h-10 px-3.5 rounded-xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                      showAdvancedOptions
                        ? "bg-white border-[#b5ccf2] text-[#004ac6] shadow-2xs"
                        : "bg-white/80 hover:bg-white border-[#d5e3f8] text-on-surface"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-[#004ac6]" />
                      <span>تخصيص الإعدادات</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform duration-150 ${showAdvancedOptions ? "rotate-180" : ""}`} />
                  </button>

                  {showAdvancedOptions && (
                    <div className="mt-3 pt-3 border-t border-[#e0ebfb] space-y-4 text-right">
                      {/* Saved Instruction Presets (Secondary) */}
                      <div className="bg-white border border-[#dbe7fa] rounded-xl p-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-on-surface">
                            <Bookmark className="w-3.5 h-3.5 text-[#004ac6]" />
                            <span>الوصفات المحفوظة</span>
                            {instructionPresets.length > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full bg-[#e8f0fe] text-[#004ac6] text-[10px] font-black tabular-nums">
                                {instructionPresets.length}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowSavePresetInput(!showSavePresetInput);
                              setNewPresetName("");
                            }}
                            className="text-[11px] font-bold text-[#004ac6] hover:bg-[#f4f8ff] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            {showSavePresetInput ? "إلغاء" : "+ حفظ الحالي"}
                          </button>
                        </div>

                        {showSavePresetInput && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={newPresetName}
                              onChange={(e) => setNewPresetName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSavePreset();
                                }
                              }}
                              placeholder="اسم الوصفة (مثال: ألماني بالصور)..."
                              className="flex-1 h-8 px-2.5 bg-[#f4f8ff] border border-[#cdddf5] rounded-lg text-xs font-semibold text-on-surface placeholder-[#627289] focus:outline-none focus:border-[#004ac6]"
                              dir="rtl"
                            />
                            <button
                              type="button"
                              onClick={handleSavePreset}
                              disabled={!newPresetName.trim()}
                              className="h-8 px-3 bg-[#004ac6] hover:bg-[#003ea8] disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              حفظ
                            </button>
                          </div>
                        )}

                        {instructionPresets.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {instructionPresets.map((preset) => {
                              const isApplied = activePresetId === preset.id;
                              return (
                                <div
                                  key={preset.id}
                                  className={`inline-flex items-center gap-1 rounded-lg border text-[11px] font-bold transition-colors ${
                                    isApplied
                                      ? "bg-[#e8f0fe] border-[#8bb1f5] text-[#004ac6]"
                                      : "bg-[#f4f8ff] border-[#cdddf5] text-on-surface hover:border-[#8bb1f5]"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleApplyPreset(preset)}
                                    className="px-2.5 py-1 cursor-pointer"
                                    title="تطبيق الوصفة"
                                  >
                                    {preset.name}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePreset(preset.id)}
                                    className="pl-1.5 pr-1 py-1 text-on-surface-variant hover:text-rose-600 cursor-pointer"
                                    title="حذف الوصفة"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : !showSavePresetInput && (
                          <p className="text-[11px] text-on-surface-variant">
                            احفظ إعدادات التعليمات المفضلة لتطبيقها بنقرة واحدة لاحقاً.
                          </p>
                        )}
                      </div>

                      {/* Compact Segmented Tabs */}
                      <div className="flex bg-[#e3edfc] p-1 rounded-xl gap-1 border border-[#d0dff7] overflow-x-auto scrollbar-none" dir="rtl">
                        <button
                          type="button"
                          onClick={() => setAdvancedTab("general")}
                          className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                            advancedTab === "general"
                              ? "bg-white text-[#004ac6] shadow-2xs"
                              : "text-on-surface-variant hover:text-on-surface"
                          }`}
                        >
                          المجلد والنصوص
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdvancedTab("smart")}
                          className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                            advancedTab === "smart"
                              ? "bg-white text-[#004ac6] shadow-2xs"
                              : "text-on-surface-variant hover:text-on-surface"
                          }`}
                        >
                          التلميح والصور
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdvancedTab("german")}
                          className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                            advancedTab === "german"
                              ? "bg-white text-[#004ac6] shadow-2xs"
                              : "text-on-surface-variant hover:text-on-surface"
                          }`}
                        >
                          قواعد الألمانية
                        </button>
                      </div>

                      {/* Tab 1: General Settings */}
                      {advancedTab === "general" && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-on-surface-variant block">تعليمات الوجه</label>
                              <input
                                type="text"
                                value={frontInstructions}
                                onChange={(e) => setFrontInstructions(e.target.value)}
                                placeholder="مثال: اذكر نوع الكلمة"
                                className="w-full h-9 px-3 bg-white border border-[#cdddf5] rounded-xl text-xs font-semibold text-on-surface placeholder-[#627289] focus:outline-none focus:border-[#004ac6]"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-on-surface-variant block">تعليمات الظهر</label>
                              <input
                                type="text"
                                value={backInstructions}
                                onChange={(e) => setBackInstructions(e.target.value)}
                                placeholder="مثال: ترجمة عربية مختصرة"
                                className="w-full h-9 px-3 bg-white border border-[#cdddf5] rounded-xl text-xs font-semibold text-on-surface placeholder-[#627289] focus:outline-none focus:border-[#004ac6]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#e0ebfb]">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-on-surface-variant block">اسم المجلد</label>
                              <input
                                type="text"
                                value={customFolderName}
                                onChange={(e) => setCustomFolderName(e.target.value)}
                                placeholder="تلقائي إن ترك فارغاً"
                                className="w-full h-9 px-3 bg-white border border-[#cdddf5] rounded-xl text-xs font-semibold text-on-surface placeholder-[#627289] focus:outline-none focus:border-[#004ac6]"
                                dir="rtl"
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-on-surface-variant">وصف المجلد</span>
                                <div className="flex bg-[#e3edfc] p-0.5 rounded-lg text-[11px] border border-[#d0dff7]">
                                  {(["auto", "on", "off"] as const).map((mode) => (
                                    <button
                                      key={mode}
                                      type="button"
                                      onClick={() => setFolderDescMode(mode)}
                                      className={`px-2.5 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                                        folderDescMode === mode
                                          ? "bg-white text-[#004ac6] shadow-2xs"
                                          : "text-on-surface-variant hover:text-on-surface"
                                      }`}
                                    >
                                      {mode === "auto" ? "تلقائي" : mode === "on" ? "تشغيل" : "إيقاف"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {folderDescMode !== "off" && (
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={customFolderDesc}
                                    onChange={(e) => setCustomFolderDesc(e.target.value)}
                                    placeholder="وصف يدوي"
                                    className="w-full h-9 px-2.5 bg-white border border-[#cdddf5] rounded-xl text-[11px] font-semibold text-on-surface placeholder-[#627289] focus:outline-none focus:border-[#004ac6]"
                                    dir="rtl"
                                  />
                                  <input
                                    type="text"
                                    value={folderDescCondition}
                                    onChange={(e) => setFolderDescCondition(e.target.value)}
                                    placeholder="شروط الصياغة"
                                    className="w-full h-9 px-2.5 bg-white border border-[#cdddf5] rounded-xl text-[11px] font-semibold text-on-surface placeholder-[#627289] focus:outline-none focus:border-[#004ac6]"
                                    dir="rtl"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab 2: Smart Hints & Images */}
                      {advancedTab === "smart" && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2 bg-white p-3 rounded-xl border border-[#dbe7fa]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-on-surface">التلميح</span>
                                <div className="flex bg-[#e3edfc] p-0.5 rounded-lg text-[11px] border border-[#d0dff7]">
                                  {(["auto", "on", "off"] as const).map((mode) => (
                                    <button
                                      key={mode}
                                      type="button"
                                      onClick={() => setDescriptionMode(mode)}
                                      className={`px-2.5 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                                        descriptionMode === mode
                                          ? "bg-white text-[#004ac6] shadow-2xs"
                                          : "text-on-surface-variant hover:text-on-surface"
                                      }`}
                                    >
                                      {mode === "auto" ? "تلقائي" : mode === "on" ? "تشغيل" : "إيقاف"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {descriptionMode !== "off" && (
                                <input
                                  type="text"
                                  value={descInstructions}
                                  onChange={(e) => setDescInstructions(e.target.value)}
                                  placeholder="شروط التلميح (اختياري)"
                                  className="w-full h-9 px-3 bg-[#f5f9ff] border border-[#cdddf5] rounded-xl text-[11px] font-semibold text-on-surface placeholder-[#627289] focus:outline-none focus:border-[#004ac6] focus:bg-white"
                                />
                              )}
                            </div>

                            <div className="space-y-2 bg-white p-3 rounded-xl border border-[#dbe7fa]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-on-surface">الصور</span>
                                <div className="flex bg-[#e3edfc] p-0.5 rounded-lg text-[11px] border border-[#d0dff7]">
                                  {(["auto", "on", "off"] as const).map((mode) => (
                                    <button
                                      key={mode}
                                      type="button"
                                      onClick={() => setImagesMode(mode)}
                                      className={`px-2.5 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                                        imagesMode === mode
                                          ? "bg-white text-[#004ac6] shadow-2xs"
                                          : "text-on-surface-variant hover:text-on-surface"
                                      }`}
                                    >
                                      {mode === "auto" ? "تلقائي" : mode === "on" ? "تشغيل" : "إيقاف"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {imagesMode !== "off" && (
                                <input
                                  type="text"
                                  value={imageInstructions}
                                  onChange={(e) => setImageInstructions(e.target.value)}
                                  placeholder="شروط الصور (اختياري)"
                                  className="w-full h-9 px-3 bg-[#f5f9ff] border border-[#cdddf5] rounded-xl text-[11px] font-semibold text-on-surface placeholder-[#627289] focus:outline-none focus:border-[#004ac6] focus:bg-white"
                                />
                              )}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-[#e0ebfb] space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-on-surface">خيارات الجلب والتخزين</span>
                              <button
                                type="button"
                                onClick={() => setShowImageOptionsModal(true)}
                                className="text-[11px] font-bold text-[#004ac6] hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <Sliders className="w-3 h-3" />
                                <span>نافذة الصور</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant block">التوقيت</label>
                                <select
                                  value={primaryImageTiming}
                                  onChange={(e) => {
                                    const val = e.target.value as any;
                                    setPrimaryImageTiming(val);
                                    localStorage.setItem("settings_primary_image_timing", val);
                                  }}
                                  className="w-full h-9 px-2.5 bg-white border border-[#cdddf5] rounded-xl text-[11px] font-bold text-on-surface focus:outline-none focus:border-[#004ac6]"
                                >
                                  <option value="auto_after_ai">جلب تلقائي بعد التوليد</option>
                                  <option value="manual_download">جلب يدوي لاحقاً</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant block">الصورة الأساسية</label>
                                <select
                                  value={primaryImageStorageMode}
                                  onChange={(e) => {
                                    const val = e.target.value as any;
                                    setPrimaryImageStorageMode(val);
                                    localStorage.setItem("settings_primary_image_storage", val);
                                  }}
                                  className="w-full h-9 px-2.5 bg-white border border-[#cdddf5] rounded-xl text-[11px] font-bold text-on-surface focus:outline-none focus:border-[#004ac6]"
                                >
                                  <option value="data_url">حفظ محلي (Data URL)</option>
                                  <option value="direct_url">رابط مباشر</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant block">الصور الإضافية</label>
                                <select
                                  value={secondaryImagesStorageMode}
                                  onChange={(e) => {
                                    const val = e.target.value as any;
                                    setSecondaryImagesStorageMode(val);
                                    localStorage.setItem("settings_secondary_images_storage", val);
                                  }}
                                  className="w-full h-9 px-2.5 bg-white border border-[#cdddf5] rounded-xl text-[11px] font-bold text-on-surface focus:outline-none focus:border-[#004ac6]"
                                >
                                  <option value="data_urls">تخزين مسبق (10 صور)</option>
                                  <option value="direct_urls">روابط فقط</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab 3: German Settings */}
                      {advancedTab === "german" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="flex items-center justify-between gap-2 bg-white p-3 rounded-xl border border-[#dbe7fa]">
                            <span className="text-xs font-bold text-on-surface">أدوات التعريف</span>
                            <div className="flex bg-[#e3edfc] p-0.5 rounded-lg text-[11px] border border-[#d0dff7]">
                              {(["auto", "on", "off"] as const).map((mode) => (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => setGermanArticlesMode(mode)}
                                  className={`px-2.5 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                                    germanArticlesMode === mode
                                      ? "bg-white text-[#004ac6] shadow-2xs"
                                      : "text-on-surface-variant hover:text-on-surface"
                                  }`}
                                >
                                  {mode === "auto" ? "تلقائي" : mode === "on" ? "تشغيل" : "إيقاف"}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2 bg-white p-3 rounded-xl border border-[#dbe7fa]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-on-surface">صيغة الجمع</span>
                              <div className="flex bg-[#e3edfc] p-0.5 rounded-lg text-[11px] border border-[#d0dff7]">
                                {(["auto", "on", "off"] as const).map((mode) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setGermanPluralMode(mode)}
                                    className={`px-2.5 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                                      germanPluralMode === mode
                                        ? "bg-white text-[#004ac6] shadow-2xs"
                                        : "text-on-surface-variant hover:text-on-surface"
                                    }`}
                                  >
                                    {mode === "auto" ? "تلقائي" : mode === "on" ? "تشغيل" : "إيقاف"}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {germanPluralMode !== "off" && (
                              <input
                                type="text"
                                value={germanPluralInstruction}
                                onChange={(e) => setGermanPluralInstruction(e.target.value)}
                                placeholder="شروط الجمع (اختياري)"
                                className="w-full h-9 px-3 bg-[#f5f9ff] border border-[#cdddf5] rounded-xl text-[11px] font-semibold text-on-surface placeholder-[#627289] focus:outline-none focus:border-[#004ac6] focus:bg-white"
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Zone 4: Focused Action Footer */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setExternalError(null);
                    setExternalCopySuccess(false);
                    setExternalPasteSuccess(false);
                    setExternalPasteHint(null);
                    setExternalTab("prompt");
                    setShowExternalModal(true);
                  }}
                  className="h-10 px-4 rounded-xl bg-[#f4f8ff] hover:bg-[#e6effe] border border-[#cdddf5] text-on-surface font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  title="توليد واستيراد خارجي JSON"
                >
                  <Globe className="w-3.5 h-3.5 text-[#004ac6]" />
                  <span>خارجي</span>
                </button>

                <button
                  id="generate-button-main"
                  onClick={() => handleGenerate(prompt)}
                  disabled={!prompt.trim()}
                  className="h-10 px-7 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white font-black text-xs active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm shadow-[#004ac6]/20"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>توليد</span>
                </button>
              </div>
            </div>

            {/* Temporary Folders List Section */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between flex-wrap gap-2 px-1">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-[#004ac6]" />
                  <h3 className="text-xs font-black text-on-surface">المجلدات المؤقتة</h3>
                  <span className="px-2 py-0.5 rounded-full bg-[#dce8fb] text-[#004ac6] text-[11px] font-black tabular-nums">
                    {aiFolders.length}
                  </span>
                </div>

                {aiFolders.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllAiFolders}
                      className={`h-9 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                        aiFolders.length > 0 && aiFolders.every(f => selectedAiFolderIds.includes(f.id))
                          ? "bg-[#e8f0fe] border-[#8cb4f5] text-[#004ac6]"
                          : "bg-white hover:bg-[#f4f8ff] border-[#c7daf6] text-on-surface"
                      }`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>{aiFolders.every(f => selectedAiFolderIds.includes(f.id)) ? "إلغاء الكل" : "تحديد الكل"}</span>
                    </button>

                    {selectedAiFolderIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleBulkDeleteAiFolders}
                        className="h-9 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 tabular-nums shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف ({selectedAiFolderIds.length})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {aiFolders.length === 0 ? (
                <div className="text-center py-10 px-6 bg-white/80 rounded-[24px] border border-dashed border-[#b6cef2] flex flex-col items-center justify-center">
                  <div className="w-11 h-11 rounded-2xl bg-[#e8f0fe] text-[#004ac6] flex items-center justify-center mb-2.5">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <p className="font-black text-on-surface text-xs">لا توجد مجلدات مؤقتة</p>
                  <p className="text-[11px] text-on-surface-variant mt-1">
                    اكتب الموضوع أعلاه واضغط توليد لإنشاء أول مجلد.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {aiFolders.map((f) => {
                    const cardsInFolder = aiCards.filter(c => c.folderId === f.id);
                    const isSelected = selectedAiFolderIds.includes(f.id);
                    return (
                      <div
                        key={f.id}
                        onClick={() => setActiveAiFolderId(f.id)}
                        className={`flex items-center justify-between p-3.5 bg-white border rounded-2xl transition-all cursor-pointer group shadow-elevation-1 ${
                          isSelected
                            ? "border-[#004ac6] bg-[#f2f7ff] ring-1 ring-[#004ac6]/20"
                            : "border-[#cdddf5] hover:border-[#7ca7f5] hover:shadow-elevation-3"
                        }`}
                      >
                        <div className="flex items-center gap-3 text-right min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSelectAiFolder(f.id);
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                              isSelected
                                ? "text-[#004ac6] bg-[#e3edfc]"
                                : "text-on-surface-variant/60 hover:text-on-surface hover:bg-[#f4f8ff]"
                            }`}
                            title={isSelected ? "إلغاء التحديد" : "تحديد"}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4.5 h-4.5" />
                            ) : (
                              <Square className="w-4.5 h-4.5" />
                            )}
                          </button>

                          {/* Binder thumbnail */}
                          <div className="relative w-12 h-12 shrink-0">
                            <div
                              className="absolute top-0 right-1 w-5 h-1.5 rounded-t-xs border-t border-x z-0"
                              style={{
                                backgroundColor: f.color || "#0056f6",
                                borderColor: `${f.color || "#0056f6"}40`
                              }}
                            />
                            <div
                              className="absolute bottom-0 left-0 right-0 h-[40px] rounded-b-md rounded-tl-md overflow-hidden border shadow-2xs flex items-center justify-center z-10"
                              style={{
                                backgroundColor: `${f.color || "#0056f6"}15`,
                                borderColor: f.color ? `${f.color}50` : "#cdddf5",
                                borderWidth: "1.5px"
                              }}
                            >
                              <div
                                className="absolute inset-0"
                                style={{
                                  background: `linear-gradient(135deg, ${f.color || "#0056f6"}, ${f.color ? f.color + "dd" : "#0047cc"})`
                                }}
                              />
                              <div
                                className="absolute right-0 top-0 bottom-0 w-1.5 flex flex-col justify-around py-1 items-center z-10"
                                style={{ backgroundColor: f.color || "#0056f6", filter: "brightness(0.82)" }}
                              >
                                <div className="w-0.5 h-0.5 bg-black/25 rounded-full" />
                                <div className="w-0.5 h-0.5 bg-black/25 rounded-full" />
                              </div>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <h4 className="font-bold text-on-surface text-sm group-hover:text-[#004ac6] transition-colors truncate">
                              {f.name}
                            </h4>
                            <p className="text-xs text-on-surface-variant font-medium mt-0.5 tabular-nums">
                              {cardsInFolder.length} بطاقة · {f.frontLang.toUpperCase()} ← {f.backLang.toUpperCase()}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAiFolder(f.id);
                          }}
                          className="h-9 w-9 flex items-center justify-center text-on-surface-variant/70 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
                          title="حذف المجلد"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* =========================================================================
             2. DETAILED VIEW: Organized daytime layout matching Library & Cognitive Flow
             ========================================================================= */
          activeAiFolder && (
            <div className="space-y-4 animate-fade-in">
              
              {/* Folder Cover & Summary Card */}
              <div className="bg-white border border-[#c7daf6] rounded-[24px] p-4 sm:p-5 flex items-center justify-between gap-4 relative overflow-hidden shadow-elevation-3">
                {activeAiFolder.coverImage && (
                  <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    <img
                      src={activeAiFolder.coverImage}
                      alt=""
                      className="w-full h-full object-cover opacity-[0.07]"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3.5 text-right z-10 min-w-0">
                  <div className="relative w-12 h-12 shrink-0">
                    <div
                      className="absolute top-0 right-1 w-5 h-1.5 rounded-t-xs border-t border-x z-0"
                      style={{
                        backgroundColor: activeAiFolder.color || "#0056f6",
                        borderColor: `${activeAiFolder.color || "#0056f6"}40`
                      }}
                    />
                    <div
                      className="absolute bottom-0 left-0 right-0 h-[40px] rounded-b-md rounded-tl-md overflow-hidden border shadow-2xs flex items-center justify-center z-10"
                      style={{
                        background: activeAiFolder.coverImage
                          ? `url(${activeAiFolder.coverImage}) center/cover no-repeat`
                          : `linear-gradient(135deg, ${activeAiFolder.color || "#0056f6"}, ${activeAiFolder.color ? activeAiFolder.color + "cc" : "#0047cc"})`,
                        borderColor: `${activeAiFolder.color || "#0056f6"}40`,
                        borderWidth: "1.5px"
                      }}
                    >
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1.5 flex flex-col justify-around py-1 items-center z-10"
                        style={{ backgroundColor: activeAiFolder.color || "#0056f6", filter: "brightness(0.82)" }}
                      >
                        <div className="w-0.5 h-0.5 bg-black/25 rounded-full" />
                        <div className="w-0.5 h-0.5 bg-black/25 rounded-full" />
                      </div>
                      {!activeAiFolder.coverImage && <Folder className="w-4 h-4 text-white/90 z-10" />}
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-on-surface tracking-tight truncate">
                        {activeAiFolder.name}
                      </h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        isRefiningExistingFolder
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-[#e8f0fe] text-[#004ac6] border-[#c7daf6]"
                      }`}>
                        {isRefiningExistingFolder ? "تعديل من المكتبة" : "مجلد مؤقت"}
                      </span>
                    </div>
                    {activeAiFolder.description && (
                      <p className="text-xs text-on-surface-variant font-medium truncate max-w-xl">
                        {activeAiFolder.description}
                      </p>
                    )}
                    <p className="text-xs text-on-surface-variant/85 font-semibold tabular-nums">
                      {folderCards.length} بطاقة · {activeAiFolder.frontLang.toUpperCase()} ← {activeAiFolder.backLang.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Organized Action Toolbar */}
              <div className="bg-white border border-[#c7daf6] p-2.5 rounded-[22px] flex flex-wrap items-center justify-between gap-2 z-10 shadow-elevation-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Primary Actions */}
                  <div className="flex items-center gap-1.5">
                    {reviewMode ? (
                      <button
                        onClick={() => setReviewMode(false)}
                        className="h-9 px-3.5 rounded-xl bg-on-surface hover:bg-[#162b47] text-white font-bold text-xs transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>عرض القائمة</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (folderCards.length === 0) {
                            alert("لا توجد بطاقات للمراجعة!");
                            return;
                          }
                          setReviewMode(true);
                          setCurrentReviewIndex(0);
                          setReviewFlipped(false);
                        }}
                        className="h-9 px-3.5 rounded-xl bg-[#edf4ff] hover:bg-[#dce8fb] border border-[#c7daf6] text-[#004ac6] font-bold text-xs transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1.5"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>مراجعة تفاعلية</span>
                      </button>
                    )}

                    {isRefiningExistingFolder ? (
                      <button
                        onClick={() => {
                          if (onSaveRefinedFolder && activeAiFolder) {
                            const cardsToSave = folderCards
                              .filter(c => selectedCardIds.includes(c.id))
                              .map(c => {
                                let candidates = c.autoImageCandidates;
                                if (!candidates && c.id) {
                                  try {
                                    const raw = localStorage.getItem(`auto_images_${c.id}`);
                                    if (raw) candidates = JSON.parse(raw);
                                  } catch (e) {}
                                }
                                return {
                                  id: c.id,
                                  frontText: c.frontText,
                                  backText: c.backText,
                                  frontLang: activeAiFolder.frontLang,
                                  backLang: activeAiFolder.backLang,
                                  isArticleMode: c.isArticleMode || false,
                                  correctArticle: c.correctArticle || "",
                                  isPluralMode: c.isPluralMode || false,
                                  pluralText: c.pluralText || "",
                                  pluralLang: c.pluralLang || "de",
                                  translationHint: c.translationHint || "",
                                  difficulty: c.difficulty || "medium",
                                  frontImage: c.frontImage || undefined,
                                  frontImagePosition: c.frontImagePosition || undefined,
                                  autoImageCandidates: candidates,
                                  imageSearchQuery: c.imageSearchQuery || undefined
                                };
                              });
                            onSaveRefinedFolder(activeAiFolder.id, {
                              name: activeAiFolder.name,
                              description: activeAiFolder.description,
                              color: activeAiFolder.color,
                              coverImage: activeAiFolder.coverImage,
                              coverImagePosition: activeAiFolder.coverImagePosition
                            }, cardsToSave);
                          }
                        }}
                        className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1.5 shadow-2xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>حفظ التعديلات</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowImportDialog(true)}
                        className="h-9 px-3.5 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white font-bold text-xs transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1.5 shadow-2xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>حفظ بالمكتبة</span>
                      </button>
                    )}
                  </div>

                  {!reviewMode && (
                    <>
                      <div className="hidden sm:block h-5 w-px bg-[#dbe7fa]" />

                      {/* Editing & Images */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setShowRefinePanel(!showRefinePanel)}
                          className={`h-9 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1.5 border ${
                            showRefinePanel
                              ? "bg-amber-600 border-amber-600 text-white"
                              : "bg-[#f5f9ff] border-[#cdddf5] text-on-surface hover:bg-[#e8f0fe]"
                          }`}
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>تعديل جماعي</span>
                        </button>

                        <button
                          onClick={() => setShowImageOptionsModal(true)}
                          disabled={loading}
                          className="h-9 px-3 rounded-xl bg-[#f5f9ff] border border-[#cdddf5] hover:bg-[#e8f0fe] text-on-surface font-bold text-xs transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1.5 disabled:opacity-50"
                          title="خيارات جلب وتنزيل الصور"
                        >
                          <DownloadCloud className="w-3.5 h-3.5 text-[#004ac6]" />
                          <span>الصور</span>
                        </button>
                      </div>

                      <div className="hidden sm:block h-5 w-px bg-[#dbe7fa]" />

                      {/* Next Batch Sub-Toolbar */}
                      <div className="flex items-center gap-1.5 bg-[#f2f7ff] p-1 rounded-xl border border-[#cdddf5]">
                        <div className="flex items-center bg-[#e1ebfc] p-0.5 rounded-lg text-[11px] h-7 border border-[#ccdbf6]">
                          <button
                            type="button"
                            onClick={() => {
                              setNextBatchAiProvider("gemini");
                              localStorage.setItem("settings_next_batch_ai_provider", "gemini");
                            }}
                            className={`px-2 h-full rounded-md font-bold transition-all cursor-pointer ${
                              nextBatchAiProvider === "gemini"
                                ? "bg-white text-[#004ac6] shadow-2xs"
                                : "text-on-surface-variant hover:text-on-surface"
                            }`}
                          >
                            Gemini
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNextBatchAiProvider("groq");
                              localStorage.setItem("settings_next_batch_ai_provider", "groq");
                            }}
                            className={`px-2 h-full rounded-md font-bold transition-all cursor-pointer ${
                              nextBatchAiProvider === "groq"
                                ? "bg-white text-orange-600 shadow-2xs"
                                : "text-on-surface-variant hover:text-on-surface"
                            }`}
                          >
                            Groq
                          </button>
                        </div>

                        <button
                          onClick={() => setShowNextBatchDirection(!showNextBatchDirection)}
                          className={`h-7 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                            showNextBatchDirection
                              ? "bg-emerald-600 text-white"
                              : "text-on-surface hover:bg-white"
                          }`}
                          title="توليد وجبة بتوجيه مخصص"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>مخصص</span>
                        </button>

                        {!showNextBatchDirection && (
                          <button
                            onClick={handleGenerateNextBatch}
                            disabled={loading}
                            className="h-7 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1 disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>وجبة إضافية</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteAiFolder(activeAiFolder.id)}
                  className="h-9 w-9 rounded-xl bg-[#f5f9ff] border border-[#cdddf5] text-on-surface-variant hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                  title="حذف المجلد"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Next Batch Custom Direction Input Panel */}
              {showNextBatchDirection && (
                <div className="bg-white border border-[#c7daf6] rounded-[24px] p-5 space-y-3.5 text-right shadow-elevation-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-on-surface flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>توجيه الوجبة الإضافية</span>
                    </span>
                    <button
                      onClick={() => {
                        setShowNextBatchDirection(false);
                        setNextBatchDirection("");
                      }}
                      className="text-on-surface-variant hover:text-on-surface font-bold text-xs cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={nextBatchDirection}
                      onChange={(e) => setNextBatchDirection(e.target.value)}
                      placeholder="مثال: مصطلحات المطعم، الأفعال الأكثر استخداماً..."
                      className="flex-1 h-10 text-xs px-3.5 rounded-xl border border-[#cdddf5] bg-[#f5f9ff] text-on-surface placeholder-[#627289] outline-none focus:border-[#004ac6] focus:bg-white font-semibold text-right"
                      dir="rtl"
                    />
                    <button
                      onClick={handleGenerateNextBatch}
                      disabled={loading}
                      className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>توليد</span>
                    </button>
                  </div>
                </div>
              )}

              {/* AI BATCH CARD REFINEMENT PANEL */}
              {showRefinePanel && (
                <div className="bg-white border border-[#c7daf6] rounded-[24px] p-5 space-y-4 text-right shadow-elevation-3">
                  <div className="flex items-center justify-between border-b border-[#e5eefb] pb-3">
                    <h4 className="text-sm font-black text-on-surface flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-amber-600" />
                      <span>تعديل جماعي للبطاقات</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowRefinePanel(false)}
                      className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-on-surface rounded-xl hover:bg-[#edf4ff] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-[#f4f8ff] border border-[#dbe7fa] px-3.5 py-2.5 rounded-xl">
                    <span className="text-xs font-bold text-on-surface">المزود:</span>
                    <div className="flex bg-[#e3edfc] p-0.5 rounded-lg text-xs h-8 border border-[#d0dff7]">
                      <button
                        type="button"
                        onClick={() => {
                          setRefineAiProvider("gemini");
                          localStorage.setItem("settings_refine_ai_provider", "gemini");
                        }}
                        className={`px-3 rounded-md font-bold transition-all h-full flex items-center cursor-pointer ${
                          refineAiProvider === "gemini"
                            ? "bg-white text-[#004ac6] shadow-2xs"
                            : "text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        Gemini
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRefineAiProvider("groq");
                          localStorage.setItem("settings_refine_ai_provider", "groq");
                        }}
                        className={`px-3 rounded-md font-bold transition-all h-full flex items-center cursor-pointer ${
                          refineAiProvider === "groq"
                            ? "bg-white text-orange-600 shadow-2xs"
                            : "text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        Groq
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* 1. Description/Hint Modification */}
                    <div className={`p-3.5 rounded-2xl border transition-colors ${refineModifyDescription ? "bg-amber-50/60 border-amber-300" : "bg-[#f4f8ff] border-[#dbe7fa]"}`}>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={refineModifyDescription}
                          onChange={(e) => setRefineModifyDescription(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-[#a9bedb] cursor-pointer"
                        />
                        <span className="font-bold text-xs text-on-surface">تعديل التلميح والوصف</span>
                      </label>

                      {refineModifyDescription && (
                        <div className="mt-3 space-y-2.5">
                          <input
                            type="text"
                            value={refineDescriptionIssue}
                            onChange={(e) => setRefineDescriptionIssue(e.target.value)}
                            placeholder="المشكلة السابقة (اختياري)..."
                            className="w-full h-9 px-3 bg-white border border-[#cdddf5] rounded-xl text-xs font-medium text-on-surface placeholder-[#627289] outline-none focus:border-amber-500"
                          />
                          <textarea
                            value={refineDescriptionInstruction}
                            onChange={(e) => setRefineDescriptionInstruction(e.target.value)}
                            placeholder="التوجيه الجديد (إجباري)..."
                            className="w-full min-h-[60px] px-3 py-2 bg-white border border-[#cdddf5] rounded-xl text-xs font-medium text-on-surface placeholder-[#627289] outline-none resize-none focus:border-amber-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* 2. Image Style Modification */}
                    <div className={`p-3.5 rounded-2xl border transition-colors ${refineModifyImages ? "bg-amber-50/60 border-amber-300" : "bg-[#f4f8ff] border-[#dbe7fa]"}`}>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={refineModifyImages}
                          onChange={(e) => setRefineModifyImages(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-[#a9bedb] cursor-pointer"
                        />
                        <span className="font-bold text-xs text-on-surface">تغيير نمط الصور</span>
                      </label>

                      {refineModifyImages && (
                        <div className="mt-3">
                          <textarea
                            value={refineImageInstruction}
                            onChange={(e) => setRefineImageInstruction(e.target.value)}
                            placeholder="مثال: رسومات مسطحة، صور واقعية، كرتون 3D..."
                            className="w-full min-h-[92px] px-3 py-2 bg-white border border-[#cdddf5] rounded-xl text-xs font-medium text-on-surface placeholder-[#627289] outline-none resize-none focus:border-amber-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* 3. Front Text Modification */}
                    <div className={`p-3.5 rounded-2xl border transition-colors ${refineModifyFrontText ? "bg-amber-50/60 border-amber-300" : "bg-[#f4f8ff] border-[#dbe7fa]"}`}>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={refineModifyFrontText}
                          onChange={(e) => setRefineModifyFrontText(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-[#a9bedb] cursor-pointer"
                        />
                        <span className="font-bold text-xs text-on-surface">تعديل النص الأمامي</span>
                      </label>

                      {refineModifyFrontText && (
                        <div className="mt-3">
                          <textarea
                            value={refineFrontTextInstruction}
                            onChange={(e) => setRefineFrontTextInstruction(e.target.value)}
                            placeholder="توجيهات تعديل الوجه الأمامي..."
                            className="w-full min-h-[72px] px-3 py-2 bg-white border border-[#cdddf5] rounded-xl text-xs font-medium text-on-surface placeholder-[#627289] outline-none resize-none focus:border-amber-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* 4. Back Text/Translation Modification */}
                    <div className={`p-3.5 rounded-2xl border transition-colors ${refineModifyBackText ? "bg-amber-50/60 border-amber-300" : "bg-[#f4f8ff] border-[#dbe7fa]"}`}>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={refineModifyBackText}
                          onChange={(e) => setRefineModifyBackText(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-[#a9bedb] cursor-pointer"
                        />
                        <span className="font-bold text-xs text-on-surface">تعديل الترجمة (الظهر)</span>
                      </label>

                      {refineModifyBackText && (
                        <div className="mt-3">
                          <textarea
                            value={refineBackTextInstruction}
                            onChange={(e) => setRefineBackTextInstruction(e.target.value)}
                            placeholder="توجيهات صياغة الترجمة..."
                            className="w-full min-h-[72px] px-3 py-2 bg-white border border-[#cdddf5] rounded-xl text-xs font-medium text-on-surface placeholder-[#627289] outline-none resize-none focus:border-amber-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* 5. German Articles Recommendation */}
                    <div className={`p-3.5 rounded-2xl border transition-colors ${refineGermanArticlesMode !== "keep" ? "bg-amber-50/60 border-amber-300" : "bg-[#f4f8ff] border-[#dbe7fa]"}`}>
                      <span className="font-bold text-xs text-on-surface block mb-2.5">أدوات التعريف الألمانية</span>
                      <div className="flex bg-[#e3edfc] rounded-xl p-0.5 text-[11px] border border-[#d0dff7]">
                        {[
                          { val: "keep", label: "إبقاء" },
                          { val: "on", label: "تشغيل" },
                          { val: "off", label: "إيقاف" },
                          { val: "auto", label: "تلقائي" },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setRefineGermanArticlesMode(opt.val as any)}
                            className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                              refineGermanArticlesMode === opt.val
                                ? "bg-white text-[#004ac6] shadow-2xs"
                                : "text-on-surface-variant hover:text-on-surface"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 6. German Plural Recommendation */}
                    <div className={`p-3.5 rounded-2xl border transition-colors ${refineGermanPluralMode !== "keep" ? "bg-amber-50/60 border-amber-300" : "bg-[#f4f8ff] border-[#dbe7fa]"}`}>
                      <span className="font-bold text-xs text-on-surface block mb-2.5">صيغة الجمع الألمانية</span>
                      <div className="flex bg-[#e3edfc] rounded-xl p-0.5 text-[11px] border border-[#d0dff7]">
                        {[
                          { val: "keep", label: "إبقاء" },
                          { val: "on", label: "تشغيل" },
                          { val: "off", label: "إيقاف" },
                          { val: "auto", label: "تلقائي" },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setRefineGermanPluralMode(opt.val as any)}
                            className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                              refineGermanPluralMode === opt.val
                                ? "bg-white text-[#004ac6] shadow-2xs"
                                : "text-on-surface-variant hover:text-on-surface"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {refineGermanPluralMode !== "keep" && (
                        <textarea
                          value={refineGermanPluralInstruction}
                          onChange={(e) => setRefineGermanPluralInstruction(e.target.value)}
                          placeholder="تعليمات صيغة الجمع (اختياري)..."
                          className="w-full min-h-[60px] mt-2.5 px-3 py-2 bg-white border border-[#cdddf5] rounded-xl text-xs font-medium text-on-surface placeholder-[#627289] outline-none resize-none focus:border-amber-500"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-3 border-t border-[#e5eefb]">
                    <button
                      type="button"
                      onClick={() => setShowRefinePanel(false)}
                      className="h-9 px-4 rounded-xl border border-[#cdddf5] text-on-surface bg-[#f4f8ff] hover:bg-[#e6effe] text-xs font-bold transition-colors cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleRefineCards}
                      disabled={loading}
                      className="h-9 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تطبيق التعديل</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Compact Saved Prompt Bar */}
              <div className="bg-white/95 border border-[#c7daf6] rounded-2xl p-3.5 space-y-2.5 shadow-elevation-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-[#004ac6] shrink-0" />
                    <span className="text-xs font-bold text-on-surface-variant shrink-0">البرومبت:</span>
                    <p className="text-xs font-bold text-on-surface truncate">
                      {activeAiFolder.prompt}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setPrompt(activeAiFolder.prompt);
                      setFrontInstructions(activeAiFolder.frontInstructions || "");
                      setBackInstructions(activeAiFolder.backInstructions || "");
                      setDescInstructions(activeAiFolder.descInstructions || "");
                      setImageInstructions(activeAiFolder.imageInstructions || "");
                      setGermanPluralInstruction(activeAiFolder.germanPluralInstruction || "");
                      if (
                        activeAiFolder.frontInstructions ||
                        activeAiFolder.backInstructions ||
                        activeAiFolder.descInstructions ||
                        activeAiFolder.imageInstructions ||
                        activeAiFolder.germanPluralInstruction
                      ) {
                        setShowAdvancedOptions(true);
                      } else {
                        setShowAdvancedOptions(false);
                      }
                      setActiveAiFolderId("");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="shrink-0 h-8 px-3 bg-[#e8f0fe] hover:bg-[#d7e6fd] text-[#004ac6] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>إعادة استخدام</span>
                  </button>
                </div>

                {(activeAiFolder.frontInstructions || activeAiFolder.backInstructions || activeAiFolder.descInstructions || activeAiFolder.imageInstructions || activeAiFolder.germanPluralInstruction) && (
                  <details className="group pt-2 border-t border-[#e5eefb]">
                    <summary className="text-[11px] font-bold text-on-surface-variant hover:text-on-surface cursor-pointer flex items-center justify-between select-none">
                      <span>عرض التعليمات المرفقة</span>
                      <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2.5">
                      {activeAiFolder.frontInstructions && (
                        <div className="bg-[#f4f8ff] border border-[#dbe7fa] p-2.5 rounded-xl text-right">
                          <span className="text-[10px] font-bold text-on-surface-variant block mb-0.5">الوجه الأمامي</span>
                          <p className="text-[11px] text-on-surface font-medium">{activeAiFolder.frontInstructions}</p>
                        </div>
                      )}
                      {activeAiFolder.backInstructions && (
                        <div className="bg-[#f4f8ff] border border-[#dbe7fa] p-2.5 rounded-xl text-right">
                          <span className="text-[10px] font-bold text-on-surface-variant block mb-0.5">الوجه الخلفي</span>
                          <p className="text-[11px] text-on-surface font-medium">{activeAiFolder.backInstructions}</p>
                        </div>
                      )}
                      {activeAiFolder.descInstructions && (
                        <div className="bg-[#f4f8ff] border border-[#dbe7fa] p-2.5 rounded-xl text-right">
                          <span className="text-[10px] font-bold text-on-surface-variant block mb-0.5">التلميح والوصف</span>
                          <p className="text-[11px] text-on-surface font-medium">{activeAiFolder.descInstructions}</p>
                        </div>
                      )}
                      {activeAiFolder.imageInstructions && (
                        <div className="bg-[#f4f8ff] border border-[#dbe7fa] p-2.5 rounded-xl text-right">
                          <span className="text-[10px] font-bold text-on-surface-variant block mb-0.5">بحث الصور</span>
                          <p className="text-[11px] text-on-surface font-medium">{activeAiFolder.imageInstructions}</p>
                        </div>
                      )}
                      {activeAiFolder.germanPluralInstruction && (
                        <div className="bg-[#f4f8ff] border border-[#dbe7fa] p-2.5 rounded-xl text-right">
                          <span className="text-[10px] font-bold text-fuchsia-700 block mb-0.5">صيغة الجمع</span>
                          <p className="text-[11px] text-on-surface font-medium">{activeAiFolder.germanPluralInstruction}</p>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>

              {/* Import Configuration Panel */}
              {showImportDialog && (
                <div className="bg-white border border-[#8cb4f5] rounded-[24px] p-5 space-y-4 text-right shadow-elevation-3">
                  <div className="flex items-center justify-between border-b border-[#e5eefb] pb-3">
                    <h4 className="text-sm font-black text-on-surface flex items-center gap-2">
                      <Save className="w-4 h-4 text-[#004ac6]" />
                      <span>الحفظ في المكتبة</span>
                    </h4>
                    <button
                      onClick={() => setShowImportDialog(false)}
                      className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-on-surface rounded-xl hover:bg-[#edf4ff] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-on-surface-variant block">الوجهة</span>
                      <div className="flex gap-1 bg-[#e3edfc] p-1 rounded-xl border border-[#d0dff7]">
                        <button
                          onClick={() => setImportTargetMode("new")}
                          className={`flex-1 h-9 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            importTargetMode === "new"
                              ? "bg-white text-[#004ac6] shadow-2xs"
                              : "text-on-surface-variant hover:text-on-surface"
                          }`}
                        >
                          مجلد جديد
                        </button>
                        <button
                          onClick={() => setImportTargetMode("existing")}
                          className={`flex-1 h-9 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            importTargetMode === "existing"
                              ? "bg-white text-[#004ac6] shadow-2xs"
                              : "text-on-surface-variant hover:text-on-surface"
                          }`}
                        >
                          مجلد موجود
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {importTargetMode === "new" ? (
                        <>
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-on-surface-variant block">اسم المجلد</span>
                            <input
                              type="text"
                              value={customImportName}
                              onChange={(e) => setCustomImportName(e.target.value)}
                              className="w-full h-9 px-3 bg-[#f5f9ff] border border-[#cdddf5] rounded-xl text-xs font-bold text-on-surface placeholder-[#627289] outline-none focus:border-[#004ac6] focus:bg-white"
                              placeholder="اسم المجلد..."
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-xs font-bold text-on-surface-variant block">المجلد الأب (اختياري)</span>
                            <select
                              value={parentFolderIdForNew}
                              onChange={(e) => setParentFolderIdForNew(e.target.value)}
                              className="w-full h-9 px-3 bg-[#f5f9ff] border border-[#cdddf5] rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:border-[#004ac6] focus:bg-white"
                            >
                              <option value="">الجذر الرئيسي</option>
                              {folders.map((f) => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-on-surface-variant block">المجلد المستهدف</span>
                          <select
                            value={selectedExistingFolderId}
                            onChange={(e) => setSelectedExistingFolderId(e.target.value)}
                            className="w-full h-9 px-3 bg-[#f5f9ff] border border-[#cdddf5] rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:border-[#004ac6] focus:bg-white"
                          >
                            {folders.map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-[#e5eefb] pt-3 flex justify-end">
                    <button
                      onClick={handleImport}
                      className="h-10 px-5 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white font-black text-xs transition-all cursor-pointer active:scale-[0.98] flex items-center gap-2 tabular-nums shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>حفظ المحدد ({selectedCardIds.length})</span>
                    </button>
                  </div>
                </div>
              )}

              {reviewMode && folderCards.length > 0 ? (
                /* Interactive Review Mode */
                <div className="bg-white rounded-[24px] border border-[#c7daf6] p-5 sm:p-6 space-y-5 text-right shadow-elevation-3">
                  <div className="flex items-center justify-between border-b border-[#e5eefb] pb-3.5">
                    <h4 className="font-bold text-xs text-on-surface flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#004ac6]" />
                      <span>مراجعة البطاقات</span>
                    </h4>
                    <span className="text-xs font-mono font-bold text-on-surface-variant tabular-nums">
                      {currentReviewIndex + 1} / {folderCards.length}
                    </span>
                  </div>

                  <div className="w-full bg-[#e3edfc] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${((currentReviewIndex + 1) / folderCards.length) * 100}%`,
                        backgroundColor: activeAiFolder.color || "#004ac6"
                      }}
                    />
                  </div>

                  {(() => {
                    const card = folderCards[currentReviewIndex];
                    if (!card) return null;
                    return (
                      <div className="space-y-4">
                        <div className="relative w-full max-w-[356px] h-[466px] mx-auto select-none overflow-hidden rounded-[24px]">
                          <AnimatePresence initial={false} custom={reviewDirection} mode="popLayout">
                            <motion.div
                              key={card.id}
                              custom={reviewDirection}
                              variants={{
                                enter: (dir: number) => ({
                                  x: dir > 0 ? -300 : 300,
                                  rotate: dir > 0 ? -8 : 8,
                                  opacity: 0,
                                  scale: 0.95,
                                }),
                                center: {
                                  x: 0,
                                  rotate: 0,
                                  opacity: 1,
                                  scale: 1,
                                  zIndex: 10,
                                  transition: {
                                    duration: 0.24,
                                    ease: [0.16, 1, 0.3, 1],
                                  }
                                },
                                exit: (dir: number) => ({
                                  x: dir > 0 ? 300 : -300,
                                  rotate: dir > 0 ? 8 : -8,
                                  opacity: 0,
                                  scale: 0.95,
                                  zIndex: 0,
                                  transition: {
                                    duration: 0.2,
                                    ease: [0.16, 1, 0.3, 1],
                                  }
                                })
                              }}
                              initial="enter"
                              animate="center"
                              exit="exit"
                              className="absolute inset-2"
                            >
                              <BrowseCard
                                card={adaptAICardToFlashcard(card)}
                                globalFlipped={reviewFlipped}
                                onFlipToggle={() => setReviewFlipped(!reviewFlipped)}
                                hideFront={false}
                                hideBack={false}
                                frontLang={activeAiFolder?.frontLang || "en"}
                                backLang={activeAiFolder?.backLang || "ar"}
                                onDiscard={() => {
                                  handleReviewDelete(card.id);
                                }}
                                onKeep={() => {
                                  if (!selectedCardIds.includes(card.id)) {
                                    setSelectedCardIds([...selectedCardIds, card.id]);
                                  }
                                  if (currentReviewIndex < folderCards.length - 1) {
                                    handleReviewNext();
                                  } else {
                                    alert("اكتملت مراجعة جميع البطاقات.");
                                    setReviewMode(false);
                                  }
                                }}
                                onEdit={() => {
                                  setEditingCard(card);
                                }}
                                onImageError={(failedUrl) => handleHealAiCardImage(card.id, failedUrl)}
                              />
                            </motion.div>
                          </AnimatePresence>
                        </div>

                        <div className="w-full max-w-[356px] mx-auto">
                          <div className="flex items-center justify-between bg-[#f4f8ff] border border-[#cdddf5] rounded-2xl p-1.5">
                            <button
                              type="button"
                              onClick={handleReviewPrev}
                              disabled={currentReviewIndex === 0}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-on-surface hover:bg-white disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
                            >
                              <ChevronRight className="w-4 h-4" />
                              <span>السابقة</span>
                            </button>

                            <span className="font-mono text-xs font-bold text-on-surface tabular-nums select-none">
                              {currentReviewIndex + 1} / {folderCards.length}
                            </span>

                            <button
                              type="button"
                              onClick={handleReviewNext}
                              disabled={currentReviewIndex === folderCards.length - 1}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-on-surface hover:bg-white disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
                            >
                              <span>التالية</span>
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Cards Listing Section */
                <div className="space-y-3 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-[#004ac6]" />
                      <span className="text-xs font-black text-on-surface">البطاقات</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#dce8fb] text-[#004ac6] text-[11px] font-black tabular-nums">
                        {folderCards.length}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickAddCard(!showQuickAddCard);
                          setQuickAddError(null);
                        }}
                        className={`h-8 px-3 border rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs ${
                          showQuickAddCard
                            ? "bg-[#e8f0fe] border-[#8bb1f5] text-[#004ac6]"
                            : "bg-white hover:bg-[#f4f8ff] text-on-surface-variant hover:text-[#004ac6] border-[#c7daf6]"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>بطاقة سريعة</span>
                      </button>

                      <button
                        onClick={handleFetchImagesForFolderCards}
                        disabled={loading || folderCards.length === 0}
                        className="h-8 px-3 bg-white hover:bg-[#f4f8ff] text-emerald-700 border border-[#c7daf6] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 shadow-2xs"
                      >
                        <DownloadCloud className="w-3.5 h-3.5" />
                        <span>جلب الصور ({folderCards.length})</span>
                      </button>

                      <button
                        onClick={handleSelectAll}
                        className="h-8 px-3 bg-white hover:bg-[#f4f8ff] text-[#004ac6] border border-[#c7daf6] rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                      >
                        {selectedCardIds.length === folderCards.length ? "إلغاء الكل" : "تحديد الكل"}
                      </button>

                      {selectedCardIds.length > 0 ? (
                        <button
                          onClick={handleDeleteSelectedCards}
                          className="h-8 px-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-100 flex items-center gap-1 cursor-pointer tabular-nums shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف ({selectedCardIds.length})</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleDeleteAllFolderCards}
                          className="h-8 px-3 rounded-xl bg-white border border-[#c7daf6] text-xs font-bold text-on-surface-variant hover:text-rose-600 hover:border-rose-200 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف الكل</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Single-Card Add Inline Bar (Secondary) */}
                  {showQuickAddCard && (
                    <div className="bg-white border border-[#c7daf6] rounded-2xl p-2.5 shadow-elevation-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={quickAddInput}
                          onChange={(e) => {
                            setQuickAddInput(e.target.value);
                            if (quickAddError) setQuickAddError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleQuickAddSingleCard();
                            }
                          }}
                          placeholder="اكتب كلمة أو مفهوماً لإضافة بطاقة واحدة..."
                          disabled={quickAddLoading}
                          dir="auto"
                          className="flex-1 h-9 px-3 bg-[#f4f8ff] border border-[#cdddf5] rounded-xl text-xs font-semibold text-on-surface placeholder-[#627289] focus:outline-none focus:border-[#004ac6] disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={handleQuickAddSingleCard}
                          disabled={quickAddLoading || !quickAddInput.trim()}
                          className="h-9 px-3.5 bg-[#004ac6] hover:bg-[#003ea8] disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        >
                          {quickAddLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>جاري الإضافة</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>إضافة</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowQuickAddCard(false);
                            setQuickAddError(null);
                          }}
                          className="h-9 w-9 flex items-center justify-center rounded-xl border border-[#cdddf5] text-on-surface-variant hover:text-on-surface hover:bg-[#f4f8ff] transition-colors cursor-pointer shrink-0"
                          title="إغلاق"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {quickAddError && (
                        <p className="text-[11px] font-bold text-rose-600 px-1">{quickAddError}</p>
                      )}
                    </div>
                  )}

                  {/* Secondary Filter & Search Strip for Open Folder */}
                  {folderCards.length > 0 && (
                    <div className="bg-white/85 border border-[#cdddf5] rounded-xl p-1.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="relative flex-1 min-w-[160px]">
                        <Search className="w-3.5 h-3.5 text-on-surface-variant absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={cardSearchQuery}
                          onChange={(e) => setCardSearchQuery(e.target.value)}
                          placeholder="بحث في البطاقات..."
                          dir="auto"
                          className="w-full h-8 pr-8 pl-7 bg-[#f4f8ff] border border-[#dbe7fa] rounded-lg text-xs font-semibold text-on-surface placeholder-[#627289] focus:outline-none focus:border-[#004ac6]"
                        />
                        {cardSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setCardSearchQuery("")}
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface cursor-pointer"
                            title="مسح البحث"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {(
                          [
                            { id: "all", label: "الكل" },
                            { id: "no_image", label: "بدون صورة" },
                            { id: "has_article", label: "بأداة" }
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setCardFilterMode(tab.id)}
                            className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                              cardFilterMode === tab.id
                                ? "bg-[#e8f0fe] text-[#004ac6]"
                                : "text-on-surface-variant hover:bg-[#f4f8ff] hover:text-on-surface"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cards List */}
                  <div className="flex flex-col gap-2.5">
                    {filteredFolderCards.length === 0 && folderCards.length > 0 ? (
                      <div className="bg-white border border-[#cdddf5] rounded-2xl p-6 text-center space-y-2">
                        <p className="text-xs font-bold text-on-surface-variant">
                          لا توجد بطاقات مطابقة للتصفية الحالية
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setCardFilterMode("all");
                            setCardSearchQuery("");
                          }}
                          className="h-8 px-3 bg-[#e8f0fe] hover:bg-[#dce8fb] text-[#004ac6] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          عرض جميع البطاقات
                        </button>
                      </div>
                    ) : (
                    filteredFolderCards.map((card) => {
                      const isSelected = selectedCardIds.includes(card.id);
                      const cardColor = activeAiFolder.color || "#0056f6";
                      return (
                        <div
                          key={card.id}
                          onClick={() => toggleCardSelection(card.id)}
                          className={`flex items-center justify-between p-3.5 bg-white border rounded-2xl transition-all group cursor-pointer shadow-elevation-1 ${
                            isSelected
                              ? "border-[#004ac6] bg-[#f2f7ff] ring-1 ring-[#004ac6]/20"
                              : "border-[#cdddf5] hover:border-[#7ca7f5] hover:shadow-elevation-3"
                          }`}
                        >
                          {/* Right side: Checkbox + Card Stack Icon + Details */}
                          <div className="flex items-center gap-3.5 text-right min-w-0">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCardSelection(card.id);
                              }}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                                isSelected
                                  ? "bg-[#004ac6] border-[#004ac6] text-white"
                                  : "border-[#a9bedb] hover:border-[#004ac6] bg-white"
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                            </div>

                            {/* Card Thumbnail Stack */}
                            <div className="relative w-13 h-13 shrink-0">
                              <div
                                className="absolute top-1 right-1 w-[42px] h-[42px] rounded-xs border bg-white/80 shadow-2xs"
                                style={{
                                  borderColor: `${cardColor}20`,
                                  transform: "rotate(-6deg)"
                                }}
                              />
                              <div
                                className="absolute top-1 right-1 w-[42px] h-[42px] rounded-xs border bg-white/95 shadow-2xs"
                                style={{
                                  borderColor: `${cardColor}25`,
                                  transform: "rotate(4deg)"
                                }}
                              />
                              <div
                                className="absolute bottom-0.5 left-0.5 w-[44px] h-[44px] rounded-sm overflow-hidden border shadow-2xs flex items-center justify-center z-10"
                                style={{
                                  backgroundColor: card.frontImage ? "#ffffff" : `${cardColor}10`,
                                  borderColor: card.frontImage ? "rgba(192, 132, 252, 0.4)" : `${cardColor}30`,
                                  borderWidth: "1.5px"
                                }}
                              >
                                {card.frontImage ? (
                                  <>
                                    <ImageWithSkeleton
                                      src={card.frontImage}
                                      alt=""
                                      className="absolute inset-0 w-full h-full object-cover opacity-95 transition-all"
                                      style={getSafeImageStyle(card.frontImagePosition)}
                                      referrerPolicy="no-referrer"
                                      onError={(failedUrl) => handleHealAiCardImage(card.id, failedUrl)}
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/10 via-black/5 to-transparent pointer-events-none z-10" />
                                    <div
                                      className="absolute left-1 bottom-1 bg-white/95 p-0.5 rounded-xs z-20 border border-slate-100 flex items-center justify-center"
                                      style={{
                                        borderColor: "#c084fc30",
                                        boxShadow: "0 2px 5px rgba(0,0,0,0.18), 0 0 3px rgba(255,255,255,0.7)"
                                      }}
                                    >
                                      <RectangleVertical className="w-2.5 h-2.5 text-purple-600 fill-purple-600/10" />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="absolute inset-0 bg-white flex flex-col justify-center gap-1 p-1 px-1.5 overflow-hidden">
                                      <div className="h-0.5 w-[85%] bg-slate-100 rounded-full" />
                                      <div className="h-0.5 w-[70%] bg-slate-100 rounded-full" />
                                      <div className="h-0.5 w-[80%] bg-slate-100 rounded-full" />
                                      <div className="absolute right-2 top-0 bottom-0 w-[1px] bg-rose-200" />
                                    </div>
                                    <div
                                      className="absolute left-1 bottom-1 bg-white p-0.5 rounded-xs z-10 border shadow-xs flex items-center justify-center"
                                      style={{ borderColor: "#c084fc30" }}
                                    >
                                      <RectangleVertical className="w-2.5 h-2.5 text-purple-600 fill-purple-600/10" />
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Card text */}
                            {(() => {
                              const sanitized = sanitizeCardArticleAndSentence(card);
                              const isSentence = isGermanSentence(card.frontText || "");
                              return (
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {!isSentence && sanitized.correctArticle && (
                                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/70 uppercase shrink-0">
                                        {sanitized.correctArticle === "die-plural" ? "die" : sanitized.correctArticle}
                                      </span>
                                    )}
                                    <h4 className="font-bold text-on-surface text-sm sm:text-base group-hover:text-[#004ac6] transition-colors whitespace-pre-wrap" dir="ltr">
                                      {sanitized.frontText}
                                    </h4>
                                  </div>
                                  {cardPluralToggle[card.id] && card.pluralText ? (
                                    <p className="text-xs text-fuchsia-700 font-bold mt-1 whitespace-pre-wrap" dir="ltr">
                                      {card.pluralText}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-on-surface-variant font-medium mt-1 whitespace-pre-wrap">
                                      {card.backText} {card.translationHint ? `· ${card.translationHint}` : ""}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 z-10 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {card.isPluralMode && card.pluralText && (
                              <button
                                onClick={() => {
                                  const nextShowPlural = !cardPluralToggle[card.id];
                                  setCardPluralToggle(prev => ({
                                    ...prev,
                                    [card.id]: nextShowPlural
                                  }));
                                  if (nextShowPlural) {
                                    speakClient(card.pluralText || "", card.pluralLang || "de");
                                  } else {
                                    speakClient(card.frontText, activeAiFolder.frontLang);
                                  }
                                }}
                                className={`h-8 w-8 flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                                  cardPluralToggle[card.id]
                                    ? "text-fuchsia-700 bg-fuchsia-50"
                                    : "text-on-surface-variant hover:text-fuchsia-700 hover:bg-[#edf4ff]"
                                }`}
                                title={cardPluralToggle[card.id] ? "الترجمة الأصلية" : "صيغة الجمع"}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFetchImageForSingleCard(card.id);
                              }}
                              disabled={loading}
                              className="h-8 w-8 flex items-center justify-center text-on-surface-variant hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                              title="جلب صورة للبطاقة"
                            >
                              <Image className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => speakClient(cardPluralToggle[card.id] && card.pluralText ? card.pluralText : card.frontText, activeAiFolder.frontLang)}
                              className="h-8 w-8 flex items-center justify-center text-on-surface-variant hover:text-[#004ac6] hover:bg-[#edf4ff] rounded-xl transition-colors cursor-pointer"
                              title="استماع"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setEditingCard(card)}
                              className="h-8 w-8 flex items-center justify-center text-on-surface-variant hover:text-[#004ac6] hover:bg-[#edf4ff] rounded-xl transition-colors cursor-pointer"
                              title="تعديل"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteAiCard(card.id)}
                              className="h-8 w-8 flex items-center justify-center text-on-surface-variant hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    }))}
                  </div>
                </div>
              )}

            </div>
          )
        )}
        {/* =========================================================================
            Collapsed Telemetry & Quotas Drawer (السجل والحصص)
           ========================================================================= */}
        <div className="bg-white/95 rounded-2xl border border-[#c7daf6] overflow-hidden text-right shadow-elevation-1" dir="rtl">
          <button
            type="button"
            onClick={() => setShowTelemetryDrawer(!showTelemetryDrawer)}
            className="w-full h-12 px-4 flex items-center justify-between gap-3 hover:bg-[#f4f8ff] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Cpu className="w-4 h-4 text-[#004ac6] shrink-0" />
              <span className="text-xs font-bold text-on-surface shrink-0">السجل والحصص</span>
              <span className="text-[11px] font-medium text-on-surface-variant truncate tabular-nums">
                {totalRequests} طلب · {(lastAiUsage ? lastAiUsage.totalTokens : accumulatedTotalTokens).toLocaleString()} توكن
                {aiRequestHistory.length > 0 ? ` · ${aiRequestHistory.length} محفوظ` : ""}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 shrink-0 ${showTelemetryDrawer ? "rotate-180" : ""}`} />
          </button>

          {showTelemetryDrawer && (
            <div className="border-t border-[#e5eefb] p-4 space-y-4">
              {/* Tabs + Refresh */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex bg-[#e3edfc] p-0.5 rounded-xl text-xs border border-[#d0dff7]">
                  <button
                    type="button"
                    onClick={() => setTelemetryTab("logs")}
                    className={`h-8 px-3 rounded-lg font-bold transition-all cursor-pointer tabular-nums ${
                      telemetryTab === "logs"
                        ? "bg-white text-[#004ac6] shadow-2xs"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    السجل ({aiRequestHistory.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelemetryTab("quotas")}
                    className={`h-8 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                      telemetryTab === "quotas"
                        ? "bg-white text-[#004ac6] shadow-2xs"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    الحصص
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {telemetryTab === "logs" && aiRequestHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAiRequestHistory([]);
                        localStorage.removeItem("ai_request_history");
                      }}
                      className="h-8 px-2.5 rounded-lg border border-[#cdddf5] bg-[#f4f8ff] text-[11px] font-bold text-on-surface-variant hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer"
                    >
                      مسح السجل
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fetchServerQuotas(true)}
                    disabled={quotaLoading}
                    className="h-8 px-2.5 rounded-lg border border-[#cdddf5] bg-[#f4f8ff] text-[11px] font-bold text-on-surface hover:bg-[#e6effe] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    {quotaLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 text-[#004ac6]" />}
                    <span>تحديث</span>
                  </button>
                </div>
              </div>

              {telemetryTab === "logs" ? (
                <div className="space-y-2 max-h-[340px] overflow-y-auto">
                  {aiRequestHistory.length === 0 ? (
                    <p className="text-xs text-on-surface-variant text-center py-6 font-medium bg-[#f4f8ff] rounded-xl border border-[#dbe7fa]">
                      لا توجد طلبات مسجلة بعد.
                    </p>
                  ) : (
                    aiRequestHistory.map((log) => (
                      <details
                        key={log.id}
                        className="group bg-[#f4f8ff] border border-[#dbe7fa] rounded-xl p-3"
                      >
                        <summary className="flex items-center justify-between gap-2 cursor-pointer select-none list-none">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${log.status === "failed" ? "bg-rose-500" : "bg-emerald-500"}`} />
                            <span className="text-xs font-bold text-on-surface truncate">
                              {log.prompt}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] font-mono text-on-surface-variant shrink-0 tabular-nums">
                            <span>{log.provider}</span>
                            {log.usage?.totalTokens ? <span>{log.usage.totalTokens.toLocaleString()} ت</span> : null}
                            <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                          </div>
                        </summary>

                        <div className="mt-3 pt-2.5 border-t border-[#dbe7fa] space-y-2 text-xs">
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-on-surface-variant font-mono">
                            <span>{new Date(log.timestamp).toLocaleString("ar-EG")}</span>
                            <span>{log.model}</span>
                            {log.usage && (
                              <span>
                                in: {log.usage.promptTokens} / out: {log.usage.completionTokens}
                              </span>
                            )}
                          </div>
                          {log.error && (
                            <p className="text-xs text-rose-700 font-semibold">{log.error}</p>
                          )}
                          {(log.rawRequestBody || log.rawPrompt) && (
                            <CodeViewer
                              code={log.rawRequestBody || log.rawPrompt || ""}
                              title="الطلب المرسل"
                            />
                          )}
                          {(log.rawResponseBody || log.response) && (
                            <CodeViewer
                              code={log.rawResponseBody || log.response || ""}
                              title="رد المزود"
                            />
                          )}
                        </div>
                      </details>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Session Summary */}
                  <div className="bg-[#f4f8ff] rounded-xl p-3 border border-[#dbe7fa] flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-on-surface tabular-nums">
                    <span>الطلبات بالجلسة: <strong className="font-mono text-on-surface">{totalRequests}</strong></span>
                    <span>التوكنات: <strong className="font-mono text-[#004ac6]">{accumulatedTotalTokens.toLocaleString()}</strong></span>
                    <span className="text-[11px] text-on-surface-variant font-normal">
                      مدخلات {accumulatedPromptTokens.toLocaleString()} · مخرجات {accumulatedCompletionTokens.toLocaleString()}
                    </span>
                  </div>

                  {/* 24-Hour Sliding Window Usage */}
                  {serverQuotas?.usageStats && (() => {
                    const total24h = serverQuotas.usageStats.totalTokens24h || 0;
                    const limit24h = 100000;
                    const percent = Math.min(100, Math.round((total24h / limit24h) * 100));
                    return (
                      <div className="bg-[#f4f8ff] rounded-xl p-3.5 border border-[#dbe7fa] space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-on-surface flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-[#004ac6]" />
                            <span>الاستهلاك (آخر 24 ساعة)</span>
                          </span>
                          <span className={`font-mono tabular-nums ${percent > 80 ? "text-rose-700" : "text-on-surface"}`}>
                            {total24h.toLocaleString()} / {limit24h.toLocaleString()} ({percent}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#dce8fb] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              percent > 90 ? "bg-rose-600" : percent > 60 ? "bg-amber-500" : "bg-[#004ac6]"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Provider Quota Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="bg-[#f4f8ff] border border-[#dbe7fa] rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-on-surface flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#004ac6]" />
                          <span>Google Gemini</span>
                        </span>
                        <span className="text-[11px] font-bold text-emerald-700">متاح</span>
                      </div>
                      <div className="space-y-1.5 text-[11px] font-semibold text-on-surface-variant tabular-nums">
                        <div className="flex justify-between">
                          <span>الطلبات اليومية (RPD)</span>
                          <span className="font-mono text-on-surface">1,500</span>
                        </div>
                        <div className="flex justify-between">
                          <span>بالدقيقة (RPM)</span>
                          <span className="font-mono text-on-surface">15</span>
                        </div>
                        <div className="flex justify-between">
                          <span>التوكنات (TPM)</span>
                          <span className="font-mono text-on-surface">1,000,000</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#f4f8ff] border border-[#dbe7fa] rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-on-surface flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-orange-600" />
                          <span>Groq Cloud</span>
                        </span>
                        <span className="text-[11px] font-bold text-emerald-700">متاح</span>
                      </div>
                      {serverQuotas?.groq?.rateLimits?.limitRequests ? (() => {
                        const reqLimit = parseInt(serverQuotas.groq.rateLimits.limitRequests) || 1;
                        const reqRemain = parseInt(serverQuotas.groq.rateLimits.remainingRequests) || 0;
                        const reqPercent = Math.min(100, Math.max(0, Math.round((reqRemain / reqLimit) * 100)));
                        const tokLimit = parseInt(serverQuotas.groq.rateLimits.limitTokens) || 1;
                        const tokRemain = parseInt(serverQuotas.groq.rateLimits.remainingTokens) || 0;
                        const tokPercent = Math.min(100, Math.max(0, Math.round((tokRemain / tokLimit) * 100)));
                        return (
                          <div className="space-y-2 text-[11px] font-semibold tabular-nums">
                            <div className="space-y-1">
                              <div className="flex justify-between text-on-surface-variant">
                                <span>الطلبات المتبقية</span>
                                <span className="font-mono text-on-surface">
                                  {reqRemain} / {reqLimit} ({reqPercent}%)
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-[#dce8fb] rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${reqPercent}%` }} />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-on-surface-variant">
                                <span>التوكنات المتبقية</span>
                                <span className="font-mono text-on-surface">
                                  {tokRemain.toLocaleString()} / {tokLimit.toLocaleString()} ({tokPercent}%)
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-[#dce8fb] rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${tokPercent}%` }} />
                              </div>
                            </div>
                            {(serverQuotas.groq.rateLimits.resetRequests || serverQuotas.groq.rateLimits.resetTokens) && (
                              <div className="flex items-center justify-between text-[10px] text-on-surface-variant pt-1">
                                {serverQuotas.groq.rateLimits.resetRequests && (
                                  <span>تجدد: {formatArabicResetTime(serverQuotas.groq.rateLimits.resetRequests)}</span>
                                )}
                                {serverQuotas.groq.rateLimits.resetTokens && (
                                  <span>توكنات: {formatArabicResetTime(serverQuotas.groq.rateLimits.resetTokens)}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })() : (
                        <div className="text-xs text-on-surface-variant py-3 flex items-center justify-between">
                          <span>لم تُجلب القراءات بعد</span>
                          <button
                            type="button"
                            onClick={() => fetchServerQuotas(true)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-[#cdddf5] text-[11px] font-bold text-on-surface hover:bg-[#edf4ff] cursor-pointer"
                          >
                            فحص
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* =========================================================================
         INLINE DIALOG: Edit temporary card details using the standard EditCardModal
         ========================================================================= */}
      {editingCard && activeAiFolder && (
        <EditCardModal
          isOpen={!!editingCard}
          onClose={() => setEditingCard(null)}
          card={adaptAICardToFlashcard(editingCard)}
          folders={activeAiFolder ? [{
            id: activeAiFolder.id,
            name: activeAiFolder.name,
            description: activeAiFolder.description || "",
            color: activeAiFolder.color || "#0056f6",
            frontLang: activeAiFolder.frontLang || "de",
            backLang: activeAiFolder.backLang || "ar",
            createdAt: activeAiFolder.createdAt,
            updatedAt: activeAiFolder.createdAt
          }] : []}
          onSave={handleSaveEditCard}
          onOpenImageSearch={handleOpenImageSearch}
          onDelete={handleDeleteAiCard}
        />
      )}

      {isImageSearchOpen && (
        <ImagePickerModal
          isOpen={isImageSearchOpen}
          onClose={() => setIsImageSearchOpen(false)}
          onSelect={(url) => {
            if (imageSearchCallback) {
              imageSearchCallback(url);
            }
            setIsImageSearchOpen(false);
          }}
          initialQuery={imageSearchInitialQuery}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081628]/45 backdrop-blur-xs" dir="rtl">
          <div className="bg-white border border-[#c7daf6] rounded-[24px] max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-black text-on-surface">تأكيد الحذف</h4>
            </div>

            <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
              {deleteConfirm.message}
            </p>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={executeConfirmedDelete}
                className="flex-1 h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                حذف
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 h-10 px-4 bg-[#f4f8ff] border border-[#cdddf5] text-on-surface font-bold text-xs rounded-xl hover:bg-[#e6effe] transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* External Mode Modal */}
      {showExternalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081628]/45 backdrop-blur-xs" dir="rtl">
          <div className="bg-white border border-[#c7daf6] rounded-[24px] max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 text-right max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#e5eefb] pb-3.5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#e8f0fe] border border-[#c7daf6] flex items-center justify-center text-[#004ac6]">
                  <Globe className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-on-surface">الاستيراد الخارجي (JSON)</h3>
                  <p className="text-[11px] text-on-surface-variant font-medium">
                    انسخ البرومبت لأي نموذج خارجي ثم ألصق الرد هنا
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExternalModal(false)}
                className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-[#edf4ff] rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-[#e3edfc] p-1 rounded-xl border border-[#d0dff7] shrink-0">
              <button
                type="button"
                onClick={() => setExternalTab("prompt")}
                className={`flex-1 h-9 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  externalTab === "prompt"
                    ? "bg-white text-[#004ac6] shadow-2xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>1. نسخ البرومبت</span>
              </button>
              <button
                type="button"
                onClick={() => setExternalTab("import")}
                className={`flex-1 h-9 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  externalTab === "import"
                    ? "bg-white text-[#004ac6] shadow-2xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>2. لصق النتيجة</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
              {externalTab === "prompt" ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-bold text-on-surface">البرومبت المولد</label>
                    <div className="flex items-center gap-2">
                      {externalCopySuccess && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>تم النسخ</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyExternalPrompt(false)}
                        className="h-8 px-2.5 text-[11px] font-bold text-on-surface bg-[#f4f8ff] border border-[#cdddf5] hover:bg-[#e6effe] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3 text-[#004ac6]" />
                        <span>نسخ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExternalTab("import");
                          setTimeout(() => {
                            if (jsonTextareaRef.current) {
                              jsonTextareaRef.current.focus();
                              jsonTextareaRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                            }
                          }, 120);
                        }}
                        className="h-8 px-2.5 text-[11px] font-bold text-[#004ac6] bg-[#e8f0fe] hover:bg-[#d7e6fd] rounded-lg transition-colors cursor-pointer"
                      >
                        اللصق الآن
                      </button>
                    </div>
                  </div>

                  <textarea
                    readOnly
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    value={constructFullExternalPrompt(prompt)}
                    className="w-full h-56 p-3.5 bg-[#f5f9ff] text-on-surface font-mono text-xs sm:text-[13px] rounded-xl border border-[#cdddf5] focus:border-[#004ac6] focus:bg-white focus:outline-none resize-none leading-relaxed select-all"
                    dir="rtl"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {externalCopySuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>تم نسخ البرومبت للحافظة.</span>
                    </div>
                  )}

                  {externalPasteSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>تم لصق JSON من الحافظة.</span>
                    </div>
                  )}

                  {externalPasteHint && (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold rounded-xl flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>{externalPasteHint}</span>
                    </div>
                  )}

                  {externalError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{externalError}</span>
                    </div>
                  )}

                  {externalImporting && (
                    <div className="p-3 bg-[#e8f0fe] border border-[#c7daf6] text-[#004ac6] text-xs font-bold rounded-xl flex items-center gap-2.5">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>{externalImportProgress || "جاري الاستيراد..."}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-on-surface">كود JSON</label>
                        {externalJsonInput.trim() && (
                          <span className="text-[11px] bg-[#e3edfc] text-[#004ac6] px-2 py-0.5 rounded font-mono tabular-nums font-bold">
                            {externalJsonInput.length} حرف
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {externalJsonInput.trim() && (
                          <button
                            type="button"
                            disabled={externalImporting}
                            onClick={() => {
                              setExternalJsonInput("");
                              setExternalError(null);
                              setExternalPasteHint(null);
                            }}
                            className="h-8 px-2.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>مسح</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={externalImporting}
                          onClick={handlePasteExternalJson}
                          className="h-8 px-3 text-xs font-bold text-[#004ac6] bg-[#e8f0fe] hover:bg-[#d7e6fd] rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Clipboard className="w-3.5 h-3.5" />
                          <span>لصق من الحافظة</span>
                        </button>
                      </div>
                    </div>

                    <textarea
                      ref={jsonTextareaRef}
                      value={externalJsonInput}
                      disabled={externalImporting}
                      onChange={(e) => {
                        setExternalJsonInput(e.target.value);
                        if (externalError) setExternalError(null);
                      }}
                      placeholder={`ألصق كود JSON هنا...\n\n{\n  "folder": { "name": "مفردات السفر", "color": "#0056f6" },\n  "cards": [\n    { "frontText": "Handy", "backText": "هاتف", "correctArticle": "das" }\n  ]\n}`}
                      className="w-full h-52 p-3.5 bg-[#f5f9ff] border border-[#cdddf5] rounded-xl font-mono text-xs sm:text-[13px] text-on-surface placeholder-[#627289] focus:bg-white focus:border-[#004ac6] focus:outline-none transition-colors resize-none disabled:opacity-60 leading-relaxed"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-[#e5eefb] flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={externalImporting}
                  onClick={() => setShowExternalModal(false)}
                  className="h-9 px-3.5 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-[#f4f8ff] rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                >
                  إغلاق
                </button>
                {externalTab === "import" && (
                  <button
                    type="button"
                    disabled={externalImporting}
                    onClick={() => setExternalTab("prompt")}
                    className="h-9 px-3 text-xs font-bold text-on-surface bg-[#f4f8ff] border border-[#cdddf5] hover:bg-[#e6effe] rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Code className="w-3.5 h-3.5 text-[#004ac6]" />
                    <span>البرومبت</span>
                  </button>
                )}
              </div>

              {externalTab === "prompt" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setExternalTab("import");
                      setTimeout(() => {
                        if (jsonTextareaRef.current) {
                          jsonTextareaRef.current.focus();
                          jsonTextareaRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }, 120);
                    }}
                    className="h-9 px-3 text-xs font-bold text-on-surface bg-[#f4f8ff] border border-[#cdddf5] hover:bg-[#e6effe] rounded-xl transition-colors cursor-pointer"
                  >
                    الانتقال للصق
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyExternalPrompt(true)}
                    className="h-9 px-4 bg-[#004ac6] hover:bg-[#003da6] text-white font-bold text-xs rounded-xl active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ وانتقال</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleImportExternalJson}
                  disabled={!externalJsonInput.trim() || externalImporting}
                  className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-xs"
                >
                  {externalImporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الاستيراد...</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>استيراد البطاقات</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Fetching & Storage Options Modal */}
      {showImageOptionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081628]/45 backdrop-blur-xs" dir="rtl">
          <div className="bg-white border border-[#c7daf6] rounded-[24px] max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 text-right relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                if (!isFetchingImages) setShowImageOptionsModal(false);
              }}
              disabled={isFetchingImages}
              className="absolute top-4 left-4 w-8 h-8 rounded-xl bg-[#f4f8ff] border border-[#cdddf5] hover:bg-[#e6effe] flex items-center justify-center text-on-surface-variant transition-colors cursor-pointer disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 bg-emerald-600">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-on-surface leading-tight">
                  تنزيل الصور مسبقاً
                </h3>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                  حفظ الصور في الذاكرة للعمل بدون إنترنت
                </p>
              </div>
            </div>

            <div className="bg-[#f4f8ff] p-3.5 rounded-2xl border border-[#dbe7fa] space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-on-surface-variant">النطاق</span>
                <span className="font-bold text-on-surface">
                  {activeAiFolder ? activeAiFolder.name : "المساعد الذكي"}
                </span>
              </div>

              <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-[#cdddf5] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeAuto10Images}
                  onChange={(e) => setIncludeAuto10Images(e.target.checked)}
                  disabled={isFetchingImages}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-[#a9bedb] focus:ring-emerald-500 cursor-pointer"
                />
                <div className="space-y-0.5 text-right">
                  <span className="text-xs font-bold text-on-surface block">
                    تنزيل 10 صور بديلة لكل بطاقة
                  </span>
                  <p className="text-[11px] font-medium text-on-surface-variant">
                    يتيح تبديل الصورة لاحقاً بدون اتصال.
                  </p>
                </div>
              </label>

              {(() => {
                const targetCards = activeAiFolder ? folderCards : aiCards;
                let primaryImages = 0;
                if (activeAiFolder?.coverImage) primaryImages++;
                targetCards.forEach((c) => {
                  if (c.frontImage?.trim()) primaryImages++;
                  if (c.backImage?.trim()) primaryImages++;
                });
                const autoImagesEst = includeAuto10Images ? targetCards.length * 10 : 0;
                const totalCombinedEst = primaryImages + autoImagesEst;

                return (
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-[#dbe7fa] tabular-nums">
                    <span className="font-bold text-on-surface-variant">المتوقع</span>
                    <span className="font-bold text-on-surface">
                      {primaryImages} أساسية{includeAuto10Images ? ` + ${autoImagesEst} تلقائية` : ""} ({totalCombinedEst})
                    </span>
                  </div>
                );
              })()}
            </div>

            {isFetchingImages && (
              <div className="space-y-2 bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200">
                <div className="flex justify-between items-center text-xs font-bold text-on-surface tabular-nums">
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التنزيل...</span>
                  </span>
                  <span>{imageFetchProgress.current} / {imageFetchProgress.total}</span>
                </div>
                <div className="w-full bg-[#dce8fb] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                    style={{
                      width: imageFetchProgress.total > 0
                        ? `${Math.round((imageFetchProgress.current / imageFetchProgress.total) * 100)}%`
                        : "0%"
                    }}
                  />
                </div>
                {imageFetchProgress.currentItem && (
                  <div className="flex items-center gap-2 pt-1">
                    {imageFetchProgress.currentPreview && (
                      <img
                        src={imageFetchProgress.currentPreview}
                        alt="preview"
                        className="w-7 h-7 rounded-lg object-cover border border-emerald-200 shrink-0"
                      />
                    )}
                    <p className="text-[11px] font-medium text-on-surface-variant truncate">
                      {imageFetchProgress.currentItem}
                    </p>
                  </div>
                )}
              </div>
            )}

            {imageFetchSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>تم حفظ جميع الصور في الذاكرة المحلية.</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleUnifiedImageFetchAndDownload()}
              disabled={isFetchingImages}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {isFetchingImages ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التخزين ({imageFetchProgress.current}/{imageFetchProgress.total})</span>
                </>
              ) : (
                <>
                  <DownloadCloud className="w-4 h-4" />
                  <span>بدء التنزيل</span>
                </>
              )}
            </button>

            {(() => {
              const cardsWithImages = (activeAiFolder ? folderCards : aiCards).filter(c => c.frontImage || c.backImage);
              if (cardsWithImages.length === 0) return null;

              return (
                <div className="space-y-2 pt-3 border-t border-[#e5eefb]">
                  <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-[#004ac6]" />
                    <span>تنزيل فردي للجهاز</span>
                  </h4>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5 text-xs">
                    {cardsWithImages.map((card) => (
                      <div key={card.id} className="p-2 bg-[#f4f8ff] rounded-xl border border-[#dbe7fa] flex items-center justify-between gap-2">
                        <span className="font-bold text-on-surface truncate max-w-[200px]">
                          {card.frontText || "بطاقة"}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {card.frontImage && (
                            <button
                              type="button"
                              onClick={() => handleDownloadSingleImageFile(card.frontImage!, `${card.frontText || "card"}_front`)}
                              className="h-7 px-2 bg-white hover:bg-[#edf4ff] text-on-surface border border-[#cdddf5] rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3 h-3 text-[#004ac6]" />
                              <span>الوجه</span>
                            </button>
                          )}
                          {card.backImage && (
                            <button
                              type="button"
                              onClick={() => handleDownloadSingleImageFile(card.backImage!, `${card.backText || "card"}_back`)}
                              className="h-7 px-2 bg-white hover:bg-[#edf4ff] text-on-surface border border-[#cdddf5] rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3 h-3 text-purple-600" />
                              <span>الظهر</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Collapsible Advanced Storage Settings */}
            <details className="group border-t border-[#e5eefb] pt-3 text-xs">
              <summary className="font-bold text-on-surface cursor-pointer flex items-center justify-between select-none py-1">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#004ac6]" />
                  <span>خيارات التخزين والبحث</span>
                </span>
                <ChevronDown className="w-4 h-4 text-on-surface-variant group-open:rotate-180 transition-transform" />
              </summary>

              <div className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-on-surface block">الصورة الأساسية</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPrimaryImageStorageMode("data_url");
                        localStorage.setItem("settings_primary_image_storage", "data_url");
                      }}
                      className={`h-9 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        primaryImageStorageMode === "data_url"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                          : "bg-[#f4f8ff] border-[#cdddf5] text-on-surface-variant hover:bg-[#e6effe]"
                      }`}
                    >
                      تخزين محلي
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrimaryImageStorageMode("direct_url");
                        localStorage.setItem("settings_primary_image_storage", "direct_url");
                      }}
                      className={`h-9 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        primaryImageStorageMode === "direct_url"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                          : "bg-[#f4f8ff] border-[#cdddf5] text-on-surface-variant hover:bg-[#e6effe]"
                      }`}
                    >
                      رابط مباشر
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-on-surface block">الصور الـ 10 الثانوية</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSecondaryImagesStorageMode("data_urls");
                        localStorage.setItem("settings_secondary_images_storage", "data_urls");
                      }}
                      className={`h-9 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        secondaryImagesStorageMode === "data_urls"
                          ? "bg-purple-50 border-purple-500 text-purple-700"
                          : "bg-[#f4f8ff] border-[#cdddf5] text-on-surface-variant hover:bg-[#e6effe]"
                      }`}
                    >
                      تخزين في الذاكرة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSecondaryImagesStorageMode("direct_urls");
                        localStorage.setItem("settings_secondary_images_storage", "direct_urls");
                      }}
                      className={`h-9 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        secondaryImagesStorageMode === "direct_urls"
                          ? "bg-purple-50 border-purple-500 text-purple-700"
                          : "bg-[#f4f8ff] border-[#cdddf5] text-on-surface-variant hover:bg-[#e6effe]"
                      }`}
                    >
                      روابط فقط
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[#e5eefb]">
                  <span className="text-[11px] font-bold text-on-surface flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-[#004ac6]" />
                    <span>مصدر كلمة البحث عن الصور</span>
                  </span>
                  <div className="space-y-1.5">
                    {[
                      { val: "smart_auto", title: "تلقائي ذكي", sub: "بحث مخصص ثم الوجه ثم الظهر" },
                      { val: "front_text_only", title: "النص الأمامي فقط", sub: "الكلمة في وجه البطاقة" },
                      { val: "back_text_only", title: "النص الخلفي فقط", sub: "الترجمة في ظهر البطاقة" },
                      { val: "combined_front_back", title: "دمج الوجه والظهر", sub: "الوجه مع الترجمة معاً" },
                      { val: "custom_query_only", title: "الكلمة المخصصة فقط", sub: "حقل imageSearchQuery" }
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => {
                          setImageSearchQuerySource(item.val as any);
                          localStorage.setItem("settings_image_search_query_source", item.val);
                        }}
                        className={`w-full p-2.5 rounded-xl border text-right transition-colors cursor-pointer flex items-center justify-between ${
                          imageSearchQuerySource === item.val
                            ? "bg-[#e8f0fe] border-[#004ac6] text-on-surface"
                            : "bg-[#f4f8ff] border-[#dbe7fa] text-on-surface hover:bg-[#e6effe]"
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold block">{item.title}</span>
                          <span className="text-[10px] text-on-surface-variant">{item.sub}</span>
                        </div>
                        {imageSearchQuerySource === item.val && <Check className="w-4 h-4 text-[#004ac6] shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* Floating Smart Image Progress Widget */}
      {isFetchingImages && !showImageOptionsModal && (() => {
        const progressPercent = imageFetchProgress.total > 0
          ? Math.min(100, Math.max(0, Math.round((imageFetchProgress.current / imageFetchProgress.total) * 100)))
          : 0;
        const strokeDashoffset = 138.23 - (138.23 * progressPercent) / 100;

        return (
          <div
            dir="rtl"
            className="fixed bottom-6 left-6 z-[200] cursor-pointer group select-none"
            onClick={() => setShowImageOptionsModal(true)}
            title="فتح نافذة تنزيل الصور"
          >
            <div className="bg-white/95 backdrop-blur-md border border-emerald-500/50 hover:border-emerald-600 shadow-xl rounded-2xl p-3 pr-3.5 flex items-center gap-3 transition-all duration-200">
              <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                <svg className="w-12 h-12 -rotate-90 transform" viewBox="0 0 52 52">
                  <circle
                    cx="26"
                    cy="26"
                    r="22"
                    className="text-[#dce8fb]"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <circle
                    cx="26"
                    cy="26"
                    r="22"
                    className="text-emerald-500 transition-all duration-300 ease-out"
                    strokeWidth="4.5"
                    strokeDasharray="138.23"
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-emerald-700 font-black text-[11px] tabular-nums">
                  {progressPercent}%
                </span>
              </div>

              <div className="flex flex-col text-right min-w-[140px] max-w-[200px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-on-surface truncate">
                    تنزيل الصور
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 tabular-nums shrink-0">
                    {imageFetchProgress.current}/{imageFetchProgress.total}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-on-surface-variant truncate mt-0.5">
                  {imageFetchProgress.currentItem || "جاري المعالجة..."}
                </p>
                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-700 group-hover:underline">
                  <Maximize2 className="w-3 h-3" />
                  <span>فتح النافذة</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
});

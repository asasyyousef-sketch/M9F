import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  Copy,
  CopyPlus,
  Check,
  Printer,
  Maximize2,
  Minimize2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Highlighter,
  Palette,
  Undo2,
  Redo2,
  RemoveFormatting,
  Calendar,
  FileText,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Languages,
  Cpu,
  CheckCheck,
  AlertCircle,
  PenTool,
  SlidersHorizontal,
  Type,
  Volume2,
  VolumeX,
  Settings,
  ArrowLeftRight,
  ExternalLink,
  Replace,
  RotateCw
} from "lucide-react";
import { NoteItem, PaperStyle } from "../types";
import { ALL_AVAILABLE_MODELS, type AIModelOption } from "./AICorrectorWorkspace";

const STORAGE_KEY = "app_user_writings_v2";

const PROOFREAD_LANGUAGES = [
  { id: "German", name: "الألمانية", native: "Deutsch", flag: "🇩🇪" },
  { id: "English", name: "الإنجليزية", native: "English", flag: "🇬🇧" },
  { id: "Arabic", name: "العربية", native: "العربية الفصحى", flag: "🇸🇦" },
  { id: "French", name: "الفرنسية", native: "Français", flag: "🇫🇷" },
  { id: "Spanish", name: "الإسبانية", native: "Español", flag: "🇪🇸" },
  { id: "Italian", name: "الإيطالية", native: "Italiano", flag: "🇮🇹" }
];

const LANG_TO_TTS_CODE: Record<string, string> = {
  German: "de-DE",
  English: "en-US",
  Arabic: "ar-SA",
  French: "fr-FR",
  Spanish: "es-ES",
  Italian: "it-IT"
};

const LANG_TO_GOOGLE_CODE: Record<string, string> = {
  German: "de",
  English: "en",
  Arabic: "ar",
  French: "fr",
  Spanish: "es",
  Italian: "it"
};

const GOOGLE_TRANSLATE_LANGS = [
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "de", name: "الألمانية", flag: "🇩🇪" },
  { code: "en", name: "الإنجليزية", flag: "🇬🇧" },
  { code: "fr", name: "الفرنسية", flag: "🇫🇷" },
  { code: "es", name: "الإسبانية", flag: "🇪🇸" },
  { code: "it", name: "الإيطالية", flag: "🇮🇹" },
  { code: "tr", name: "التركية", flag: "🇹🇷" },
  { code: "ru", name: "الروسية", flag: "🇷🇺" }
];

interface SelectionBubbleInfo {
  text: string;
  top: number;
  left: number;
  isFlipped: boolean;
}

interface HoveredCorrectionInfo {
  id: string;
  original: string;
  replacement: string;
  explanation: string;
  type: string;
  beforeWord?: string;
  afterWord?: string;
  top: number;
  left: number;
  isFlipped: boolean;
  element: HTMLElement;
}

interface NotesWorkspaceProps {
  onToggleSidebar?: () => void;
  onBackToLibrary?: () => void;
}

export const NotesWorkspace: React.FC<NotesWorkspaceProps> = ({
  onToggleSidebar
}) => {
  // Load user notes from localStorage (strictly no explanatory or dummy notes)
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      // Check v2 first
      const savedV2 = localStorage.getItem(STORAGE_KEY);
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out any old demo notes
          const cleaned = parsed.filter(
            (n) =>
              n &&
              n.id !== "welcome-note-1" &&
              n.id !== "german-study-note-2" &&
              n.id !== "daily-journal-3"
          );
          if (cleaned.length > 0) return cleaned;
        }
      }

      // Check if there was previously saved v1 without dummy notes
      const savedV1 = localStorage.getItem("app_writings_notes_v1");
      if (savedV1) {
        const parsedV1 = JSON.parse(savedV1);
        if (Array.isArray(parsedV1)) {
          const userOnly = parsedV1.filter(
            (n) =>
              n &&
              n.id !== "welcome-note-1" &&
              n.id !== "german-study-note-2" &&
              n.id !== "daily-journal-3"
          );
          if (userOnly.length > 0) return userOnly;
        }
      }
    } catch (e) {
      console.error("Failed to load writings", e);
    }

    // Default: One fresh blank page ready for the user to write immediately
    return [
      {
        id: `note-${Date.now()}`,
        title: "",
        content: "",
        plainText: "",
        isPinned: false,
        paperStyle: "ruled",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  });

  // Current active note ID
  const [activeNoteId, setActiveNoteId] = useState<string>(() => {
    return notes[0]?.id || `note-${Date.now()}`;
  });

  // UI state
  const [isSaved, setIsSaved] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNotesList, setShowNotesList] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [mobileToolTab, setMobileToolTab] = useState<"formatting" | "paper">("formatting");

  // AI Proofreading states
  const [proofreadLanguage, setProofreadLanguage] = useState<string>(() => {
    return localStorage.getItem("app_notes_proofread_lang") || "German";
  });
  const [proofreadModel, setProofreadModel] = useState<string>(() => {
    return (
      localStorage.getItem("app_notes_proofread_model") ||
      localStorage.getItem("ai_corrector_selected_model") ||
      "gemini-3.6-flash"
    );
  });
  const [isProofreading, setIsProofreading] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [proofreadStatusMessage, setProofreadStatusMessage] = useState<string | null>(null);
  const [activeCorrectionsCount, setActiveCorrectionsCount] = useState<number>(0);
  const [hoveredCorrection, setHoveredCorrection] = useState<HoveredCorrectionInfo | null>(null);
  const popoverCloseTimeoutRef = useRef<any>(null);

  // Floating text selection bubble states (Listen / Speak & Copy)
  const [selectionBubble, setSelectionBubble] = useState<SelectionBubbleInfo | null>(null);
  const [isSpeakingSelection, setIsSpeakingSelection] = useState(false);
  const [selectionCopied, setSelectionCopied] = useState(false);
  const selectionTimeoutRef = useRef<any>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  // Google Translate states (official Google Translate, strictly no AI)
  const [isTranslateOpen, setIsTranslateOpen] = useState(false);
  const [translationState, setTranslationState] = useState<{
    originalText: string;
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    isLoading: boolean;
    error?: string;
  } | null>(null);
  const [translationCopied, setTranslationCopied] = useState(false);
  const savedRangeRef = useRef<Range | null>(null);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [customTranslateInput, setCustomTranslateInput] = useState("");

  // Voice Model Settings Modal state
  const [showVoiceSettingsModal, setShowVoiceSettingsModal] = useState(false);
  const [selectedVoiceModel, setSelectedVoiceModel] = useState<string>(() => {
    return localStorage.getItem("notes_tts_voice_model") || "google";
  });
  const [speechRate, setSpeechRate] = useState<number>(() => {
    const saved = localStorage.getItem("notes_tts_speech_rate");
    return saved ? Number(saved) : 0.95;
  });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [installedPiperModels, setInstalledPiperModels] = useState<Array<{ id: string; name?: string; lang?: string; flag?: string }>>([]);
  const [testVoiceLang, setTestVoiceLang] = useState<string>(() => proofreadLanguage || "German");
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        setAvailableVoices(v);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    fetch("/api/tts/models")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.models)) {
          setInstalledPiperModels(data.models);
        }
      })
      .catch(() => {});
  }, []);

  const selectedLangObj = useMemo(() => {
    return PROOFREAD_LANGUAGES.find((l) => l.id === proofreadLanguage) || PROOFREAD_LANGUAGES[0];
  }, [proofreadLanguage]);

  const selectedModelObj = useMemo(() => {
    return (
      ALL_AVAILABLE_MODELS.find((m) => m.key === proofreadModel) ||
      ALL_AVAILABLE_MODELS.find((m) => m.key === "gemini-3.6-flash") ||
      ALL_AVAILABLE_MODELS[0]
    );
  }, [proofreadModel]);

  const handleSetLanguage = (langId: string) => {
    setProofreadLanguage(langId);
    localStorage.setItem("app_notes_proofread_lang", langId);
  };

  const handleSetModel = (modelId: string) => {
    setProofreadModel(modelId);
    localStorage.setItem("app_notes_proofread_model", modelId);
    try {
      localStorage.setItem("ai_corrector_selected_model", modelId);
    } catch (e) {
      console.error(e);
    }
  };

  // Font and baseline calibration
  const [selectedFont, setSelectedFont] = useState<"tajawal" | "cairo" | "inter" | "amiri">(() => {
    return (localStorage.getItem("app_notes_font") as any) || "tajawal";
  });
  const [baselineOffset, setBaselineOffset] = useState<number>(() => {
    const saved = localStorage.getItem("app_notes_baseline_offset");
    return saved ? Number(saved) : 0;
  });

  const fontConfig = useMemo(() => {
    switch (selectedFont) {
      case "cairo":
        return { name: "كايرو", baseBaseline: 26.5 };
      case "inter":
        return { name: "English", baseBaseline: 25 };
      case "amiri":
        return { name: "أميري", baseBaseline: 25.5 };
      case "tajawal":
      default:
        return { name: "تجوال", baseBaseline: 25 };
    }
  }, [selectedFont]);

  const effectiveBaseline = fontConfig.baseBaseline + baselineOffset;

  const setFont = (font: "tajawal" | "cairo" | "inter" | "amiri") => {
    setSelectedFont(font);
    localStorage.setItem("app_notes_font", font);
    if (activeNote) {
      setNotes((prev) =>
        prev.map((n) => (n.id === activeNote.id ? { ...n, fontFamily: font } : n))
      );
    }
  };

  const adjustBaseline = (delta: number) => {
    setBaselineOffset((prev) => {
      const next = Math.max(-4, Math.min(4, prev + delta));
      localStorage.setItem("app_notes_baseline_offset", next.toString());
      return next;
    });
  };

  // Editor and timeout refs
  const editorRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<any>(null);

  // Persist notes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (e) {
      console.error("Failed to save writings", e);
    }
  }, [notes]);

  // Current active note
  const activeNote = useMemo(() => {
    const found = notes.find((n) => n.id === activeNoteId);
    return found || notes[0] || null;
  }, [notes, activeNoteId]);

  // Sync content into contentEditable on note switch
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setAttribute("spellcheck", "false");
      editorRef.current.setAttribute("autocorrect", "off");
      editorRef.current.setAttribute("autocapitalize", "off");
    }
    if (editorRef.current && activeNote) {
      if (editorRef.current.innerHTML !== activeNote.content) {
        editorRef.current.innerHTML = activeNote.content;
      }
    }
  }, [activeNoteId]);

  // Helper to get text without HTML
  const getPlainText = (html: string) => {
    const el = document.createElement("div");
    el.innerHTML = html;
    return el.textContent || el.innerText || "";
  };

  // Auto-save debounced
  const triggerAutoSave = useCallback(() => {
    setIsSaved(false);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      if (!editorRef.current || !activeNote) return;
      const html = editorRef.current.innerHTML;
      const plain = getPlainText(html);
      const now = new Date().toISOString();

      setNotes((prevNotes) =>
        prevNotes.map((n) =>
          n.id === activeNote.id
            ? { ...n, content: html, plainText: plain, updatedAt: now }
            : n
        )
      );
      setIsSaved(true);
    }, 400);
  }, [activeNote]);

  // Update Title
  const handleTitleChange = (newTitle: string) => {
    if (!activeNote) return;
    setIsSaved(false);
    const now = new Date().toISOString();

    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNote.id
          ? { ...n, title: newTitle, updatedAt: now }
          : n
      )
    );

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      setIsSaved(true);
    }, 400);
  };

  // Update Paper Style (Ruled / Plain / Grid / Legal)
  const setPaperStyle = (style: PaperStyle) => {
    if (!activeNote) return;
    const now = new Date().toISOString();
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNote.id
          ? { ...n, paperStyle: style, updatedAt: now }
          : n
      )
    );
  };

  // Create a brand new blank note
  const handleCreateNewNote = () => {
    const newId = `note-${Date.now()}`;
    const newNote: NoteItem = {
      id: newId,
      title: "",
      content: "",
      plainText: "",
      isPinned: false,
      paperStyle: "ruled",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setNotes([newNote, ...notes]);
    setActiveNoteId(newId);
    setShowNotesList(false);

    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 50);
  };

  // Delete current note
  const handleDeleteCurrentNote = () => {
    if (!activeNote) return;
    if (window.confirm("هل تريد بالتأكيد حذف هذه الورقة؟")) {
      const remaining = notes.filter((n) => n.id !== activeNote.id);
      if (remaining.length === 0) {
        // Create one clean blank page if everything was deleted
        const freshId = `note-${Date.now()}`;
        const freshNote: NoteItem = {
          id: freshId,
          title: "",
          content: "",
          plainText: "",
          isPinned: false,
          paperStyle: "ruled",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setNotes([freshNote]);
        setActiveNoteId(freshId);
      } else {
        setNotes(remaining);
        setActiveNoteId(remaining[0].id);
      }
    }
  };

  // Reset proofreading highlights when switching notes
  useEffect(() => {
    setHoveredCorrection(null);
    setShowModelPicker(false);
    setShowLangPicker(false);
    if (editorRef.current) {
      setTimeout(() => {
        if (editorRef.current) {
          const count = editorRef.current.querySelectorAll(".ai-proofread-error, .ai-proofread-missing-caret").length;
          setActiveCorrectionsCount(count);
        }
      }, 50);
    }
  }, [activeNoteId]);

  // Helper to escape regex special characters
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Helper to extract minimal error and prevent highlighting whole sentences
  const extractMinimalError = (orig: string, rep: string) => {
    const origTrimmed = orig.trim();
    const repTrimmed = rep.trim();
    const origWords = origTrimmed.split(/\s+/);
    const repWords = repTrimmed.split(/\s+/);

    if (origWords.length <= 2) {
      return { original: origTrimmed, replacement: repTrimmed };
    }

    let start = 0;
    while (
      start < origWords.length &&
      start < repWords.length &&
      origWords[start].toLowerCase() === repWords[start].toLowerCase()
    ) {
      start++;
    }

    let origEnd = origWords.length - 1;
    let repEnd = repWords.length - 1;
    while (
      origEnd >= start &&
      repEnd >= start &&
      origWords[origEnd].toLowerCase() === repWords[repEnd].toLowerCase()
    ) {
      origEnd--;
      repEnd--;
    }

    const diffOrig = origWords.slice(start, origEnd + 1).join(" ");
    const diffRep = repWords.slice(start, repEnd + 1).join(" ");

    if (diffOrig) {
      return { original: diffOrig, replacement: diffRep };
    }

    return { original: origTrimmed, replacement: repTrimmed };
  };

  // Clear all error highlight spans without replacing text
  const clearCorrectionsInElement = (container: HTMLElement) => {
    const spans = container.querySelectorAll(".ai-proofread-error");
    spans.forEach((span) => {
      const parent = span.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(span.textContent || ""), span);
      }
    });

    const carets = container.querySelectorAll(".ai-proofread-missing-caret");
    carets.forEach((caret) => {
      caret.remove();
    });

    container.normalize();
  };

  // Helper to check if match in fullText at given index and length is at unicode word boundaries
  const isWordBoundaryMatch = (fullText: string, index: number, length: number): boolean => {
    const isWordChar = (ch: string) => /[\p{L}\p{N}_]/u.test(ch);
    if (index > 0 && isWordChar(fullText[index - 1])) {
      return false;
    }
    const end = index + length;
    if (end < fullText.length && isWordChar(fullText[end])) {
      return false;
    }
    return true;
  };

  // Helper to find whole word match index in content
  const findWordMatchIndex = (content: string, searchPhrase: string): number => {
    if (!content || !searchPhrase) return -1;
    const lowerContent = content.toLowerCase();
    const lowerSearch = searchPhrase.toLowerCase();
    const len = searchPhrase.length;

    let start = 0;
    while (start <= content.length - len) {
      const idx = lowerContent.indexOf(lowerSearch, start);
      if (idx === -1) break;
      if (isWordBoundaryMatch(content, idx, len)) {
        return idx;
      }
      start = idx + 1;
    }
    return -1;
  };

  // Helper to find missing word pair match with strict word boundaries
  const findMissingWordMatch = (content: string, beforeWord: string, afterWord: string) => {
    if (!content) return null;
    if (beforeWord && afterWord) {
      const regex = new RegExp(
        `(?:^|[^\\p{L}\\p{N}])(${escapeRegex(beforeWord)})(\\s+)(${escapeRegex(afterWord)})(?=[^\\p{L}\\p{N}]|$)`,
        "iu"
      );
      const m = regex.exec(content);
      if (m) {
        const matchFullIndex = m.index;
        const fullMatchStr = m[0];
        const beforeWordOffset = fullMatchStr.indexOf(m[1]);
        const actualIndex = matchFullIndex + beforeWordOffset;
        const totalMatchLen = m[1].length + m[2].length + m[3].length;

        return {
          index: actualIndex,
          length: totalMatchLen,
          beforeWord: m[1],
          space: m[2],
          afterWord: m[3],
        };
      }
    } else if (beforeWord) {
      const regex = new RegExp(
        `(?:^|[^\\p{L}\\p{N}])(${escapeRegex(beforeWord)})(?=[^\\p{L}\\p{N}]|$)`,
        "iu"
      );
      const m = regex.exec(content);
      if (m) {
        const matchFullIndex = m.index;
        const fullMatchStr = m[0];
        const beforeWordOffset = fullMatchStr.indexOf(m[1]);
        return {
          index: matchFullIndex + beforeWordOffset,
          length: m[1].length,
          beforeWord: m[1],
          space: " ",
          afterWord: "",
        };
      }
    } else if (afterWord) {
      const regex = new RegExp(
        `(?:^|[^\\p{L}\\p{N}])(${escapeRegex(afterWord)})(?=[^\\p{L}\\p{N}]|$)`,
        "iu"
      );
      const m = regex.exec(content);
      if (m) {
        const matchFullIndex = m.index;
        const fullMatchStr = m[0];
        const afterWordOffset = fullMatchStr.indexOf(m[1]);
        return {
          index: matchFullIndex + afterWordOffset,
          length: m[1].length,
          beforeWord: "",
          space: " ",
          afterWord: m[1],
        };
      }
    }
    return null;
  };

  interface CharMapEntry {
    node: Text;
    offset: number;
  }

  // Build a continuous document text and map each character index back to its DOM Text node & offset
  const buildDocumentTextAndMap = (container: HTMLElement) => {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
    );

    let docText = "";
    const charMap: (CharMapEntry | null)[] = [];
    let node: Node | null;

    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node as Text;
        const isProtected = !!textNode.parentElement?.closest(
          ".ai-proofread-error, .ai-proofread-missing-caret"
        );
        const str = textNode.textContent || "";
        for (let i = 0; i < str.length; i++) {
          const ch = str[i] === "\u00A0" ? " " : str[i];
          docText += ch;
          charMap.push(isProtected ? null : { node: textNode, offset: i });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName === "BR") {
          docText += "\n";
          charMap.push(null);
        } else if (el.tagName === "DIV" || el.tagName === "P" || el.tagName === "LI") {
          if (docText.length > 0 && !docText.endsWith("\n")) {
            docText += "\n";
            charMap.push(null);
          }
        }
      }
    }

    return { docText, charMap };
  };

  // Mark corrections in text nodes with character-mapping, context-awareness, and whole-word boundaries
  const markCorrectionsInElement = (container: HTMLElement, corrections: any[]) => {
    clearCorrectionsInElement(container);
    if (!corrections || corrections.length === 0) return 0;

    let count = 0;
    let lastDocIndex = 0;

    corrections.forEach((cor: any, idx: number) => {
      // Rebuild text map for current state of DOM (after any previous insertion)
      const { docText, charMap } = buildDocumentTextAndMap(container);
      if (!docText) return;

      let isMissing = cor.type === "missing-word";
      let beforeWord = (cor.beforeWord || "").trim();
      let afterWord = (cor.afterWord || "").trim();
      let replacement = (cor.replacement || "").trim();
      const rawContext = (cor.context || "").replace(/[\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, " ").trim();

      // Infer beforeWord and afterWord if missing
      if (isMissing || (!beforeWord && !afterWord)) {
        const origWords = (cor.original || "").trim().split(/\s+/).filter(Boolean);
        if (origWords.length >= 2) {
          if (!beforeWord) beforeWord = origWords[0];
          if (!afterWord) afterWord = origWords[origWords.length - 1];
          isMissing = true;
        } else if (origWords.length === 1 && isMissing) {
          if (!beforeWord) beforeWord = origWords[0];
        }
      }

      // Check if this was an omitted word disguised as replacement
      if (!isMissing && !beforeWord && !afterWord) {
        const origWords = (cor.original || "").trim().split(/\s+/);
        const repWords = replacement.split(/\s+/);
        if (origWords.length === 2 && repWords.length >= 3) {
          if (
            origWords[0].toLowerCase() === repWords[0].toLowerCase() &&
            origWords[1].toLowerCase() === repWords[repWords.length - 1].toLowerCase()
          ) {
            isMissing = true;
            beforeWord = origWords[0];
            afterWord = origWords[1];
            replacement = repWords.slice(1, repWords.length - 1).join(" ");
          }
        }
      }

      const minimal = extractMinimalError(cor.original || "", cor.replacement || "");
      const searchPhrase = minimal.original || (cor.original || "").trim();
      if (!isMissing && !searchPhrase) return;

      let matchStart = -1;
      let matchLength = 0;
      let matchedBeforeWord = "";
      let matchedAfterWord = "";

      // STRATEGY 1: Check server-provided startIndex with exact check & fuzzy tolerance
      if (typeof cor.startIndex === "number" && cor.startIndex >= 0) {
        const s = cor.startIndex;
        const e = typeof cor.endIndex === "number" ? cor.endIndex : s + (isMissing ? 0 : searchPhrase.length);

        if (isMissing && (beforeWord || afterWord)) {
          // Check slice around server startIndex
          const winStart = Math.max(0, s - 30);
          const winEnd = Math.min(docText.length, e + 30);
          const winSlice = docText.substring(winStart, winEnd);
          const m = findMissingWordMatch(winSlice, beforeWord, afterWord);
          if (m) {
            matchStart = winStart + m.index;
            matchLength = m.length;
            matchedBeforeWord = m.beforeWord;
            matchedAfterWord = m.afterWord;
          }
        } else if (!isMissing && searchPhrase) {
          // Exact slice check
          if (e <= docText.length) {
            const slice = docText.substring(s, e);
            if (slice.toLowerCase() === searchPhrase.toLowerCase() && isWordBoundaryMatch(docText, s, e - s)) {
              matchStart = s;
              matchLength = e - s;
            }
          }
          // Fuzzy window check (within 35 chars of server index)
          if (matchStart === -1) {
            const winStart = Math.max(0, s - 35);
            const winEnd = Math.min(docText.length, e + 35);
            const winSlice = docText.substring(winStart, winEnd);
            const localIdx = findWordMatchIndex(winSlice, searchPhrase);
            if (localIdx !== -1) {
              matchStart = winStart + localIdx;
              matchLength = searchPhrase.length;
            }
          }
        }
      }

      // STRATEGY 2: Neighbor-anchored patterns from context (guarantees targeting the exact occurrence)
      if (matchStart === -1 && rawContext && !isMissing && searchPhrase) {
        const ctxWords = rawContext.split(/\s+/).filter(Boolean);
        const origLower = searchPhrase.toLowerCase();
        let wIdx = -1;
        for (let w = 0; w < ctxWords.length; w++) {
          const cleanW = ctxWords[w].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase();
          if (cleanW === origLower) {
            wIdx = w;
            break;
          }
        }

        if (wIdx !== -1) {
          const prevW = wIdx > 0 ? ctxWords[wIdx - 1].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "") : "";
          const nextW = wIdx < ctxWords.length - 1 ? ctxWords[wIdx + 1].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "") : "";

          const anchorPatterns: { pattern: string; offsetInPattern: number }[] = [];
          if (prevW && nextW) {
            const p = `${prevW} ${searchPhrase} ${nextW}`;
            anchorPatterns.push({ pattern: p, offsetInPattern: p.indexOf(searchPhrase) });
          }
          if (nextW) {
            const p = `${searchPhrase} ${nextW}`;
            anchorPatterns.push({ pattern: p, offsetInPattern: 0 });
          }
          if (prevW) {
            const p = `${prevW} ${searchPhrase}`;
            anchorPatterns.push({ pattern: p, offsetInPattern: p.indexOf(searchPhrase) });
          }

          for (const anch of anchorPatterns) {
            const patLower = anch.pattern.toLowerCase();
            const docLower = docText.toLowerCase();
            let aIdx = docLower.indexOf(patLower, lastDocIndex);
            if (aIdx === -1) aIdx = docLower.indexOf(patLower);
            if (aIdx !== -1) {
              matchStart = aIdx + anch.offsetInPattern;
              matchLength = searchPhrase.length;
              break;
            }
          }
        }
      }

      // STRATEGY 3: Whole context range search
      if (matchStart === -1 && rawContext && rawContext.length > 3) {
        const cleanContext = rawContext.replace(/[.,!?;:\s]+$/, "").trim();
        let ctxPos = docText.toLowerCase().indexOf(cleanContext.toLowerCase(), lastDocIndex);
        if (ctxPos === -1) {
          ctxPos = docText.toLowerCase().indexOf(cleanContext.toLowerCase());
        }

        // If context not found directly, try finding by 2-3 key words of context
        if (ctxPos === -1) {
          const words = cleanContext.split(/\s+/).filter((w) => w.length > 2);
          if (words.length >= 2) {
            const probe = words.slice(0, 3).join(" ").toLowerCase();
            ctxPos = docText.toLowerCase().indexOf(probe, lastDocIndex);
            if (ctxPos === -1) ctxPos = docText.toLowerCase().indexOf(probe);
          }
        }

        if (ctxPos !== -1) {
          const ctxWindowLen = Math.max(cleanContext.length + 30, 80);
          const ctxText = docText.substring(ctxPos, ctxPos + ctxWindowLen);

          if (isMissing && (beforeWord || afterWord)) {
            const m = findMissingWordMatch(ctxText, beforeWord, afterWord);
            if (m) {
              matchStart = ctxPos + m.index;
              matchLength = m.length;
              matchedBeforeWord = m.beforeWord;
              matchedAfterWord = m.afterWord;
            }
          } else if (!isMissing && searchPhrase) {
            const idx = findWordMatchIndex(ctxText, searchPhrase);
            if (idx !== -1) {
              matchStart = ctxPos + idx;
              matchLength = searchPhrase.length;
            }
          }
        }
      }

      // STRATEGY 4: Candidate Context Scoring (scores all occurrences by surrounding context words)
      if (matchStart === -1 && rawContext && !isMissing && searchPhrase) {
        const candList: number[] = [];
        const docLower = docText.toLowerCase();
        const origLower = searchPhrase.toLowerCase();
        let pos = 0;
        while (pos <= docText.length - searchPhrase.length) {
          const idx = docLower.indexOf(origLower, pos);
          if (idx === -1) break;
          if (isWordBoundaryMatch(docText, idx, searchPhrase.length)) {
            candList.push(idx);
          }
          pos = idx + 1;
        }

        if (candList.length > 0) {
          const ctxWords = rawContext
            .toLowerCase()
            .split(/\s+/)
            .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
            .filter((w) => w.length > 1 && w !== origLower);

          let bestCand = -1;
          let bestScore = -1;

          for (const cand of candList) {
            const winStart = Math.max(0, cand - 60);
            const winEnd = Math.min(docText.length, cand + searchPhrase.length + 60);
            const winText = docText.substring(winStart, winEnd).toLowerCase();

            let score = 0;
            for (const cw of ctxWords) {
              if (winText.includes(cw)) score += 15;
            }
            if (cand >= lastDocIndex) score += 5;

            if (score > bestScore) {
              bestScore = score;
              bestCand = cand;
            }
          }

          if (bestCand !== -1 && bestScore > 0) {
            matchStart = bestCand;
            matchLength = searchPhrase.length;
          }
        }
      }

      // STRATEGY 5: Search sequentially forward from lastDocIndex
      if (matchStart === -1) {
        if (isMissing && (beforeWord || afterWord)) {
          const sub = docText.substring(lastDocIndex);
          const m = findMissingWordMatch(sub, beforeWord, afterWord);
          if (m) {
            matchStart = lastDocIndex + m.index;
            matchLength = m.length;
            matchedBeforeWord = m.beforeWord;
            matchedAfterWord = m.afterWord;
          }
        } else if (!isMissing && searchPhrase) {
          const idx = findWordMatchIndex(docText.substring(lastDocIndex), searchPhrase);
          if (idx !== -1) {
            matchStart = lastDocIndex + idx;
            matchLength = searchPhrase.length;
          }
        }
      }

      // STRATEGY 6: Final fallback (anywhere in docText)
      if (matchStart === -1) {
        if (isMissing && (beforeWord || afterWord)) {
          const m = findMissingWordMatch(docText, beforeWord, afterWord);
          if (m) {
            matchStart = m.index;
            matchLength = m.length;
            matchedBeforeWord = m.beforeWord;
            matchedAfterWord = m.afterWord;
          }
        } else if (!isMissing && searchPhrase) {
          const idx = findWordMatchIndex(docText, searchPhrase);
          if (idx !== -1) {
            matchStart = idx;
            matchLength = searchPhrase.length;
          }
        }
      }

      // If position found, locate DOM text node via charMap and insert highlight
      if (matchStart !== -1 && matchLength > 0 && matchStart + matchLength <= charMap.length) {
        const startEntry = charMap[matchStart];
        const endEntry = charMap[matchStart + matchLength - 1];

        if (startEntry && endEntry && startEntry.node === endEntry.node) {
          const targetNode = startEntry.node;
          const nodeOffset = startEntry.offset;
          const textContent = targetNode.textContent || "";
          const beforeText = textContent.substring(0, nodeOffset);
          const matchedText = textContent.substring(nodeOffset, nodeOffset + matchLength);
          const afterText = textContent.substring(nodeOffset + matchLength);
          const parent = targetNode.parentNode;

          if (parent) {
            if (isMissing && (matchedBeforeWord || matchedAfterWord)) {
              const caretSpan = document.createElement("span");
              caretSpan.className = "ai-proofread-missing-caret";
              caretSpan.dataset.errorId = `missing-${Date.now()}-${idx}`;
              caretSpan.dataset.original = matchedAfterWord ? `${matchedBeforeWord} ${matchedAfterWord}`.trim() : matchedBeforeWord;
              caretSpan.dataset.replacement = replacement;
              caretSpan.dataset.explanation = cor.explanation || "";
              caretSpan.dataset.type = "missing-word";
              caretSpan.dataset.beforeWord = matchedBeforeWord;
              caretSpan.dataset.afterWord = matchedAfterWord;
              caretSpan.innerHTML = `+ ‸`;
              caretSpan.title = `علامة إقحام: ينقص هنا "${replacement}"`;

              const frag = document.createDocumentFragment();
              if (beforeText) frag.appendChild(document.createTextNode(beforeText));
              if (matchedBeforeWord) frag.appendChild(document.createTextNode(matchedBeforeWord + " "));
              frag.appendChild(caretSpan);
              if (matchedAfterWord) frag.appendChild(document.createTextNode(" " + matchedAfterWord));
              if (afterText) frag.appendChild(document.createTextNode(afterText));
              parent.replaceChild(frag, targetNode);
              count++;
              lastDocIndex = matchStart + matchLength;
            } else if (!isMissing) {
              const span = document.createElement("span");
              const errType = cor.type || "grammar";
              span.className = `ai-proofread-error ai-type-${errType}`;
              span.dataset.errorId = `err-${Date.now()}-${idx}`;
              span.dataset.original = searchPhrase;
              span.dataset.replacement = minimal.replacement;
              span.dataset.explanation = cor.explanation || "";
              span.dataset.type = errType;
              span.textContent = matchedText;

              const fragment = document.createDocumentFragment();
              if (beforeText) fragment.appendChild(document.createTextNode(beforeText));
              fragment.appendChild(span);
              if (afterText) fragment.appendChild(document.createTextNode(afterText));
              parent.replaceChild(fragment, targetNode);
              count++;
              lastDocIndex = matchStart + matchLength;
            }
          }
        }
      }
    });

    return count;
  };

  // Start AI Proofreading request
  const handleStartProofread = async () => {
    if (!editorRef.current) return;
    const rawText = (editorRef.current.innerText || editorRef.current.textContent || "").replace(/[\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, " ");
    if (!rawText.trim()) {
      setProofreadStatusMessage("يرجى كتابة نص في الورقة أولاً ليقوم الذكاء الاصطناعي بتدقيقه.");
      setTimeout(() => setProofreadStatusMessage(null), 4000);
      return;
    }

    setIsProofreading(true);
    setShowModelPicker(false);
    setShowLangPicker(false);
    setProofreadStatusMessage("جاري تدقيق وتحليل النص بالذكاء الاصطناعي...");

    try {
      const savedKey = localStorage.getItem("settings_gemini_api_key") || "";
      const savedGroqKey = localStorage.getItem("settings_groq_api_key") || "";
      const customKey = localStorage.getItem("custom_api_key") || savedKey;
      const res = await fetch("/api/notes/proofread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawText,
          targetLanguage: proofreadLanguage,
          selectedModel: proofreadModel,
          geminiApiKey: savedKey,
          customApiKey: customKey,
          groqApiKey: savedGroqKey
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "تعذر إجراء التدقيق بالذكاء الاصطناعي");
      }

      const data = await res.json();
      const corrections = data.corrections || [];

      if (!data.hasErrors || corrections.length === 0) {
        clearAllMarks();
        setProofreadStatusMessage("🎉 ممتاز! النص سليم تماماً وخالٍ من الأخطاء اللغوية والإملائية.");
        setTimeout(() => setProofreadStatusMessage(null), 4500);
        setIsProofreading(false);
        return;
      }

      const count = markCorrectionsInElement(editorRef.current, corrections);
      setActiveCorrectionsCount(count);
      triggerAutoSave();

      if (count === 0) {
        setProofreadStatusMessage(
          data.summary ||
            `تم رصد ${corrections.length} ملاحظة بواسطة الذكاء الاصطناعي ولكن تعذر تحديد موقعها في المحرر.`
        );
      } else if (count === 1) {
        setProofreadStatusMessage("تم العثور على ملاحظة واحدة. مرر المؤشر فوق الخطأ لمعاينة التصحيح وتطبيقه.");
      } else if (count === 2) {
        setProofreadStatusMessage("تم العثور على ملاحظتين. مرر المؤشر فوق أي خطأ لمعاينة التصحيح وتطبيقه.");
      } else if (count >= 3 && count <= 10) {
        setProofreadStatusMessage(`تم العثور على ${count} ملاحظات. مرر المؤشر فوق أي خطأ لمعاينة التصحيح وتطبيقه.`);
      } else {
        setProofreadStatusMessage(`تم العثور على ${count} ملاحظة. مرر المؤشر فوق أي خطأ لمعاينة التصحيح وتطبيقه.`);
      }
      setTimeout(() => setProofreadStatusMessage(null), 5000);
    } catch (err: any) {
      console.error("Proofread failed:", err);
      setProofreadStatusMessage(err.message || "حدث خطأ أثناء فحص النص");
      setTimeout(() => setProofreadStatusMessage(null), 5000);
    } finally {
      setIsProofreading(false);
    }
  };

  // Editor hover & click interactions for proofread spans and missing word carets
  const handleEditorMouseMove = (e: React.MouseEvent) => {
    if (selectionBubble) return;
    const target = (e.target as HTMLElement).closest(".ai-proofread-error, .ai-proofread-missing-caret") as HTMLElement | null;
    if (target && (target.dataset.original || target.dataset.replacement)) {
      if (popoverCloseTimeoutRef.current) {
        clearTimeout(popoverCloseTimeoutRef.current);
        popoverCloseTimeoutRef.current = null;
      }
      const rect = target.getBoundingClientRect();
      const isFlipped = rect.top < 210;
      setHoveredCorrection({
        id: target.dataset.errorId || "",
        original: target.dataset.original || "",
        replacement: target.dataset.replacement || "",
        explanation: target.dataset.explanation || "",
        type: target.dataset.type || "grammar",
        beforeWord: target.dataset.beforeWord,
        afterWord: target.dataset.afterWord,
        top: isFlipped ? rect.bottom + 8 : rect.top - 8,
        left: rect.left + rect.width / 2,
        isFlipped,
        element: target
      });
    } else {
      if (hoveredCorrection && !popoverCloseTimeoutRef.current) {
        popoverCloseTimeoutRef.current = setTimeout(() => {
          setHoveredCorrection(null);
          popoverCloseTimeoutRef.current = null;
        }, 300);
      }
    }
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest(".ai-proofread-error, .ai-proofread-missing-caret") as HTMLElement | null;
    if (target && (target.dataset.original || target.dataset.replacement)) {
      if (popoverCloseTimeoutRef.current) {
        clearTimeout(popoverCloseTimeoutRef.current);
        popoverCloseTimeoutRef.current = null;
      }
      const rect = target.getBoundingClientRect();
      const isFlipped = rect.top < 210;
      setHoveredCorrection({
        id: target.dataset.errorId || "",
        original: target.dataset.original || "",
        replacement: target.dataset.replacement || "",
        explanation: target.dataset.explanation || "",
        type: target.dataset.type || "grammar",
        beforeWord: target.dataset.beforeWord,
        afterWord: target.dataset.afterWord,
        top: isFlipped ? rect.bottom + 8 : rect.top - 8,
        left: rect.left + rect.width / 2,
        isFlipped,
        element: target
      });
    }
  };

  const handleEditorMouseLeave = () => {
    if (hoveredCorrection && !popoverCloseTimeoutRef.current) {
      popoverCloseTimeoutRef.current = setTimeout(() => {
        setHoveredCorrection(null);
        popoverCloseTimeoutRef.current = null;
      }, 350);
    }
  };

  // Apply single correction (or insert missing word)
  const applyCorrection = (corr: HoveredCorrectionInfo) => {
    if (!corr.element) return;
    const parent = corr.element.parentNode;
    if (parent) {
      const isMissing = corr.type === "missing-word" || corr.element.classList.contains("ai-proofread-missing-caret");
      // For missing word, insert text node cleanly
      const textNode = document.createTextNode(corr.replacement);
      parent.replaceChild(textNode, corr.element);
      parent.normalize();
      setHoveredCorrection(null);
      if (editorRef.current) {
        const remaining = editorRef.current.querySelectorAll(".ai-proofread-error, .ai-proofread-missing-caret").length;
        setActiveCorrectionsCount(remaining);
      }
      triggerAutoSave();
    }
  };

  // Dismiss single correction (keep original word or remove caret)
  const dismissCorrection = (corr: HoveredCorrectionInfo) => {
    if (!corr.element) return;
    const parent = corr.element.parentNode;
    if (parent) {
      const isMissing = corr.type === "missing-word" || corr.element.classList.contains("ai-proofread-missing-caret");
      if (isMissing) {
        corr.element.remove();
      } else {
        const originalText = corr.element.textContent || corr.original;
        const textNode = document.createTextNode(originalText);
        parent.replaceChild(textNode, corr.element);
      }
      parent.normalize();
      setHoveredCorrection(null);
      if (editorRef.current) {
        const remaining = editorRef.current.querySelectorAll(".ai-proofread-error, .ai-proofread-missing-caret").length;
        setActiveCorrectionsCount(remaining);
      }
      triggerAutoSave();
    }
  };

  // Apply all corrections at once
  const applyAllCorrections = () => {
    if (!editorRef.current) return;
    // 1. Error spans
    const spans = editorRef.current.querySelectorAll(".ai-proofread-error") as NodeListOf<HTMLElement>;
    spans.forEach((span) => {
      const replacement = span.dataset.replacement;
      if (replacement) {
        span.replaceWith(document.createTextNode(replacement));
      }
    });

    // 2. Missing word carets
    const carets = editorRef.current.querySelectorAll(".ai-proofread-missing-caret") as NodeListOf<HTMLElement>;
    carets.forEach((caret) => {
      const replacement = caret.dataset.replacement;
      if (replacement) {
        caret.replaceWith(document.createTextNode(replacement));
      }
    });

    editorRef.current.normalize();
    setHoveredCorrection(null);
    setActiveCorrectionsCount(0);
    triggerAutoSave();
    setProofreadStatusMessage("✅ تم تطبيق جميع التصحيحات بنجاح!");
    setTimeout(() => setProofreadStatusMessage(null), 3000);
  };

  // Clear all error highlights without replacing
  const clearAllMarks = () => {
    if (!editorRef.current) return;
    clearCorrectionsInElement(editorRef.current);
    setHoveredCorrection(null);
    setActiveCorrectionsCount(0);
    triggerAutoSave();
  };

  // Formatting execution (without any shortcuts)
  const formatText = (command: string, value: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    triggerAutoSave();
  };

  // Copy plain text
  const handleCopy = () => {
    if (!activeNote) return;
    const plain = activeNote.plainText || getPlainText(activeNote.content);
    const fullText = activeNote.title ? `${activeNote.title}\n\n${plain}` : plain;
    navigator.clipboard.writeText(fullText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  // Simple stats
  const wordCount = useMemo(() => {
    if (!activeNote) return 0;
    const text = (activeNote.plainText || getPlainText(activeNote.content)).trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }, [activeNote]);

  // Helper to retrieve Piper models per language
  const getPiperModelsForLang = useCallback((langId: string) => {
    const defaultPiperModels: Record<string, Array<{ id: string; name: string; flag: string; desc: string }>> = {
      German: [
        { id: "de_DE-thorsten-medium", name: "Thorsten Medium", flag: "🇩🇪", desc: "ألماني - معتدل متزن" },
        { id: "de_DE-thorsten-high", name: "Thorsten High", flag: "🇩🇪", desc: "ألماني - عالي الدقة وواقعي" },
        { id: "de_DE-kerstin-low", name: "Kerstin Low", flag: "🇩🇪", desc: "ألماني أنثوي - طبيعي وهادئ" },
        { id: "de_DE-amany-medium", name: "Amany Medium", flag: "🇩🇪", desc: "ألماني - نطق تعليمي واضح" },
        { id: "de_DE-pavoque-low", name: "Pavoque Low", flag: "🇩🇪", desc: "ألماني - سريع وخفيف" },
      ],
      Arabic: [
        { id: "ar_JO-kareem-medium", name: "Kareem Medium", flag: "🇸🇦", desc: "عربي فصيح متقن وواضح" },
      ],
      English: [
        { id: "en_US-lessac-medium", name: "Lessac Medium", flag: "🇺🇸", desc: "إنجليزي أمريكي - احترافي" },
        { id: "en_US-bryce-medium", name: "Bryce Medium", flag: "🇺🇸", desc: "إنجليزي هادئ ومريح" },
      ],
      French: [
        { id: "fr_FR-siwis-medium", name: "Siwis Medium", flag: "🇫🇷", desc: "فرنسي متوازن وأصيل" },
      ],
      Spanish: [
        { id: "es_ES-davefx-medium", name: "Dave Medium", flag: "🇪🇸", desc: "إسباني طبيعي واضح" },
      ],
      Italian: [
        { id: "it_IT-riccardo-x_low", name: "Riccardo Low", flag: "🇮🇹", desc: "إيطالي سلس وخفيف" },
      ]
    };

    const defaults = defaultPiperModels[langId] || [];
    const langShort = langId === "German" ? "de" : langId === "Arabic" ? "ar" : langId === "English" ? "en" : langId === "French" ? "fr" : langId === "Spanish" ? "es" : "it";

    const extraInstalled = installedPiperModels
      .filter((m) => m.id.toLowerCase().startsWith(`${langShort}_`) && !defaults.some((d) => d.id === m.id))
      .map((m) => ({ id: m.id, name: m.name || m.id, flag: m.flag || "🧠", desc: "نموذج عصبي محلي" }));

    return [...defaults, ...extraInstalled];
  }, [installedPiperModels]);

  // Handle setting voice model
  const handleSelectVoiceModel = (model: string) => {
    setSelectedVoiceModel(model);
    localStorage.setItem("notes_tts_voice_model", model);
  };

  // Handle setting speech rate
  const handleSetSpeechRate = (rate: number) => {
    setSpeechRate(rate);
    localStorage.setItem("notes_tts_speech_rate", String(rate));
  };

  // Speak selected text via configured voice model (Google TTS, Piper Neural, or Web Speech)
  const speakSelectedText = useCallback(
    (textToSpeak?: string, customModel?: string, customRate?: number, customLang?: string) => {
      const text = textToSpeak || selectionBubble?.text;
      if (!text || typeof window === "undefined") return;

      try {
        // If already speaking and no explicit test text passed, toggle off / stop immediately
        if (isSpeakingSelection && !textToSpeak) {
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.src = "";
            currentAudioRef.current = null;
          }
          if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
          }
          setIsSpeakingSelection(false);
          return;
        }

        // Stop any current audio
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current.src = "";
          currentAudioRef.current = null;
        }
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }

        // Determine language: If text has Arabic chars, prioritize Arabic, else active note's or custom language
        const hasArabic = /[\u0600-\u06FF]/.test(text);
        const targetLang = customLang || (hasArabic ? "Arabic" : proofreadLanguage);
        const langShort = targetLang === "German" ? "de"
          : targetLang === "Arabic" ? "ar"
          : targetLang === "English" ? "en"
          : targetLang === "French" ? "fr"
          : targetLang === "Spanish" ? "es"
          : targetLang === "Italian" ? "it"
          : "de";
        const langIso = LANG_TO_TTS_CODE[targetLang] || "de-DE";

        const voice = customModel !== undefined ? customModel : selectedVoiceModel;
        const rate = customRate !== undefined ? customRate : speechRate;

        // Fallback or native Web Speech API implementation
        const speakViaWebSpeech = () => {
          if (!("speechSynthesis" in window)) {
            setIsSpeakingSelection(false);
            return;
          }
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = langIso;
          utterance.rate = rate;

          if (voice && voice !== "webspeech" && voice !== "google" && !voice.includes("medium") && !voice.includes("high") && !voice.includes("low")) {
            const matched = availableVoices.find((v) => v.voiceURI === voice || v.name === voice);
            if (matched) utterance.voice = matched;
          } else {
            const match = availableVoices.find((v) => v.lang.toLowerCase().startsWith(langShort));
            if (match) utterance.voice = match;
          }

          utterance.onstart = () => setIsSpeakingSelection(true);
          utterance.onend = () => setIsSpeakingSelection(false);
          utterance.onerror = () => setIsSpeakingSelection(false);

          window.speechSynthesis.speak(utterance);
        };

        // Determine if server-based Piper model or Google Translate TTS is chosen
        const isPiperOrGoogle =
          voice === "google" ||
          voice === "google_tts" ||
          voice?.startsWith("de_") ||
          voice?.startsWith("ar_") ||
          voice?.startsWith("en_") ||
          voice?.startsWith("fr_") ||
          voice?.startsWith("es_") ||
          voice?.startsWith("it_") ||
          voice?.includes("medium") ||
          voice?.includes("high") ||
          voice?.includes("low") ||
          voice?.endsWith(".onnx");

        if (isPiperOrGoogle) {
          setIsSpeakingSelection(true);

          // Language mismatch safety check
          let effectiveVoice = voice;
          if (effectiveVoice.startsWith("de_") && langShort !== "de") {
            effectiveVoice = langShort === "ar" ? "ar_JO-kareem-medium" : langShort === "en" ? "en_US-lessac-medium" : "google";
          } else if (effectiveVoice.startsWith("ar_") && langShort !== "ar") {
            effectiveVoice = langShort === "de" ? "de_DE-thorsten-medium" : langShort === "en" ? "en_US-lessac-medium" : "google";
          }

          const voiceParam = `&voice=${encodeURIComponent(effectiveVoice)}`;
          const ttsUrl = `/api/tts?text=${encodeURIComponent(text)}&lang=${langShort}${voiceParam}`;

          const audio = new Audio(ttsUrl);
          audio.playbackRate = rate;
          currentAudioRef.current = audio;

          audio.onplay = () => {
            setIsSpeakingSelection(true);
          };
          audio.onended = () => {
            setIsSpeakingSelection(false);
            currentAudioRef.current = null;
          };
          audio.onerror = () => {
            console.warn("TTS Audio endpoint failed, falling back to Web Speech API");
            speakViaWebSpeech();
          };

          audio.play().catch((err) => {
            console.warn("Audio playback rejected, falling back to Web Speech API:", err);
            speakViaWebSpeech();
          });
          return;
        }

        // WebSpeech API
        speakViaWebSpeech();
      } catch (err) {
        console.error("Speech synthesis error:", err);
        setIsSpeakingSelection(false);
      }
    },
    [selectionBubble, isSpeakingSelection, proofreadLanguage, selectedVoiceModel, speechRate, availableVoices]
  );

  // Test voice sample in settings modal
  const handleTestVoiceInModal = (modelToTest?: string) => {
    const model = modelToTest || selectedVoiceModel;
    const testTexts: Record<string, string> = {
      German: "Guten Tag! Dies ist eine Hörprobe für die ausgewählte Stimme.",
      Arabic: "مرحباً بك! هذا اختبار صوتي واضح للنموذج المختار للنطق.",
      English: "Hello! This is a voice sample for your chosen speech model.",
      French: "Bonjour! Ceci est un échantillon vocal pour le modèle choisi.",
      Spanish: "¡Hola! Esta es una prueba de voz para el modelo seleccionado.",
      Italian: "Ciao! Questo è un test vocale per il modello selezionato."
    };
    const sample = testTexts[testVoiceLang] || testTexts["German"];
    setIsTestingVoice(true);
    speakSelectedText(sample, model, speechRate, testVoiceLang);
    setTimeout(() => {
      setIsTestingVoice(false);
    }, 3500);
  };

  // Copy selected text to clipboard
  const handleCopySelection = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectionBubble?.text) return;
    navigator.clipboard.writeText(selectionBubble.text);
    setSelectionCopied(true);
    setTimeout(() => setSelectionCopied(false), 2000);
  };

  // Inspect current user text selection on paper/editor
  const checkSelection = useCallback(() => {
    if (typeof window === "undefined") return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setSelectionBubble(null);
      setIsTranslateOpen(false);
      return;
    }

    const text = sel.toString().trim();
    if (!text || text.length === 0) {
      setSelectionBubble(null);
      setIsTranslateOpen(false);
      return;
    }

    const sheet = document.getElementById("printable-paper-sheet");
    if (!sheet) {
      setSelectionBubble(null);
      setIsTranslateOpen(false);
      return;
    }

    const anchor = sel.anchorNode;
    const focus = sel.focusNode;
    const isInside =
      (anchor && sheet.contains(anchor)) ||
      (focus && sheet.contains(focus));

    if (!isInside) {
      setSelectionBubble(null);
      setIsTranslateOpen(false);
      return;
    }

    try {
      const range = sel.getRangeAt(0);
      savedRangeRef.current = range.cloneRange();
      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        setSelectionBubble(null);
        setIsTranslateOpen(false);
        return;
      }

      // If near top of screen, place bubble beneath selection; else above
      const isFlipped = rect.top < 85;
      const top = isFlipped ? rect.bottom + 8 : rect.top - 8;
      const left = rect.left + rect.width / 2;

      setSelectionBubble((prev) => {
        if (prev && prev.text !== text) {
          setIsTranslateOpen(false);
          setTranslationState(null);
        }
        return {
          text,
          top,
          left,
          isFlipped
        };
      });
    } catch (e) {
      setSelectionBubble(null);
      setIsTranslateOpen(false);
    }
  }, []);

  // Perform official Google Translate query (free Google GTX API, strictly non-AI)
  const handleTranslateGoogle = useCallback(
    async (textToTranslate?: string, srcLang?: string, tgtLang?: string) => {
      const text = (textToTranslate || selectionBubble?.text || customTranslateInput || "").trim();
      if (!text) return;

      const hasArabic = /[\u0600-\u06FF]/.test(text);
      const defaultSrc = srcLang !== undefined ? srcLang : (hasArabic ? "ar" : "auto");
      const defaultTgt = tgtLang !== undefined
        ? tgtLang
        : (hasArabic
            ? (LANG_TO_GOOGLE_CODE[proofreadLanguage] || "de")
            : "ar");

      setIsTranslateOpen(true);
      setTranslationState({
        originalText: text,
        translatedText: "",
        sourceLang: defaultSrc,
        targetLang: defaultTgt,
        isLoading: true,
        error: undefined
      });

      try {
        // 1. Direct browser fetch to Google Translate (Instant: ~80ms, zero server load, directly from user's browser)
        try {
          const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(defaultSrc)}&tl=${encodeURIComponent(defaultTgt)}&dt=t&q=${encodeURIComponent(text)}`;
          const gtxRes = await fetch(gtxUrl);
          if (gtxRes.ok) {
            const gtxData = await gtxRes.json();
            if (Array.isArray(gtxData[0])) {
              const translated = gtxData[0].map((item: any) => (item && item[0]) || "").join("");
              const detectedSource = gtxData[2] || defaultSrc;
              setTranslationState({
                originalText: text,
                translatedText: translated,
                sourceLang: detectedSource,
                targetLang: defaultTgt,
                isLoading: false
              });
              return;
            }
          }
        } catch (directErr) {
          // Direct fetch blocked (e.g. browser extension or ad-blocker), fallback to server proxy below
        }

        // 2. Server-side Google Translate proxy fallback
        const res = await fetch(
          `/api/translate?text=${encodeURIComponent(text)}&sl=${encodeURIComponent(defaultSrc)}&tl=${encodeURIComponent(defaultTgt)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.translatedText) {
            setTranslationState({
              originalText: text,
              translatedText: data.translatedText,
              sourceLang: data.sourceLang || defaultSrc,
              targetLang: defaultTgt,
              isLoading: false
            });
            return;
          }
        }

        throw new Error("تعذر جلب الترجمة من Google Translate");
      } catch (err: any) {
        console.error("Google Translation error:", err);
        setTranslationState((prev) =>
          prev
            ? {
                ...prev,
                isLoading: false,
                error: "تعذر الاتصال بخدمة الترجمة. يرجى التحقق من الاتصال بالإنترنت."
              }
            : null
        );
      }
    },
    [selectionBubble, customTranslateInput, proofreadLanguage]
  );

  // Swap translation languages (e.g. DE -> AR to AR -> DE)
  const handleSwapTranslationLanguages = () => {
    if (!translationState) return;
    const currentSrc = translationState.sourceLang === "auto"
      ? (/[\u0600-\u06FF]/.test(translationState.originalText) ? "ar" : (LANG_TO_GOOGLE_CODE[proofreadLanguage] || "de"))
      : translationState.sourceLang;
    const currentTgt = translationState.targetLang;

    const newSrc = currentTgt;
    const newTgt = currentSrc;

    handleTranslateGoogle(translationState.originalText, newSrc, newTgt);
  };

  // Change translation target language
  const handleChangeTranslationTargetLang = (newTgt: string) => {
    if (!translationState) return;
    handleTranslateGoogle(translationState.originalText, translationState.sourceLang, newTgt);
  };

  // Replace selected text with translated text
  const handleReplaceSelectionWithTranslation = () => {
    if (!translationState?.translatedText || !editorRef.current) return;
    try {
      editorRef.current.focus();
      if (savedRangeRef.current) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        }
      }
      document.execCommand("insertText", false, translationState.translatedText);
      triggerAutoSave();
    } catch (e) {
      console.warn("Could not replace text with translation:", e);
    }
    setSelectionBubble(null);
    setIsTranslateOpen(false);
  };

  // Insert translation after selected text
  const handleInsertTranslationAfter = () => {
    if (!translationState?.translatedText || !editorRef.current) return;
    try {
      editorRef.current.focus();
      if (savedRangeRef.current) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          const r = savedRangeRef.current.cloneRange();
          r.collapse(false);
          sel.addRange(r);
        }
      }
      document.execCommand("insertText", false, ` (${translationState.translatedText})`);
      triggerAutoSave();
    } catch (e) {
      console.warn("Could not insert translation:", e);
    }
    setSelectionBubble(null);
    setIsTranslateOpen(false);
  };

  // Copy translated text to clipboard
  const handleCopyTranslation = () => {
    if (!translationState?.translatedText) return;
    navigator.clipboard.writeText(translationState.translatedText);
    setTranslationCopied(true);
    setTimeout(() => setTranslationCopied(false), 2000);
  };

  // Speak translation using configured voice
  const handleSpeakTranslation = () => {
    if (!translationState?.translatedText) return;
    const tgt = translationState.targetLang;
    const tgtName = tgt === "ar" ? "Arabic"
      : tgt === "de" ? "German"
      : tgt === "en" ? "English"
      : tgt === "fr" ? "French"
      : tgt === "es" ? "Spanish"
      : tgt === "it" ? "Italian"
      : "German";
    speakSelectedText(translationState.translatedText, undefined, undefined, tgtName);
  };

  // Duplicate current line (or selected lines) down on Shift + Ctrl/Cmd/Alt + ArrowDown
  const handleDuplicateLineDown = useCallback((e?: React.KeyboardEvent | KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!editorRef.current) return;
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    // Ensure selection is inside the editor
    if (!editor.contains(range.startContainer) && !editor.contains(range.endContainer)) {
      return;
    }

    // Helper to calculate character offset of cursor relative to a block node
    const getCharOffset = (root: Node, targetNode: Node, targetOffset: number): number => {
      let charCount = 0;
      let found = false;
      const walk = (node: Node) => {
        if (found) return;
        if (node === targetNode) {
          charCount += targetOffset;
          found = true;
          return;
        }
        if (node.nodeType === Node.TEXT_NODE) {
          charCount += (node.textContent || "").length;
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            walk(node.childNodes[i]);
            if (found) return;
          }
        }
      };
      walk(root);
      return charCount;
    };

    // Helper to restore character offset inside a cloned block node
    const setCharOffset = (root: Node, targetOffset: number) => {
      let charCount = 0;
      let placed = false;
      const s = window.getSelection();
      if (!s) return;

      const walk = (node: Node) => {
        if (placed) return;
        if (node.nodeType === Node.TEXT_NODE) {
          const len = (node.textContent || "").length;
          if (charCount + len >= targetOffset) {
            const offset = Math.min(len, Math.max(0, targetOffset - charCount));
            const newRange = document.createRange();
            newRange.setStart(node, offset);
            newRange.collapse(true);
            s.removeAllRanges();
            s.addRange(newRange);
            placed = true;
            return;
          }
          charCount += len;
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            walk(node.childNodes[i]);
            if (placed) return;
          }
        }
      };

      walk(root);
      if (!placed) {
        const newRange = document.createRange();
        newRange.selectNodeContents(root);
        newRange.collapse(false);
        s.removeAllRanges();
        s.addRange(newRange);
      }
      editor.focus();
    };

    // Clean cloned node of any AI proofreading markers or temporary IDs
    const cleanClonedElement = (node: Node) => {
      if (node instanceof HTMLElement) {
        node.removeAttribute("id");
        const missingCarets = node.querySelectorAll(".ai-proofread-missing-caret");
        missingCarets.forEach((c) => c.remove());
        const errorSpans = node.querySelectorAll(".ai-proofread-error");
        errorSpans.forEach((span) => {
          const text = span.textContent || "";
          span.replaceWith(document.createTextNode(text));
        });
      }
    };

    // 1. Identify direct child nodes of editor that bound the selection
    let startChild: Node | null = range.startContainer;
    while (startChild && startChild.parentNode !== editor) {
      startChild = startChild.parentNode;
    }

    let endChild: Node | null = range.endContainer;
    while (endChild && endChild.parentNode !== editor) {
      endChild = endChild.parentNode;
    }

    // If editor itself is the start/end container
    if (!startChild) {
      if (range.startContainer === editor && editor.childNodes.length > 0) {
        startChild = editor.childNodes[Math.min(range.startOffset, editor.childNodes.length - 1)];
      } else {
        startChild = editor.firstChild;
      }
    }
    if (!endChild) {
      if (range.endContainer === editor && editor.childNodes.length > 0) {
        endChild = editor.childNodes[Math.min(range.endOffset, editor.childNodes.length - 1)];
      } else {
        endChild = startChild;
      }
    }

    if (!startChild || !endChild) {
      editor.innerHTML = "<div><br></div><div><br></div>";
      triggerAutoSave();
      return;
    }

    // CASE A: Standard block children (e.g. <div>Line 1</div><div>Line 2</div> or <p>...</p>)
    const isBlockElement = (n: Node) =>
      n.nodeType === Node.ELEMENT_NODE &&
      /^(DIV|P|LI|H[1-6]|BLOCKQUOTE|PRE)$/i.test((n as HTMLElement).tagName);

    if (isBlockElement(startChild)) {
      // Collect all blocks in selection from startChild to endChild
      const blocksToDuplicate: Node[] = [];
      let curr: Node | null = startChild;
      let foundEnd = false;

      while (curr) {
        blocksToDuplicate.push(curr);
        if (curr === endChild) {
          foundEnd = true;
          break;
        }
        curr = curr.nextSibling;
      }

      if (!foundEnd) {
        blocksToDuplicate.length = 0;
        blocksToDuplicate.push(startChild);
      }

      // Record cursor offset in the primary block
      const startOffsetInBlock = getCharOffset(startChild, range.startContainer, range.startOffset);

      // Clone each block
      const clones = blocksToDuplicate.map((b) => {
        const cl = b.cloneNode(true);
        cleanClonedElement(cl);
        return cl;
      });

      // Insert clones immediately after the last block
      const insertAnchor = blocksToDuplicate[blocksToDuplicate.length - 1];
      const insertRef = insertAnchor.nextSibling;

      clones.forEach((clonedBlock) => {
        editor.insertBefore(clonedBlock, insertRef);
      });

      // Set caret into the first cloned block at the same relative offset
      if (clones.length > 0) {
        setCharOffset(clones[0], startOffsetInBlock);
      }

      triggerAutoSave();
      return;
    }

    // CASE B: Inline nodes separated by <br> or raw text directly inside editor
    const parentContainer = (startChild.parentNode === editor) ? editor : (startChild.parentElement || editor);
    const childList = Array.from(parentContainer.childNodes);

    const startIndex = childList.indexOf(startChild as ChildNode);
    const endIndex = childList.indexOf(endChild as ChildNode);

    const actualStart = Math.min(startIndex !== -1 ? startIndex : 0, endIndex !== -1 ? endIndex : 0);
    const actualEnd = Math.max(startIndex !== -1 ? startIndex : 0, endIndex !== -1 ? endIndex : childList.length - 1);

    // Expand backwards to the nearest <br> or beginning of container
    let lineStart = actualStart;
    while (lineStart > 0 && childList[lineStart - 1].nodeName !== "BR") {
      lineStart--;
    }

    // Expand forwards to the nearest <br> or end of container
    let lineEnd = actualEnd;
    while (lineEnd < childList.length - 1 && childList[lineEnd].nodeName !== "BR") {
      lineEnd++;
    }

    const lineHasTrailingBr = childList[lineEnd].nodeName === "BR";
    const lineContentEnd = lineHasTrailingBr ? lineEnd - 1 : lineEnd;

    // Collect nodes of the line
    const nodesToClone: Node[] = [];
    for (let i = lineStart; i <= lineContentEnd; i++) {
      nodesToClone.push(childList[i]);
    }

    // Clone the nodes
    const clonedLineNodes = nodesToClone.map((n) => {
      const cl = n.cloneNode(true);
      cleanClonedElement(cl);
      return cl;
    });

    // Create fragment with new line break
    const fragment = document.createDocumentFragment();
    if (!lineHasTrailingBr) {
      fragment.appendChild(document.createElement("br"));
    }
    clonedLineNodes.forEach((node) => fragment.appendChild(node));
    if (lineHasTrailingBr) {
      fragment.appendChild(document.createElement("br"));
    }

    const anchorNode = childList[lineEnd];
    if (anchorNode.nextSibling) {
      parentContainer.insertBefore(fragment, anchorNode.nextSibling);
    } else {
      parentContainer.appendChild(fragment);
    }

    // Set cursor to start of cloned nodes
    if (clonedLineNodes.length > 0) {
      const firstCloned = clonedLineNodes[0];
      const newRange = document.createRange();
      newRange.setStart(firstCloned, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
      editor.focus();
    }

    triggerAutoSave();
  }, [triggerAutoSave]);

  // Handle keydown directly on the editor element
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const isDown = e.key === "ArrowDown" || e.code === "ArrowDown";
      const hasShift = e.shiftKey;
      const hasCtrlOrCmd = e.ctrlKey || e.metaKey;
      const hasAlt = e.altKey;

      if (isDown && hasShift && (hasCtrlOrCmd || hasAlt)) {
        handleDuplicateLineDown(e);
      }
    },
    [handleDuplicateLineDown]
  );

  // Selection change listener effect
  useEffect(() => {
    const handleSelectionChange = () => {
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      selectionTimeoutRef.current = setTimeout(() => {
        checkSelection();
      }, 120);
    };

    const handlePointerEnd = () => {
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      selectionTimeoutRef.current = setTimeout(() => {
        checkSelection();
      }, 40);
    };

    const handleScrollOrResize = () => {
      checkSelection();
    };

    const handleDocumentPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (bubbleRef.current && !bubbleRef.current.contains(target)) {
        // Dismiss bubble and translation if clicking outside, unless clicking within a modal
        const isInsideModal = (target as HTMLElement).closest?.("[role='dialog'], .modal-overlay, #voice-settings-modal, #google-translate-modal");
        if (!isInsideModal) {
          setSelectionBubble(null);
          setIsTranslateOpen(false);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectionBubble(null);
        setIsTranslateOpen(false);
      }

      // Check for Shift + Ctrl/Cmd/Alt + ArrowDown to duplicate line down
      const isDown = e.key === "ArrowDown" || e.code === "ArrowDown";
      const hasShift = e.shiftKey;
      const hasCtrlOrCmd = e.ctrlKey || e.metaKey;
      const hasAlt = e.altKey;

      if (isDown && hasShift && (hasCtrlOrCmd || hasAlt)) {
        if (
          editorRef.current &&
          (editorRef.current.contains(document.activeElement) ||
            editorRef.current.contains(window.getSelection()?.anchorNode || null))
        ) {
          handleDuplicateLineDown(e);
        }
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mouseup", handlePointerEnd);
    document.addEventListener("touchend", handlePointerEnd);
    document.addEventListener("mousedown", handleDocumentPointerDown);
    document.addEventListener("touchstart", handleDocumentPointerDown, { passive: true });
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    window.addEventListener("scroll", handleScrollOrResize, { passive: true, capture: true });

    return () => {
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mouseup", handlePointerEnd);
      document.removeEventListener("touchend", handlePointerEnd);
      document.removeEventListener("mousedown", handleDocumentPointerDown);
      document.removeEventListener("touchstart", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [checkSelection]);

  const currentPaperStyle = activeNote?.paperStyle || "ruled";

  return (
    <main
      id="writings-workspace-root"
      className={`flex-1 flex flex-col h-screen overflow-hidden bg-slate-100 text-slate-800 ${
        isFullscreen ? "fixed inset-0 z-50 bg-slate-900" : "relative"
      }`}
      dir="rtl"
    >
      {/* ================================================================= */}
      {/* 1. TOP HEADER (Responsive: Fits mobile screen smoothly) */}
      {/* ================================================================= */}
      <header className="h-13 sm:h-14 bg-white border-b border-slate-200 px-2 sm:px-4 md:px-6 flex items-center justify-between shrink-0 select-none z-30 shadow-2xs">
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="md:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer shrink-0"
              title="القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="font-bold text-xs sm:text-sm text-slate-800 hidden xs:inline">
              الكتابات
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-0.5 sm:mx-1 shrink-0" />

          {/* New Note Button */}
          <button
            type="button"
            onClick={handleCreateNewNote}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] sm:text-xs font-bold transition-all shadow-2xs cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ورقة جديدة</span>
            <span className="sm:hidden">جديدة</span>
          </button>

          {/* Writings List Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowNotesList(!showNotesList)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
              showNotesList
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">كتاباتي</span>
            <span>({notes.length})</span>
          </button>
        </div>

        {/* Top Right Status & Quick Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
          {/* Save status */}
          <div className="text-xs text-slate-500 font-medium px-1 sm:px-2 py-1">
            {isSaved ? (
              <span className="flex items-center gap-1 text-emerald-600 text-[11px] sm:text-xs">
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تم الحفظ</span>
              </span>
            ) : (
              <span className="text-amber-600 text-[11px]">جاري الحفظ...</span>
            )}
          </div>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="نسخ النص"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Print Button (hidden on mobile) */}
          <button
            type="button"
            onClick={handlePrint}
            className="hidden md:flex p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="طباعة الورقة"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle (hidden on small mobile) */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="hidden sm:flex p-1.5 sm:p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title={isFullscreen ? "تصغير الشاشة" : "ملء الشاشة"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDeleteCurrentNote}
            className="p-1.5 sm:p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
            title="حذف هذه الورقة"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* 2. ADAPTIVE RESPONSIVE TOOLBAR */}
      {/* ================================================================= */}

      {/* DESKTOP TOOLBAR (md and above: single wide bar) */}
      <div className="hidden md:flex bg-white border-b border-slate-200 px-3 py-1.5 shrink-0 items-center justify-between select-none shadow-2xs relative z-40 gap-3">
        {/* Left Side: Paper Type 1-Click Switcher & Font Alignment */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Paper Type Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: "ruled", label: "مسطر" },
              { id: "plain", label: "سادة" },
              { id: "grid", label: "مربعات" },
              { id: "legal", label: "أصفر" }
            ].map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => setPaperStyle(style.id as PaperStyle)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentPaperStyle === style.id
                    ? "bg-white text-blue-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>

          {/* Font Selector (عربي + إنجليزي) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: "tajawal", label: "تجوال" },
              { id: "cairo", label: "كايرو" },
              { id: "inter", label: "English" },
              { id: "amiri", label: "أميري" }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFont(f.id as any)}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedFont === f.id
                    ? "bg-white text-blue-700 shadow-2xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title={`نوع الخط: ${f.label}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Baseline Nudge: ضبط ملاصقة السطر */}
          <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-xl text-xs text-slate-600">
            <span className="text-[11px] font-medium hidden lg:inline">ملاصقة السطر:</span>
            <button
              type="button"
              onClick={() => adjustBaseline(-1)}
              className="w-5 h-5 flex items-center justify-center rounded bg-white hover:bg-slate-200 text-slate-700 font-bold cursor-pointer transition-colors"
              title="رفع السطر للأعلى 1 بكسل"
            >
              -
            </button>
            <span className="text-[11px] font-mono w-4 text-center font-bold text-blue-700">{baselineOffset > 0 ? `+${baselineOffset}` : baselineOffset}</span>
            <button
              type="button"
              onClick={() => adjustBaseline(1)}
              className="w-5 h-5 flex items-center justify-center rounded bg-white hover:bg-slate-200 text-slate-700 font-bold cursor-pointer transition-colors"
              title="خفض السطر للأسفل 1 بكسل"
            >
              +
            </button>
          </div>

          {/* AI Proofreading Control Section */}
          <div className="flex items-center gap-1.5 bg-violet-50/90 border border-violet-200/80 p-1 rounded-xl shrink-0">
            {/* Main Proofread Trigger Button */}
            <button
              type="button"
              onClick={handleStartProofread}
              disabled={isProofreading}
              className="flex items-center gap-1.5 px-3 py-1 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="تصحيح وتدقيق النص بالذكاء الاصطناعي"
            >
              {isProofreading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جارٍ التدقيق...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-violet-200" />
                  <span>تصحيح بالذكاء</span>
                </>
              )}
            </button>

            {/* Language Selector Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowLangPicker(!showLangPicker);
                  setShowModelPicker(false);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all border shadow-2xs ${
                  showLangPicker
                    ? "bg-violet-100/90 border-violet-400 text-violet-900 ring-2 ring-violet-200"
                    : "bg-white hover:bg-violet-50 border-slate-200 text-slate-700 hover:text-violet-900"
                }`}
                title="تحديد لغة الكتابة والتدقيق (الافتراضية: ألمانية)"
              >
                <span className="text-sm">{selectedLangObj.flag}</span>
                <span className="text-[11px] font-bold">{selectedLangObj.name}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            </div>

            {/* AI Model Selector Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowModelPicker(!showModelPicker);
                  setShowLangPicker(false);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all border shadow-2xs ${
                  showModelPicker
                    ? "bg-violet-100/90 border-violet-400 text-violet-900 ring-2 ring-violet-200"
                    : "bg-white hover:bg-violet-50 border-slate-200 text-slate-700 hover:text-violet-900"
                }`}
                title="تحديد موديل الذكاء للتصحيح"
              >
                <Cpu className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                <span className="max-w-[125px] lg:max-w-[160px] truncate text-[11px] font-bold">
                  {selectedModelObj.name}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>
            </div>

            {/* Active Corrections Summary Badge */}
            {activeCorrectionsCount > 0 && (
              <div className="flex items-center gap-1 bg-rose-100/90 text-rose-800 px-2 py-0.5 rounded-lg text-xs font-bold shrink-0">
                <span>{activeCorrectionsCount} خطأ</span>
                <button
                  type="button"
                  onClick={applyAllCorrections}
                  className="hover:underline text-[11px] text-rose-900 font-extrabold mr-1 cursor-pointer"
                  title="تطبيق جميع التصحيحات المقترحة في النص"
                >
                  (تطبيق الكل)
                </button>
                <button
                  type="button"
                  onClick={clearAllMarks}
                  className="text-rose-600 hover:text-rose-900 p-0.5 cursor-pointer"
                  title="مسح علامات التدقيق وإبقاء النص كما هو"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center / Right: Essential Text Formatting Tools */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Undo / Redo */}
          <button
            type="button"
            onClick={() => formatText("undo")}
            className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            title="تراجع"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => formatText("redo")}
            className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            title="إعادة"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          {/* Bold, Italic, Underline */}
          <button
            type="button"
            onClick={() => formatText("bold")}
            className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer font-black"
            title="خط عريض"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => formatText("italic")}
            className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            title="خط مائل"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => formatText("underline")}
            className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            title="تحته خط"
          >
            <Underline className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          {/* Text Color Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowTextColorPicker(!showTextColorPicker);
                setShowHighlightPicker(false);
              }}
              className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer flex items-center"
              title="لون الخط"
            >
              <Palette className="w-4 h-4 text-blue-600" />
            </button>
            {showTextColorPicker && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowTextColorPicker(false)}
                />
                <div className="absolute top-full mt-1.5 left-0 bg-white border border-slate-200 rounded-xl p-2 shadow-2xl z-50 flex gap-1.5 animate-in fade-in zoom-in-95">
                  {[
                    { color: "#000000", title: "أسود" },
                    { color: "#2563eb", title: "أزرق" },
                    { color: "#dc2626", title: "أحمر" },
                    { color: "#16a34a", title: "أخضر" },
                    { color: "#7c3aed", title: "بنفسجي" }
                  ].map((item) => (
                    <button
                      key={item.color}
                      type="button"
                      onClick={() => {
                        formatText("foreColor", item.color);
                        setShowTextColorPicker(false);
                      }}
                      className="w-5 h-5 rounded-full border border-slate-300 hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: item.color }}
                      title={item.title}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Highlight Color Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowHighlightPicker(!showHighlightPicker);
                setShowTextColorPicker(false);
              }}
              className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer flex items-center"
              title="تظليل ماركر"
            >
              <Highlighter className="w-4 h-4 text-amber-500" />
            </button>
            {showHighlightPicker && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowHighlightPicker(false)}
                />
                <div className="absolute top-full mt-1.5 left-0 bg-white border border-slate-200 rounded-xl p-2 shadow-2xl z-50 flex gap-1.5 animate-in fade-in zoom-in-95">
                  {[
                    { color: "#fef08a", title: "أصفر فسفوري" },
                    { color: "#bbf7d0", title: "أخضر فاتح" },
                    { color: "#bae6fd", title: "سماوي" },
                    { color: "#fbcfe8", title: "وردي" }
                  ].map((item) => (
                    <button
                      key={item.color}
                      type="button"
                      onClick={() => {
                        formatText("hiliteColor", item.color);
                        setShowHighlightPicker(false);
                      }}
                      className="w-5 h-5 rounded-full border border-slate-300 hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: item.color }}
                      title={item.title}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          {/* Lists: Bullet & Numbered */}
          <button
            type="button"
            onClick={() => formatText("insertUnorderedList")}
            className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            title="قائمة نقطية"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => formatText("insertOrderedList")}
            className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            title="قائمة مرقمة"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          {/* Clear Formatting */}
          <button
            type="button"
            onClick={() => formatText("removeFormat")}
            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
            title="مسح التنسيق"
          >
            <RemoveFormatting className="w-4 h-4" />
          </button>

          {/* Duplicate Line Down */}
          <button
            type="button"
            id="btn-toolbar-duplicate-line"
            onClick={() => handleDuplicateLineDown()}
            className="p-1.5 text-slate-700 hover:bg-slate-100 hover:text-blue-700 rounded-lg cursor-pointer transition-colors"
            title="نسخ السطر الحالي لأسفل (اختصار: Shift + Ctrl + ↓)"
          >
            <CopyPlus className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          {/* Google Translate Toolbar Button */}
          <button
            type="button"
            id="btn-toolbar-google-translate"
            onClick={() => {
              const sel = window.getSelection();
              const text = sel ? sel.toString().trim() : "";
              if (text) {
                handleTranslateGoogle(text);
              } else {
                setCustomTranslateInput("");
                setShowTranslateModal(true);
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-sky-700 bg-sky-50 hover:bg-sky-100 hover:text-sky-800 border border-sky-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
            title="ترجمة Google (ترجمة جوجل الرسمية وليس ذكاء اصطناعي)"
          >
            <Languages className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>ترجمة Google</span>
          </button>
        </div>
      </div>

      {/* MOBILE TOOLBAR (< md: Fully customized to fit phone screen width without breaking) */}
      <div className="flex md:hidden flex-col w-full bg-white border-b border-slate-200 shadow-2xs relative z-40">
        {/* Mobile Row 1: AI Proofreading Bar (Compact & Perfectly Sized) */}
        <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-gradient-to-l from-violet-50/90 via-purple-50/60 to-white border-b border-violet-100">
          <div className="flex items-center gap-1.5 shrink-0">
            {/* AI Proofread Button */}
            <button
              type="button"
              onClick={handleStartProofread}
              disabled={isProofreading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 active:bg-violet-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="تصحيح النص بالذكاء الاصطناعي"
            >
              {isProofreading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>تدقيق...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-violet-200" />
                  <span>تصحيح بالذكاء</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            {/* Language Selector Button */}
            <button
              type="button"
              onClick={() => {
                setShowLangPicker(!showLangPicker);
                setShowModelPicker(false);
              }}
              className="flex items-center gap-1 px-2 py-1.5 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs shrink-0 active:bg-slate-50"
              title="تحديد لغة الكتابة والتدقيق"
            >
              <span className="text-sm">{selectedLangObj.flag}</span>
              <span className="text-[11px] font-bold">{selectedLangObj.name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* AI Model Selector Button */}
            <button
              type="button"
              onClick={() => {
                setShowModelPicker(!showModelPicker);
                setShowLangPicker(false);
              }}
              className="flex items-center gap-1 px-2 py-1.5 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs shrink-0 max-w-[120px] active:bg-slate-50"
              title="تحديد موديل الذكاء"
            >
              <Cpu className="w-3 h-3 text-violet-600 shrink-0" />
              <span className="truncate text-[10px] font-bold">
                {selectedModelObj.name.replace(/^(Gemini|Groq)\s*/i, "")}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>
          </div>
        </div>

        {/* Mobile Corrections Notification Pill (if any errors found) */}
        {activeCorrectionsCount > 0 && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-rose-50 border-b border-rose-200 text-xs font-bold text-rose-800 animate-in fade-in slide-in-from-top-1">
            <span className="flex items-center gap-1.5 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>تم رصد {activeCorrectionsCount} ملاحظات</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={applyAllCorrections}
                className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[11px] font-bold active:scale-95 shadow-2xs cursor-pointer"
              >
                تطبيق الكل
              </button>
              <button
                type="button"
                onClick={clearAllMarks}
                className="p-1 text-rose-500 hover:text-rose-700 rounded-lg cursor-pointer"
                title="مسح العلامات"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Mobile Row 2: Category Segment Switcher (التنسيق vs الورقة والخط) */}
        <div className="flex items-center justify-between px-2 pt-1.5 pb-1 bg-white border-b border-slate-100">
          <div className="flex items-center bg-slate-100/90 p-0.5 rounded-xl w-full">
            <button
              type="button"
              onClick={() => setMobileToolTab("formatting")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mobileToolTab === "formatting"
                  ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <PenTool className="w-3 h-3" />
              <span>تنسيق النص</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileToolTab("paper")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mobileToolTab === "paper"
                  ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>نوع الورقة والخط</span>
            </button>
          </div>
        </div>

        {/* Mobile Row 3: Active Tool Actions (Never wraps, cleanly scrollable if screen is tiny) */}
        {mobileToolTab === "formatting" ? (
          <div className="flex items-center justify-between px-2 py-1.5 gap-1 overflow-x-auto no-scrollbar whitespace-nowrap">
            {/* Undo / Redo */}
            <div className="flex items-center gap-0.5 shrink-0 bg-slate-50 p-0.5 rounded-lg border border-slate-200/70">
              <button
                type="button"
                onClick={() => formatText("undo")}
                className="p-1.5 text-slate-700 active:bg-white rounded-md cursor-pointer"
                title="تراجع"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => formatText("redo")}
                className="p-1.5 text-slate-700 active:bg-white rounded-md cursor-pointer"
                title="إعادة"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            {/* Bold / Italic / Underline */}
            <div className="flex items-center gap-0.5 shrink-0 bg-slate-50 p-0.5 rounded-lg border border-slate-200/70">
              <button
                type="button"
                onClick={() => formatText("bold")}
                className="p-1.5 text-slate-800 active:bg-white rounded-md cursor-pointer font-black"
                title="خط عريض"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => formatText("italic")}
                className="p-1.5 text-slate-700 active:bg-white rounded-md cursor-pointer"
                title="خط مائل"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => formatText("underline")}
                className="p-1.5 text-slate-700 active:bg-white rounded-md cursor-pointer"
                title="تحته خط"
              >
                <Underline className="w-4 h-4" />
              </button>
            </div>

            {/* Colors */}
            <div className="flex items-center gap-0.5 shrink-0 bg-slate-50 p-0.5 rounded-lg border border-slate-200/70">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowTextColorPicker(!showTextColorPicker);
                    setShowHighlightPicker(false);
                  }}
                  className="p-1.5 text-slate-700 active:bg-white rounded-md cursor-pointer flex items-center"
                  title="لون الخط"
                >
                  <Palette className="w-4 h-4 text-blue-600" />
                </button>
                {showTextColorPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowTextColorPicker(false)}
                    />
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-xl p-2 shadow-2xl z-50 flex gap-1.5 animate-in fade-in zoom-in-95">
                      {[
                        { color: "#000000", title: "أسود" },
                        { color: "#2563eb", title: "أزرق" },
                        { color: "#dc2626", title: "أحمر" },
                        { color: "#16a34a", title: "أخضر" },
                        { color: "#7c3aed", title: "بنفسجي" }
                      ].map((item) => (
                        <button
                          key={item.color}
                          type="button"
                          onClick={() => {
                            formatText("foreColor", item.color);
                            setShowTextColorPicker(false);
                          }}
                          className="w-5 h-5 rounded-full border border-slate-300 hover:scale-110 transition-transform cursor-pointer"
                          style={{ backgroundColor: item.color }}
                          title={item.title}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowHighlightPicker(!showHighlightPicker);
                    setShowTextColorPicker(false);
                  }}
                  className="p-1.5 text-slate-700 active:bg-white rounded-md cursor-pointer flex items-center"
                  title="تظليل ماركر"
                >
                  <Highlighter className="w-4 h-4 text-amber-500" />
                </button>
                {showHighlightPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowHighlightPicker(false)}
                    />
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-xl p-2 shadow-2xl z-50 flex gap-1.5 animate-in fade-in zoom-in-95">
                      {[
                        { color: "#fef08a", title: "أصفر فسفوري" },
                        { color: "#bbf7d0", title: "أخضر فاتح" },
                        { color: "#bae6fd", title: "سماوي" },
                        { color: "#fbcfe8", title: "وردي" }
                      ].map((item) => (
                        <button
                          key={item.color}
                          type="button"
                          onClick={() => {
                            formatText("hiliteColor", item.color);
                            setShowHighlightPicker(false);
                          }}
                          className="w-5 h-5 rounded-full border border-slate-300 hover:scale-110 transition-transform cursor-pointer"
                          style={{ backgroundColor: item.color }}
                          title={item.title}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Lists & Clear */}
            <div className="flex items-center gap-0.5 shrink-0 bg-slate-50 p-0.5 rounded-lg border border-slate-200/70">
              <button
                type="button"
                onClick={() => formatText("insertUnorderedList")}
                className="p-1.5 text-slate-700 active:bg-white rounded-md cursor-pointer"
                title="قائمة نقطية"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => formatText("insertOrderedList")}
                className="p-1.5 text-slate-700 active:bg-white rounded-md cursor-pointer"
                title="قائمة مرقمة"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => formatText("removeFormat")}
                className="p-1.5 text-slate-500 hover:text-rose-600 active:bg-white rounded-md cursor-pointer"
                title="مسح التنسيق"
              >
                <RemoveFormatting className="w-4 h-4" />
              </button>
              <button
                type="button"
                id="btn-mobile-toolbar-duplicate-line"
                onClick={() => handleDuplicateLineDown()}
                className="p-1.5 text-slate-700 active:bg-white active:text-blue-700 rounded-md cursor-pointer"
                title="نسخ السطر لأسفل"
              >
                <CopyPlus className="w-4 h-4" />
              </button>
            </div>

            {/* Google Translate Quick Button on Mobile */}
            <button
              type="button"
              id="btn-mobile-toolbar-google-translate"
              onClick={() => {
                const sel = window.getSelection();
                const text = sel ? sel.toString().trim() : "";
                if (text) {
                  handleTranslateGoogle(text);
                } else {
                  setCustomTranslateInput("");
                  setShowTranslateModal(true);
                }
              }}
              className="flex items-center gap-1 px-2 py-1 text-sky-700 bg-sky-50 active:bg-sky-100 border border-sky-200 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
              title="ترجمة Google"
            >
              <Languages className="w-3.5 h-3.5 text-sky-600" />
              <span>ترجمة Google</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-2 py-1.5 gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap">
            {/* Paper Type Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl shrink-0">
              {[
                { id: "ruled", label: "مسطر" },
                { id: "plain", label: "سادة" },
                { id: "grid", label: "مربعات" },
                { id: "legal", label: "أصفر" }
              ].map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setPaperStyle(style.id as PaperStyle)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currentPaperStyle === style.id
                      ? "bg-white text-blue-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>

            {/* Font Selector */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl shrink-0">
              {[
                { id: "tajawal", label: "تجوال" },
                { id: "cairo", label: "كايرو" },
                { id: "inter", label: "Eng" },
                { id: "amiri", label: "أميري" }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFont(f.id as any)}
                  className={`px-1.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedFont === f.id
                      ? "bg-white text-blue-700 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Baseline Nudge */}
            <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-1 rounded-xl text-xs text-slate-600 shrink-0">
              <button
                type="button"
                onClick={() => adjustBaseline(-1)}
                className="w-5 h-5 flex items-center justify-center rounded bg-white text-slate-700 font-bold cursor-pointer"
                title="رفع السطر للأعلى"
              >
                -
              </button>
              <span className="text-[11px] font-mono font-bold text-blue-700 w-3.5 text-center">
                {baselineOffset > 0 ? `+${baselineOffset}` : baselineOffset}
              </span>
              <button
                type="button"
                onClick={() => adjustBaseline(1)}
                className="w-5 h-5 flex items-center justify-center rounded bg-white text-slate-700 font-bold cursor-pointer"
                title="خفض السطر للأسفل"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* SHARED LANGUAGE PICKER MODAL (Docked bottom on mobile, dropdown on desktop) */}
        {showLangPicker && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-50 backdrop-blur-2xs"
              onClick={() => setShowLangPicker(false)}
            />
            <div
              className="fixed inset-x-3 bottom-4 sm:bottom-auto sm:inset-x-auto sm:top-24 sm:right-10 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xl z-50 w-auto sm:w-64 max-w-[calc(100vw-24px)] text-right animate-in fade-in zoom-in-95 font-sans"
              dir="rtl"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-violet-600" />
                  لغة النص والتدقيق (الافتراضية: الألمانية)
                </span>
                <button
                  type="button"
                  onClick={() => setShowLangPicker(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {PROOFREAD_LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      handleSetLanguage(l.id);
                      setShowLangPicker(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-right ${
                      proofreadLanguage === l.id
                        ? "bg-violet-50 border-violet-400 text-violet-900 font-bold shadow-2xs"
                        : "bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-base">{l.flag}</span>
                    <span className="truncate">{l.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* SHARED AI MODEL PICKER MODAL (Docked bottom on mobile, dropdown on desktop) */}
        {showModelPicker && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-50 backdrop-blur-2xs"
              onClick={() => setShowModelPicker(false)}
            />
            <div
              className="fixed inset-x-3 bottom-4 sm:bottom-auto sm:inset-x-auto sm:top-24 sm:right-20 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xl z-50 w-auto sm:w-96 max-w-[calc(100vw-24px)] text-right animate-in fade-in zoom-in-95 font-sans max-h-[85vh] flex flex-col"
              dir="rtl"
            >
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 shrink-0">
                <div>
                  <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-violet-600" />
                    موديل الذكاء للتصحيح (نفس موديلات قسم صحح)
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    اختر الموديل المناسب للحصة وسرعة التدقيق اللغوي
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModelPicker(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-3.5 pr-1 pl-0.5 custom-scrollbar flex-1">
                {/* Group 1: High Quota Models (500 RPD) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <span className="text-[11px] font-black text-amber-900 flex items-center gap-1">
                      <span>⚡ موديلات الحصة العالية (500 طلب يومياً)</span>
                    </span>
                    <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-md">
                      بدون انقطاع
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {ALL_AVAILABLE_MODELS.filter((m) => m.group === "high_quota").map((m) => {
                      const isSelected = proofreadModel === m.key;
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => {
                            handleSetModel(m.key);
                            setShowModelPicker(false);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                            isSelected
                              ? "bg-amber-50/90 border-amber-400 text-slate-900 shadow-2xs ring-1 ring-amber-300"
                              : "bg-slate-50/70 hover:bg-amber-50/40 border-slate-200/80 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "border-amber-500 bg-amber-500"
                                  : "border-slate-300"
                              }`}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div>
                              <div className="font-bold text-xs text-slate-900">{m.name}</div>
                              <div className="text-[10px] text-slate-500 font-normal">{m.desc}</div>
                            </div>
                          </div>
                          <span className="text-[10px] bg-white px-2 py-0.5 rounded-lg border border-amber-200 text-amber-800 font-bold shrink-0 mr-2 shadow-2xs">
                            {m.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Group 2: General & Advanced Models */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <span className="text-[11px] font-black text-violet-900 flex items-center gap-1">
                      <span>💎 الموديلات العامة والمتقدمة</span>
                    </span>
                    <span className="text-[9px] bg-violet-100 text-violet-800 font-bold px-1.5 py-0.5 rounded-md">
                      تحليل لغوي عميق
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {ALL_AVAILABLE_MODELS.filter((m) => m.group !== "high_quota").map((m) => {
                      const isSelected = proofreadModel === m.key;
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => {
                            handleSetModel(m.key);
                            setShowModelPicker(false);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                            isSelected
                              ? "bg-violet-50/90 border-violet-400 text-slate-900 shadow-2xs ring-1 ring-violet-300"
                              : "bg-slate-50/70 hover:bg-violet-50/40 border-slate-200/80 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "border-violet-600 bg-violet-600"
                                  : "border-slate-300"
                              }`}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div>
                              <div className="font-bold text-xs text-slate-900">{m.name}</div>
                              <div className="text-[10px] text-slate-500 font-normal">{m.desc}</div>
                            </div>
                          </div>
                          <span className="text-[10px] bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-violet-800 font-bold shrink-0 mr-2 shadow-2xs">
                            {m.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ================================================================= */}
      {/* 3. WRITING DESK & THE PAPER SHEET */}
      {/* ================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main writing canvas */}
        <div
          className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 md:py-8 flex flex-col items-center custom-scrollbar"
          onClick={(e) => {
            if (e.target === e.currentTarget && editorRef.current) {
              editorRef.current.focus();
            }
          }}
        >
          {activeNote && (
            <div className="w-full max-w-3xl flex flex-col">
              {/* Meta Info (Date & Word Count) - Strictly OUTSIDE the paper */}
              <div className="w-full flex items-center justify-between text-xs text-slate-500 font-medium px-1.5 mb-2.5 select-none">
                <div className="flex items-center gap-1.5 bg-slate-200/70 text-slate-700 px-2.5 py-1 rounded-lg">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {new Date(activeNote.createdAt).toLocaleDateString("ar-EG", {
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    })}
                  </span>
                </div>

                <div className="bg-slate-200/70 text-slate-700 px-2.5 py-1 rounded-lg">
                  <span>{wordCount} كلمة</span>
                </div>
              </div>

              {/* AI Proofreading Notification / Status Toast */}
              {proofreadStatusMessage && (
                <div className="w-full mb-3 flex items-center justify-between gap-2 px-3 py-2 bg-violet-600 text-white rounded-xl text-xs font-semibold shadow-md animate-in fade-in slide-in-from-top-2 select-none">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-200 shrink-0" />
                    <span>{proofreadStatusMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProofreadStatusMessage(null)}
                    className="p-1 hover:bg-violet-700 rounded-lg cursor-pointer transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* The Realistic Paper Sheet - Clean pure page */}
              <div
                id="printable-paper-sheet"
                className={`w-full paper-style-${currentPaperStyle} paper-font-${selectedFont} paper-sheet-container rounded-lg p-3.5 sm:p-8 md:p-14 min-h-[600px] sm:min-h-[700px] flex flex-col mb-12 relative transition-all`}
                style={{
                  "--paper-baseline-pos": `${effectiveBaseline}px`,
                } as React.CSSProperties}
              >
                {/* Note Title Input */}
                <div className="mb-4 border-b border-slate-300/80 pb-2">
                  <input
                    ref={titleInputRef}
                    type="text"
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                    value={activeNote.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="عنوان الكتابة..."
                    className="w-full text-2xl sm:text-3xl font-extrabold bg-transparent border-none outline-none placeholder-slate-400 text-slate-800 leading-snug"
                  />
                </div>

                {/* Note Content Area */}
                <div
                  ref={editorRef}
                  contentEditable
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  dir="auto"
                  suppressContentEditableWarning
                  onInput={triggerAutoSave}
                  onKeyDown={handleEditorKeyDown}
                  onMouseMove={handleEditorMouseMove}
                  onClick={handleEditorClick}
                  onMouseLeave={handleEditorMouseLeave}
                  data-placeholder="ابدأ بالكتابة هنا..."
                  className="paper-content-area flex-1 outline-none"
                  style={{
                    "--paper-baseline-pos": `${effectiveBaseline}px`,
                  } as React.CSSProperties}
                />
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* 4. WRITINGS DRAWER / LIST (Clean & Collapsible) */}
        {/* ================================================================= */}
        {showNotesList && (
          <aside className="w-72 sm:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-lg z-30 animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                كتاباتي المحفوظة
              </span>
              <button
                type="button"
                onClick={() => setShowNotesList(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-100">
              <button
                type="button"
                onClick={handleCreateNewNote}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>كتابة ورقة جديدة</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {notes.map((note) => {
                const isCurrent = note.id === activeNote?.id;
                const displayTitle = note.title.trim() || "ورقة بدون عنوان";
                const snippet =
                  note.plainText?.trim() || getPlainText(note.content).trim() || "ورقة فارغة...";

                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => {
                      setActiveNoteId(note.id);
                      setShowNotesList(false);
                    }}
                    className={`w-full text-right p-3 rounded-xl transition-all cursor-pointer border ${
                      isCurrent
                        ? "bg-blue-50/80 border-blue-200 text-blue-900 shadow-2xs"
                        : "bg-slate-50/70 border-slate-100 hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <div className="font-bold text-xs truncate mb-1">{displayTitle}</div>
                    <div className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {snippet}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* ================================================================= */}
        {/* 5. FLOATING AI CORRECTION WINDOW (Simple popover on hover/click) */}
        {/* ================================================================= */}
        {hoveredCorrection && (
          <div
            className="fixed z-50 pointer-events-auto transition-all duration-150 animate-in fade-in zoom-in-95 select-none"
            style={{
              top: `${Math.max(12, hoveredCorrection.top)}px`,
              left: `${Math.min(window.innerWidth - 145, Math.max(145, hoveredCorrection.left))}px`,
              transform: hoveredCorrection.isFlipped ? "translate(-50%, 0)" : "translate(-50%, -100%)",
            }}
            onMouseEnter={() => {
              if (popoverCloseTimeoutRef.current) {
                clearTimeout(popoverCloseTimeoutRef.current);
                popoverCloseTimeoutRef.current = null;
              }
            }}
            onMouseLeave={() => {
              popoverCloseTimeoutRef.current = setTimeout(() => {
                setHoveredCorrection(null);
                popoverCloseTimeoutRef.current = null;
              }, 250);
            }}
            dir="rtl"
          >
            <div className="w-[calc(100vw-24px)] max-w-[320px] sm:max-w-[340px] bg-white/98 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl p-3 sm:p-3.5 text-right font-sans text-slate-800 ring-1 ring-black/5">
              {/* Header: Error Type Badge + Close */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    hoveredCorrection.type === "missing-word"
                      ? "bg-violet-100 text-violet-800 border border-violet-200"
                      : hoveredCorrection.type === "spelling"
                      ? "bg-rose-100 text-rose-700"
                      : hoveredCorrection.type === "grammar"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-purple-100 text-purple-700"
                  }`}
                >
                  {hoveredCorrection.type === "missing-word"
                    ? "قواعد: كلمة ناقصة بين الكلمتين"
                    : hoveredCorrection.type === "spelling"
                    ? "خطأ إملائي"
                    : hoveredCorrection.type === "grammar"
                    ? "قاعدة نحوية"
                    : "تركيب لغوي"}
                </span>

                <button
                  type="button"
                  onClick={() => setHoveredCorrection(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Comparison: Missing Word vs Standard Correction */}
              {hoveredCorrection.type === "missing-word" ? (
                <div className="space-y-1.5 mb-2.5">
                  <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                    <span className="text-[11px] text-slate-500 font-semibold">الموضع في الجملة:</span>
                    <span className="font-mono text-slate-800 font-bold text-xs" dir="auto">
                      {hoveredCorrection.beforeWord || ""} <span className="text-violet-600 font-extrabold px-1 bg-violet-50 rounded">‸</span> {hoveredCorrection.afterWord || ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs bg-emerald-50/90 border border-emerald-200 px-2.5 py-1.5 rounded-xl">
                    <span className="text-[11px] text-emerald-700 font-semibold">الكلمة المفقودة (الصح):</span>
                    <span className="font-mono text-emerald-800 font-extrabold text-sm" dir="auto">
                      + {hoveredCorrection.replacement}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 mb-2.5">
                  <div className="flex items-center justify-between text-xs bg-rose-50/80 border border-rose-100 px-2.5 py-1.5 rounded-xl">
                    <span className="text-[11px] text-rose-500 font-semibold">المكتوب (خطأ):</span>
                    <span className="font-mono text-rose-700 line-through font-bold text-sm" dir="auto">
                      {hoveredCorrection.original}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs bg-emerald-50/90 border border-emerald-200 px-2.5 py-1.5 rounded-xl">
                    <span className="text-[11px] text-emerald-700 font-semibold">التصحيح (الصح):</span>
                    <span className="font-mono text-emerald-800 font-extrabold text-sm" dir="auto">
                      {hoveredCorrection.replacement}
                    </span>
                  </div>
                </div>
              )}

              {/* Explanation in Arabic */}
              {hoveredCorrection.explanation && (
                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl mb-3 leading-relaxed border border-slate-100">
                  <span className="font-bold text-slate-700 ml-1">
                    {hoveredCorrection.type === "missing-word" ? "سبب الإضافة:" : "توضيح الخطأ:"}
                  </span>
                  {hoveredCorrection.explanation}
                </div>
              )}

              {/* Action Buttons: Apply Correction & Dismiss */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => applyCorrection(hoveredCorrection)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{hoveredCorrection.type === "missing-word" ? "إدراج الكلمة هنا" : "تطبيق التصحيح"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => dismissCorrection(hoveredCorrection)}
                  className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-600 rounded-xl text-xs font-medium transition-all cursor-pointer"
                >
                  تجاهل
                </button>
              </div>

              {/* Arrow */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 ${
                  hoveredCorrection.isFlipped
                    ? "-top-1.5 border-t border-l border-slate-200"
                    : "-bottom-1.5 border-b border-r border-slate-200"
                }`}
              />
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 6. FLOATING SELECTION BUBBLE (Icon-only, clean, minimal toolbar) */}
        {/* ================================================================= */}
        {selectionBubble && (
          <div
            ref={bubbleRef}
            id="text-selection-floating-bubble"
            className="fixed z-50 pointer-events-auto transition-all duration-150 animate-in fade-in zoom-in-95 select-none"
            style={{
              top: `${Math.max(12, selectionBubble.top)}px`,
              left: `${Math.min(window.innerWidth - 140, Math.max(140, selectionBubble.left))}px`,
              transform: selectionBubble.isFlipped ? "translate(-50%, 0)" : "translate(-50%, -100%)",
            }}
            onMouseDown={(e) => {
              // Crucial: prevent losing text selection and focus inside contentEditable
              e.stopPropagation();
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            dir="rtl"
          >
            <div className={`bg-slate-900/98 text-white p-1 rounded-2xl shadow-2xl border border-slate-700/80 flex flex-col gap-1 text-xs font-sans ring-1 ring-black/20 ${isTranslateOpen ? "w-[290px] sm:w-[350px] max-w-[94vw] p-2" : "whitespace-nowrap"}`}>
              {/* Arrow pointing to selected text */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
                  selectionBubble.isFlipped
                    ? "bottom-full border-b-slate-900"
                    : "top-full border-t-slate-900"
                }`}
              />

              {/* Top Controls Row - Minimalist Icon-only Layout */}
              <div className="flex items-center gap-0.5 whitespace-nowrap py-0.5 px-0.5">
                {/* 1. Speak / Listen Button (Icon only) */}
                <button
                  type="button"
                  id="btn-speak-selected-text"
                  onClick={() => speakSelectedText()}
                  className={`p-2 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0 ${
                    isSpeakingSelection
                      ? "bg-amber-500 text-slate-950 animate-pulse ring-2 ring-amber-300"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                  title={isSpeakingSelection ? "إيقاف النطق" : "استماع لنطق النص المحدد"}
                >
                  {isSpeakingSelection ? (
                    <VolumeX className="w-4 h-4 text-slate-950" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-blue-400" />
                  )}
                </button>

                {/* 2. Google Translate Button (Icon only) */}
                <button
                  type="button"
                  id="btn-google-translate-bubble"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isTranslateOpen) {
                      setIsTranslateOpen(false);
                    } else {
                      handleTranslateGoogle();
                    }
                  }}
                  className={`p-2 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0 ${
                    isTranslateOpen
                      ? "bg-sky-600 text-white ring-2 ring-sky-400/40 shadow-xs"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                  title="ترجمة Google"
                >
                  <Languages className="w-4 h-4 text-sky-400" />
                </button>

                {/* Divider between Audio/Translate and Formatting */}
                <div className="w-px h-4 bg-slate-700/80 mx-0.5 shrink-0" />

                {/* 3. Highlight Button (Icon only) */}
                <button
                  type="button"
                  onClick={() => formatText("hiliteColor", "#fef08a")}
                  className="p-2 rounded-xl text-amber-300 hover:text-amber-200 hover:bg-slate-800 transition-all active:scale-95 cursor-pointer shrink-0"
                  title="تظليل فسفوري"
                >
                  <Highlighter className="w-4 h-4" />
                </button>

                {/* 4. Bold Button (Icon only) */}
                <button
                  type="button"
                  onClick={() => formatText("bold")}
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all active:scale-95 cursor-pointer shrink-0"
                  title="خط عريض"
                >
                  <Bold className="w-4 h-4" />
                </button>

                {/* Divider between Formatting and Utilities */}
                <div className="w-px h-4 bg-slate-700/80 mx-0.5 shrink-0" />

                {/* 5. Copy Button (Icon only) */}
                <button
                  type="button"
                  id="btn-copy-selected-text"
                  onClick={handleCopySelection}
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all active:scale-95 cursor-pointer shrink-0"
                  title="نسخ النص المحدد"
                >
                  {selectionCopied ? (
                    <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>

                {/* 6. Settings Button (Icon only) */}
                <button
                  type="button"
                  id="btn-voice-settings-in-bubble"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTestVoiceLang(proofreadLanguage);
                    setShowVoiceSettingsModal(true);
                  }}
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all active:scale-95 cursor-pointer shrink-0"
                  title="إعدادات الصوت والنطق"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>

              {/* Google Translate Expandable Box */}
              {isTranslateOpen && (
                <div
                  id="bubble-google-translate-card"
                  className="pt-1.5 border-t border-slate-800 w-full text-right animate-in fade-in zoom-in-95 duration-150"
                >
                  {/* Language Selection Header (Clean, Minimalist, No White Borders) */}
                  <div className="flex items-center justify-between gap-1 mb-1 px-1">
                    {/* Language Switcher - Simple and Borderless */}
                    <div className="flex items-center gap-1 text-[11px] py-0.5 text-slate-300 select-none">
                      <span className="font-medium text-slate-300">
                        {translationState?.sourceLang === "ar"
                          ? "عربي"
                          : translationState?.sourceLang === "de"
                          ? "ألماني"
                          : translationState?.sourceLang === "en"
                          ? "إنجليزي"
                          : translationState?.sourceLang === "fr"
                          ? "فرنسي"
                          : translationState?.sourceLang === "es"
                          ? "إسباني"
                          : translationState?.sourceLang === "it"
                          ? "إيطالي"
                          : (translationState?.sourceLang || "تلقائي")}
                      </span>
                      <button
                        type="button"
                        onClick={handleSwapTranslationLanguages}
                        className="p-1 text-slate-400 hover:text-sky-300 hover:bg-slate-800/60 rounded-md transition-colors cursor-pointer"
                        title="عكس اللغات"
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                      </button>
                      <div className="relative inline-flex items-center">
                        <select
                          value={translationState?.targetLang || "ar"}
                          onChange={(e) => handleChangeTranslationTargetLang(e.target.value)}
                          className="bg-transparent text-sky-400 font-medium text-[11px] cursor-pointer appearance-none outline-none border-none pr-0 pl-3.5 focus:ring-0"
                        >
                          {GOOGLE_TRANSLATE_LANGS.map((lang) => (
                            <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                              {lang.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-2.5 h-2.5 text-slate-400 pointer-events-none absolute left-0" />
                      </div>
                    </div>

                    {/* Quick controls: Refresh & Close */}
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleTranslateGoogle()}
                        className="p-1 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800/60 transition-colors cursor-pointer"
                        title="إعادة الترجمة"
                      >
                        <RotateCw className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsTranslateOpen(false)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800/60 transition-colors cursor-pointer"
                        title="إغلاق صندوق الترجمة"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Result Body */}
                  <div className="bg-slate-950/70 rounded-xl p-2.5 space-y-2">
                    {translationState?.isLoading ? (
                      <div className="flex items-center justify-center gap-2 py-2.5 text-sky-300 font-medium text-xs">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                        <span>جارٍ الترجمة...</span>
                      </div>
                    ) : translationState?.error ? (
                      <div className="py-1.5 text-center space-y-1">
                        <p className="text-[11px] text-rose-400">{translationState.error}</p>
                        <button
                          type="button"
                          onClick={() => handleTranslateGoogle()}
                          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                          title="إعادة المحاولة"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* The Translated Text */}
                        <div className="font-medium text-white text-xs sm:text-sm leading-relaxed select-text break-words">
                          {translationState?.translatedText || "لا توجد ترجمة"}
                        </div>

                        {/* Icon-only Action Controls */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
                          <div className="flex items-center gap-1">
                            {/* 1. Listen */}
                            <button
                              type="button"
                              onClick={handleSpeakTranslation}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-sky-300 hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
                              title="استماع لنطق الترجمة"
                            >
                              <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                            </button>

                            {/* 2. Copy */}
                            <button
                              type="button"
                              onClick={handleCopyTranslation}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
                              title="نسخ الترجمة"
                            >
                              {translationCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Divider */}
                            <div className="w-px h-3 bg-slate-800 mx-0.5" />

                            {/* 3. Replace selected text */}
                            <button
                              type="button"
                              onClick={handleReplaceSelectionWithTranslation}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-emerald-300 hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
                              title="استبدال النص المحدد بهذه الترجمة"
                            >
                              <Replace className="w-3.5 h-3.5 text-emerald-400" />
                            </button>

                            {/* 4. Insert after text */}
                            <button
                              type="button"
                              onClick={handleInsertTranslationAfter}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-blue-300 hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
                              title="إدراج الترجمة بين قوسين بجانب النص"
                            >
                              <Plus className="w-3.5 h-3.5 text-blue-400" />
                            </button>
                          </div>

                          {/* 5. External link */}
                          <a
                            href={`https://translate.google.com/?sl=auto&tl=${translationState?.targetLang || "ar"}&text=${encodeURIComponent(translationState?.originalText || "")}&op=translate`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
                            title="فتح في Google Translate"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 7. VOICE MODEL SELECTION & AUDIO SETTINGS MODAL */}
        {/* ================================================================= */}
        {showVoiceSettingsModal && (
          <div
            id="voice-settings-modal-backdrop"
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
            dir="rtl"
            onClick={() => setShowVoiceSettingsModal(false)}
          >
            <div
              id="voice-settings-modal-card"
              className="bg-white max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/80 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-sm border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-xl shadow-inner shrink-0 text-blue-300">
                    🎙️
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base tracking-tight leading-tight flex items-center gap-1.5">
                      <span>إعدادات موديل الصوت والنطق</span>
                    </h3>
                    <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                      اختر محرك الذكاء الاصطناعي أو نموذج الصوت المفضل لقراءة النصوص
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-close-voice-settings"
                  onClick={() => setShowVoiceSettingsModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-slate-800">
                {/* 1. Language selector for testing & voice preview */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>لغة النطق ومعاينة الصوت:</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      (تلقائياً تعتمد على لغة النص والملاحظة)
                    </span>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {PROOFREAD_LANGUAGES.map((lang) => (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => setTestVoiceLang(lang.id)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all border cursor-pointer flex items-center justify-center gap-1 ${
                          testVoiceLang === lang.id
                            ? "bg-blue-50 border-blue-500 text-blue-800 shadow-2xs font-extrabold ring-1 ring-blue-500"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Voice Models Options */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    موديل الصوت المشغل (Speech Voice Model):
                  </label>

                  {/* Primary recommended option: Google TTS */}
                  <div
                    onClick={() => handleSelectVoiceModel("google")}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      selectedVoiceModel === "google"
                        ? "bg-blue-50/90 border-blue-500 ring-2 ring-blue-400/30"
                        : "bg-white hover:bg-slate-50 border-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="voice-model"
                      checked={selectedVoiceModel === "google"}
                      onChange={() => handleSelectVoiceModel("google")}
                      className="mt-1 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-900">
                          ⚡ سيرفرات Google Translate TTS
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700">
                          موصى به أونلاين
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        صوت سريع جداً، عالي الثبات، يدعم النطق الدقيق لجميع اللغات (ألماني، عربي، إنجليزي...).
                      </p>
                    </div>
                  </div>

                  {/* Piper Neural Models for chosen language */}
                  {getPiperModelsForLang(testVoiceLang).length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] font-extrabold text-purple-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>نماذج الذكاء الاصطناعي العصبية (Piper Neural Voices) لـ {testVoiceLang}:</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {getPiperModelsForLang(testVoiceLang).map((model) => (
                          <div
                            key={model.id}
                            onClick={() => handleSelectVoiceModel(model.id)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                              selectedVoiceModel === model.id
                                ? "bg-purple-50 border-purple-500 ring-2 ring-purple-400/30"
                                : "bg-slate-50/70 hover:bg-slate-100 border-slate-200"
                            }`}
                          >
                            <input
                              type="radio"
                              name="voice-model"
                              checked={selectedVoiceModel === model.id}
                              onChange={() => handleSelectVoiceModel(model.id)}
                              className="mt-0.5 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-xs text-slate-900 flex items-center gap-1 truncate">
                                <span>{model.flag}</span>
                                <span>{model.name}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                {model.desc}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Browser Native Web Speech API Voices */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-extrabold text-emerald-900 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>أصوات نظام التشغيل والمتصفح (Web Speech):</span>
                    </div>

                    <div
                      onClick={() => handleSelectVoiceModel("webspeech")}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                        selectedVoiceModel === "webspeech"
                          ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/30"
                          : "bg-slate-50/70 hover:bg-slate-100 border-slate-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="voice-model"
                        checked={selectedVoiceModel === "webspeech"}
                        onChange={() => handleSelectVoiceModel("webspeech")}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>🌐 نطق المتصفح الافتراضي</span>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-md">
                            أوفلاين وبدون استهلاك بيانات
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          يعتمد على محرك الصوت المثبت على جهازك مباشرة (Android / iOS / Windows / Mac).
                        </div>
                      </div>
                    </div>

                    {/* Specific browser installed voices dropdown if available */}
                    {availableVoices.length > 0 && (
                      <div className="pt-1">
                        <select
                          value={
                            selectedVoiceModel.startsWith("de_") ||
                            selectedVoiceModel.startsWith("ar_") ||
                            selectedVoiceModel.startsWith("en_") ||
                            selectedVoiceModel === "google" ||
                            selectedVoiceModel === "webspeech"
                              ? ""
                              : selectedVoiceModel
                          }
                          onChange={(e) => {
                            if (e.target.value) {
                              handleSelectVoiceModel(e.target.value);
                            }
                          }}
                          className="w-full text-xs font-semibold p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer text-slate-700"
                        >
                          <option value="">-- أو اختر صوتاً محدداً من أصوات جهازك --</option>
                          {availableVoices.map((v) => (
                            <option key={v.voiceURI} value={v.voiceURI}>
                              🗣️ {v.name} ({v.lang})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Speech Speed Rate */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    سرعة النطق (Speed Rate):
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { rate: 0.8, label: "بطيء (0.8x) 🐢" },
                      { rate: 0.92, label: "متأنٍ (0.9x) 🎧" },
                      { rate: 1.0, label: "عادي (1.0x) 🗣️" },
                      { rate: 1.2, label: "سريع (1.2x) 🚀" },
                    ].map((item) => (
                      <button
                        key={item.rate}
                        type="button"
                        onClick={() => handleSetSpeechRate(item.rate)}
                        className={`py-2 px-1.5 rounded-xl font-bold text-xs transition-all border cursor-pointer text-center ${
                          speechRate === item.rate
                            ? "bg-slate-900 text-white border-slate-900 shadow-2xs font-extrabold"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Live Audio Test */}
                <div className="pt-2">
                  <button
                    type="button"
                    id="btn-test-voice-sample"
                    onClick={() => handleTestVoiceInModal()}
                    className={`w-full py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm border ${
                      isTestingVoice
                        ? "bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400 animate-pulse ring-2 ring-amber-300"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-blue-500 shadow-blue-500/20"
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>
                      {isTestingVoice ? "جارٍ تشغيل العينة الصوتية..." : `تجربة نطق الصوت الآن 🔊 (${testVoiceLang})`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <div className="text-[11px] text-slate-500 font-medium">
                  يتم حفظ إعدادات الصوت تلقائياً
                </div>
                <button
                  type="button"
                  id="btn-save-voice-settings"
                  onClick={() => setShowVoiceSettingsModal(false)}
                  className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm cursor-pointer active:scale-95"
                >
                  تم وحفظ ✨
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 8. GOOGLE TRANSLATE MODAL (ترجمة Google الرسمية - بدون ذكاء) */}
        {/* ================================================================= */}
        {showTranslateModal && (
          <div
            id="google-translate-modal-backdrop"
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
            dir="rtl"
            onClick={() => setShowTranslateModal(false)}
          >
            <div
              id="google-translate-modal-card"
              className="bg-white max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/80 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-sm border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-600/30 border border-sky-400/40 flex items-center justify-center text-xl shadow-inner shrink-0 text-sky-300 font-black">
                    G
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base tracking-tight leading-tight flex items-center gap-2">
                      <span>ترجمة Google الرسمية</span>
                      <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 px-1.5 py-0.5 rounded-md">
                        GTX (بدون ذكاء اصطناعي)
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                      ترجمة دقيقة وموثوقة مباشرة عبر خدمة ترجمة جوجل
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-close-translate-modal"
                  onClick={() => setShowTranslateModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
                {/* Text to Translate Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    النص المراد ترجمته:
                  </label>
                  <textarea
                    id="input-custom-translate-text"
                    value={customTranslateInput}
                    onChange={(e) => setCustomTranslateInput(e.target.value)}
                    placeholder="اكتب أو الصق النص هنا ليتم ترجمته عبر Google Translate..."
                    rows={3}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-2xl text-xs sm:text-sm font-sans focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all resize-none"
                  />
                </div>

                {/* Language Selectors and Action */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-bold text-[11px]">من:</span>
                    <span className="font-bold text-slate-800 bg-white border border-slate-300 px-2 py-1 rounded-lg text-xs">
                      {translationState?.sourceLang === "ar"
                        ? "🇸🇦 العربية"
                        : translationState?.sourceLang === "de"
                        ? "🇩🇪 الألمانية"
                        : translationState?.sourceLang === "en"
                        ? "🇬🇧 الإنجليزية"
                        : "تلقائي"}
                    </span>
                    <button
                      type="button"
                      onClick={handleSwapTranslationLanguages}
                      className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 cursor-pointer transition-colors"
                      title="عكس اللغات"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-slate-500 font-bold text-[11px]">إلى:</span>
                    <select
                      value={translationState?.targetLang || "ar"}
                      onChange={(e) => handleChangeTranslationTargetLang(e.target.value)}
                      className="bg-white border border-slate-300 px-2.5 py-1 rounded-lg font-bold text-xs text-sky-800 outline-none cursor-pointer"
                    >
                      {GOOGLE_TRANSLATE_LANGS.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.flag} {l.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    id="btn-run-custom-translate"
                    onClick={() => handleTranslateGoogle(customTranslateInput)}
                    disabled={!customTranslateInput.trim() || translationState?.isLoading}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    {translationState?.isLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>جارٍ الترجمة...</span>
                      </>
                    ) : (
                      <>
                        <Languages className="w-3.5 h-3.5" />
                        <span>ترجمة من Google</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Translation Output */}
                {translationState && (
                  <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-2 border border-slate-800">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-sky-300">الترجمة من Google:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleSpeakTranslation}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3 text-sky-400" />
                          <span>استماع</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyTranslation}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] cursor-pointer"
                        >
                          {translationCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400 stroke-[2.5]" />
                              <span>تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-300" />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="font-semibold text-sm leading-relaxed select-text break-words">
                      {translationState.isLoading ? (
                        <div className="flex items-center gap-2 py-2 text-sky-300 text-xs">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جلب الترجمة من سيرفرات Google...</span>
                        </div>
                      ) : translationState.error ? (
                        <span className="text-rose-400 text-xs">{translationState.error}</span>
                      ) : (
                        translationState.translatedText
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <a
                  href={`https://translate.google.com/?sl=auto&tl=${translationState?.targetLang || "ar"}&text=${encodeURIComponent(customTranslateInput)}&op=translate`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-sky-700 hover:underline font-bold"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>فتح في موقع Google Translate</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowTranslateModal(false)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm cursor-pointer active:scale-95"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

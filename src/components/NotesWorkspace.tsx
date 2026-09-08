import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  Copy,
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
  AlertCircle
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
      {/* 1. TOP HEADER (Simple, Clean, Direct) */}
      {/* ================================================================= */}
      <header className="h-14 bg-white border-b border-slate-200 px-3 md:px-6 flex items-center justify-between shrink-0 select-none z-30 shadow-2xs">
        <div className="flex items-center gap-2 md:gap-3">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              title="القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-slate-800 hidden sm:inline">
              الكتابات
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          {/* New Note Button */}
          <button
            type="button"
            onClick={handleCreateNewNote}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ورقة جديدة</span>
          </button>

          {/* Writings List Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowNotesList(!showNotesList)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              showNotesList
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>كتاباتي ({notes.length})</span>
          </button>
        </div>

        {/* Top Right Status & Quick Actions */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Save status */}
          <div className="text-xs text-slate-500 font-medium px-2 py-1">
            {isSaved ? (
              <span className="flex items-center gap-1 text-emerald-600">
                <Check className="w-3 h-3" />
                <span>تم الحفظ</span>
              </span>
            ) : (
              <span className="text-amber-600">جاري الحفظ...</span>
            )}
          </div>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="نسخ النص"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="طباعة الورقة"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title={isFullscreen ? "تصغير الشاشة" : "ملء الشاشة"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDeleteCurrentNote}
            className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
            title="حذف هذه الورقة"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* 2. SIMPLE UNIFIED TOOLBAR (Direct paper style + essential formatting) */}
      {/* ================================================================= */}
      <div className="bg-white border-b border-slate-200 px-3 py-1.5 shrink-0 flex items-center justify-between select-none shadow-2xs relative z-40 gap-3 flex-wrap lg:flex-nowrap">
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
            <span className="text-[11px] font-medium hidden sm:inline">ملاصقة السطر:</span>
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

              {showLangPicker && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowLangPicker(false)}
                  />
                  <div
                    className="absolute top-full mt-2 right-0 bg-white border border-slate-200 rounded-2xl p-3 shadow-2xl z-50 w-64 max-w-[calc(100vw-24px)] text-right animate-in fade-in zoom-in-95 font-sans"
                    dir="rtl"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                      <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <Languages className="w-3.5 h-3.5 text-violet-600" />
                        لغة النص (الافتراضية: الألمانية)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowLangPicker(false)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
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
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-right ${
                            proofreadLanguage === l.id
                              ? "bg-violet-50 border-violet-400 text-violet-900 font-bold shadow-2xs"
                              : "bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <span className="text-sm">{l.flag}</span>
                          <span className="truncate">{l.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* AI Model Selector Button (Same models as in قسم صحح) */}
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
                title="تحديد موديل الذكاء للتصحيح (نفس موديلات قسم صحح)"
              >
                <Cpu className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                <span className="max-w-[125px] sm:max-w-[160px] truncate text-[11px] font-bold">
                  {selectedModelObj.name}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>

              {showModelPicker && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowModelPicker(false)}
                  />
                  <div
                    className="absolute top-full mt-2 right-0 bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xl z-50 w-80 sm:w-96 max-w-[calc(100vw-24px)] text-right animate-in fade-in zoom-in-95 font-sans"
                    dir="rtl"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
                      <div>
                        <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                          <Cpu className="w-4 h-4 text-violet-600" />
                          موديل الذكاء للتصحيح (موديلات صحح)
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          اختر الموديل المناسب للحصة وسرعة التدقيق اللغوي
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowModelPicker(false)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="max-h-[380px] overflow-y-auto space-y-3.5 pr-1 pl-0.5 custom-scrollbar">
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

        {/* Center / Right: Essential Text Formatting Tools (No shortcut codes) */}
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
        </div>
      </div>

      {/* ================================================================= */}
      {/* 3. WRITING DESK & THE PAPER SHEET */}
      {/* ================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main writing canvas */}
        <div
          className="flex-1 overflow-y-auto px-4 py-6 md:py-8 flex flex-col items-center custom-scrollbar"
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
                className={`w-full paper-style-${currentPaperStyle} paper-font-${selectedFont} paper-sheet-container rounded-lg p-6 sm:p-10 md:p-14 min-h-[700px] flex flex-col mb-12 relative transition-all`}
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
              left: `${Math.min(window.innerWidth - 170, Math.max(170, hoveredCorrection.left))}px`,
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
            <div className="w-72 sm:w-80 bg-white/98 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl p-3.5 text-right font-sans text-slate-800 ring-1 ring-black/5">
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
      </div>
    </main>
  );
};

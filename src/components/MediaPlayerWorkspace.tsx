import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Play,
  Pause,
  Upload,
  Film,
  Music,
  Trash2,
  Download,
  Edit2,
  Check,
  X,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  Repeat,
  Maximize2,
  Minimize2,
  Menu,
  ArrowRight,
  Search,
  FileVideo,
  FileAudio,
  HardDrive,
  List,
  Grid,
  Loader2,
  Clock,
  Sparkles,
  AlertCircle,
  Subtitles,
  FileText,
  Copy,
  Plus,
  Settings2,
  Languages,
  Eye,
  EyeOff,
  ChevronDown,
  Wand2,
  Sliders,
  SlidersHorizontal,
  CheckCheck,
  Mic,
  Server,
  Expand,
  Shrink,
  Tv,
  Layers,
  Split,
  BookOpen,
  Bot,
  Palette,
  Type,
  RefreshCw,
  SkipBack,
  SkipForward,
  Zap,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { MediaFile, MediaSubtitleTrack, SubtitleCue } from "../types";
import {
  parseSubtitleContent,
  formatSecondsToTime,
  formatSecondsToClock,
  parseTimeToSeconds,
  splitSecondsToMinSec,
  exportCuesToSrt,
  exportCuesToVtt,
  exportCuesToPlainText
} from "../utils/subtitleParser";
import { GradioTranscriberModal } from "./GradioTranscriberModal";
import { SubtitleStyleModal, SubtitleStylePanel } from "./SubtitleStyleModal";
import { SubtitleOptionsModal } from "./SubtitleOptionsModal";
import { CleanCueEditorModal } from "./CleanCueEditorModal";
import { ALL_AVAILABLE_MODELS, AIModelOption } from "./AICorrectorWorkspace";

export interface SubtitleTrackStyleConfig {
  fontSize: number; // in px
  textColor: string; // hex
  bgColor: string; // hex
  bgOpacity: number; // 0 - 100%
  fontWeight: "400" | "600" | "700" | "900";
  fontFamily: "sans" | "serif" | "mono" | "system" | "cairo" | "tajawal" | "amiri";
  textShadow: "none" | "subtle" | "strong" | "glow" | "outline";
  textStroke: boolean;
  position: "bottom" | "top" | "center";
  offsetY: number; // in px
  borderRadius?: number; // in px
  paddingX?: number; // in px
  paddingY?: number; // in px
  letterSpacing?: number; // in px, e.g. -1, 0, 1, 2, 4
  wordSpacing?: number; // in px, e.g. 0, 2, 4, 8
  lineHeight?: number; // e.g. 1.2, 1.4, 1.6, 1.8
  direction?: "auto" | "rtl" | "ltr";
  textAlign?: "center" | "right" | "left";
}

export const DEFAULT_PRIMARY_STYLE: SubtitleTrackStyleConfig = {
  fontSize: 20,
  textColor: "#ffffff",
  bgColor: "#0f172a", // Slate-900 high clarity
  bgOpacity: 85,
  fontWeight: "700",
  fontFamily: "tajawal",
  textShadow: "subtle",
  textStroke: false,
  position: "bottom",
  offsetY: 28,
  borderRadius: 14,
  paddingX: 16,
  paddingY: 6,
  letterSpacing: 0,
  wordSpacing: 0,
  lineHeight: 1.4,
  direction: "auto",
  textAlign: "center"
};

export const DEFAULT_SECONDARY_STYLE: SubtitleTrackStyleConfig = {
  fontSize: 20,
  textColor: "#6ee7b7", // emerald-300
  bgColor: "#064e3b", // emerald-950 high contrast
  bgOpacity: 85,
  fontWeight: "700",
  fontFamily: "tajawal",
  textShadow: "subtle",
  textStroke: false,
  position: "bottom",
  offsetY: 28,
  borderRadius: 14,
  paddingX: 16,
  paddingY: 6,
  letterSpacing: 0,
  wordSpacing: 0,
  lineHeight: 1.4,
  direction: "auto",
  textAlign: "center"
};

export function hexToRgba(hex: string, opacity: number): string {
  if (!hex) return `rgba(0, 0, 0, ${opacity})`;
  let c = hex.replace("#", "");
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("");
  }
  if (c.length !== 6) return `rgba(0, 0, 0, ${opacity})`;
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`;
}

export function detectTextDirection(text?: string): "rtl" | "ltr" {
  if (!text || typeof text !== "string") return "ltr";
  // Arabic, Hebrew, Persian, Urdu unicode ranges
  const rtlRegex = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  return rtlRegex.test(text) ? "rtl" : "ltr";
}

export function computeSubtitleCSS(
  config: SubtitleTrackStyleConfig,
  isImmersive: boolean = false,
  customScale: number = 1,
  text?: string
): React.CSSProperties {
  const scaleFactor = (isImmersive ? 1.25 : 1) * customScale;
  const computedFontSize = Math.round(config.fontSize * scaleFactor);

  let shadowStyle = "none";
  if (config.textShadow === "subtle") {
    shadowStyle = "0 2px 4px rgba(0, 0, 0, 0.85)";
  } else if (config.textShadow === "strong") {
    shadowStyle = "0 3px 8px rgba(0, 0, 0, 0.95), 0 1px 2px rgba(0, 0, 0, 0.9)";
  } else if (config.textShadow === "glow") {
    shadowStyle = `0 0 10px ${config.textColor}cc, 0 0 20px ${config.textColor}66`;
  } else if (config.textShadow === "outline") {
    shadowStyle = "-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 2px 4px rgba(0,0,0,0.9)";
  }

  let fontFamilyStyle = "'Tajawal', system-ui, -apple-system, sans-serif";
  if (config.fontFamily === "cairo") {
    fontFamilyStyle = "'Cairo', 'Tajawal', system-ui, sans-serif";
  } else if (config.fontFamily === "amiri") {
    fontFamilyStyle = "'Amiri', 'Playfair Display', Georgia, serif";
  } else if (config.fontFamily === "sans") {
    fontFamilyStyle = "'Tajawal', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
  } else if (config.fontFamily === "serif") {
    fontFamilyStyle = "'Amiri', 'Playfair Display', Georgia, serif";
  } else if (config.fontFamily === "mono") {
    fontFamilyStyle = "'Fira Code', 'Courier New', monospace";
  } else if (config.fontFamily === "system") {
    fontFamilyStyle = "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  }

  const bg = config.bgOpacity === 0 ? "transparent" : hexToRgba(config.bgColor || "#000000", config.bgOpacity / 100);
  const rad = config.borderRadius !== undefined ? `${Math.round(config.borderRadius * scaleFactor)}px` : `${Math.round(14 * scaleFactor)}px`;
  const padY = config.paddingY !== undefined ? Math.round(config.paddingY * scaleFactor) : Math.max(4, Math.round(computedFontSize * 0.3));
  const padX = config.paddingX !== undefined ? Math.round(config.paddingX * scaleFactor) : Math.max(12, Math.round(computedFontSize * 0.75));

  const letterSp = config.letterSpacing !== undefined ? `${config.letterSpacing}px` : "0px";
  const wordSp = config.wordSpacing !== undefined ? `${config.wordSpacing}px` : "0px";
  const lineH = config.lineHeight !== undefined ? config.lineHeight : 1.4;

  let computedDirection: "rtl" | "ltr" = "ltr";
  if (config.direction === "rtl") {
    computedDirection = "rtl";
  } else if (config.direction === "ltr") {
    computedDirection = "ltr";
  } else {
    // "auto" or undefined: detect language based on text (Arabic -> rtl, Foreign/Latin -> ltr)
    computedDirection = detectTextDirection(text);
  }

  return {
    fontSize: `${computedFontSize}px`,
    color: config.textColor,
    backgroundColor: bg,
    fontWeight: config.fontWeight,
    fontFamily: fontFamilyStyle,
    textShadow: shadowStyle,
    WebkitTextStroke: config.textStroke ? "1px #000000" : "none",
    padding: `${padY}px ${padX}px`,
    borderRadius: rad,
    backdropFilter: config.bgOpacity > 0 && config.bgOpacity < 90 ? "blur(10px)" : "none",
    WebkitBackdropFilter: config.bgOpacity > 0 && config.bgOpacity < 90 ? "blur(10px)" : "none",
    border: config.bgOpacity > 0 ? "1px solid rgba(255, 255, 255, 0.18)" : "none",
    boxShadow: config.bgOpacity > 0 ? "0 4px 20px rgba(0, 0, 0, 0.45)" : "none",
    display: "inline-block",
    maxWidth: "92%",
    textAlign: config.textAlign || "center",
    direction: computedDirection,
    unicodeBidi: "plaintext",
    lineHeight: lineH,
    letterSpacing: letterSp,
    wordSpacing: wordSp,
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
    textRendering: "optimizeLegibility",
    wordBreak: "break-word",
    transition: "all 0.1s ease-out"
  };
}

// ---------------------------------------------------------
// Studio-Grade Web Audio Graph Engine (Zero-Click & Super Boost)
// Eliminates 100% of popping/clicking on play/pause/seek
// ---------------------------------------------------------
interface WebAudioGraph {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
  gainNode: GainNode;
  compressor: DynamicsCompressorNode;
}

const audioGraphWeakMap = new WeakMap<HTMLMediaElement, WebAudioGraph>();

function getOrCreateAudioGraph(el: HTMLMediaElement | null): WebAudioGraph | null {
  if (!el || typeof window === "undefined") return null;
  try {
    const existing = audioGraphWeakMap.get(el);
    if (existing && existing.ctx.state !== "closed") {
      if (existing.ctx.state === "suspended") {
        existing.ctx.resume().catch(() => {});
      }
      return existing;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    const ctx = new AudioContextClass();
    const source = ctx.createMediaElementSource(el);
    const gainNode = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();

    // Studio limiter profile to prevent digital clipping when boosting volume
    compressor.threshold.setValueAtTime(-2, ctx.currentTime);
    compressor.knee.setValueAtTime(14, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.2, ctx.currentTime);

    // Graph: Source -> Gain -> Compressor -> Destination
    source.connect(gainNode);
    gainNode.connect(compressor);
    compressor.connect(ctx.destination);

    const graph: WebAudioGraph = { ctx, source, gainNode, compressor };
    audioGraphWeakMap.set(el, graph);
    return graph;
  } catch (err) {
    console.warn("Web Audio Engine fallback notice:", err);
    return null;
  }
}

interface ActiveGestureOverlay {
  id: number;
  type:
    | "play"
    | "pause"
    | "seek_backward_5s"
    | "seek_forward_5s"
    | "prev_sentence"
    | "next_sentence"
    | "volume_up"
    | "volume_down"
    | "swipe_up_sub1"
    | "swipe_up_sub2"
    | "swipe_down_sub2"
    | "swipe_down_all"
    | "toggle_controls";
  side: "left" | "right" | "center";
  label?: string;
  subLabel?: string;
}

interface MediaPlayerWorkspaceProps {
  onToggleSidebar?: () => void;
  onBackToLibrary?: () => void;
}

export const MediaPlayerWorkspace: React.FC<MediaPlayerWorkspaceProps> = ({
  onToggleSidebar,
  onBackToLibrary
}) => {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active playing media
  const [currentFile, setCurrentFile] = useState<MediaFile | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("media_player_volume");
      return saved !== null ? parseFloat(saved) : 1;
    } catch {
      return 1;
    }
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("media_player_is_muted");
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Subtitle States
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [secondaryTrackId, setSecondaryTrackId] = useState<string | null>(null);
  const [showDualSubtitles, setShowDualSubtitles] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("media_player_show_dual_subtitles");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [showSubtitlesOverlay, setShowSubtitlesOverlay] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("media_player_show_subtitles_overlay");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [showTranscriptPanel, setShowTranscriptPanel] = useState<boolean>(true);
  const [sidePanelView, setSidePanelView] = useState<"transcript" | "style">("transcript");
  const [autoScrollTranscript, setAutoScrollTranscript] = useState<boolean>(true);
  // Default is FALSE (hidden timestamps for wider text space, customizable & persisted)
  const [showCueTimestamps, setShowCueTimestamps] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("media_player_show_cue_timestamps");
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [subtitleFontSize, setSubtitleFontSize] = useState<"sm" | "md" | "lg" | "xl">("md");
  const [subtitleStyle, setSubtitleStyle] = useState<"black" | "transparent" | "yellow" | "outline">("black");
  const [subtitleSearchQuery, setSubtitleSearchQuery] = useState<string>("");

  // Speed Menu Popup State
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const speedMenuRef = useRef<HTMLDivElement>(null);

  // Fullscreen state and section ref
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showFullscreenControls, setShowFullscreenControls] = useState<boolean>(false);
  const playerSectionRef = useRef<HTMLElement>(null);

  // Immersive Theater Mode (Video huge, minimal bottom controls, side drawer for scrolling cues with toggle)
  const [isImmersiveMode, setIsImmersiveMode] = useState<boolean>(false);
  const [showImmersiveSideDrawer, setShowImmersiveSideDrawer] = useState<boolean>(true);

  // Gemini Subtitle Translation state
  const [isTranslatingTrack, setIsTranslatingTrack] = useState<boolean>(false);
  const [showTranslateModal, setShowTranslateModal] = useState<boolean>(false);
  const [translateTargetLang, setTranslateTargetLang] = useState<string>("ar");

  // Subtitle Modals
  const [showSubtitleUploadModal, setShowSubtitleUploadModal] = useState<boolean>(false);
  const [showGradioModal, setShowGradioModal] = useState<boolean>(false);
  const [subtitleUploadMode, setSubtitleUploadMode] = useState<"file" | "paste" | "ai" | "gradio">("gradio");
  const [pastedSubtitleText, setPastedSubtitleText] = useState<string>("");
  const [subtitleTrackLabel, setSubtitleTrackLabel] = useState<string>("");
  const [aiSubtitleLang, setAiSubtitleLang] = useState<string>("ar");
  const [aiPromptHint, setAiPromptHint] = useState<string>("");
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);

  // Selected AI Model (Same models as in AI Corrector / قسم صحح)
  const [selectedAiModel, setSelectedAiModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("media_player_selected_ai_model") ||
        localStorage.getItem("ai_corrector_selected_model") ||
        "gemini-3.6-flash"
      );
    }
    return "gemini-3.6-flash";
  });

  const handleSelectAiModel = (m: string) => {
    setSelectedAiModel(m);
    try {
      localStorage.setItem("media_player_selected_ai_model", m);
    } catch (e) {
      console.error("Failed to save AI model preference:", e);
    }
  };

  // Subtitle Custom Styling States (Persisted in localStorage with live updates)
  const [primarySubStyle, setPrimarySubStyle] = useState<SubtitleTrackStyleConfig>(() => {
    try {
      const saved = localStorage.getItem("media_player_sub_primary_style");
      return saved ? { ...DEFAULT_PRIMARY_STYLE, ...JSON.parse(saved) } : DEFAULT_PRIMARY_STYLE;
    } catch {
      return DEFAULT_PRIMARY_STYLE;
    }
  });

  const [secondarySubStyle, setSecondarySubStyle] = useState<SubtitleTrackStyleConfig>(() => {
    try {
      const saved = localStorage.getItem("media_player_sub_secondary_style");
      return saved ? { ...DEFAULT_SECONDARY_STYLE, ...JSON.parse(saved) } : DEFAULT_SECONDARY_STYLE;
    } catch {
      return DEFAULT_SECONDARY_STYLE;
    }
  });

  const [showSubtitleStyleModal, setShowSubtitleStyleModal] = useState<boolean>(false);
  const [showSubtitleOptionsModal, setShowSubtitleOptionsModal] = useState<boolean>(false);
  const [activeStyleTab, setActiveStyleTab] = useState<"primary" | "secondary" | "both">("primary");

  const openStyleInSidebar = (source: "gradio" | "upload" | "options" | null = null) => {
    if (source === "gradio") setShowGradioModal(false);
    if (source === "upload") setShowSubtitleUploadModal(false);
    if (source === "options") setShowSubtitleOptionsModal(false);
    setShowSubtitleStyleModal(false);
    setShowTranscriptPanel(true);
    setSidePanelView("style");
  };

  // Save subtitle styles to localStorage whenever modified
  const updatePrimarySubStyle = (updater: Partial<SubtitleTrackStyleConfig> | ((prev: SubtitleTrackStyleConfig) => SubtitleTrackStyleConfig)) => {
    setPrimarySubStyle((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      try {
        localStorage.setItem("media_player_sub_primary_style", JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const updateSecondarySubStyle = (updater: Partial<SubtitleTrackStyleConfig> | ((prev: SubtitleTrackStyleConfig) => SubtitleTrackStyleConfig)) => {
    setSecondarySubStyle((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      try {
        localStorage.setItem("media_player_sub_secondary_style", JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const updateBothSubStyles = (updater: Partial<SubtitleTrackStyleConfig>) => {
    updatePrimarySubStyle(updater);
    updateSecondarySubStyle(updater);
  };

  // Subtitle Selection Preferences per file (persisted in localStorage)
  const getSavedSubtitlePreferences = (fileId: string): { primaryId: string | null; secondaryId: string | null } => {
    try {
      const saved = localStorage.getItem(`media_player_sub_tracks_${fileId}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load subtitle preferences:", e);
    }
    return { primaryId: null, secondaryId: null };
  };

  const saveSubtitlePreferences = (fileId: string, primaryId: string | null, secondaryId: string | null) => {
    try {
      localStorage.setItem(
        `media_player_sub_tracks_${fileId}`,
        JSON.stringify({ primaryId, secondaryId })
      );
    } catch (e) {
      console.error("Failed to save subtitle preferences:", e);
    }
  };

  // Helper setters that also persist
  const handleSelectPrimaryTrack = (trackId: string | null) => {
    setActiveTrackId(trackId);
    if (currentFile) {
      saveSubtitlePreferences(currentFile.id, trackId, secondaryTrackId);
    }
  };

  const handleSelectSecondaryTrack = (trackId: string | null) => {
    setSecondaryTrackId(trackId);
    if (trackId) {
      setShowDualSubtitles(true);
      try {
        localStorage.setItem("media_player_show_dual_subtitles", JSON.stringify(true));
      } catch (e) {
        console.error(e);
      }
    }
    if (currentFile) {
      saveSubtitlePreferences(currentFile.id, activeTrackId, trackId);
    }
  };

  const handleToggleDualSubtitles = () => {
    setShowDualSubtitles((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("media_player_show_dual_subtitles", JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const handleToggleSubtitlesOverlay = () => {
    setShowSubtitlesOverlay((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("media_player_show_subtitles_overlay", JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };
  const [bufferedPercent, setBufferedPercent] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverCueText, setHoverCueText] = useState<string | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);
  const wasPlayingBeforeScrubRef = useRef<boolean>(false);

  // Pro Navigation Shortcuts & Sentence Replay States
  const singleSentencePlaybackEndRef = useRef<number | null>(null);
  const [hudToast, setHudToast] = useState<{ text: string; sub?: string } | null>(null);
  const hudTimerRef = useRef<number | null>(null);

  const triggerHud = useCallback((text: string, sub?: string) => {
    if (hudTimerRef.current) {
      window.clearTimeout(hudTimerRef.current);
    }
    setHudToast({ text, sub });
    hudTimerRef.current = window.setTimeout(() => {
      setHudToast(null);
    }, 950);
  }, []);

  // YouTube-style Gesture Overlay, Multi-Tap & Swipe Engine States
  const [activeGesture, setActiveGesture] = useState<ActiveGestureOverlay | null>(null);
  const gestureTimerRef = useRef<number | null>(null);
  const tapTrackerRef = useRef<{
    count: number;
    side: "left" | "right" | "center";
    timer: number | null;
    lastTime: number;
  } | null>(null);
  const pointerStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    isPotentialSwipe: boolean;
  } | null>(null);

  const triggerVisualFeedback = useCallback((gesture: Omit<ActiveGestureOverlay, "id">) => {
    if (gestureTimerRef.current) {
      window.clearTimeout(gestureTimerRef.current);
    }
    const id = Date.now();
    setActiveGesture({ ...gesture, id });
    gestureTimerRef.current = window.setTimeout(() => {
      setActiveGesture(null);
    }, 340);
  }, []);

  // Edit / Add Cue Modal
  const [editingCue, setEditingCue] = useState<SubtitleCue | null>(null);
  const [syncWithSecondaryTrack, setSyncWithSecondaryTrack] = useState<boolean>(true);
  const originalCueTimesRef = useRef<{ id: string; startTime: number; endTime: number; text: string } | null>(null);
  const [copiedTranscript, setCopiedTranscript] = useState<boolean>(false);

  // Filters and UI states
  const [filterType, setFilterType] = useState<"all" | "video" | "audio">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Editing file title
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState<string>("");

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const subtitleFileInputRef = useRef<HTMLInputElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const activeCueRef = useRef<HTMLDivElement | null>(null);

  // Fetch files from server
  const fetchMediaFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media/files");
      if (!res.ok) throw new Error("فشل في جلب قائمة الملفات");
      const data = await res.json();
      const loadedFiles: MediaFile[] = data.files || [];
      setFiles(loadedFiles);

      // Keep currentFile synchronized or restore previously playing file
      if (currentFile) {
        const updatedCurrent = loadedFiles.find((f) => f.id === currentFile.id);
        if (updatedCurrent) {
          setCurrentFile(updatedCurrent);
        }
      } else {
        const lastPlayedId = localStorage.getItem("media_player_last_played_file_id");
        if (lastPlayedId) {
          const matched = loadedFiles.find((f) => f.id === lastPlayedId);
          if (matched) {
            setCurrentFile(matched);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "حدث خطأ أثناء تحميل الملفات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMediaFiles();
  }, []);

  // Save currently selected file to localStorage
  const handleSelectFile = (file: MediaFile | null, autoPlay: boolean = true) => {
    setCurrentFile(file);
    setIsPlaying(autoPlay);
    try {
      if (file) {
        localStorage.setItem("media_player_last_played_file_id", file.id);
      } else {
        localStorage.removeItem("media_player_last_played_file_id");
      }
    } catch (e) {
      console.error("Failed to save last played file:", e);
    }
  };

  // Set active and secondary subtitle tracks when currentFile changes (restoring saved preferences)
  useEffect(() => {
    if (currentFile?.subtitles && currentFile.subtitles.length > 0) {
      const savedPrefs = getSavedSubtitlePreferences(currentFile.id);

      // Restore Primary Track
      if (savedPrefs.primaryId && currentFile.subtitles.some((t) => t.id === savedPrefs.primaryId)) {
        setActiveTrackId(savedPrefs.primaryId);
      } else if (!activeTrackId || !currentFile.subtitles.some((t) => t.id === activeTrackId)) {
        setActiveTrackId(currentFile.subtitles[0].id);
      }

      // Restore Secondary Track
      if (savedPrefs.secondaryId && currentFile.subtitles.some((t) => t.id === savedPrefs.secondaryId)) {
        setSecondaryTrackId(savedPrefs.secondaryId);
      } else if (currentFile.subtitles.length > 1 && (!secondaryTrackId || !currentFile.subtitles.some((t) => t.id === secondaryTrackId))) {
        const otherTrack = currentFile.subtitles.find((t) => t.id !== (activeTrackId || currentFile.subtitles![0].id));
        if (otherTrack) {
          setSecondaryTrackId(otherTrack.id);
        }
      }
    } else {
      setActiveTrackId(null);
      setSecondaryTrackId(null);
    }
  }, [currentFile]);

  // Active Subtitle Track (Primary) and Cues
  const activeTrack = useMemo(() => {
    if (!currentFile?.subtitles || !activeTrackId) return null;
    return currentFile.subtitles.find((t) => t.id === activeTrackId) || null;
  }, [currentFile, activeTrackId]);

  const activeCues = useMemo(() => {
    return activeTrack?.cues || [];
  }, [activeTrack]);

  // Current active Cue matching current time for Primary Track
  const currentCue = useMemo(() => {
    if (!activeCues || activeCues.length === 0) return null;
    return activeCues.find(
      (cue) => currentTime >= cue.startTime && currentTime <= cue.endTime
    ) || null;
  }, [activeCues, currentTime]);

  // Secondary Subtitle Track (For Dual Subtitles / الترجمة المزدوجة)
  const secondaryTrack = useMemo(() => {
    if (!currentFile?.subtitles || !secondaryTrackId || secondaryTrackId === activeTrackId) return null;
    return currentFile.subtitles.find((t) => t.id === secondaryTrackId) || null;
  }, [currentFile, secondaryTrackId, activeTrackId]);

  const secondaryCues = useMemo(() => {
    return secondaryTrack?.cues || [];
  }, [secondaryTrack]);

  // Current active Cue for Secondary Track
  const currentSecondaryCue = useMemo(() => {
    if (!secondaryCues || secondaryCues.length === 0) return null;
    return secondaryCues.find(
      (cue) => currentTime >= cue.startTime && currentTime <= cue.endTime
    ) || null;
  }, [secondaryCues, currentTime]);

  // Auto-scroll transcript container only to active cue (isolated from page scroll)
  useEffect(() => {
    if (autoScrollTranscript && activeCueRef.current && transcriptContainerRef.current) {
      const container = transcriptContainerRef.current;
      const element = activeCueRef.current;

      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Calculate relative vertical offset inside the subtitles list container only
      const relativeTop = elementRect.top - containerRect.top;
      const targetScrollTop =
        container.scrollTop + relativeTop - container.clientHeight / 2 + element.clientHeight / 2;

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: "smooth"
      });
    }
  }, [currentCue, autoScrollTranscript]);

  // Get user-configured Gemini API key from Settings / localStorage
  const getSavedGeminiKey = (): string => {
    return (
      localStorage.getItem("settings_gemini_api_key") ||
      localStorage.getItem("gemini_api_key") ||
      localStorage.getItem("user_gemini_key") ||
      localStorage.getItem("GEMINI_API_KEY") ||
      ""
    ).trim();
  };

  // Translate Subtitle Track with Gemini AI
  const handleTranslateTrackWithGemini = async (targetLang = "ar") => {
    if (!currentFile || !activeTrack) {
      setErrorMsg("يرجى اختيار مسار ترجمة أصلي أولاً لترجمته");
      return;
    }

    setIsTranslatingTrack(true);
    setErrorMsg(null);

    const savedKey = getSavedGeminiKey();

    try {
      const res = await fetch(`/api/media/${currentFile.id}/translate-subtitles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(savedKey ? { "x-gemini-key": savedKey, Authorization: `Bearer ${savedKey}` } : {})
        },
        body: JSON.stringify({
          trackId: activeTrack.id,
          targetLanguage: targetLang,
          sourceLanguage: activeTrack.language || "de",
          selectedModel: selectedAiModel,
          customApiKey: savedKey || undefined,
          geminiApiKey: savedKey || undefined,
          userApiKey: savedKey || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "فشلت ترجمة المسار عبر Gemini AI");
      }

      const data = await res.json();
      setSuccessMsg(data.message || `تم إنشاء الترجمة العربية بنجاح وتفعيل الترجمة المزدوجة! 🇸🇦⚡`);

      if (data.file) {
        setCurrentFile(data.file);
        setFiles(prev => prev.map(f => f.id === data.file.id ? data.file : f));
      }

      // Automatically set the new translated track as secondary track for dual subtitles!
      if (data.track) {
        setSecondaryTrackId(data.track.id);
        setShowDualSubtitles(true);
      }
      setShowTranslateModal(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "حدث خطأ أثناء ترجمة مسار الترجمة بالذكاء الاصطناعي");
    } finally {
      setIsTranslatingTrack(false);
    }
  };

  // Upload handler for Media Files
  const handleUploadFiles = (fileList: FileList | File[]) => {
    if (!fileList || fileList.length === 0) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append("files", fileList[i]);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media/upload", true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          setSuccessMsg(res.message || "تم رفع الملف بنجاح!");
          fetchMediaFiles();
          if (res.files && res.files.length > 0) {
            setCurrentFile(res.files[0]);
            setIsPlaying(true);
          }
        } catch {
          fetchMediaFiles();
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          setErrorMsg(errRes.error || "فشل رفع الملف");
        } catch {
          setErrorMsg("حدث خطأ أثناء رفع الملف إلى السيرفر");
        }
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setErrorMsg("حدث خطأ في الاتصال بالسيرفر أثناء الرفع");
    };

    xhr.send(formData);
  };

  // Subtitle File Upload / Parse Handler
  const handleSubtitleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentFile) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setErrorMsg("ملف الترجمة فارغ");
        return;
      }

      const parsedCues = parseSubtitleContent(text);
      if (parsedCues.length === 0) {
        setErrorMsg("تعذر قراءة مقاطع الترجمة من هذا الملف. تأكد من أنه بصيغة SRT أو VTT صحيحة.");
        return;
      }

      const defaultLabel = file.name.replace(/\.[^/.]+$/, "") || "ترجمة مرفوعة";
      await saveSubtitleTrackToServer(currentFile.id, defaultLabel, parsedCues, "uploaded");
      setShowSubtitleUploadModal(false);
      setPastedSubtitleText("");
    };

    reader.onerror = () => {
      setErrorMsg("حدث خطأ أثناء قراءة ملف الترجمة");
    };

    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  // Subtitle Text Paste Handler
  const handleSavePastedSubtitles = async () => {
    if (!currentFile || !pastedSubtitleText.trim()) return;

    const parsedCues = parseSubtitleContent(pastedSubtitleText);
    if (parsedCues.length === 0) {
      setErrorMsg("تعذر استخراج المقاطع الزمنية من النص. تأكد من كتابة الوقت بتنسيق SRT مثل 00:00:01 --> 00:00:04");
      return;
    }

    const label = subtitleTrackLabel.trim() || `ترجمة يدوية (${parsedCues.length} جملة)`;
    await saveSubtitleTrackToServer(currentFile.id, label, parsedCues, "manual");
    setShowSubtitleUploadModal(false);
    setPastedSubtitleText("");
    setSubtitleTrackLabel("");
  };

  // AI Generate Subtitles
  const handleGenerateAiSubtitles = async () => {
    if (!currentFile) return;
    setIsAiGenerating(true);
    setErrorMsg(null);

    const savedKey = getSavedGeminiKey();

    try {
      const res = await fetch(`/api/media/${currentFile.id}/generate-subtitles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(savedKey ? { "x-gemini-key": savedKey, Authorization: `Bearer ${savedKey}` } : {})
        },
        body: JSON.stringify({
          language: aiSubtitleLang,
          promptHint: aiPromptHint.trim(),
          fullText: pastedSubtitleText.trim(),
          selectedModel: selectedAiModel,
          customApiKey: savedKey || undefined,
          geminiApiKey: savedKey || undefined,
          userApiKey: savedKey || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "فشل توليد الترجمة بالذكاء الاصطناعي");
      }

      const data = await res.json();
      setSuccessMsg("تم توليد الترجمة الذكية بنجاح وربطها بالمقطع! ⚡");
      
      // Update state
      if (data.file) {
        setCurrentFile(data.file);
        setFiles(prev => prev.map(f => f.id === data.file.id ? data.file : f));
      }
      if (data.track) {
        setActiveTrackId(data.track.id);
      }
      setShowSubtitleUploadModal(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "حدث خطأ أثناء توليد الترجمة بالذكاء الاصطناعي");
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Save Subtitle Track to Server (supports adding new track or updating existing track by trackId)
  const saveSubtitleTrackToServer = async (
    mediaId: string,
    label: string,
    cues: SubtitleCue[],
    source: "uploaded" | "ai" | "manual",
    trackId?: string
  ) => {
    // Optimistic local state update for instant UI response
    const cleanCues = cues.map((c, idx) => ({
      id: c.id || `cue-${idx + 1}`,
      startTime: Math.max(0, parseFloat(String(c.startTime)) || 0),
      endTime: Math.max(0.1, parseFloat(String(c.endTime)) || 1),
      text: (c.text || "").trim()
    })).filter((c) => c.text.length > 0);

    if (currentFile && currentFile.id === mediaId) {
      const existingSubs = currentFile.subtitles ? [...currentFile.subtitles] : [];
      let updatedSubs: MediaSubtitleTrack[];

      if (trackId && existingSubs.some((t) => t.id === trackId)) {
        updatedSubs = existingSubs.map((t) =>
          t.id === trackId ? { ...t, cues: cleanCues, label: label || t.label } : t
        );
      } else {
        const dummyTrack: MediaSubtitleTrack = {
          id: trackId || `sub-${Date.now()}`,
          label: label || "الترجمة",
          cues: cleanCues,
          source,
          uploadedAt: new Date().toISOString()
        };
        updatedSubs = [dummyTrack, ...existingSubs];
      }

      const updatedFile = { ...currentFile, subtitles: updatedSubs };
      setCurrentFile(updatedFile);
      setFiles((prev) => prev.map((f) => (f.id === mediaId ? updatedFile : f)));
    }

    try {
      const res = await fetch(`/api/media/${mediaId}/subtitles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, cues: cleanCues, source, trackId })
      });

      if (!res.ok) throw new Error("فشل حفظ ملف الترجمة على السيرفر");
      const data = await res.json();

      setSuccessMsg(`تم حفظ وتحديث الترجمة بنجاح! (${cleanCues.length} مقطع)`);
      if (data.file) {
        setCurrentFile(data.file);
        setFiles((prev) => prev.map((f) => (f.id === data.file.id ? data.file : f)));
      }
      if (data.track) {
        setActiveTrackId(data.track.id);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "حدث خطأ أثناء حفظ الترجمة");
    }
  };

  // Delete Subtitle Track
  const handleDeleteSubtitleTrack = async (trackId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentFile) return;
    if (!window.confirm("هل تريد حذف مسار الترجمة هذا نهائياً؟")) return;

    try {
      const res = await fetch(`/api/media/${currentFile.id}/subtitles/${trackId}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("فشل حذف مسار الترجمة");
      const data = await res.json();

      setSuccessMsg("تم حذف مسار الترجمة بنجاح");
      if (data.file) {
        setCurrentFile(data.file);
        setFiles(prev => prev.map(f => f.id === data.file.id ? data.file : f));
        if (activeTrackId === trackId) {
          const remaining = data.file.subtitles || [];
          setActiveTrackId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء حذف الترجمة");
    }
  };

  // Open Cue Edit Modal
  const handleOpenEditCue = (cue: SubtitleCue) => {
    originalCueTimesRef.current = {
      id: cue.id,
      startTime: cue.startTime,
      endTime: cue.endTime,
      text: cue.text
    };
    setEditingCue({ ...cue });
    setSyncWithSecondaryTrack(Boolean(secondaryTrack && secondaryTrack.id !== activeTrackId));
  };

  // Add new Cue at current timestamp
  const handleAddNewCueAtCurrentTime = () => {
    if (!currentFile || !activeTrack) {
      setShowSubtitleUploadModal(true);
      return;
    }

    const start = Math.round(currentTime * 10) / 10;
    const newCue: SubtitleCue = {
      id: `cue-${Date.now()}`,
      startTime: start,
      endTime: start + 3,
      text: "اكتب نص الترجمة هنا..."
    };

    const updatedCues = [...activeTrack.cues, newCue].sort((a, b) => a.startTime - b.startTime);
    saveSubtitleTrackToServer(currentFile.id, activeTrack.label, updatedCues, "manual", activeTrack.id);
    handleOpenEditCue(newCue);
  };

  // Save edited cue with optional synchronization to secondary track
  const handleSaveEditedCue = (cueToSave?: SubtitleCue, shouldSyncSecondary?: boolean) => {
    const targetCue = cueToSave || editingCue;
    if (!targetCue || !currentFile || !activeTrack) return;

    const doSync = shouldSyncSecondary !== undefined ? shouldSyncSecondary : syncWithSecondaryTrack;
    const cleanStartTime = Math.max(0, Math.round(targetCue.startTime * 10) / 10);
    const cleanEndTime = Math.max(cleanStartTime + 0.2, Math.round(targetCue.endTime * 10) / 10);
    
    const cleanCue: SubtitleCue = {
      ...targetCue,
      startTime: cleanStartTime,
      endTime: cleanEndTime,
      text: targetCue.text.trim()
    };

    const updatedCues = activeTrack.cues
      .map((c) => (c.id === cleanCue.id ? cleanCue : c))
      .sort((a, b) => a.startTime - b.startTime);

    saveSubtitleTrackToServer(currentFile.id, activeTrack.label, updatedCues, "manual", activeTrack.id);

    // Synchronize to secondary subtitle track if requested and available
    if (doSync && secondaryTrack && secondaryTrack.id !== activeTrack.id && secondaryTrack.cues.length > 0) {
      const origTimes = originalCueTimesRef.current || {
        startTime: cleanStartTime,
        endTime: cleanEndTime,
        id: cleanCue.id,
        text: cleanCue.text
      };

      // Match best candidate in secondary track (highest time overlap, or closest start time)
      let bestMatchIdx = -1;
      let maxOverlap = 0;

      secondaryTrack.cues.forEach((sc, idx) => {
        const overlapStart = Math.max(sc.startTime, origTimes.startTime);
        const overlapEnd = Math.min(sc.endTime, origTimes.endTime);
        const overlap = Math.max(0, overlapEnd - overlapStart);
        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          bestMatchIdx = idx;
        }
      });

      if (bestMatchIdx === -1) {
        let minDiff = Infinity;
        secondaryTrack.cues.forEach((sc, idx) => {
          const diff = Math.abs(sc.startTime - origTimes.startTime);
          if (diff < minDiff) {
            minDiff = diff;
            bestMatchIdx = idx;
          }
        });
      }

      if (bestMatchIdx !== -1) {
        const updatedSecCues = secondaryTrack.cues.map((sc, idx) => {
          if (idx === bestMatchIdx) {
            return {
              ...sc,
              startTime: cleanStartTime,
              endTime: cleanEndTime
            };
          }
          return sc;
        }).sort((a, b) => a.startTime - b.startTime);

        saveSubtitleTrackToServer(currentFile.id, secondaryTrack.label, updatedSecCues, "manual", secondaryTrack.id);
        triggerHud("تمت مزامنة الترجمة الثانية ✓", "⚡");
      }
    }

    setEditingCue(null);
    originalCueTimesRef.current = null;
  };

  // Delete single cue
  const handleDeleteCue = (cueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentFile || !activeTrack) return;

    const updatedCues = activeTrack.cues.filter((c) => c.id !== cueId);
    saveSubtitleTrackToServer(currentFile.id, activeTrack.label, updatedCues, "manual", activeTrack.id);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const firstFile = e.dataTransfer.files[0];
      const ext = firstFile.name.split(".").pop()?.toLowerCase();

      // If user dropped an SRT or VTT file and we have active media, upload as subtitle!
      if (["srt", "vtt", "txt", "sbv", "sub"].includes(ext || "") && currentFile) {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const content = evt.target?.result as string;
          const parsed = parseSubtitleContent(content);
          if (parsed.length > 0) {
            await saveSubtitleTrackToServer(
              currentFile.id,
              firstFile.name.replace(/\.[^/.]+$/, ""),
              parsed,
              "uploaded"
            );
          }
        };
        reader.readAsText(firstFile);
        return;
      }

      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Delete media file
  const handleDeleteFile = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("هل أنت متأكد من حذف هذا الملف نهائياً من السيرفر؟")) {
      return;
    }

    try {
      const res = await fetch(`/api/media/files/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل في حذف الملف");

      setFiles((prev) => prev.filter((f) => f.id !== id));
      if (currentFile?.id === id) {
        setCurrentFile(null);
        setIsPlaying(false);
      }
      setSuccessMsg("تم حذف الملف بنجاح");
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء الحذف");
    }
  };

  // Rename media file
  const handleStartRename = (file: MediaFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingId(file.id);
    setEditTitleText(file.title);
  };

  const handleSaveRename = async (id: string) => {
    if (!editTitleText.trim()) {
      setEditingId(null);
      return;
    }

    try {
      const res = await fetch(`/api/media/files/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitleText.trim() })
      });
      if (!res.ok) throw new Error("فشل تعديل الاسم");

      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, title: editTitleText.trim() } : f))
      );
      if (currentFile?.id === id) {
        setCurrentFile((prev) => (prev ? { ...prev, title: editTitleText.trim() } : null));
      }
      setEditingId(null);
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء تعديل الاسم");
    }
  };

  // Media Player element getter & control handlers
  const getMediaElement = () => (currentFile?.type === "video" ? videoRef.current : audioRef.current);

  // ---------------------------------------------------------
  // Zero-Click Studio Audio Engine (Anti-Pop / Zero DC Offset)
  // ---------------------------------------------------------
  const smoothPause = useCallback((onPaused?: () => void) => {
    const el = getMediaElement();
    if (!el) return;

    const graph = getOrCreateAudioGraph(el);
    if (graph && graph.ctx.state === "running") {
      const now = graph.ctx.currentTime;
      // 25ms micro-fade to 0.0001 prevents abrupt wave cutoff pops
      graph.gainNode.gain.cancelScheduledValues(now);
      graph.gainNode.gain.setValueAtTime(Math.max(0.0001, graph.gainNode.gain.value), now);
      graph.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

      setTimeout(() => {
        el.pause();
        setIsPlaying(false);
        if (onPaused) onPaused();
      }, 28);
    } else {
      el.pause();
      setIsPlaying(false);
      if (onPaused) onPaused();
    }
  }, [currentFile]);

  const smoothPlay = useCallback(() => {
    const el = getMediaElement();
    if (!el) return;

    const graph = getOrCreateAudioGraph(el);
    const targetGain = isMuted ? 0 : volume; // Supports up to 2.0 (200% Super Boost)

    if (graph) {
      if (graph.ctx.state === "suspended") {
        graph.ctx.resume().catch(() => {});
      }
      const now = graph.ctx.currentTime;
      // Start from 0.0001 to prevent initial transient click
      graph.gainNode.gain.cancelScheduledValues(now);
      graph.gainNode.gain.setValueAtTime(0.0001, now);

      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            const t = graph.ctx.currentTime;
            graph.gainNode.gain.setValueAtTime(0.0001, t);
            graph.gainNode.gain.linearRampToValueAtTime(Math.max(0.0001, targetGain), t + 0.035);
          })
          .catch((err) => {
            console.warn("Playback interrupted or prevented:", err);
          });
      }
    } else {
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise.then(() => setIsPlaying(true)).catch(console.warn);
      }
    }
  }, [currentFile, isMuted, volume]);

  const togglePlay = useCallback(() => {
    const el = getMediaElement();
    if (!el) return;
    if (!el.paused) {
      smoothPause();
    } else {
      smoothPlay();
    }
  }, [smoothPause, smoothPlay, currentFile]);

  // Zero-Click Instant Seeking Engine for Sentences & Timeline
  const handleSeek = useCallback((newTime: number) => {
    const el = getMediaElement();
    if (!el) return;
    const totalDuration = duration || el.duration || 0;
    const boundedTime = Math.max(0, Math.min(newTime, totalDuration > 0 ? totalDuration : Infinity));

    const graph = getOrCreateAudioGraph(el);
    const isCurrentlyPlaying = !el.paused;

    if (graph && graph.ctx.state === "running" && isCurrentlyPlaying) {
      const now = graph.ctx.currentTime;
      const targetGain = isMuted ? 0 : volume;
      // Micro fade-out 12ms before seek -> fast seek -> micro fade-in 30ms to completely eliminate seeking clicks
      graph.gainNode.gain.cancelScheduledValues(now);
      graph.gainNode.gain.setValueAtTime(Math.max(0.0001, graph.gainNode.gain.value), now);
      graph.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

      setTimeout(() => {
        if ("fastSeek" in el && typeof (el as any).fastSeek === "function") {
          try {
            (el as any).fastSeek(boundedTime);
          } catch {
            el.currentTime = boundedTime;
          }
        } else {
          el.currentTime = boundedTime;
        }
        setCurrentTime(boundedTime);

        const resumeTime = graph.ctx.currentTime;
        graph.gainNode.gain.setValueAtTime(0.0001, resumeTime);
        graph.gainNode.gain.linearRampToValueAtTime(Math.max(0.0001, targetGain), resumeTime + 0.03);
      }, 15);
    } else {
      if ("fastSeek" in el && typeof (el as any).fastSeek === "function") {
        try {
          (el as any).fastSeek(boundedTime);
        } catch {
          el.currentTime = boundedTime;
        }
      } else {
        el.currentTime = boundedTime;
      }
      setCurrentTime(boundedTime);
    }
  }, [duration, isMuted, volume, currentFile]);

  // Calculate precise time from pointer event relative to timeline LTR width
  const calculateTimeFromEvent = (e: MouseEvent | TouchEvent | React.MouseEvent | React.PointerEvent | PointerEvent) => {
    if (!progressBarRef.current) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;

    let clientX = 0;
    if ("clientX" in e && typeof e.clientX === "number") {
      clientX = e.clientX;
    } else if ("touches" in e && (e as TouchEvent).touches.length > 0) {
      clientX = (e as TouchEvent).touches[0].clientX;
    }

    // Force strictly LTR calculation: 0 = Left edge, 1 = Right edge
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const totalDuration = duration || getMediaElement()?.duration || 0;
    return fraction * totalDuration;
  };

  // Smooth YouTube-like Drag & Scrub pointer handler
  const handlePointerDownTimeline = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!progressBarRef.current) return;

    const el = getMediaElement();
    const isCurrentlyPlaying = el ? !el.paused : isPlaying;
    wasPlayingBeforeScrubRef.current = isCurrentlyPlaying;

    // Immediately pause and silence during scrubbing
    if (el && isCurrentlyPlaying) {
      const graph = getOrCreateAudioGraph(el);
      if (graph && graph.ctx.state === "running") {
        graph.gainNode.gain.setValueAtTime(0.0001, graph.ctx.currentTime);
      }
      el.pause();
      setIsPlaying(false);
    }

    setIsScrubbing(true);

    const targetTime = calculateTimeFromEvent(e);
    if (el) {
      el.currentTime = targetTime;
    }
    setCurrentTime(targetTime);

    const onPointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const newTime = calculateTimeFromEvent(ev);
      if (el) {
        el.currentTime = newTime;
      }
      setCurrentTime(newTime);
    };

    const onPointerUp = (ev: PointerEvent) => {
      ev.preventDefault();
      setIsScrubbing(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      const finalTime = calculateTimeFromEvent(ev);
      if (el) {
        el.currentTime = finalTime;
      }
      setCurrentTime(finalTime);

      // Only resume playing when the user releases the mouse if it was previously playing
      if (wasPlayingBeforeScrubRef.current && el) {
        smoothPlay();
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPointerUp, { passive: false });
  };

  // Timeline hover position & tooltip (Throttled for zero playback interference)
  const hoverSeekThrottleRef = useRef<number | null>(null);

  const handleTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const totalDuration = duration || getMediaElement()?.duration || 0;
    const calculatedTime = fraction * totalDuration;

    setHoverPosition(fraction * 100);
    setHoverTime(calculatedTime);

    // Throttled sync for preview frame bubble without overloading video decoder
    if (previewVideoRef.current && currentFile?.type === "video") {
      if (!hoverSeekThrottleRef.current) {
        hoverSeekThrottleRef.current = window.setTimeout(() => {
          hoverSeekThrottleRef.current = null;
          if (previewVideoRef.current) {
            try {
              previewVideoRef.current.currentTime = calculatedTime;
            } catch {
              // Safe catch
            }
          }
        }, 60);
      }
    }

    // Find cue text at this hover time
    const cueAtTime = activeCues.find(c => calculatedTime >= c.startTime && calculatedTime <= c.endTime);
    setHoverCueText(cueAtTime?.text || null);
  };

  const handleTimelinePointerLeave = () => {
    if (!isScrubbing) {
      setHoverPosition(null);
      setHoverTime(null);
      setHoverCueText(null);
    }
  };

  const skipSeconds = (seconds: number) => {
    const el = getMediaElement();
    if (!el) return;
    const totalDuration = duration || el.duration || Infinity;
    const target = Math.min(Math.max(0, el.currentTime + seconds), totalDuration);
    handleSeek(target);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    if (audioRef.current) audioRef.current.playbackRate = speed;
  };

  const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  // Instant one-click speed cycling
  const cyclePlaybackSpeed = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const nextSpeed = PLAYBACK_SPEEDS[nextIndex];
    handleSpeedChange(nextSpeed);
    triggerHud(`سرعة التشغيل: ${nextSpeed}x`, "⚡");
  };

  const toggleMute = useCallback(() => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    try {
      localStorage.setItem("media_player_is_muted", JSON.stringify(nextMute));
    } catch (e) {
      console.error(e);
    }
    const el = getMediaElement();
    if (el) {
      el.muted = nextMute;
      const graph = getOrCreateAudioGraph(el);
      if (graph && graph.ctx.state !== "closed") {
        const targetGain = nextMute ? 0 : volume;
        const now = graph.ctx.currentTime;
        graph.gainNode.gain.cancelScheduledValues(now);
        graph.gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.02);
      }
    }
    triggerHud(nextMute ? "كتم الصوت" : "إلغاء الكتم", "M");
  }, [isMuted, volume, triggerHud]);

  const handleVolumeChange = useCallback((newVol: number) => {
    // Supports volume up to 2.0 (200% Super Boost) with distortion prevention
    const clampedVol = Math.max(0, Math.min(2.0, newVol));
    setVolume(clampedVol);
    const nextMute = clampedVol === 0;
    setIsMuted(nextMute);
    try {
      localStorage.setItem("media_player_volume", clampedVol.toString());
      localStorage.setItem("media_player_is_muted", JSON.stringify(nextMute));
    } catch (e) {
      console.error(e);
    }

    const el = getMediaElement();
    if (el) {
      el.muted = nextMute;
      const graph = getOrCreateAudioGraph(el);
      if (graph && graph.ctx.state !== "closed") {
        el.volume = 1;
        const targetGain = nextMute ? 0 : clampedVol;
        const now = graph.ctx.currentTime;
        graph.gainNode.gain.cancelScheduledValues(now);
        graph.gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.02);
      } else {
        el.volume = Math.min(1, clampedVol);
      }
    }

    if (clampedVol > 1.0) {
      triggerHud(`تعزيز الصوت: ${Math.round(clampedVol * 100)}% ⚡`, "BOOST");
    }
  }, [triggerHud]);

  const handleToggleFullscreen = () => {
    const target = playerSectionRef.current || videoRef.current;
    if (!target) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    } else {
      if (target.requestFullscreen) {
        target.requestFullscreen().catch((err) => {
          console.error("Fullscreen error, fallback to video element:", err);
          if (videoRef.current?.requestFullscreen) {
            videoRef.current.requestFullscreen().catch(console.error);
          }
        });
      }
    }
  };

  // Sync fullscreen state
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      setShowFullscreenControls(false);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  // Close Speed menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setShowSpeedMenu(false);
      }
    };
    if (showSpeedMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSpeedMenu]);

  // Play next or previous track in list
  const handleNextTrack = () => {
    if (!currentFile || filteredFiles.length <= 1) return;
    const currentIndex = filteredFiles.findIndex((f) => f.id === currentFile.id);
    const nextIndex = (currentIndex + 1) % filteredFiles.length;
    setCurrentFile(filteredFiles[nextIndex]);
    setIsPlaying(true);
  };

  const handlePrevTrack = () => {
    if (!currentFile || filteredFiles.length <= 1) return;
    const currentIndex = filteredFiles.findIndex((f) => f.id === currentFile.id);
    const prevIndex = (currentIndex - 1 + filteredFiles.length) % filteredFiles.length;
    setCurrentFile(filteredFiles[prevIndex]);
    setIsPlaying(true);
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Filtered files for Library view
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const matchesType =
        filterType === "all" ||
        (filterType === "video" && f.type === "video") ||
        (filterType === "audio" && f.type === "audio");

      const matchesSearch =
        searchQuery.trim() === "" ||
        f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.originalName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesType && matchesSearch;
    });
  }, [files, filterType, searchQuery]);

  // Filtered Subtitle Cues for search
  const filteredCues = useMemo(() => {
    if (!subtitleSearchQuery.trim()) return activeCues;
    return activeCues.filter((c) =>
      c.text.toLowerCase().includes(subtitleSearchQuery.toLowerCase())
    );
  }, [activeCues, subtitleSearchQuery]);

  // Statistics
  const totalVideos = useMemo(() => files.filter((f) => f.type === "video").length, [files]);
  const totalAudios = useMemo(() => files.filter((f) => f.type === "audio").length, [files]);
  const totalSize = useMemo(() => files.reduce((acc, f) => acc + (f.size || 0), 0), [files]);

  // Pro Navigation Shortcuts & Sentence Handlers
  // Replay current sentence only (R)
  const replayCurrentSentenceOnly = useCallback(() => {
    if (!activeCues || activeCues.length === 0) return;
    const el = getMediaElement();
    const time = el ? el.currentTime : currentTime;

    let targetCue = activeCues.find(
      (c) => time >= c.startTime && time <= c.endTime
    );
    if (!targetCue) {
      const prevCues = activeCues.filter((c) => c.startTime <= time);
      if (prevCues.length > 0) {
        targetCue = prevCues[prevCues.length - 1];
      } else {
        targetCue = activeCues[0];
      }
    }

    if (targetCue) {
      singleSentencePlaybackEndRef.current = targetCue.endTime;
      handleSeek(targetCue.startTime);
      smoothPlay();
      triggerHud("إعادة الجملة الحالية فقط", "R");
    }
  }, [activeCues, currentTime, handleSeek, smoothPlay, triggerHud]);

  // Jump to Previous Sentence ([)
  const jumpToPreviousSentence = useCallback((keepPlayingState: boolean = true) => {
    const el = getMediaElement();
    const time = el ? el.currentTime : currentTime;
    const isCurrentlyPlaying = el ? !el.paused : isPlaying;

    if (!activeCues || activeCues.length === 0) {
      skipSeconds(-5);
      return;
    }

    const currentIdx = activeCues.findIndex(
      (c) => time >= c.startTime && time <= c.endTime
    );

    let targetCue: SubtitleCue;
    if (currentIdx > 0) {
      // If user is more than 1.2s into current cue, restart current cue, otherwise go to previous
      if (time - activeCues[currentIdx].startTime > 1.2) {
        targetCue = activeCues[currentIdx];
      } else {
        targetCue = activeCues[currentIdx - 1];
      }
    } else if (currentIdx === 0) {
      targetCue = activeCues[0];
    } else {
      const prevCues = activeCues.filter((c) => c.startTime < time);
      if (prevCues.length > 0) {
        targetCue = prevCues[prevCues.length - 1];
      } else {
        targetCue = activeCues[0];
      }
    }

    if (targetCue) {
      singleSentencePlaybackEndRef.current = null;
      handleSeek(targetCue.startTime);
      if (isCurrentlyPlaying && keepPlayingState) {
        smoothPlay();
      }
      triggerHud("الجملة السابقة", "[");
    }
  }, [activeCues, currentTime, handleSeek, isPlaying, smoothPlay, skipSeconds, triggerHud]);

  // Jump to Next Sentence (])
  const jumpToNextSentence = useCallback((keepPlayingState: boolean = true) => {
    const el = getMediaElement();
    const time = el ? el.currentTime : currentTime;
    const isCurrentlyPlaying = el ? !el.paused : isPlaying;

    if (!activeCues || activeCues.length === 0) {
      skipSeconds(5);
      return;
    }

    const currentIdx = activeCues.findIndex(
      (c) => time >= c.startTime && time <= c.endTime
    );

    let targetCue: SubtitleCue | null = null;
    if (currentIdx >= 0 && currentIdx < activeCues.length - 1) {
      targetCue = activeCues[currentIdx + 1];
    } else if (currentIdx === -1) {
      const nextCue = activeCues.find((c) => c.startTime > time);
      if (nextCue) targetCue = nextCue;
    }

    if (targetCue) {
      singleSentencePlaybackEndRef.current = null;
      handleSeek(targetCue.startTime);
      if (isCurrentlyPlaying && keepPlayingState) {
        smoothPlay();
      }
      triggerHud("الجملة التالية", "]");
    }
  }, [activeCues, currentTime, handleSeek, isPlaying, smoothPlay, skipSeconds, triggerHud]);

  // Sync media element events and buffer indicator
  useEffect(() => {
    const el = currentFile?.type === "video" ? videoRef.current : audioRef.current;
    if (!el) return;

    el.playbackRate = playbackRate;
    el.loop = isLooping;
    el.volume = Math.min(1, Math.max(0, isMuted ? 0 : volume > 1 ? 1 : volume));
    el.muted = isMuted;

    const graph = getOrCreateAudioGraph(el);
    if (graph && graph.ctx.state !== "closed") {
      const targetGain = isMuted ? 0 : volume;
      const now = graph.ctx.currentTime;
      graph.gainNode.gain.cancelScheduledValues(now);
      graph.gainNode.gain.setValueAtTime(targetGain, now);
    }

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      const cur = el.currentTime;
      setCurrentTime(cur);
      // Auto-stop when single-sentence playback limit is reached
      if (
        singleSentencePlaybackEndRef.current !== null &&
        cur >= singleSentencePlaybackEndRef.current
      ) {
        singleSentencePlaybackEndRef.current = null;
        smoothPause();
      }
    };
    const onLoadedMetadata = () => {
      setDuration(el.duration);
      if (isPlaying) {
        el.play().catch(console.error);
      }
    };
    const onProgress = () => {
      if (el && el.buffered.length > 0 && (duration > 0 || el.duration > 0)) {
        const totalDur = duration || el.duration;
        const bufferedEnd = el.buffered.end(el.buffered.length - 1);
        setBufferedPercent(Math.min(100, (bufferedEnd / totalDur) * 100));
      }
    };
    const onEnded = () => {
      if (!isLooping) {
        setIsPlaying(false);
      }
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("progress", onProgress);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("progress", onProgress);
      el.removeEventListener("ended", onEnded);
    };
  }, [currentFile, playbackRate, isLooping, volume, isMuted, isPlaying, duration, smoothPause]);

  // Keyboard Shortcuts ([ = Prev Sentence, ] = Next Sentence, R = Replay Sentence Only, Space = Play/Pause, + Pro controls)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in input, textarea, or select
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(targetTag) || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.code === "Space" || e.key === " " || e.key === "k" || e.key === "K") {
        e.preventDefault();
        singleSentencePlaybackEndRef.current = null;
        togglePlay();
        triggerHud(isPlaying ? "إيقاف مؤقت" : "تشغيل", "Space");
      } else if (e.key === "[" || e.code === "BracketLeft" || e.key === "ج") {
        e.preventDefault();
        jumpToPreviousSentence();
      } else if (e.key === "]" || e.code === "BracketRight" || e.key === "د") {
        e.preventDefault();
        jumpToNextSentence();
      } else if (e.key === "r" || e.key === "R" || e.code === "KeyR" || e.key === "ق") {
        e.preventDefault();
        replayCurrentSentenceOnly();
      } else if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        singleSentencePlaybackEndRef.current = null;
        skipSeconds(-10);
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        singleSentencePlaybackEndRef.current = null;
        skipSeconds(10);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        singleSentencePlaybackEndRef.current = null;
        skipSeconds(-5);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        singleSentencePlaybackEndRef.current = null;
        skipSeconds(5);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        handleVolumeChange(Math.min(1, volume + 0.05));
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        handleVolumeChange(Math.max(0, volume - 0.05));
      } else if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        singleSentencePlaybackEndRef.current = null;
        const num = parseInt(e.key, 10);
        const totalDur = duration || getMediaElement()?.duration || 0;
        if (totalDur > 0) {
          handleSeek((num / 10) * totalDur);
        }
      } else if (e.key === "c" || e.key === "C") {
        setShowSubtitlesOverlay(prev => !prev);
      } else if (e.key === "m" || e.key === "M") {
        toggleMute();
      } else if (e.key === "f" || e.key === "F") {
        handleToggleFullscreen();
      } else if (e.key === "Escape") {
        if (isImmersiveMode) {
          setIsImmersiveMode(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isPlaying,
    isMuted,
    volume,
    duration,
    currentFile,
    isImmersiveMode,
    jumpToPreviousSentence,
    jumpToNextSentence,
    replayCurrentSentenceOnly,
    togglePlay,
    triggerHud
  ]);

  // Copy full transcript text
  const handleCopyTranscript = () => {
    if (!activeCues || activeCues.length === 0) return;
    const text = exportCuesToPlainText(activeCues);
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  // Download Subtitle File (.srt or .vtt)
  const handleDownloadSubtitles = (format: "srt" | "vtt" | "txt") => {
    if (!activeCues || activeCues.length === 0 || !currentFile) return;

    let content = "";
    let mimeType = "text/plain";
    let ext = format;

    if (format === "srt") {
      content = exportCuesToSrt(activeCues);
      mimeType = "application/x-subrip";
    } else if (format === "vtt") {
      content = exportCuesToVtt(activeCues);
      mimeType = "text/vtt";
    } else {
      content = exportCuesToPlainText(activeCues);
    }

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentFile.title || "subtitles"}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------
  // Swipe & Multi-Tap Engine (Mobile, Desktop & Fullscreen)
  // Zones:
  // - Center 80% (0.10 <= x <= 0.90): Double Tap -> Play/Pause | Swipe UP -> Show Subtitle 1 / 2 | Swipe DOWN -> Hide Subtitle 2 / All
  // - Left 10% (x < 0.10): Double Tap -> Rewind -5s | Swipe UP (Left zone) -> Next sentence | Swipe DOWN (Left zone) -> Prev sentence
  // - Right 10% (x > 0.90): Double Tap -> Skip +5s | Swipe UP (Right zone) -> Volume UP | Swipe DOWN (Right zone) -> Volume DOWN
  // - Fullscreen Single Tap: Only show/hide controls & timeline bar
  // ---------------------------------------------------------

  // Center Swipe UP / DOWN (Subtitles)
  const handleCenterSwipeUp = useCallback(() => {
    if (!showSubtitlesOverlay) {
      setShowSubtitlesOverlay(true);
      setShowDualSubtitles(false);
      if (!activeTrackId && currentFile?.subtitles && currentFile.subtitles.length > 0) {
        setActiveTrackId(currentFile.subtitles[0].id);
      }
      try {
        localStorage.setItem("media_player_show_subtitles_overlay", JSON.stringify(true));
        localStorage.setItem("media_player_show_dual_subtitles", JSON.stringify(false));
      } catch (e) {
        console.error(e);
      }
      triggerVisualFeedback({
        type: "swipe_up_sub1",
        side: "center",
        label: "إظهار الترجمة الأولى",
        subLabel: "سحب للأعلى: تفعيل الترجمة الأولى"
      });
      triggerHud("إظهار الترجمة الأولى", "سحب ⬆️");
    } else if (!showDualSubtitles) {
      setShowDualSubtitles(true);
      if (!secondaryTrackId && currentFile?.subtitles && currentFile.subtitles.length > 1) {
        const other = currentFile.subtitles.find((t) => t.id !== activeTrackId);
        if (other) setSecondaryTrackId(other.id);
      }
      try {
        localStorage.setItem("media_player_show_dual_subtitles", JSON.stringify(true));
      } catch (e) {
        console.error(e);
      }
      triggerVisualFeedback({
        type: "swipe_up_sub2",
        side: "center",
        label: "إظهار الترجمة الثانية (المزدوجة)",
        subLabel: "سحب للأعلى: تفعيل الترجمة المزدوجة"
      });
      triggerHud("إظهار الترجمة الثانية (المزدوجة)", "سحب ⬆️");
    } else {
      triggerHud("كلا الترجمتين مفعّلتان بالفعل", "💬💬");
    }
  }, [showSubtitlesOverlay, showDualSubtitles, activeTrackId, secondaryTrackId, currentFile, triggerVisualFeedback, triggerHud]);

  const handleCenterSwipeDown = useCallback(() => {
    if (showSubtitlesOverlay && showDualSubtitles) {
      setShowDualSubtitles(false);
      try {
        localStorage.setItem("media_player_show_dual_subtitles", JSON.stringify(false));
      } catch (e) {
        console.error(e);
      }
      triggerVisualFeedback({
        type: "swipe_down_sub2",
        side: "center",
        label: "إخفاء الترجمة الثانية",
        subLabel: "سحب للأسفل: الإبقاء على الترجمة الأولى فقط"
      });
      triggerHud("إخفاء الترجمة الثانية", "سحب ⬇️");
    } else if (showSubtitlesOverlay && !showDualSubtitles) {
      setShowDualSubtitles(false);
      try {
        localStorage.setItem("media_player_show_subtitles_overlay", JSON.stringify(false));
      } catch (e) {
        console.error(e);
      }
      triggerVisualFeedback({
        type: "swipe_down_all",
        side: "center",
        label: "إخفاء الترجمة بالكامل",
        subLabel: "سحب للأسفل: إخفاء جميع الترجمات"
      });
      triggerHud("إخفاء الترجمة بالكامل", "سحب ⬇️");
    } else {
      triggerHud("الترجمة مخفية بالفعل", "🚫");
    }
  }, [showSubtitlesOverlay, showDualSubtitles, triggerVisualFeedback, triggerHud]);

  // Left Swipe UP / DOWN (Sentence navigation)
  const handleLeftSwipeUp = useCallback(() => {
    jumpToNextSentence(true);
    triggerVisualFeedback({
      type: "next_sentence",
      side: "left",
      label: "الجملة التالية",
      subLabel: "سحب للأعلى: تقديم جملة"
    });
  }, [jumpToNextSentence, triggerVisualFeedback]);

  const handleLeftSwipeDown = useCallback(() => {
    jumpToPreviousSentence(true);
    triggerVisualFeedback({
      type: "prev_sentence",
      side: "left",
      label: "الجملة السابقة",
      subLabel: "سحب للأسفل: تراجع جملة"
    });
  }, [jumpToPreviousSentence, triggerVisualFeedback]);

  // Right Swipe UP / DOWN (Volume Control)
  const handleRightSwipeUp = useCallback(() => {
    const nextVol = Math.min(2.0, Math.round((volume + 0.10) * 100) / 100);
    handleVolumeChange(nextVol);
    triggerVisualFeedback({
      type: "volume_up",
      side: "right",
      label: `مستوى الصوت: ${Math.round(nextVol * 100)}%`,
      subLabel: nextVol > 1.0 ? "⚡ تعزيز الصوت الفائق" : "سحب للأعلى: رفع الصوت"
    });
  }, [volume, handleVolumeChange, triggerVisualFeedback]);

  const handleRightSwipeDown = useCallback(() => {
    const nextVol = Math.max(0, Math.round((volume - 0.10) * 100) / 100);
    handleVolumeChange(nextVol);
    triggerVisualFeedback({
      type: "volume_down",
      side: "right",
      label: `مستوى الصوت: ${Math.round(nextVol * 100)}%`,
      subLabel: nextVol === 0 ? "كتم الصوت" : "سحب للأسفل: خفض الصوت"
    });
  }, [volume, handleVolumeChange, triggerVisualFeedback]);

  const handleStageTap = useCallback(
    (xRatio: number) => {
      // 80% Center Zone (0.10 to 0.90), 10% Left (< 0.10), 10% Right (> 0.90)
      const side: "left" | "right" | "center" =
        xRatio < 0.10 ? "left" : xRatio > 0.90 ? "right" : "center";
      const now = Date.now();
      const currentTracker = tapTrackerRef.current;

      // Check if double tap within 280ms on the same zone
      if (currentTracker && now - currentTracker.lastTime < 280 && currentTracker.side === side) {
        if (currentTracker.timer) {
          window.clearTimeout(currentTracker.timer);
        }
        tapTrackerRef.current = null;

        // DOUBLE TAP ACTION
        if (side === "center") {
          // Center 80% Double Tap: Play / Pause
          const el = getMediaElement();
          const willPlay = el ? el.paused : !isPlaying;
          togglePlay();
          triggerVisualFeedback({
            type: willPlay ? "play" : "pause",
            side: "center",
            label: willPlay ? "تشغيل" : "إيقاف مؤقت"
          });
        } else if (side === "right") {
          // Right 10% Double Tap: Skip Forward 5s (+5s)
          skipSeconds(5);
          triggerVisualFeedback({
            type: "seek_forward_5s",
            side: "right",
            label: "+5 ثواني",
            subLabel: "تقديم 5 ثواني"
          });
        } else if (side === "left") {
          // Left 10% Double Tap: Rewind 5s (-5s)
          skipSeconds(-5);
          triggerVisualFeedback({
            type: "seek_backward_5s",
            side: "left",
            label: "-5 ثواني",
            subLabel: "تراجع 5 ثواني"
          });
        }
        return;
      }

      // FIRST TAP
      if (currentTracker?.timer) {
        window.clearTimeout(currentTracker.timer);
      }

      const timer = window.setTimeout(() => {
        // SINGLE TAP ACTION
        tapTrackerRef.current = null;
        if (isFullscreen) {
          // In Fullscreen: Single tap ONLY toggles the scrubber timeline & controls bar!
          setShowFullscreenControls((prev) => !prev);
        } else {
          // In Windowed Mode: Single tap in center toggles play/pause
          if (side === "center") {
            const el = getMediaElement();
            const willPlay = el ? el.paused : !isPlaying;
            togglePlay();
            triggerVisualFeedback({
              type: willPlay ? "play" : "pause",
              side: "center",
              label: willPlay ? "تشغيل" : "إيقاف مؤقت"
            });
          }
        }
      }, 230);

      tapTrackerRef.current = {
        count: 1,
        side,
        timer,
        lastTime: now
      };
    },
    [
      isFullscreen,
      getMediaElement,
      isPlaying,
      togglePlay,
      skipSeconds,
      triggerVisualFeedback
    ]
  );

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore clicks on buttons, inputs, modals, menus
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("[data-ignore-stage-click]")
    ) {
      return;
    }

    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
      isPotentialSwipe: true
    };
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current) return;
    const start = pointerStartRef.current;
    pointerStartRef.current = null;

    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const endX = e.clientX;
    const endY = e.clientY;
    const deltaX = endX - start.x;
    const deltaY = start.y - endY; // Positive = Dragged UP, Negative = Dragged DOWN
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const duration = Date.now() - start.time;
    const startXRatio = (start.x - rect.left) / rect.width;

    // Vertical Swipe Detection: Drag >= 35px, mostly vertical, under 700ms
    if (absDeltaY >= 35 && absDeltaY > absDeltaX * 1.1 && duration < 700) {
      if (tapTrackerRef.current?.timer) {
        window.clearTimeout(tapTrackerRef.current.timer);
        tapTrackerRef.current = null;
      }

      if (startXRatio < 0.20) {
        // LEFT ZONE SWIPE (Sentence Navigation)
        if (deltaY > 0) {
          handleLeftSwipeUp(); // Next sentence
        } else {
          handleLeftSwipeDown(); // Prev sentence
        }
      } else if (startXRatio > 0.80) {
        // RIGHT ZONE SWIPE (Volume Control)
        if (deltaY > 0) {
          handleRightSwipeUp(); // Volume Up
        } else {
          handleRightSwipeDown(); // Volume Down
        }
      } else {
        // CENTER ZONE SWIPE (Subtitles)
        if (deltaY > 0) {
          handleCenterSwipeUp();
        } else {
          handleCenterSwipeDown();
        }
      }
      return;
    }

    // Tap Detection: Minimal movement (< 25px)
    if (absDeltaX < 25 && absDeltaY < 25) {
      const xRatio = (endX - rect.left) / rect.width;
      handleStageTap(xRatio);
    }
  };

  const handleStagePointerCancel = () => {
    pointerStartRef.current = null;
  };

  // Advanced Real-time Subtitle Style Computation Engine
  const getSubtitleTrackComputedStyle = useCallback((config: SubtitleTrackStyleConfig, isImmersive: boolean, text?: string): React.CSSProperties => {
    return computeSubtitleCSS(config, isImmersive, 1, text);
  }, []);

  const getSubtitlePositionStyle = useCallback((position: "bottom" | "top" | "center", offsetY: number): React.CSSProperties => {
    if (position === "top") {
      return { top: `${offsetY}px`, bottom: "auto", transform: "none" };
    }
    if (position === "center") {
      return { top: "50%", bottom: "auto", transform: "translateY(-50%)" };
    }
    // Flexible bottom positioning:
    // When in fullscreen and floating controls are revealed, raise the subtitle smoothly (+96px)
    // so it sits cleanly above the floating bar without being covered by it!
    const extraBottom = isFullscreen && showFullscreenControls ? 96 : 0;
    return {
      bottom: `${offsetY + extraBottom}px`,
      top: "auto",
      transform: "none",
      transition: "bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease"
    };
  }, [isFullscreen, showFullscreenControls]);

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 text-slate-800 font-sans"
      dir="rtl"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,video/*,.mp4,.webm,.mkv,.mov,.avi,.mp3,.wav,.m4a,.aac,.ogg,.flac"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUploadFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />

      <input
        ref={subtitleFileInputRef}
        type="file"
        accept=".srt,.vtt,.txt,.sbv,.sub"
        className="hidden"
        onChange={handleSubtitleFileSelect}
      />

      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {onBackToLibrary && (
            <button
              onClick={onBackToLibrary}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-[#0056f6] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="العودة للمكتبة"
            >
              <ArrowRight className="w-4 h-4" />
              <span className="hidden sm:inline">المكتبة</span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  مشغل الوسائط والترجمة الذكية 🎬
                </h1>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                  <Subtitles className="w-3 h-3" />
                  <span>دعم SRT / VTT</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                مشغل فيديو وصوت تفاعلي مع ترجمة متزامنة، تفريغ نصي مثل يوتيوب، وتحكم كامل
              </p>
            </div>
          </div>
        </div>

        {/* Upload Button & Stats */}
        <div className="flex items-center gap-2.5">
          <div className="hidden xl:flex items-center gap-3 px-3 py-1.5 bg-slate-100/80 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200/60">
            <div className="flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-blue-600" />
              <span>{totalVideos} فيديو</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-violet-600" />
              <span>{totalAudios} صوتيات</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              <span>{formatFileSize(totalSize)}</span>
            </div>
          </div>

          {currentFile && (
            <button
              onClick={() => setShowSubtitleUploadModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              title="إضافة أو رفع ترجمة للمقطع الحالي"
            >
              <Subtitles className="w-4 h-4" />
              <span>رفع ترجمة (SRT/VTT) 📜</span>
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-[#0056f6] hover:bg-[#0047d1] text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الرفع ({uploadProgress}%)...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>رفع وسائط 📤</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-5">
        {/* Notifications */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center justify-between text-xs font-semibold animate-fadeIn shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="p-1 hover:bg-rose-100 rounded-lg text-rose-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between text-xs font-semibold animate-fadeIn shadow-xs">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* ACTIVE MEDIA & SUBTITLES WORKSPACE (Like YouTube Player) */}
        {/* ======================================================== */}
        {currentFile && (
          <section
            ref={playerSectionRef}
            className={
              isFullscreen
                ? "fixed inset-0 z-50 bg-black flex flex-col h-screen w-screen p-0 m-0 overflow-hidden text-white select-none"
                : isImmersiveMode
                ? "fixed inset-0 z-50 bg-black flex flex-col h-screen w-screen p-2 sm:p-3 overflow-hidden text-white animate-fadeIn"
                : "bg-slate-900 rounded-xl p-2 sm:p-2.5 text-white shadow-2xl border border-slate-800 overflow-hidden"
            }
          >
            {/* Split Grid / Flex: Player View + Transcript Panel (Zero excessive gap) */}
            <div
              className={
                isFullscreen
                  ? "flex-1 w-full h-full relative overflow-hidden"
                  : isImmersiveMode
                  ? "flex-1 flex overflow-hidden gap-2 min-h-0 relative"
                  : "grid grid-cols-1 lg:grid-cols-12 gap-2"
              }
            >
              {/* Media Player Column */}
              <div
                className={
                  isFullscreen
                    ? "w-full h-full relative flex flex-col min-w-0 min-h-0"
                    : isImmersiveMode
                    ? "flex-1 flex flex-col min-w-0 min-h-0 gap-2 justify-between"
                    : `${showTranscriptPanel ? "lg:col-span-7 xl:col-span-8" : "lg:col-span-12"} flex flex-col gap-2`
                }
              >
                {/* VIDEO OR AUDIO STAGE */}
                <div
                  onPointerDown={handleStagePointerDown}
                  onPointerUp={handleStagePointerUp}
                  onPointerCancel={handleStagePointerCancel}
                  className={
                    isFullscreen
                      ? "flex-1 relative bg-black overflow-hidden flex items-center justify-center min-h-0 w-full h-full cursor-pointer select-none touch-none"
                      : isImmersiveMode
                      ? "flex-1 relative rounded-lg bg-black overflow-hidden flex items-center justify-center min-h-0 group border border-slate-800/80 shadow-2xl cursor-pointer select-none touch-none"
                      : "relative rounded-lg bg-black overflow-hidden flex items-center justify-center min-h-[260px] sm:min-h-[380px] group border border-slate-800 shadow-inner cursor-pointer select-none touch-none"
                  }
                >
                  {/* YouTube-Style Dynamic Gesture Visual Overlays */}
                  {/* 1. Center Tap: Play / Pause */}
                  {activeGesture && activeGesture.side === "center" && (activeGesture.type === "play" || activeGesture.type === "pause") && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-35 animate-yt-pop">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-black/75 backdrop-blur-md border border-white/20 flex flex-col items-center justify-center text-white shadow-2xl gap-1">
                        {activeGesture.type === "play" ? (
                          <Play className="w-10 h-10 sm:w-12 sm:h-12 fill-white text-white translate-x-1" />
                        ) : (
                          <Pause className="w-10 h-10 sm:w-12 sm:h-12 fill-white text-white" />
                        )}
                        <span className="text-[10px] sm:text-xs font-bold text-slate-200">
                          {activeGesture.label}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 2. Swipe Up / Swipe Down Overlays */}
                  {activeGesture && (activeGesture.type.startsWith("swipe_up") || activeGesture.type.startsWith("swipe_down")) && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-35 animate-yt-pop">
                      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/90 rounded-2xl px-6 py-4 flex flex-col items-center gap-2 shadow-2xl text-white">
                        <div className="w-12 h-12 rounded-full bg-blue-600/30 border border-blue-400/50 flex items-center justify-center">
                          {activeGesture.type.startsWith("swipe_up") ? (
                            <ArrowUp className="w-6 h-6 text-blue-300 animate-bounce" />
                          ) : (
                            <ArrowDown className="w-6 h-6 text-amber-300 animate-bounce" />
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-xs sm:text-sm font-bold text-slate-100">{activeGesture.label}</p>
                          {activeGesture.subLabel && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{activeGesture.subLabel}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Left Zone: Previous / Next Sentence (Swipe) or Double-Tap -5s */}
                  {activeGesture && activeGesture.side === "left" && (
                    <div className="absolute left-0 inset-y-0 w-1/3 flex items-center justify-start pl-6 sm:pl-10 pointer-events-none z-35 animate-yt-side">
                      <div className="bg-black/80 backdrop-blur-md border border-white/20 rounded-2xl px-4 sm:px-5 py-3.5 sm:py-4 flex flex-col items-center gap-1.5 shadow-2xl text-white">
                        {activeGesture.type === "seek_backward_5s" ? (
                          <>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center">
                              <RotateCcw className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                            </div>
                            <span className="text-xs sm:text-sm font-black font-mono text-white tracking-wide">-5 ثواني</span>
                            <span className="text-[10px] text-slate-300 font-bold bg-white/10 px-2 py-0.5 rounded-full">نقرتان</span>
                          </>
                        ) : activeGesture.type === "next_sentence" ? (
                          <>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-600/50 border border-blue-400/50 flex items-center justify-center">
                              <SkipForward className="w-6 h-6 sm:w-7 sm:h-7 text-blue-200" />
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-slate-100">الجملة التالية</span>
                            <span className="text-[10px] text-blue-300 font-bold bg-blue-500/20 px-2 py-0.5 rounded-full">سحب ⬆️</span>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-600/50 border border-blue-400/50 flex items-center justify-center">
                              <SkipBack className="w-6 h-6 sm:w-7 sm:h-7 text-blue-200" />
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-slate-100">الجملة السابقة</span>
                            <span className="text-[10px] text-blue-300 font-bold bg-blue-500/20 px-2 py-0.5 rounded-full">سحب ⬇️</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 4. Right Zone: Volume Up/Down (Swipe) or Double-Tap +5s */}
                  {activeGesture && activeGesture.side === "right" && (
                    <div className="absolute right-0 inset-y-0 w-1/3 flex items-center justify-end pr-6 sm:pr-10 pointer-events-none z-35 animate-yt-side">
                      <div className="bg-black/80 backdrop-blur-md border border-white/20 rounded-2xl px-4 sm:px-5 py-3.5 sm:py-4 flex flex-col items-center gap-1.5 shadow-2xl text-white">
                        {activeGesture.type === "seek_forward_5s" ? (
                          <>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center">
                              <RotateCw className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                            </div>
                            <span className="text-xs sm:text-sm font-black font-mono text-white tracking-wide">+5 ثواني</span>
                            <span className="text-[10px] text-slate-300 font-bold bg-white/10 px-2 py-0.5 rounded-full">نقرتان</span>
                          </>
                        ) : activeGesture.type === "volume_up" ? (
                          <>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-600/50 border border-emerald-400/50 flex items-center justify-center">
                              <Volume2 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-200" />
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-slate-100">{activeGesture.label}</span>
                            <span className="text-[10px] text-emerald-300 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full">سحب ⬆️</span>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-600/50 border border-amber-400/50 flex items-center justify-center">
                              {volume <= 0.05 || isMuted ? (
                                <VolumeX className="w-6 h-6 sm:w-7 sm:h-7 text-amber-200" />
                              ) : (
                                <Volume2 className="w-6 h-6 sm:w-7 sm:h-7 text-amber-200" />
                              )}
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-slate-100">{activeGesture.label}</span>
                            <span className="text-[10px] text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full">سحب ⬇️</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Floating HUD Indicator for Shortcuts */}
                  {hudToast && (
                    <div className="absolute top-5 inset-x-0 flex justify-center pointer-events-none z-30 animate-fadeIn">
                      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/90 text-white px-3.5 py-1.5 rounded-lg shadow-2xl flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100">{hudToast.text}</span>
                        {hudToast.sub && (
                          <kbd className="px-2 py-0.5 bg-blue-600/40 text-blue-300 border border-blue-500/50 rounded-md text-xs font-mono font-black">
                            {hudToast.sub}
                          </kbd>
                        )}
                      </div>
                    </div>
                  )}

                  {currentFile.type === "video" ? (
                    <>
                      <video
                        ref={videoRef}
                        src={`/api/media/stream/${currentFile.filename}`}
                        className={
                          isFullscreen
                            ? "w-full h-full object-contain pointer-events-none"
                            : isImmersiveMode
                            ? "w-full h-full object-contain cursor-pointer"
                            : "w-full max-h-[500px] object-contain cursor-pointer"
                        }
                        preload="auto"
                        playsInline
                      />

                      {/* Video Subtitles Overlay (Supports Dual Subtitles: German + Arabic with Live Custom Styling & Live Preview) */}
                      {showSubtitlesOverlay && (currentCue || (showDualSubtitles && currentSecondaryCue) || (showTranscriptPanel && sidePanelView === "style") || showSubtitleStyleModal) && (
                        <div
                          className="absolute inset-x-0 flex flex-col items-center justify-center gap-2 px-4 pointer-events-none z-20 transition-all duration-300 ease-out"
                          style={getSubtitlePositionStyle(primarySubStyle.position, primarySubStyle.offsetY)}
                        >
                          {/* Primary Subtitle (e.g., German / Original) */}
                          {(currentCue || (((showTranscriptPanel && sidePanelView === "style") || showSubtitleStyleModal) && !currentCue)) && (() => {
                            const text = currentCue ? currentCue.text : "Guten Morgen! Willkommen zu unserem Deutschkurs.";
                            const dir = primarySubStyle.direction === "rtl" ? "rtl" : primarySubStyle.direction === "ltr" ? "ltr" : detectTextDirection(text);
                            return (
                              <div
                                dir={dir}
                                style={getSubtitleTrackComputedStyle(primarySubStyle, isImmersiveMode, text)}
                              >
                                <span>{text}</span>
                              </div>
                            );
                          })()}

                          {/* Secondary Subtitle (e.g., Arabic / Translated with Gemini) */}
                          {showDualSubtitles && (currentSecondaryCue || (((showTranscriptPanel && sidePanelView === "style") || showSubtitleStyleModal) && !currentSecondaryCue)) && (() => {
                            const text = currentSecondaryCue ? currentSecondaryCue.text : "صباح الخير! أهلاً بكم في دورة اللغة الألمانية الخاصة بنا.";
                            const dir = secondarySubStyle.direction === "rtl" ? "rtl" : secondarySubStyle.direction === "ltr" ? "ltr" : detectTextDirection(text);
                            return (
                              <div
                                dir={dir}
                                style={getSubtitleTrackComputedStyle(secondarySubStyle, isImmersiveMode, text)}
                              >
                                <span>{text}</span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Audio Aesthetic Stage */
                    <div
                      className={`w-full ${
                        isImmersiveMode ? "h-full justify-center" : "py-10"
                      } px-6 flex flex-col items-center justify-center gap-5 relative bg-linear-to-b from-slate-900 via-slate-900/90 to-slate-950`}
                    >
                      <audio
                        ref={audioRef}
                        src={`/api/media/stream/${currentFile.filename}`}
                        preload="auto"
                      />

                      {/* Rotating Vinyl Record Graphic */}
                      <div
                        className={`${
                          isImmersiveMode ? "w-36 h-36" : "w-32 h-32"
                        } rounded-full border-4 border-slate-700/80 bg-linear-to-tr from-purple-600 via-indigo-600 to-blue-600 flex items-center justify-center shadow-xl shadow-purple-500/20 transition-transform ${
                          isPlaying ? "animate-spin" : ""
                        }`}
                        style={{ animationDuration: "8s" }}
                      >
                        <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center text-purple-300">
                          <Music className="w-6 h-6" />
                        </div>
                      </div>

                      <div className="text-center">
                        <p className="font-bold text-slate-100 text-base">{currentFile.title}</p>
                        <p className="text-xs text-slate-400 mt-1">{currentFile.originalName}</p>
                      </div>

                      {/* Audio Karaoke Subtitle Box (Supports Dual Subtitles with Live Custom Styling) */}
                      {showSubtitlesOverlay && (
                        <div className="w-full max-w-lg mt-2 min-h-[64px] flex flex-col items-center justify-center gap-2">
                          {currentCue || (showDualSubtitles && currentSecondaryCue) ? (
                            <>
                              {currentCue && (() => {
                                const dir = primarySubStyle.direction === "rtl" ? "rtl" : primarySubStyle.direction === "ltr" ? "ltr" : detectTextDirection(currentCue.text);
                                return (
                                  <div
                                    dir={dir}
                                    style={getSubtitleTrackComputedStyle(primarySubStyle, isImmersiveMode, currentCue.text)}
                                  >
                                    <span>{currentCue.text}</span>
                                  </div>
                                );
                              })()}
                              {showDualSubtitles && currentSecondaryCue && (() => {
                                const dir = secondarySubStyle.direction === "rtl" ? "rtl" : secondarySubStyle.direction === "ltr" ? "ltr" : detectTextDirection(currentSecondaryCue.text);
                                return (
                                  <div
                                    dir={dir}
                                    style={getSubtitleTrackComputedStyle(secondarySubStyle, isImmersiveMode, currentSecondaryCue.text)}
                                  >
                                    <span>{currentSecondaryCue.text}</span>
                                  </div>
                                );
                              })()}
                            </>
                          ) : (
                            <div className="text-xs text-slate-500 italic bg-slate-800/40 px-4 py-2 rounded-xl border border-slate-800">
                              {activeTrack ? "جاري انتظار مقطع الترجمة التالي..." : "لا توجد ترجمة نشطة (اضغط على إضافة ترجمة بالأعلى)"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Player Timeline & Controls Bar (Unified in LTR layout for consistent button/scrubber directions) */}
                <div
                  dir="ltr"
                  onClick={(e) => e.stopPropagation()}
                  className={
                    isFullscreen
                      ? `absolute bottom-3 inset-x-3 sm:bottom-6 sm:inset-x-8 md:inset-x-16 lg:inset-x-24 z-40 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl p-2.5 sm:p-3 space-y-2 transition-all duration-300 ease-out ${
                          showFullscreenControls
                            ? "opacity-100 translate-y-0 pointer-events-auto"
                            : "opacity-0 translate-y-8 pointer-events-none"
                        }`
                      : `bg-slate-850 bg-slate-900/95 border border-slate-700/80 rounded-lg shadow-lg ${
                          isImmersiveMode ? "p-2.5 space-y-2" : "p-2.5 sm:p-3 space-y-2"
                        }`
                  }
                >
                  {/* High-Precision YouTube-Grade Timeline with Live Hover Frame Bubble */}
                  <div className="space-y-1.5 select-none relative">
                    <div
                      ref={progressBarRef}
                      onPointerDown={handlePointerDownTimeline}
                      onPointerMove={handleTimelinePointerMove}
                      onPointerLeave={handleTimelinePointerLeave}
                      className="w-full h-5 cursor-pointer relative group flex items-center touch-none select-none"
                    >
                      {/* Fixed-height stable track (Zero layout shift on hover) */}
                      <div className="w-full h-2 bg-slate-700/70 rounded-full relative overflow-hidden">
                        {/* 1. Buffered Stream Track */}
                        <div
                          className="h-full bg-slate-500/40 rounded-full absolute left-0 top-0 pointer-events-none transition-all duration-300"
                          style={{ width: `${bufferedPercent}%` }}
                        />

                        {/* 2. Hover Ghost Preview Track */}
                        {hoverPosition !== null && (
                          <div
                            className="h-full bg-white/20 rounded-full absolute left-0 top-0 pointer-events-none"
                            style={{ width: `${hoverPosition}%` }}
                          />
                        )}

                        {/* 3. Subtitle Cue Tick Markers on Timeline */}
                        {duration > 0 &&
                          activeCues.map((cue) => {
                            const cuePercent = (cue.startTime / duration) * 100;
                            return (
                              <div
                                key={cue.id}
                                style={{ left: `${cuePercent}%` }}
                                className="w-[2px] h-full bg-amber-400/80 absolute top-0 pointer-events-none z-10"
                                title={cue.text}
                              />
                            );
                          })}

                        {/* 4. Active Played Progress Track */}
                        <div
                          className="h-full bg-linear-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full absolute left-0 top-0 shadow-xs pointer-events-none"
                          style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                        />
                      </div>

                      {/* 5. Scrubber Handle / Thumb (Scales on hover or active scrubbing without shifting layout) */}
                      <div
                        className={`w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-600 shadow-md shadow-black/60 absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-transform duration-100 ${
                          isScrubbing
                            ? "scale-125 ring-4 ring-indigo-500/30"
                            : "scale-0 group-hover:scale-100"
                        }`}
                        style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      />

                      {/* 6. Live YouTube-Grade Hover Frame Bubble Preview */}
                      {hoverPosition !== null && hoverTime !== null && (
                        <div
                          style={{ left: `${Math.max(10, Math.min(90, hoverPosition))}%` }}
                          className="absolute bottom-full mb-3.5 -translate-x-1/2 flex flex-col items-center pointer-events-none z-40 animate-fadeIn"
                        >
                          <div className="bg-slate-950/95 border border-slate-600/90 rounded-lg p-1.5 shadow-2xl flex flex-col items-center gap-1.5 backdrop-blur-md">
                            {/* Video Live Frame Thumbnail */}
                            {currentFile.type === "video" && (
                              <div className="w-40 sm:w-44 h-24 sm:h-26 bg-black rounded-md overflow-hidden relative border border-slate-800">
                                <video
                                  ref={previewVideoRef}
                                  src={`/api/media/stream/${currentFile.filename}`}
                                  className="w-full h-full object-cover"
                                  muted
                                  preload="metadata"
                                  playsInline
                                />
                                <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white">
                                  {formatSecondsToTime(hoverTime)}
                                </div>
                              </div>
                            )}

                            {/* Timestamp for Audio or Video */}
                            {currentFile.type === "audio" && (
                              <div className="px-2 py-0.5 bg-indigo-950/80 border border-indigo-500/40 rounded-md">
                                <span className="font-mono text-xs font-bold text-indigo-300">
                                  {formatSecondsToTime(hoverTime)}
                                </span>
                              </div>
                            )}

                            {/* Subtitle cue text preview at hover timestamp */}
                            {hoverCueText && (
                              <div className="max-w-[200px] text-center px-2 py-1 bg-slate-900/90 rounded-md border border-slate-700/60">
                                <p className="text-[11px] text-slate-200 font-sans font-medium line-clamp-2 leading-tight">
                                  {hoverCueText}
                                </p>
                              </div>
                            )}
                          </div>
                          {/* Triangle Arrow */}
                          <div className="w-2.5 h-2.5 bg-slate-950 rotate-45 border-r border-b border-slate-600/90 -mt-1.5" />
                        </div>
                      )}
                    </div>

                    {/* Timeline Info Bar (Time elapsed / Duration) */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">{formatSecondsToTime(currentTime)}</span>
                        <span className="text-slate-500">/</span>
                        <span>{formatSecondsToTime(duration)}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        {playbackRate !== 1 && <span className="text-blue-400 font-bold mr-2">{playbackRate}x</span>}
                        {isLooping && <span className="text-emerald-400 font-bold">تكرار نشط</span>}
                      </div>
                    </div>
                  </div>

                  {/* Primary Controls Row: Unified LTR Flow */}
                  {/* Control Bar: Compact, Space-Efficient Icon-Driven Toolbar with consistent eye-friendly heights and colors */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pt-0.5">
                    {/* Left Controls: Play, Skips, Navigation & Volume */}
                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                      {/* Play/Pause Main Button */}
                      <button
                        onClick={togglePlay}
                        className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
                        title={isPlaying ? "إيقاف مؤقت (Space)" : "تشغيل (Space)"}
                      >
                        {isPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current translate-x-[1px]" />
                        )}
                      </button>

                      {/* -5s Skip */}
                      <button
                        onClick={() => skipSeconds(-5)}
                        className="h-8 px-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer border border-slate-700/60 flex items-center gap-1 shrink-0 text-xs"
                        title="تراجع 5 ثواني (J / ArrowLeft)"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-400" />
                        <span className="text-[10.5px] font-mono font-semibold">5s</span>
                      </button>

                      {/* +5s Skip */}
                      <button
                        onClick={() => skipSeconds(5)}
                        className="h-8 px-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer border border-slate-700/60 flex items-center gap-1 shrink-0 text-xs"
                        title="تقديم 5 ثواني (L / ArrowRight)"
                      >
                        <RotateCw className="w-3 h-3 text-slate-400" />
                        <span className="text-[10.5px] font-mono font-semibold">5s</span>
                      </button>

                      {/* Track Navigation Group (Prev & Next Track) */}
                      <div className="flex items-center gap-0.5 bg-slate-800/80 border border-slate-700/60 rounded-lg p-0.5 shadow-xs h-8">
                        {/* Prev Track */}
                        <button
                          onClick={handlePrevTrack}
                          disabled={filteredFiles.length <= 1}
                          className="h-7 w-7 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-md transition-colors disabled:opacity-30 cursor-pointer flex items-center justify-center shrink-0"
                          title="المقطع السابق"
                        >
                          <SkipBack className="w-3 h-3" />
                        </button>

                        {/* Next Track */}
                        <button
                          onClick={handleNextTrack}
                          disabled={filteredFiles.length <= 1}
                          className="h-7 w-7 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-md transition-colors disabled:opacity-30 cursor-pointer flex items-center justify-center shrink-0"
                          title="المقطع التالي"
                        >
                          <SkipForward className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Pro Subtitle Navigation Shortcuts Group (Clean Unified Icons) */}
                      {activeCues.length > 0 && (
                        <div className="flex items-center bg-slate-800/80 border border-slate-700/60 rounded-lg p-0.5 shadow-xs h-8">
                          {/* Previous Sentence [ */}
                          <button
                            onClick={() => jumpToPreviousSentence(true)}
                            className="h-7 px-1.5 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-md transition-all cursor-pointer flex items-center gap-1"
                            title="القفز للجملة السابقة (اختصار: [)"
                          >
                            <SkipBack className="w-3 h-3 text-indigo-400" />
                          </button>

                          {/* Replay Current Sentence Only R */}
                          <button
                            onClick={replayCurrentSentenceOnly}
                            className="h-7 px-1.5 hover:bg-blue-600/30 text-blue-300 hover:text-white rounded-md transition-all cursor-pointer flex items-center gap-1"
                            title="إعادة نطق الجملة الحالية فقط (اختصار: R)"
                          >
                            <RefreshCw className="w-3 h-3 text-blue-400" />
                          </button>

                          {/* Next Sentence ] */}
                          <button
                            onClick={() => jumpToNextSentence(true)}
                            className="h-7 px-1.5 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-md transition-all cursor-pointer flex items-center gap-1"
                            title="القفز للجملة التالية (اختصار: ])"
                          >
                            <SkipForward className="w-3 h-3 text-indigo-400" />
                          </button>
                        </div>
                      )}

                      {/* Volume & Mute with 200% Super Boost */}
                      <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 h-8 rounded-lg border border-slate-700/60">
                        <button
                          onClick={toggleMute}
                          className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="كتم الصوت (M)"
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                          ) : volume > 1 ? (
                            <Volume2 className="w-3.5 h-3.5 text-blue-400 font-bold" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5 text-slate-300" />
                          )}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.05"
                          value={isMuted ? 0 : volume}
                          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                          className="w-12 sm:w-16 h-1 bg-slate-600 rounded-md appearance-none cursor-pointer accent-blue-500"
                          title={`مستوى الصوت: ${Math.round(volume * 100)}%`}
                        />
                        {volume > 1 && !isMuted && (
                          <span className="text-[9.5px] font-mono font-bold text-blue-400 hidden sm:inline">
                            {Math.round(volume * 100)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Controls: Grouped cleanly into 3 organized clusters (Subtitles Tools, Playback Settings, Viewport Modes) */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Cluster 1: Subtitle & Transcript Tools */}
                      <div className="flex items-center bg-slate-800/80 border border-slate-700/60 rounded-lg p-0.5 shadow-xs h-8">
                        {/* CC Toggle */}
                        <button
                          onClick={handleToggleSubtitlesOverlay}
                          className={`h-7 px-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                            showSubtitlesOverlay
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-slate-400 hover:text-white hover:bg-slate-700/60"
                          }`}
                          title={showSubtitlesOverlay ? "إخفاء شريط الترجمة (C)" : "إظهار شريط الترجمة (C)"}
                        >
                          <Subtitles className="w-3.5 h-3.5" />
                        </button>

                        {/* Subtitle Style Customization Studio Trigger */}
                        <button
                          onClick={() => {
                            if (showTranscriptPanel && sidePanelView === "style") {
                              setSidePanelView("transcript");
                            } else {
                              setShowTranscriptPanel(true);
                              setSidePanelView("style");
                            }
                          }}
                          className={`h-7 px-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                            showTranscriptPanel && sidePanelView === "style"
                              ? "bg-amber-500 text-slate-950 shadow-xs"
                              : "text-slate-400 hover:text-amber-300 hover:bg-slate-700/60"
                          }`}
                          title="تخصيص ستايل ولون وخلفية الترجمة في اللوحة الجانبية"
                        >
                          <Palette className="w-3.5 h-3.5" />
                        </button>

                        {/* Subtitle Options & Management Hub */}
                        <button
                          onClick={() => setShowSubtitleOptionsModal(!showSubtitleOptionsModal)}
                          className={`h-7 px-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center relative ${
                            showSubtitleOptionsModal
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-slate-400 hover:text-indigo-300 hover:bg-slate-700/60"
                          }`}
                          title="خيارات ومسارات الترجمة (المسار الأول، الترجمة المزدوجة، الذكاء الاصطناعي والتفريغ)"
                        >
                          <Languages className="w-3.5 h-3.5" />
                          {/* Status indicator dot if multiple tracks exist or dual is on */}
                          {((currentFile.subtitles?.length ?? 0) > 1 || showDualSubtitles) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-1 right-1" />
                          )}
                        </button>

                        {/* Toggle Sentences / Transcript Side Panel */}
                        <button
                          onClick={() => setShowTranscriptPanel(!showTranscriptPanel)}
                          className={`h-7 px-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                            showTranscriptPanel
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-400 hover:text-white hover:bg-slate-700/60"
                          }`}
                          title={showTranscriptPanel ? "إخفاء لوحة الجمل والتفريغ" : "إظهار لوحة الجمل والتفريغ"}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Cluster 2: Playback Settings (Speed + Loop) */}
                      <div className="flex items-center bg-slate-800/80 border border-slate-700/60 rounded-lg p-0.5 shadow-xs h-8">
                        {/* Playback Speed Menu Trigger & Rectangular Popup Above Button */}
                        <div className="relative" ref={speedMenuRef}>
                          <button
                            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                            className={`h-7 px-2 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              showSpeedMenu || playbackRate !== 1
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                                : "text-slate-400 hover:text-white hover:bg-slate-700/60"
                            }`}
                            title="تغيير سرعة التشغيل"
                          >
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>{playbackRate}x</span>
                          </button>

                          {/* Rectangular Speed Popup Above Button */}
                          {showSpeedMenu && (
                            <div className="absolute bottom-full mb-2 right-0 sm:left-1/2 sm:-translate-x-1/2 bg-slate-900/98 backdrop-blur-md border border-slate-700/90 rounded-lg p-2.5 shadow-2xl z-50 min-w-[170px] animate-scaleUp">
                              <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800 text-[11px] font-bold text-slate-300">
                                <span className="flex items-center gap-1.5">
                                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                                  سرعة التشغيل
                                </span>
                                <span className="text-[10px] text-amber-400 font-mono bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold">
                                  {playbackRate}x
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
                                {PLAYBACK_SPEEDS.map((rate) => (
                                  <button
                                    key={rate}
                                    onClick={() => {
                                      handleSpeedChange(rate);
                                      setShowSpeedMenu(false);
                                      triggerHud("سرعة التشغيل", `${rate}x`);
                                    }}
                                    className={`px-2 py-1.5 rounded-md text-center transition-all flex items-center justify-between cursor-pointer ${
                                      playbackRate === rate
                                        ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                                        : "bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/50"
                                    }`}
                                  >
                                    <span>{rate === 1 ? "1.0x عادي" : `${rate}x`}</span>
                                    {playbackRate === rate && <Check className="w-3 h-3 ml-1" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Loop button */}
                        <button
                          onClick={() => setIsLooping(!isLooping)}
                          className={`h-7 px-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                            isLooping
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-400 hover:text-white hover:bg-slate-700/60"
                          }`}
                          title={isLooping ? "إلغاء التكرار" : "تكرار المقطع"}
                        >
                          <Repeat className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Cluster 3: Screen & Display Modes */}
                      <div className="flex items-center bg-slate-800/80 border border-slate-700/60 rounded-lg p-0.5 shadow-xs h-8">
                        {/* Immersive Theater Mode Toggle Button (Exit / Enter) */}
                        <button
                          onClick={() => setIsImmersiveMode(!isImmersiveMode)}
                          className={`h-7 px-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                            isImmersiveMode
                              ? "bg-purple-600 text-white shadow-xs hover:bg-purple-500"
                              : "text-slate-400 hover:text-purple-300 hover:bg-slate-700/60"
                          }`}
                          title={isImmersiveMode ? "الخروج من وضع التكبير السينمائي (Esc)" : "وضع التكبير السينمائي الشامل"}
                        >
                          {isImmersiveMode ? (
                            <Shrink className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Expand className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Fullscreen button */}
                        {currentFile.type === "video" && (
                          <button
                            onClick={handleToggleFullscreen}
                            className={`h-7 px-2 rounded-md transition-colors cursor-pointer flex items-center justify-center ${
                              isFullscreen
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "text-slate-400 hover:text-white hover:bg-slate-700/60"
                            }`}
                            title={isFullscreen ? "الخروج من ملء الشاشة (F / Esc)" : "ملء الشاشة بالكامل (F)"}
                          >
                            {isFullscreen ? (
                              <Minimize2 className="w-3.5 h-3.5 text-white" />
                            ) : (
                              <Maximize2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* SIDE PANEL: TRANSCRIPT (SENTENCES) & SUBTITLE STYLE STUDIO */}
              {/* Only shown when not in fullscreen mode as requested */}
              {/* ======================================================== */}
              {!isFullscreen && showTranscriptPanel && (
                <div
                  className={
                    isImmersiveMode
                      ? "w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-lg flex flex-col h-full z-20 shrink-0 shadow-2xl overflow-hidden animate-slideLeft"
                      : "lg:col-span-5 xl:col-span-4 bg-slate-800/90 border border-slate-700/90 rounded-lg flex flex-col h-[480px] lg:h-full lg:min-h-[460px] overflow-hidden shadow-lg animate-fadeIn"
                  }
                >
                  {/* Panel Header */}
                  <div className="px-3 py-2 border-b border-slate-700/80 bg-slate-800 flex items-center justify-between gap-2 shrink-0">
                    {/* Media Icon + Name */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {sidePanelView === "style" ? (
                        <>
                          <Palette className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-100 truncate">
                            تخصيص الستايل
                          </span>
                        </>
                      ) : (
                        <>
                          {currentFile.type === "video" ? (
                            <Film className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          ) : (
                            <Music className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          )}
                          <span
                            className="text-xs font-bold text-slate-200 truncate max-w-[130px] sm:max-w-[180px]"
                            title={currentFile.title || currentFile.originalName}
                          >
                            {currentFile.title || currentFile.originalName}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Actions: تمرير -> إخفاء/إظهار الدقائق -> نسخ -> تنزيل -> إغلاق */}
                    <div className="flex items-center gap-2 shrink-0">
                      {sidePanelView === "transcript" ? (
                        <>
                          {/* Simple Auto-scroll text button without badge/padding */}
                          <button
                            onClick={() => setAutoScrollTranscript(!autoScrollTranscript)}
                            className={`text-xs font-medium transition-colors cursor-pointer ${
                              autoScrollTranscript
                                ? "text-blue-400 font-bold"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                            title={autoScrollTranscript ? "إيقاف التمرير التلقائي" : "تفعيل التمرير التلقائي"}
                          >
                            تمرير
                          </button>

                          {/* Toggle Cue Timestamps (Minutes/Seconds) - Default: OFF / Hidden to maximize sentence room */}
                          <button
                            onClick={() => {
                              const nextState = !showCueTimestamps;
                              setShowCueTimestamps(nextState);
                              try {
                                localStorage.setItem("media_player_show_cue_timestamps", JSON.stringify(nextState));
                              } catch (e) {
                                console.error(e);
                              }
                              triggerHud(nextState ? "إظهار أرقام الدقائق" : "إخفاء أرقام الدقائق", "⏰");
                            }}
                            className={`p-1 hover:bg-slate-700 rounded-md transition-colors cursor-pointer ${
                              showCueTimestamps
                                ? "text-amber-400 bg-amber-950/40"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                            title={showCueTimestamps ? "إخفاء أرقام الدقائق والتوقيت (توفير مساحة أكبر للنص)" : "إظهار أرقام الدقائق والتوقيت"}
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>

                          {/* Copy full text */}
                          <button
                            onClick={handleCopyTranscript}
                            disabled={activeCues.length === 0}
                            className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer disabled:opacity-30"
                            title="نسخ النص كاملاً"
                          >
                            {copiedTranscript ? (
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Export Subtitle Dropdown */}
                          <div className="relative group">
                            <button
                              disabled={activeCues.length === 0}
                              className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer disabled:opacity-30"
                              title="تصدير وتحميل ملف الترجمة"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <div className="absolute left-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-lg p-1.5 shadow-xl hidden group-hover:flex flex-col gap-1 z-30 min-w-[110px]">
                              <button
                                onClick={() => handleDownloadSubtitles("srt")}
                                className="px-2 py-1 text-right text-[11px] font-bold text-slate-300 hover:bg-slate-800 rounded-md"
                              >
                                تحميل (.SRT)
                              </button>
                              <button
                                onClick={() => handleDownloadSubtitles("vtt")}
                                className="px-2 py-1 text-right text-[11px] font-bold text-slate-300 hover:bg-slate-800 rounded-md"
                              >
                                تحميل (.VTT)
                              </button>
                              <button
                                onClick={() => handleDownloadSubtitles("txt")}
                                className="px-2 py-1 text-right text-[11px] font-bold text-slate-300 hover:bg-slate-800 rounded-md"
                              >
                                تحميل نصي (.TXT)
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => setSidePanelView("transcript")}
                          className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="العودة لقائمة الجمل والتفريغ"
                        >
                          <span>العودة للجمل</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {/* Close panel button */}
                      <button
                        onClick={() => setShowTranscriptPanel(false)}
                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md cursor-pointer transition-colors"
                        title="إغلاق لوحة الجمل"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Panel Body: Either Subtitle Style Studio OR Sentences / Transcript List */}
                  {sidePanelView === "style" ? (
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-slate-900">
                      <SubtitleStylePanel
                        primaryStyle={primarySubStyle}
                        secondaryStyle={secondarySubStyle}
                        onUpdatePrimaryStyle={updatePrimarySubStyle}
                        onUpdateSecondaryStyle={updateSecondarySubStyle}
                        onUpdateBothStyles={updateBothSubStyles}
                        onClose={() => setSidePanelView("transcript")}
                        onSaveAndReturn={() => setSidePanelView("transcript")}
                        isEmbedded={true}
                        activeTrackLabel={activeTrack?.label}
                        secondaryTrackLabel={secondaryTrack?.label}
                        samplePrimaryText={currentCue?.text}
                        sampleSecondaryText={currentSecondaryCue?.text}
                      />
                    </div>
                  ) : (
                    <>
                      {/* Search inside Subtitles */}
                      <div className="p-2.5 border-b border-slate-700/60 bg-slate-850">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="ابحث في نص الترجمة..."
                            value={subtitleSearchQuery}
                            onChange={(e) => setSubtitleSearchQuery(e.target.value)}
                            className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                          />
                          {subtitleSearchQuery && (
                            <button
                              onClick={() => setSubtitleSearchQuery("")}
                              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Cues List */}
                      <div
                        ref={transcriptContainerRef}
                        className="flex-1 overflow-y-auto p-2 space-y-1.5"
                      >
                        {activeCues.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-3">
                            <Subtitles className="w-10 h-10 text-slate-600" />
                            <div>
                              <p className="text-xs font-bold text-slate-300">لا يوجد ملف ترجمة لهذا المقطع بعد</p>
                              <p className="text-[11px] text-slate-500 mt-1">
                                يمكنك استخدام سيرفر التفريغ الألماني المحلي (Gradio) أو رفع ملف ترجمة جاهز
                              </p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-2">
                              <button
                                onClick={() => setShowGradioModal(true)}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white rounded-lg text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                <Mic className="w-3.5 h-3.5" />
                                <span>تفريغ Gradio 🇩🇪</span>
                              </button>
                              <button
                                onClick={() => setShowSubtitleUploadModal(true)}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                + إضافة ترجمة يدوية
                              </button>
                            </div>
                          </div>
                        ) : (
                          filteredCues.map((cue) => {
                            const isCurrent = currentCue?.id === cue.id;
                            // Find matching secondary cue (Gemini Arabic translation)
                            const matchingSec = secondaryCues.find(
                              (sc) =>
                                (sc.startTime >= cue.startTime - 0.5 && sc.startTime <= cue.endTime + 0.5) ||
                                (sc.endTime >= cue.startTime - 0.5 && sc.endTime <= cue.endTime + 0.5) ||
                                (cue.startTime >= sc.startTime - 0.5 && cue.startTime <= sc.endTime + 0.5)
                            );

                            return (
                              <div
                                key={cue.id}
                                ref={isCurrent ? activeCueRef : null}
                                onClick={() => handleSeek(cue.startTime)}
                                className={`p-2.5 rounded-lg border transition-colors duration-150 flex items-start gap-2.5 cursor-pointer group ${
                                  isCurrent
                                    ? "bg-blue-600/25 border-blue-500/80 text-white shadow-xs"
                                    : "border-transparent hover:bg-slate-800/80 text-slate-300 hover:text-white"
                                }`}
                              >
                                {/* Timestamp Badge (Click to jump) - Controlled by showCueTimestamps toggle */}
                                {showCueTimestamps && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSeek(cue.startTime);
                                    }}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold shrink-0 transition-colors cursor-pointer border ${
                                      isCurrent
                                        ? "bg-blue-600 border-blue-500 text-white shadow-xs"
                                        : "bg-slate-950 text-blue-400 group-hover:bg-blue-950 border-slate-800"
                                    }`}
                                    title="اضغط للانتقال لهذا التوقيت"
                                  >
                                    {formatSecondsToClock(cue.startTime)}
                                  </button>
                                )}

                                {/* Text Content (Stable font-medium to prevent layout text-wrapping shifts) */}
                                <div className="flex-1 min-w-0 space-y-1">
                                  <p className={`text-xs leading-relaxed font-sans font-medium ${isCurrent ? "text-white font-semibold" : "text-slate-200"}`}>
                                    {cue.text}
                                  </p>
                                  {showDualSubtitles && matchingSec && (
                                    <p className="text-[11px] text-emerald-300 font-medium border-t border-slate-700/60 pt-1">
                                      {matchingSec.text}
                                    </p>
                                  )}
                                </div>

                                {/* Cue Edit/Delete Tools on Hover */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      singleSentencePlaybackEndRef.current = cue.endTime;
                                      handleSeek(cue.startTime);
                                      smoothPlay();
                                      triggerHud("إعادة الجملة", "R");
                                    }}
                                    className="p-1 bg-slate-800/80 hover:bg-blue-600/40 text-slate-300 hover:text-blue-200 rounded-md cursor-pointer transition-colors"
                                    title="إعادة تشغيل هذه الجملة فقط (R)"
                                  >
                                    <RefreshCw className="w-3 h-3 text-blue-400" />
                                  </button>

                                  {!isImmersiveMode && (
                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEditCue(cue);
                                        }}
                                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md cursor-pointer"
                                        title="تعديل هذا المقطع"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => handleDeleteCue(cue.id, e)}
                                        className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-md cursor-pointer"
                                        title="حذف"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Panel Footer / Quick Add Cue at time */}
                      {!isImmersiveMode && (
                        <div className="p-2.5 border-t border-slate-700/80 bg-slate-800 flex items-center justify-between shrink-0">
                          <button
                            onClick={handleAddNewCueAtCurrentTime}
                            className="w-full py-1.5 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-blue-400" />
                            <span>إضافة سطر عند التوقيت الحالي ({formatSecondsToClock(currentTime)})</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* UPLOAD & DROPZONE AREA */}
        {/* ======================================================== */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
            isDragging
              ? "border-[#0056f6] bg-blue-50/70 scale-[1.005]"
              : "border-slate-300 hover:border-blue-400 bg-white/70 hover:bg-white"
          }`}
        >
          <div className="max-w-md mx-auto flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              اسحب وأفلت أي ملف صوتي، فيديو، أو ملف ترجمة (SRT/VTT) هنا
            </p>
            <p className="text-xs text-slate-500">
              يدعم MP4, WebM, MKV, MOV, MP3, WAV, M4A وملفات SRT / VTT المتزامنة
            </p>

            {uploading && (
              <div className="w-full mt-3">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1 font-bold">
                  <span>جاري رفع الملف إلى السيرفر...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0056f6] transition-all duration-200 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* MEDIA LIBRARY & PLAYLIST SECTION */}
        {/* ======================================================== */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
          {/* Section Bar: Filters & Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  filterType === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                الكل ({files.length})
              </button>
              <button
                onClick={() => setFilterType("video")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterType === "video"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>فيديو ({totalVideos})</span>
              </button>
              <button
                onClick={() => setFilterType("audio")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterType === "audio"
                    ? "bg-white text-purple-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>صوت ({totalAudios})</span>
              </button>
            </div>

            {/* Search and Layout Toggle */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="بحث في الملفات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-9 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#0056f6] transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowGradioModal(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="تفريغ أي ملف صوتي أو فيديو بسيرفر Gradio الألماني المحلي"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>تفريغ Gradio 🇩🇪</span>
              </button>

              <div className="flex items-center bg-slate-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === "grid" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                  }`}
                  title="عرض شبكي"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === "list" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                  }`}
                  title="عرض قائمة"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Files List / Grid View */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">جاري جلب الملفات من السيرفر...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-400 gap-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Film className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">لا توجد ملفات مرفوعة حالياً</p>
                <p className="text-xs text-slate-500 mt-1">
                  قم برفع أول ملف صوتي أو فيديو لبدء التشغيل وإضافة الترجمات المتزامنة
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                + رفع ملف الآن
              </button>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid View Cards */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredFiles.map((file) => {
                const isSelected = currentFile?.id === file.id;
                const hasSubtitles = file.subtitles && file.subtitles.length > 0;

                return (
                  <div
                    key={file.id}
                    onClick={() => {
                      handleSelectFile(file, true);
                    }}
                    className={`rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between cursor-pointer group relative overflow-hidden ${
                      isSelected
                        ? "bg-blue-50/50 border-blue-400 shadow-md ring-2 ring-blue-500/20"
                        : "bg-white border-slate-200/80 hover:border-blue-300 hover:shadow-md"
                    }`}
                  >
                    {/* Top Type Badge & Action Menu */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                            file.type === "video"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {file.type === "video" ? (
                            <>
                              <FileVideo className="w-3 h-3" />
                              <span>فيديو</span>
                            </>
                          ) : (
                            <>
                              <FileAudio className="w-3 h-3" />
                              <span>صوت</span>
                            </>
                          )}
                        </span>

                        {hasSubtitles && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-bold flex items-center gap-0.5">
                            <Subtitles className="w-3 h-3" />
                            <span>ترجمة ({file.subtitles?.length})</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleStartRename(file, e)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
                          title="تعديل الاسم"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`/api/media/download/${file.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
                          title="تحميل"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={(e) => handleDeleteFile(file.id, e)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Media Preview Box */}
                    <div className="w-full h-32 bg-slate-100 rounded-xl flex items-center justify-center mb-3 relative overflow-hidden group-hover:bg-slate-200/70 transition-colors">
                      {file.type === "video" ? (
                        <Film className="w-10 h-10 text-blue-400 group-hover:scale-110 transition-transform" />
                      ) : (
                        <Music className="w-10 h-10 text-purple-400 group-hover:scale-110 transition-transform" />
                      )}

                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-11 h-11 rounded-full bg-[#0056f6] text-white flex items-center justify-center shadow-md">
                          <Play className="w-5 h-5 fill-current translate-x-[-1px]" />
                        </div>
                      </div>

                      {isSelected && isPlaying && (
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-bold flex items-center gap-1 animate-pulse">
                          <span className="w-1.5 h-1.5 bg-white rounded-full" />
                          <span>يعمل الآن</span>
                        </div>
                      )}
                    </div>

                    {/* Title & Metadata */}
                    <div>
                      {editingId === file.id ? (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editTitleText}
                            onChange={(e) => setEditTitleText(e.target.value)}
                            className="w-full text-xs px-2 py-1 border border-blue-400 rounded-lg bg-white"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(file.id)}
                            className="p-1 text-emerald-600"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <p
                          className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-[#0056f6] transition-colors"
                          title={file.title}
                        >
                          {file.title}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-100 font-mono">
                        <span>{formatFileSize(file.size)}</span>
                        <span>{new Date(file.uploadedAt).toLocaleDateString("ar-EG")}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
              {filteredFiles.map((file) => {
                const isSelected = currentFile?.id === file.id;
                const hasSubtitles = file.subtitles && file.subtitles.length > 0;

                return (
                  <div
                    key={file.id}
                    onClick={() => {
                      handleSelectFile(file, true);
                    }}
                    className={`p-3.5 sm:px-4 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/60 font-semibold"
                        : "hover:bg-slate-50 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          file.type === "video"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-purple-100 text-purple-600"
                        }`}
                      >
                        {file.type === "video" ? (
                          <Film className="w-4 h-4" />
                        ) : (
                          <Music className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        {editingId === file.id ? (
                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editTitleText}
                              onChange={(e) => setEditTitleText(e.target.value)}
                              className="text-xs px-2 py-1 border border-blue-400 rounded-lg bg-white"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveRename(file.id)}
                              className="p-1 text-emerald-600"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p
                              className={`text-xs truncate ${
                                isSelected ? "text-blue-700 font-bold" : "text-slate-800"
                              }`}
                            >
                              {file.title}
                            </p>
                            {hasSubtitles && (
                              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold">
                                SRT ✓
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 truncate">
                          {file.originalName} • {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isSelected && isPlaying && (
                        <span className="hidden sm:inline-flex px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold animate-pulse">
                          مشغل الآن ⚡
                        </span>
                      )}

                      <button
                        onClick={(e) => handleStartRename(file, e)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="تعديل الاسم"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={`/api/media/download/${file.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="تحميل الملف"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={(e) => handleDeleteFile(file.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ======================================================== */}
      {/* MODAL: SUBTITLE UPLOADER & AI GENERATOR */}
      {/* ======================================================== */}
      {showSubtitleUploadModal && currentFile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Subtitles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">إضافة ترجمة للمقطع</h3>
                  <p className="text-xs text-slate-500">{currentFile.title}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openStyleInSidebar("upload")}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="تخصيص ألوان وخطوط ومواقع الترجمة في اللوحة الجانبية"
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>تخصيص الستايل</span>
                </button>

                <button
                  onClick={() => setShowSubtitleUploadModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-2xl text-[11px] font-bold my-4">
              <button
                onClick={() => {
                  setShowSubtitleUploadModal(false);
                  setShowGradioModal(true);
                }}
                className="py-2 rounded-xl transition-all flex items-center justify-center gap-1 bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-xs"
              >
                <Mic className="w-3 h-3" />
                <span>Gradio 🇩🇪</span>
              </button>
              <button
                onClick={() => setSubtitleUploadMode("file")}
                className={`py-2 rounded-xl transition-all ${
                  subtitleUploadMode === "file" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                }`}
              >
                ملف SRT 📁
              </button>
              <button
                onClick={() => setSubtitleUploadMode("paste")}
                className={`py-2 rounded-xl transition-all ${
                  subtitleUploadMode === "paste" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                }`}
              >
                لصق نص ✍️
              </button>
              <button
                onClick={() => setSubtitleUploadMode("ai")}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                  subtitleUploadMode === "ai" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600"
                }`}
              >
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span>AI Gemini</span>
              </button>
            </div>

            {/* TAB 1: FILE UPLOAD */}
            {subtitleUploadMode === "file" && (
              <div className="space-y-4">
                <div
                  onClick={() => subtitleFileInputRef.current?.click()}
                  className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50 rounded-2xl p-8 text-center cursor-pointer transition-colors"
                >
                  <Subtitles className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-800">
                    اضغط هنا لاختيار ملف ترجمة من جهازك
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    يدعم ملفات .SRT, .VTT, .SBV, .TXT
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: PASTE / MANUAL SRT TEXT */}
            {subtitleUploadMode === "paste" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم مسار الترجمة:
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: العربية (مترجم) أو English"
                    value={subtitleTrackLabel}
                    onChange={(e) => setSubtitleTrackLabel(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    محتوى ملف الترجمة (تنسيق SRT / VTT أو مقاطع زمنية):
                  </label>
                  <textarea
                    rows={7}
                    placeholder={`1\n00:00:01,000 --> 00:00:04,500\nمرحباً بكم في هذا المقطع التعليمي.\n\n2\n00:00:05,000 --> 00:00:08,200\nسنتعلم اليوم كيفية نطق هذه الكلمات.`}
                    value={pastedSubtitleText}
                    onChange={(e) => setPastedSubtitleText(e.target.value)}
                    className="w-full text-xs font-mono p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden resize-none"
                  />
                </div>

                <button
                  onClick={handleSavePastedSubtitles}
                  disabled={!pastedSubtitleText.trim()}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  حفظ الترجمة وتطبيقها 💾
                </button>
              </div>
            )}

            {/* TAB 3: AI GEMINI GENERATOR */}
            {subtitleUploadMode === "ai" && (
              <div className="space-y-3">
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed">
                  يقوم الذكاء الاصطناعي بتوليد مقاطع ترجمة زمنية متزامنة (SRT Cues) بدقة للمقطع بناءً على محتواه وملاحظاتك!
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Bot className="w-3.5 h-3.5 text-indigo-600" />
                      <span>نموذج الذكاء الاصطناعي (AI Model):</span>
                    </span>
                    <span className="text-[10px] text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                      {selectedAiModel}
                    </span>
                  </label>
                  <select
                    value={selectedAiModel}
                    onChange={(e) => handleSelectAiModel(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:border-indigo-500"
                  >
                    <optgroup label="⚡ نماذج فائقة وموصى بها">
                      {ALL_AVAILABLE_MODELS.filter(m => !m.group || m.group === "general").map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.name} - ({m.desc})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="🚀 نماذج الحصة اليومية العالية (500 RPD)">
                      {ALL_AVAILABLE_MODELS.filter(m => m.group === "high_quota").map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.name} - ({m.desc})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    لغة الترجمة المطلوبة:
                  </label>
                  <select
                    value={aiSubtitleLang}
                    onChange={(e) => setAiSubtitleLang(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-hidden"
                  >
                    <option value="ar">العربية (Arabic)</option>
                    <option value="en">الإنجليزية (English)</option>
                    <option value="fr">الفرنسية (Français)</option>
                    <option value="de">الألمانية (Deutsch)</option>
                    <option value="es">الإسبانية (Español)</option>
                    <option value="tr">التركية (Türkçe)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ملاحظات أو نص مساعد (اختياري):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="يمكنك تزويد موضوع المقطع أو النص الكامل لتوليد التوقيتات بدقة..."
                    value={aiPromptHint}
                    onChange={(e) => setAiPromptHint(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden resize-none"
                  />
                </div>

                <button
                  onClick={handleGenerateAiSubtitles}
                  disabled={isAiGenerating}
                  className="w-full py-2.5 bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isAiGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري توليد الترجمة الزمنية بالذكاء الاصطناعي...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>توليد الترجمة الذكية الآن ⚡</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CLEAN CUE TIMING & TEXT EDITOR (MM:SS FORMAT + SYNC) */}
      {/* ======================================================== */}
      {editingCue && (
        <CleanCueEditorModal
          cue={editingCue}
          activeTrackLabel={activeTrack?.label || "الترجمة"}
          secondaryTrackLabel={secondaryTrack && secondaryTrack.id !== activeTrackId ? secondaryTrack.label : undefined}
          currentTime={currentTime}
          initialSyncSecondary={syncWithSecondaryTrack}
          onSave={(cleanCue, shouldSync) => {
            handleSaveEditedCue(cleanCue, shouldSync);
          }}
          onClose={() => {
            setEditingCue(null);
            originalCueTimesRef.current = null;
          }}
          onPreview={(start, end) => {
            singleSentencePlaybackEndRef.current = end;
            handleSeek(start);
            smoothPlay();
            triggerHud("معاينة توقيت المقطع", "▶");
          }}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL: GEMINI SUBTITLE TRANSLATION (DUAL SUBTITLES) */}
      {/* ======================================================== */}
      {showTranslateModal && activeTrack && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-white animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-linear-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">ترجمة مسار الترجمة بالذكاء الاصطناعي (Gemini)</h3>
                  <p className="text-[11px] text-slate-400">لإنشاء ترجمة مزدوجة (ألماني + عربي) بالتوقيت الدقيق</p>
                </div>
              </div>
              <button
                onClick={() => setShowTranslateModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 space-y-1">
                <p className="text-xs text-slate-400">المسار المصدر المختار للترجمة:</p>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <Subtitles className="w-4 h-4 text-indigo-400" />
                  <span>{activeTrack.label}</span>
                  <span className="text-[11px] text-slate-400">({activeTrack.cues.length} مقطع زمني)</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                    <span>نموذج الذكاء الاصطناعي (AI Model):</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                    {selectedAiModel}
                  </span>
                </label>
                <select
                  value={selectedAiModel}
                  onChange={(e) => handleSelectAiModel(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                >
                  <optgroup label="⚡ نماذج فائقة وموصى بها (Gemini / Groq)">
                    {ALL_AVAILABLE_MODELS.filter(m => !m.group || m.group === "general").map((m) => (
                      <option key={m.key} value={m.key} className="bg-slate-900 text-white">
                        {m.name} - ({m.desc})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🚀 نماذج الحصة اليومية العالية (500 RPD)">
                    {ALL_AVAILABLE_MODELS.filter(m => m.group === "high_quota").map((m) => (
                      <option key={m.key} value={m.key} className="bg-slate-900 text-white">
                        {m.name} - ({m.desc})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  اختر لغة الترجمة الهدف:
                </label>
                <select
                  value={translateTargetLang}
                  onChange={(e) => setTranslateTargetLang(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="ar">🇸🇦 العربية (Arabic) - موصى بها للترجمة المزدوجة</option>
                  <option value="en">🇬🇧 الإنجليزية (English)</option>
                  <option value="de">🇩🇪 الألمانية (German)</option>
                  <option value="fr">🇫🇷 الفرنسية (French)</option>
                  <option value="es">🇪🇸 الإسبانية (Spanish)</option>
                  <option value="tr">🇹🇷 التركية (Turkish)</option>
                </select>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3.5 text-xs text-emerald-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Split className="w-4 h-4 text-emerald-400" />
                  <span>ميزة الترجمة المزدوجة التلقائية:</span>
                </p>
                <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                  سيقوم مودل Gemini بترجمة جميع مقاطع التوقيت مع المحافظة على التزامن بالمللي ثانية، وسيقوم المشغل تلقائياً بعرض النصين معاً (الأصلي الألماني والترجمة العربية تحت بعض).
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => handleTranslateTrackWithGemini(translateTargetLang)}
                  disabled={isTranslatingTrack}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isTranslatingTrack ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الترجمة عبر Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>بدء الترجمة وحفظ المسار ⚡</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowTranslateModal(false)}
                  disabled={isTranslatingTrack}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: LOCAL GRADIO SPEECH-TO-TEXT GERMAN SERVER */}
      {/* ======================================================== */}
      <GradioTranscriberModal
        isOpen={showGradioModal}
        onClose={() => setShowGradioModal(false)}
        currentFile={currentFile}
        onOpenStyleModal={() => openStyleInSidebar("gradio")}
        onSubtitlesGenerated={async (trackLabel, cues, rawSrt) => {
          if (currentFile) {
            await saveSubtitleTrackToServer(currentFile.id, trackLabel, cues, "ai");
            setShowGradioModal(false);
          }
        }}
      />

      {/* ======================================================== */}
      {/* MODAL: SUBTITLE OPTIONS & MANAGEMENT HUB */}
      {/* ======================================================== */}
      <SubtitleOptionsModal
        isOpen={showSubtitleOptionsModal}
        onClose={() => setShowSubtitleOptionsModal(false)}
        currentFile={currentFile}
        activeTrackId={activeTrackId}
        secondaryTrackId={secondaryTrackId}
        showDualSubtitles={showDualSubtitles}
        showSubtitlesOverlay={showSubtitlesOverlay}
        onToggleSubtitlesOverlay={handleToggleSubtitlesOverlay}
        onSelectPrimaryTrack={handleSelectPrimaryTrack}
        onSelectSecondaryTrack={handleSelectSecondaryTrack}
        onToggleDualSubtitles={handleToggleDualSubtitles}
        onDeleteTrack={(trackId) => handleDeleteSubtitleTrack(trackId)}
        onOpenUploadModal={() => setShowSubtitleUploadModal(true)}
        onOpenGradioModal={() => setShowGradioModal(true)}
        onOpenTranslateModal={() => setShowTranslateModal(true)}
        onOpenStyleModal={() => openStyleInSidebar("options")}
        onDownloadSubtitles={handleDownloadSubtitles}
        onCopyTranscript={handleCopyTranscript}
        isCopiedTranscript={copiedTranscript}
        selectedAiModel={selectedAiModel}
        onSelectAiModel={handleSelectAiModel}
      />
    </div>
  );
};

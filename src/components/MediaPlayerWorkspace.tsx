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
  Volume1,
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
  Minus,
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
  MoreVertical,
  ArrowUp,
  ArrowDown,
  Folder,
  FolderPlus,
  FolderOpen,
  ChevronLeft,
  FolderInput,
  FolderArchive,
  FileSpreadsheet,
  CornerUpRight
} from "lucide-react";
import { MediaFile, MediaSubtitleTrack, SubtitleCue, MediaFolder } from "../types";
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
import { SubtitleOptionsModal, SubtitleOptionsPanel } from "./SubtitleOptionsModal";
import { CleanCueEditorModal } from "./CleanCueEditorModal";
import { ALL_AVAILABLE_MODELS, AIModelOption } from "./AICorrectorWorkspace";
import { MediaExplorerView } from "./MediaExplorerView";
import { formatSubtitleTrackProtocol } from "../utils/subtitleNaming";
import { ReviewChatModal, ReviewChatMessage } from "./ReviewChatModal";
import { speakClient } from "./Modals";

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
// Fast & Universal Media Stream URL Resolver
// Routes external/Gradio URLs through stream-proxy with HTTP 206 Range support and CORS
// ---------------------------------------------------------
export function resolveMediaStreamUrl(file: MediaFile | null | undefined): string {
  if (!file) return "";
  if (file.url && file.url.startsWith("blob:")) {
    return file.url;
  }
  if (file.url && (file.url.startsWith("http://") || file.url.startsWith("https://"))) {
    // If it's a remote URL or local Gradio URL (e.g., http://192.168.0.159:7861/videos/...),
    // proxy it through /api/media/stream-proxy to enable full HTTP 206 Partial Content (Range seeks) & CORS
    return `/api/media/stream-proxy?url=${encodeURIComponent(file.url)}`;
  }
  if (file.filename) {
    return `/api/media/stream/${encodeURIComponent(file.filename)}`;
  }
  return file.url || "";
}

// ---------------------------------------------------------
// Studio-Grade Web Audio Graph Engine (Real Digital Gain Booster & Voice Clarifier)
// Supports up to 300% (3.0x) amplification with dynamic limiter & speech EQ
// ---------------------------------------------------------
interface WebAudioGraph {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
  gainNode: GainNode;
  speechFilter: BiquadFilterNode;
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
    let source: MediaElementAudioSourceNode;
    try {
      source = ctx.createMediaElementSource(el);
    } catch (sourceErr) {
      console.warn("createMediaElementSource skipped (e.g. cross-origin/CORS fallback):", sourceErr);
      try { ctx.close(); } catch {}
      return null;
    }

    // Speech / Voice intelligibility peaking filter at 2.4 kHz (human vocal clarity range)
    const speechFilter = ctx.createBiquadFilter();
    speechFilter.type = "peaking";
    speechFilter.frequency.setValueAtTime(2400, ctx.currentTime);
    speechFilter.Q.setValueAtTime(1.4, ctx.currentTime);
    speechFilter.gain.setValueAtTime(0, ctx.currentTime);

    const gainNode = ctx.createGain();

    // Studio Dynamic Compressor / Brickwall Limiter to avoid distortion at 200%-300% boost
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-1.5, ctx.currentTime);
    compressor.knee.setValueAtTime(12, ctx.currentTime);
    compressor.ratio.setValueAtTime(16, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.15, ctx.currentTime);

    // Graph routing: Source -> Speech Filter -> Gain Booster -> Compressor Limiter -> Output
    source.connect(speechFilter);
    speechFilter.connect(gainNode);
    gainNode.connect(compressor);
    compressor.connect(ctx.destination);

    const graph: WebAudioGraph = { ctx, source, gainNode, speechFilter, compressor };
    audioGraphWeakMap.set(el, graph);
    return graph;
  } catch (err) {
    console.warn("Web Audio Booster fallback notice:", err);
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
  const [uploadingFolderName, setUploadingFolderName] = useState<string | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
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
  const [voiceClarifier, setVoiceClarifier] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("media_player_voice_clarifier");
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
  const [sidePanelView, setSidePanelView] = useState<"transcript" | "style" | "subtitles">("transcript");
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
  const [showTranscriptSearch, setShowTranscriptSearch] = useState<boolean>(false);

  // Cue Item Options Dropdown & Confirm Delete States
  const [cueOptionsMenuId, setCueOptionsMenuId] = useState<string | null>(null);
  const [cueMenuAnchor, setCueMenuAnchor] = useState<{
    cue: SubtitleCue;
    x: number;
    y: number;
    openAbove: boolean;
  } | null>(null);
  const [cueToDelete, setCueToDelete] = useState<SubtitleCue | null>(null);

  // Transient In-Memory AI Sentence Chat State (Cleared when exiting or switching video/audio)
  const [sentenceChatHistories, setSentenceChatHistories] = useState<Record<string, ReviewChatMessage[]>>({});
  const [isSentenceChatOpen, setIsSentenceChatOpen] = useState<boolean>(false);
  const [chatTargetCue, setChatTargetCue] = useState<(SubtitleCue & { secondaryText?: string }) | null>(null);
  const [chatPreviousCues, setChatPreviousCues] = useState<(SubtitleCue & { secondaryText?: string })[]>([]);
  const [chatNextCues, setChatNextCues] = useState<(SubtitleCue & { secondaryText?: string })[]>([]);

  // Open Sentence AI Chat with full 20-previous & 20-next surrounding context
  const handleOpenSentenceChat = (targetCue: SubtitleCue) => {
    const targetIdx = activeCues.findIndex((c) => c.id === targetCue.id);
    const getSecText = (c: SubtitleCue) => {
      if (!secondaryCues || secondaryCues.length === 0) return undefined;
      const match = secondaryCues.find(
        (sc) => Math.abs(sc.startTime - c.startTime) < 0.5 || (sc.startTime <= c.endTime && sc.endTime >= c.startTime)
      );
      return match?.text;
    };

    const enrichedTarget: SubtitleCue & { secondaryText?: string } = {
      ...targetCue,
      secondaryText: getSecText(targetCue)
    };

    let prevCues: (SubtitleCue & { secondaryText?: string })[] = [];
    let nextCuesList: (SubtitleCue & { secondaryText?: string })[] = [];

    if (targetIdx !== -1) {
      prevCues = activeCues.slice(Math.max(0, targetIdx - 20), targetIdx).map((c) => ({
        ...c,
        secondaryText: getSecText(c)
      }));
      nextCuesList = activeCues.slice(targetIdx + 1, Math.min(activeCues.length, targetIdx + 21)).map((c) => ({
        ...c,
        secondaryText: getSecText(c)
      }));
    }

    setChatTargetCue(enrichedTarget);
    setChatPreviousCues(prevCues);
    setChatNextCues(nextCuesList);
    setIsSentenceChatOpen(true);
  };

  // Top Video/Media Header Options Menu State
  const [showTopOptionsMenu, setShowTopOptionsMenu] = useState<boolean>(false);
  const topOptionsMenuRef = useRef<HTMLDivElement>(null);

  // Close cue options and top options dropdown on clicking outside or scrolling
  useEffect(() => {
    if (!cueOptionsMenuId && !showTopOptionsMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (cueOptionsMenuId) {
        setCueOptionsMenuId(null);
        setCueMenuAnchor(null);
      }
      if (showTopOptionsMenu && topOptionsMenuRef.current && !topOptionsMenuRef.current.contains(e.target as Node)) {
        setShowTopOptionsMenu(false);
      }
    };
    const handleScrollOrResize = () => {
      setCueOptionsMenuId(null);
      setCueMenuAnchor(null);
      setShowTopOptionsMenu(false);
    };
    window.addEventListener("click", handleOutsideClick);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [cueOptionsMenuId, showTopOptionsMenu]);

  const handleToggleCueMenu = (cue: SubtitleCue, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (cueOptionsMenuId === cue.id) {
      setCueOptionsMenuId(null);
      setCueMenuAnchor(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 145;
    const menuHeight = 120;
    const padding = 12;

    // Smart vertical calculation: if close to bottom of window, flip above
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < menuHeight + padding && rect.top > menuHeight + padding;
    const y = openAbove ? rect.top - 4 : rect.bottom + 4;

    // Smart horizontal calculation: ensure menu stays strictly within screen bounds
    let x = rect.left;
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (x < padding) {
      x = padding;
    }

    setCueOptionsMenuId(cue.id);
    setCueMenuAnchor({
      cue,
      x,
      y,
      openAbove,
    });
  };

  // Speed Menu Popup State
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const speedMenuRef = useRef<HTMLDivElement>(null);

  // Fullscreen state and section ref
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showFullscreenControls, setShowFullscreenControls] = useState<boolean>(false);
  const playerSectionRef = useRef<HTMLElement>(null);
  const fullscreenControlsTimeoutRef = useRef<number | null>(null);

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
  const [gradioInitialMode, setGradioInitialMode] = useState<"youtube" | "current" | "upload">("youtube");
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

  const openSubtitlesInSidebar = (source: "gradio" | "upload" | "style" | null = null) => {
    if (source === "gradio") setShowGradioModal(false);
    if (source === "upload") setShowSubtitleUploadModal(false);
    if (source === "style") setShowSubtitleStyleModal(false);
    setShowSubtitleOptionsModal(false);
    setShowTranscriptPanel(true);
    setSidePanelView("subtitles");
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

  // Subtitle Selection Preferences per file (persisted in localStorage and synced to Server)
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

  const saveSubtitlePreferencesToServer = async (
    fileId: string,
    primaryId: string | null,
    secondaryId: string | null,
    showDual?: boolean
  ) => {
    try {
      await fetch(`/api/media/${fileId}/subtitle-preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryTrackId: primaryId,
          secondaryTrackId: secondaryId,
          showDualSubtitles: showDual !== undefined ? showDual : showDualSubtitles
        })
      });
    } catch (e) {
      console.error("Failed to sync subtitle preferences with server:", e);
    }
  };

  // Helper setters that also persist to both localStorage and Server
  const handleSelectPrimaryTrack = (trackId: string | null) => {
    setActiveTrackId(trackId);
    if (trackId) {
      setShowSubtitlesOverlay(true);
      triggerSubtitlePreview(3200);
      try {
        localStorage.setItem("media_player_show_subtitles_overlay", JSON.stringify(true));
      } catch (e) {}
    }
    if (currentFile) {
      saveSubtitlePreferences(currentFile.id, trackId, secondaryTrackId);
      saveSubtitlePreferencesToServer(currentFile.id, trackId, secondaryTrackId, showDualSubtitles);
      setCurrentFile((prev) => prev ? { ...prev, primaryTrackId: trackId || undefined } : null);
      setFiles((prev) => prev.map((f) => f.id === currentFile.id ? { ...f, primaryTrackId: trackId || undefined } : f));
    }
  };

  const handleSelectSecondaryTrack = (trackId: string | null) => {
    setSecondaryTrackId(trackId);
    const shouldShowDual = Boolean(trackId);
    if (trackId) {
      setShowDualSubtitles(true);
      triggerSubtitlePreview(3200);
      try {
        localStorage.setItem("media_player_show_dual_subtitles", JSON.stringify(true));
      } catch (e) {
        console.error(e);
      }
    }
    if (currentFile) {
      saveSubtitlePreferences(currentFile.id, activeTrackId, trackId);
      saveSubtitlePreferencesToServer(currentFile.id, activeTrackId, trackId, shouldShowDual);
      setCurrentFile((prev) => prev ? { ...prev, secondaryTrackId: trackId || undefined, showDualSubtitles: shouldShowDual } : null);
      setFiles((prev) => prev.map((f) => f.id === currentFile.id ? { ...f, secondaryTrackId: trackId || undefined, showDualSubtitles: shouldShowDual } : f));
    }
  };

  const handleToggleDualSubtitles = () => {
    setShowDualSubtitles((prev) => {
      const next = !prev;
      if (next) {
        triggerSubtitlePreview(3200);
      }
      try {
        localStorage.setItem("media_player_show_dual_subtitles", JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      if (currentFile) {
        saveSubtitlePreferencesToServer(currentFile.id, activeTrackId, secondaryTrackId, next);
        setCurrentFile((cf) => cf ? { ...cf, showDualSubtitles: next } : null);
      }
      return next;
    });
  };

  const handleSwapTracks = () => {
    if (!activeTrackId && !secondaryTrackId) return;
    const newPrimary = secondaryTrackId;
    const newSecondary = activeTrackId;
    setActiveTrackId(newPrimary);
    setSecondaryTrackId(newSecondary);
    triggerSubtitlePreview(3200);
    if (currentFile) {
      saveSubtitlePreferences(currentFile.id, newPrimary, newSecondary);
      saveSubtitlePreferencesToServer(currentFile.id, newPrimary, newSecondary, showDualSubtitles);
      setCurrentFile((prev) => prev ? { ...prev, primaryTrackId: newPrimary || undefined, secondaryTrackId: newSecondary || undefined } : null);
      setFiles((prev) => prev.map((f) => f.id === currentFile.id ? { ...f, primaryTrackId: newPrimary || undefined, secondaryTrackId: newSecondary || undefined } : f));
      triggerHud("تم تبديل مسارات الترجمة (1 ⇄ 2)", "🔄");
    }
  };

  const handleToggleSubtitlesOverlay = () => {
    setShowSubtitlesOverlay((prev) => {
      const next = !prev;
      if (next) {
        triggerSubtitlePreview(3200);
      }
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

  // Floating Samsung One UI-style Horizontal Volume Slider Bar State
  const [showSamsungVolumeBar, setShowSamsungVolumeBar] = useState<boolean>(false);
  const samsungVolumeTimerRef = useRef<number | null>(null);

  const triggerSamsungVolumeBar = useCallback(() => {
    if (samsungVolumeTimerRef.current) {
      window.clearTimeout(samsungVolumeTimerRef.current);
    }
    setShowSamsungVolumeBar(true);
    samsungVolumeTimerRef.current = window.setTimeout(() => {
      setShowSamsungVolumeBar(false);
    }, 2600);
  }, []);

  const triggerHud = useCallback((text: string, sub?: string) => {
    if (hudTimerRef.current) {
      window.clearTimeout(hudTimerRef.current);
    }
    setHudToast({ text, sub });
    hudTimerRef.current = window.setTimeout(() => {
      setHudToast(null);
    }, 950);
  }, []);

  // Real-time Gesture Subtitle Preview State & Trigger
  const [showSwipeSubtitlePreview, setShowSwipeSubtitlePreview] = useState<boolean>(false);
  const swipeSubtitlePreviewTimerRef = useRef<number | null>(null);

  const triggerSubtitlePreview = useCallback((durationMs: number = 3200) => {
    if (swipeSubtitlePreviewTimerRef.current) {
      window.clearTimeout(swipeSubtitlePreviewTimerRef.current);
    }
    setShowSwipeSubtitlePreview(true);
    swipeSubtitlePreviewTimerRef.current = window.setTimeout(() => {
      setShowSwipeSubtitlePreview(false);
      swipeSubtitlePreviewTimerRef.current = null;
    }, durationMs);
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

  // Active screen mode: File Manager (default) vs Active Player
  const [isPlayerOpen, setIsPlayerOpen] = useState<boolean>(false);

  // Folders State (Synchronized with Server)
  const [folders, setFolders] = useState<MediaFolder[]>(() => {
    try {
      const saved = localStorage.getItem("media_player_folders");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // File to Folder mapping (fileId -> folderId) (Synchronized with Server)
  const [fileFolderMap, setFileFolderMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("media_file_folder_map");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Save folders & map to localStorage as fast client fallback
  useEffect(() => {
    try {
      localStorage.setItem("media_player_folders", JSON.stringify(folders));
    } catch (e) {
      console.error(e);
    }
  }, [folders]);

  useEffect(() => {
    try {
      localStorage.setItem("media_file_folder_map", JSON.stringify(fileFolderMap));
    } catch (e) {
      console.error(e);
    }
  }, [fileFolderMap]);

  // Folder Modal states
  const [showFolderModal, setShowFolderModal] = useState<boolean>(false);
  const [folderModalMode, setFolderModalMode] = useState<"create" | "edit">("create");
  const [folderNameInput, setFolderNameInput] = useState<string>("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  // Move file modal state
  const [movingFile, setMovingFile] = useState<MediaFile | null>(null);

  // Edit / Add Cue Modal
  const [editingCue, setEditingCue] = useState<SubtitleCue | null>(null);
  const [syncWithSecondaryTrack, setSyncWithSecondaryTrack] = useState<boolean>(true);
  const originalCueTimesRef = useRef<{ id: string; startTime: number; endTime: number; text: string } | null>(null);
  const [copiedTranscript, setCopiedTranscript] = useState<boolean>(false);

  // Filters and UI states
  const [filterType, setFilterType] = useState<"all" | "video" | "audio">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Editing file title
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState<string>("");

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const subtitleFileInputRef = useRef<HTMLInputElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const controlsBarRef = useRef<HTMLDivElement | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const activeCueRef = useRef<HTMLDivElement | null>(null);

  // Dynamic measurement of controls bar height in fullscreen/immersive modes
  const [controlsBarHeight, setControlsBarHeight] = useState<number>(108);

  useEffect(() => {
    const el = controlsBarRef.current;
    if (!el) return;

    const measure = () => {
      if (controlsBarRef.current) {
        const rect = controlsBarRef.current.getBoundingClientRect();
        if (rect.height > 0) {
          setControlsBarHeight(rect.height);
        }
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isFullscreen, showFullscreenControls]);

  // Synchronized state refs to prevent stale closure race conditions during swipe gestures
  const showSubtitlesOverlayRef = useRef(showSubtitlesOverlay);
  const showDualSubtitlesRef = useRef(showDualSubtitles);
  const activeTrackIdRef = useRef(activeTrackId);
  const secondaryTrackIdRef = useRef(secondaryTrackId);
  const currentFileRef = useRef(currentFile);

  useEffect(() => {
    showSubtitlesOverlayRef.current = showSubtitlesOverlay;
  }, [showSubtitlesOverlay]);

  useEffect(() => {
    showDualSubtitlesRef.current = showDualSubtitles;
  }, [showDualSubtitles]);

  useEffect(() => {
    activeTrackIdRef.current = activeTrackId;
  }, [activeTrackId]);

  useEffect(() => {
    secondaryTrackIdRef.current = secondaryTrackId;
  }, [secondaryTrackId]);

  useEffect(() => {
    currentFileRef.current = currentFile;
  }, [currentFile]);

  // Fetch folders and mapping from server
  const fetchMediaFolders = async () => {
    try {
      const res = await fetch("/api/media/folders");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.folders)) {
          setFolders(data.folders);
        }
        if (data.fileFolderMap && typeof data.fileFolderMap === "object") {
          setFileFolderMap(data.fileFolderMap);
        }
      }
    } catch (err) {
      console.error("Failed to load folders from server:", err);
    }
  };

  // Fetch files from server
  const fetchMediaFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media/files");
      if (!res.ok) throw new Error("فشل في جلب قائمة الملفات");
      const data = await res.json();
      const loadedFiles: MediaFile[] = data.files || [];
      setFiles(loadedFiles);

      // Keep currentFile synchronized if already playing
      if (currentFile) {
        const updatedCurrent = loadedFiles.find((f) => f.id === currentFile.id);
        if (updatedCurrent) {
          setCurrentFile(updatedCurrent);
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
    fetchMediaFolders();
  }, []);

  // Save currently selected file and open player view in direct cinematic mode
  const handleSelectFile = (file: MediaFile | null, autoPlay: boolean = true) => {
    // Reset transient in-memory sentence chat conversations and clear transient media chat storage when switching/opening a file
    setSentenceChatHistories({});
    setIsSentenceChatOpen(false);
    setChatTargetCue(null);
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("review_chat_history_media_cue_")) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {}

    setCurrentFile(file);
    setIsPlaying(autoPlay);
    if (file) {
      setIsPlayerOpen(true);
      setIsImmersiveMode(true);
      try {
        localStorage.setItem("media_player_last_played_file_id", file.id);
      } catch (e) {
        console.error("Failed to save last played file:", e);
      }
    } else {
      setIsPlayerOpen(false);
      setIsImmersiveMode(false);
    }
  };

  // Close player and return to file manager (Strictly wipe transient sentence chat memory)
  const handleBackToFileManager = () => {
    smoothPause();
    setSentenceChatHistories({});
    setIsSentenceChatOpen(false);
    setChatTargetCue(null);
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("review_chat_history_media_cue_")) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {}
    setIsPlayerOpen(false);
    setIsImmersiveMode(false);
  };

  // Folder management functions
  const getFolderPathName = (folder: MediaFolder): string => {
    const parts: string[] = [folder.name];
    let curParentId = folder.parentId;
    const visited = new Set<string>();
    while (curParentId && !visited.has(curParentId)) {
      visited.add(curParentId);
      const parent = folders.find((f) => f.id === curParentId);
      if (parent) {
        parts.unshift(parent.name);
        curParentId = parent.parentId;
      } else {
        break;
      }
    }
    return parts.join(" / ");
  };

  const handleOpenCreateFolderModal = () => {
    setFolderModalMode("create");
    setFolderNameInput("");
    setEditingFolderId(null);
    setShowFolderModal(true);
  };

  const handleOpenEditFolderModal = (folder: MediaFolder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFolderModalMode("edit");
    setFolderNameInput(folder.name);
    setEditingFolderId(folder.id);
    setShowFolderModal(true);
  };

  const handleSaveFolder = async () => {
    if (!folderNameInput.trim()) return;
    const cleanName = folderNameInput.trim();

    if (folderModalMode === "create") {
      const currentParent = (activeFolderId && activeFolderId !== "uncategorized") ? activeFolderId : null;
      const newFolder: MediaFolder = {
        id: `folder-${Date.now()}`,
        name: cleanName,
        createdAt: new Date().toISOString(),
        parentId: currentParent
      };
      setFolders((prev) => [...prev, newFolder]);
      setSuccessMsg(`تم إنشاء مجلد "${cleanName}" بنجاح 📁`);

      try {
        await fetch("/api/media/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newFolder)
        });
      } catch (err) {
        console.error("Failed to save folder to server:", err);
      }
    } else if (editingFolderId) {
      setFolders((prev) =>
        prev.map((f) => (f.id === editingFolderId ? { ...f, name: cleanName } : f))
      );
      setSuccessMsg(`تم تعديل اسم المجلد إلى "${cleanName}" 📁`);

      try {
        await fetch(`/api/media/folders/${editingFolderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cleanName })
        });
      } catch (err) {
        console.error("Failed to update folder on server:", err);
      }
    }

    setShowFolderModal(false);
    setFolderNameInput("");
    setEditingFolderId(null);
  };

  const handleDeleteFolder = async (folderId: string, folderName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`هل أنت متأكد من حذف مجلد "${folderName}"؟ (لن يتم حذف الملفات، ستعود للمجلد الرئيسي)`)) {
      return;
    }

    // Recursively collect descendant folder IDs
    const getDescendants = (id: string, all: MediaFolder[]): string[] => {
      const children = all.filter((f) => f.parentId === id);
      return [id, ...children.flatMap((c) => getDescendants(c.id, all))];
    };

    const idsToDelete = getDescendants(folderId, folders);

    setFolders((prev) => prev.filter((f) => !idsToDelete.includes(f.id)));
    setFileFolderMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((fileId) => {
        if (idsToDelete.includes(next[fileId])) {
          delete next[fileId];
        }
      });
      return next;
    });

    if (activeFolderId && idsToDelete.includes(activeFolderId)) {
      const target = folders.find((f) => f.id === folderId);
      setActiveFolderId(target?.parentId || null);
    }
    setSuccessMsg(`تم حذف مجلد "${folderName}"`);

    try {
      await fetch(`/api/media/folders/${folderId}`, {
        method: "DELETE"
      });
    } catch (err) {
      console.error("Failed to delete folder on server:", err);
    }
  };

  const handleMoveFileToFolder = async (fileId: string, targetFolderId: string | null) => {
    setFileFolderMap((prev) => {
      const next = { ...prev };
      if (!targetFolderId) {
        delete next[fileId];
      } else {
        next[fileId] = targetFolderId;
      }
      return next;
    });
    setMovingFile(null);
    setSuccessMsg("تم نقل الملف بنجاح 📁");

    try {
      await fetch("/api/media/folders/move-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: [fileId], targetFolderId })
      });
    } catch (err) {
      console.error("Failed to move file on server:", err);
    }
  };

  const handleBulkMoveFiles = async (fileIds: string[], targetFolderId: string | null) => {
    if (fileIds.length === 0) return;
    setFileFolderMap((prev) => {
      const next = { ...prev };
      fileIds.forEach((fileId) => {
        if (!targetFolderId) {
          delete next[fileId];
        } else {
          next[fileId] = targetFolderId;
        }
      });
      return next;
    });
    setSuccessMsg(`تم نقل ${fileIds.length} ملف بنجاح 📁`);

    try {
      await fetch("/api/media/folders/move-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds, targetFolderId })
      });
    } catch (err) {
      console.error("Failed to move files on server:", err);
    }
  };

  const handleBulkDeleteFiles = async (fileIds: string[], folderIds: string[] = []) => {
    const totalCount = fileIds.length + folderIds.length;
    if (totalCount === 0) return;

    if (!window.confirm(`هل أنت متأكد من حذف ${fileIds.length > 0 ? `${fileIds.length} ملف` : ""} ${folderIds.length > 0 ? `${folderIds.length} مجلد` : ""} نهائياً؟`)) {
      return;
    }

    try {
      // Delete folders from local state & server
      if (folderIds.length > 0) {
        setFolders((prev) => prev.filter((f) => !folderIds.includes(f.id)));
        setFileFolderMap((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((fid) => {
            if (folderIds.includes(next[fid])) {
              delete next[fid];
            }
          });
          return next;
        });

        for (const fId of folderIds) {
          await fetch(`/api/media/folders/${fId}`, { method: "DELETE" }).catch(() => {});
        }
      }

      // Delete files from server & local state
      if (fileIds.length > 0) {
        for (const fid of fileIds) {
          await fetch(`/api/media/files/${fid}`, { method: "DELETE" }).catch(() => {});
        }
        setFiles((prev) => prev.filter((f) => !fileIds.includes(f.id)));
        if (currentFile && fileIds.includes(currentFile.id)) {
          setCurrentFile(null);
          setIsPlaying(false);
        }
      }

      setSuccessMsg(`تم الحذف بنجاح 🗑️`);
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء الحذف الجماعي");
    }
  };

  const handleOpenMoveModal = (file: MediaFile) => {
    setMovingFile(file);
  };

  const getFolderFileCount = useCallback(
    (folderId: string) => {
      return files.filter((f) => fileFolderMap[f.id] === folderId).length;
    },
    [files, fileFolderMap]
  );

  // Set active and secondary subtitle tracks when currentFile changes (restoring saved preferences)
  const currentFileId = currentFile?.id || null;
  const currentFileSubtitlesCount = currentFile?.subtitles?.length || 0;

  useEffect(() => {
    if (currentFile?.subtitles && currentFile.subtitles.length > 0) {
      const savedPrefs = getSavedSubtitlePreferences(currentFile.id);

      // Determine Primary Track:
      // 1. Check server-saved primaryTrackId on currentFile
      // 2. Check local saved preference
      // 3. Fallback: Prefer German/original or source!=ai or first track
      let chosenPrimaryId: string | null = null;
      if (currentFile.primaryTrackId && currentFile.subtitles.some((t) => t.id === currentFile.primaryTrackId)) {
        chosenPrimaryId = currentFile.primaryTrackId;
      } else if (savedPrefs.primaryId && currentFile.subtitles.some((t) => t.id === savedPrefs.primaryId)) {
        chosenPrimaryId = savedPrefs.primaryId;
      } else if (activeTrackIdRef.current && currentFile.subtitles.some((t) => t.id === activeTrackIdRef.current)) {
        chosenPrimaryId = activeTrackIdRef.current;
      } else {
        // Find German or uploaded track first
        const germanOrOriginal = currentFile.subtitles.find(
          (t) => t.language === "de" || t.source === "uploaded" || t.source === "manual"
        );
        chosenPrimaryId = germanOrOriginal ? germanOrOriginal.id : currentFile.subtitles[0].id;
      }
      activeTrackIdRef.current = chosenPrimaryId;
      setActiveTrackId(chosenPrimaryId);

      // Determine Secondary Track:
      // 1. Check server-saved secondaryTrackId on currentFile
      // 2. Check local saved preference
      // 3. Fallback: Prefer translated/Arabic track (different from primary)
      let chosenSecondaryId: string | null = null;
      if (
        currentFile.secondaryTrackId &&
        currentFile.secondaryTrackId !== chosenPrimaryId &&
        currentFile.subtitles.some((t) => t.id === currentFile.secondaryTrackId)
      ) {
        chosenSecondaryId = currentFile.secondaryTrackId;
      } else if (
        savedPrefs.secondaryId &&
        savedPrefs.secondaryId !== chosenPrimaryId &&
        currentFile.subtitles.some((t) => t.id === savedPrefs.secondaryId)
      ) {
        chosenSecondaryId = savedPrefs.secondaryId;
      } else if (currentFile.subtitles.length > 1) {
        const arabicOrTranslated = currentFile.subtitles.find(
          (t) => t.id !== chosenPrimaryId && (t.language === "ar" || t.source === "ai" || t.label.includes("عربي") || t.label.includes("🇸🇦"))
        );
        const otherTrack = arabicOrTranslated || currentFile.subtitles.find((t) => t.id !== chosenPrimaryId);
        chosenSecondaryId = otherTrack ? otherTrack.id : null;
      }
      secondaryTrackIdRef.current = chosenSecondaryId;
      setSecondaryTrackId(chosenSecondaryId);

      if (currentFile.showDualSubtitles !== undefined) {
        showDualSubtitlesRef.current = currentFile.showDualSubtitles;
        setShowDualSubtitles(currentFile.showDualSubtitles);
      } else if (chosenSecondaryId) {
        showDualSubtitlesRef.current = true;
        setShowDualSubtitles(true);
      }
    } else {
      activeTrackIdRef.current = null;
      secondaryTrackIdRef.current = null;
      setActiveTrackId(null);
      setSecondaryTrackId(null);
    }
  }, [currentFileId, currentFileSubtitlesCount]);

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

  // Sample Text Generators for Instant Visual Confirmation during Swipes / Previews
  const getSamplePrimarySubtitleText = useCallback(() => {
    if (activeTrack?.language === "de") {
      return "Dies ist ein Beispiel für den Untertitel (نص تجريبي للترجمة الأولى)";
    }
    if (activeTrack?.language === "en") {
      return "This is a sample subtitle text (نص تجريبي للترجمة الأولى)";
    }
    if (activeTrack?.language === "ar") {
      return "هذا نص تجريبي لمعاينة الترجمة الأولى (الأساسية) 🎬";
    }
    return activeTrack?.label
      ? `معاينة: ${activeTrack.label} (نص تجريبي)`
      : "نص تجريبي لمعاينة مظهر الترجمة الأولى 🎬";
  }, [activeTrack]);

  const getSampleSecondarySubtitleText = useCallback(() => {
    if (secondaryTrack?.language === "ar" || secondaryTrack?.source === "ai" || secondaryTrack?.label.includes("عربي") || secondaryTrack?.label.includes("🇸🇦")) {
      return "هذا نص تجريبي لمعاينة الترجمة العربية المزدوجة 🇸🇦⚡";
    }
    if (secondaryTrack?.language === "de") {
      return "Dies ist ein Beispiel für den zweiten Untertitel (الترجمة الثانية)";
    }
    if (secondaryTrack?.language === "en") {
      return "Sample text for secondary dual subtitle (الترجمة الثانية)";
    }
    return secondaryTrack?.label
      ? `معاينة: ${secondaryTrack.label} (الترجمة المزدوجة)`
      : "هذا نص تجريبي لمعاينة الترجمة المزدوجة الثانية 💬";
  }, [secondaryTrack]);

  // Robust, Non-repeating 1-to-1 Mapping between Primary Cues and Secondary (e.g. Arabic) Cues
  const secondaryCueMap = useMemo(() => {
    const map = new Map<string, SubtitleCue>();
    if (!showDualSubtitles || activeCues.length === 0 || secondaryCues.length === 0) {
      return map;
    }

    // 1. Direct ID matching if tracks share cue IDs (e.g., translated track cloned from original)
    const hasSharedIds = activeCues.some((ac) => secondaryCues.some((sc) => sc.id === ac.id));
    if (hasSharedIds) {
      const secIdMap = new Map(secondaryCues.map((sc) => [sc.id, sc]));
      for (const cue of activeCues) {
        const match = secIdMap.get(cue.id);
        if (match) {
          map.set(cue.id, match);
        }
      }
      return map;
    }

    // 2. Parallel / Translated track matching (same cue count & aligned timestamps)
    if (activeCues.length === secondaryCues.length) {
      let isIndexAligned = true;
      for (let i = 0; i < activeCues.length; i++) {
        if (Math.abs(activeCues[i].startTime - secondaryCues[i].startTime) > 2.5) {
          isIndexAligned = false;
          break;
        }
      }
      if (isIndexAligned) {
        for (let i = 0; i < activeCues.length; i++) {
          map.set(activeCues[i].id, secondaryCues[i]);
        }
        return map;
      }
    }

    // 3. Temporal Overlap & Proximity matching (ensuring NO duplicate cues across different sentences)
    const usedSecondaryIds = new Set<string>();

    for (const cue of activeCues) {
      let bestMatch: SubtitleCue | null = null;
      let maxOverlap = 0;

      for (const sc of secondaryCues) {
        if (usedSecondaryIds.has(sc.id)) continue;
        const overlapStart = Math.max(cue.startTime, sc.startTime);
        const overlapEnd = Math.min(cue.endTime, sc.endTime);
        const overlap = Math.max(0, overlapEnd - overlapStart);

        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          bestMatch = sc;
        }
      }

      const cueDuration = Math.max(0.1, cue.endTime - cue.startTime);
      if (bestMatch && (maxOverlap >= 0.2 || maxOverlap / cueDuration >= 0.25)) {
        map.set(cue.id, bestMatch);
        usedSecondaryIds.add(bestMatch.id);
      } else {
        // Fallback: Closest midpoint if within 0.8s
        let closestMatch: SubtitleCue | null = null;
        let minDiff = Infinity;
        const cueMid = (cue.startTime + cue.endTime) / 2;

        for (const sc of secondaryCues) {
          if (usedSecondaryIds.has(sc.id)) continue;
          const scMid = (sc.startTime + sc.endTime) / 2;
          const diff = Math.abs(cueMid - scMid);
          if (diff < 0.8 && diff < minDiff) {
            minDiff = diff;
            closestMatch = sc;
          }
        }

        if (closestMatch) {
          map.set(cue.id, closestMatch);
          usedSecondaryIds.add(closestMatch.id);
        }
      }
    }

    return map;
  }, [showDualSubtitles, activeCues, secondaryCues]);

  // Auto-scroll transcript container only to active cue (isolated from page scroll)
  const scrollToActiveCue = useCallback((instant = false) => {
    if (!transcriptContainerRef.current) return;
    const container = transcriptContainerRef.current;
    const element =
      activeCueRef.current ||
      (container.querySelector('[data-active-cue="true"]') as HTMLElement | null);
    if (!element) return;

    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    if (containerRect.height === 0 || elementRect.height === 0) return;

    // Calculate relative vertical offset inside the subtitles list container only
    const relativeTop = elementRect.top - containerRect.top;
    const targetScrollTop =
      container.scrollTop + relativeTop - container.clientHeight / 2 + element.clientHeight / 2;

    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: instant ? "auto" : "smooth"
    });
  }, []);

  // Continuous playback auto-scroll when current cue changes
  useEffect(() => {
    if (autoScrollTranscript && showTranscriptPanel && sidePanelView === "transcript") {
      scrollToActiveCue(false);
    }
  }, [currentCue, autoScrollTranscript, showTranscriptPanel, sidePanelView, scrollToActiveCue]);

  // Instant centering without animation whenever the transcript panel is opened or made active
  useEffect(() => {
    if (showTranscriptPanel && sidePanelView === "transcript") {
      // Run immediately on render frame and with quick fallback to guarantee container has mounted & measured
      const rafId = requestAnimationFrame(() => {
        scrollToActiveCue(true);
      });
      const timeoutId = window.setTimeout(() => {
        scrollToActiveCue(true);
      }, 40);
      return () => {
        cancelAnimationFrame(rafId);
        window.clearTimeout(timeoutId);
      };
    }
  }, [showTranscriptPanel, sidePanelView, activeTrackId, scrollToActiveCue]);

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
      if (data.track && currentFile) {
        const primaryId = activeTrack?.id || currentFile.subtitles?.[0]?.id || null;
        const secondaryId = data.track.id;
        if (primaryId) setActiveTrackId(primaryId);
        setSecondaryTrackId(secondaryId);
        setShowDualSubtitles(true);
        saveSubtitlePreferences(currentFile.id, primaryId, secondaryId);
        saveSubtitlePreferencesToServer(currentFile.id, primaryId, secondaryId, true);
      }
      setShowTranslateModal(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "حدث خطأ أثناء ترجمة مسار الترجمة بالذكاء الاصطناعي");
    } finally {
      setIsTranslatingTrack(false);
    }
  };

  // Folder Upload Handler (Uploads entire folder with automatic folder creation & assignment)
  const handleFolderUploadSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const validMediaExtensions = [".mp4", ".webm", ".mkv", ".mov", ".avi", ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".m4v", ".3gp"];
    const mediaFiles: File[] = [];
    let detectedFolderName = "";

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const name = file.name.toLowerCase();
      const isMedia = file.type.startsWith("video/") || file.type.startsWith("audio/") || validMediaExtensions.some((ext) => name.endsWith(ext));
      if (isMedia) {
        mediaFiles.push(file);
      }
      if (!detectedFolderName && (file as any).webkitRelativePath) {
        const parts = (file as any).webkitRelativePath.split("/");
        if (parts.length > 1) {
          detectedFolderName = parts[0];
        }
      }
    }

    if (mediaFiles.length === 0) {
      setErrorMsg("لم يتم العثور على ملفات وسائط (فيديو أو صوت) مدعومة داخل المجلد المحدد");
      e.target.value = "";
      return;
    }

    let targetFolderId: string | null = activeFolderId;
    if (detectedFolderName) {
      const existing = folders.find((f) => f.name.trim().toLowerCase() === detectedFolderName.trim().toLowerCase());
      if (existing) {
        targetFolderId = existing.id;
      } else {
        const newFolder: MediaFolder = {
          id: `folder-${Date.now()}`,
          name: detectedFolderName,
          createdAt: new Date().toISOString()
        };
        setFolders((prev) => [...prev, newFolder]);
        fetch("/api/media/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newFolder)
        }).catch((err) => console.error("Error creating folder on server:", err));
        targetFolderId = newFolder.id;
      }
    }

    handleUploadFiles(mediaFiles, targetFolderId, detectedFolderName || undefined);
    e.target.value = "";
  };

  // Upload handler for Media Files (with folder binding & progress labels)
  const handleUploadFiles = (fileList: FileList | File[], targetFolderId?: string | null, customFolderName?: string) => {
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    const validMediaExtensions = [".mp4", ".webm", ".mkv", ".mov", ".avi", ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".m4v", ".3gp"];
    const mediaFiles = filesArray.filter(f => {
      const name = f.name.toLowerCase();
      return f.type.startsWith("video/") || f.type.startsWith("audio/") || validMediaExtensions.some(ext => name.endsWith(ext));
    });

    if (mediaFiles.length === 0) {
      setErrorMsg("يرجى اختيار ملفات فيديو أو صوت مدعومة");
      return;
    }

    const folderToUse = targetFolderId !== undefined ? targetFolderId : activeFolderId;
    const destFolder = folders.find(f => f.id === folderToUse);
    const folderLabel = customFolderName || (destFolder ? destFolder.name : null);

    setUploadingFolderName(folderLabel);
    setUploadingFileName(mediaFiles.length === 1 ? mediaFiles[0].name : `${mediaFiles.length} ملفات`);
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    for (let i = 0; i < mediaFiles.length; i++) {
      formData.append("files", mediaFiles[i]);
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
      setUploadingFolderName(null);
      setUploadingFileName(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          setSuccessMsg(res.message || "تم رفع الملفات بنجاح! 📁");
          fetchMediaFiles();
          if (res.files && res.files.length > 0) {
            if (folderToUse) {
              setFileFolderMap((prev) => {
                const next = { ...prev };
                res.files.forEach((f: MediaFile) => {
                  next[f.id] = folderToUse;
                });
                return next;
              });

              // Persist mapping to server
              const fileIds = res.files.map((f: any) => f.id);
              fetch("/api/media/folders/move-files", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileIds, targetFolderId: folderToUse })
              }).catch((err) => console.error("Error moving files to folder on server:", err));
            }
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
      setUploadingFolderName(null);
      setUploadingFileName(null);
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

      const defaultLabel = formatSubtitleTrackProtocol("UPL", "de");
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

    const label = subtitleTrackLabel.trim() || formatSubtitleTrackProtocol("UPL", "de");
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
        const fallbackLabel = formatSubtitleTrackProtocol(source || "uploaded", "de");
        const dummyTrack: MediaSubtitleTrack = {
          id: trackId || `sub-${Date.now()}`,
          label: label || fallbackLabel,
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
  const handleDeleteCue = (cueId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentFile || !activeTrack) return;

    const updatedCues = activeTrack.cues.filter((c) => c.id !== cueId);
    saveSubtitleTrackToServer(currentFile.id, activeTrack.label, updatedCues, "manual", activeTrack.id);
  };

  // Delete single cue with confirmation
  const handleConfirmDeleteCue = (cueId: string) => {
    if (!currentFile || !activeTrack) return;
    const updatedCues = activeTrack.cues.filter((c) => c.id !== cueId);
    saveSubtitleTrackToServer(currentFile.id, activeTrack.label, updatedCues, "manual", activeTrack.id);
    triggerHud("تم حذف الجملة بنجاح", "🗑️");
    setSuccessMsg("تم حذف الجملة بنجاح 🗑️");
  };

  // Copy cue text to clipboard
  const handleCopyCueText = (cue: SubtitleCue) => {
    const matchingSec = secondaryCueMap.get(cue.id);
    const textToCopy = showDualSubtitles && matchingSec 
      ? `${cue.text}\n${matchingSec.text}`
      : cue.text;
    navigator.clipboard.writeText(textToCopy).then(() => {
      triggerHud("تم نسخ الجملة", "📋");
      setSuccessMsg("تم نسخ نص الجملة بنجاح 📋");
    }).catch(() => {
      triggerHud("تم نسخ الجملة", "📋");
    });
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
  // High-Fidelity Studio Audio Engine & Playback Controls
  // ---------------------------------------------------------
  const syncAudioGain = useCallback((targetVol: number, targetMute: boolean, clarifierActive: boolean) => {
    const el = getMediaElement();
    if (!el) return;

    const effectiveGain = targetMute ? 0 : targetVol; // Can be 0 to 3.0 (0% to 300%)

    // Only engage Web Audio Graph if super volume booster (>100%) or voice clarifier is active
    if (effectiveGain > 1.0 || clarifierActive) {
      const graph = getOrCreateAudioGraph(el);
      if (graph && graph.ctx.state !== "closed") {
        if (graph.ctx.state === "suspended") {
          graph.ctx.resume().catch(() => {});
        }
        // When Web Audio Graph is active, native volume is set to 1.0, and GainNode handles 0.0 to 3.0x
        el.volume = 1.0;
        el.muted = false;

        const now = graph.ctx.currentTime;
        graph.gainNode.gain.cancelScheduledValues(now);
        graph.gainNode.gain.linearRampToValueAtTime(Math.max(0.0001, effectiveGain), now + 0.03);

        // Speech clarifier EQ boost (+6.5dB at speech intelligibility center)
        graph.speechFilter.gain.setValueAtTime(clarifierActive ? 6.5 : 0.0, now);
        return;
      }
    }

    // Direct native fallback - 100% stable, zero CORS restriction, hardware-accelerated
    el.muted = targetMute;
    el.volume = Math.min(1, Math.max(0, targetMute ? 0 : targetVol > 1 ? 1 : targetVol));
  }, [currentFile]);

  const smoothPause = useCallback((onPaused?: () => void) => {
    const el = getMediaElement();
    if (!el) return;
    el.pause();
    setIsPlaying(false);
    if (onPaused) onPaused();
  }, [currentFile]);

  const smoothPlay = useCallback(() => {
    const el = getMediaElement();
    if (!el) return;

    syncAudioGain(volume, isMuted, voiceClarifier);

    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("Playback interrupted or prevented:", err);
        });
    }
  }, [currentFile, isMuted, volume, voiceClarifier, syncAudioGain]);

  const togglePlay = useCallback(() => {
    const el = getMediaElement();
    if (!el) return;
    if (!el.paused) {
      smoothPause();
    } else {
      smoothPlay();
    }
  }, [smoothPause, smoothPlay, currentFile]);

  // Instant Seeking Engine for Sentences & Timeline
  const handleSeek = useCallback((newTime: number) => {
    const el = getMediaElement();
    if (!el) return;
    const totalDuration = duration || el.duration || 0;
    const boundedTime = Math.max(0, Math.min(newTime, totalDuration > 0 ? totalDuration : Infinity));

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
  }, [duration, currentFile]);

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

    // Immediately pause during scrubbing
    if (el && isCurrentlyPlaying) {
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
    syncAudioGain(volume, nextMute, voiceClarifier);
    triggerHud(nextMute ? "كتم الصوت" : "إلغاء الكتم", "M");
  }, [isMuted, volume, voiceClarifier, syncAudioGain, triggerHud]);

  const handleVolumeChange = useCallback((newVol: number) => {
    // Supports volume up to 3.0 (300% Super Booster)
    const clampedVol = Math.max(0, Math.min(3.0, newVol));
    setVolume(clampedVol);
    const nextMute = clampedVol === 0;
    setIsMuted(nextMute);
    try {
      localStorage.setItem("media_player_volume", clampedVol.toString());
      localStorage.setItem("media_player_is_muted", JSON.stringify(nextMute));
    } catch (e) {
      console.error(e);
    }

    syncAudioGain(clampedVol, nextMute, voiceClarifier);

    if (clampedVol > 2.0) {
      triggerHud(`تضخيم فائق: ${Math.round(clampedVol * 100)}% 🚀`, "MAX");
    } else if (clampedVol > 1.0) {
      triggerHud(`مضخم الصوت: ${Math.round(clampedVol * 100)}% ⚡`, "BOOST");
    }
  }, [voiceClarifier, syncAudioGain, triggerHud]);

  const toggleVoiceClarifier = useCallback(() => {
    const next = !voiceClarifier;
    setVoiceClarifier(next);
    try {
      localStorage.setItem("media_player_voice_clarifier", JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }
    syncAudioGain(volume, isMuted, next);
    triggerHud(next ? "تفعيل توضيح مخارج الحروف 🎙️" : "تعطيل توضيح الكلام", "EQ");
  }, [voiceClarifier, volume, isMuted, syncAudioGain, triggerHud]);

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

  // Reset / start the 5-second fullscreen controls auto-hide timer
  const resetFullscreenControlsTimer = useCallback(() => {
    if (fullscreenControlsTimeoutRef.current) {
      window.clearTimeout(fullscreenControlsTimeoutRef.current);
      fullscreenControlsTimeoutRef.current = null;
    }
    if (!isFullscreen || !showFullscreenControls || isScrubbing) {
      return;
    }
    fullscreenControlsTimeoutRef.current = window.setTimeout(() => {
      setShowFullscreenControls(false);
      fullscreenControlsTimeoutRef.current = null;
    }, 5000);
  }, [isFullscreen, showFullscreenControls, isScrubbing]);

  // Sync fullscreen state
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      setShowFullscreenControls(false);
      if (fullscreenControlsTimeoutRef.current) {
        window.clearTimeout(fullscreenControlsTimeoutRef.current);
        fullscreenControlsTimeoutRef.current = null;
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  // 5-second inactivity auto-hide timer for timeline & controls bar in fullscreen mode
  useEffect(() => {
    if (isFullscreen && showFullscreenControls && !isScrubbing) {
      resetFullscreenControlsTimer();
    } else {
      if (fullscreenControlsTimeoutRef.current) {
        window.clearTimeout(fullscreenControlsTimeoutRef.current);
        fullscreenControlsTimeoutRef.current = null;
      }
    }
    return () => {
      if (fullscreenControlsTimeoutRef.current) {
        window.clearTimeout(fullscreenControlsTimeoutRef.current);
        fullscreenControlsTimeoutRef.current = null;
      }
    };
  }, [isFullscreen, showFullscreenControls, isScrubbing, resetFullscreenControlsTimer]);

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

  const activeFolder = useMemo(() => {
    if (!activeFolderId) return null;
    return folders.find((f) => f.id === activeFolderId) || null;
  }, [folders, activeFolderId]);

  // Filtered files for File Manager & Library view
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      // Filter by active folder if inside a folder
      if (activeFolderId) {
        if (fileFolderMap[f.id] !== activeFolderId) return false;
      }

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
  }, [files, activeFolderId, fileFolderMap, filterType, searchQuery]);

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
    syncAudioGain(volume, isMuted, voiceClarifier);

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
      syncAudioGain(volume, isMuted, voiceClarifier);
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
  }, [currentFile, playbackRate, isLooping, volume, isMuted, voiceClarifier, isPlaying, duration, smoothPause, syncAudioGain]);

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
        if (isFullscreen) {
          handleToggleFullscreen();
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
    const file = currentFileRef.current;
    const availableSubtitles = file?.subtitles || [];

    const currentOverlay = showSubtitlesOverlayRef.current;
    const currentDual = showDualSubtitlesRef.current;
    const currentActiveId = activeTrackIdRef.current;
    const currentSecId = secondaryTrackIdRef.current;

    // Trigger instant visual sample preview so user immediately sees subtitle position and design
    triggerSubtitlePreview(3200);

    if (availableSubtitles.length === 0) {
      showSubtitlesOverlayRef.current = true;
      setShowSubtitlesOverlay(true);
      triggerVisualFeedback({
        type: "swipe_up_sub1",
        side: "center",
        label: "معاينة نص تجريبي",
        subLabel: "سحب للأعلى: عرض نموذج تجريبي للترجمة"
      });
      triggerHud("عرض نص تجريبي للترجمة 🎬", "سحب ⬆️");
      return;
    }

    // Subtitle Visibility State Machine:
    // State 0: All Hidden (showSubtitlesOverlay === false)
    // State 1: Primary Subtitle 1 Visible (showSubtitlesOverlay === true && showDualSubtitles === false)
    // State 2: Both Subtitles 1 & 2 Visible (showSubtitlesOverlay === true && showDualSubtitles === true)

    if (!currentOverlay) {
      // 1st Swipe UP -> Reveal Primary Subtitle 1 ONLY
      let targetPrimaryId = currentActiveId;
      const hasValidPrimary = Boolean(targetPrimaryId && availableSubtitles.some((t) => t.id === targetPrimaryId));
      if (!hasValidPrimary) {
        const savedPrefs = file ? getSavedSubtitlePreferences(file.id) : { primaryId: null, secondaryId: null };
        if (file?.primaryTrackId && availableSubtitles.some((t) => t.id === file.primaryTrackId)) {
          targetPrimaryId = file.primaryTrackId;
        } else if (savedPrefs.primaryId && availableSubtitles.some((t) => t.id === savedPrefs.primaryId)) {
          targetPrimaryId = savedPrefs.primaryId;
        } else {
          const germanOrOriginal = availableSubtitles.find(
            (t) => t.language === "de" || t.source === "uploaded" || t.source === "manual"
          );
          targetPrimaryId = germanOrOriginal ? germanOrOriginal.id : availableSubtitles[0].id;
        }
      }

      showSubtitlesOverlayRef.current = true;
      showDualSubtitlesRef.current = false;
      activeTrackIdRef.current = targetPrimaryId;

      setActiveTrackId(targetPrimaryId);
      setShowSubtitlesOverlay(true);
      setShowDualSubtitles(false);

      try {
        localStorage.setItem("media_player_show_subtitles_overlay", JSON.stringify(true));
        localStorage.setItem("media_player_show_dual_subtitles", JSON.stringify(false));
      } catch (e) {
        console.error(e);
      }

      if (file && targetPrimaryId) {
        saveSubtitlePreferences(file.id, targetPrimaryId, currentSecId);
        saveSubtitlePreferencesToServer(file.id, targetPrimaryId, currentSecId, false);
        setCurrentFile((prev) => prev ? { ...prev, primaryTrackId: targetPrimaryId, showDualSubtitles: false } : null);
        setFiles((prev) => prev.map((f) => f.id === file.id ? { ...f, primaryTrackId: targetPrimaryId, showDualSubtitles: false } : f));
      }

      const primTrack = availableSubtitles.find((t) => t.id === targetPrimaryId);
      const primLabel = primTrack?.label || "الترجمة الأولى";

      triggerVisualFeedback({
        type: "swipe_up_sub1",
        side: "center",
        label: "إظهار الترجمة الأولى",
        subLabel: `سحب للأعلى: تفعيل (${primLabel})`
      });
      triggerHud(`إظهار الترجمة الأولى (${primLabel})`, "سحب ⬆️");
    } else if (!currentDual) {
      // 2nd Swipe UP -> Reveal Secondary / Dual Subtitle 2
      if (availableSubtitles.length <= 1) {
        triggerHud("يوجد مسار ترجمة واحد فقط متاح", "ℹ️");
        return;
      }

      let targetSecId = currentSecId;
      const isSecValid = Boolean(targetSecId && targetSecId !== currentActiveId && availableSubtitles.some((t) => t.id === targetSecId));
      if (!isSecValid) {
        const savedPrefs = file ? getSavedSubtitlePreferences(file.id) : { primaryId: null, secondaryId: null };
        if (file?.secondaryTrackId && file.secondaryTrackId !== currentActiveId && availableSubtitles.some((t) => t.id === file.secondaryTrackId)) {
          targetSecId = file.secondaryTrackId;
        } else if (savedPrefs.secondaryId && savedPrefs.secondaryId !== currentActiveId && availableSubtitles.some((t) => t.id === savedPrefs.secondaryId)) {
          targetSecId = savedPrefs.secondaryId;
        } else {
          const arabicOrOther = availableSubtitles.find(
            (t) => t.id !== currentActiveId && (t.language === "ar" || t.source === "ai" || t.label.includes("عربي") || t.label.includes("🇸🇦"))
          ) || availableSubtitles.find((t) => t.id !== currentActiveId);
          targetSecId = arabicOrOther ? arabicOrOther.id : null;
        }
      }

      showSubtitlesOverlayRef.current = true;
      showDualSubtitlesRef.current = true;
      if (targetSecId) {
        secondaryTrackIdRef.current = targetSecId;
        setSecondaryTrackId(targetSecId);
      }
      setShowDualSubtitles(true);

      try {
        localStorage.setItem("media_player_show_subtitles_overlay", JSON.stringify(true));
        localStorage.setItem("media_player_show_dual_subtitles", JSON.stringify(true));
      } catch (e) {
        console.error(e);
      }

      if (file) {
        saveSubtitlePreferences(file.id, currentActiveId, targetSecId);
        saveSubtitlePreferencesToServer(file.id, currentActiveId, targetSecId, true);
        setCurrentFile((prev) => prev ? { ...prev, secondaryTrackId: targetSecId || undefined, showDualSubtitles: true } : null);
        setFiles((prev) => prev.map((f) => f.id === file.id ? { ...f, secondaryTrackId: targetSecId || undefined, showDualSubtitles: true } : f));
      }

      const secTrack = availableSubtitles.find((t) => t.id === targetSecId);
      const secLabel = secTrack?.label || "الترجمة الثانية";

      triggerVisualFeedback({
        type: "swipe_up_sub2",
        side: "center",
        label: "إظهار الترجمة المزدوجة",
        subLabel: `سحب للأعلى: تفعيل (+ ${secLabel})`
      });
      triggerHud(`إظهار الترجمة المزدوجة (+ ${secLabel})`, "سحب ⬆️");
    } else {
      triggerHud("كلا الترجمتين مفعّلتان بالفعل", "💬💬");
    }
  }, [
    triggerSubtitlePreview,
    triggerVisualFeedback,
    triggerHud
  ]);

  const handleCenterSwipeDown = useCallback(() => {
    const file = currentFileRef.current;
    const availableSubtitles = file?.subtitles || [];

    const currentOverlay = showSubtitlesOverlayRef.current;
    const currentDual = showDualSubtitlesRef.current;
    const currentActiveId = activeTrackIdRef.current;
    const currentSecId = secondaryTrackIdRef.current;

    if (availableSubtitles.length === 0 && currentOverlay) {
      showSubtitlesOverlayRef.current = false;
      showDualSubtitlesRef.current = false;
      setShowSubtitlesOverlay(false);
      setShowDualSubtitles(false);
      if (swipeSubtitlePreviewTimerRef.current) {
        window.clearTimeout(swipeSubtitlePreviewTimerRef.current);
      }
      setShowSwipeSubtitlePreview(false);
      triggerVisualFeedback({
        type: "swipe_down_all",
        side: "center",
        label: "إخفاء النص التجريبي",
        subLabel: "سحب للأسفل: إخفاء المعاينة"
      });
      triggerHud("إخفاء النص التجريبي", "سحب ⬇️");
      return;
    }

    if (availableSubtitles.length === 0) {
      triggerHud("لا توجد مسارات ترجمة", "⚠️");
      return;
    }

    if (currentOverlay && currentDual) {
      // 1st Swipe DOWN -> Hide Subtitle 2, keep Subtitle 1 active
      showDualSubtitlesRef.current = false;
      setShowDualSubtitles(false);
      triggerSubtitlePreview(3200);

      try {
        localStorage.setItem("media_player_show_dual_subtitles", JSON.stringify(false));
      } catch (e) {
        console.error(e);
      }

      if (file) {
        saveSubtitlePreferencesToServer(file.id, currentActiveId, currentSecId, false);
        setCurrentFile((cf) => cf ? { ...cf, showDualSubtitles: false } : null);
        setFiles((prev) => prev.map((f) => f.id === file.id ? { ...f, showDualSubtitles: false } : f));
      }

      triggerVisualFeedback({
        type: "swipe_down_sub2",
        side: "center",
        label: "إخفاء الترجمة الثانية",
        subLabel: "سحب للأسفل: الإبقاء على الترجمة الأولى فقط"
      });
      triggerHud("إخفاء الترجمة الثانية (الاحتفاظ بالأولى)", "سحب ⬇️");
    } else if (currentOverlay) {
      // 2nd Swipe DOWN -> Hide Subtitle 1 (All subtitles hidden)
      showSubtitlesOverlayRef.current = false;
      showDualSubtitlesRef.current = false;
      setShowSubtitlesOverlay(false);
      setShowDualSubtitles(false);

      if (swipeSubtitlePreviewTimerRef.current) {
        window.clearTimeout(swipeSubtitlePreviewTimerRef.current);
      }
      setShowSwipeSubtitlePreview(false);

      try {
        localStorage.setItem("media_player_show_subtitles_overlay", JSON.stringify(false));
        localStorage.setItem("media_player_show_dual_subtitles", JSON.stringify(false));
      } catch (e) {
        console.error(e);
      }

      if (file) {
        saveSubtitlePreferencesToServer(file.id, currentActiveId, currentSecId, false);
        setCurrentFile((cf) => cf ? { ...cf, showDualSubtitles: false } : null);
        setFiles((prev) => prev.map((f) => f.id === file.id ? { ...f, showDualSubtitles: false } : f));
      }

      triggerVisualFeedback({
        type: "swipe_down_all",
        side: "center",
        label: "إخفاء الترجمة بالكامل",
        subLabel: "سحب للأسفل: إخفاء جميع الترجمات"
      });
      triggerHud("إخفاء جميع الترجمات", "سحب ⬇️");
    } else {
      triggerHud("الترجمة مخفية بالفعل", "🚫");
    }
  }, [
    triggerSubtitlePreview,
    triggerVisualFeedback,
    triggerHud
  ]);

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
    triggerSamsungVolumeBar();
    triggerVisualFeedback({
      type: "volume_up",
      side: "right",
      label: `مستوى الصوت: ${Math.round(nextVol * 100)}%`,
      subLabel: nextVol > 1.0 ? "⚡ تعزيز الصوت الفائق" : "سحب للأعلى: رفع الصوت"
    });
  }, [volume, handleVolumeChange, triggerVisualFeedback, triggerSamsungVolumeBar]);

  const handleRightSwipeDown = useCallback(() => {
    const nextVol = Math.max(0, Math.round((volume - 0.10) * 100) / 100);
    handleVolumeChange(nextVol);
    triggerSamsungVolumeBar();
    triggerVisualFeedback({
      type: "volume_down",
      side: "right",
      label: `مستوى الصوت: ${Math.round(nextVol * 100)}%`,
      subLabel: nextVol === 0 ? "كتم الصوت" : "سحب للأسفل: خفض الصوت"
    });
  }, [volume, handleVolumeChange, triggerVisualFeedback, triggerSamsungVolumeBar]);

  const handleStageTap = useCallback(
    (xRatio: number) => {
      // 60% Center Zone (0.20 to 0.80), 20% Left (< 0.20), 20% Right (> 0.80)
      const side: "left" | "right" | "center" =
        xRatio < 0.20 ? "left" : xRatio > 0.80 ? "right" : "center";
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
          // Center 60% Double Tap: Play / Pause
          const el = getMediaElement();
          const willPlay = el ? el.paused : !isPlaying;
          togglePlay();
          triggerVisualFeedback({
            type: willPlay ? "play" : "pause",
            side: "center",
            label: willPlay ? "تشغيل" : "إيقاف مؤقت"
          });
        } else if (side === "right") {
          // Right 20% Double Tap: Skip Forward 5s (+5s)
          skipSeconds(5);
          triggerVisualFeedback({
            type: "seek_forward_5s",
            side: "right",
            label: "+5 ثواني",
            subLabel: "تقديم 5 ثواني"
          });
        } else if (side === "left") {
          // Left 20% Double Tap: Rewind 5s (-5s)
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
      target.closest("[data-ignore-stage-click]") ||
      target.closest("[data-interactive-control]")
    ) {
      return;
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
      isPotentialSwipe: true
    };
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}

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

    // Vertical Swipe Detection: Drag >= 25px, predominantly vertical, under 1000ms
    if (absDeltaY >= 25 && absDeltaY > absDeltaX * 0.7 && duration < 1000) {
      if (tapTrackerRef.current?.timer) {
        window.clearTimeout(tapTrackerRef.current.timer);
        tapTrackerRef.current = null;
      }

      if (startXRatio < 0.15) {
        // LEFT ZONE SWIPE (Sentence Navigation - Left 15% edge)
        if (deltaY > 0) {
          handleLeftSwipeUp(); // Next sentence
        } else {
          handleLeftSwipeDown(); // Prev sentence
        }
      } else if (startXRatio > 0.85) {
        // RIGHT ZONE SWIPE (Volume Control - Right 15% edge)
        if (deltaY > 0) {
          handleRightSwipeUp(); // Volume Up
        } else {
          handleRightSwipeDown(); // Volume Down
        }
      } else {
        // CENTER ZONE SWIPE (Subtitles - Wide 70% Center Area)
        if (deltaY > 0) {
          handleCenterSwipeUp();
        } else {
          handleCenterSwipeDown();
        }
      }
      return;
    }

    // Tap Detection: Minimal movement (< 20px)
    if (absDeltaX < 20 && absDeltaY < 20) {
      const xRatio = (endX - rect.left) / rect.width;
      handleStageTap(xRatio);
    }
  };

  const handleStagePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}
    pointerStartRef.current = null;
  };

  // Advanced Real-time Subtitle Style Computation Engine
  const getSubtitleTrackComputedStyle = useCallback((config: SubtitleTrackStyleConfig, isImmersive: boolean, text?: string): React.CSSProperties => {
    return computeSubtitleCSS(config, isImmersive, 1, text);
  }, []);

  const getSubtitlePositionStyle = useCallback((position: "bottom" | "top" | "center", offsetY: number): React.CSSProperties => {
    if (position === "top") {
      const extraTop = isFullscreen && showFullscreenControls ? 56 : 0;
      return {
        top: `${offsetY + extraTop}px`,
        bottom: "auto",
        transform: "none",
        transition: "top 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease"
      };
    }
    if (position === "center") {
      return {
        top: "50%",
        bottom: "auto",
        transform: "translateY(-50%)",
        transition: "top 0.3s ease, transform 0.3s ease"
      };
    }
    // Consistent bottom positioning across standard, immersive, and fullscreen modes
    // In Fullscreen mode: when controls bar (scrubber & playback controls) is visible,
    // dynamically offset the subtitle by the exact total height and bottom margin of the controls box.
    // This guarantees that if offsetY is 0px, the subtitle sits exactly 0px directly above the controls box (never hidden behind it).
    const isSmallScreen = typeof window !== "undefined" ? window.innerWidth < 640 : false;
    const controlsBottomMargin = isSmallScreen ? 12 : 24; // matches bottom-3 (12px) vs sm:bottom-6 (24px)
    const measuredHeight = controlsBarHeight > 0 ? controlsBarHeight : 108;
    const fullscreenControlsClearance = measuredHeight + controlsBottomMargin + 2;

    const extraBottom = isFullscreen && showFullscreenControls ? fullscreenControlsClearance : 0;
    return {
      bottom: `${offsetY + extraBottom}px`,
      top: "auto",
      transform: "none",
      transition: "bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease"
    };
  }, [isFullscreen, showFullscreenControls, controlsBarHeight]);

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
        ref={folderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: "", directory: "" } as any)}
        className="hidden"
        onChange={handleFolderUploadSelect}
      />

      <input
        ref={subtitleFileInputRef}
        type="file"
        accept=".srt,.vtt,.txt,.sbv,.sub"
        className="hidden"
        onChange={handleSubtitleFileSelect}
      />

      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs shrink-0">
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

          {isPlayerOpen && currentFile ? (
            /* Player Mode Header Title & Back to Manager */
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleBackToFileManager}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                title="العودة لمدير الملفات والمجلدات"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>مدير الملفات والمجلدات 📁</span>
              </button>

              <div className="hidden sm:flex items-center border-r border-slate-200 pr-3 mr-1">
                <h1 className="text-xs sm:text-sm font-black text-slate-900 truncate max-w-[200px] md:max-w-xs">
                  {currentFile.title}
                </h1>
              </div>
            </div>
          ) : (
            /* File Manager Mode Header Title */
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                <Folder className="w-4 h-4" />
              </div>
              <h1 className="text-sm sm:text-base font-black text-slate-900">
                مدير الملفات
              </h1>
            </div>
          )}
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {isPlayerOpen && currentFile ? (
            /* Actions in Player Mode: Clean and focused on active media */
            <>
              {/* Side Panel (Transcript / Subtitles) Toggle */}
              <button
                onClick={() => {
                  setShowTranscriptPanel(!showTranscriptPanel);
                  if (!showTranscriptPanel) setSidePanelView("transcript");
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium text-xs transition-colors cursor-pointer border ${
                  showTranscriptPanel
                    ? "bg-blue-50 text-blue-700 border-blue-300 shadow-2xs"
                    : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
                title={showTranscriptPanel ? "إخفاء لوحة الجمل والترجمة" : "إظهار لوحة الجمل والترجمة"}
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>لوحة الجمل</span>
              </button>
            </>
          ) : (
            /* Actions in File Manager Mode: Clean stats summary (Actions live in Explorer Command Bar) */
            <div className="flex items-center gap-2">
              {/* Stats pill */}
              <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-100/90 rounded-xl text-[11px] font-semibold text-slate-600 border border-slate-200/80">
                <div className="flex items-center gap-1">
                  <Film className="w-3.5 h-3.5 text-blue-600" />
                  <span>{totalVideos} فيديو</span>
                </div>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1">
                  <Music className="w-3.5 h-3.5 text-violet-600" />
                  <span>{totalAudios} صوتيات</span>
                </div>
                <span className="text-slate-300 hidden sm:inline">|</span>
                <div className="hidden sm:flex items-center gap-1">
                  <Folder className="w-3.5 h-3.5 text-amber-500" />
                  <span>{folders.length} مجلد</span>
                </div>
                <span className="text-slate-300 hidden md:inline">|</span>
                <div className="hidden md:flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                  <span>{formatFileSize(totalSize)}</span>
                </div>
              </div>

              {/* Quick Refresh */}
              <button
                onClick={fetchMediaFiles}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="تحديث قائمة الملفات"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-5">
        {/* Real-time Upload Progress Banner when Player is active */}
        {uploading && currentFile && (
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-2xl p-3.5 shadow-lg border border-blue-400/30 animate-fadeIn">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-xs sm:text-sm">
                      {uploadingFolderName ? `جاري رفع مجلد "${uploadingFolderName}"...` : "جاري رفع ملفات الوسائط..."}
                    </span>
                    <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      {uploadProgress}%
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-100 truncate mt-0.5">
                    {uploadingFileName && `الملف: ${uploadingFileName} • `}
                    {uploadingFolderName
                      ? `المجلد المستهدف: 📁 ${uploadingFolderName}`
                      : activeFolderId && folders.find(f => f.id === activeFolderId)
                      ? `المجلد المستهدف: 📁 ${folders.find(f => f.id === activeFolderId)?.name}`
                      : "المجلد المستهدف: 📁 المجلد الرئيسي"}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-black text-white/95">{uploadProgress}%</span>
              </div>
            </div>
            <div className="w-full h-2 bg-black/25 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full transition-all duration-300 shadow-xs"
                style={{ width: `${Math.max(6, uploadProgress)}%` }}
              />
            </div>
          </div>
        )}
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
        {isPlayerOpen && currentFile ? (
          <section
            ref={playerSectionRef}
            className={
              isFullscreen
                ? "fixed inset-0 z-50 bg-black flex flex-col h-screen w-screen p-0 m-0 overflow-hidden text-white select-none"
                : isImmersiveMode
                ? "fixed inset-0 z-50 bg-slate-950 flex flex-col h-screen w-screen p-2 sm:p-3 overflow-hidden text-white animate-fadeIn"
                : "bg-slate-900 rounded-xl p-2 sm:p-2.5 text-white shadow-2xl border border-slate-800 overflow-hidden"
            }
          >
            {/* Split Grid / Flex: Player View + Transcript Panel (Zero excessive gap) */}
            <div
              className={
                isFullscreen
                  ? "flex-1 w-full h-full relative overflow-hidden"
                  : isImmersiveMode
                  ? "flex-1 flex flex-col md:flex-row landscape:flex-row overflow-hidden gap-2 min-h-0 relative"
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
                  onPointerDown={(e) => {
                    if (isFullscreen && showFullscreenControls) resetFullscreenControlsTimer();
                    handleStagePointerDown(e);
                  }}
                  onPointerUp={handleStagePointerUp}
                  onPointerCancel={handleStagePointerCancel}
                  onMouseMove={() => {
                    if (isFullscreen && showFullscreenControls) resetFullscreenControlsTimer();
                  }}
                  onTouchStart={() => {
                    if (isFullscreen && showFullscreenControls) resetFullscreenControlsTimer();
                  }}
                  className={
                    isFullscreen
                      ? "flex-1 relative bg-black overflow-hidden flex items-center justify-center min-h-0 w-full h-full cursor-pointer select-none touch-none"
                      : isImmersiveMode
                      ? "flex-1 relative rounded-lg bg-black overflow-hidden flex items-center justify-center min-h-0 group border border-slate-800/80 shadow-2xl cursor-pointer select-none touch-none"
                      : "relative rounded-lg bg-black overflow-hidden flex items-center justify-center min-h-[260px] sm:min-h-[380px] group border border-slate-800 shadow-inner cursor-pointer select-none touch-none"
                  }
                >
                  {/* Sleek Floating Top Header (Fullscreen & Immersive Mode) */}
                  {(isImmersiveMode || isFullscreen) && (
                    <div
                      className={`absolute top-0 inset-x-0 z-40 bg-gradient-to-b from-black/85 via-slate-950/60 to-transparent p-2.5 sm:p-3.5 flex items-center justify-between text-white transition-all duration-300 pointer-events-auto select-none ${
                        isFullscreen
                          ? showFullscreenControls
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 -translate-y-6 pointer-events-none"
                          : "opacity-100 translate-y-0"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isFullscreen && showFullscreenControls) resetFullscreenControlsTimer();
                      }}
                      onMouseMove={() => {
                        if (isFullscreen && showFullscreenControls) resetFullscreenControlsTimer();
                      }}
                      onTouchStart={() => {
                        if (isFullscreen && showFullscreenControls) resetFullscreenControlsTimer();
                      }}
                    >
                      {/* Left: Back to files + Media Title */}
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={handleBackToFileManager}
                          className="w-8 h-8 rounded-full bg-black/60 hover:bg-white/20 active:scale-95 border border-white/20 flex items-center justify-center text-white transition-all cursor-pointer shrink-0 shadow-md"
                          title="الرجوع لمدير الملفات"
                        >
                          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                        </button>

                        <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-[160px] xs:max-w-[220px] sm:max-w-md">
                          {currentFile.title || currentFile.originalName}
                        </h2>
                      </div>

                      {/* Right: Clean Action Controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Sentences / Transcript Toggle Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowTranscriptPanel(!showTranscriptPanel);
                            if (!showTranscriptPanel) setSidePanelView("transcript");
                          }}
                          className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border-0 outline-none ${
                            showTranscriptPanel && sidePanelView === "transcript"
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-black/50 text-slate-300 hover:text-white hover:bg-black/75 backdrop-blur-md"
                          }`}
                          title={showTranscriptPanel ? "إخفاء لوحة الجمل" : "إظهار لوحة الجمل"}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">الجمل</span>
                        </button>

                        {/* Fullscreen Toggle (Video only) */}
                        {currentFile.type === "video" && (
                          <button
                            type="button"
                            onClick={handleToggleFullscreen}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center border-0 outline-none ${
                              isFullscreen
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-black/50 text-slate-300 hover:text-white hover:bg-black/75 backdrop-blur-md"
                            }`}
                            title={isFullscreen ? "الخروج من ملء الشاشة (F / Esc)" : "ملء الشاشة بالكامل (F)"}
                          >
                            {isFullscreen ? (
                              <Minimize2 className="w-3.5 h-3.5" />
                            ) : (
                              <Maximize2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {/* Symbolic Options Button (⋮) & Unified Smart Menu */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowTopOptionsMenu(!showTopOptionsMenu);
                            }}
                            className={`w-7 h-7 rounded-lg transition-all cursor-pointer flex items-center justify-center border-0 outline-none ${
                              showTopOptionsMenu
                                ? "bg-blue-600 text-white shadow-xs"
                                : "bg-black/50 text-slate-300 hover:text-white hover:bg-black/75 backdrop-blur-md"
                            }`}
                            title="خيارات"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Top Options Dropdown Menu (Smart, Borderless) */}
                          {showTopOptionsMenu && (
                            <div
                              ref={topOptionsMenuRef}
                              className="absolute left-0 top-full mt-2 z-50 min-w-[200px] bg-slate-900/98 backdrop-blur-md rounded-2xl p-1.5 shadow-2xl animate-scaleUp text-right border-0 shadow-black/80 ring-1 ring-white/10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* 1. Toggle Subtitles / تفعيل الترجمة */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSubtitlesOverlay();
                                }}
                                className="w-full px-3 py-2 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-between cursor-pointer border-0"
                              >
                                <div className="flex items-center gap-2">
                                  <Subtitles className={`w-4 h-4 ${showSubtitlesOverlay ? "text-indigo-400" : "text-slate-400"}`} />
                                  <span>تفعيل الترجمة</span>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  showSubtitlesOverlay ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"
                                }`}>
                                  {showSubtitlesOverlay ? "مفعّلة" : "معطّلة"}
                                </span>
                              </button>

                              {/* 2. Subtitle Tracks / المسارات */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowTranscriptPanel(true);
                                  setSidePanelView("subtitles");
                                  setShowTopOptionsMenu(false);
                                }}
                                className="w-full px-3 py-2 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-between cursor-pointer border-0"
                              >
                                <div className="flex items-center gap-2">
                                  <Languages className="w-4 h-4 text-blue-400" />
                                  <span>المسارات</span>
                                </div>
                                {activeTrack && (
                                  <span className="text-[10px] text-blue-300/80 max-w-[80px] truncate">
                                    {activeTrack.label}
                                  </span>
                                )}
                              </button>

                              {/* 3. Subtitle Design / التصميم */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowTranscriptPanel(true);
                                  setSidePanelView("style");
                                  setShowTopOptionsMenu(false);
                                }}
                                className="w-full px-3 py-2 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer border-0"
                              >
                                <Palette className="w-4 h-4 text-amber-400" />
                                <span>التصميم</span>
                              </button>

                              <div className="my-1 border-t border-slate-800/80" />

                              {/* 4. Upload Subtitle / رفع ترجمة */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowSubtitleUploadModal(true);
                                  setShowTopOptionsMenu(false);
                                }}
                                className="w-full px-3 py-2 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer border-0"
                              >
                                <Upload className="w-4 h-4 text-indigo-400" />
                                <span>رفع ترجمة (SRT/VTT)</span>
                              </button>

                              {/* 5. Gemini AI Translation */}
                              {activeTrack && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowTranslateModal(true);
                                    setShowTopOptionsMenu(false);
                                  }}
                                  className="w-full px-3 py-2 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer border-0"
                                >
                                  <Sparkles className="w-4 h-4 text-purple-400" />
                                  <span>ترجمة بالذكاء الاصطناعي</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
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

                  {/* Studio-Grade Samsung-Style Floating Volume & Audio Booster HUD */}
                  {showSamsungVolumeBar && (
                    <div
                      dir="ltr"
                      className="absolute top-4 sm:top-6 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-40 max-w-[340px] sm:max-w-sm w-auto pointer-events-auto transition-all duration-200 ease-out"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (samsungVolumeTimerRef.current) window.clearTimeout(samsungVolumeTimerRef.current);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        if (samsungVolumeTimerRef.current) window.clearTimeout(samsungVolumeTimerRef.current);
                      }}
                      onMouseEnter={() => {
                        if (samsungVolumeTimerRef.current) window.clearTimeout(samsungVolumeTimerRef.current);
                      }}
                      onMouseLeave={() => {
                        triggerSamsungVolumeBar();
                      }}
                    >
                      <div className="bg-slate-950/95 backdrop-blur-2xl border border-white/20 rounded-2xl p-3 shadow-2xl flex flex-col gap-2.5 text-white">
                        {/* Top Row: Mute Icon + Range Slider + Percentage Badge */}
                        <div className="flex items-center gap-3">
                          {/* Interactive Mute / Icon Toggle */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMute();
                              triggerSamsungVolumeBar();
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 cursor-pointer ${
                              isMuted || volume === 0
                                ? "bg-rose-500/20 text-rose-300"
                                : volume > 2.0
                                ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/50"
                                : volume > 1.0
                                ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50"
                                : "bg-blue-500/20 text-blue-300"
                            }`}
                            title={isMuted ? "إلغاء الكتم" : "كتم الصوت"}
                          >
                            {isMuted || volume === 0 ? (
                              <VolumeX className="w-4 h-4" />
                            ) : volume > 2.0 ? (
                              <Zap className="w-4 h-4 text-purple-400 fill-current" />
                            ) : volume > 1.0 ? (
                              <Volume2 className="w-4 h-4 text-amber-400" />
                            ) : volume < 0.5 ? (
                              <Volume1 className="w-4 h-4" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                          </button>

                          {/* Minimalist Horizontal Range Slider (0% to 300%) */}
                          <div className="relative flex-1 flex items-center h-6 min-w-[130px]">
                            <input
                              type="range"
                              min="0"
                              max="3.0"
                              step="0.05"
                              value={isMuted ? 0 : volume}
                              dir="ltr"
                              onChange={(e) => {
                                e.stopPropagation();
                                handleVolumeChange(parseFloat(e.target.value));
                                triggerSamsungVolumeBar();
                              }}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                if (samsungVolumeTimerRef.current) window.clearTimeout(samsungVolumeTimerRef.current);
                              }}
                              onPointerUp={(e) => {
                                e.stopPropagation();
                                triggerSamsungVolumeBar();
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                if (samsungVolumeTimerRef.current) window.clearTimeout(samsungVolumeTimerRef.current);
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation();
                                triggerSamsungVolumeBar();
                              }}
                              className="w-full h-2.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-400 hover:accent-blue-300 transition-all"
                              style={{
                                background: `linear-gradient(to right, ${
                                  volume > 2.0 ? '#a855f7' : volume > 1.0 ? '#f59e0b' : '#3b82f6'
                                } 0%, ${
                                  volume > 2.0 ? '#ec4899' : volume > 1.0 ? '#fbbf24' : '#60a5fa'
                                } ${(Math.min(volume, 3.0) / 3.0) * 100}%, rgba(51, 65, 85, 0.7) ${(Math.min(volume, 3.0) / 3.0) * 100}%, rgba(51, 65, 85, 0.7) 100%)`
                              }}
                            />
                          </div>

                          {/* Percentage Indicator Badge */}
                          <span
                            className={`text-xs font-mono font-black shrink-0 min-w-[44px] text-right px-1.5 py-0.5 rounded ${
                              isMuted || volume === 0
                                ? "text-rose-400 bg-rose-950/40 border border-rose-800/40"
                                : volume > 2.0
                                ? "text-purple-300 bg-purple-950/60 border border-purple-500/40"
                                : volume > 1.0
                                ? "text-amber-300 bg-amber-950/60 border border-amber-500/40"
                                : "text-blue-300 bg-blue-950/40 border border-blue-800/40"
                            }`}
                          >
                            {isMuted ? "0%" : `${Math.round(volume * 100)}%`}
                          </span>
                        </div>

                        {/* Bottom Row: Quick Presets & Speech Clarifier Button */}
                        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80">
                          {/* Quick Volume Presets */}
                          <div className="flex items-center gap-1">
                            {[
                              { label: "100%", val: 1.0, title: "صوت قياسي طبيعي" },
                              { label: "150%", val: 1.5, title: "تعزيز الصوت" },
                              { label: "200% ⚡", val: 2.0, title: "مضخم صوت قوي" },
                              { label: "300% 🚀", val: 3.0, title: "أقصى قوة تضخيم" }
                            ].map((preset) => {
                              const isActive = Math.abs(volume - preset.val) < 0.05 && !isMuted;
                              return (
                                <button
                                  key={preset.val}
                                  type="button"
                                  title={preset.title}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleVolumeChange(preset.val);
                                    triggerSamsungVolumeBar();
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                                    isActive
                                      ? preset.val > 2.0
                                        ? "bg-purple-600 text-white shadow-xs"
                                        : preset.val > 1.0
                                        ? "bg-amber-500 text-slate-950 shadow-xs"
                                        : "bg-blue-600 text-white shadow-xs"
                                      : "bg-slate-800/90 hover:bg-slate-750 text-slate-300 border border-slate-700/50"
                                  }`}
                                >
                                  {preset.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* Voice Clarifier Toggle (Speech Intelligibility EQ) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleVoiceClarifier();
                              triggerSamsungVolumeBar();
                            }}
                            title="توضيح مخارج الحروف وترددات الكلام البشري لتسهيل سماع الحوار"
                            className={`px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              voiceClarifier
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-xs"
                                : "bg-slate-800/80 hover:bg-slate-750 text-slate-400 border border-slate-700/40"
                            }`}
                          >
                            <span>🎙️</span>
                            <span className="hidden sm:inline">توضيح الكلام</span>
                            <span className="sm:hidden">توضيح</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MEDIA ELEMENT: VIDEO OR AUDIO */}
                  {currentFile.type === "video" ? (
                    <video
                      ref={videoRef}
                      src={resolveMediaStreamUrl(currentFile)}
                      className={
                        isFullscreen
                          ? "w-full h-full object-contain pointer-events-none"
                          : isImmersiveMode
                          ? "w-full h-full object-contain pointer-events-none"
                          : "w-full max-h-[500px] object-contain pointer-events-none"
                      }
                      preload="metadata"
                      playsInline
                    />
                  ) : (
                    /* Audio Aesthetic Stage */
                    <div
                      className={`w-full ${
                        isImmersiveMode ? "h-full justify-center" : "py-12 sm:py-16"
                      } px-6 flex flex-col items-center justify-center gap-5 relative bg-linear-to-b from-slate-900 via-slate-900/90 to-slate-950 pointer-events-none`}
                    >
                      <audio
                        ref={audioRef}
                        src={resolveMediaStreamUrl(currentFile)}
                        preload="metadata"
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
                    </div>
                  )}

                  {/* FLOATING SUBTITLES OVERLAY (Identical floating behavior & styling for BOTH Video & Audio) */}
                  {showSubtitlesOverlay && (currentCue || (showDualSubtitles && currentSecondaryCue) || showSwipeSubtitlePreview || (showTranscriptPanel && sidePanelView === "style") || showSubtitleStyleModal) && (
                    <>
                      {primarySubStyle.position === secondarySubStyle.position ? (
                        <div
                          className="absolute inset-x-0 flex flex-col items-center justify-center gap-2 px-4 pointer-events-none z-20 transition-all duration-300 ease-out"
                          style={getSubtitlePositionStyle(primarySubStyle.position, primarySubStyle.offsetY)}
                        >
                          {/* Primary Subtitle (e.g., German / Original) */}
                          {(currentCue || (((showSwipeSubtitlePreview || (showTranscriptPanel && sidePanelView === "style") || showSubtitleStyleModal)) && !currentCue)) && (() => {
                            const text = currentCue ? currentCue.text : getSamplePrimarySubtitleText();
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
                          {showDualSubtitles && (currentSecondaryCue || (((showSwipeSubtitlePreview || (showTranscriptPanel && sidePanelView === "style") || showSubtitleStyleModal)) && !currentSecondaryCue)) && (() => {
                            const text = currentSecondaryCue ? currentSecondaryCue.text : getSampleSecondarySubtitleText();
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
                      ) : (
                        <>
                          {/* Primary Subtitle in its dedicated position */}
                          {(currentCue || (((showSwipeSubtitlePreview || (showTranscriptPanel && sidePanelView === "style") || showSubtitleStyleModal)) && !currentCue)) && (() => {
                            const text = currentCue ? currentCue.text : getSamplePrimarySubtitleText();
                            const dir = primarySubStyle.direction === "rtl" ? "rtl" : primarySubStyle.direction === "ltr" ? "ltr" : detectTextDirection(text);
                            return (
                              <div
                                className="absolute inset-x-0 flex flex-col items-center justify-center px-4 pointer-events-none z-20 transition-all duration-300 ease-out"
                                style={getSubtitlePositionStyle(primarySubStyle.position, primarySubStyle.offsetY)}
                              >
                                <div
                                  dir={dir}
                                  style={getSubtitleTrackComputedStyle(primarySubStyle, isImmersiveMode, text)}
                                >
                                  <span>{text}</span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Secondary Subtitle in its dedicated position */}
                          {showDualSubtitles && (currentSecondaryCue || (((showSwipeSubtitlePreview || (showTranscriptPanel && sidePanelView === "style") || showSubtitleStyleModal)) && !currentSecondaryCue)) && (() => {
                            const text = currentSecondaryCue ? currentSecondaryCue.text : getSampleSecondarySubtitleText();
                            const dir = secondarySubStyle.direction === "rtl" ? "rtl" : secondarySubStyle.direction === "ltr" ? "ltr" : detectTextDirection(text);
                            return (
                              <div
                                className="absolute inset-x-0 flex flex-col items-center justify-center px-4 pointer-events-none z-20 transition-all duration-300 ease-out"
                                style={getSubtitlePositionStyle(secondarySubStyle.position, secondarySubStyle.offsetY)}
                              >
                                <div
                                  dir={dir}
                                  style={getSubtitleTrackComputedStyle(secondarySubStyle, isImmersiveMode, text)}
                                >
                                  <span>{text}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Player Timeline & Controls Bar (Unified in LTR layout for consistent button/scrubber directions) */}
                <div
                  ref={controlsBarRef}
                  dir="ltr"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isFullscreen && showFullscreenControls) resetFullscreenControlsTimer();
                  }}
                  onPointerDown={() => {
                    if (isFullscreen && showFullscreenControls) resetFullscreenControlsTimer();
                  }}
                  onMouseMove={() => {
                    if (isFullscreen && showFullscreenControls) resetFullscreenControlsTimer();
                  }}
                  onTouchStart={() => {
                    if (isFullscreen && showFullscreenControls) resetFullscreenControlsTimer();
                  }}
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

                      {/* 6. Live YouTube-Grade Hover Frame Bubble Preview (Fixed Dimensions & Zero Shaking) */}
                      {hoverPosition !== null && hoverTime !== null && (
                        <div
                          style={{ left: `${Math.max(12, Math.min(88, hoverPosition))}%` }}
                          className="absolute bottom-full mb-3 -translate-x-1/2 flex flex-col items-center pointer-events-none z-40"
                        >
                          <div className="w-48 bg-slate-950/95 border border-white/10 rounded-xl p-1.5 shadow-2xl flex flex-col items-center gap-1.5 backdrop-blur-md">
                            {/* Video Live Frame Thumbnail */}
                            {currentFile.type === "video" && (
                              <div className="w-full h-28 bg-black rounded-lg overflow-hidden relative border border-white/10 shrink-0">
                                <video
                                  ref={previewVideoRef}
                                  src={resolveMediaStreamUrl(currentFile)}
                                  className="w-full h-full object-cover"
                                  muted
                                  preload="metadata"
                                  playsInline
                                />
                                <div className="absolute bottom-1 right-1 bg-black/85 backdrop-blur-xs px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white border border-white/10">
                                  {formatSecondsToTime(hoverTime)}
                                </div>
                              </div>
                            )}

                            {/* Timestamp for Audio */}
                            {currentFile.type === "audio" && (
                              <div className="w-full py-1 bg-indigo-950/80 border border-indigo-500/30 rounded-lg text-center shrink-0">
                                <span className="font-mono text-xs font-bold text-indigo-300">
                                  {formatSecondsToTime(hoverTime)}
                                </span>
                              </div>
                            )}

                            {/* Subtitle cue text preview (Locked size container to prevent any jitter/flicker) */}
                            {activeCues.length > 0 && (
                              <div className="w-full h-8 px-2 bg-slate-900/90 rounded-lg border border-white/10 flex items-center justify-center text-center overflow-hidden shrink-0">
                                <p className="text-[11px] text-slate-200 font-sans font-medium line-clamp-1 leading-tight select-none">
                                  {hoverCueText || <span className="text-slate-500 text-[10px]">بدون نص</span>}
                                </p>
                              </div>
                            )}
                          </div>
                          {/* Triangle Arrow */}
                          <div className="w-2.5 h-2.5 bg-slate-950 rotate-45 border-r border-b border-white/10 -mt-1.5" />
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

                  {/* Unified Compact & Centered Playback Controls Bar (Mobile Portrait, Mobile Landscape, and Desktop) */}
                  <div className="flex items-center justify-between gap-1 sm:gap-3 pt-1 select-none">
                    {/* Left: Sentence Navigation Group */}
                    <div className="flex items-center shrink-0">
                      {activeCues.length > 0 ? (
                        <div className="flex items-center bg-slate-800/90 border border-slate-700/60 rounded-lg p-0.5 shadow-xs">
                          {/* Previous Sentence */}
                          <button
                            onClick={() => jumpToPreviousSentence(true)}
                            className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center text-slate-300 hover:text-white active:bg-slate-700 rounded-md transition-colors cursor-pointer"
                            title="الجملة السابقة ([)"
                          >
                            <SkipBack className="w-3.5 h-3.5 text-indigo-400" />
                          </button>

                          {/* Replay Current Sentence */}
                          <button
                            onClick={replayCurrentSentenceOnly}
                            className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center text-blue-300 hover:text-blue-200 active:bg-blue-600/30 rounded-md transition-colors cursor-pointer"
                            title="إعادة نطق الجملة (R)"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                          </button>

                          {/* Next Sentence */}
                          <button
                            onClick={() => jumpToNextSentence(true)}
                            className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center text-slate-300 hover:text-white active:bg-slate-700 rounded-md transition-colors cursor-pointer"
                            title="الجملة التالية (])"
                          >
                            <SkipForward className="w-3.5 h-3.5 text-indigo-400" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-2" />
                      )}
                    </div>

                    {/* Center: Playback Hero Controls (Centered) */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {/* -5s Skip */}
                      <button
                        onClick={() => skipSeconds(-5)}
                        className="h-7 px-2 sm:h-8 sm:px-2.5 bg-slate-800/90 hover:bg-slate-700/90 active:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700/60 flex items-center gap-1 text-xs font-mono font-bold transition-colors cursor-pointer"
                        title="تراجع 5 ثواني (J / ArrowLeft)"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] sm:text-xs">5s</span>
                      </button>

                      {/* Main Play/Pause Button */}
                      <button
                        onClick={togglePlay}
                        className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-90 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 transition-transform cursor-pointer"
                        title={isPlaying ? "إيقاف مؤقت (Space)" : "تشغيل (Space)"}
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current translate-x-[1px]" />
                        )}
                      </button>

                      {/* +5s Skip */}
                      <button
                        onClick={() => skipSeconds(5)}
                        className="h-7 px-2 sm:h-8 sm:px-2.5 bg-slate-800/90 hover:bg-slate-700/90 active:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700/60 flex items-center gap-1 text-xs font-mono font-bold transition-colors cursor-pointer"
                        title="تقديم 5 ثواني (L / ArrowRight)"
                      >
                        <RotateCw className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] sm:text-xs">5s</span>
                      </button>
                    </div>

                    {/* Right: Quick Controls (Speed, Loop, Volume Button Only) */}
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      {/* Speed Popup */}
                      <div className="relative" ref={speedMenuRef}>
                        <button
                          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                          className={`h-7 px-1.5 sm:h-8 sm:px-2 rounded-lg text-[10.5px] sm:text-xs font-mono font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
                            playbackRate !== 1 || showSpeedMenu
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                              : "bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 border-slate-700/60"
                          }`}
                          title="سرعة التشغيل"
                        >
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span>{playbackRate}x</span>
                        </button>

                        {showSpeedMenu && (
                          <div className="absolute bottom-full mb-2 right-0 sm:left-1/2 sm:-translate-x-1/2 bg-slate-900/98 backdrop-blur-md border border-slate-700/90 rounded-lg p-2.5 shadow-2xl z-50 min-w-[160px] sm:min-w-[170px] animate-scaleUp">
                            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800 text-[11px] font-bold text-slate-300">
                              <span className="flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                سرعة التشغيل
                              </span>
                              <span className="text-[10px] text-amber-400 font-mono bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold">
                                {playbackRate}x
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1 font-mono text-xs">
                              {PLAYBACK_SPEEDS.map((rate) => (
                                <button
                                  key={rate}
                                  onClick={() => {
                                    handleSpeedChange(rate);
                                    setShowSpeedMenu(false);
                                    triggerHud("سرعة التشغيل", `${rate}x`);
                                  }}
                                  className={`px-1.5 py-1 sm:px-2 sm:py-1.5 rounded-md text-center transition-all flex items-center justify-between cursor-pointer ${
                                    playbackRate === rate
                                      ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                                      : "bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700/50"
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
                        className={`h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
                          isLooping
                            ? "bg-blue-600 text-white border-blue-500 shadow-xs"
                            : "bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 border-slate-700/60 active:bg-slate-700"
                        }`}
                        title={isLooping ? "إلغاء التكرار" : "تكرار المقطع"}
                      >
                        <Repeat className="w-3.5 h-3.5" />
                      </button>

                      {/* Volume / Mute Icon Button (No bulky slider track) */}
                      <button
                        onClick={() => {
                          triggerSamsungVolumeBar();
                          toggleMute();
                        }}
                        className="h-7 w-7 sm:h-8 sm:w-8 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/60 rounded-lg flex items-center justify-center text-slate-300 active:bg-slate-700 transition-colors cursor-pointer"
                        title="كتم / تشغيل الصوت"
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                        ) : volume > 1 ? (
                          <Volume2 className="w-3.5 h-3.5 text-blue-400 font-bold" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5 text-slate-300" />
                        )}
                      </button>
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
                      ? "w-full h-[40vh] sm:h-[44vh] md:h-full landscape:h-full md:w-80 lg:w-96 landscape:w-80 lg:landscape:w-96 flex-shrink-0 bg-slate-800/90 border border-slate-700/90 rounded-lg flex flex-col overflow-hidden shadow-lg animate-fadeIn"
                      : "lg:col-span-5 xl:col-span-4 bg-slate-800/90 border border-slate-700/90 rounded-lg flex flex-col h-[420px] sm:h-[480px] lg:h-full lg:min-h-[460px] overflow-hidden shadow-lg animate-fadeIn"
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
                      ) : sidePanelView === "subtitles" ? (
                        <>
                          <Languages className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-100 truncate">
                            خيارات ومسارات الترجمة
                          </span>
                        </>
                      ) : (
                        <span
                          className="text-xs font-bold text-slate-200 truncate max-w-[150px] sm:max-w-[200px]"
                          title={currentFile.title || currentFile.originalName}
                        >
                          {currentFile.title || currentFile.originalName}
                        </span>
                      )}
                    </div>

                    {/* Actions: بحث -> تمرير -> إخفاء/إظهار الدقائق -> إغلاق */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {sidePanelView === "transcript" ? (
                        <>
                          {/* Toggle Search Input */}
                          <button
                            onClick={() => {
                              const next = !showTranscriptSearch;
                              setShowTranscriptSearch(next);
                              if (!next) {
                                setSubtitleSearchQuery("");
                              }
                            }}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              showTranscriptSearch || subtitleSearchQuery
                                ? "text-blue-400 bg-blue-950/60 border border-blue-500/30"
                                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/70"
                            }`}
                            title={showTranscriptSearch ? "إخفاء شريط البحث" : "البحث داخل الجمل"}
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>

                          {/* Auto-scroll Icon Button (Down arrow) */}
                          <button
                            onClick={() => {
                              const next = !autoScrollTranscript;
                              setAutoScrollTranscript(next);
                              triggerHud(next ? "تفعيل التمرير التلقائي" : "إيقاف التمرير التلقائي", "⬇️");
                            }}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              autoScrollTranscript
                                ? "text-blue-400 bg-blue-950/60 border border-blue-500/30"
                                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/70"
                            }`}
                            title={autoScrollTranscript ? "التمرير التلقائي: مفعل (انقر للتعطيل)" : "التمرير التلقائي: معطل (انقر للتفعيل)"}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
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
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              showCueTimestamps
                                ? "text-amber-400 bg-amber-950/60 border border-amber-500/30"
                                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/70"
                            }`}
                            title={showCueTimestamps ? "إخفاء أرقام الدقائق والتوقيت (توفير مساحة أكبر للنص)" : "إظهار أرقام الدقائق والتوقيت"}
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
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
                        className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg cursor-pointer transition-colors"
                        title="إغلاق لوحة الجمل"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Panel Body: Either Subtitle Style Studio OR Subtitle Options Panel OR Sentences / Transcript List */}
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
                  ) : sidePanelView === "subtitles" ? (
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-slate-900">
                      <SubtitleOptionsPanel
                        currentFile={currentFile}
                        activeTrackId={activeTrackId}
                        secondaryTrackId={secondaryTrackId}
                        showDualSubtitles={showDualSubtitles}
                        showSubtitlesOverlay={showSubtitlesOverlay}
                        onToggleSubtitlesOverlay={handleToggleSubtitlesOverlay}
                        onSelectPrimaryTrack={handleSelectPrimaryTrack}
                        onSelectSecondaryTrack={handleSelectSecondaryTrack}
                        onSwapTracks={handleSwapTracks}
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
                        onBackToTranscript={() => setSidePanelView("transcript")}
                        isEmbedded={true}
                      />
                    </div>
                  ) : (
                    <>
                      {/* Search inside Subtitles (Visible only when requested via search button) */}
                      {showTranscriptSearch && (
                        <div className="p-2 border-b border-slate-700/60 bg-slate-850 animate-fadeIn shrink-0">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              autoFocus
                              placeholder="ابحث في نص الترجمة..."
                              value={subtitleSearchQuery}
                              onChange={(e) => setSubtitleSearchQuery(e.target.value)}
                              className="w-full pl-7 pr-8 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
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
                      )}

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
                            // Clean 1-to-1 matching secondary cue (prevents duplicate and mismatched sentences)
                            const matchingSec = secondaryCueMap.get(cue.id);

                            return (
                              <div
                                key={cue.id}
                                ref={isCurrent ? activeCueRef : null}
                                data-active-cue={isCurrent ? "true" : undefined}
                                onClick={() => handleSeek(cue.startTime)}
                                className={`px-2.5 py-2 rounded-lg border transition-colors duration-150 flex items-center justify-between gap-2 cursor-pointer group ${
                                  isCurrent
                                    ? "bg-blue-600/25 border-blue-500/80 text-white shadow-xs"
                                    : "border-transparent hover:bg-slate-800/80 text-slate-300 hover:text-white"
                                }`}
                              >
                                {/* Left/Start: Optional Timestamp Badge (Click to jump) */}
                                {showCueTimestamps && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSeek(cue.startTime);
                                    }}
                                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 transition-colors cursor-pointer border ${
                                      isCurrent
                                        ? "bg-blue-600 border-blue-500 text-white shadow-xs"
                                        : "bg-slate-950 text-blue-400 group-hover:bg-blue-950 border-slate-800"
                                    }`}
                                    title="اضغط للانتقال لهذا التوقيت"
                                  >
                                    {formatSecondsToClock(cue.startTime)}
                                  </button>
                                )}

                                {/* Main Text Content: Dynamic text direction and full container utilization without dead space */}
                                <div
                                  className="flex-1 min-w-0 space-y-0.5"
                                  dir={detectTextDirection(cue.text)}
                                >
                                  <p
                                    className={`text-xs leading-relaxed font-sans font-medium break-words ${
                                      isCurrent ? "text-white font-semibold" : "text-slate-200"
                                    }`}
                                  >
                                    {cue.text}
                                  </p>
                                  {showDualSubtitles && matchingSec && (
                                    <p
                                      dir={detectTextDirection(matchingSec.text)}
                                      className="text-[11px] text-emerald-300 font-medium border-t border-slate-700/60 pt-0.5 break-words"
                                    >
                                      {matchingSec.text}
                                    </p>
                                  )}
                                </div>

                                {/* Sentence Options Button (Symbolic Icon Only, Compact & Borderless) */}
                                <div className="relative shrink-0 self-center" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={(e) => handleToggleCueMenu(cue, e)}
                                    className={`p-1 rounded-md transition-all cursor-pointer flex items-center justify-center border-0 outline-none ${
                                      cueOptionsMenuId === cue.id
                                        ? "bg-blue-600 text-white shadow-xs"
                                        : "hover:bg-slate-700/60 text-slate-400 hover:text-white"
                                    }`}
                                    title="خيارات"
                                  >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </button>
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

            {/* Smart Fixed Floating Options Menu (Borderless, Boundary-Aware, Never Clipped) */}
            {cueOptionsMenuId && cueMenuAnchor && (
              <div
                className={`fixed z-[95] min-w-[140px] bg-slate-900/98 backdrop-blur-md rounded-2xl p-1.5 shadow-2xl animate-scaleUp text-right border-0 shadow-black/80 ring-1 ring-white/10 ${
                  cueMenuAnchor.openAbove ? "origin-bottom" : "origin-top"
                }`}
                style={{
                  top: cueMenuAnchor.openAbove ? undefined : `${cueMenuAnchor.y}px`,
                  bottom: cueMenuAnchor.openAbove ? `${window.innerHeight - cueMenuAnchor.y}px` : undefined,
                  left: `${cueMenuAnchor.x}px`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 1. Edit / تعديل */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetCue = cueMenuAnchor.cue;
                    setCueOptionsMenuId(null);
                    setCueMenuAnchor(null);
                    handleOpenEditCue(targetCue);
                  }}
                  className="w-full px-2.5 py-2 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer border-0"
                >
                  <Edit2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>تعديل</span>
                </button>

                {/* 2. Copy Sentence / نسخ */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetCue = cueMenuAnchor.cue;
                    setCueOptionsMenuId(null);
                    setCueMenuAnchor(null);
                    handleCopyCueText(targetCue);
                  }}
                  className="w-full px-2.5 py-2 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer border-0"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>نسخ</span>
                </button>

                {/* 3. AI Sentence Chat / سؤال الذكاء 🤖 (الخيار الرابع التفاعلي مع 20 جملة قبل وبعد) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetCue = cueMenuAnchor.cue;
                    setCueOptionsMenuId(null);
                    setCueMenuAnchor(null);
                    handleOpenSentenceChat(targetCue);
                  }}
                  className="w-full px-2.5 py-2 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer border-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>سؤال الذكاء 🤖</span>
                </button>

                {/* 4. Delete with Confirmation / حذف */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetCue = cueMenuAnchor.cue;
                    setCueOptionsMenuId(null);
                    setCueMenuAnchor(null);
                    setCueToDelete(targetCue);
                  }}
                  className="w-full px-2.5 py-2 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer border-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>حذف</span>
                </button>
              </div>
            )}

            {/* MODAL: CLEAN CUE TIMING & TEXT EDITOR (MM:SS FORMAT + SYNC) */}
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

            {/* MODAL: CONFIRM DELETE CUE */}
            {cueToDelete && (
              <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 shadow-2xl text-white animate-scaleUp text-right">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-800 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-slate-100">تأكيد حذف الجملة</h3>
                      <p className="text-[11px] text-slate-400 font-mono">
                        التوقيت: {formatSecondsToClock(cueToDelete.startTime)} - {formatSecondsToClock(cueToDelete.endTime)}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 mb-4 max-h-32 overflow-y-auto">
                    <p className="text-xs text-slate-200 font-medium leading-relaxed font-sans">
                      "{cueToDelete.text}"
                    </p>
                  </div>

                  <p className="text-xs text-slate-400 mb-5">
                    هل أنت متأكد من حذف هذه الجملة من مسار الترجمة؟ لا يمكن التراجع بعد الحذف.
                  </p>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleConfirmDeleteCue(cueToDelete.id);
                        setCueToDelete(null);
                      }}
                      className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>نعم، احذف</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCueToDelete(null)}
                      className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : (
          /* ======================================================== */
          /* WINDOWS FILE EXPLORER WORKSPACE (With Library Tools)     */
          /* ======================================================== */
          <div className="w-full flex-1 flex flex-col min-h-[600px] -mt-1">
            <MediaExplorerView
              files={files}
              folders={folders}
              fileFolderMap={fileFolderMap}
              activeFolderId={activeFolderId}
              currentFile={currentFile}
              loading={loading}
              uploading={uploading}
              uploadProgress={uploadProgress}
              uploadingFolderName={uploadingFolderName}
              uploadingFileName={uploadingFileName}
              onSelectFolder={(id) => setActiveFolderId(id)}
              onSelectFile={(file, autoPlay) => {
                if (file) {
                  handleSelectFile(file, autoPlay !== false);
                }
              }}
              onOpenCreateFolder={handleOpenCreateFolderModal}
              onOpenEditFolder={handleOpenEditFolderModal}
              onDeleteFolder={handleDeleteFolder}
              onMoveFile={handleMoveFileToFolder}
              onBulkMove={handleBulkMoveFiles}
              onBulkDelete={handleBulkDeleteFiles}
              onDeleteFile={handleDeleteFile}
              onStartRename={handleStartRename}
              editingId={editingId}
              editTitleText={editTitleText}
              setEditTitleText={setEditTitleText}
              onSaveRename={handleSaveRename}
              onUploadClick={() => fileInputRef.current?.click()}
              onUploadFolderClick={() => folderInputRef.current?.click()}
              onOpenYouTubeDownload={() => {
                setGradioInitialMode("youtube");
                setShowGradioModal(true);
              }}
              onOpenGradioModal={() => {
                setGradioInitialMode("current");
                setShowGradioModal(true);
              }}
              onOpenGradioModalForFile={(file) => {
                setCurrentFile(file);
                setGradioInitialMode("current");
                setShowGradioModal(true);
              }}
              onOpenSubtitleOptionsForFile={(file) => {
                handleSelectFile(file, false);
                setShowTranscriptPanel(true);
                setSidePanelView("subtitles");
              }}
              onRefreshFiles={fetchMediaFiles}
              onToggleSidebar={onToggleSidebar}
            />
          </div>
        )}
      </div>


      {/* ======================================================== */}
      {/* MODAL: CREATE / EDIT FOLDER */}
      {/* ======================================================== */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <h3 className="font-black text-slate-900 text-sm">
                  {folderModalMode === "create" ? "إنشاء مجلد جديد" : "تعديل المجلد"}
                </h3>
              </div>
              <button
                onClick={() => setShowFolderModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم المجلد
                </label>
                <input
                  type="text"
                  placeholder="مثال: دروس المحادثة A2..."
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveFolder();
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#0056f6] focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveFolder}
                  disabled={!folderNameInput.trim()}
                  className="flex-1 py-2 bg-[#0056f6] hover:bg-[#0047d1] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {folderModalMode === "create" ? "إنشاء المجلد" : "حفظ التعديل"}
                </button>
                <button
                  onClick={() => setShowFolderModal(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: MOVE FILE TO FOLDER */}
      {/* ======================================================== */}
      {movingFile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <FolderInput className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 text-xs truncate">
                    نقل: {movingFile.title}
                  </h3>
                  <p className="text-[10px] text-slate-500">اختر المجلد المراد نقل الملف إليه</p>
                </div>
              </div>
              <button
                onClick={() => setMovingFile(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 space-y-1 max-h-60 overflow-y-auto">
              <button
                onClick={() => handleMoveFileToFolder(movingFile.id, null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  !fileFolderMap[movingFile.id]
                    ? "bg-amber-50 text-amber-900 border border-amber-200/60"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                  <span>بدون مجلد (غير مصنف)</span>
                </div>
                {!fileFolderMap[movingFile.id] && <Check className="w-4 h-4 text-amber-600" />}
              </button>

              {folders.map((folder) => {
                const isSelected = fileFolderMap[movingFile.id] === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => handleMoveFileToFolder(movingFile.id, folder.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-amber-100/70 text-amber-900 border border-amber-200"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: folder.color || "#f59e0b" }}
                      />
                      <span className="truncate">{getFolderPathName(folder)}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-amber-600" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  setMovingFile(null);
                  handleOpenCreateFolderModal();
                }}
                className="text-xs text-[#0056f6] font-bold hover:underline cursor-pointer"
              >
                + إنشاء مجلد جديد
              </button>
              <button
                onClick={() => setMovingFile(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

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
                    placeholder={`تلقائي بالبروتوكول: ${formatSubtitleTrackProtocol("UPL", "de")}`}
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
      {/* MODAL: LOCAL GRADIO SPEECH-TO-TEXT GERMAN & YOUTUBE SERVER */}
      {/* ======================================================== */}
      <GradioTranscriberModal
        isOpen={showGradioModal}
        onClose={() => setShowGradioModal(false)}
        currentFile={currentFile}
        initialMode={gradioInitialMode}
        onOpenStyleModal={() => openStyleInSidebar("gradio")}
        onVideoDownloaded={async (newFile, rawSrt, cues) => {
          await fetchMediaFiles();
          handleSelectFile(newFile, true);
          setShowGradioModal(false);
          triggerHud("تم حفظ وتشغيل الفيديو بنجاح", "⚡");
        }}
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
        onSwapTracks={handleSwapTracks}
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

      {/* ======================================================== */}
      {/* MODAL: AI MEDIA SENTENCE & CONTEXT DIALOGUE CHAT MODAL  */}
      {/* ======================================================== */}
      {isSentenceChatOpen && chatTargetCue && (
        <ReviewChatModal
          isOpen={isSentenceChatOpen}
          onClose={() => {
            setIsSentenceChatOpen(false);
            setChatTargetCue(null);
          }}
          card={{
            id: `media_cue_${currentFile?.id || 'temp'}_${chatTargetCue.id}`,
            frontText: chatTargetCue.text,
            backText: chatTargetCue.secondaryText || "",
            frontLang: activeTrack?.language || "de",
            backLang: secondaryTrack?.language || "ar"
          }}
          previousCards={chatPreviousCues.map((c) => ({
            id: `media_cue_${currentFile?.id || 'temp'}_${c.id}`,
            frontText: c.text,
            backText: c.secondaryText || "",
            frontLang: activeTrack?.language || "de",
            backLang: secondaryTrack?.language || "ar"
          }))}
          nextCards={chatNextCues.map((c) => ({
            id: `media_cue_${currentFile?.id || 'temp'}_${c.id}`,
            frontText: c.text,
            backText: c.secondaryText || "",
            frontLang: activeTrack?.language || "de",
            backLang: secondaryTrack?.language || "ar"
          }))}
          folderInfo={{
            name: currentFile?.title || currentFile?.originalName || "ملف وسائط",
            description: `مقطع ${currentFile?.type === "audio" ? "صوتي" : "فيديو"}`
          }}
          mediaContext={{
            mediaId: currentFile?.id,
            mediaTitle: currentFile?.title || currentFile?.originalName || "ملف وسائط",
            originalName: currentFile?.originalName,
            mediaType: currentFile?.type || "video",
            duration: duration,
            cueStartTime: chatTargetCue.startTime,
            cueEndTime: chatTargetCue.endTime,
            onPlayMediaSegment: (start, end) => {
              if (videoRef.current) {
                videoRef.current.currentTime = start;
                videoRef.current.play().catch(() => {});
                setIsPlaying(true);
              }
            }
          }}
          onPlayPronunciation={(text, lang) => {
            speakClient(text, lang || activeTrack?.language || "de");
          }}
        />
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Search,
  Image as ImageIcon,
  Volume2,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Settings,
  AlertCircle,
  Play,
  Eye,
  EyeOff,
  Copy,
  Move,
  Key,
  Download,
  RefreshCw,
  DownloadCloud,
  HardDrive,
  Cpu,
  Star,
  VolumeX,
  Activity,
  Server,
  Zap,
  CheckCircle2,
  Minimize2,
  Maximize2,
  ExternalLink,
  Link2,
  Users,
  PenTool,
  Film,
  NotebookPen,
  LayoutGrid,
  Smartphone,
  Upload,
  FileJson
} from "lucide-react";
import { DEFAULT_GRADIO_VOICES, GRADIO_LANGUAGES } from "../types";
import { AccountsSettingsTab } from "./AccountsSettingsTab";
import { useAuth } from "../context/AuthContext";
import {
  loadSecondarySectionsVisibility,
  saveSecondarySectionsVisibility,
  SecondarySectionsVisibility,
  SecondarySectionKey
} from "../utils/sidebarSections";
import { PWAInstallButton } from "./PWAInstallBanner";
import {
  DiagnosticLogItem,
  globalDiagnosticLogs,
  addDiagnosticLog,
  subscribeDiagnosticLogs,
  ttsCache,
  imageCache,
  stopActiveAudio,
  playBrowserSynthesis,
  playPiperLocalWasm,
  configureOnnxRuntime,
  parseLocalTtsErrorDetails,
  runGranularLocalTtsCheck,
  DetailedTtsErrorAnalysis,
  playGradioClientAudio
} from "./Modals";
import { LivePiperSandboxModal } from "./LivePiperSandboxModal";
import {
  collectLocalSettingsSnapshot,
  countStoredSettings,
  importLocalSettingsSnapshot
} from "../utils/settingsBackup";

type SettingsRoute =
  | "home"
  | "audio"
  | "audio_models"
  | "audio_gradio"
  | "audio_test"
  | "ai"
  | "appearance"
  | "images"
  | "storage"
  | "backup"
  | "diagnostics"
  | "accounts";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
}

// Reusable Android-style Section Card Group
const SettingsGroup: React.FC<{
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, action, children }) => (
  <div className="space-y-1.5">
    {(title || action) && (
      <div className="flex items-center justify-between px-1.5">
        {title ? (
          <h3 className="text-xs font-bold text-slate-500">{title}</h3>
        ) : (
          <span />
        )}
        {action}
      </div>
    )}
    <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-2xs">
      {children}
    </div>
  </div>
);

// Reusable Android-style Switch Control (RTL-aligned)
const AndroidSwitch: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
  activeColorClass?: string;
}> = ({ checked, onChange, ariaLabel, activeColorClass = "bg-[#004ac6]" }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={(e) => {
      e.stopPropagation();
      onChange(!checked);
    }}
    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
      checked ? activeColorClass : "bg-slate-300"
    }`}
  >
    <span
      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-all duration-150 ${
        checked ? "right-0.5" : "right-[22px]"
      }`}
    />
  </button>
);

// Reusable Android-style Navigation Drill-Down Row
const AndroidNavRow: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value?: string;
  onClick: () => void;
}> = ({ icon, iconBg, title, value, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full min-h-[58px] px-4 py-3 flex items-center justify-between gap-3 text-right hover:bg-slate-50/90 active:bg-slate-100/80 transition-colors cursor-pointer"
  >
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-slate-900 truncate">{title}</div>
        {value && (
          <div className="text-xs text-slate-500 truncate mt-0.5">{value}</div>
        )}
      </div>
    </div>
    <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
  </button>
);

// Reusable Segmented Selector
function SegmentedControl<T extends string>({
  options,
  value,
  onChange
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (val: T) => void;
}) {
  return (
    <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/70 gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            value === opt.value
              ? "bg-white text-[#004ac6] shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onOpen }) => {
  const { currentUser } = useAuth();
  const isAdminUser = currentUser?.role === "admin";

  const [route, setRoute] = useState<SettingsRoute>("home");
  const [searchQuery, setSearchQuery] = useState("");

  // Core Settings States
  const [audioApi, setAudioApi] = useState("google_proxy");
  const [customTtsUrl, setCustomTtsUrl] = useState("");
  const [imageApi, setImageApi] = useState("duckduckgo");
  const [pixabayKey, setPixabayKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showPixabayKey, setShowPixabayKey] = useState(false);
  const [aiProvider, setAiProvider] = useState("gemini");
  const [enableInlinePersonaCorrection, setEnableInlinePersonaCorrection] = useState<boolean>(
    () => localStorage.getItem("settings_enable_persona_correction") !== "false"
  );

  // Site scale zoom states
  const [siteScale, setSiteScale] = useState(100);
  const initialScaleRef = useRef(100);

  // Cache Manager states
  const [imageCacheCount, setImageCacheCount] = useState<number | null>(null);
  const [imageCacheSize, setImageCacheSize] = useState<string | null>(null);
  const [ttsCacheCount, setTtsCacheCount] = useState<number | null>(null);
  const [ttsCacheSize, setTtsCacheSize] = useState<string | null>(null);
  const [isCalculatingCache, setIsCalculatingCache] = useState(false);

  // Settings JSON Export / Import states
  const [backupIncludeApiKeys, setBackupIncludeApiKeys] = useState(false);
  const [backupCopiedNotice, setBackupCopiedNotice] = useState(false);
  const [backupImportText, setBackupImportText] = useState("");
  const [backupFeedback, setBackupFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [storedSettingsCount, setStoredSettingsCount] = useState<number>(() => countStoredSettings(false));
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  // Secondary Sidebar Sections Visibility
  const [secondarySections, setSecondarySections] = useState<SecondarySectionsVisibility>(
    () => loadSecondarySectionsVisibility()
  );

  const handleToggleSecondarySection = (key: SecondarySectionKey) => {
    setSecondarySections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveSecondarySectionsVisibility(next);
      return next;
    });
  };

  const handleSetAllSecondarySections = (visible: boolean) => {
    const next: SecondarySectionsVisibility = {
      corrector: visible,
      media: visible,
      notes: visible,
      shadowing: visible
    };
    setSecondarySections(next);
    saveSecondarySectionsVisibility(next);
  };

  // Animation settings states
  const [enableChatAnimations, setEnableChatAnimations] = useState<boolean>(
    () => localStorage.getItem("settings_ai_chat_animations") !== "false"
  );
  const [enableGeneralAnimations, setEnableGeneralAnimations] = useState<boolean>(
    () => localStorage.getItem("settings_general_animations") !== "false"
  );

  const handleToggleChatAnimations = (val: boolean) => {
    setEnableChatAnimations(val);
    localStorage.setItem("settings_ai_chat_animations", String(val));
    window.dispatchEvent(new Event("app_settings_changed"));
  };

  const handleToggleGeneralAnimations = (val: boolean) => {
    setEnableGeneralAnimations(val);
    localStorage.setItem("settings_general_animations", String(val));
    window.dispatchEvent(new Event("app_settings_changed"));
  };

  // Diagnostic system states
  const [speechError, setSpeechError] = useState<{
    msg: string;
    cause?: string;
    solution?: string;
    checksSummary?: Array<{ step: string; status: "passed" | "failed" | "skipped"; detail: string }>;
    technicalDetails?: any;
    failedStepTitle?: string;
  } | null>(null);
  const [detailedTtsAnalysis, setDetailedTtsAnalysis] = useState<DetailedTtsErrorAnalysis | null>(null);
  const [localTtsStage, setLocalTtsStage] = useState<{ step: number; title: string } | null>(null);
  const [serverTtsStepInfo, setServerTtsStepInfo] = useState<{
    status: "checking" | "found" | "downloading" | "generating" | "success" | "error";
    msg: string;
  } | null>(null);
  const [granularTtsCheckResults, setGranularTtsCheckResults] = useState<{
    passed: boolean;
    steps: Array<{ stepNum: number; title: string; status: "ok" | "error" | "pending"; durationMs?: number; details?: string }>;
    analysis?: DetailedTtsErrorAnalysis;
  } | null>(null);
  const [isRunningGranularCheck, setIsRunningGranularCheck] = useState<boolean>(false);
  const [diagnosticLogList, setDiagnosticLogList] = useState<DiagnosticLogItem[]>(() => [...globalDiagnosticLogs]);
  const [diagFilter, setDiagFilter] = useState<string>("all");
  const [isTestingSystem, setIsTestingSystem] = useState<boolean>(false);
  const [systemTestResults, setSystemTestResults] = useState<
    Record<string, { ok: boolean; msg: string; cause?: string; solution?: string; ms?: number }> | null
  >(null);
  const [diagCopiedNotice, setDiagCopiedNotice] = useState(false);

  // Primary Default Model per language states
  const [primaryModelDe, setPrimaryModelDe] = useState<string>(
    () => localStorage.getItem("settings_primary_piper_model_de") || "de_DE-thorsten-medium"
  );
  const [primaryModelAr, setPrimaryModelAr] = useState<string>(
    () => localStorage.getItem("settings_primary_piper_model_ar") || "ar_JO-kareem-medium"
  );
  const [primaryModelEn, setPrimaryModelEn] = useState<string>(
    () => localStorage.getItem("settings_primary_piper_model_en") || "en_US-lessac-medium"
  );

  // Active Voice Target (Primary vs Secondary)
  const [reviewVoiceTarget, setReviewVoiceTarget] = useState<"primary" | "secondary">(
    () => (localStorage.getItem("settings_review_voice_target") as "primary" | "secondary") || "primary"
  );

  // Secondary Voice Model states & toggles
  const [enableSecondaryAudioReview, setEnableSecondaryAudioReview] = useState<boolean>(
    () => localStorage.getItem("settings_enable_secondary_audio_review") === "true"
  );
  const [enableAudioPreloadReview, setEnableAudioPreloadReview] = useState<boolean>(
    () => localStorage.getItem("settings_preload_audio_review") === "true"
  );
  const [secondaryModelDe, setSecondaryModelDe] = useState<string>(
    () => localStorage.getItem("settings_secondary_piper_model_de") || "google"
  );
  const [secondaryModelAr, setSecondaryModelAr] = useState<string>(
    () => localStorage.getItem("settings_secondary_piper_model_ar") || "google"
  );
  const [secondaryModelEn, setSecondaryModelEn] = useState<string>(
    () => localStorage.getItem("settings_secondary_piper_model_en") || "google"
  );

  // Gradio Custom Language Selection states
  const [primaryGradioLangDe, setPrimaryGradioLangDe] = useState<string>(
    () => localStorage.getItem("settings_primary_gradio_lang_de") || "german"
  );
  const [primaryGradioLangAr, setPrimaryGradioLangAr] = useState<string>(
    () => localStorage.getItem("settings_primary_gradio_lang_ar") || "arabic"
  );
  const [primaryGradioLangEn, setPrimaryGradioLangEn] = useState<string>(
    () => localStorage.getItem("settings_primary_gradio_lang_en") || "english"
  );
  const [secondaryGradioLangDe, setSecondaryGradioLangDe] = useState<string>(
    () => localStorage.getItem("settings_secondary_gradio_lang_de") || "german"
  );
  const [secondaryGradioLangAr, setSecondaryGradioLangAr] = useState<string>(
    () => localStorage.getItem("settings_secondary_gradio_lang_ar") || "arabic"
  );
  const [secondaryGradioLangEn, setSecondaryGradioLangEn] = useState<string>(
    () => localStorage.getItem("settings_secondary_gradio_lang_en") || "english"
  );

  // Gradio TTS Server states
  const [gradioTtsUrl, setGradioTtsUrl] = useState<string>(
    () => localStorage.getItem("settings_gradio_tts_url") || "http://192.168.0.159:7860"
  );
  const [gradioSavedNotice, setGradioSavedNotice] = useState(false);
  const [isTestingGradio, setIsTestingGradio] = useState<boolean>(false);
  const [gradioTestResult, setGradioTestResult] = useState<{
    ok: boolean;
    msg: string;
    latencyMs?: number;
    title?: string;
    details?: any;
  } | null>(null);
  const [playingGradioVoiceId, setPlayingGradioVoiceId] = useState<string | null>(null);
  const [gradioVoiceError, setGradioVoiceError] = useState<string | null>(null);

  // TTS Execution Mode & Sandbox states
  const [ttsExecutionMode, setTtsExecutionMode] = useState<"local" | "server">(
    () => (localStorage.getItem("settings_tts_execution_mode") as "local" | "server") || "server"
  );
  const [isPreloadingLocal, setIsPreloadingLocal] = useState(false);
  const [localPreloadedMsg, setLocalPreloadedMsg] = useState<string | null>(null);
  const [localInstallProgress, setLocalInstallProgress] = useState<number>(0);
  const [localInstallStep, setLocalInstallStep] = useState<string>("");

  const [testVoiceText, setTestVoiceText] = useState("Guten Tag! Wie geht es Ihnen heute?");
  const [testVoiceLang, setTestVoiceLang] = useState("de");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsStatus, setTtsStatus] = useState<"idle" | "generating" | "playing">("idle");
  const [selectedPiperModel, setSelectedPiperModel] = useState<string>("de_DE-thorsten-medium");
  const [piperModels, setPiperModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);

  // Piper Model Catalog & Download Management
  const [catalogModels, setCatalogModels] = useState<any[]>([]);
  const [catalogFilter, setCatalogFilter] = useState<string>("all");
  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});
  const [downloadProgressMap, setDownloadProgressMap] = useState<
    Record<string, { percent: number; loadedMb: string; totalMb: string; step: string }>
  >({});
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteModelId, setConfirmDeleteModelId] = useState<string | null>(null);
  const [confirmClearAllModels, setConfirmClearAllModels] = useState<boolean>(false);
  const [customModelUrl, setCustomModelUrl] = useState<string>("");
  const [customModelJsonUrl, setCustomModelJsonUrl] = useState<string>("");
  const [customModelId, setCustomModelId] = useState<string>("");
  const [showCustomModelForm, setShowCustomModelForm] = useState(false);
  const [isDownloadingCustom, setIsDownloadingCustom] = useState<boolean>(false);
  const [isLiveSandboxOpen, setIsLiveSandboxOpen] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);
  const [expandedLinksMap, setExpandedLinksMap] = useState<Record<string, boolean>>({});
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [isClearingAllModels, setIsClearingAllModels] = useState<boolean>(false);

  // Server repair & Piper Standby states
  const [isRepairingServer, setIsRepairingServer] = useState(false);
  const [repairStatusMsg, setRepairStatusMsg] = useState<string | null>(null);
  const [piperStandbyMode, setPiperStandbyMode] = useState<"idle_60s" | "always_ready">(
    () => (localStorage.getItem("settings_piper_standby_mode") as "idle_60s" | "always_ready") || "idle_60s"
  );
  const [piperEngineStatus, setPiperEngineStatus] = useState<{
    mode: "idle_60s" | "always_ready";
    idleTimeoutSeconds: number;
    isProcessActive: boolean;
    currentModel: string | null;
    queueLength: number;
  } | null>(null);
  const [isUpdatingEngineMode, setIsUpdatingEngineMode] = useState(false);
  const [isWarmingUpEngine, setIsWarmingUpEngine] = useState(false);
  const [isFlushingEngine, setIsFlushingEngine] = useState(false);
  const [engineFeedbackMsg, setEngineFeedbackMsg] = useState<string | null>(null);

  // Image sandbox states
  const [testImgQuery, setTestImgQuery] = useState("nature");
  const [testImages, setTestImages] = useState<any[]>([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [imgSearchStatus, setImgSearchStatus] = useState<string | null>(null);

  const applyScale = (scaleVal: number) => {
    const baseFontSize = 12.65;
    document.documentElement.style.fontSize = `${baseFontSize * (scaleVal / 100)}px`;
  };

  const getPiperModelUrls = (model: any) => {
    if (model.urlOnnx && model.urlJson) {
      return { urlOnnx: model.urlOnnx, urlJson: model.urlJson };
    }
    const cleanId = (model.id || "").replace(/\.onnx$/, "").trim();
    const parts = cleanId.split("-");
    const langCode = parts[0] || "de_DE";
    const voiceName = parts[1] || "thorsten";
    const quality = parts[2] || "medium";
    const langShort = langCode.split("_")[0] || "de";

    const urlOnnx =
      model.urlOnnx ||
      `https://huggingface.co/rhasspy/piper-voices/resolve/main/${langShort}/${langCode}/${voiceName}/${quality}/${cleanId}.onnx`;
    const urlJson =
      model.urlJson ||
      `https://huggingface.co/rhasspy/piper-voices/resolve/main/${langShort}/${langCode}/${voiceName}/${quality}/${cleanId}.onnx.json`;

    return { urlOnnx, urlJson };
  };

  const handleCopyLink = async (text: string, linkId: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedLinkId(linkId);
      setTimeout(() => {
        setCopiedLinkId((prev) => (prev === linkId ? null : prev));
      }, 2500);
    } catch (e) {
      console.warn("Failed to copy URL to clipboard:", e);
    }
  };

  const fetchPiperEngineStatus = async () => {
    try {
      const res = await fetch("/api/tts/piper/engine-status");
      if (res.ok) {
        const data = await res.json();
        setPiperEngineStatus(data);
        if (data.mode) {
          setPiperStandbyMode(data.mode);
          localStorage.setItem("settings_piper_standby_mode", data.mode);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleChangePiperEngineMode = async (newMode: "idle_60s" | "always_ready") => {
    setPiperStandbyMode(newMode);
    localStorage.setItem("settings_piper_standby_mode", newMode);
    setIsUpdatingEngineMode(true);
    setEngineFeedbackMsg(null);
    try {
      const res = await fetch("/api/tts/piper/engine-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode })
      });
      if (res.ok) {
        const data = await res.json();
        setPiperEngineStatus(data);
        setEngineFeedbackMsg(
          newMode === "always_ready" ? "وضع الاستعداد الدائم مفعّل" : "وضع توفير الذاكرة (60 ثانية) مفعّل"
        );
      }
    } catch (e) {
      console.warn("Failed to update Piper engine mode:", e);
    } finally {
      setIsUpdatingEngineMode(false);
    }
  };

  const handleWarmupPiperEngine = async () => {
    setIsWarmingUpEngine(true);
    setEngineFeedbackMsg(null);
    try {
      const res = await fetch("/api/tts/piper/engine-warmup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelName: selectedPiperModel || "de_DE-thorsten-medium" })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPiperEngineStatus(data);
        setEngineFeedbackMsg("تمت تهيئة المحرك في الذاكرة بنجاح");
      } else {
        setEngineFeedbackMsg(data.message || "فشلت تهيئة المحرك");
      }
    } catch (e: any) {
      setEngineFeedbackMsg(e?.message || "خطأ أثناء تهيئة المحرك");
    } finally {
      setIsWarmingUpEngine(false);
    }
  };

  const handleFlushPiperEngine = async () => {
    setIsFlushingEngine(true);
    setEngineFeedbackMsg(null);
    try {
      const res = await fetch("/api/tts/piper/engine-flush", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setPiperEngineStatus(data);
        setEngineFeedbackMsg("تم تفريغ الذاكرة وإيقاف المحرك بنجاح");
      }
    } catch (e) {
      console.warn("Failed to flush Piper engine:", e);
    } finally {
      setIsFlushingEngine(false);
    }
  };

  const handleRepairServerPiper = async () => {
    setIsRepairingServer(true);
    setRepairStatusMsg("جاري فحص وتنزيل الملفات الناقصة...");
    try {
      const res = await fetch("/api/system/repair-piper", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setRepairStatusMsg(data.message || "تم فحص وإصلاح السيرفر بنجاح");
        await fetchCatalog();
      } else {
        setRepairStatusMsg(data.message || "حدث خطأ أثناء إصلاح ملفات السيرفر");
      }
    } catch (err: any) {
      setRepairStatusMsg("تعذر الاتصال بخدمة الإصلاح: " + (err?.message || "خطأ"));
    } finally {
      setIsRepairingServer(false);
    }
  };

  const handleSaveGradioUrl = (newUrl: string) => {
    const trimmed = newUrl.trim() || "http://192.168.0.159:7860";
    setGradioTtsUrl(trimmed);
    localStorage.setItem("settings_gradio_tts_url", trimmed);
    setGradioSavedNotice(true);
    setTimeout(() => setGradioSavedNotice(false), 2000);
  };

  const handleTestGradioConnection = async () => {
    setIsTestingGradio(true);
    setGradioTestResult(null);
    try {
      const res = await fetch("/api/tts/gradio/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl: gradioTtsUrl })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setGradioTestResult({
          ok: true,
          msg: `الاتصال ناجح (${data.latencyMs}ms)`,
          latencyMs: data.latencyMs,
          title: data.title,
          details: data.details
        });
        addDiagnosticLog({
          category: "TTS",
          type: "success",
          title: "اتصال Gradio TTS ناجح",
          message: `${gradioTtsUrl} (${data.latencyMs}ms)`
        });
      } else {
        setGradioTestResult({
          ok: false,
          msg: data.error || data.message || "تعذر الاتصال بالسيرفر",
          latencyMs: data.latencyMs,
          details: data.suggestedSolution
        });
        addDiagnosticLog({
          category: "TTS",
          type: "error",
          title: "فشل اتصال Gradio TTS",
          message: data.error || "تعذر الوصول للسيرفر",
          solution: data.suggestedSolution
        });
      }
    } catch (e: any) {
      setGradioTestResult({
        ok: false,
        msg: e?.message || "تعذر الوصول إلى سيرفر Gradio",
        details: "تأكد أن السيرفر يعمل على نفس الشبكة والمنفذ 7860."
      });
    } finally {
      setIsTestingGradio(false);
    }
  };

  const handlePlayGradioVoiceSample = async (voiceId: string, sampleText?: string, langCode: string = "de") => {
    if (playingGradioVoiceId !== null) return;
    stopActiveAudio();
    setPlayingGradioVoiceId(voiceId);
    setGradioVoiceError(null);
    try {
      const textToPlay = sampleText || "Guten Tag! Das ist eine Sprachprobe von Gradio Qwen3-TTS.";
      const res = await playGradioClientAudio(textToPlay, voiceId, langCode, gradioTtsUrl);
      if (!res.ok) {
        setGradioVoiceError(res.error || `تعذر تشغيل عينة الصوت (${voiceId})`);
      }
    } catch (err: any) {
      setGradioVoiceError(`خطأ أثناء تشغيل العينة: ${err?.message || err}`);
    } finally {
      setPlayingGradioVoiceId(null);
    }
  };

  const handleSetPrimaryModel = (lang: string, modelId: string) => {
    const langKey = lang.toLowerCase().split("-")[0].split("_")[0];
    if (langKey === "de") {
      setPrimaryModelDe(modelId);
      localStorage.setItem("settings_primary_piper_model_de", modelId);
    } else if (langKey === "ar") {
      setPrimaryModelAr(modelId);
      localStorage.setItem("settings_primary_piper_model_ar", modelId);
    } else if (langKey === "en") {
      setPrimaryModelEn(modelId);
      localStorage.setItem("settings_primary_piper_model_en", modelId);
    }
    setDownloadSuccessMsg(`تم تعيين (${modelId}) كصوت أساسي للغة ${langKey.toUpperCase()}`);
  };

  const handleSetSecondaryModel = (lang: string, modelId: string) => {
    const langKey = lang.toLowerCase().split("-")[0].split("_")[0];
    if (langKey === "de") {
      setSecondaryModelDe(modelId);
      localStorage.setItem("settings_secondary_piper_model_de", modelId);
    } else if (langKey === "ar") {
      setSecondaryModelAr(modelId);
      localStorage.setItem("settings_secondary_piper_model_ar", modelId);
    } else if (langKey === "en") {
      setSecondaryModelEn(modelId);
      localStorage.setItem("settings_secondary_piper_model_en", modelId);
    }
  };

  const handlePreloadLocalCache = async () => {
    setIsPreloadingLocal(true);
    setLocalPreloadedMsg(null);
    setLocalInstallProgress(10);
    setLocalInstallStep("فحص دعم WebAssembly بالمتصفح...");

    try {
      await configureOnnxRuntime();
      const piperWeb = await import("@mintplex-labs/piper-tts-web");
      if (piperWeb?.TtsSession?.WASM_LOCATIONS) {
        piperWeb.TtsSession.WASM_LOCATIONS.onnxWasm = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
      }

      setLocalInstallProgress(30);
      setLocalInstallStep("مزامنة النماذج المنزّلة...");

      let downloadedList: any[] = [];
      try {
        const res = await fetch("/api/tts/catalog");
        if (res.ok) {
          const data = await res.json();
          if (data.models) {
            downloadedList = data.models.filter((m: any) => m.isDownloaded);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch catalog during local preload:", e);
      }

      if (downloadedList.length > 0) {
        const stepProgress = 60 / downloadedList.length;
        for (let i = 0; i < downloadedList.length; i++) {
          const m = downloadedList[i];
          setLocalInstallStep(`تخزين (${m.name || m.id}) في المتصفح...`);
          try {
            await piperWeb.download(m.id as any);
          } catch (e) {
            console.warn(`Pre-downloading ${m.id} failed:`, e);
          }
          setLocalInstallProgress(Math.min(90, Math.round(30 + (i + 1) * stepProgress)));
        }
      } else {
        setLocalInstallProgress(75);
        setLocalInstallStep("تمت تهيئة المحرك المحلي");
      }

      setLocalInstallProgress(100);
      setLocalInstallStep("اكتمل التثبيت");

      localStorage.setItem("settings_tts_execution_mode", "local");
      localStorage.setItem("settings_tts_local_installed", "true");
      setTtsExecutionMode("local");

      setLocalPreloadedMsg(
        downloadedList.length > 0
          ? `تمت تهيئة المحرك ومزامنة ${downloadedList.length} نموذج بنجاح`
          : "تمت تهيئة المحرك المحلي بنجاح"
      );
    } catch {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.getVoices();
      }
      localStorage.setItem("settings_tts_execution_mode", "local");
      setTtsExecutionMode("local");
      setLocalPreloadedMsg("تم تفعيل وضع النطق المحلي بالمتصفح");
    } finally {
      setIsPreloadingLocal(false);
    }
  };

  const fetchCatalog = async () => {
    setIsLoadingModels(true);
    try {
      const res = await fetch(`/api/tts/catalog?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          let opfsInstalledIds: string[] = [];
          try {
            if (typeof window !== "undefined" && "storage" in navigator && navigator.storage.getDirectory) {
              const root = await navigator.storage.getDirectory();
              const dir = await root.getDirectoryHandle("piper", { create: false }).catch(() => null);
              if (dir) {
                for (const m of data.models) {
                  const onnxFile = await dir.getFileHandle(`${m.id}.onnx`, { create: false }).catch(() => null);
                  if (onnxFile) opfsInstalledIds.push(m.id);
                }
              }
            }
          } catch {}

          const mergedModels = data.models.map((m: any) => ({
            ...m,
            isDownloaded: m.isDownloaded || opfsInstalledIds.includes(m.id)
          }));

          setCatalogModels(mergedModels);
          const downloaded = mergedModels.filter((m: any) => m.isDownloaded);
          setPiperModels(downloaded);

          if (downloaded.length > 0 && (!selectedPiperModel || !downloaded.some((m: any) => m.id === selectedPiperModel))) {
            setSelectedPiperModel(downloaded[0].id);
          } else if (downloaded.length === 0 && !selectedPiperModel) {
            setSelectedPiperModel("");
          }
        }
      }
    } catch (err) {
      console.warn("Failed to fetch Piper catalog:", err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleDownloadModel = async (model: any) => {
    const modelId = model.id;
    setDownloadingIds((prev) => ({ ...prev, [modelId]: true }));
    setDownloadProgressMap((prev) => ({
      ...prev,
      [modelId]: {
        percent: 1,
        loadedMb: "0.0 MB",
        totalMb: model.sizeMb || "60.0 MB",
        step: "جاري التنزيل للخادم..."
      }
    }));
    setDownloadError(null);
    setDownloadSuccessMsg(null);

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tts/models/download-progress?modelId=${encodeURIComponent(modelId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.status === "downloading") {
            setDownloadProgressMap((prev) => ({
              ...prev,
              [modelId]: {
                percent: data.percent ?? 0,
                loadedMb: data.loadedMb || "0.0 MB",
                totalMb: data.totalMb || model.sizeMb || "60.0 MB",
                step: data.step || "جاري التنزيل..."
              }
            }));
          }
        }
      } catch {}
    }, 200);

    try {
      const res = await fetch("/api/tts/models/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model.id,
          urlOnnx: model.urlOnnx,
          urlJson: model.urlJson,
          sizeMb: model.sizeMb
        })
      });

      clearInterval(pollInterval);

      try {
        setDownloadProgressMap((prev) => ({
          ...prev,
          [modelId]: {
            percent: 1,
            loadedMb: "0.0 MB",
            totalMb: model.sizeMb || "60.0 MB",
            step: "التخزين المحلي بالمتصفح..."
          }
        }));
        await configureOnnxRuntime();
        const piperWeb = await import("@mintplex-labs/piper-tts-web");
        if (piperWeb?.TtsSession?.WASM_LOCATIONS) {
          piperWeb.TtsSession.WASM_LOCATIONS.onnxWasm = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
        }
        await piperWeb.download(modelId as any, (p: any) => {
          if (p && p.loaded) {
            const loadedBytes = p.loaded;
            let totalBytes = p.total || 0;
            if (!totalBytes && model.sizeMb) {
              const parsedMb = parseFloat(model.sizeMb);
              if (!isNaN(parsedMb)) totalBytes = Math.round(parsedMb * 1024 * 1024);
            }
            const percent = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
            const loadedMb = (loadedBytes / (1024 * 1024)).toFixed(1) + " MB";
            const totalMb = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) + " MB" : model.sizeMb || "60.0 MB";
            setDownloadProgressMap((prev) => ({
              ...prev,
              [modelId]: {
                percent,
                loadedMb,
                totalMb,
                step: `تخزين محلي: ${loadedMb} / ${totalMb}`
              }
            }));
          }
        });
      } catch {}

      if (res.ok) {
        setDownloadProgressMap((prev) => ({
          ...prev,
          [modelId]: {
            percent: 100,
            loadedMb: prev[modelId]?.totalMb || model.sizeMb || "60.0 MB",
            totalMb: prev[modelId]?.totalMb || model.sizeMb || "60.0 MB",
            step: "اكتمل التنزيل"
          }
        }));
        setDownloadSuccessMsg(`تم تنزيل (${model.name || modelId}) بنجاح`);
        await fetchCatalog();
      } else {
        const errData = await res.json().catch(() => ({}));
        setDownloadError(errData.error || "فشل التنزيل. تأكد من الاتصال بالإنترنت.");
      }
    } catch (err: any) {
      clearInterval(pollInterval);
      setDownloadError(err.message || "حدث خطأ أثناء تنزيل الصوت.");
    } finally {
      clearInterval(pollInterval);
      setDownloadingIds((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const handleDownloadCustom = async () => {
    if (!customModelId.trim()) {
      setDownloadError("يرجى إدخال معرّف الصوت.");
      return;
    }
    const modelId = customModelId.trim();
    setIsDownloadingCustom(true);
    setDownloadProgressMap((prev) => ({
      ...prev,
      [modelId]: { percent: 1, loadedMb: "0.0 MB", totalMb: "60.0 MB", step: "تنزيل النموذج المخصص..." }
    }));
    setDownloadError(null);
    setDownloadSuccessMsg(null);

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tts/models/download-progress?modelId=${encodeURIComponent(modelId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.status === "downloading") {
            setDownloadProgressMap((prev) => ({
              ...prev,
              [modelId]: {
                percent: data.percent ?? 0,
                loadedMb: data.loadedMb || "0.0 MB",
                totalMb: data.totalMb || "60.0 MB",
                step: data.step || "جاري التنزيل..."
              }
            }));
          }
        }
      } catch {}
    }, 200);

    try {
      const res = await fetch("/api/tts/models/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          urlOnnx: customModelUrl.trim() || undefined,
          urlJson: customModelJsonUrl.trim() || undefined
        })
      });
      clearInterval(pollInterval);

      try {
        const piperWeb = await import("@mintplex-labs/piper-tts-web");
        await piperWeb.download(modelId as any);
      } catch {}

      if (res.ok) {
        setDownloadSuccessMsg(`تم تنزيل الصوت المخصص (${modelId}) بنجاح`);
        setCustomModelId("");
        setCustomModelUrl("");
        setCustomModelJsonUrl("");
        setShowCustomModelForm(false);
        await fetchCatalog();
      } else {
        const errData = await res.json().catch(() => ({}));
        setDownloadError(errData.error || "فشل تنزيل الصوت المخصص.");
      }
    } catch (err: any) {
      clearInterval(pollInterval);
      setDownloadError(err.message || "حدث خطأ أثناء التنزيل.");
    } finally {
      clearInterval(pollInterval);
      setIsDownloadingCustom(false);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    setConfirmDeleteModelId(null);
    setDeletingIds((prev) => ({ ...prev, [modelId]: true }));
    setDownloadError(null);
    setDownloadSuccessMsg(null);

    try {
      const res = await fetch(`/api/tts/models/${encodeURIComponent(modelId)}`, { method: "DELETE" });

      try {
        if (typeof window !== "undefined" && "storage" in navigator && navigator.storage.getDirectory) {
          const root = await navigator.storage.getDirectory();
          const dir = await root.getDirectoryHandle("piper", { create: false }).catch(() => null);
          if (dir) {
            const onnxFile = await dir.getFileHandle(`${modelId}.onnx`, { create: false }).catch(() => null);
            if (onnxFile) await onnxFile.remove();
            const jsonFile = await dir.getFileHandle(`${modelId}.onnx.json`, { create: false }).catch(() => null);
            if (jsonFile) await jsonFile.remove();
          }
        }
      } catch {}

      try {
        const piperWeb = await import("@mintplex-labs/piper-tts-web");
        if (piperWeb?.remove) await piperWeb.remove(modelId as any).catch(() => {});
      } catch {}

      setDownloadProgressMap((prev) => {
        const next = { ...prev };
        delete next[modelId];
        return next;
      });
      setCatalogModels((prev) =>
        prev.map((m) => (m.id === modelId ? { ...m, isDownloaded: false, installedSizeMb: null } : m))
      );
      setPiperModels((prev) => prev.filter((m) => m.id !== modelId));
      await fetchCatalog();

      if (res.ok) {
        setDownloadSuccessMsg(`تمت إزالة (${modelId}) وتحرير المساحة`);
      } else {
        const errData = await res.json().catch(() => ({}));
        setDownloadError(errData.error || "فشل حذف النموذج.");
      }
    } catch (err: any) {
      setDownloadError(err.message || "حدث خطأ أثناء الحذف.");
    } finally {
      setDeletingIds((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const handleClearAllModels = async () => {
    setConfirmClearAllModels(false);
    setIsClearingAllModels(true);
    setDownloadError(null);
    setDownloadSuccessMsg(null);
    try {
      const res = await fetch("/api/tts/models/clear-all", { method: "POST" });
      try {
        if (typeof window !== "undefined" && "storage" in navigator && navigator.storage.getDirectory) {
          const root = await navigator.storage.getDirectory();
          const dir = await root.getDirectoryHandle("piper", { create: false }).catch(() => null);
          if (dir) await dir.remove({ recursive: true }).catch(() => {});
        }
      } catch {}
      try {
        const piperWeb = await import("@mintplex-labs/piper-tts-web");
        if (piperWeb?.flush) await piperWeb.flush().catch(() => {});
      } catch {}

      setDownloadProgressMap({});
      setCatalogModels((prev) => prev.map((m) => ({ ...m, isDownloaded: false, installedSizeMb: null })));
      setPiperModels([]);
      await fetchCatalog();

      if (res.ok) {
        setDownloadSuccessMsg("تم حذف جميع نماذج الأصوات وتفريغ المساحة");
      } else {
        setDownloadError("حدث خطأ أثناء مسح النماذج.");
      }
    } catch (err: any) {
      setDownloadError(err.message || "حدث خطأ أثناء المسح.");
    } finally {
      setIsClearingAllModels(false);
    }
  };

  const filteredDiagnosticLogs = useMemo(() => {
    if (diagFilter === "all") return diagnosticLogList;
    return diagnosticLogList.filter((l) => l.type === diagFilter);
  }, [diagnosticLogList, diagFilter]);

  const activeDownloadingModelIds = useMemo(
    () => Object.keys(downloadingIds).filter((id) => downloadingIds[id]),
    [downloadingIds]
  );

  const isAnyDownloading = activeDownloadingModelIds.length > 0 || isDownloadingCustom || isPreloadingLocal;

  const calculateCacheStats = async () => {
    if (!("caches" in window)) return;
    setIsCalculatingCache(true);
    try {
      const imgCache = await caches.open("image-cache-v1");
      const imgKeys = await imgCache.keys();
      setImageCacheCount(imgKeys.length);
      let imgSizeSum = 0;
      for (const request of imgKeys) {
        try {
          const response = await imgCache.match(request);
          if (response) imgSizeSum += (await response.blob()).size;
        } catch {}
      }
      setImageCacheSize((imgSizeSum / (1024 * 1024)).toFixed(2) + " MB");

      const audioCache = await caches.open("tts-audio-cache-v1");
      const audioKeys = await audioCache.keys();
      setTtsCacheCount(audioKeys.length);
      let audioSizeSum = 0;
      for (const request of audioKeys) {
        try {
          const response = await audioCache.match(request);
          if (response) audioSizeSum += (await response.blob()).size;
        } catch {}
      }
      setTtsCacheSize((audioSizeSum / (1024 * 1024)).toFixed(2) + " MB");
    } catch (err) {
      console.error("Failed to calculate cache stats:", err);
    } finally {
      setIsCalculatingCache(false);
    }
  };

  const clearImageCache = async () => {
    if (!("caches" in window)) return;
    try {
      const deleted = await caches.delete("image-cache-v1");
      if (deleted) {
        for (const key in imageCache) delete imageCache[key];
        setImageCacheCount(0);
        setImageCacheSize("0.00 MB");
      }
    } catch (err) {
      console.error("Failed to delete image cache:", err);
    }
  };

  const clearTtsCache = async () => {
    if (!("caches" in window)) return;
    try {
      const deleted = await caches.delete("tts-audio-cache-v1");
      if (deleted) {
        for (const key in ttsCache) delete ttsCache[key];
        setTtsCacheCount(0);
        setTtsCacheSize("0.00 MB");
      }
    } catch (err) {
      console.error("Failed to delete TTS cache:", err);
    }
  };

  const syncModalStatesFromLocalStorage = () => {
    setAudioApi(localStorage.getItem("settings_audio_api") || "google_proxy");
    setCustomTtsUrl(localStorage.getItem("settings_custom_tts_url") || "");
    setImageApi(localStorage.getItem("settings_image_api") || "duckduckgo");
    setPixabayKey(localStorage.getItem("settings_pixabay_key") || "");
    setGeminiApiKey(localStorage.getItem("settings_gemini_api_key") || "");
    setGroqApiKey(localStorage.getItem("settings_groq_api_key") || "");
    setAiProvider(localStorage.getItem("settings_ai_provider") || "gemini");
    setEnableInlinePersonaCorrection(localStorage.getItem("settings_enable_persona_correction") !== "false");
    setTtsExecutionMode((localStorage.getItem("settings_tts_execution_mode") as "local" | "server") || "server");

    setPrimaryModelDe(localStorage.getItem("settings_primary_piper_model_de") || "de_DE-thorsten-medium");
    setPrimaryModelAr(localStorage.getItem("settings_primary_piper_model_ar") || "ar_JO-kareem-medium");
    setPrimaryModelEn(localStorage.getItem("settings_primary_piper_model_en") || "en_US-lessac-medium");

    setReviewVoiceTarget((localStorage.getItem("settings_review_voice_target") as "primary" | "secondary") || "primary");
    setEnableSecondaryAudioReview(localStorage.getItem("settings_enable_secondary_audio_review") === "true");
    setEnableAudioPreloadReview(localStorage.getItem("settings_preload_audio_review") === "true");
    setSecondaryModelDe(localStorage.getItem("settings_secondary_piper_model_de") || "google");
    setSecondaryModelAr(localStorage.getItem("settings_secondary_piper_model_ar") || "google");
    setSecondaryModelEn(localStorage.getItem("settings_secondary_piper_model_en") || "google");

    setPrimaryGradioLangDe(localStorage.getItem("settings_primary_gradio_lang_de") || "german");
    setPrimaryGradioLangAr(localStorage.getItem("settings_primary_gradio_lang_ar") || "arabic");
    setPrimaryGradioLangEn(localStorage.getItem("settings_primary_gradio_lang_en") || "english");
    setSecondaryGradioLangDe(localStorage.getItem("settings_secondary_gradio_lang_de") || "german");
    setSecondaryGradioLangAr(localStorage.getItem("settings_secondary_gradio_lang_ar") || "arabic");
    setSecondaryGradioLangEn(localStorage.getItem("settings_secondary_gradio_lang_en") || "english");
    setGradioTtsUrl(localStorage.getItem("settings_gradio_tts_url") || "http://192.168.0.159:7860");
    setEnableChatAnimations(localStorage.getItem("settings_ai_chat_animations") !== "false");
    setEnableGeneralAnimations(localStorage.getItem("settings_general_animations") !== "false");
    setPiperStandbyMode((localStorage.getItem("settings_piper_standby_mode") as "idle_60s" | "always_ready") || "idle_60s");

    const savedScale = localStorage.getItem("settings_site_scale");
    const initialScale = savedScale ? parseInt(savedScale, 10) : 100;
    setSiteScale(initialScale);
    initialScaleRef.current = initialScale;
    setSecondarySections(loadSecondarySectionsVisibility());
    setStoredSettingsCount(countStoredSettings(backupIncludeApiKeys));
  };

  useEffect(() => {
    if (isOpen) {
      syncModalStatesFromLocalStorage();
      setBackupFeedback(null);
      setBackupCopiedNotice(false);

      setTestImages([]);
      setImgSearchStatus(null);
      setTtsStatus("idle");
      setIsSpeaking(false);
      setSearchQuery("");
      setConfirmDeleteModelId(null);
      setConfirmClearAllModels(false);

      if (Object.values(downloadingIds).some(Boolean) || isDownloadingCustom) {
        setRoute("audio_models");
      } else if (isPreloadingLocal) {
        setRoute("audio");
      } else {
        setRoute("home");
      }

      calculateCacheStats();
      fetchCatalog();
      fetchPiperEngineStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    setStoredSettingsCount(countStoredSettings(backupIncludeApiKeys));
  }, [backupIncludeApiKeys]);

  const buildCurrentSettingsOverrides = (): Record<string, string> => ({
    settings_audio_api: audioApi,
    settings_custom_tts_url: customTtsUrl,
    settings_image_api: imageApi,
    settings_pixabay_key: pixabayKey,
    settings_gemini_api_key: geminiApiKey,
    settings_groq_api_key: groqApiKey,
    settings_ai_provider: aiProvider,
    settings_enable_persona_correction: String(enableInlinePersonaCorrection),
    settings_tts_execution_mode: ttsExecutionMode,
    settings_site_scale: String(siteScale),
    settings_primary_piper_model_de: primaryModelDe,
    settings_primary_piper_model_ar: primaryModelAr,
    settings_primary_piper_model_en: primaryModelEn,
    settings_review_voice_target: reviewVoiceTarget,
    settings_enable_secondary_audio_review: String(enableSecondaryAudioReview),
    settings_preload_audio_review: String(enableAudioPreloadReview),
    settings_secondary_piper_model_de: secondaryModelDe,
    settings_secondary_piper_model_ar: secondaryModelAr,
    settings_secondary_piper_model_en: secondaryModelEn,
    settings_primary_gradio_lang_de: primaryGradioLangDe,
    settings_primary_gradio_lang_ar: primaryGradioLangAr,
    settings_primary_gradio_lang_en: primaryGradioLangEn,
    settings_secondary_gradio_lang_de: secondaryGradioLangDe,
    settings_secondary_gradio_lang_ar: secondaryGradioLangAr,
    settings_secondary_gradio_lang_en: secondaryGradioLangEn,
    settings_gradio_tts_url: gradioTtsUrl,
    settings_ai_chat_animations: String(enableChatAnimations),
    settings_general_animations: String(enableGeneralAnimations),
    settings_piper_standby_mode: piperStandbyMode,
  });

  const handleDownloadSettingsJson = () => {
    try {
      const snapshot = collectLocalSettingsSnapshot({
        includeApiKeys: backupIncludeApiKeys,
        overrides: buildCurrentSettingsOverrides(),
      });
      const jsonText = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `settings-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupFeedback({
        type: "success",
        text: `تم تصدير ${snapshot.settingsCount} إعداداً في ملف JSON بنجاح.`
      });
    } catch (err: any) {
      setBackupFeedback({
        type: "error",
        text: err?.message || "تعذر تصدير الإعدادات."
      });
    }
  };

  const handleCopySettingsJson = async () => {
    try {
      const snapshot = collectLocalSettingsSnapshot({
        includeApiKeys: backupIncludeApiKeys,
        overrides: buildCurrentSettingsOverrides(),
      });
      const jsonText = JSON.stringify(snapshot, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = jsonText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setBackupCopiedNotice(true);
      setBackupFeedback({
        type: "success",
        text: `تم نسخ ${snapshot.settingsCount} إعداداً بصيغة JSON — يمكنك حفظها في أي مكان.`
      });
      setTimeout(() => setBackupCopiedNotice(false), 2500);
    } catch (err: any) {
      setBackupFeedback({
        type: "error",
        text: err?.message || "تعذر نسخ نص JSON."
      });
    }
  };

  const applyImportedSettingsJson = (rawText: string) => {
    try {
      const result = importLocalSettingsSnapshot(rawText, { allowApiKeys: true });
      syncModalStatesFromLocalStorage();
      setBackupImportText("");
      setBackupFeedback({
        type: "success",
        text: `تم استيراد وتطبيق ${result.importedCount} إعداداً بنجاح.${
          result.includesApiKeys ? " (تم تضمين مفاتيح API)" : ""
        }`
      });
    } catch (err: any) {
      setBackupFeedback({
        type: "error",
        text: err?.message || "ملف أو نص JSON غير صالح."
      });
    }
  };

  const handleUploadSettingsJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      applyImportedSettingsJson(text);
    };
    reader.onerror = () => {
      setBackupFeedback({ type: "error", text: "تعذر قراءة الملف المحدد." });
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  useEffect(() => {
    const unsub = subscribeDiagnosticLogs(() => {
      setDiagnosticLogList([...globalDiagnosticLogs]);
    });
    return () => unsub();
  }, []);

  const handleSave = () => {
    localStorage.setItem("settings_audio_api", audioApi);
    localStorage.setItem("settings_custom_tts_url", customTtsUrl);
    localStorage.setItem("settings_image_api", imageApi);
    localStorage.setItem("settings_pixabay_key", pixabayKey);
    localStorage.setItem("settings_gemini_api_key", geminiApiKey);
    localStorage.setItem("settings_groq_api_key", groqApiKey);
    localStorage.setItem("settings_ai_provider", aiProvider);
    localStorage.setItem("settings_enable_persona_correction", String(enableInlinePersonaCorrection));
    localStorage.setItem("settings_tts_execution_mode", ttsExecutionMode);
    localStorage.setItem("settings_site_scale", String(siteScale));
    localStorage.setItem("settings_primary_piper_model_de", primaryModelDe);
    localStorage.setItem("settings_primary_piper_model_ar", primaryModelAr);
    localStorage.setItem("settings_primary_piper_model_en", primaryModelEn);
    localStorage.setItem("settings_review_voice_target", reviewVoiceTarget);
    localStorage.setItem("settings_enable_secondary_audio_review", String(enableSecondaryAudioReview));
    localStorage.setItem("settings_preload_audio_review", String(enableAudioPreloadReview));
    localStorage.setItem("settings_secondary_piper_model_de", secondaryModelDe);
    localStorage.setItem("settings_secondary_piper_model_ar", secondaryModelAr);
    localStorage.setItem("settings_secondary_piper_model_en", secondaryModelEn);
    saveSecondarySectionsVisibility(secondarySections);
    onClose();
  };

  const handleCancel = () => {
    applyScale(initialScaleRef.current);
    onClose();
  };

  const handleBack = () => {
    if (route === "audio_models" || route === "audio_gradio" || route === "audio_test") {
      setRoute("audio");
    } else {
      setRoute("home");
    }
  };

  const runFullSystemCheck = async () => {
    setIsTestingSystem(true);
    const results: Record<string, { ok: boolean; msg: string; cause?: string; solution?: string; ms?: number }> = {};

    const t0 = Date.now();
    try {
      const res = await fetch("/api/tts/catalog");
      const ms = Date.now() - t0;
      if (res.ok) {
        const data = await res.json();
        const downloadedCount = data.models?.filter((m: any) => m.isDownloaded).length || 0;
        results["piper"] = { ok: true, msg: `جاهز (${downloadedCount} نموذج مثبّت)`, ms };
      } else {
        results["piper"] = {
          ok: false,
          msg: `خطأ من الخادم (HTTP ${res.status})`,
          cause: "تعذر الوصول لمسار /api/tts/catalog",
          solution: "تحقق من تشغيل السيرفر",
          ms
        };
      }
    } catch (e: any) {
      results["piper"] = {
        ok: false,
        msg: "تعذر الاتصال بمحرك Piper",
        cause: e?.message || "انقطاع الاتصال",
        solution: "تأكد من تشغيل السيرفر",
        ms: Date.now() - t0
      };
    }

    const t1 = Date.now();
    try {
      const res = await fetch("/api/tts?text=test&lang=de&voice=google");
      const ms = Date.now() - t1;
      if (res.ok && res.headers.get("content-type")?.includes("audio")) {
        results["google_tts"] = { ok: true, msg: "خدمة Google TTS متاحة", ms };
      } else {
        results["google_tts"] = {
          ok: false,
          msg: "فشل جلب الصوت من Google TTS",
          solution: "تأكد من اتصال الإنترنت",
          ms
        };
      }
    } catch (e: any) {
      results["google_tts"] = {
        ok: false,
        msg: "تعذر الاتصال بـ Google TTS",
        cause: e?.message,
        solution: "افحص اتصال الإنترنت",
        ms: Date.now() - t1
      };
    }

    results["webspeech"] =
      typeof window !== "undefined" && "speechSynthesis" in window
        ? { ok: true, msg: "محرك نطق المتصفح مدعوم" }
        : { ok: false, msg: "المتصفح لا يدعم WebSpeech", solution: "استخدم Chrome أو Edge" };

    try {
      localStorage.setItem("__test_diag", "1");
      localStorage.removeItem("__test_diag");
      results["storage"] = { ok: true, msg: "التخزين المحلي يعمل بشكل سليم" };
    } catch {
      results["storage"] = {
        ok: false,
        msg: "التخزين المحلي محظور",
        solution: "اسمح بالتخزين المحلي في المتصفح"
      };
    }

    setSystemTestResults(results);
    setIsTestingSystem(false);
    addDiagnosticLog({
      category: "SYSTEM",
      type: "info",
      title: "فحص شامل للأنظمة",
      message: "تم فحص الصوتيات والتخزين",
      details: results
    });
  };

  const handleTestSpeech = async (customText?: string, modelOverride?: string) => {
    if (isSpeaking || ttsStatus === "generating") return;
    const textToSpeak = customText || testVoiceText;
    if (!textToSpeak || !textToSpeak.trim()) {
      setSpeechError({
        msg: "أدخل نصاً لتجربة النطق"
      });
      return;
    }
    stopActiveAudio();
    setSpeechError(null);
    setDetailedTtsAnalysis(null);

    const modelToUse = modelOverride || selectedPiperModel;
    let langToUse = testVoiceLang || "de";
    if (modelToUse.startsWith("de")) langToUse = "de";
    else if (modelToUse.startsWith("ar")) langToUse = "ar";
    else if (modelToUse.startsWith("en")) langToUse = "en";

    setIsSpeaking(true);
    setTtsStatus("generating");

    const isGradioVoice =
      modelToUse.startsWith("gradio:") ||
      modelToUse.startsWith("gradio_") ||
      ["ryan", "serena", "vivian", "aiden", "eric", "dylan", "uncle_fu", "ono_anna", "sohee"].includes(
        modelToUse.toLowerCase()
      );

    if (isGradioVoice) {
      const voiceId = modelToUse.replace(/^gradio[:_]/i, "").trim() || "ryan";
      setServerTtsStepInfo({ status: "found", msg: `الإرسال إلى Gradio (${voiceId})...` });
      const gradioRes = await playGradioClientAudio(textToSpeak, voiceId, langToUse, gradioTtsUrl);
      if (gradioRes.ok) {
        setServerTtsStepInfo({ status: "success", msg: `تم التشغيل عبر Gradio (${voiceId})` });
      } else {
        setServerTtsStepInfo(null);
        setSpeechError({
          msg: gradioRes.error || "فشل الاتصال بسيرفر Gradio",
          solution: "تأكد من تشغيل سيرفر Gradio على الشبكة"
        });
      }
      setTtsStatus("idle");
      setIsSpeaking(false);
      return;
    }

    if (
      ttsExecutionMode === "local" ||
      modelToUse === "webspeech" ||
      modelToUse === "browser_speech" ||
      modelToUse === "local"
    ) {
      setTtsStatus("playing");
      if (modelToUse === "webspeech" || modelToUse === "browser_speech") {
        playBrowserSynthesis(
          textToSpeak,
          langToUse,
          () => {
            setTtsStatus("idle");
            setIsSpeaking(false);
          },
          () => {
            setTtsStatus("idle");
            setIsSpeaking(false);
          }
        );
      } else {
        playPiperLocalWasm(
          textToSpeak,
          langToUse,
          modelToUse,
          () => {
            setTtsStatus("idle");
            setIsSpeaking(false);
            setLocalTtsStage(null);
          },
          (errMsg) => {
            setTtsStatus("idle");
            setIsSpeaking(false);
            setLocalTtsStage(null);
            const analysis = parseLocalTtsErrorDetails(errMsg || "فشل النطق المحلي", modelToUse);
            setDetailedTtsAnalysis(analysis);
            setSpeechError({
              msg: `فشل التوليد عند ${analysis.stepTitle}`,
              cause: analysis.cause,
              solution: analysis.solution
            });
          },
          (stepNum, stepTitle) => setLocalTtsStage({ step: stepNum, title: stepTitle })
        );
      }
      return;
    }

    try {
      const url = `/api/tts?text=${encodeURIComponent(textToSpeak.trim())}&lang=${langToUse}&voice=${encodeURIComponent(
        modelToUse
      )}&_t=${Date.now()}`;
      const isDownloadedInCatalog = catalogModels.some((m) => m.id === modelToUse && m.isDownloaded);
      setServerTtsStepInfo({
        status: isDownloadedInCatalog ? "found" : "downloading",
        msg: isDownloadedInCatalog
          ? `جاري توليد الصوت عبر (${modelToUse})...`
          : `جاري تنزيل (${modelToUse}) وتوليد الصوت...`
      });

      const res = await fetch(url);
      if (res.ok && res.headers.get("content-type")?.includes("audio")) {
        if (!isDownloadedInCatalog) fetchCatalog();
        setServerTtsStepInfo({ status: "success", msg: `تم التشغيل بنجاح (${modelToUse})` });
        const blob = await res.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        currentActiveAudioCheckAndPlay(audio);
        return;
      }

      let serverErrorMsg = `خطأ من الخادم: HTTP ${res.status}`;
      let causeMsg = "";
      let solutionMsg = "";
      let checksSummary: any[] = [];
      let technicalDetails: any = null;
      let failedStepTitle = "";
      try {
        const errJson = await res.json();
        serverErrorMsg = errJson.error || errJson.message || serverErrorMsg;
        failedStepTitle = errJson.failedStepTitle || "";
        causeMsg = errJson.errorReason || errJson.cause || "";
        solutionMsg = errJson.suggestedSolution || errJson.solution || "";
        checksSummary = errJson.checksSummary || [];
        technicalDetails = errJson.technicalDetails || null;
      } catch {}

      setSpeechError({
        msg: serverErrorMsg,
        cause: causeMsg,
        solution: solutionMsg,
        checksSummary,
        technicalDetails,
        failedStepTitle
      });
      setTtsStatus("idle");
      setIsSpeaking(false);
    } catch (err: any) {
      setSpeechError({
        msg: `تعذر الاتصال بالسيرفر: ${err?.message || err}`,
        solution: "تأكد من تشغيل السيرفر"
      });
      setTtsStatus("idle");
      setIsSpeaking(false);
    }
  };

  const currentActiveAudioCheckAndPlay = async (audio: HTMLAudioElement) => {
    setTtsStatus("playing");
    audio.onended = () => {
      setTtsStatus("idle");
      setIsSpeaking(false);
    };
    audio.onerror = () => {
      setSpeechError({ msg: "تعذر تشغيل الصوت بالمتصفح" });
      setTtsStatus("idle");
      setIsSpeaking(false);
    };
    try {
      await audio.play();
    } catch {
      setSpeechError({ msg: "حظر المتصفح التشغيل التلقائي — انقر مرة أخرى" });
      setTtsStatus("idle");
      setIsSpeaking(false);
    }
  };

  const handleTestImageSearch = async () => {
    if (!testImgQuery.trim()) return;
    setIsSearchingImages(true);
    setImgSearchStatus(null);
    try {
      let url = `/api/images?q=${encodeURIComponent(testImgQuery)}&page=1`;
      url += imageApi === "pixabay" ? `&provider=pixabay&customKey=${encodeURIComponent(pixabayKey)}` : `&provider=duckduckgo`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const hits = data.hits || [];
        setTestImages(hits.slice(0, 3));
        setImgSearchStatus(hits.length === 0 ? "لا توجد نتائج" : `تم العثور على ${hits.length} نتيجة`);
      } else {
        setImgSearchStatus("تعذر الاتصال بمحرك الصور");
      }
    } catch {
      setImgSearchStatus("حدث خطأ أثناء البحث");
    } finally {
      setIsSearchingImages(false);
    }
  };

  // Search index for fast Android-style settings lookup
  const searchableEntries = useMemo(() => {
    const entries: Array<{ title: string; sectionLabel: string; keywords: string; target: SettingsRoute }> = [
      { title: "أصوات البطاقات الأساسية والثانوية", sectionLabel: "الصوت والنطق", keywords: "صوت بطاقات الماني عربي انجليزي اساسي ثانوي", target: "audio" },
      { title: "مكان توليد الصوت (محلي / سيرفر)", sectionLabel: "الصوت والنطق", keywords: "محلي سيرفر wasm piper browser", target: "audio" },
      { title: "حالة محرك Piper وتوفير الذاكرة", sectionLabel: "الصوت والنطق", keywords: "رام ذاكرة خمول تهيئة تفريغ standby", target: "audio" },
      { title: "التحميل المسبق للأصوات بالمراجعة", sectionLabel: "الصوت والنطق", keywords: "تحميل مسبق preload مراجعة", target: "audio" },
      { title: "إدارة وتنزيل نماذج Piper", sectionLabel: "الصوت والنطق", keywords: "تنزيل حذف نماذج موديلات صوت مخصص huggingface", target: "audio_models" },
      { title: "سيرفر الصوت الخارجي Gradio", sectionLabel: "الصوت والنطق", keywords: "gradio qwen3 lan رابط عنوان", target: "audio_gradio" },
      { title: "تجربة النطق المباشر والمعمل", sectionLabel: "الصوت والنطق", keywords: "اختبار معمل تجربة نطق sandbox", target: "audio_test" },
      { title: "مزود الذكاء الاصطناعي ومفاتيح API", sectionLabel: "الذكاء الاصطناعي", keywords: "gemini groq api key مفتاح ذكاء", target: "ai" },
      { title: "التصحيح اللغوي التلقائي بالمحادثات", sectionLabel: "الذكاء الاصطناعي", keywords: "تصحيح تلقائي محادثة شخصيات", target: "ai" },
      { title: "حجم وتكبير الواجهة", sectionLabel: "المظهر والواجهة", keywords: "تكبير حجم الخط واجهة مقياس scale zoom", target: "appearance" },
      { title: "الحركات والفتح الفوري للذكاء", sectionLabel: "المظهر والواجهة", keywords: "انيميشن حركة سرعة فتح فوري 0 ثانية", target: "appearance" },
      { title: "إظهار وإخفاء أقسام القائمة الجانبية", sectionLabel: "المظهر والواجهة", keywords: "اقسام قائمة مصحح وسائط كتابات شادوينج", target: "appearance" },
      { title: "محرك البحث عن الصور", sectionLabel: "البحث عن الصور", keywords: "صور duckduckgo pixabay بحث", target: "images" },
      { title: "تثبيت التطبيق على الجوال (PWA)", sectionLabel: "التطبيق والتخزين", keywords: "تثبيت تطبيق جوال pwa اندرويد ايفون", target: "storage" },
      { title: "مسح الذاكرة المؤقتة للصور والصوت", sectionLabel: "التطبيق والتخزين", keywords: "ذاكرة مؤقتة كاش cache مسح مساحة", target: "storage" },
      { title: "تصدير واستيراد الإعدادات (JSON)", sectionLabel: "النسخ الاحتياطي للإعدادات", keywords: "تصدير استيراد نسخ احتياطي جيسون json اعدادات مراجعة نقل حساب", target: "backup" },
      { title: "فحص الأنظمة وسجل الأخطاء", sectionLabel: "الفحص والتشخيص", keywords: "تشخيص اعطال اخطاء سجل فحص", target: "diagnostics" }
    ];
    if (isAdminUser) {
      entries.push({
        title: "إدارة الحسابات والمستخدمين",
        sectionLabel: "الحسابات",
        keywords: "حسابات مستخدمين كلمة مرور مشرف supabase",
        target: "accounts"
      });
    }
    return entries;
  }, [isAdminUser]);

  const filteredSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return searchableEntries.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.sectionLabel.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q)
    );
  }, [searchQuery, searchableEntries]);

  // Minimized background download badge when closed
  if (!isOpen) {
    if (!isAnyDownloading) return null;

    const activeModelId =
      activeDownloadingModelIds[0] ||
      (isDownloadingCustom ? customModelId.trim() || "صوت مخصص" : "تجهيز الصوت");
    const activeProgress = downloadProgressMap[activeModelId];
    const progressPercent = activeProgress
      ? Math.min(100, Math.max(0, activeProgress.percent || 0))
      : isPreloadingLocal
      ? localInstallProgress
      : 1;
    const loadedInfo =
      activeProgress?.loadedMb && activeProgress?.totalMb
        ? `${activeProgress.loadedMb} / ${activeProgress.totalMb}`
        : `${Math.round(progressPercent)}%`;
    const strokeDashoffset = 138.23 - (138.23 * progressPercent) / 100;

    return (
      <div
        dir="rtl"
        className="fixed bottom-20 md:bottom-6 left-4 md:left-6 z-[200] cursor-pointer group select-none"
        onClick={() => onOpen?.()}
        title="العودة إلى الإعدادات"
      >
        <div className="bg-white/95 backdrop-blur-md border border-[#004ac6]/30 hover:border-[#004ac6] shadow-xl rounded-2xl p-3 pr-4 flex items-center gap-3 transition-all">
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg className="w-12 h-12 -rotate-90 transform" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="22" className="text-slate-200" strokeWidth="4" stroke="currentColor" fill="transparent" />
              <circle
                cx="26"
                cy="26"
                r="22"
                className="text-[#004ac6] transition-all duration-300"
                strokeWidth="4.5"
                strokeDasharray="138.23"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#004ac6] font-black text-[10px] tabular-nums">
              {Math.round(progressPercent)}%
            </div>
          </div>
          <div className="flex flex-col text-right min-w-[130px] max-w-[190px]">
            <span className="text-xs font-bold text-slate-900 truncate">{activeModelId}</span>
            <span className="text-[11px] text-slate-500 tabular-nums truncate" dir="ltr">
              {loadedInfo}
            </span>
            <span className="text-[11px] font-bold text-[#004ac6] flex items-center gap-1 mt-0.5">
              <Maximize2 className="w-3 h-3" />
              <span>فتح</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  const routeTitle: Record<SettingsRoute, string> = {
    home: "الإعدادات",
    audio: "الصوت والنطق",
    audio_models: "نماذج الأصوات (Piper)",
    audio_gradio: "سيرفر Gradio الخارجي",
    audio_test: "تجربة النطق المباشر",
    ai: "الذكاء الاصطناعي",
    appearance: "المظهر والواجهة",
    images: "البحث عن الصور",
    storage: "التطبيق والتخزين",
    backup: "تصدير واستيراد الإعدادات",
    diagnostics: "الفحص والتشخيص",
    accounts: "الحسابات والمستخدمون"
  };

  // Helper to render language voice selector row cleanly
  const renderVoiceSelectRow = (
    flag: string,
    langLabel: string,
    langCode: "de" | "ar" | "en",
    value: string,
    onChangeVal: (val: string) => void,
    gradioLangVal: string,
    onChangeGradioLang: (val: string) => void
  ) => (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2 shrink-0">
          <span>{flag}</span>
          <span>{langLabel}</span>
        </span>
        <select
          value={value}
          onChange={(e) => onChangeVal(e.target.value)}
          className="max-w-[240px] sm:max-w-[300px] flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-semibold focus:border-[#004ac6] focus:bg-white outline-none"
        >
          <optgroup label="سيرفر Gradio المحلي">
            {DEFAULT_GRADIO_VOICES.map((v) => (
              <option key={`gradio:${v.id}`} value={`gradio:${v.id}`}>
                Gradio · {v.name} ({v.gender === "female" ? "أنثوي" : "ذكوري"})
              </option>
            ))}
          </optgroup>
          <optgroup label="محركات مباشرة">
            <option value="google">Google TTS (مباشر)</option>
            <option value="webspeech">صوت المتصفح (Web Speech)</option>
          </optgroup>
          <optgroup label="نماذج Piper">
            {catalogModels
              .filter((m) => m.lang === langCode)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.quality || "Medium"}) {m.isDownloaded ? "· مثبّت" : ""}
                </option>
              ))}
            {value !== "google" &&
              value !== "webspeech" &&
              !value.startsWith("gradio:") &&
              !catalogModels.some((m) => m.id === value) && <option value={value}>{value}</option>}
          </optgroup>
        </select>
      </div>

      {value.startsWith("gradio:") && (
        <div className="flex items-center justify-between gap-3 pr-6">
          <span className="text-[11px] font-medium text-slate-500">لغة Gradio</span>
          <select
            value={gradioLangVal}
            onChange={(e) => onChangeGradioLang(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-semibold focus:border-[#004ac6] outline-none"
          >
            {GRADIO_LANGUAGES.map((gl) => (
              <option key={gl.id} value={gl.id}>
                {gl.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  const activeProviderHasKey =
    aiProvider === "gemini" ? Boolean(geminiApiKey.trim()) : Boolean(groqApiKey.trim());
  const visibleSecondaryCount = Object.values(secondarySections).filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/45 backdrop-blur-sm animate-fade-in"
      dir="rtl"
    >
      <div
        className={`bg-[#f4f7fc] w-full ${
          route === "accounts" ? "sm:max-w-[820px]" : "sm:max-w-[700px]"
        } h-[92dvh] sm:h-[85vh] sm:max-h-[820px] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200/80 transition-[max-width] duration-150`}
      >
        {/* Top Navigation Bar */}
        <header className="h-14 px-4 sm:px-5 border-b border-slate-200/80 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {route !== "home" ? (
              <button
                type="button"
                onClick={handleBack}
                className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-slate-600 hover:text-[#004ac6] hover:bg-slate-100 active:scale-95 transition-all cursor-pointer shrink-0"
                title="رجوع"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center shrink-0">
                <Settings className="w-4.5 h-4.5" />
              </div>
            )}
            <h2 className="font-extrabold text-base sm:text-lg text-slate-900 truncate">
              {routeTitle[route]}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isAnyDownloading && (
              <button
                type="button"
                onClick={handleCancel}
                title="متابعة بالخلفية"
                className="px-3 py-1.5 bg-[#004ac6]/10 hover:bg-[#004ac6]/15 text-[#004ac6] text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Minimize2 className="w-4 h-4" />
                <span className="hidden sm:inline">تصغير</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCancel}
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* ================= HOME: ANDROID SETTINGS DIRECTORY ================= */}
          {route === "home" && (
            <div className="space-y-4">
              {/* Compact Settings Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث في الإعدادات..."
                  className="w-full bg-white border border-slate-200/90 rounded-2xl pr-10 pl-9 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-[#004ac6] focus:ring-2 focus:ring-[#004ac6]/10 outline-none shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {searchQuery.trim() ? (
                <SettingsGroup title="نتائج البحث">
                  {filteredSearchResults.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      لا توجد إعدادات مطابقة لـ "{searchQuery}"
                    </div>
                  ) : (
                    filteredSearchResults.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setRoute(item.target);
                          setSearchQuery("");
                        }}
                        className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-right hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{item.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{item.sectionLabel}</div>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    ))
                  )}
                </SettingsGroup>
              ) : (
                <div className="space-y-4">
                  {/* Group 1: Learning & AI */}
                  <SettingsGroup title="الصوت والذكاء">
                    <AndroidNavRow
                      icon={<Volume2 className="w-5 h-5" />}
                      iconBg="bg-blue-50 text-[#004ac6]"
                      title="الصوت والنطق"
                      value={`${reviewVoiceTarget === "primary" ? "الصوت الأساسي" : "الصوت الثانوي"} · ${
                        ttsExecutionMode === "local" ? "محلي بالمتصفح" : "خادم السيرفر"
                      }`}
                      onClick={() => setRoute("audio")}
                    />
                    <AndroidNavRow
                      icon={<Key className="w-5 h-5" />}
                      iconBg="bg-indigo-50 text-indigo-600"
                      title="الذكاء الاصطناعي"
                      value={`${aiProvider === "gemini" ? "Google Gemini" : "Groq Cloud"} · ${
                        activeProviderHasKey ? "مفتاح مخصص محفوظ" : "مفتاح النظام"
                      }`}
                      onClick={() => setRoute("ai")}
                    />
                    <AndroidNavRow
                      icon={<ImageIcon className="w-5 h-5" />}
                      iconBg="bg-cyan-50 text-cyan-600"
                      title="البحث عن الصور"
                      value={imageApi === "pixabay" ? "Pixabay" : "DuckDuckGo (تلقائي)"}
                      onClick={() => setRoute("images")}
                    />
                  </SettingsGroup>

                  {/* Group 2: Display & Storage */}
                  <SettingsGroup title="الواجهة والتخزين">
                    <AndroidNavRow
                      icon={<LayoutGrid className="w-5 h-5" />}
                      iconBg="bg-amber-50 text-amber-600"
                      title="المظهر والواجهة"
                      value={`التكبير ${siteScale}% · ${enableChatAnimations ? "حركات مفعّلة" : "فتح فوري"} · ${visibleSecondaryCount} أقسام إضافية`}
                      onClick={() => setRoute("appearance")}
                    />
                    <AndroidNavRow
                      icon={<HardDrive className="w-5 h-5" />}
                      iconBg="bg-emerald-50 text-emerald-600"
                      title="التطبيق والتخزين"
                      value={
                        isCalculatingCache
                          ? "جاري حساب المساحة..."
                          : `صور: ${imageCacheSize || "0.00 MB"} · صوتيات: ${ttsCacheSize || "0.00 MB"}`
                      }
                      onClick={() => setRoute("storage")}
                    />
                    <AndroidNavRow
                      icon={<FileJson className="w-5 h-5" />}
                      iconBg="bg-violet-50 text-violet-600"
                      title="تصدير واستيراد الإعدادات"
                      value={`نسخ احتياطي بصيغة JSON (${storedSettingsCount} إعداد محلي)`}
                      onClick={() => setRoute("backup")}
                    />
                  </SettingsGroup>

                  {/* Group 3: System & Accounts */}
                  <SettingsGroup title="النظام">
                    <AndroidNavRow
                      icon={<Activity className="w-5 h-5" />}
                      iconBg="bg-slate-100 text-slate-700"
                      title="الفحص والتشخيص"
                      value={
                        diagnosticLogList.length > 0
                          ? `${diagnosticLogList.length} حدث مسجل`
                          : "فحص الصوتيات والنظام"
                      }
                      onClick={() => setRoute("diagnostics")}
                    />
                    {isAdminUser && (
                      <AndroidNavRow
                        icon={<Users className="w-5 h-5" />}
                        iconBg="bg-slate-100 text-slate-800"
                        title="الحسابات"
                        value="إدارة المستخدمين والصلاحيات"
                        onClick={() => setRoute("accounts")}
                      />
                    )}
                  </SettingsGroup>
                </div>
              )}
            </div>
          )}

          {/* ================= SECTION: AUDIO & SPEECH ================= */}
          {route === "audio" && (
            <div className="space-y-5">
              {/* Sub-pages first: direct Android access */}
              <SettingsGroup title="الأقسام الفرعية">
                <AndroidNavRow
                  icon={<DownloadCloud className="w-5 h-5" />}
                  iconBg="bg-blue-50 text-[#004ac6]"
                  title="نماذج الأصوات (Piper)"
                  value={`${piperModels.length} مثبّت من ${catalogModels.length}`}
                  onClick={() => setRoute("audio_models")}
                />
                <AndroidNavRow
                  icon={<Server className="w-5 h-5" />}
                  iconBg="bg-indigo-50 text-indigo-600"
                  title="سيرفر الصوت الخارجي (Gradio)"
                  value={gradioTtsUrl}
                  onClick={() => setRoute("audio_gradio")}
                />
                <AndroidNavRow
                  icon={<Play className="w-5 h-5" />}
                  iconBg="bg-emerald-50 text-emerald-600"
                  title="تجربة النطق المباشر"
                  value={selectedPiperModel || "تلقائي"}
                  onClick={() => setRoute("audio_test")}
                />
              </SettingsGroup>

              {/* Card Voices */}
              <SettingsGroup title="أصوات البطاقات">
                <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm font-bold text-slate-800">الصوت النشط</span>
                  <SegmentedControl
                    value={reviewVoiceTarget}
                    onChange={(val) => {
                      setReviewVoiceTarget(val);
                      localStorage.setItem("settings_review_voice_target", val);
                      if (val === "secondary" && !enableSecondaryAudioReview) {
                        setEnableSecondaryAudioReview(true);
                        localStorage.setItem("settings_enable_secondary_audio_review", "true");
                      }
                    }}
                    options={[
                      { value: "primary", label: "الأساسي" },
                      { value: "secondary", label: "الثانوي" }
                    ]}
                  />
                </div>

                {renderVoiceSelectRow(
                  "🇩🇪",
                  "الألمانية",
                  "de",
                  primaryModelDe,
                  (v) => handleSetPrimaryModel("de", v),
                  primaryGradioLangDe,
                  (v) => {
                    setPrimaryGradioLangDe(v);
                    localStorage.setItem("settings_primary_gradio_lang_de", v);
                  }
                )}
                {renderVoiceSelectRow(
                  "🇸🇦",
                  "العربية",
                  "ar",
                  primaryModelAr,
                  (v) => handleSetPrimaryModel("ar", v),
                  primaryGradioLangAr,
                  (v) => {
                    setPrimaryGradioLangAr(v);
                    localStorage.setItem("settings_primary_gradio_lang_ar", v);
                  }
                )}
                {renderVoiceSelectRow(
                  "🇺🇸",
                  "الإنجليزية",
                  "en",
                  primaryModelEn,
                  (v) => handleSetPrimaryModel("en", v),
                  primaryGradioLangEn,
                  (v) => {
                    setPrimaryGradioLangEn(v);
                    localStorage.setItem("settings_primary_gradio_lang_en", v);
                  }
                )}

                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-slate-800">زر الصوت الثانوي بالمراجعة</span>
                  <AndroidSwitch
                    checked={enableSecondaryAudioReview}
                    onChange={(val) => {
                      setEnableSecondaryAudioReview(val);
                      localStorage.setItem("settings_enable_secondary_audio_review", String(val));
                    }}
                    ariaLabel="زر الصوت الثانوي"
                    activeColorClass="bg-indigo-600"
                  />
                </div>

                {enableSecondaryAudioReview && (
                  <>
                    {renderVoiceSelectRow(
                      "🇩🇪",
                      "ثانوي · الألمانية",
                      "de",
                      secondaryModelDe,
                      (v) => handleSetSecondaryModel("de", v),
                      secondaryGradioLangDe,
                      (v) => {
                        setSecondaryGradioLangDe(v);
                        localStorage.setItem("settings_secondary_gradio_lang_de", v);
                      }
                    )}
                    {renderVoiceSelectRow(
                      "🇸🇦",
                      "ثانوي · العربية",
                      "ar",
                      secondaryModelAr,
                      (v) => handleSetSecondaryModel("ar", v),
                      secondaryGradioLangAr,
                      (v) => {
                        setSecondaryGradioLangAr(v);
                        localStorage.setItem("settings_secondary_gradio_lang_ar", v);
                      }
                    )}
                    {renderVoiceSelectRow(
                      "🇺🇸",
                      "ثانوي · الإنجليزية",
                      "en",
                      secondaryModelEn,
                      (v) => handleSetSecondaryModel("en", v),
                      secondaryGradioLangEn,
                      (v) => {
                        setSecondaryGradioLangEn(v);
                        localStorage.setItem("settings_secondary_gradio_lang_en", v);
                      }
                    )}
                  </>
                )}

                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800">التحميل المسبق بالمراجعة</div>
                    <div className="text-xs text-slate-500">تجهيز الصوت تلقائياً عند فتح الجلسة</div>
                  </div>
                  <AndroidSwitch
                    checked={enableAudioPreloadReview}
                    onChange={(val) => {
                      setEnableAudioPreloadReview(val);
                      localStorage.setItem("settings_preload_audio_review", String(val));
                    }}
                    ariaLabel="التحميل المسبق للأصوات"
                  />
                </div>
              </SettingsGroup>

              {/* Engine & Performance */}
              <SettingsGroup title="المحرك والأداء">
                <div className="px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">مكان توليد الصوت</span>
                    <SegmentedControl
                      value={ttsExecutionMode}
                      onChange={(val) => {
                        setTtsExecutionMode(val);
                        localStorage.setItem("settings_tts_execution_mode", val);
                      }}
                      options={[
                        { value: "local", label: "محلي بالمتصفح" },
                        { value: "server", label: "خادم السيرفر" }
                      ]}
                    />
                  </div>

                  {ttsExecutionMode === "local" && (
                    <div className="pt-1 space-y-2">
                      {isPreloadingLocal && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold text-emerald-700">
                            <span>{localInstallStep}</span>
                            <span className="tabular-nums">{localInstallProgress}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-full transition-all duration-300"
                              style={{ width: `${localInstallProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={handlePreloadLocalCache}
                          disabled={isPreloadingLocal}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isPreloadingLocal ? "جاري التجهيز..." : "تثبيت وتهيئة بالمتصفح"}</span>
                        </button>
                        {localPreloadedMsg && (
                          <span className="text-xs font-semibold text-emerald-700">{localPreloadedMsg}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Piper Server Standby Mode */}
                <div className="px-4 py-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm font-bold text-slate-800">ذاكرة محرك Piper</div>
                      <div className="text-xs text-slate-500">
                        {piperEngineStatus?.isProcessActive
                          ? `نشط الآن${piperEngineStatus.currentModel ? ` · ${piperEngineStatus.currentModel}` : ""}`
                          : "خامل"}
                      </div>
                    </div>
                    <SegmentedControl
                      value={piperStandbyMode}
                      onChange={handleChangePiperEngineMode}
                      options={[
                        { value: "idle_60s", label: "توفير الرام (60ث)" },
                        { value: "always_ready", label: "جاهز دائماً" }
                      ]}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleWarmupPiperEngine}
                        disabled={isWarmingUpEngine || isUpdatingEngineMode}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Zap className={`w-3.5 h-3.5 text-amber-500 ${isWarmingUpEngine ? "animate-spin" : ""}`} />
                        <span>تهيئة الآن</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleFlushPiperEngine}
                        disabled={isFlushingEngine}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>تفريغ الرام</span>
                      </button>
                    </div>
                    {engineFeedbackMsg && (
                      <span className="text-xs font-semibold text-[#004ac6]">{engineFeedbackMsg}</span>
                    )}
                  </div>
                </div>

                {/* General Card Audio Engine Fallback */}
                <div className="px-4 py-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">محرك النطق العام</span>
                    <SegmentedControl
                      value={audioApi as "google_proxy" | "web_speech" | "custom"}
                      onChange={(val) => setAudioApi(val)}
                      options={[
                        { value: "google_proxy", label: "Piper" },
                        { value: "web_speech", label: "المتصفح" },
                        { value: "custom", label: "رابط مخصص" }
                      ]}
                    />
                  </div>
                  {audioApi === "custom" && (
                    <input
                      type="text"
                      value={customTtsUrl}
                      onChange={(e) => setCustomTtsUrl(e.target.value)}
                      dir="ltr"
                      placeholder="https://api.example.com/tts?text={text}&lang={lang}"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#004ac6] outline-none font-mono"
                    />
                  )}
                </div>

                {/* Server Repair Row */}
                <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800">ملفات محرك السيرفر</div>
                    {repairStatusMsg && (
                      <div className="text-xs text-amber-700 mt-0.5">{repairStatusMsg}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleRepairServerPiper}
                    disabled={isRepairingServer}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRepairingServer ? "animate-spin" : ""}`} />
                    <span>{isRepairingServer ? "جاري الإصلاح..." : "فحص وإصلاح"}</span>
                  </button>
                </div>
              </SettingsGroup>
            </div>
          )}

          {/* ================= SUB-PAGE: PIPER VOICE MODELS ================= */}
          {route === "audio_models" && (
            <div className="space-y-4">
              {downloadSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{downloadSuccessMsg}</span>
                  </span>
                  <button type="button" onClick={() => setDownloadSuccessMsg(null)} className="cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {downloadError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{downloadError}</span>
                  </span>
                  <button type="button" onClick={() => setDownloadError(null)} className="cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Filter & Actions */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <SegmentedControl
                  value={catalogFilter as "all" | "de" | "ar" | "en"}
                  onChange={(v) => setCatalogFilter(v)}
                  options={[
                    { value: "all", label: `الكل (${catalogModels.length})` },
                    { value: "de", label: "ألماني" },
                    { value: "ar", label: "عربي" },
                    { value: "en", label: "إنجليزي" }
                  ]}
                />

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={fetchCatalog}
                    disabled={isLoadingModels}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-[#004ac6] hover:text-[#004ac6] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingModels ? "animate-spin" : ""}`} />
                    <span>تحديث</span>
                  </button>
                  {confirmClearAllModels ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleClearAllModels}
                        disabled={isClearingAllModels}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                      >
                        تأكيد الحذف
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearAllModels(false)}
                        className="px-2 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold cursor-pointer"
                      >
                        تراجع
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearAllModels(true)}
                      disabled={isClearingAllModels || piperModels.length === 0}
                      className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>تفريغ الكل</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Models List */}
              <SettingsGroup>
                {catalogModels
                  .filter((m) => (catalogFilter === "all" ? true : m.lang === catalogFilter))
                  .map((model) => {
                    const isDownloaded = model.isDownloaded;
                    const isDownloading = downloadingIds[model.id];
                    const isDeleting = deletingIds[model.id];
                    const langKey = (model.lang || "de").toLowerCase();
                    const isPrimary =
                      (langKey === "de" && primaryModelDe === model.id) ||
                      (langKey === "ar" && primaryModelAr === model.id) ||
                      (langKey === "en" && primaryModelEn === model.id);
                    const urls = getPiperModelUrls(model);

                    return (
                      <div key={model.id} className="p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{model.flag}</span>
                              <span className="text-sm font-bold text-slate-900 truncate">{model.name}</span>
                              {isPrimary && (
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                              )}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap tabular-nums">
                              <span className="font-mono text-[11px]">{model.id}</span>
                              <span aria-hidden="true">·</span>
                              <span>{model.sizeMb || "60 MB"}</span>
                              {model.quality && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{model.quality}</span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span className={isDownloaded ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                                {isDownloaded ? "مثبّت" : "سحابي"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedLinksMap((prev) => ({ ...prev, [model.id]: !prev[model.id] }))
                              }
                              className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                                expandedLinksMap[model.id]
                                  ? "bg-[#004ac6] text-white border-[#004ac6]"
                                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                              }`}
                              title="روابط التنزيل"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>

                            {isDownloaded ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPiperModel(model.id);
                                    handleTestSpeech(model.sample || undefined, model.id);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-[#004ac6]/10 hover:bg-[#004ac6]/15 text-[#004ac6] text-xs font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                  <span>استماع</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimaryModel(model.lang, model.id)}
                                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 cursor-pointer ${
                                    isPrimary
                                      ? "bg-amber-500 text-white border-amber-500"
                                      : "bg-white border-slate-200 text-slate-700 hover:border-amber-400"
                                  }`}
                                >
                                  <Star className={`w-3.5 h-3.5 ${isPrimary ? "fill-white" : ""}`} />
                                  <span>{isPrimary ? "أساسي" : "تعيين"}</span>
                                </button>
                                {confirmDeleteModelId === model.id ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteModel(model.id)}
                                    disabled={isDeleting}
                                    className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                                  >
                                    حذف؟
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteModelId(model.id)}
                                    disabled={isDeleting}
                                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer disabled:opacity-50"
                                    title="حذف النموذج"
                                  >
                                    {isDeleting ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDownloadModel(model)}
                                disabled={isDownloading}
                                className="px-3.5 py-1.5 rounded-xl bg-[#004ac6] hover:bg-[#003ea8] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                {isDownloading ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                <span>{isDownloading ? "جاري التنزيل..." : "تنزيل"}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {isDownloading && (() => {
                          const prog = downloadProgressMap[model.id] || {
                            percent: 0,
                            loadedMb: "0.0 MB",
                            totalMb: model.sizeMb || "60.0 MB",
                            step: "جاري التنزيل..."
                          };
                          return (
                            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200/80 space-y-1.5">
                              <div className="flex justify-between text-xs font-bold text-[#004ac6] tabular-nums">
                                <span>{prog.step}</span>
                                <span>
                                  {prog.loadedMb} / {prog.totalMb} ({prog.percent}%)
                                </span>
                              </div>
                              <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#004ac6] transition-all duration-300"
                                  style={{ width: `${Math.max(3, Math.min(100, prog.percent))}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {expandedLinksMap[model.id] && (
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-slate-600 w-12 shrink-0">ONNX</span>
                              <input
                                type="text"
                                readOnly
                                dir="ltr"
                                value={urls.urlOnnx}
                                className="flex-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700"
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                              />
                              <button
                                type="button"
                                onClick={() => handleCopyLink(urls.urlOnnx, `onnx_${model.id}`)}
                                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                              >
                                {copiedLinkId === `onnx_${model.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <a
                                href={urls.urlOnnx}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-slate-600 w-12 shrink-0">JSON</span>
                              <input
                                type="text"
                                readOnly
                                dir="ltr"
                                value={urls.urlJson}
                                className="flex-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700"
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                              />
                              <button
                                type="button"
                                onClick={() => handleCopyLink(urls.urlJson, `json_${model.id}`)}
                                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                              >
                                {copiedLinkId === `json_${model.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <a
                                href={urls.urlJson}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </SettingsGroup>

              {/* Custom Model Download */}
              <SettingsGroup>
                <button
                  type="button"
                  onClick={() => setShowCustomModelForm((p) => !p)}
                  className="w-full px-4 py-3 flex items-center justify-between text-right hover:bg-slate-50 cursor-pointer"
                >
                  <span className="text-sm font-bold text-[#004ac6] flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span>إضافة نموذج صوتي مخصص</span>
                  </span>
                  <ChevronLeft
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      showCustomModelForm ? "-rotate-90" : ""
                    }`}
                  />
                </button>

                {showCustomModelForm && (
                  <div className="p-4 space-y-3">
                    <input
                      type="text"
                      value={customModelId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomModelId(val);
                        const clean = val.replace(/\.onnx$/, "").trim();
                        if (clean.includes("-")) {
                          const parts = clean.split("-");
                          const langCode = parts[0];
                          const voiceName = parts[1];
                          const quality = parts[2] || "medium";
                          const langShort = langCode.split("_")[0];
                          if (!customModelUrl || customModelUrl.includes("huggingface.co/rhasspy/piper-voices")) {
                            setCustomModelUrl(
                              `https://huggingface.co/rhasspy/piper-voices/resolve/main/${langShort}/${langCode}/${voiceName}/${quality}/${clean}.onnx`
                            );
                          }
                          if (!customModelJsonUrl || customModelJsonUrl.includes("huggingface.co/rhasspy/piper-voices")) {
                            setCustomModelJsonUrl(
                              `https://huggingface.co/rhasspy/piper-voices/resolve/main/${langShort}/${langCode}/${voiceName}/${quality}/${clean}.onnx.json`
                            );
                          }
                        }
                      }}
                      placeholder="معرّف الصوت (مثال: de_DE-ramona-low)"
                      dir="ltr"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono outline-none focus:border-[#004ac6]"
                    />
                    <input
                      type="text"
                      value={customModelUrl}
                      onChange={(e) => setCustomModelUrl(e.target.value)}
                      placeholder="رابط ملف ONNX"
                      dir="ltr"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono outline-none focus:border-[#004ac6]"
                    />
                    <input
                      type="text"
                      value={customModelJsonUrl}
                      onChange={(e) => setCustomModelJsonUrl(e.target.value)}
                      placeholder="رابط ملف JSON"
                      dir="ltr"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono outline-none focus:border-[#004ac6]"
                    />
                    <button
                      type="button"
                      onClick={handleDownloadCustom}
                      disabled={isDownloadingCustom || !customModelId.trim()}
                      className="w-full py-2.5 rounded-xl bg-[#004ac6] hover:bg-[#003ea8] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <DownloadCloud className="w-4 h-4" />
                      <span>{isDownloadingCustom ? "جاري التنزيل..." : "تنزيل النموذج المخصص"}</span>
                    </button>
                  </div>
                )}
              </SettingsGroup>
            </div>
          )}

          {/* ================= SUB-PAGE: GRADIO SERVER ================= */}
          {route === "audio_gradio" && (
            <div className="space-y-5">
              <SettingsGroup title="عنوان السيرفر">
                <div className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={gradioTtsUrl}
                      onChange={(e) => setGradioTtsUrl(e.target.value)}
                      dir="ltr"
                      placeholder="http://192.168.0.159:7860"
                      className="flex-1 text-xs font-mono px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#004ac6] outline-none"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSaveGradioUrl(gradioTtsUrl)}
                        className="px-3.5 py-2.5 rounded-xl bg-[#004ac6] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {gradioSavedNotice ? <Check className="w-3.5 h-3.5" /> : null}
                        <span>{gradioSavedNotice ? "تم الحفظ" : "حفظ"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveGradioUrl("http://192.168.0.159:7860")}
                        className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        افتراضي
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleTestGradioConnection}
                      disabled={isTestingGradio}
                      className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Activity className={`w-3.5 h-3.5 ${isTestingGradio ? "animate-spin" : ""}`} />
                      <span>{isTestingGradio ? "جاري الفحص..." : "فحص الاتصال"}</span>
                    </button>

                    {gradioTestResult && (
                      <span
                        className={`text-xs font-bold ${
                          gradioTestResult.ok ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {gradioTestResult.msg}
                      </span>
                    )}
                  </div>
                </div>
              </SettingsGroup>

              {gradioVoiceError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-between">
                  <span>{gradioVoiceError}</span>
                  <button type="button" onClick={() => setGradioVoiceError(null)} className="cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <SettingsGroup title={`الأصوات المتاحة (${DEFAULT_GRADIO_VOICES.length})`}>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {DEFAULT_GRADIO_VOICES.map((v) => {
                    const isPlayingThis = playingGradioVoiceId === v.id;
                    return (
                      <div
                        key={v.id}
                        className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/70 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900">{v.name}</span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {v.gender === "female" ? "أنثوي" : "ذكوري"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePlayGradioVoiceSample(v.id, v.sampleText, "de")}
                          disabled={playingGradioVoiceId !== null && !isPlayingThis}
                          className={`w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                            isPlayingThis
                              ? "bg-[#004ac6] text-white"
                              : "bg-white border border-slate-200 text-[#004ac6] hover:bg-blue-50"
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{isPlayingThis ? "جاري التشغيل..." : "استماع للعينة"}</span>
                        </button>

                        <div className="grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryModel("de", `gradio:${v.id}`)}
                            className={`py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                              primaryModelDe === `gradio:${v.id}`
                                ? "bg-amber-500 text-white border-amber-500"
                                : "bg-white border-slate-200 text-slate-700"
                            }`}
                          >
                            ألماني
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryModel("ar", `gradio:${v.id}`)}
                            className={`py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                              primaryModelAr === `gradio:${v.id}`
                                ? "bg-amber-500 text-white border-amber-500"
                                : "bg-white border-slate-200 text-slate-700"
                            }`}
                          >
                            عربي
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryModel("en", `gradio:${v.id}`)}
                            className={`py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                              primaryModelEn === `gradio:${v.id}`
                                ? "bg-amber-500 text-white border-amber-500"
                                : "bg-white border-slate-200 text-slate-700"
                            }`}
                          >
                            إنجليزي
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SettingsGroup>
            </div>
          )}

          {/* ================= SUB-PAGE: LIVE SPEECH TEST ================= */}
          {route === "audio_test" && (
            <div className="space-y-5">
              <SettingsGroup>
                <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-bold text-slate-900">المعمل المتقدم للنطق</div>
                    <div className="text-xs text-slate-500">نافذة مقسمة لتجربة ومقارنة الموديلات</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLiveSandboxOpen(true)}
                    className="px-4 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003ea8] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>فتح المعمل</span>
                  </button>
                </div>
              </SettingsGroup>

              <SettingsGroup title="تجربة سريعة">
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={isSpeaking}
                      onClick={() => {
                        setTestVoiceLang("de");
                        setSelectedPiperModel("de_DE-thorsten-medium");
                        setTestVoiceText("Guten Tag! Wie geht es Ihnen heute?");
                        handleTestSpeech("Guten Tag! Wie geht es Ihnen heute?", "de_DE-thorsten-medium");
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      🇩🇪 Thorsten
                    </button>
                    <button
                      type="button"
                      disabled={isSpeaking}
                      onClick={() => {
                        setTestVoiceLang("ar");
                        setSelectedPiperModel("ar_JO-kareem-medium");
                        setTestVoiceText("مرحباً بك! هذه تجربة النطق باللغة العربية.");
                        handleTestSpeech("مرحباً بك! هذه تجربة النطق باللغة العربية.", "ar_JO-kareem-medium");
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      🇸🇦 Kareem
                    </button>
                    <button
                      type="button"
                      disabled={isSpeaking}
                      onClick={() => {
                        setTestVoiceLang("en");
                        setSelectedPiperModel("en_US-lessac-medium");
                        setTestVoiceText("Welcome! This is a quick voice synthesis test.");
                        handleTestSpeech("Welcome! This is a quick voice synthesis test.", "en_US-lessac-medium");
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      🇺🇸 Lessac
                    </button>
                  </div>

                  <input
                    type="text"
                    value={testVoiceText}
                    onChange={(e) => setTestVoiceText(e.target.value)}
                    placeholder="اكتب نصاً لتجربة النطق..."
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#004ac6] focus:bg-white outline-none"
                  />

                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={selectedPiperModel}
                      onChange={(e) => {
                        const modId = e.target.value;
                        setSelectedPiperModel(modId);
                        if (modId.startsWith("de")) setTestVoiceLang("de");
                        else if (modId.startsWith("ar")) setTestVoiceLang("ar");
                        else if (modId.startsWith("en")) setTestVoiceLang("en");
                      }}
                      className="flex-1 text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-bold outline-none focus:border-[#004ac6]"
                    >
                      <optgroup label="محركات مباشرة">
                        <option value="google">Google TTS</option>
                        <option value="webspeech">صوت المتصفح</option>
                      </optgroup>
                      <optgroup label="نماذج Piper المثبتة">
                        {piperModels.length > 0 ? (
                          piperModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.flag} {m.name} ({m.id})
                            </option>
                          ))
                        ) : (
                          <option value="de_DE-thorsten-medium">🇩🇪 Thorsten (de_DE-thorsten-medium)</option>
                        )}
                      </optgroup>
                    </select>

                    {ttsStatus === "playing" ? (
                      <button
                        type="button"
                        onClick={() => {
                          stopActiveAudio();
                          setTtsStatus("idle");
                          setIsSpeaking(false);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <VolumeX className="w-4 h-4" />
                        <span>إيقاف</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTestSpeech()}
                        disabled={isSpeaking || !testVoiceText.trim()}
                        className="px-5 py-2.5 rounded-xl bg-[#004ac6] hover:bg-[#003ea8] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>{ttsStatus === "generating" ? "جاري التوليد..." : "استمع الآن"}</span>
                      </button>
                    )}
                  </div>

                  {localTtsStage && (
                    <div className="p-2.5 rounded-xl bg-blue-50 text-[#004ac6] text-xs font-semibold">
                      مرحلة {localTtsStage.step}/6: {localTtsStage.title}
                    </div>
                  )}

                  {serverTtsStepInfo && (
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold flex items-center justify-between">
                      <span>{serverTtsStepInfo.msg}</span>
                      <button type="button" onClick={() => setServerTtsStepInfo(null)} className="cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {speechError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1.5">
                      <div className="flex items-center justify-between font-bold">
                        <span>{speechError.msg}</span>
                        <button type="button" onClick={() => setSpeechError(null)} className="cursor-pointer">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {speechError.cause && <p>السبب: {speechError.cause}</p>}
                      {speechError.solution && <p>الحل: {speechError.solution}</p>}
                    </div>
                  )}
                </div>
              </SettingsGroup>
            </div>
          )}

          {/* ================= SECTION: AI PROVIDERS & KEYS ================= */}
          {route === "ai" && (
            <div className="space-y-5">
              <SettingsGroup title="المزود الافتراضي">
                <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm font-bold text-slate-800">المزود المعتمد</span>
                  <SegmentedControl
                    value={aiProvider as "gemini" | "groq"}
                    onChange={(val) => setAiProvider(val)}
                    options={[
                      { value: "gemini", label: "Google Gemini" },
                      { value: "groq", label: "Groq Cloud" }
                    ]}
                  />
                </div>
              </SettingsGroup>

              <SettingsGroup title="مفاتيح الربط (محفوظة محلياً)">
                {/* Gemini Key */}
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">مفتاح Gemini</span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#004ac6] hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>الحصول على مفتاح</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showGeminiKey ? "text" : "password"}
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value.trim())}
                        dir="ltr"
                        placeholder="AIzaSy..."
                        className="w-full text-xs px-3 py-2.5 pl-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#004ac6] focus:bg-white outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey((p) => !p)}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {geminiApiKey && (
                      <button
                        type="button"
                        onClick={() => setGeminiApiKey("")}
                        className="px-3 py-2.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold cursor-pointer"
                      >
                        مسح
                      </button>
                    )}
                  </div>
                </div>

                {/* Groq Key */}
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">مفتاح Groq</span>
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#004ac6] hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>الحصول على مفتاح</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showGroqKey ? "text" : "password"}
                        value={groqApiKey}
                        onChange={(e) => setGroqApiKey(e.target.value.trim())}
                        dir="ltr"
                        placeholder="gsk_..."
                        className="w-full text-xs px-3 py-2.5 pl-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-[#004ac6] focus:bg-white outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGroqKey((p) => !p)}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {groqApiKey && (
                      <button
                        type="button"
                        onClick={() => setGroqApiKey("")}
                        className="px-3 py-2.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold cursor-pointer"
                      >
                        مسح
                      </button>
                    )}
                  </div>
                </div>
              </SettingsGroup>

              <SettingsGroup title="المحادثات">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800">التصحيح اللغوي المدمج</div>
                    <div className="text-xs text-slate-500">عرض تقييم وصياغة أفضل أسفل الردود</div>
                  </div>
                  <AndroidSwitch
                    checked={enableInlinePersonaCorrection}
                    onChange={setEnableInlinePersonaCorrection}
                    ariaLabel="التصحيح اللغوي المدمج"
                  />
                </div>
              </SettingsGroup>
            </div>
          )}

          {/* ================= SECTION: APPEARANCE, MOTION & SIDEBAR SECTIONS ================= */}
          {route === "appearance" && (
            <div className="space-y-5">
              {/* Display Scale */}
              <SettingsGroup title="حجم العرض">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Move className="w-4 h-4 text-[#004ac6]" />
                      <span>مقياس الواجهة</span>
                    </span>
                    <span className="text-sm font-extrabold text-[#004ac6] tabular-nums">{siteScale}%</span>
                  </div>

                  <input
                    type="range"
                    min="100"
                    max="150"
                    step="5"
                    value={siteScale}
                    onChange={(e) => {
                      const newVal = parseInt(e.target.value, 10);
                      setSiteScale(newVal);
                      applyScale(newVal);
                    }}
                    className="w-full accent-[#004ac6] h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />

                  <div className="grid grid-cols-4 gap-1.5">
                    {[100, 115, 130, 150].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setSiteScale(val);
                          applyScale(val);
                        }}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all tabular-nums cursor-pointer ${
                          siteScale === val
                            ? "bg-[#004ac6] text-white border-[#004ac6]"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {val}%
                      </button>
                    ))}
                  </div>
                </div>
              </SettingsGroup>

              {/* Motion */}
              <SettingsGroup title="الحركات والسرعة">
                <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800">نوافذ المحادثة</div>
                    <div className="text-xs text-slate-500">طريقة ظهور نافذة الذكاء</div>
                  </div>
                  <SegmentedControl
                    value={enableChatAnimations ? "smooth" : "instant"}
                    onChange={(val) => handleToggleChatAnimations(val === "smooth")}
                    options={[
                      { value: "instant", label: "فوري (0ث)" },
                      { value: "smooth", label: "تدريجي" }
                    ]}
                  />
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800">حركات الواجهة</div>
                    <div className="text-xs text-slate-500">إيقافها يسرّع التصفح للأجهزة الضعيفة</div>
                  </div>
                  <AndroidSwitch
                    checked={enableGeneralAnimations}
                    onChange={handleToggleGeneralAnimations}
                    ariaLabel="حركات الواجهة"
                  />
                </div>
              </SettingsGroup>

              {/* Sidebar Secondary Sections */}
              <SettingsGroup
                title="أقسام القائمة الإضافية"
                action={
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => handleSetAllSecondarySections(true)}
                      className="text-[#004ac6] hover:underline cursor-pointer"
                    >
                      إظهار الكل
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => handleSetAllSecondarySections(false)}
                      className="text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      إخفاء الكل
                    </button>
                  </div>
                }
              >
                {(
                  [
                    {
                      key: "corrector" as SecondarySectionKey,
                      title: "المصحح اللغوي",
                      icon: PenTool,
                      iconBg: "bg-emerald-50 text-emerald-600"
                    },
                    {
                      key: "media" as SecondarySectionKey,
                      title: "مشغل الوسائط",
                      icon: Film,
                      iconBg: "bg-cyan-50 text-cyan-600"
                    },
                    {
                      key: "notes" as SecondarySectionKey,
                      title: "الكتابات",
                      icon: NotebookPen,
                      iconBg: "bg-teal-50 text-teal-600"
                    },
                    {
                      key: "shadowing" as SecondarySectionKey,
                      title: "استوديو الشادوينج",
                      icon: Activity,
                      iconBg: "bg-orange-50 text-orange-600"
                    }
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const isVisible = secondarySections[item.key];
                  return (
                    <div
                      key={item.key}
                      onClick={() => handleToggleSecondarySection(item.key)}
                      className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.iconBg}`}>
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                        <span className="text-sm font-bold text-slate-800 truncate">{item.title}</span>
                      </div>
                      <AndroidSwitch
                        checked={isVisible}
                        onChange={() => handleToggleSecondarySection(item.key)}
                        ariaLabel={item.title}
                      />
                    </div>
                  );
                })}
              </SettingsGroup>
            </div>
          )}

          {/* ================= SECTION: IMAGES ================= */}
          {route === "images" && (
            <div className="space-y-5">
              <SettingsGroup title="مزود الصور">
                <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm font-bold text-slate-800">محرك البحث</span>
                  <SegmentedControl
                    value={imageApi as "duckduckgo" | "pixabay"}
                    onChange={(val) => setImageApi(val)}
                    options={[
                      { value: "duckduckgo", label: "DuckDuckGo (مجاني)" },
                      { value: "pixabay", label: "Pixabay" }
                    ]}
                  />
                </div>

                {imageApi === "pixabay" && (
                  <div className="p-4 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">مفتاح Pixabay</label>
                    <div className="relative">
                      <input
                        type={showPixabayKey ? "text" : "password"}
                        value={pixabayKey}
                        onChange={(e) => setPixabayKey(e.target.value.trim())}
                        dir="ltr"
                        placeholder="Pixabay API Key"
                        className="w-full text-xs px-3 py-2.5 pl-9 rounded-xl border border-slate-200 bg-slate-50 font-mono outline-none focus:border-[#004ac6] focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPixabayKey((p) => !p)}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showPixabayKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </SettingsGroup>

              <SettingsGroup title="اختبار البحث">
                <div className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testImgQuery}
                      onChange={(e) => setTestImgQuery(e.target.value)}
                      placeholder="كلمة البحث (مثال: apple, berlin)..."
                      className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-[#004ac6] focus:bg-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleTestImageSearch}
                      disabled={isSearchingImages || !testImgQuery.trim()}
                      className="px-4 py-2 rounded-xl bg-[#004ac6] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>{isSearchingImages ? "بحث..." : "بحث"}</span>
                    </button>
                  </div>

                  {imgSearchStatus && <p className="text-xs font-semibold text-[#004ac6]">{imgSearchStatus}</p>}

                  {testImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {testImages.map((img, idx) => (
                        <div
                          key={idx}
                          className="aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                        >
                          <img
                            src={img.webformatURL}
                            alt={img.tags}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SettingsGroup>
            </div>
          )}

          {/* ================= SECTION: APP & STORAGE ================= */}
          {route === "storage" && (
            <div className="space-y-5">
              <SettingsGroup title="تثبيت التطبيق (PWA)">
                <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">تطبيق مدرب اللغات</div>
                      <div className="text-xs text-slate-500">فتح سريع بشاشة كاملة على الجهاز</div>
                    </div>
                  </div>
                  <PWAInstallButton variant="settings" />
                </div>
              </SettingsGroup>

              <SettingsGroup title="الذاكرة المؤقتة">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800">ذاكرة الصور</div>
                      <div className="text-xs text-slate-500 tabular-nums">
                        {isCalculatingCache
                          ? "جاري الحساب..."
                          : `${imageCacheCount ?? 0} صورة · ${imageCacheSize ?? "0.00 MB"}`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearImageCache}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer shrink-0"
                  >
                    مسح
                  </button>
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center shrink-0">
                      <Volume2 className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800">ذاكرة الصوتيات</div>
                      <div className="text-xs text-slate-500 tabular-nums">
                        {isCalculatingCache
                          ? "جاري الحساب..."
                          : `${ttsCacheCount ?? 0} ملف · ${ttsCacheSize ?? "0.00 MB"}`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearTtsCache}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer shrink-0"
                  >
                    مسح
                  </button>
                </div>
              </SettingsGroup>
            </div>
          )}

          {/* ================= SECTION: SETTINGS BACKUP (JSON EXPORT / IMPORT) ================= */}
          {route === "backup" && (
            <div className="space-y-5">
              {backupFeedback && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                    backupFeedback.type === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  {backupFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{backupFeedback.text}</span>
                </div>
              )}

              <SettingsGroup title="تصدير الإعدادات المحلية (JSON)">
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                      <FileJson className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="text-sm font-bold text-slate-900">
                        تصدير جميع إعدادات المراجعات والتطبيق
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        يشمل إعدادات جميع أنماط المراجعة (تحدي النطق، الكتابة، الاستماع، التكرار وخططه المخصصة)، الأصوات، المظهر، وأقسام الشريط الجانبي ({storedSettingsCount} إعداد محلي)، دون تصدير بيانات الجلسة أو البطاقات.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800">تضمين مفاتيح API الخاصة</div>
                      <div className="text-[11px] text-slate-500">فعّله إذا أردت نقل مفاتيح Gemini / Groq / Pixabay لحسابك الآخر</div>
                    </div>
                    <AndroidSwitch
                      checked={backupIncludeApiKeys}
                      onChange={setBackupIncludeApiKeys}
                      ariaLabel="تضمين مفاتيح API في ملف التصدير"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadSettingsJson}
                      className="h-11 px-4 rounded-xl bg-[#004ac6] hover:bg-[#003ea8] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <Download className="w-4 h-4" />
                      <span>تنزيل كملف JSON</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopySettingsJson}
                      className="h-11 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      {backupCopiedNotice ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      <span>{backupCopiedNotice ? "تم نسخ JSON" : "نسخ نص JSON"}</span>
                    </button>
                  </div>
                </div>
              </SettingsGroup>

              <SettingsGroup title="استيراد الإعدادات من JSON">
                <div className="p-4 space-y-3">
                  <input
                    ref={backupFileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleUploadSettingsJsonFile}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => backupFileInputRef.current?.click()}
                    className="w-full h-11 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
                  >
                    <Upload className="w-4 h-4" />
                    <span>رفع ملف إعدادات (.json) وتطبيقه فوراً</span>
                  </button>

                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-bold text-slate-700">
                      أو الصق نص JSON هنا:
                    </label>
                    <textarea
                      rows={5}
                      dir="ltr"
                      value={backupImportText}
                      onChange={(e) => setBackupImportText(e.target.value)}
                      placeholder='{"app": "M9F-Settings", "settings": { ... }}'
                      className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#004ac6] font-mono text-[11px] text-slate-800 placeholder-slate-400 outline-none resize-y"
                    />
                    <button
                      type="button"
                      disabled={!backupImportText.trim()}
                      onClick={() => applyImportedSettingsJson(backupImportText)}
                      className="w-full h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>استيراد وتطبيق النص</span>
                    </button>
                  </div>
                </div>
              </SettingsGroup>
            </div>
          )}

          {/* ================= SECTION: DIAGNOSTICS ================= */}
          {route === "diagnostics" && (
            <div className="space-y-5">
              <SettingsGroup title="فحص الأنظمة">
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={runFullSystemCheck}
                      disabled={isTestingSystem}
                      className="px-4 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003ea8] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingSystem ? "animate-spin" : ""}`} />
                      <span>{isTestingSystem ? "جاري الفحص..." : "فحص شامل"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRunningGranularCheck(true);
                        runGranularLocalTtsCheck(selectedPiperModel).then((res) => {
                          setGranularTtsCheckResults(res);
                          setIsRunningGranularCheck(false);
                        });
                      }}
                      disabled={isRunningGranularCheck}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Cpu className={`w-3.5 h-3.5 ${isRunningGranularCheck ? "animate-spin" : ""}`} />
                      <span>{isRunningGranularCheck ? "جاري الفحص..." : "فحص النطق المحلي (1–6)"}</span>
                    </button>
                  </div>

                  {systemTestResults && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {Object.entries(systemTestResults).map(([key, res]: [string, any]) => (
                        <div
                          key={key}
                          className={`p-3 rounded-xl border text-xs space-y-0.5 ${
                            res.ok
                              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                              : "bg-rose-50 border-rose-200 text-rose-900"
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span>
                              {key === "piper"
                                ? "محرك Piper"
                                : key === "google_tts"
                                ? "Google TTS"
                                : key === "webspeech"
                                ? "WebSpeech"
                                : "التخزين المحلي"}
                            </span>
                            {res.ms && <span className="text-[11px] tabular-nums">{res.ms}ms</span>}
                          </div>
                          <p>{res.msg}</p>
                          {res.solution && <p className="text-[11px] opacity-80">{res.solution}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {granularTtsCheckResults && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {granularTtsCheckResults.steps.map((st) => (
                          <div
                            key={st.stepNum}
                            className={`p-2.5 rounded-xl border text-xs ${
                              st.status === "ok"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                : st.status === "error"
                                ? "bg-rose-50 border-rose-200 text-rose-900"
                                : "bg-slate-50 border-slate-200 text-slate-500"
                            }`}
                          >
                            <div className="font-bold flex items-center justify-between">
                              <span>{st.title}</span>
                              {st.durationMs !== undefined && (
                                <span className="text-[10px] tabular-nums">{st.durationMs}ms</span>
                              )}
                            </div>
                            {st.details && <p className="text-[11px] mt-0.5 opacity-90">{st.details}</p>}
                          </div>
                        ))}
                      </div>
                      {granularTtsCheckResults.analysis && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                          <div className="font-bold">{granularTtsCheckResults.analysis.stepTitle}</div>
                          <p>{granularTtsCheckResults.analysis.cause}</p>
                          <p className="font-semibold">{granularTtsCheckResults.analysis.solution}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </SettingsGroup>

              <SettingsGroup
                title={`سجل الأحداث (${diagnosticLogList.length})`}
                action={
                  <button
                    type="button"
                    onClick={() => {
                      const report = globalDiagnosticLogs
                        .map(
                          (l) =>
                            `[${l.timestamp}] [${l.type.toUpperCase()}] [${l.category}] ${l.title}: ${l.message}`
                        )
                        .join("\n");
                      navigator.clipboard.writeText(report);
                      setDiagCopiedNotice(true);
                      setTimeout(() => setDiagCopiedNotice(false), 2000);
                    }}
                    className="text-xs font-bold text-[#004ac6] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {diagCopiedNotice ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{diagCopiedNotice ? "تم النسخ" : "نسخ"}</span>
                  </button>
                }
              >
                <div className="p-3 border-b border-slate-100 overflow-x-auto">
                  <SegmentedControl
                    value={diagFilter as "all" | "error" | "warning" | "info" | "success"}
                    onChange={(v) => setDiagFilter(v)}
                    options={[
                      { value: "all", label: "الكل" },
                      { value: "error", label: "أخطاء" },
                      { value: "warning", label: "تحذيرات" },
                      { value: "info", label: "معلومات" },
                      { value: "success", label: "نجاح" }
                    ]}
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                  {filteredDiagnosticLogs.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">لا توجد أحداث مسجلة</div>
                  ) : (
                    filteredDiagnosticLogs.map((log) => (
                      <div key={log.id} className="p-3.5 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">
                            {log.category} · {log.title}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                            {log.timestamp}
                          </span>
                        </div>
                        <p className="text-slate-600">{log.message}</p>
                        {log.solution && <p className="text-emerald-700 font-semibold">{log.solution}</p>}
                      </div>
                    ))
                  )}
                </div>
              </SettingsGroup>
            </div>
          )}

          {/* ================= SECTION: ACCOUNTS (ADMIN ONLY) ================= */}
          {route === "accounts" && isAdminUser && <AccountsSettingsTab />}
        </div>

        {/* Footer */}
        <footer className="px-4 sm:px-6 py-3.5 border-t border-slate-200/80 bg-white flex justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCancel}
            className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003ea8] text-white text-sm font-bold shadow-xs active:scale-[0.98] transition-all cursor-pointer"
          >
            حفظ التغييرات
          </button>
        </footer>
      </div>

      {/* Live Piper Sandbox Modal */}
      <LivePiperSandboxModal
        isOpen={isLiveSandboxOpen}
        onClose={() => {
          setIsLiveSandboxOpen(false);
          fetchCatalog();
        }}
        initialModelId={selectedPiperModel}
      />
    </div>
  );
};

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Play,
  Volume2,
  VolumeX,
  RefreshCw,
  Sparkles,
  Download,
  DownloadCloud,
  Trash2,
  Check,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Laptop,
  Server,
  Activity,
  Sliders,
  Star,
  Search,
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  Link2,
  FileAudio,
  Radio,
  Clock,
  Gauge,
  Zap,
  Timer
} from "lucide-react";
import { configureOnnxRuntime, stopActiveAudio, addDiagnosticLog, playGradioClientAudio } from "./Modals";
import { DEFAULT_GRADIO_VOICES, GRADIO_LANGUAGES } from "../types";

// Comprehensive built-in catalog of Piper neural voices with direct HuggingFace links
export const DEFAULT_PIPER_CATALOG = [
  // German Voices (🇩🇪)
  {
    id: "de_DE-thorsten-medium",
    name: "Thorsten Medium (ألماني ذكوري - متوازن وموصى به)",
    lang: "de",
    langName: "Deutsch (German)",
    flag: "🇩🇪",
    quality: "Medium",
    sizeMb: 61,
    speakerCount: 1,
    sample: "Guten Tag! Das ist die deutsche Thorsten-Stimme von Piper TTS.",
    urlOnnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx",
    urlJson: "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx.json"
  },
  {
    id: "de_DE-thorsten-high",
    name: "Thorsten High (ألماني ذكوري - جودة صوت فائقة)",
    lang: "de",
    langName: "Deutsch (German)",
    flag: "🇩🇪",
    quality: "High",
    sizeMb: 110,
    speakerCount: 1,
    sample: "Hallo! Dies ist die hochauflösende Thorsten-Stimme für klares Deutsch.",
    urlOnnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx",
    urlJson: "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx.json"
  },
  {
    id: "de_DE-kerstin-low",
    name: "Kerstin Low (ألماني أنثوي - فائق السرعة وخفيف)",
    lang: "de",
    langName: "Deutsch (German)",
    flag: "🇩🇪",
    quality: "Low",
    sizeMb: 16,
    speakerCount: 1,
    sample: "Hallo! Ich bin Kerstin. Ich spreche Deutsch mit Ihnen.",
    urlOnnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/kerstin/low/de_DE-kerstin-low.onnx",
    urlJson: "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/kerstin/low/de_DE-kerstin-low.onnx.json"
  },
  {
    id: "de_DE-pavoque-low",
    name: "Pavoque Low (ألماني ذكوري - خفيف وسريع)",
    lang: "de",
    langName: "Deutsch (German)",
    flag: "🇩🇪",
    quality: "Low",
    sizeMb: 16,
    speakerCount: 1,
    sample: "Guten Tag! Ich bin Pavoque und spreche fließend Deutsch.",
    urlOnnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/pavoque/low/de_DE-pavoque-low.onnx",
    urlJson: "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/pavoque/low/de_DE-pavoque-low.onnx.json"
  },
  {
    id: "de_DE-ramona-low",
    name: "Ramona Low (ألماني أنثوي - ناعم وخفيف)",
    lang: "de",
    langName: "Deutsch (German)",
    flag: "🇩🇪",
    quality: "Low",
    sizeMb: 16,
    speakerCount: 1,
    sample: "Herzlich willkommen! Ich spreche Deutsch für Ihre Lernkarten.",
    urlOnnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/ramona/low/de_DE-ramona-low.onnx",
    urlJson: "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/ramona/low/de_DE-ramona-low.onnx.json"
  },

  // Arabic Voices (🇯🇴)
  {
    id: "ar_JO-kareem-medium",
    name: "Kareem (عربي ذكوري - فصيح وطبيعي)",
    lang: "ar",
    langName: "العربية (Arabic)",
    flag: "🇯🇴",
    quality: "Medium",
    sizeMb: 61,
    speakerCount: 1,
    sample: "مرحباً بك! هذه تجربة الصوت العربي لتقنية بايبر العصبية.",
    urlOnnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx",
    urlJson: "https://huggingface.co/rhasspy/piper-voices/resolve/main/ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx.json"
  },
  {
    id: "ar_JO-kareem-low",
    name: "Kareem Low (عربي ذكوري - سريع وخفيف)",
    lang: "ar",
    langName: "العربية (Arabic)",
    flag: "🇯🇴",
    quality: "Low",
    sizeMb: 16,
    speakerCount: 1,
    sample: "أهلاً بك، صوت كريم العربي الخفيف السريع للبطاقات.",
    urlOnnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/ar/ar_JO/kareem/low/ar_JO-kareem-low.onnx",
    urlJson: "https://huggingface.co/rhasspy/piper-voices/resolve/main/ar/ar_JO/kareem/low/ar_JO-kareem-low.onnx.json"
  },

  // English Voices (🇺🇸/🇬🇧)
  {
    id: "en_US-lessac-medium",
    name: "Lessac (إنجليزي أمريكي - نقي ومتوازن)",
    lang: "en",
    langName: "English (US)",
    flag: "🇺🇸",
    quality: "Medium",
    sizeMb: 61,
    speakerCount: 1,
    sample: "Hello! This is the Lessac American English neural voice.",
    urlOnnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
    urlJson: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json"
  },
  {
    id: "en_US-amy-medium",
    name: "Amy (إنجليزي أمريكي أنثوي - إيمي)",
    lang: "en",
    langName: "English (US)",
    flag: "🇺🇸",
    quality: "Medium",
    sizeMb: 61,
    speakerCount: 1,
    sample: "Hello! I am Amy, a clear American English voice.",
    urlOnnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx",
    urlJson: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json"
  },
  {
    id: "en_GB-alan-medium",
    name: "Alan (إنجليزي بريطاني - ألان)",
    lang: "en",
    langName: "English (UK)",
    flag: "🇬🇧",
    quality: "Medium",
    sizeMb: 61,
    speakerCount: 1,
    sample: "Good day! I am Alan, speaking British English.",
    urlOnnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx",
    urlJson: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json"
  },

  // French (🇫🇷)
  {
    id: "fr_FR-siwis-medium",
    name: "Siwis (فرنسي أنثوي - سيويس)",
    lang: "fr",
    langName: "Français (French)",
    flag: "🇫🇷",
    quality: "Medium",
    sizeMb: 61,
    speakerCount: 1,
    sample: "Bonjour! C'est la voix française Siwis pour Piper TTS.",
    urlOnnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx",
    urlJson: "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json"
  },

  // Spanish (🇪🇸)
  {
    id: "es_ES-davefx-medium",
    name: "Davefx (إسباني ذكوري - ديفيكس)",
    lang: "es",
    langName: "Español (Spanish)",
    flag: "🇪🇸",
    quality: "Medium",
    sizeMb: 61,
    speakerCount: 1,
    sample: "¡Hola! Esta es la voz española Davefx para Piper TTS.",
    urlOnnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx",
    urlJson: "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json"
  }
];

export interface LivePiperSandboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialModelId?: string;
}

export const LivePiperSandboxModal: React.FC<LivePiperSandboxModalProps> = ({
  isOpen,
  onClose,
  initialModelId = "de_DE-thorsten-medium"
}) => {
  // 1. Live Playground States
  const [testText, setTestText] = useState("Guten Tag! Wie geht es Ihnen heute?");
  const [selectedModel, setSelectedModel] = useState<string>(initialModelId);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [ttsExecutionMode, setTtsExecutionMode] = useState<"local" | "server">(
    () => (localStorage.getItem("settings_tts_execution_mode") as "local" | "server") || "local"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastAudioBlobUrl, setLastAudioBlobUrl] = useState<string | null>(null);
  const [lastAudioDuration, setLastAudioDuration] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [currentPipelineStep, setCurrentPipelineStep] = useState<number>(0);
  const [pipelineStepDesc, setPipelineStepDesc] = useState<string>("");
  const [speechError, setSpeechError] = useState<{
    msg: string;
    cause?: string;
    solution?: string;
    checksSummary?: Array<{ step: string; status: "passed" | "failed" | "skipped"; detail: string }>;
  } | null>(null);

  // 2. Catalog & Model Management States - Initialized with full default list so models are visible instantly
  const [catalogModels, setCatalogModels] = useState<any[]>(() =>
    DEFAULT_PIPER_CATALOG.map((m) => ({ ...m, isDownloaded: false }))
  );
  const [catalogFilter, setCatalogFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});
  const [downloadProgressMap, setDownloadProgressMap] = useState<
    Record<string, {
      percent: number;
      loadedMb: string;
      totalMb: string;
      speed?: string;
      step: string;
      files?: {
        onnx: { name: string; status: "pending" | "downloading" | "completed" | "error"; sizeMb?: string; error?: string };
        json: { name: string; status: "pending" | "downloading" | "completed" | "error"; sizeKb?: string; error?: string };
      };
    }>
  >({});
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [expandedLinksMap, setExpandedLinksMap] = useState<Record<string, boolean>>({});
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // 3. Custom Model Inputs (اسم مخصص + رابطين فقط بدون خانة معرف منفصلة)
  const [customModelName, setCustomModelName] = useState<string>("");
  const [customModelUrl, setCustomModelUrl] = useState<string>("");
  const [customModelJsonUrl, setCustomModelJsonUrl] = useState<string>("");
  const [isDownloadingCustom, setIsDownloadingCustom] = useState<boolean>(false);
  const [customDownloadProgress, setCustomDownloadProgress] = useState<{
    percent: number;
    loadedMb: string;
    totalMb: string;
    speed: string;
    step: string;
    files?: {
      onnx: { name: string; status: "pending" | "downloading" | "completed" | "error"; sizeMb?: string; error?: string };
      json: { name: string; status: "pending" | "downloading" | "completed" | "error"; sizeKb?: string; error?: string };
    };
  } | null>(null);
  const [customSuccessDetails, setCustomSuccessDetails] = useState<{
    modelId: string;
    name: string;
    onnxSizeMb: string;
    jsonSizeKb: string;
    totalSizeMb: string;
  } | null>(null);
  const [customSuccessMsg, setCustomSuccessMsg] = useState<string | null>(null);
  const [customErrorMsg, setCustomErrorMsg] = useState<string | null>(null);

  // 4. Server Repair & Piper Standby Engine States
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

  const fetchPiperEngineStatus = async () => {
    try {
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const apiBase = isLocalhost ? "http://localhost:3000/api/tts/piper/engine-status" : "/api/tts/piper/engine-status";
      const res = await fetch(apiBase);
      if (res.ok) {
        const data = await res.json();
        setPiperEngineStatus(data);
        if (data.mode) {
          setPiperStandbyMode(data.mode);
          localStorage.setItem("settings_piper_standby_mode", data.mode);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const handleChangePiperEngineMode = async (newMode: "idle_60s" | "always_ready") => {
    setPiperStandbyMode(newMode);
    localStorage.setItem("settings_piper_standby_mode", newMode);
    setIsUpdatingEngineMode(true);
    try {
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const apiBase = isLocalhost ? "http://localhost:3000/api/tts/piper/engine-mode" : "/api/tts/piper/engine-mode";
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode })
      });
      if (res.ok) {
        const data = await res.json();
        setPiperEngineStatus(data);
      }
    } catch (e) {
      console.warn("Failed to update Piper engine mode:", e);
    } finally {
      setIsUpdatingEngineMode(false);
    }
  };

  const handleWarmupPiperEngine = async () => {
    setIsWarmingUpEngine(true);
    try {
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const apiBase = isLocalhost ? "http://localhost:3000/api/tts/piper/engine-warmup" : "/api/tts/piper/engine-warmup";
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelName: selectedModel || "de_DE-thorsten-medium" })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPiperEngineStatus(data);
      }
    } catch (e: any) {
      console.warn("Warmup error:", e);
    } finally {
      setIsWarmingUpEngine(false);
    }
  };

  const handleFlushPiperEngine = async () => {
    setIsFlushingEngine(true);
    try {
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const apiBase = isLocalhost ? "http://localhost:3000/api/tts/piper/engine-flush" : "/api/tts/piper/engine-flush";
      const res = await fetch(apiBase, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setPiperEngineStatus(data);
      }
    } catch (e) {
      console.warn("Failed to flush Piper engine:", e);
    } finally {
      setIsFlushingEngine(false);
    }
  };

  // 5. Gradio TTS Server States
  const [gradioTtsUrl, setGradioTtsUrl] = useState<string>(
    () => localStorage.getItem("settings_gradio_tts_url") || "http://192.168.0.159:7860"
  );
  const [isTestingGradio, setIsTestingGradio] = useState(false);
  const [gradioTestResult, setGradioTestResult] = useState<{
    ok: boolean;
    msg: string;
    latencyMs?: number;
    title?: string;
  } | null>(null);

  const handleTestGradioConnection = async () => {
    setIsTestingGradio(true);
    setGradioTestResult(null);
    try {
      localStorage.setItem("settings_gradio_tts_url", gradioTtsUrl.trim());
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const apiBase = isLocalhost ? "http://localhost:3000/api/tts/gradio/test" : "/api/tts/gradio/test";
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: gradioTtsUrl.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGradioTestResult({
          ok: true,
          msg: `الاتصال ناجح! وقت الاستجابة: ${data.latencyMs}ms - السيرفر يعمل وجاهز لتوليد الأصوات.`,
          latencyMs: data.latencyMs,
          title: "سيرفر Gradio متصل بنجاح"
        });
      } else {
        setGradioTestResult({
          ok: false,
          msg: data.error || "تعذر الاتصال بعنوان سيرفر Gradio. تأكد من تشغيل السيرفر ومن العنوان.",
          title: "فشل الاتصال بسيرفر Gradio"
        });
      }
    } catch (err: any) {
      setGradioTestResult({
        ok: false,
        msg: `خطأ في الاتصال: ${err.message}`,
        title: "خطأ في الشبكة"
      });
    } finally {
      setIsTestingGradio(false);
    }
  };

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Load catalog on open and sync download status with server & browser OPFS storage
  const fetchCatalog = async () => {
    setIsLoadingModels(true);
    try {
      // 1. Check OPFS browser storage
      let opfsInstalledIds: string[] = [];
      try {
        if (typeof window !== "undefined" && "storage" in navigator && navigator.storage.getDirectory) {
          const root = await navigator.storage.getDirectory();
          const dir = await root.getDirectoryHandle("piper", { create: false }).catch(() => null);
          if (dir) {
            for (const m of DEFAULT_PIPER_CATALOG) {
              const onnxFile = await dir.getFileHandle(`${m.id}.onnx`, { create: false }).catch(() => null);
              if (onnxFile) {
                opfsInstalledIds.push(m.id);
              }
            }
          }
        }
      } catch (opfsErr) {
        console.warn("OPFS model inspection warning:", opfsErr);
      }

      // 2. Load custom models from local storage
      let savedCustomModels: any[] = [];
      try {
        const stored = localStorage.getItem("piper_custom_saved_models");
        if (stored) {
          savedCustomModels = JSON.parse(stored);
        }
      } catch (e) {}

      // 3. Fetch server catalog
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const apiBase = isLocalhost ? "http://localhost:3000/api/tts/catalog" : "/api/tts/catalog";
      const res = await fetch(`${apiBase}?t=${Date.now()}`, { cache: "no-store" });
      
      if (res.ok) {
        const data = await res.json();
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
          const serverModels = data.models;
          
          // Merge base catalog with server models & opfs
          const merged: any[] = DEFAULT_PIPER_CATALOG.map((base) => {
            const foundServer = serverModels.find((sm: any) => sm.id === base.id);
            return {
              ...base,
              isDownloaded: (foundServer && foundServer.isDownloaded) || opfsInstalledIds.includes(base.id),
              installedSizeMb: foundServer?.installedSizeMb || (opfsInstalledIds.includes(base.id) ? `${base.sizeMb} MB` : null)
            };
          });

          // Add server models not in DEFAULT_PIPER_CATALOG (e.g. custom server models)
          serverModels.forEach((sm: any) => {
            if (!merged.some((m) => m.id === sm.id)) {
              merged.push({
                ...sm,
                isDownloaded: sm.isDownloaded || opfsInstalledIds.includes(sm.id)
              });
            }
          });

          // Add custom saved models from local storage not yet in merged
          savedCustomModels.forEach((cm: any) => {
            const existing = merged.find((m) => m.id === cm.id);
            if (!existing) {
              merged.push({
                ...cm,
                isDownloaded: true
              });
            } else {
              existing.isDownloaded = true;
              existing.isCustom = true;
            }
          });

          setCatalogModels(merged);
          return;
        }
      }

      // Fallback if server returned no models: update default list with OPFS status + custom models
      const fallbackList: any[] = DEFAULT_PIPER_CATALOG.map((m) => ({
        ...m,
        isDownloaded: opfsInstalledIds.includes(m.id)
      }));
      savedCustomModels.forEach((cm: any) => {
        if (!fallbackList.some((m) => m.id === cm.id)) {
          fallbackList.push({ ...cm, isDownloaded: true });
        }
      });
      setCatalogModels(fallbackList);
    } catch (e) {
      console.warn("Failed to fetch catalog in sandbox:", e);
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCatalog();
      fetchPiperEngineStatus();
    } else {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      setIsPlaying(false);
      setIsGenerating(false);
    }
  }, [isOpen]);

  // Model URL helper
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
      console.warn("Failed to copy link:", e);
    }
  };

  // Preset sample texts
  const samplePresets = [
    { label: "🚀 Gradio: Ryan (ألماني)", lang: "de", model: "gradio:ryan:german", text: "Guten Tag! Ich bin Ryan vom lokalen Gradio-Server." },
    { label: "🚀 Gradio: Ryan (عربي)", lang: "ar", model: "gradio:ryan:auto", text: "مرحباً بكم! هذا صوت ريان عبر سيرفر Gradio المحلي." },
    { label: "🚀 Gradio: Vivian (إنجليزي)", lang: "en", model: "gradio:vivian:english", text: "Hello! This is Vivian speaking through your local Gradio TTS server." },
    { label: "🇩🇪 ألماني: Thorsten", lang: "de", model: "de_DE-thorsten-medium", text: "Guten Tag! Wie geht es Ihnen heute?" },
    { label: "🇯🇴 عربي: Kareem", lang: "ar", model: "ar_JO-kareem-medium", text: "مرحباً بك! هذه تجربة النطق العصبي باللغة العربية." },
    { label: "🇺🇸 إنجليزي: Lessac", lang: "en", model: "en_US-lessac-medium", text: "Welcome! Piper is a fast, local neural text-to-speech system." },
    { label: "🇫🇷 فرنسي: Siwis", lang: "fr", model: "fr_FR-siwis-medium", text: "Bonjour! Ceci est un test de synthèse vocale en français." }
  ];

  // Live Synthesis Handler
  const handleSynthesize = async (overrideText?: string, overrideModel?: string) => {
    const textToSynthesize = (overrideText || testText).trim();
    const modelToUse = overrideModel || selectedModel;
    if (!textToSynthesize) return;

    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    stopActiveAudio();

    setIsGenerating(true);
    setIsPlaying(false);
    setSpeechError(null);
    setCurrentPipelineStep(1);
    setPipelineStepDesc("1/4 تجهيز ومطابقة النص (Text Normalization & Prep)...");
    const startTime = performance.now();

    // Determine target language
    let langCode = "de";
    if (modelToUse.startsWith("gradio:")) {
      const parts = modelToUse.split(":");
      const gLang = parts[2] || "auto";
      if (gLang === "german") langCode = "de";
      else if (gLang === "english") langCode = "en";
      else if (gLang === "french") langCode = "fr";
      else if (gLang === "italian") langCode = "it";
      else if (gLang === "spanish") langCode = "es";
      else if (gLang === "russian") langCode = "ru";
      else if (gLang === "japanese") langCode = "ja";
      else if (gLang === "korean") langCode = "ko";
      else if (gLang === "chinese") langCode = "zh";
      else langCode = "auto";
    } else if (modelToUse.startsWith("ar")) {
      langCode = "ar";
    } else if (modelToUse.startsWith("en")) {
      langCode = "en";
    } else if (modelToUse.startsWith("fr")) {
      langCode = "fr";
    } else if (modelToUse.startsWith("es")) {
      langCode = "es";
    }

    try {
      // 1. External Gradio Qwen3-TTS Engine (Strictly isolated from Piper)
      if (modelToUse.startsWith("gradio:")) {
        setCurrentPipelineStep(2);
        setPipelineStepDesc(`2/4 إرسال الطلب إلى سيرفر Gradio الخارجي (${gradioTtsUrl})...`);
        const parts = modelToUse.split(":");
        const gVoice = parts[1] || "ryan";

        setCurrentPipelineStep(3);
        setPipelineStepDesc(`3/4 معالجة الصوت بواسطة Qwen3-TTS (${gVoice}) واستلام التدفق الصوتي...`);

        const gradioRes = await playGradioClientAudio(textToSynthesize, gVoice, langCode, gradioTtsUrl);
        const endTime = performance.now();
        setLatencyMs(Math.round(endTime - startTime));

        if (gradioRes.ok) {
          setCurrentPipelineStep(4);
          setPipelineStepDesc("4/4 تم استلام وتشغيل الصوت من سيرفر Gradio الخارجي بنجاح!");
          setIsGenerating(false);
          setIsPlaying(true);
          setTimeout(() => {
            setIsPlaying(false);
            setCurrentPipelineStep(0);
            setPipelineStepDesc("");
          }, 3000);
          return;
        } else {
          setIsGenerating(false);
          setIsPlaying(false);
          setSpeechError({
            msg: gradioRes.error || "تعذر الاتصال بسيرفر Gradio الخارجي",
            cause: "سيرفر Gradio على لابتوبك غير متاح أو تعذر الوصول إليه من المتصفح",
            solution: "تأكد من تشغيل السيرفر على لابتوبك والمنفذ 7860 أو تفعيل خاصية share=True."
          });
          return;
        }
      }

      // 2. Local Browser WASM (Piper Neural on-device)
      if (ttsExecutionMode === "local" && modelToUse !== "google" && modelToUse !== "webspeech") {
        setCurrentPipelineStep(2);
        setPipelineStepDesc("2/4 تهيئة محرك WebAssembly ونواة ONNX Runtime...");
        await configureOnnxRuntime();

        setCurrentPipelineStep(3);
        setPipelineStepDesc("3/4 تشغيل الاستنتاج العصبي المحلي (Local ONNX Inference)...");
        const piperWeb = await import("@mintplex-labs/piper-tts-web");
        if (piperWeb?.TtsSession?.WASM_LOCATIONS) {
          piperWeb.TtsSession.WASM_LOCATIONS.onnxWasm = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
        }

        const storedList = await piperWeb.stored();
        const isStored = Array.isArray(storedList) && storedList.includes(modelToUse as any);
        if (!isStored) {
          setPipelineStepDesc(`جاري جلب وتخزين أوزان النموذج (${modelToUse}) محلياً...`);
          await piperWeb.download(modelToUse as any, (p: any) => {
            if (p && p.total) {
              const pct = Math.round((p.loaded / p.total) * 100);
              setPipelineStepDesc(`جاري تخزين أوزان النموذج (${pct}%)...`);
            }
          });
        }

        const wavBlob = await piperWeb.predict({
          text: textToSynthesize,
          voiceId: modelToUse as any
        });

        setCurrentPipelineStep(4);
        setPipelineStepDesc("4/4 إخراج وبث الموجات الصوتية (Audio Stream Output)...");

        const endTime = performance.now();
        setLatencyMs(Math.round(endTime - startTime));

        const objectUrl = URL.createObjectURL(wavBlob);
        setLastAudioBlobUrl(objectUrl);

        const audio = new Audio(objectUrl);
        audio.playbackRate = speechRate;
        activeAudioRef.current = audio;
        setIsGenerating(false);
        setIsPlaying(true);

        audio.onloadedmetadata = () => {
          if (audio.duration && !isNaN(audio.duration)) {
            setLastAudioDuration(Math.round(audio.duration * 10) / 10);
          }
        };

        audio.onended = () => {
          setIsPlaying(false);
          setCurrentPipelineStep(0);
          setPipelineStepDesc("");
        };

        audio.onerror = () => {
          setIsPlaying(false);
          setIsGenerating(false);
          setSpeechError({
            msg: "تعذر تشغيل مقطع الصوت الناتج محلياً.",
            cause: "قد تكون صيغة WAV غير مدعومة من المتصفح مباشرة",
            solution: "جرب التبديل لوضع خادم السيرفر"
          });
        };

        await audio.play();
        return;
      }

      // Server-Side / Gradio Synthesis Flow
      setCurrentPipelineStep(2);
      if (modelToUse.startsWith("gradio:")) {
        setPipelineStepDesc(`2/4 إرسال الطلب إلى سيرفر Gradio (${gradioTtsUrl})...`);
      } else {
        setPipelineStepDesc("2/4 إرسال طلب المعالجة العصبية إلى خادم Piper...");
      }

      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const apiBase = isLocalhost ? "http://localhost:3000/api/tts" : "/api/tts";
      const gradioParam = modelToUse.startsWith("gradio:") ? `&gradioUrl=${encodeURIComponent(gradioTtsUrl)}` : "";
      const url = `${apiBase}?text=${encodeURIComponent(textToSynthesize)}&lang=${langCode}&voice=${encodeURIComponent(modelToUse)}${gradioParam}&_t=${Date.now()}`;

      setCurrentPipelineStep(3);
      setPipelineStepDesc(modelToUse.startsWith("gradio:") ? "3/4 معالجة الصوت بواسطة Qwen3-TTS واستلام الملف..." : "3/4 تنفيذ شبكة Piper العصبية واستخراج ذبذبات الصوت...");

      const res = await fetch(url);
      const endTime = performance.now();
      setLatencyMs(Math.round(endTime - startTime));

      if (res.ok) {
        const cType = res.headers.get("content-type") || "";
        if (cType.includes("audio")) {
          setCurrentPipelineStep(4);
          setPipelineStepDesc("4/4 استلام المقطع الصوتي وبدء البث الفوري...");

          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          setLastAudioBlobUrl(objectUrl);

          const audio = new Audio(objectUrl);
          audio.playbackRate = speechRate;
          activeAudioRef.current = audio;
          setIsGenerating(false);
          setIsPlaying(true);

          audio.onloadedmetadata = () => {
            if (audio.duration && !isNaN(audio.duration)) {
              setLastAudioDuration(Math.round(audio.duration * 10) / 10);
            }
          };

          audio.onended = () => {
            setIsPlaying(false);
            setCurrentPipelineStep(0);
            setPipelineStepDesc("");
          };

          audio.onerror = () => {
            setIsPlaying(false);
            setIsGenerating(false);
            setSpeechError({
              msg: "تعذر تشغيل ملف الصوت بعد استلامه من السيرفر.",
              cause: "رفض المتصفح فك تشفير المقطع الصوتي",
              solution: "جرب إعادة المحاولة أو النقر لتفعيل الصوت"
            });
          };

          await audio.play();
          return;
        }
      }

      // Handle Server Error
      let errJson: any = {};
      try {
        errJson = await res.json();
      } catch (e) {}

      setIsGenerating(false);
      setIsPlaying(false);
      setSpeechError({
        msg: errJson.error || errJson.message || `خطأ في استجابة السيرفر: HTTP ${res.status}`,
        cause: errJson.cause || errJson.errorReason || `النموذج (${modelToUse}) يحتاج إلى تنزيل أو إصلاح بالسيرفر`,
        solution: errJson.solution || errJson.suggestedSolution || "اضغط على زر 'فحص وإصلاح ملفات السيرفر' أو قم بتنزيل النموذج من القائمة",
        checksSummary: errJson.checksSummary
      });
    } catch (err: any) {
      setIsGenerating(false);
      setIsPlaying(false);
      setSpeechError({
        msg: `تعذر إتمام عملية التوليد: ${err?.message || err}`,
        cause: "انقطاع الاتصال بالسيرفر أو قيود بيئة التشغيل بالمتصفح",
        solution: "تأكد من اتصالك بالإنترنت وتوافر خادم Piper"
      });
    }
  };

  const handleStopAudio = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    stopActiveAudio();
    setIsPlaying(false);
    setIsGenerating(false);
    setCurrentPipelineStep(0);
  };

  const handleReplayAudio = () => {
    if (lastAudioBlobUrl) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      const audio = new Audio(lastAudioBlobUrl);
      audio.playbackRate = speechRate;
      activeAudioRef.current = audio;
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.play().catch(() => setIsPlaying(false));
    } else {
      handleSynthesize();
    }
  };

  // Download Catalog Model
  const handleDownloadModel = async (model: any) => {
    const modelId = model.id;
    setDownloadingIds((prev) => ({ ...prev, [modelId]: true }));
    setDownloadProgressMap((prev) => ({
      ...prev,
      [modelId]: {
        percent: 1,
        loadedMb: "0.0 MB",
        totalMb: `${model.sizeMb || 60} MB`,
        speed: "0.0 MB/s",
        step: "جاري تنزيل وتثبيت النموذج بالسيرفر..."
      }
    }));

    const pollInterval = setInterval(async () => {
      try {
        const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        const apiBase = isLocalhost ? "http://localhost:3000/api/tts/models/download-progress" : "/api/tts/models/download-progress";
        const res = await fetch(`${apiBase}?modelId=${encodeURIComponent(modelId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && (data.status === "downloading" || data.percent > 0)) {
            setDownloadProgressMap((prev) => ({
              ...prev,
              [modelId]: {
                percent: data.percent ?? 0,
                loadedMb: data.loadedMb || "0.0 MB",
                totalMb: data.totalMb || `${model.sizeMb || 60} MB`,
                speed: data.speed || "0.0 MB/s",
                step: data.step || "جاري جلب أوزان النموذج...",
                files: data.files
              }
            }));
          }
        }
      } catch (e) {}
    }, 200);

    try {
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const apiBase = isLocalhost ? "http://localhost:3000/api/tts/models/download" : "/api/tts/models/download";
      const urls = getPiperModelUrls(model);

      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          urlOnnx: urls.urlOnnx,
          urlJson: urls.urlJson,
          sizeMb: model.sizeMb
        })
      });

      clearInterval(pollInterval);

      // Local storage in browser as well
      try {
        const piperWeb = await import("@mintplex-labs/piper-tts-web");
        await piperWeb.download(modelId as any, (p: any) => {
          if (p && p.loaded) {
            const loadedBytes = p.loaded;
            const totalBytes = p.total || 0;
            const percent = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
            setDownloadProgressMap((prev) => ({
              ...prev,
              [modelId]: {
                percent,
                loadedMb: (loadedBytes / (1024 * 1024)).toFixed(1) + " MB",
                totalMb: totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) + " MB" : `${model.sizeMb || 60} MB`,
                speed: "محلي",
                step: `[المتصفح] تخزين محلي أوفلاين (${percent}%)`
              }
            }));
          }
        });
      } catch (e) {}

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const installedSize = data.totalSizeMb || data.sizeMb || `${model.sizeMb || 60} MB`;
        setDownloadProgressMap((prev) => ({
          ...prev,
          [modelId]: {
            percent: 100,
            loadedMb: installedSize,
            totalMb: installedSize,
            speed: "0.0 MB/s",
            step: "اكتمل تنزيل والتحقق من الملفين بنجاح 100%!",
            files: {
              onnx: { name: `${modelId}.onnx`, status: "completed", sizeMb: data.files?.onnx?.sizeMb || installedSize },
              json: { name: `${modelId}.onnx.json`, status: "completed", sizeKb: data.files?.json?.sizeKb || "4.8 KB" }
            }
          }
        }));
        await fetchCatalog();
      }
    } catch (e) {
      clearInterval(pollInterval);
    } finally {
      clearInterval(pollInterval);
      setDownloadingIds((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  // Delete Catalog Model
  const handleDeleteModel = async (modelId: string) => {
    if (!confirm(`هل أنت متأكد من حذف نموذج الصوت (${modelId}) لتوفير المساحة؟`)) return;
    setDeletingIds((prev) => ({ ...prev, [modelId]: true }));
    try {
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const apiBase = isLocalhost ? "http://localhost:3000/api/tts/models/delete" : "/api/tts/models/delete";
      
      // 1. Delete on server (POST and DELETE fallback)
      await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId })
      }).catch(() => null);

      await fetch(`/api/tts/models/${encodeURIComponent(modelId)}`, {
        method: "DELETE"
      }).catch(() => null);

      // 2. Delete from piper-tts-web memory & OPFS browser storage
      try {
        const piperWeb = await import("@mintplex-labs/piper-tts-web");
        await piperWeb.remove(modelId as any).catch(() => null);
      } catch (e) {}

      try {
        if (typeof window !== "undefined" && "storage" in navigator && navigator.storage.getDirectory) {
          const root = await navigator.storage.getDirectory();
          const dir = await root.getDirectoryHandle("piper", { create: false }).catch(() => null);
          if (dir) {
            await dir.removeEntry(`${modelId}.onnx`).catch(() => null);
            await dir.removeEntry(`${modelId}.onnx.json`).catch(() => null);
          }
        }
      } catch (e) {}

      // Also remove from local storage saved custom models if applicable
      try {
        const stored = localStorage.getItem("piper_custom_saved_models");
        if (stored) {
          const list = JSON.parse(stored);
          const filtered = list.filter((m: any) => m.id !== modelId);
          localStorage.setItem("piper_custom_saved_models", JSON.stringify(filtered));
        }
      } catch (e) {}

      // 3. Update local state immediately
      setCatalogModels((prev) =>
        prev.map((m) => (m.id === modelId ? { ...m, isDownloaded: false, installedSizeMb: null } : m))
      );

      // 4. Refresh full catalog
      await fetchCatalog();
    } catch (e) {
      console.warn("Delete model failed:", e);
    } finally {
      setDeletingIds((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  // Custom Model Downloader (اسم مخصص + رابطين فقط مع مؤشر وسرعة التنزيل وظهور فوري)
  const handleDownloadCustomModel = async () => {
    let rawName = customModelName.trim();
    let id = rawName.replace(/\.onnx$/, "").trim();
    if (!id && customModelUrl.trim()) {
      const match = customModelUrl.trim().match(/\/([^\/?#]+)\.onnx/);
      if (match && match[1]) id = match[1];
    }

    if (!id) {
      setCustomErrorMsg("يرجى إدخال اسم مخصص للنموذج أو وضع رابط ملف الـ .onnx");
      return;
    }

    // Determine language and flags
    let lang = "custom";
    let flag = "🎯";
    let langName = "مخصص (Custom)";
    if (id.startsWith("de_") || id.startsWith("de-")) { lang = "de"; flag = "🇩🇪"; langName = "Deutsch (German)"; }
    else if (id.startsWith("ar_") || id.startsWith("ar-")) { lang = "ar"; flag = "🇯🇴"; langName = "العربية (Arabic)"; }
    else if (id.startsWith("en_") || id.startsWith("en-")) { lang = "en"; flag = "🇺🇸"; langName = "English (US)"; }
    else if (id.startsWith("fr_") || id.startsWith("fr-")) { lang = "fr"; flag = "🇫🇷"; langName = "Français (French)"; }
    else if (id.startsWith("es_") || id.startsWith("es-")) { lang = "es"; flag = "🇪🇸"; langName = "Español (Spanish)"; }

    setIsDownloadingCustom(true);
    setCustomErrorMsg(null);
    setCustomSuccessMsg(null);
    setCustomDownloadProgress({
      percent: 1,
      loadedMb: "0.0 MB",
      totalMb: "60.0 MB",
      speed: "0.0 MB/s",
      step: "[1/2 الخادم] جاري بدء الاتصال وتنزيل النموذج المخصص..."
    });

    // Start polling download progress on server
    const pollInterval = setInterval(async () => {
      try {
        const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        const apiBase = isLocalhost ? "http://localhost:3000/api/tts/models/download-progress" : "/api/tts/models/download-progress";
        const res = await fetch(`${apiBase}?modelId=${encodeURIComponent(id)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && (data.status === "downloading" || data.percent > 0)) {
            setCustomDownloadProgress({
              percent: data.percent ?? 0,
              loadedMb: data.loadedMb || "0.0 MB",
              totalMb: data.totalMb || "60.0 MB",
              speed: data.speed || "0.0 MB/s",
              step: data.step || "[1/2 الخادم] جاري تنزيل حزمة النموذج...",
              files: data.files
            });
          }
        }
      } catch (e) {}
    }, 200);

    try {
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const apiBase = isLocalhost ? "http://localhost:3000/api/tts/models/download" : "/api/tts/models/download";

      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: id,
          name: rawName || id,
          urlOnnx: customModelUrl.trim() || undefined,
          urlJson: customModelJsonUrl.trim() || undefined
        })
      });

      clearInterval(pollInterval);

      // Also store in browser local storage (OPFS) if available
      try {
        setCustomDownloadProgress((prev) => ({
          percent: 90,
          loadedMb: prev?.loadedMb || "60.0 MB",
          totalMb: prev?.totalMb || "60.0 MB",
          speed: "محلي",
          step: "[2/2 المتصفح] جاري تهيئة التخزين المحلي للنموذج المخصص..."
        }));
        const piperWeb = await import("@mintplex-labs/piper-tts-web");
        await piperWeb.download(id as any, (p: any) => {
          if (p && p.loaded) {
            const loadedBytes = p.loaded;
            const totalBytes = p.total || 0;
            const percent = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 95;
            setCustomDownloadProgress({
              percent,
              loadedMb: (loadedBytes / (1024 * 1024)).toFixed(1) + " MB",
              totalMb: totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) + " MB" : "60.0 MB",
              speed: "محلي",
              step: `[2/2 المتصفح] تخزين محلي أوفلاين (${percent}%)`
            });
          }
        });
      } catch (e) {}

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const onnxSizeMb = data.files?.onnx?.sizeMb || data.sizeMb || "60.0 MB";
        const jsonSizeKb = data.files?.json?.sizeKb || "4.8 KB";
        const totalSizeMb = data.totalSizeMb || onnxSizeMb;

        const customItem = {
          id,
          name: rawName || id,
          lang,
          langName,
          flag,
          quality: "Custom Neural",
          sizeMb: parseFloat(onnxSizeMb) || 60,
          sample: "تجربة الصوت المخصص",
          urlOnnx: customModelUrl.trim() || undefined,
          urlJson: customModelJsonUrl.trim() || undefined,
          isDownloaded: true,
          isCustom: true,
          installedSizeMb: totalSizeMb
        };

        // Save to localStorage
        try {
          const stored = localStorage.getItem("piper_custom_saved_models");
          let list: any[] = stored ? JSON.parse(stored) : [];
          if (!list.some((m: any) => m.id === id)) {
            list.push(customItem);
          } else {
            list = list.map((m: any) => (m.id === id ? customItem : m));
          }
          localStorage.setItem("piper_custom_saved_models", JSON.stringify(list));
        } catch (e) {}

        // Add to local state immediately
        setCatalogModels((prev) => {
          const exists = prev.find((m) => m.id === id);
          if (exists) {
            return prev.map((m) => (m.id === id ? { ...m, isDownloaded: true, isCustom: true, installedSizeMb: totalSizeMb } : m));
          }
          return [customItem, ...prev];
        });

        setCustomDownloadProgress({
          percent: 100,
          loadedMb: totalSizeMb,
          totalMb: totalSizeMb,
          speed: "0.0 MB/s",
          step: "اكتمل تنزيل والتحقق من الملفين بنجاح 100%!",
          files: {
            onnx: { name: `${id}.onnx`, status: "completed", sizeMb: onnxSizeMb },
            json: { name: `${id}.onnx.json`, status: "completed", sizeKb: jsonSizeKb }
          }
        });

        setCustomSuccessDetails({
          modelId: id,
          name: rawName || id,
          onnxSizeMb,
          jsonSizeKb,
          totalSizeMb
        });

        setCustomSuccessMsg(`تم تنزيل وتثبيت ملفات النموذج المخصص (${rawName || id}) بنجاح!`);
        setSelectedModel(id);
        setCustomModelName("");
        setCustomModelUrl("");
        setCustomModelJsonUrl("");
        await fetchCatalog();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setCustomErrorMsg(errJson.error || "فشل تنزيل النموذج المخصص من الروابط المحددة.");
      }
    } catch (err: any) {
      clearInterval(pollInterval);
      setCustomErrorMsg(err?.message || "حدث خطأ أثناء تنزيل النموذج المخصص.");
    } finally {
      clearInterval(pollInterval);
      setIsDownloadingCustom(false);
    }
  };

  // Server Repair
  const handleRepairServer = async () => {
    setIsRepairingServer(true);
    setRepairStatusMsg("جاري فحص وتنزيل حزم النماذج والمكتبات الناقصة في السيرفر...");
    try {
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const apiEndpoint = isLocalhost ? "http://localhost:3000/api/system/repair-piper" : "/api/system/repair-piper";
      const res = await fetch(apiEndpoint, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setRepairStatusMsg(data.message || "تم تنزيل وإصلاح ملفات السيرفر بنجاح!");
        await fetchCatalog();
      } else {
        setRepairStatusMsg(data.message || "فشل إصلاح ملفات السيرفر.");
      }
    } catch (e: any) {
      setRepairStatusMsg("تعذر الاتصال بخدمة الإصلاح: " + (e?.message || e));
    } finally {
      setIsRepairingServer(false);
    }
  };

  // Filter models
  const filteredCatalog = useMemo(() => {
    return catalogModels.filter((m) => {
      if (catalogFilter === "installed" && !m.isDownloaded) return false;
      if (catalogFilter === "custom" && !m.isCustom && m.lang !== "custom") return false;
      if (catalogFilter === "de" && m.lang !== "de" && !(m.id || "").startsWith("de_")) return false;
      if (catalogFilter === "ar" && m.lang !== "ar" && !(m.id || "").startsWith("ar_")) return false;
      if (catalogFilter === "en" && m.lang !== "en" && !(m.id || "").startsWith("en_")) return false;
      if (catalogFilter === "fr" && m.lang !== "fr" && !(m.id || "").startsWith("fr_")) return false;
      if (catalogFilter === "es" && m.lang !== "es" && !(m.id || "").startsWith("es_")) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = (m.id || "").toLowerCase().includes(q);
        const nameMatch = (m.name || "").toLowerCase().includes(q);
        const langMatch = (m.lang || "").toLowerCase().includes(q);
        const langNameMatch = (m.langName || "").toLowerCase().includes(q);
        if (!idMatch && !nameMatch && !langMatch && !langNameMatch) return false;
      }
      return true;
    });
  }, [catalogModels, catalogFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in" dir="rtl">
      <div className="bg-white w-full max-w-7xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] border border-slate-200">
        {/* MODAL HEADER */}
        <header className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base tracking-tight">معمل وتوليد النطق المباشر (Live Piper Synthesis Sandbox) 🧪</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Neural TTS Lab v2.5
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                منصة المعالجة الفورية وتوليد النطق العصبي واختبار النماذج وإدارتها بدقة عالية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="إغلاق المعمل"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* MODAL BODY (SPLIT INTO TWO SIDES) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ======================================================== */}
            {/* SIDE 1: مكان التجربة والمعالجة الحية (LIVE PLAYGROUND)    */}
            {/* ======================================================== */}
            <div className="lg:col-span-6 space-y-5">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Play className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">منصة التجربة والتوليد الفوري 🎙️</h4>
                      <p className="text-[11px] text-slate-500 font-medium">اكتب أو اختر أي نص واستمع للنطق العصبي فوراً</p>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80 font-mono">
                    {selectedModel}
                  </span>
                </div>

                {/* Preset Phrase Pills */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 block">⚡ عبارات سريعة للتجربة الفورية بضغطة واحدة:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {samplePresets.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTestText(preset.text);
                          setSelectedModel(preset.model);
                          handleSynthesize(preset.text, preset.model);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-[11px] font-medium text-slate-700 transition-all cursor-pointer"
                      >
                        <span>{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interactive Text Input Area */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">النص المراد نطقه وتوليده عصبياً:</label>
                    <span className="text-[10px] text-slate-400 font-mono">{testText.length} حرف</span>
                  </div>
                  <textarea
                    rows={3}
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="اكتب أي نص أو جملة لتوليد النطق الطبيعي لها بواسطة الذكاء الاصطناعي..."
                    className="w-full text-xs sm:text-sm p-3.5 rounded-2xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none leading-relaxed resize-none shadow-2xs font-medium"
                  />
                </div>

                {/* Model Selector & Speed Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Model Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">النموذج الصوتي النشط:</label>
                    <div className="relative">
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 font-bold focus:border-blue-500 outline-none cursor-pointer"
                      >
                        <optgroup label="🚀 أصوات سيرفر Gradio العصبي المحلي (Qwen3-TTS)">
                          {DEFAULT_GRADIO_VOICES.map((gv) => (
                            <option key={`gradio:${gv.id}`} value={`gradio:${gv.id}`}>
                              🎙️ {gv.name} ({gv.id})
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="⚡ محركات النطق المباشرة">
                          <option value="google">⚡ Google Translate TTS (خدمة سريعة)</option>
                          <option value="webspeech">🌐 Web Speech API (نطق المتصفح)</option>
                        </optgroup>
                        <optgroup label="🧠 نماذج Piper العصبية المتاحة">
                          {catalogModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.flag || "🗣️"} {m.name} {m.isDownloaded ? "✓ [منزّل]" : "[متاح سحابياً]"}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  {/* Speech Rate Controls */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">سرعة النطق (Speech Speed):</label>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { rate: 0.75, label: "0.75x" },
                        { rate: 1.0, label: "1.0x" },
                        { rate: 1.25, label: "1.25x" },
                        { rate: 1.5, label: "1.5x" }
                      ].map((item) => (
                        <button
                          key={item.rate}
                          type="button"
                          onClick={() => setSpeechRate(item.rate)}
                          className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            speechRate === item.rate
                              ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Gradio Server Quick Connection Bar */}
                <div className="p-3 rounded-xl bg-purple-50/80 border border-purple-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-purple-700" />
                      <span className="text-[11px] font-bold text-purple-900">سيرفر Gradio المحلي (Qwen3-TTS):</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestGradioConnection}
                      disabled={isTestingGradio}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isTestingGradio ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                      <span>{isTestingGradio ? "جاري الفحص..." : "فحص الاتصال"}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={gradioTtsUrl}
                      onChange={(e) => {
                        setGradioTtsUrl(e.target.value);
                        localStorage.setItem("settings_gradio_tts_url", e.target.value.trim());
                      }}
                      className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-purple-300 bg-white text-slate-900 font-mono focus:border-purple-600 outline-none"
                      placeholder="http://192.168.0.159:7860"
                      dir="ltr"
                    />
                  </div>
                  {gradioTestResult && (
                    <div
                      className={`text-[11px] p-2 rounded-lg font-medium flex items-center gap-1.5 ${
                        gradioTestResult.ok
                          ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                          : "bg-red-100 text-red-900 border border-red-300"
                      }`}
                    >
                      {gradioTestResult.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-700 shrink-0" />
                      )}
                      <span>{gradioTestResult.msg}</span>
                    </div>
                  )}
                </div>

                {/* Synthesis Mode Switcher */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/80 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700">بيئة تشغيل ومعالجة الصوت:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTtsExecutionMode("local");
                        localStorage.setItem("settings_tts_execution_mode", "local");
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        ttsExecutionMode === "local"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      💻 محلي بالمتصفح
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTtsExecutionMode("server");
                        localStorage.setItem("settings_tts_execution_mode", "server");
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        ttsExecutionMode === "server"
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      ☁️ خادم السيرفر
                    </button>
                  </div>
                </div>

                {/* PIPER ENGINE PERSISTENCE & STANDBY MODE CARD */}
                <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-purple-600" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-900">جاهزية وسرعة المحرك في الذاكرة (RAM Mode):</span>
                          {piperEngineStatus?.isProcessActive ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1 border border-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                              <span>نشط بالذاكرة</span>
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              <span>خامل (مفرغ)</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleWarmupPiperEngine}
                        disabled={isWarmingUpEngine}
                        className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="تحميل النموذج بالذاكرة مسبقاً"
                      >
                        <Zap className={`w-3 h-3 ${isWarmingUpEngine ? "animate-spin" : ""}`} />
                        <span>{isWarmingUpEngine ? "تهيئة..." : "⚡ تهيئة بالرام"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleFlushPiperEngine}
                        disabled={isFlushingEngine}
                        className="px-2 py-1 rounded-lg bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-300 text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="تفريغ الذاكرة وإغلاق المحرك"
                      >
                        <Trash2 className={`w-3 h-3 ${isFlushingEngine ? "animate-spin" : ""}`} />
                        <span>{isFlushingEngine ? "تفريغ..." : "🧹 تفريغ الرام"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Mode Toggles */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleChangePiperEngineMode("idle_60s")}
                      disabled={isUpdatingEngineMode}
                      className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                        piperStandbyMode === "idle_60s"
                          ? "border-purple-600 bg-purple-100/90 font-bold text-purple-950 shadow-xs"
                          : "border-slate-200 bg-white hover:border-purple-300 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold flex items-center gap-1">
                          <Timer className="w-3.5 h-3.5 text-purple-600" />
                          <span>⏱️ 60 ثانية ثم يخمل</span>
                        </span>
                        {piperStandbyMode === "idle_60s" && <Check className="w-3.5 h-3.5 text-purple-700" />}
                      </div>
                      <span className="text-[10px] text-slate-500 font-normal leading-tight">
                        يخمل تلقائياً بعد 60 ثانية لتوفير الذاكرة
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChangePiperEngineMode("always_ready")}
                      disabled={isUpdatingEngineMode}
                      className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                        piperStandbyMode === "always_ready"
                          ? "border-indigo-600 bg-indigo-100/90 font-bold text-indigo-950 shadow-xs"
                          : "border-slate-200 bg-white hover:border-indigo-300 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-indigo-600" />
                          <span>⚡ جاهز دائماً بكل الحالات</span>
                        </span>
                        {piperStandbyMode === "always_ready" && <Check className="w-3.5 h-3.5 text-indigo-700" />}
                      </div>
                      <span className="text-[10px] text-slate-500 font-normal leading-tight">
                        محفوظ بالذاكرة باستمرار لتوليد فوري
                      </span>
                    </button>
                  </div>
                </div>

                {/* MAIN SYNTHESIS ACTION BUTTON */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleSynthesize()}
                    disabled={isGenerating || !testText.trim()}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-extrabold text-sm rounded-2xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>جاري المعالجة العصبية وتوليد النطق الآن... ⚙️</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className={`w-5 h-5 ${isPlaying ? "animate-bounce" : ""}`} />
                        <span>توليد واستماع النطق الفوري (Piper Neural Synthesis) 🔊</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Pipeline Step Progression Indicator */}
                {isGenerating && (
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs space-y-2 animate-pulse">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <Activity className="w-4 h-4 animate-spin text-blue-600" />
                        <span>مراحل معالجة شبكة Piper (المرحلة {currentPipelineStep} من 4):</span>
                      </span>
                      <span className="font-mono text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                        {currentPipelineStep * 25}%
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-800 font-medium leading-relaxed">
                      {pipelineStepDesc}
                    </p>
                    <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-300"
                        style={{ width: `${currentPipelineStep * 25}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Waveform & Audio Player Card */}
                {lastAudioBlobUrl && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-blue-950 text-white space-y-3 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                        <span className="text-xs font-bold text-emerald-300">
                          {isPlaying ? "جاري تشغيل الصوت الآن 🔊" : "الملف الصوتي جاهز للاستماع والتنزيل"}
                        </span>
                      </div>
                      {lastAudioDuration && (
                        <span className="text-[11px] font-mono text-slate-300 bg-white/10 px-2 py-0.5 rounded-md">
                          ⏱️ {lastAudioDuration} ثانية
                        </span>
                      )}
                    </div>

                    {/* Animated Waveform Bars */}
                    <div className="h-10 bg-white/5 rounded-xl flex items-center justify-center gap-1 px-4 border border-white/10 overflow-hidden">
                      {[40, 70, 30, 85, 60, 95, 45, 80, 55, 90, 65, 35, 75, 50, 85, 40, 65, 90, 30, 80].map((h, i) => (
                        <div
                          key={i}
                          className="w-1 bg-gradient-to-t from-blue-400 to-emerald-400 rounded-full transition-all duration-200"
                          style={{
                            height: isPlaying ? `${Math.max(15, (h * ((i % 3) + 1)) % 100)}%` : "20%",
                            opacity: isPlaying ? 1 : 0.4
                          }}
                        />
                      ))}
                    </div>

                    {/* Audio Player Controls */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleReplayAudio}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>إعادة الاستماع</span>
                        </button>

                        {isPlaying && (
                          <button
                            type="button"
                            onClick={handleStopAudio}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <VolumeX className="w-3.5 h-3.5" />
                            <span>إيقاف</span>
                          </button>
                        )}
                      </div>

                      <a
                        href={lastAudioBlobUrl}
                        download={`piper-speech-${selectedModel}.wav`}
                        className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors border border-white/15 cursor-pointer"
                        title="تنزيل الملف الصوتي الناتج بصيغة WAV"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تنزيل ملف .WAV ⬇️</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Real-time Benchmark Metrics */}
                {latencyMs !== null && (
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                    <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold block">زمن المعالجة</span>
                      <span className="text-xs font-black text-blue-700">{latencyMs} ms</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold block">معدل العينات</span>
                      <span className="text-xs font-black text-slate-800">22.05 kHz</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold block">نوع القناة</span>
                      <span className="text-xs font-black text-slate-800">Mono 16-bit</span>
                    </div>
                  </div>
                )}

                {/* Error & Solution Box */}
                {speechError && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2.5">
                    <div className="flex items-center justify-between font-bold text-rose-800">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{speechError.msg}</span>
                      </div>
                      <button onClick={() => setSpeechError(null)} className="text-rose-400 hover:text-rose-700 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {speechError.cause && (
                      <p className="text-[11px] text-rose-700 leading-relaxed">
                        <strong>🔍 السبب المكتشف:</strong> {speechError.cause}
                      </p>
                    )}
                    {speechError.solution && (
                      <p className="text-[11px] text-rose-700 leading-relaxed">
                        <strong>💡 الحل المقترح:</strong> {speechError.solution}
                      </p>
                    )}

                    <div className="pt-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleRepairServer}
                        disabled={isRepairingServer}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRepairingServer ? "animate-spin" : ""}`} />
                        <span>{isRepairingServer ? "جاري الفحص والإصلاح..." : "🔧 فحص وإصلاح ملفات السيرفر تلقائياً"}</span>
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* ======================================================== */}
            {/* SIDE 2: الموديلات وكل تفاصيلها (MODELS CATALOG & DETAILS) */}
            {/* ======================================================== */}
            <div className="lg:col-span-6 space-y-5">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                
                {/* Side Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <DownloadCloud className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">كتالوج النماذج العصبية وإدارتها 📦</h4>
                      <p className="text-[11px] text-slate-500 font-medium">استعراض وتنزيل الأصوات وروابط HuggingFace المباشرة</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={fetchCatalog}
                      disabled={isLoadingModels}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="تحديث قائمة النماذج"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingModels ? "animate-spin" : ""}`} />
                      <span>تحديث</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRepairServer}
                      disabled={isRepairingServer}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="فحص وإصلاح ملفات السيرفر"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRepairingServer ? "animate-spin" : ""}`} />
                      <span>إصلاح السيرفر</span>
                    </button>
                  </div>
                </div>

                {repairStatusMsg && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium leading-relaxed">
                    {repairStatusMsg}
                  </div>
                )}

                {/* Filter Tabs & Search Bar */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {[
                      { id: "all", label: `جميع الأصوات (${catalogModels.length})` },
                      { id: "de", label: `🇩🇪 الألمانية (${catalogModels.filter((m) => m.lang === "de" || (m.id || "").startsWith("de_")).length})` },
                      { id: "ar", label: `🇯🇴 العربية (${catalogModels.filter((m) => m.lang === "ar" || (m.id || "").startsWith("ar_")).length})` },
                      { id: "en", label: `🇺🇸 الإنجليزية (${catalogModels.filter((m) => m.lang === "en" || (m.id || "").startsWith("en_")).length})` },
                      { id: "fr", label: `🇫🇷 الفرنسية (${catalogModels.filter((m) => m.lang === "fr" || (m.id || "").startsWith("fr_")).length})` },
                      { id: "es", label: `🇪🇸 الإسبانية (${catalogModels.filter((m) => m.lang === "es" || (m.id || "").startsWith("es_")).length})` },
                      { id: "custom", label: `🎯 مخصصة (${catalogModels.filter((m) => m.isCustom || m.lang === "custom").length})` },
                      { id: "installed", label: `💾 المنزلة فقط (${catalogModels.filter((m) => m.isDownloaded).length})` }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCatalogFilter(tab.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                          catalogFilter === tab.id
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Search input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث باسم الصوت أو المعرّف (مثل: thorsten أو kareem أو ramona)..."
                      className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none font-medium"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Scrollable Model Cards List */}
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {filteredCatalog.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      لا توجد نماذج مطابقة للبحث أو الفلتر المحدد حالياً.
                    </div>
                  ) : (
                    filteredCatalog.map((model) => {
                      const isDownloading = downloadingIds[model.id] || false;
                      const isDeleting = deletingIds[model.id] || false;
                      const isSelected = selectedModel === model.id;
                      const isLinksExpanded = expandedLinksMap[model.id] || false;
                      const urls = getPiperModelUrls(model);
                      const prog = downloadProgressMap[model.id];

                      return (
                        <div
                          key={model.id}
                          className={`p-4 rounded-2xl border transition-all space-y-3 ${
                            isSelected
                              ? "bg-blue-50/70 border-blue-500 shadow-sm"
                              : "bg-slate-50/60 hover:bg-slate-100/80 border-slate-200"
                          }`}
                        >
                          {/* Card Top Row */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-base">{model.flag || "🗣️"}</span>
                                <span className="font-extrabold text-xs text-slate-900">{model.name}</span>
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                                  {model.id}
                                </span>
                                {model.quality && (
                                  <span className="text-[9.5px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                                    {model.quality}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                <span>الحجم: {model.sizeMb ? `${model.sizeMb} MB` : "~60 MB"}</span>
                                <span>•</span>
                                <span>{model.speakerCount ? `${model.speakerCount} متحدثين` : "متحدث واحد"}</span>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div className="shrink-0">
                              {model.isDownloaded ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  <span>مثبت محلياً</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                  متاح سحابياً
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Active Downloading Bar for this model */}
                          {isDownloading && prog && (
                            <div className="p-3 bg-blue-100/70 border border-blue-200 rounded-xl space-y-2.5 animate-fade-in">
                              <div className="flex items-center justify-between text-[11px] font-bold text-blue-900 flex-wrap gap-1">
                                <span className="flex items-center gap-1.5">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                  <span>{prog.step || "جاري التنزيل..."}</span>
                                </span>
                                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                  {prog.speed && (
                                    <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200">
                                      ⚡ {prog.speed}
                                    </span>
                                  )}
                                  <span className="bg-blue-200/70 px-1.5 py-0.5 rounded text-blue-900">
                                    📦 {prog.loadedMb} / {prog.totalMb}
                                  </span>
                                  <span className="font-extrabold text-blue-700 text-xs">{prog.percent}%</span>
                                </div>
                              </div>

                              {/* Progress Track */}
                              <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden p-0.5 border border-blue-300">
                                <div
                                  className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-300 shadow-xs"
                                  style={{ width: `${Math.max(3, prog.percent)}%` }}
                                />
                              </div>

                              {/* 2-Files Download Status Cards for Catalog Model */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                {/* File 1: ONNX */}
                                <div className="p-2 rounded-lg bg-white/90 border border-blue-200/80 flex items-center justify-between text-[10.5px]">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-blue-600 font-bold">📦</span>
                                    <span className="font-mono font-bold text-slate-800 truncate">
                                      {prog.files?.onnx?.name || `${model.id}.onnx`}
                                    </span>
                                  </div>
                                  <div>
                                    {prog.files?.onnx?.status === "completed" || prog.percent >= 90 ? (
                                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-[9.5px] font-bold flex items-center gap-0.5">
                                        <Check className="w-2.5 h-2.5 stroke-[3]" /> {prog.files?.onnx?.sizeMb || prog.loadedMb}
                                      </span>
                                    ) : prog.files?.onnx?.status === "error" ? (
                                      <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded text-[9.5px] font-bold">
                                        ❌ خطأ
                                      </span>
                                    ) : (
                                      <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[9.5px] font-bold flex items-center gap-0.5">
                                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> جاري التحميل
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* File 2: JSON */}
                                <div className="p-2 rounded-lg bg-white/90 border border-blue-200/80 flex items-center justify-between text-[10.5px]">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-indigo-600 font-bold">📄</span>
                                    <span className="font-mono font-bold text-slate-800 truncate">
                                      {prog.files?.json?.name || `${model.id}.onnx.json`}
                                    </span>
                                  </div>
                                  <div>
                                    {prog.files?.json?.status === "completed" || prog.percent === 100 ? (
                                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-[9.5px] font-bold flex items-center gap-0.5">
                                        <Check className="w-2.5 h-2.5 stroke-[3]" /> {prog.files?.json?.sizeKb || "4.8 KB"}
                                      </span>
                                    ) : prog.files?.json?.status === "downloading" ? (
                                      <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded text-[9.5px] font-bold flex items-center gap-0.5">
                                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> جاري التحقق
                                      </span>
                                    ) : (
                                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9.5px]">
                                        ⏳ بالانتظار
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Direct Links Drawer (Hugging Face URLs) */}
                          {isLinksExpanded && (
                            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 font-mono text-[10.5px]">
                              {/* ONNX URL */}
                              <div className="space-y-1">
                                <span className="text-[10px] font-sans font-bold text-slate-600 block">📦 رابط ملف النموذج (.onnx):</span>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    readOnly
                                    value={urls.urlOnnx}
                                    dir="ltr"
                                    className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-[10px] select-all outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLink(urls.urlOnnx, `${model.id}-onnx`)}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                                    title="نسخ الرابط"
                                  >
                                    {copiedLinkId === `${model.id}-onnx` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                  <a
                                    href={urls.urlOnnx}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                                    title="فتح وتنزيل الرابط بالمتصفح"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </div>

                              {/* JSON URL */}
                              <div className="space-y-1">
                                <span className="text-[10px] font-sans font-bold text-slate-600 block">📄 رابط ملف التوصيف (.onnx.json):</span>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    readOnly
                                    value={urls.urlJson}
                                    dir="ltr"
                                    className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-[10px] select-all outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLink(urls.urlJson, `${model.id}-json`)}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                                    title="نسخ الرابط"
                                  >
                                    {copiedLinkId === `${model.id}-json` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                  <a
                                    href={urls.urlJson}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                                    title="فتح وتنزيل الرابط بالمتصفح"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Card Action Buttons */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 flex-wrap gap-2">
                            <div className="flex items-center gap-1.5">
                              {/* Quick Test Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedModel(model.id);
                                  handleSynthesize(undefined, model.id);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>تجربة سريعة</span>
                              </button>

                              {/* Toggle Links Drawer */}
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedLinksMap((prev) => ({
                                    ...prev,
                                    [model.id]: !prev[model.id]
                                  }))
                                }
                                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Link2 className="w-3.5 h-3.5 text-blue-600" />
                                <span>الروابط</span>
                                {isLinksExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {model.isDownloaded ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteModel(model.id)}
                                  disabled={isDeleting}
                                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                                  title="حذف النموذج لتوفير المساحة"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>حذف</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleDownloadModel(model)}
                                  disabled={isDownloading}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>تنزيل النموذج ⬇️</span>
                                </button>
                              )}
                            </div>
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>

                {/* ======================================================== */}
                {/* CUSTOM MODEL DOWNLOADER (اسم مخصص والرابطين فقط)           */}
                {/* ======================================================== */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-blue-600" />
                      <span>تنزيل نموذج صوتي مخصص (اسم مخصص + رابطين):</span>
                    </h5>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      Custom Voice ONNX
                    </span>
                  </div>

                  {/* 1. Custom Name Input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      اسم مخصص (Custom Name):
                    </label>
                    <input
                      type="text"
                      value={customModelName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomModelName(val);
                        const clean = val.replace(/\.onnx$/, "").trim();
                        if (clean.includes("-")) {
                          const parts = clean.split("-");
                          const langCode = parts[0];
                          const voiceName = parts[1];
                          const quality = parts[2] || "medium";
                          const langShort = langCode.split("_")[0];
                          if (!customModelUrl || customModelUrl.includes("huggingface.co/rhasspy/piper-voices")) {
                            setCustomModelUrl(`https://huggingface.co/rhasspy/piper-voices/resolve/main/${langShort}/${langCode}/${voiceName}/${quality}/${clean}.onnx`);
                          }
                          if (!customModelJsonUrl || customModelJsonUrl.includes("huggingface.co/rhasspy/piper-voices")) {
                            setCustomModelJsonUrl(`https://huggingface.co/rhasspy/piper-voices/resolve/main/${langShort}/${langCode}/${voiceName}/${quality}/${clean}.onnx.json`);
                          }
                        }
                      }}
                      placeholder="مثل: de_DE-ramona-low أو صوت رامونا المخصص"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-blue-500 outline-none shadow-2xs font-mono"
                    />
                  </div>

                  {/* 2. ONNX URL & JSON URL */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-bold text-slate-700 block">
                        📦 رابط ملف النموذج الأساسي (.onnx):
                      </label>
                      <input
                        type="text"
                        value={customModelUrl}
                        onChange={(e) => setCustomModelUrl(e.target.value)}
                        placeholder="https://.../model.onnx"
                        dir="ltr"
                        className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-500 outline-none font-mono shadow-2xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10.5px] font-bold text-slate-700 block">
                        📄 رابط ملف التوصيف والإعدادات (.onnx.json):
                      </label>
                      <input
                        type="text"
                        value={customModelJsonUrl}
                        onChange={(e) => setCustomModelJsonUrl(e.target.value)}
                        placeholder="https://.../model.onnx.json"
                        dir="ltr"
                        className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-500 outline-none font-mono shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Live Download Progress Bar, Speed & 2-Files Validation Tracker */}
                  {isDownloadingCustom && customDownloadProgress && (
                    <div className="p-3.5 rounded-2xl bg-white border border-blue-200 shadow-sm space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 text-blue-700">
                          <DownloadCloud className="w-4 h-4 animate-bounce" />
                          <span>{customDownloadProgress.step}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200">
                            ⚡ {customDownloadProgress.speed || "0.0 MB/s"}
                          </span>
                          <span className="text-[11px] font-mono font-bold bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md border border-blue-200">
                            📦 {customDownloadProgress.loadedMb} / {customDownloadProgress.totalMb}
                          </span>
                          <span className="text-xs font-extrabold text-blue-700 font-mono">
                            {customDownloadProgress.percent}%
                          </span>
                        </div>
                      </div>

                      {/* Animated Gradient Progress Track */}
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 rounded-full transition-all duration-300 shadow-xs"
                          style={{ width: `${Math.max(3, customDownloadProgress.percent)}%` }}
                        />
                      </div>

                      {/* 2-Files Validation Status Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {/* File 1: ONNX weights */}
                        <div className="p-2.5 rounded-xl border bg-slate-50 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                              📦
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-slate-800 font-mono text-[11px] truncate">
                                {customDownloadProgress.files?.onnx?.name || "model.onnx"}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                ملف النموذج الأساسي (الأوزان)
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0">
                            {customDownloadProgress.files?.onnx?.status === "completed" || customDownloadProgress.percent >= 90 ? (
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" /> {customDownloadProgress.files?.onnx?.sizeMb || customDownloadProgress.loadedMb}
                              </span>
                            ) : customDownloadProgress.files?.onnx?.status === "error" ? (
                              <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> فشل التنزيل
                              </span>
                            ) : (
                              <span className="bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" /> جاري التنزيل
                              </span>
                            )}
                          </div>
                        </div>

                        {/* File 2: JSON config */}
                        <div className="p-2.5 rounded-xl border bg-slate-50 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                              📄
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-slate-800 font-mono text-[11px] truncate">
                                {customDownloadProgress.files?.json?.name || "model.onnx.json"}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                ملف التوصيف والإعدادات
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0">
                            {customDownloadProgress.files?.json?.status === "completed" || customDownloadProgress.percent === 100 ? (
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" /> {customDownloadProgress.files?.json?.sizeKb || "4.8 KB"}
                              </span>
                            ) : customDownloadProgress.files?.json?.status === "downloading" ? (
                              <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" /> جاري التنزيل والتحقق
                              </span>
                            ) : customDownloadProgress.files?.json?.status === "error" ? (
                              <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> فشل التنزيل
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                ⏳ في الانتظار
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Comprehensive Success Confirmation Box */}
                  {customSuccessDetails && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm space-y-2.5 animate-fade-in text-xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-emerald-900 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>اكتمل تنزيل وتثبيت النموذجين بنجاح 100%!</span>
                        </div>
                        <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md font-mono font-bold text-[11px]">
                          📦 الحجم الإجمالي: {customSuccessDetails.totalSizeMb}
                        </span>
                      </div>

                      {/* Verified Files Breakdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-white/80 border border-emerald-200 flex items-center justify-between">
                          <span className="text-slate-700">✓ ملف النموذج الأساسي (.onnx):</span>
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                            {customSuccessDetails.onnxSizeMb}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/80 border border-emerald-200 flex items-center justify-between">
                          <span className="text-slate-700">✓ ملف التوصيف (.onnx.json):</span>
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                            {customSuccessDetails.jsonSizeKb}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                        <span className="text-slate-600 text-[11px]">
                          تم إدراج الصوت المخصص في القائمة وتعيينه كصوت نشط للتوليد.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedModel(customSuccessDetails.modelId);
                            handleSynthesize(undefined, customSuccessDetails.modelId);
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer transition-all"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>تجربة الصوت الآن 🔊</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {customErrorMsg && (
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium space-y-1.5 animate-fade-in">
                      <div className="flex items-center gap-1.5 font-bold text-rose-800">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>تعذر إتمام التنزيل والتثبيت:</span>
                      </div>
                      <p className="text-[11.5px] text-rose-700 font-mono bg-white/80 p-2 rounded-lg border border-rose-200">
                        {customErrorMsg}
                      </p>
                      <p className="text-[10.5px] text-slate-600">
                        💡 تأكد من أن الرابط مباشر وينتهي بـ <code className="text-blue-700 font-bold">.onnx</code> و <code className="text-blue-700 font-bold">.onnx.json</code> ويدعم التنزيل المباشر (مثل Hugging Face).
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadCustomModel}
                      disabled={isDownloadingCustom}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isDownloadingCustom ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري جلب وتثبيت النموذج ({customDownloadProgress?.percent ?? 0}%)...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>تنزيل وتثبيت النموذج المخصص ⬇️</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>

        {/* MODAL FOOTER */}
        <footer className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>💡 نصيحة: يمكنك النقر على أي جملة سريعة للتجربة الفورية بالصوت المختار.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
          >
            إغلاق المعمل
          </button>
        </footer>

      </div>
    </div>
  );
};

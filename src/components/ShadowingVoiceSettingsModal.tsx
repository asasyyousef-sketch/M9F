import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Sliders,
  Volume2,
  Check,
  Zap,
  Globe,
  Server,
  Play,
  Square,
  Search,
  RefreshCw,
  Sparkles,
  Gauge,
  Info,
  Languages,
  Mic,
  Cpu,
} from "lucide-react";
import { DEFAULT_GRADIO_VOICES, GRADIO_LANGUAGES } from "../types";
import { fetchGradioAudioBlob, speakClient } from "./Modals";

export type ShadowingVoiceProvider = "google" | "piper" | "external" | "webspeech";

export interface PiperVoiceModelItem {
  id: string;
  name: string;
  lang: string;
  langName: string;
  flag: string;
  gender?: "male" | "female";
  quality: string;
  sample: string;
  isDownloaded?: boolean;
}

// Built-in catalog of standard Piper neural models
export const BUILTIN_PIPER_MODELS: PiperVoiceModelItem[] = [
  // German (🇩🇪)
  {
    id: "de_DE-thorsten-medium",
    name: "Thorsten Medium (ألماني ذكوري - متزن)",
    lang: "de",
    langName: "Deutsch (German)",
    flag: "🇩🇪",
    gender: "male",
    quality: "Medium (61 MB)",
    sample: "Guten Tag! Das ist die deutsche Thorsten-Stimme für Ihr Shadowing-Training.",
  },
  {
    id: "de_DE-thorsten-high",
    name: "Thorsten High (ألماني ذكوري - فائق الدقة)",
    lang: "de",
    langName: "Deutsch (German)",
    flag: "🇩🇪",
    gender: "male",
    quality: "High (110 MB)",
    sample: "Hallo! Dies ist die hochauflösende Thorsten-Stimme für absolut klares Deutsch.",
  },
  {
    id: "de_DE-thorsten_emotional-medium",
    name: "Thorsten Emotional (ألماني ذكوري - نبرة تفاعلية)",
    lang: "de",
    langName: "Deutsch (German)",
    flag: "🇩🇪",
    gender: "male",
    quality: "Medium (61 MB)",
    sample: "Hallo zusammen! Mit dieser emotionalen Stimme macht das Deutschlernen richtig Spaß.",
  },
  {
    id: "de_DE-kerstin-low",
    name: "Kerstin Low (ألماني أنثوي - سريع ونقي)",
    lang: "de",
    langName: "Deutsch (German)",
    flag: "🇩🇪",
    gender: "female",
    quality: "Low (16 MB)",
    sample: "Hallo! Ich bin Kerstin. Ich spreche Deutsch mit Ihnen für die Ausspracheübungen.",
  },
  {
    id: "de_DE-pavoque-low",
    name: "Pavoque Low (ألماني - سريع وخفيف)",
    lang: "de",
    langName: "Deutsch (German)",
    flag: "🇩🇪",
    gender: "male",
    quality: "Low (16 MB)",
    sample: "Guten Tag! Ich bin Pavoque und spreche klares, fließendes Deutsch.",
  },
  {
    id: "de_DE-ramona-low",
    name: "Ramona Low (ألماني أنثوي - ناعم)",
    lang: "de",
    langName: "Deutsch (German)",
    flag: "🇩🇪",
    gender: "female",
    quality: "Low (16 MB)",
    sample: "Herzlich willkommen! Ich begleite Sie bei Ihren Sprachübungen.",
  },
  {
    id: "de_DE-amany-medium",
    name: "Amany (ألماني أنثوي - عالي الوضوح)",
    lang: "de",
    langName: "Deutsch (German)",
    flag: "🇩🇪",
    gender: "female",
    quality: "Medium (61 MB)",
    sample: "Guten Tag! Das ist die deutsche Stimme von Amany.",
  },

  // English (🇺🇸 / 🇬🇧)
  {
    id: "en_US-lessac-medium",
    name: "Lessac (إنجليزي أمريكي - نقي وواضح)",
    lang: "en",
    langName: "English (US)",
    flag: "🇺🇸",
    gender: "female",
    quality: "Medium (61 MB)",
    sample: "Hello! This is the Lessac American English neural voice for perfect shadowing.",
  },
  {
    id: "en_US-ryan-medium",
    name: "Ryan (إنجليزي أمريكي ذكوري)",
    lang: "en",
    langName: "English (US)",
    flag: "🇺🇸",
    gender: "male",
    quality: "Medium (61 MB)",
    sample: "Hey there! Ready to practice your English pronunciation today?",
  },
  {
    id: "en_US-amy-medium",
    name: "Amy (إنجليزي أمريكي أنثوي - سلس)",
    lang: "en",
    langName: "English (US)",
    flag: "🇺🇸",
    gender: "female",
    quality: "Medium (61 MB)",
    sample: "Hi! I am Amy, and I will help you master English speech rhythm.",
  },
  {
    id: "en_US-danny-low",
    name: "Danny (إنجليزي أمريكي ذكوري - سريع)",
    lang: "en",
    langName: "English (US)",
    flag: "🇺🇸",
    gender: "male",
    quality: "Low (16 MB)",
    sample: "Hello! Danny here, ready for fast and accurate speaking practice.",
  },
  {
    id: "en_GB-alba-medium",
    name: "Alba (إنجليزي بريطاني أنثوي - لكنة ملكية)",
    lang: "en",
    langName: "English (UK)",
    flag: "🇬🇧",
    gender: "female",
    quality: "Medium (61 MB)",
    sample: "Good day! Alba here, providing pristine British English pronunciation.",
  },

  // Arabic (🇯🇴 / 🇸🇦)
  {
    id: "ar_JO-kareem-medium",
    name: "Kareem Medium (عربي ذكوري فصيح)",
    lang: "ar",
    langName: "العربية (Arabic)",
    flag: "🇯🇴",
    gender: "male",
    quality: "Medium (61 MB)",
    sample: "مرحباً بك! هذه تجربة الصوت العربي لتقنية بايبر العصبية في استوديو الشادوينج.",
  },
  {
    id: "ar_JO-kareem-low",
    name: "Kareem Low (عربي ذكوري - خفيف وسريع)",
    lang: "ar",
    langName: "العربية (Arabic)",
    flag: "🇯🇴",
    gender: "male",
    quality: "Low (16 MB)",
    sample: "أهلاً بك، صوت كريم العربي السريع لممارسة النطق.",
  },

  // French (🇫🇷)
  {
    id: "fr_FR-siwis-medium",
    name: "Siwis (فرنسي أنثوي - باريسي كلاسيكي)",
    lang: "fr",
    langName: "Français (French)",
    flag: "🇫🇷",
    gender: "female",
    quality: "Medium (61 MB)",
    sample: "Bonjour! Ceci est la voix française Siwis pour perfectionner votre accent.",
  },

  // Spanish (🇪🇸)
  {
    id: "es_ES-carlfm-medium",
    name: "CarlFM (إسباني ذكوري - قشتالي واضح)",
    lang: "es",
    langName: "Español (Spanish)",
    flag: "🇪🇸",
    gender: "male",
    quality: "Medium (61 MB)",
    sample: "¡Hola! Esta es la voz en español para practicar la pronunciación.",
  },
];

// Additional Edge-TTS / Gradio voices list
export const EXTENDED_EDGE_VOICES = [
  { id: "ryan", name: "Ryan (ذكوري - إنجليزي/ألماني)", lang: "de", gender: "male" as const, desc: "صوت طبيعي متوازن" },
  { id: "serena", name: "Serena (أنثوي - إنجليزي/ألماني)", lang: "de", gender: "female" as const, desc: "نبرة أنثوية دافئة" },
  { id: "vivian", name: "Vivian (أنثوي - إنجليزي/ألماني)", lang: "de", gender: "female" as const, desc: "نبرة احترافية واضحة" },
  { id: "aiden", name: "Aiden (ذكوري - إنجليزي/ألماني)", lang: "en", gender: "male" as const, desc: "صوت شبابي ديناميكي" },
  { id: "eric", name: "Eric (ذكوري - إنجليزي/ألماني)", lang: "de", gender: "male" as const, desc: "نبرة هادئة ورصينة" },
  { id: "dylan", name: "Dylan (ذكوري - إنجليزي/ألماني)", lang: "en", gender: "male" as const, desc: "نطق واضح للجمل السريعة" },
  { id: "de-DE-KatjaNeural", name: "Katja Neural (ألماني أنثوي - Microsoft Edge)", lang: "de", gender: "female" as const, desc: "صوت إيدج الواقعي للألمانية" },
  { id: "de-DE-ConradNeural", name: "Conrad Neural (ألماني ذكوري - Microsoft Edge)", lang: "de", gender: "male" as const, desc: "صوت ذكوري عميق ودقيق" },
  { id: "en-US-JennyNeural", name: "Jenny Neural (إنجليزي أمريكي أنثوي)", lang: "en", gender: "female" as const, desc: "أعلى دقة للنطق الأمريكي" },
  { id: "en-US-GuyNeural", name: "Guy Neural (إنجليزي أمريكي ذكوري)", lang: "en", gender: "male" as const, desc: "صوت إذاعي طبيعي" },
  { id: "ar-SA-HamedNeural", name: "Hamed Neural (عربي ذكوري فصيح)", lang: "ar", gender: "male" as const, desc: "نطق عربي فصيح متقن" },
  { id: "ar-SA-ZariyahNeural", name: "Zariyah Neural (عربي أنثوي فصيح)", lang: "ar", gender: "female" as const, desc: "نبرة فصيحة عذبة" },
  { id: "uncle_fu", name: "Uncle Fu (صيني/إنجليزي)", lang: "zh", gender: "male" as const, desc: "نبرة ودية مميزة" },
  { id: "ono_anna", name: "Ono Anna (ياباني/إنجليزي)", lang: "ja", gender: "female" as const, desc: "صوت ياباني نقي" },
  { id: "sohee", name: "Sohee (كوري/إنجليزي)", lang: "ko", gender: "female" as const, desc: "صوت كوري واضح" },
];

export interface ShadowingVoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: ShadowingVoiceProvider;
  selectedVoiceId: string;
  language: string;
  playbackSpeed: number;
  gradioUrl: string;
  onSaveSettings: (settings: {
    provider: ShadowingVoiceProvider;
    selectedVoiceId: string;
    language: string;
    playbackSpeed: number;
    gradioUrl: string;
  }) => void;
  currentSentenceText?: string;
}

export const ShadowingVoiceSettingsModal: React.FC<ShadowingVoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  provider: initialProvider,
  selectedVoiceId: initialVoiceId,
  language: initialLanguage,
  playbackSpeed: initialPlaybackSpeed,
  gradioUrl: initialGradioUrl,
  onSaveSettings,
  currentSentenceText = "",
}) => {
  // Local active editing states
  const [provider, setProvider] = useState<ShadowingVoiceProvider>(initialProvider);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(initialVoiceId);
  const [language, setLanguage] = useState<string>(initialLanguage);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(initialPlaybackSpeed);
  const [gradioUrl, setGradioUrl] = useState<string>(initialGradioUrl);

  // Dynamic server piper models list
  const [serverModels, setServerModels] = useState<PiperVoiceModelItem[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);

  // Filters & Custom Input
  const [langFilter, setLangFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [customModelInput, setCustomModelInput] = useState<string>("");
  const [showCustomModelInput, setShowCustomModelInput] = useState<boolean>(false);

  // Browser system voices (Web Speech API)
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Testing Speech Preview
  const [testText, setTestText] = useState<string>("");
  const [isTestingAudio, setIsTestingAudio] = useState<boolean>(false);
  const [testError, setTestError] = useState<string | null>(null);
  const activeTestAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setProvider(initialProvider);
      setSelectedVoiceId(initialVoiceId);
      setLanguage(initialLanguage);
      setPlaybackSpeed(initialPlaybackSpeed);
      setGradioUrl(initialGradioUrl);
      setTestError(null);

      // Default sample test text based on sentence or language
      if (currentSentenceText && currentSentenceText.trim().length > 0) {
        setTestText(currentSentenceText);
      } else {
        if (initialLanguage === "de") {
          setTestText("Guten Tag! Dies ist eine Audio-Vorschau für das Shadowing-Training.");
        } else if (initialLanguage === "ar") {
          setTestText("مرحباً بك! هذه تجربة الصوت المختار لاستوديو الشادوينج.");
        } else {
          setTestText("Hello! This is a real-time audio test for shadowing practice.");
        }
      }
    } else {
      // Stop test audio on close
      if (activeTestAudioRef.current) {
        activeTestAudioRef.current.pause();
        activeTestAudioRef.current = null;
      }
      setIsTestingAudio(false);
    }
  }, [isOpen, initialProvider, initialVoiceId, initialLanguage, initialPlaybackSpeed, initialGradioUrl, currentSentenceText]);

  // Load server models and browser voices
  useEffect(() => {
    if (!isOpen) return;

    // 1. Fetch Piper Catalog & Installed Models from server
    setIsLoadingModels(true);
    Promise.all([
      fetch("/api/tts/models").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/tts/catalog").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([installedRes, catalogRes]) => {
        const installedList: any[] = Array.isArray(installedRes)
          ? installedRes
          : installedRes?.models || [];
        const catalogList: any[] = Array.isArray(catalogRes)
          ? catalogRes
          : catalogRes?.models || catalogRes?.catalog || [];

        const mergedMap = new Map<string, PiperVoiceModelItem>();

        // Seed with built-in models
        BUILTIN_PIPER_MODELS.forEach((m) => mergedMap.set(m.id, { ...m }));

        // Merge catalog models
        catalogList.forEach((cat: any) => {
          if (!cat.id) return;
          const cleanId = cat.id.replace(/\.onnx$/, "").trim();
          const existing = mergedMap.get(cleanId);
          mergedMap.set(cleanId, {
            id: cleanId,
            name: cat.name || existing?.name || cleanId,
            lang: cat.lang || existing?.lang || cleanId.split("_")[0] || "de",
            langName: cat.langName || existing?.langName || "Language",
            flag: cat.flag || existing?.flag || "🌐",
            gender: cat.gender || existing?.gender || "male",
            quality: cat.quality || existing?.quality || "Medium",
            sample: cat.sample || existing?.sample || "Sample audio text",
            isDownloaded: !!cat.isDownloaded,
          });
        });

        // Mark installed models
        installedList.forEach((inst: any) => {
          const instId = (inst.id || inst.name || "").replace(/\.onnx$/, "").trim();
          if (!instId) return;
          if (mergedMap.has(instId)) {
            const current = mergedMap.get(instId)!;
            mergedMap.set(instId, { ...current, isDownloaded: true });
          } else {
            mergedMap.set(instId, {
              id: instId,
              name: inst.name || instId,
              lang: inst.lang || instId.split("_")[0] || "de",
              langName: inst.langName || "Custom",
              flag: inst.flag || "🧠",
              quality: "Installed",
              sample: "نموذج مثبت محلياً",
              isDownloaded: true,
            });
          }
        });

        setServerModels(Array.from(mergedMap.values()));
      })
      .catch((err) => {
        console.warn("Failed to load server tts models, using built-ins:", err);
        setServerModels(BUILTIN_PIPER_MODELS);
      })
      .finally(() => {
        setIsLoadingModels(false);
      });

    // 2. Fetch Browser Voices (Web Speech API)
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const getVoices = () => {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          setBrowserVoices(v);
        }
      };
      getVoices();
      window.speechSynthesis.onvoiceschanged = getVoices;
    }
  }, [isOpen]);

  // Combined models for Piper
  const allPiperModels = useMemo(() => {
    return serverModels.length > 0 ? serverModels : BUILTIN_PIPER_MODELS;
  }, [serverModels]);

  // Filtered Piper Models based on search and language filter
  const filteredPiperModels = useMemo(() => {
    return allPiperModels.filter((m) => {
      // Language Filter
      if (langFilter !== "all" && m.lang !== langFilter && !m.id.startsWith(`${langFilter}_`)) {
        return false;
      }
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = m.id.toLowerCase().includes(q);
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesLang = m.langName.toLowerCase().includes(q);
        return matchesId || matchesName || matchesLang;
      }
      return true;
    });
  }, [allPiperModels, langFilter, searchQuery]);

  // Filtered Gradio / Edge voices
  const filteredGradioVoices = useMemo(() => {
    return EXTENDED_EDGE_VOICES.filter((v) => {
      if (langFilter !== "all" && v.lang !== langFilter && v.lang !== "all") {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return v.id.toLowerCase().includes(q) || v.name.toLowerCase().includes(q) || v.desc.toLowerCase().includes(q);
      }
      return true;
    });
  }, [langFilter, searchQuery]);

  // Filtered Web Speech API Voices
  const filteredBrowserVoices = useMemo(() => {
    return browserVoices.filter((v) => {
      if (langFilter !== "all") {
        const vLang = (v.lang || "").toLowerCase();
        if (!vLang.startsWith(langFilter)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q);
      }
      return true;
    });
  }, [browserVoices, langFilter, searchQuery]);

  // Handle Live Voice Test
  const handleTestVoiceAudio = async () => {
    if (!testText.trim()) return;

    if (isTestingAudio) {
      if (activeTestAudioRef.current) {
        activeTestAudioRef.current.pause();
        activeTestAudioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsTestingAudio(false);
      return;
    }

    setIsTestingAudio(true);
    setTestError(null);

    try {
      if (provider === "external") {
        // Gradio / Edge-TTS
        const cleanVoice = selectedVoiceId.replace(/^gradio[:_]/i, "").trim() || "ryan";
        const blob = await fetchGradioAudioBlob(testText, cleanVoice, language, gradioUrl, true);
        if (!blob) throw new Error("تعذر توليد الصوت من خادم Gradio الخارجي");

        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.playbackRate = playbackSpeed;
        activeTestAudioRef.current = audio;

        audio.onended = () => {
          setIsTestingAudio(false);
          activeTestAudioRef.current = null;
        };
        audio.onerror = () => {
          setIsTestingAudio(false);
          setTestError("فشل تشغيل الصوت من خادم Gradio");
          activeTestAudioRef.current = null;
        };

        await audio.play();
      } else if (provider === "piper") {
        // Local Piper Server
        const voiceParam = `&voice=${encodeURIComponent(selectedVoiceId)}`;
        const url = `/api/tts?text=${encodeURIComponent(testText)}&lang=${language}${voiceParam}&bypassCache=true&_t=${Date.now()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("فشل توليد الصوت من محرك Piper العصبي");

        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.playbackRate = playbackSpeed;
        activeTestAudioRef.current = audio;

        audio.onended = () => {
          setIsTestingAudio(false);
          activeTestAudioRef.current = null;
        };
        audio.onerror = () => {
          setIsTestingAudio(false);
          setTestError("تعذر تشغيل الصوت من ملف Piper العصبي");
          activeTestAudioRef.current = null;
        };

        await audio.play();
      } else if (provider === "webspeech") {
        // Web Speech API
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          throw new Error("متصفحك لا يدعم Web Speech API");
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(testText);
        utterance.rate = playbackSpeed;
        utterance.lang = language;

        const targetVoice = browserVoices.find((v) => v.name === selectedVoiceId || v.voiceURI === selectedVoiceId);
        if (targetVoice) {
          utterance.voice = targetVoice;
        }

        utterance.onend = () => setIsTestingAudio(false);
        utterance.onerror = () => {
          setIsTestingAudio(false);
          setTestError("حدث خطأ أثناء نطق المتصفح");
        };

        window.speechSynthesis.speak(utterance);
      } else {
        // Google Cloud TTS
        const url = `/api/tts?text=${encodeURIComponent(testText)}&lang=${language}&voice=google&bypassCache=true&_t=${Date.now()}`;
        const res = await fetch(url);
        if (!res.ok) {
          // Fallback to client speech
          speakClient(testText, language);
          setTimeout(() => setIsTestingAudio(false), 2000);
          return;
        }

        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.playbackRate = playbackSpeed;
        activeTestAudioRef.current = audio;

        audio.onended = () => {
          setIsTestingAudio(false);
          activeTestAudioRef.current = null;
        };
        audio.onerror = () => {
          speakClient(testText, language);
          setIsTestingAudio(false);
          activeTestAudioRef.current = null;
        };

        await audio.play();
      }
    } catch (err: any) {
      console.warn("Test voice error:", err);
      setTestError(err.message || "فشل تشغيل العينة الصوتية، يرجى المحاولة مرة أخرى.");
      setIsTestingAudio(false);
    }
  };

  // Handle Save & Apply
  const handleSave = () => {
    if (activeTestAudioRef.current) {
      activeTestAudioRef.current.pause();
      activeTestAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    onSaveSettings({
      provider,
      selectedVoiceId: selectedVoiceId.trim() || (provider === "google" ? "google" : "de_DE-thorsten-medium"),
      language,
      playbackSpeed,
      gradioUrl: gradioUrl.trim() || "https://media.smart-cards.online",
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl shadow-indigo-950/40 overflow-hidden">
        {/* ========================================================================= */}
        {/* MODAL HEADER */}
        {/* ========================================================================= */}
        <div className="p-5 sm:px-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                تخصيص وإعدادات الصوت والموديل
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                  استوديو الشادوينج
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                حدد محرك النطق، الموديل العصبي الدقيق، اسم الصوت، وسرعة الأداء لتجربة شادوينج مثالية
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* MODAL BODY (SCROLLABLE) */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* SECTION 1: MAIN PROVIDER SELECTION */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-2.5 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-400" />
              1. اختيار محرك ومزود الصوت الأساسي (TTS Engine):
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Piper Neural */}
              <button
                type="button"
                onClick={() => {
                  setProvider("piper");
                  if (selectedVoiceId === "google" || selectedVoiceId === "ryan" || selectedVoiceId.startsWith("gradio:")) {
                    setSelectedVoiceId(
                      language === "de"
                        ? "de_DE-thorsten-medium"
                        : language === "ar"
                        ? "ar_JO-kareem-medium"
                        : "en_US-lessac-medium"
                    );
                  }
                }}
                className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer relative overflow-hidden ${
                  provider === "piper"
                    ? "bg-indigo-950/50 border-indigo-500 text-white shadow-md shadow-indigo-950/50 ring-1 ring-indigo-500/50"
                    : "bg-slate-800/40 border-slate-700/80 text-slate-300 hover:bg-slate-800/80 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                      <Zap className="w-3.5 h-3.5" />
                    </div>
                    بايبر العصبي (Piper Neural)
                  </span>
                  {provider === "piper" && (
                    <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  نماذج عصبية محلية فائقة الدقة والسرعة (Thorsten, Lessac, Kareem) بدون اتصال خارجي.
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-semibold pt-1">
                  <span>الأعلى جودة وتطابقاً</span>
                </div>
              </button>

              {/* Gradio / Edge Server */}
              <button
                type="button"
                onClick={() => {
                  setProvider("external");
                  if (selectedVoiceId === "google" || selectedVoiceId.includes("-medium") || selectedVoiceId.includes("-high")) {
                    setSelectedVoiceId("ryan");
                  }
                }}
                className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer relative overflow-hidden ${
                  provider === "external"
                    ? "bg-purple-950/50 border-purple-500 text-white shadow-md shadow-purple-950/50 ring-1 ring-purple-500/50"
                    : "bg-slate-800/40 border-slate-700/80 text-slate-300 hover:bg-slate-800/80 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <Server className="w-3.5 h-3.5" />
                    </div>
                    خادم Gradio / Edge-TTS
                  </span>
                  {provider === "external" && (
                    <div className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  أصوات بشرية واقعية وشخصيات تفاعلية (Ryan, Serena, Katja, Conrad, Jenny, Hamed).
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-purple-400 font-semibold pt-1">
                  <span>شخصيات صوتية متعددة</span>
                </div>
              </button>

              {/* Google TTS & Web Speech */}
              <button
                type="button"
                onClick={() => {
                  setProvider("google");
                  setSelectedVoiceId("google");
                }}
                className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer relative overflow-hidden ${
                  provider === "google" || provider === "webspeech"
                    ? "bg-blue-950/50 border-blue-500 text-white shadow-md shadow-blue-950/50 ring-1 ring-blue-500/50"
                    : "bg-slate-800/40 border-slate-700/80 text-slate-300 hover:bg-slate-800/80 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                    جوجل وأصوات المتصفح
                  </span>
                  {(provider === "google" || provider === "webspeech") && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  محرك Google السحابي القياسي أو أصوات نظام التشغيل والمتصفح المباشرة.
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-blue-400 font-semibold pt-1">
                  <span>متوافق مع كافة الأجهزة</span>
                </div>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: EXACT MODEL & VOICE CUSTOMIZATION (THE CORE REQUEST) */}
          {/* ========================================================================= */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  2. تحديد الموديل العصبي واسم الصوت بدقة (Exact Model / Voice ID):
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  الموديل المختار حالياً:{" "}
                  <span className="font-mono font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-800/50">
                    {selectedVoiceId}
                  </span>
                </p>
              </div>

              {/* Language Filters and Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث عن موديل أو صوت..."
                    className="text-xs bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 pr-8 text-slate-200 placeholder-slate-500 focus:border-indigo-500 outline-none w-44"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2" />
                </div>

                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  {[
                    { id: "all", label: "الكل" },
                    { id: "de", label: "🇩🇪 ألماني" },
                    { id: "en", label: "🇺🇸 إنجليزي" },
                    { id: "ar", label: "🇯🇴 عربي" },
                    { id: "fr", label: "🇫🇷 فرنسي" },
                    { id: "es", label: "🇪🇸 إسباني" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLangFilter(tab.id)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        langFilter === tab.id
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* TAB A: PIPER MODELS LIST */}
            {provider === "piper" && (
              <div className="space-y-3">
                {isLoadingModels && (
                  <div className="flex items-center justify-center p-6 text-xs text-slate-400 gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    جارِ فحص وتحديث قائمة موديلات Piper العصبية من الخادم...
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {filteredPiperModels.map((m) => {
                    const isSelected = selectedVoiceId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedVoiceId(m.id)}
                        className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                          isSelected
                            ? "bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500 text-white shadow-md shadow-indigo-950/30"
                            : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <span>{m.flag}</span>
                            <span className="truncate">{m.name}</span>
                          </span>
                          {isSelected ? (
                            <div className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {m.quality}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono w-full">
                          <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-indigo-300">
                            {m.id}
                          </span>
                          <span>{m.gender === "female" ? "👩 صوت أنثوي" : "👨 صوت ذكوري"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {filteredPiperModels.length === 0 && !isLoadingModels && (
                  <div className="text-center p-6 text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                    لم يتم العثور على موديلات تطابق فلتر البحث. يمكنك إدخال اسم الموديل المخصص بالأسفل.
                  </div>
                )}

                {/* Custom Piper Model Input */}
                <div className="pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setShowCustomModelInput(!showCustomModelInput)}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🎯 تخصيص متقدم: إدخال معرّف موديل Piper خاص (Custom Model ID)</span>
                  </button>

                  {showCustomModelInput && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <input
                        type="text"
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                        placeholder="مثال: de_DE-thorsten_emotional-medium أو ar_JO-kareem-medium"
                        className="flex-1 text-xs bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-indigo-500 outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customModelInput.trim()) {
                            setSelectedVoiceId(customModelInput.trim());
                            setCustomModelInput("");
                          }
                        }}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                      >
                        تطبيق الموديل
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB B: GRADIO / EDGE PERSONAS */}
            {provider === "external" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {filteredGradioVoices.map((v) => {
                    const isSelected = selectedVoiceId === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVoiceId(v.id)}
                        className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                          isSelected
                            ? "bg-purple-950/60 border-purple-500 ring-1 ring-purple-500 text-white shadow-md shadow-purple-950/30"
                            : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold flex items-center gap-1.5 truncate">
                            <Volume2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            {v.name}
                          </span>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </div>

                        <p className="text-[10px] text-slate-400 truncate">{v.desc}</p>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono w-full">
                          <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-purple-300">
                            {v.id}
                          </span>
                          <span>{v.gender === "female" ? "أنثى" : "ذكر"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Gradio Server URL & Custom Voice Name */}
                <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      اسم الصوت المخصص (Voice ID):
                    </label>
                    <input
                      type="text"
                      value={selectedVoiceId}
                      onChange={(e) => setSelectedVoiceId(e.target.value)}
                      placeholder="ryan, serena, KatjaNeural, etc."
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-purple-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      عنوان خادم Gradio (Server URL):
                    </label>
                    <input
                      type="text"
                      value={gradioUrl}
                      onChange={(e) => setGradioUrl(e.target.value)}
                      placeholder="https://media.smart-cards.online"
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-purple-500 outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB C: GOOGLE & WEB SPEECH VOICES */}
            {(provider === "google" || provider === "webspeech") && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Google Cloud Standard */}
                  <button
                    type="button"
                    onClick={() => {
                      setProvider("google");
                      setSelectedVoiceId("google");
                    }}
                    className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                      provider === "google"
                        ? "bg-blue-950/60 border-blue-500 ring-1 ring-blue-500 text-white"
                        : "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-400" />
                        Google Translate Neural TTS
                      </span>
                      {provider === "google" && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      محرك جوجل السحابي القياسي السريع المباشر.
                    </p>
                  </button>

                  {/* Web Speech API */}
                  <button
                    type="button"
                    onClick={() => {
                      setProvider("webspeech");
                      if (browserVoices.length > 0) {
                        const matching = browserVoices.find((v) => v.lang.startsWith(language));
                        setSelectedVoiceId(matching ? matching.name : browserVoices[0].name);
                      }
                    }}
                    className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                      provider === "webspeech"
                        ? "bg-blue-950/60 border-blue-500 ring-1 ring-blue-500 text-white"
                        : "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5 text-blue-400" />
                        أصوات نظام التشغيل والمتصفح (Web Speech)
                      </span>
                      {provider === "webspeech" && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      الأصوات المثبتة على جهازك (Windows, macOS, Android, iOS).
                    </p>
                  </button>
                </div>

                {provider === "webspeech" && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="text-[11px] font-bold text-slate-300 block">
                      اختر الصوت المثبت بنظامك بالضبط ({browserVoices.length} صوت متاح):
                    </label>
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {filteredBrowserVoices.map((v) => {
                        const isSelected = selectedVoiceId === v.name;
                        return (
                          <button
                            key={v.voiceURI || v.name}
                            type="button"
                            onClick={() => setSelectedVoiceId(v.name)}
                            className={`w-full p-2.5 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? "bg-blue-950/60 border-blue-500 text-white"
                                : "bg-slate-900/60 border-slate-800 hover:bg-slate-800 text-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Volume2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span className="text-xs font-bold truncate">{v.name}</span>
                              <span className="text-[10px] font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-400">
                                {v.lang}
                              </span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: SPEECH TUNING & PLAYBACK RATE */}
          {/* ========================================================================= */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Gauge className="w-4 h-4 text-emerald-400" />
              3. سرعة النطق واللغة الافتراضية للتدريب:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Playback Speed Slider & Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">سرعة تشغيل الصوت النموذجي:</span>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                    {playbackSpeed.toFixed(2)}x
                  </span>
                </div>

                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />

                <div className="flex items-center justify-between gap-1.5 pt-1">
                  {[
                    { val: 0.75, label: "0.75x (تعليمي بطيء)" },
                    { val: 0.9, label: "0.9x (مريح)" },
                    { val: 1.0, label: "1.0x (طبيعي)" },
                    { val: 1.15, label: "1.15x (متقدم)" },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setPlaybackSpeed(p.val)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex-1 text-center ${
                        Math.abs(playbackSpeed - p.val) < 0.01
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Training Language */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  لغة التدريب الافتراضية (Target Language):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "de", label: "🇩🇪 الألمانية" },
                    { id: "en", label: "🇺🇸 الإنجليزية" },
                    { id: "ar", label: "🇯🇴 العربية" },
                    { id: "fr", label: "🇫🇷 الفرنسية" },
                    { id: "es", label: "🇪🇸 الإسبانية" },
                    { id: "it", label: "🇮🇹 الإيطالية" },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        setLanguage(l.id);
                        if (provider === "piper") {
                          if (l.id === "de") setSelectedVoiceId("de_DE-thorsten-medium");
                          else if (l.id === "ar") setSelectedVoiceId("ar_JO-kareem-medium");
                          else if (l.id === "en") setSelectedVoiceId("en_US-lessac-medium");
                        }
                      }}
                      className={`p-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer text-center ${
                        language === l.id
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-xs"
                          : "bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 4: INSTANT LIVE PREVIEW & AUDIO TESTING */}
          {/* ========================================================================= */}
          <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-900/50 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-indigo-300 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-indigo-400" />
                تجربة واستماع مباشر للموديل المختار:
              </h3>
              <span className="text-[10px] text-slate-400">
                {isTestingAudio ? "جارِ تشغيل العينة الصوتية..." : "اضغط على الزر للاستماع الفوري"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="اكتب أي نص لاختبار الصوت هنا..."
                className="w-full sm:flex-1 text-xs bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-200 placeholder-slate-500 focus:border-indigo-500 outline-none"
              />

              <button
                type="button"
                onClick={handleTestVoiceAudio}
                disabled={!testText.trim()}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shrink-0 ${
                  isTestingAudio
                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50"
                    : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-950/50"
                }`}
              >
                {isTestingAudio ? (
                  <>
                    <Square className="w-4 h-4 fill-white" />
                    <span>إيقاف الصوت</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>استماع وتجربة هذا الموديل 🎧</span>
                  </>
                )}
              </button>
            </div>

            {testError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>{testError}</span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL FOOTER */}
        {/* ========================================================================= */}
        <div className="p-4 sm:px-6 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>
              المزود: <strong className="text-slate-200">{provider}</strong> | الصوت:{" "}
              <strong className="text-indigo-400 font-mono">{selectedVoiceId}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>حفظ وتطبيق الموديل</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

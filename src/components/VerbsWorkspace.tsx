import React, { useState, useEffect, useRef } from "react";
import { Menu, ArrowLeft, ChevronLeft, ChevronRight, Search, X, Loader2, Sparkles } from "lucide-react";

interface VerbForms {
  ich: string;
  du: string;
  er: string;
  wir: string;
  ihr: string;
  sie: string;
}

interface VerbPlainForms {
  ich: string;
  du: string;
  er: string;
  wir: string;
  ihr: string;
  sie: string;
}

interface VerbItem {
  title: string;
  speechBase: string;
  defaultFolder: string;
  forms: VerbForms;
  plainForms: VerbPlainForms;
}

const initialVerbDataStore: Record<string, VerbItem> = {
  "möchte": {
    title: "„möchte“",
    speechBase: "möchten",
    defaultFolder: "أفعال الكيفية (Modalverben)",
    forms: {
      ich: "möchte",
      du: 'möcht<span class="irregular-letter">e</span>st',
      er: 'möcht<span class="irregular-letter">e</span>',
      wir: "möchten",
      ihr: 'möcht<span class="irregular-letter">e</span>t',
      sie: "möchten"
    },
    plainForms: {
      ich: "ich möchte",
      du: "du möchtest",
      er: "er es sie möchte",
      wir: "wir möchten",
      ihr: "ihr möchtet",
      sie: "sie möchten"
    }
  },
  "essen": {
    title: "essen",
    speechBase: "essen",
    defaultFolder: "أفعال غير منتظمة",
    forms: {
      ich: "esse",
      du: '<span class="irregular-letter">i</span>sst',
      er: '<span class="irregular-letter">i</span>sst',
      wir: "essen",
      ihr: "esst",
      sie: "essen"
    },
    plainForms: {
      ich: "ich esse",
      du: "du isst",
      er: "er es sie isst",
      wir: "wir essen",
      ihr: "ihr esst",
      sie: "sie essen"
    }
  },
  "nehmen": {
    title: "nehmen",
    speechBase: "nehmen",
    defaultFolder: "أفعال غير منتظمة",
    forms: {
      ich: "nehme",
      du: 'n<span class="irregular-letter">imm</span>st',
      er: 'n<span class="irregular-letter">imm</span>t',
      wir: "nehmen",
      ihr: "nehmt",
      sie: "nehmen"
    },
    plainForms: {
      ich: "ich nehme",
      du: "du nimmst",
      er: "er es sie nimmt",
      wir: "wir nehmen",
      ihr: "ihr nehmt",
      sie: "sie nehmen"
    }
  },
  "mögen": {
    title: "mögen",
    speechBase: "mögen",
    defaultFolder: "أفعال الكيفية (Modalverben)",
    forms: {
      ich: '<span class="irregular-letter">mag</span>',
      du: '<span class="irregular-letter">magst</span>',
      er: '<span class="irregular-letter">mag</span>',
      wir: "mögen",
      ihr: "mögt",
      sie: "mögen"
    },
    plainForms: {
      ich: "ich mag",
      du: "du magst",
      er: "er es sie mag",
      wir: "wir mögen",
      ihr: "ihr mögt",
      sie: "sie mögen"
    }
  },
  "können": {
    title: "können",
    speechBase: "können",
    defaultFolder: "أفعال الكيفية (Modalverben)",
    forms: {
      ich: '<span class="irregular-letter">kann</span>',
      du: '<span class="irregular-letter">kannst</span>',
      er: '<span class="irregular-letter">kann</span>',
      wir: "können",
      ihr: "könnt",
      sie: "können"
    },
    plainForms: {
      ich: "ich kann",
      du: "du kannst",
      er: "er es sie kann",
      wir: "wir können",
      ihr: "ihr könnt",
      sie: "sie können"
    }
  },
  "wollen": {
    title: "wollen",
    speechBase: "wollen",
    defaultFolder: "أفعال الكيفية (Modalverben)",
    forms: {
      ich: '<span class="irregular-letter">will</span>',
      du: '<span class="irregular-letter">willst</span>',
      er: '<span class="irregular-letter">will</span>',
      wir: "wollen",
      ihr: "wollt",
      sie: "wollen"
    },
    plainForms: {
      ich: "ich will",
      du: "du willst",
      er: "er es sie will",
      wir: "wir wollen",
      ihr: "ihr wollt",
      sie: "sie wollen"
    }
  },
  "sprechen": {
    title: "sprechen",
    speechBase: "sprechen",
    defaultFolder: "أفعال غير منتظمة",
    forms: {
      ich: "spreche",
      du: 'spr<span class="irregular-letter">i</span>chst',
      er: 'spr<span class="irregular-letter">i</span>cht',
      wir: "sprechen",
      ihr: "sprecht",
      sie: "sprechen"
    },
    plainForms: {
      ich: "ich spreche",
      du: "du sprichst",
      er: "er es sie spricht",
      wir: "wir sprechen",
      ihr: "ihr sprecht",
      sie: "sie sprechen"
    }
  },
  "sehen": {
    title: "sehen",
    speechBase: "sehen",
    defaultFolder: "أفعال A1 / A2",
    forms: {
      ich: "sehe",
      du: 's<span class="irregular-letter">ie</span>hst',
      er: 's<span class="irregular-letter">ie</span>ht',
      wir: "sehen",
      ihr: "seht",
      sie: "sehen"
    },
    plainForms: {
      ich: "ich sehe",
      du: "du siehst",
      er: "er es sie sieht",
      wir: "wir sehen",
      ihr: "ihr seht",
      sie: "sie sehen"
    }
  },
  "haben": {
    title: "haben",
    speechBase: "haben",
    defaultFolder: "المفضلة",
    forms: {
      ich: "habe",
      du: '<span class="irregular-letter">hast</span>',
      er: '<span class="irregular-letter">hat</span>',
      wir: "haben",
      ihr: "habt",
      sie: "haben"
    },
    plainForms: {
      ich: "ich habe",
      du: "du hast",
      er: "er es sie hat",
      wir: "wir haben",
      ihr: "ihr habt",
      sie: "sie haben"
    }
  },
  "sein": {
    title: "sein",
    speechBase: "sein",
    defaultFolder: "المفضلة",
    forms: {
      ich: '<span class="irregular-letter">bin</span>',
      du: '<span class="irregular-letter">bist</span>',
      er: '<span class="irregular-letter">ist</span>',
      wir: '<span class="irregular-letter">sind</span>',
      ihr: '<span class="irregular-letter">seid</span>',
      sie: '<span class="irregular-letter">sind</span>'
    },
    plainForms: {
      ich: "ich bin",
      du: "du bist",
      er: "er es sie ist",
      wir: "wir sind",
      ihr: "ihr seid",
      sie: "sie sind"
    }
  }
};

// AI Models exactly matching the Corrector section (AICorrectorWorkspace.tsx)
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

// All voices supported across the website (Google Cloud TTS, Piper Neural Models, Gradio, WebSpeech)
export interface SiteVoiceOption {
  id: string;
  name: string;
  category: "google" | "piper" | "gradio" | "system";
  badge: string;
  description: string;
}

export const SITE_SUPPORTED_VOICES: SiteVoiceOption[] = [
  // Google TTS
  {
    id: "google",
    name: "Google Translate TTS (صوت جوجل الألماني القياسي السريع)",
    category: "google",
    badge: "جوجل السريع ⚡",
    description: "صوت ألماني نقي وفوري من خوادم جوجل السحابية دون تنزيل ملفات"
  },
  // Piper Neural TTS (German)
  {
    id: "de_DE-thorsten-medium",
    name: "Thorsten Medium 🇩🇪 (ألماني ذكوري - متزن وطبيعي)",
    category: "piper",
    badge: "Piper عصبي 🧠",
    description: "نموذج تورستن العصبي المتزن عالي الدقة"
  },
  {
    id: "de_DE-thorsten-high",
    name: "Thorsten High 🇩🇪 (ألماني ذكوري - فائق الدقة والوضوح)",
    category: "piper",
    badge: "فائق الدقة 💎",
    description: "أعلى دقة صوتية ألمانية مع مخارج حروف فائقة"
  },
  {
    id: "de_DE-thorsten_emotional-medium",
    name: "Thorsten Emotional 🇩🇪 (ألماني ذكوري - نبرة تفاعلية)",
    category: "piper",
    badge: "تفاعلي 🎭",
    description: "نبرة معبرة وحيوية للمحادثة والتفاعل"
  },
  {
    id: "de_DE-kerstin-low",
    name: "Kerstin Low 🇩🇪 (ألماني أنثوي - سريع ونقي)",
    category: "piper",
    badge: "أنثوي نقي 🌸",
    description: "صوت نسائي ألماني خفيف وسلس الاستماع"
  },
  {
    id: "de_DE-pavoque-low",
    name: "Pavoque Low 🇩🇪 (ألماني ذكوري - خفيف وسريع)",
    category: "piper",
    badge: "خفيف وسريع ⚡",
    description: "صوت ذكوري خفيف ومباشر لتمرينات النطق"
  },
  {
    id: "de_DE-ramona-low",
    name: "Ramona Low 🇩🇪 (ألماني أنثوي - ناعم)",
    category: "piper",
    badge: "أنثوي هادئ 🌙",
    description: "صوت نسائي ألماني هادئ ومريح"
  },
  {
    id: "de_DE-amany-medium",
    name: "Amany 🇩🇪 (ألماني أنثوي - عالي الوضوح)",
    category: "piper",
    badge: "عالي الوضوح 🌟",
    description: "صوت أماني النسائي المتزن والواضح"
  },
  // Gradio TTS
  {
    id: "gradio:ryan",
    name: "Gradio Ryan (سيرفر خارجي Qwen3-TTS)",
    category: "gradio",
    badge: "Gradio 🎙️",
    description: "صوت ذكوري طبيعي عبر خادم Gradio الخارجي"
  },
  {
    id: "gradio:serena",
    name: "Gradio Serena (سيرفر خارجي Qwen3-TTS)",
    category: "gradio",
    badge: "Gradio 🎙️",
    description: "صوت أنثوي عبر خادم Gradio الخارجي"
  }
];

interface VerbsWorkspaceProps {
  onToggleSidebar?: () => void;
  onBackToLibrary?: () => void;
}

function normalizeModalVerbForms(verbKey: string, forms: VerbForms): VerbForms {
  const normKey = verbKey.toLowerCase().replace(/[„“"']/g, "").trim();
  const res = { ...forms };
  if (normKey === "mögen") {
    res.ich = '<span class="irregular-letter">mag</span>';
    res.du = '<span class="irregular-letter">magst</span>';
    res.er = '<span class="irregular-letter">mag</span>';
  } else if (normKey === "können") {
    res.ich = '<span class="irregular-letter">kann</span>';
    res.du = '<span class="irregular-letter">kannst</span>';
    res.er = '<span class="irregular-letter">kann</span>';
  } else if (normKey === "haben") {
    res.ich = 'habe';
    res.du = '<span class="irregular-letter">hast</span>';
    res.er = '<span class="irregular-letter">hat</span>';
    res.wir = 'haben';
    res.ihr = 'habt';
    res.sie = 'haben';
  }
  return res;
}

function getEffectiveGeminiApiKey(): string {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("settings_gemini_api_key") ||
    localStorage.getItem("gemini_api_key") ||
    localStorage.getItem("custom_api_key") ||
    ""
  );
}

function getEffectiveGroqApiKey(): string {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("settings_groq_api_key") ||
    localStorage.getItem("groq_api_key") ||
    ""
  );
}

export function VerbsWorkspace({ onToggleSidebar, onBackToLibrary }: VerbsWorkspaceProps) {
  const [verbsStore, setVerbsStore] = useState<Record<string, VerbItem>>(() => {
    try {
      const saved = localStorage.getItem("german_verbs_custom_store");
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = { ...initialVerbDataStore, ...parsed };
        if (merged["mögen"]) {
          merged["mögen"].forms = normalizeModalVerbForms("mögen", merged["mögen"].forms);
        }
        if (merged["können"]) {
          merged["können"].forms = normalizeModalVerbForms("können", merged["können"].forms);
        }
        if (merged["haben"]) {
          merged["haben"].forms = normalizeModalVerbForms("haben", merged["haben"].forms);
        }
        return merged;
      }
    } catch (e) {}
    return initialVerbDataStore;
  });

  const [activeVerbKey, setActiveVerbKey] = useState<string>("möchte");
  const [searchVal, setSearchVal] = useState<string>("");
  const [isSearchingAi, setIsSearchingAi] = useState<boolean>(false);

  const sliderRef = useRef<HTMLElement>(null);

  const scrollSlider = (direction: "left" | "right") => {
    if (sliderRef.current) {
      const scrollAmount = direction === "left" ? -180 : 180;
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const quickSliderVerbs = Array.from(
    new Set([
      "möchte",
      "essen",
      "nehmen",
      "mögen",
      "können",
      "wollen",
      "haben",
      "sein",
      "sprechen",
      "sehen",
      ...Object.keys(verbsStore)
    ])
  );

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [drawerLevel, setDrawerLevel] = useState<1 | 2>(1);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);

  // Settings Modal state
  const [showSettingsDialog, setShowSettingsDialog] = useState<boolean>(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>(() => {
    return localStorage.getItem("german_verbs_voice_uri") || "google";
  });
  const [selectedAiModel, setSelectedAiModel] = useState<string>(() => {
    return localStorage.getItem("german_verbs_ai_model") || "gemini-3.6-flash";
  });
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return getEffectiveGeminiApiKey();
  });
  const [isTestingAi, setIsTestingAi] = useState<boolean>(false);
  const [aiTestFeedback, setAiTestFeedback] = useState<{ success: boolean; msg: string } | null>(null);
  const [isPlayingTestVoice, setIsPlayingTestVoice] = useState<boolean>(false);
  const currentAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // Folders & Saved state
  const [folders, setFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("german_verbs_folders");
      return saved ? JSON.parse(saved) : ["المفضلة", "أفعال غير منتظمة", "أفعال A1 / A2", "أفعال الكيفية (Modalverben)"];
    } catch {
      return ["المفضلة", "أفعال غير منتظمة", "أفعال A1 / A2", "أفعال الكيفية (Modalverben)"];
    }
  });

  const [savedVerbs, setSavedVerbs] = useState<Array<{ key: string; folder: string }>>(() => {
    try {
      const saved = localStorage.getItem("german_verbs_saved");
      return saved
        ? JSON.parse(saved)
        : [
            { key: "möchte", folder: "أفعال الكيفية (Modalverben)" },
            { key: "essen", folder: "أفعال غير منتظمة" },
            { key: "können", folder: "أفعال الكيفية (Modalverben)" },
            { key: "haben", folder: "المفضلة" }
          ];
    } catch {
      return [
        { key: "möchte", folder: "أفعال الكيفية (Modalverben)" },
        { key: "essen", folder: "أفعال غير منتظمة" },
        { key: "können", folder: "أفعال الكيفية (Modalverben)" },
        { key: "haben", folder: "المفضلة" }
      ];
    }
  });

  // Populate German voices from browser
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("de"));
        setAvailableVoices(voices);
      }
    };
    loadVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const currentVerbData = verbsStore[activeVerbKey] || verbsStore["möchte"] || initialVerbDataStore["möchte"];

  // Voice playback with full support for Google Cloud TTS, Piper Neural Models, and Web Speech API
  const fallbackWebSpeech = (text: string, voiceUri?: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "de-DE";
      utterance.rate = 0.9;
      if (voiceUri && !voiceUri.startsWith("de_DE-") && voiceUri !== "google" && !voiceUri.startsWith("gradio:")) {
        const found = window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceUri);
        if (found) utterance.voice = found;
      }
      utterance.onend = () => setIsPlayingTestVoice(false);
      utterance.onerror = () => setIsPlayingTestVoice(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const pronounceText = async (text: string) => {
    if (!text || !text.trim()) return;

    // Stop any active audio
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch (e) {}
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const voiceVal = selectedVoiceUri || "google";
    const isServerVoice = voiceVal === "google" || voiceVal.startsWith("de_DE-") || voiceVal.startsWith("gradio:");

    if (isServerVoice) {
      try {
        setIsPlayingTestVoice(true);
        const ttsUrl = `/api/tts?text=${encodeURIComponent(text.trim())}&lang=de&voice=${encodeURIComponent(voiceVal)}`;
        const audio = new Audio(ttsUrl);
        currentAudioRef.current = audio;
        audio.playbackRate = 0.95;

        audio.onended = () => setIsPlayingTestVoice(false);
        audio.onerror = () => {
          setIsPlayingTestVoice(false);
          fallbackWebSpeech(text, voiceVal);
        };

        await audio.play();
        return;
      } catch (audioErr) {
        console.warn("[Verbs Audio] Server audio stream failed, falling back to WebSpeech:", audioErr);
        setIsPlayingTestVoice(false);
        fallbackWebSpeech(text, voiceVal);
        return;
      }
    }

    // Otherwise, use client-side Web Speech API
    fallbackWebSpeech(text, voiceVal);
  };

  // Search & AI Conjugation
  const executeSearch = async () => {
    const val = searchVal.trim();
    if (!val) return;

    const norm = val.toLowerCase().replace(/[„“"']/g, "").trim();

    // If available in store, display immediately
    if (verbsStore[norm]) {
      setActiveVerbKey(norm);
      setSearchVal("");
      return;
    }

    const activeGeminiKey = (customApiKey && customApiKey.trim()) || getEffectiveGeminiApiKey();
    const activeGroqKey = getEffectiveGroqApiKey();

    // Call AI to conjugate verb with exact irregular letter highlights
    setIsSearchingAi(true);
    try {
      const res = await fetch("/api/verbs/conjugate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(activeGeminiKey ? { "x-gemini-key": activeGeminiKey } : {}),
          ...(activeGeminiKey ? { "Authorization": `Bearer ${activeGeminiKey}` } : {})
        },
        body: JSON.stringify({
          verb: val,
          selectedModel: selectedAiModel,
          customApiKey: activeGeminiKey || undefined,
          userApiKey: activeGeminiKey || undefined,
          apiKey: activeGeminiKey || undefined,
          groqApiKey: activeGroqKey || undefined
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "فشل تصريف الفعل");
      }

      const data = await res.json();
      const newVerb: VerbItem = data.verbData;
      const key = (data.verbData.key || val).toLowerCase().replace(/[„“"']/g, "").trim();
      if (newVerb && newVerb.forms) {
        newVerb.forms = normalizeModalVerbForms(key, newVerb.forms);
      }

      setVerbsStore((prev) => {
        const updated = { ...prev, [key]: newVerb };
        try {
          localStorage.setItem("german_verbs_custom_store", JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      setActiveVerbKey(key);
      setSearchVal("");
    } catch (e: any) {
      alert("خطأ: " + (e.message || "فشل تصريف الفعل بالذكاء الاصطناعي"));
    } finally {
      setIsSearchingAi(false);
    }
  };

  // Test AI Connection
  const handleTestAi = async () => {
    const activeGeminiKey = (customApiKey && customApiKey.trim()) || getEffectiveGeminiApiKey();
    const activeGroqKey = getEffectiveGroqApiKey();
    setIsTestingAi(true);
    setAiTestFeedback(null);
    try {
      const res = await fetch("/api/verbs/test-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(activeGeminiKey ? { "x-gemini-key": activeGeminiKey } : {}),
          ...(activeGeminiKey ? { "Authorization": `Bearer ${activeGeminiKey}` } : {})
        },
        body: JSON.stringify({
          selectedModel: selectedAiModel,
          customApiKey: activeGeminiKey || undefined,
          userApiKey: activeGeminiKey || undefined,
          apiKey: activeGeminiKey || undefined,
          groqApiKey: activeGroqKey || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiTestFeedback({ success: true, msg: "✓ " + data.message });
    } catch (err: any) {
      setAiTestFeedback({ success: false, msg: "خطأ: " + err.message });
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem("german_verbs_voice_uri", selectedVoiceUri);
    localStorage.setItem("german_verbs_ai_model", selectedAiModel);
    if (customApiKey && customApiKey.trim()) {
      localStorage.setItem("gemini_api_key", customApiKey.trim());
      localStorage.setItem("settings_gemini_api_key", customApiKey.trim());
    }
    setShowSettingsDialog(false);
  };

  // Drawer navigation
  const openDrawer = () => {
    setDrawerLevel(1);
    setCurrentFolder(null);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
  };

  const setDrawerView = (level: 1 | 2, folderName: string | null = null) => {
    setDrawerLevel(level);
    setCurrentFolder(folderName);
  };

  const handleAddFolder = () => {
    const folderName = prompt("اسم المجلد الجديد (مثال: أفعال B1، تصريفات القواعد):");
    if (folderName && folderName.trim()) {
      const clean = folderName.trim();
      if (!folders.includes(clean)) {
        const updated = [...folders, clean];
        setFolders(updated);
        try {
          localStorage.setItem("german_verbs_folders", JSON.stringify(updated));
        } catch (e) {}
      }
      setDrawerView(2, clean);
    }
  };

  const handleToggleCurrentVerbInFolder = () => {
    if (!currentFolder) return;
    const exists = savedVerbs.some((v) => v.key === activeVerbKey && v.folder === currentFolder);
    let updated: Array<{ key: string; folder: string }>;
    if (!exists) {
      updated = [...savedVerbs, { key: activeVerbKey, folder: currentFolder }];
    } else {
      updated = savedVerbs.filter((v) => !(v.key === activeVerbKey && v.folder === currentFolder));
    }
    setSavedVerbs(updated);
    try {
      localStorage.setItem("german_verbs_saved", JSON.stringify(updated));
    } catch (e) {}
  };

  const handleRemoveVerbFromFolder = (verbKey: string, folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedVerbs.filter((v) => !(v.key === verbKey && v.folder === folderName));
    setSavedVerbs(updated);
    try {
      localStorage.setItem("german_verbs_saved", JSON.stringify(updated));
    } catch (e) {}
  };

  const isCurrentInFolder = currentFolder
    ? savedVerbs.some((v) => v.key === activeVerbKey && v.folder === currentFolder)
    : false;

  const verbsInCurrentFolder = currentFolder
    ? savedVerbs.filter((v) => v.folder === currentFolder)
    : [];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] text-[#1a1a1a] overflow-y-auto font-sans select-none antialiased relative" dir="ltr">
      {/* Exact Visual Fidelity Matching physical flashcards */}
      <style>{`
        .flashcard-box {
          border: 3.5px solid #FFC700;
          background-color: #FFFFFF;
          box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.08);
          position: relative;
        }
        
        .vertical-split {
          border-right: 2.5px solid #FFC700;
        }

        .horizontal-row-split {
          border-bottom: 1px solid #FEE48B;
        }

        .cell-pronoun {
          width: 44%;
          padding-left: 1.5rem;
          padding-right: 0.75rem;
        }

        .cell-conjugation {
          width: 56%;
          padding-left: 1.5rem;
          padding-right: 1.25rem;
        }

        .irregular-letter {
          color: #E84D58;
          font-weight: 500;
        }

        .verb-btn {
          transition: all 0.15s ease-in-out;
        }
        
        .flashcard-row {
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .flashcard-row:hover {
          background-color: #FFFDF0;
        }

        .flashcard-row:active {
          transform: scale(0.998);
        }

        .drawer-backdrop {
          transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .drawer-panel {
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .drawer-view-container {
          transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      {/* Top Application Bar with Navigation for applet integration */}
      {(onToggleSidebar || onBackToLibrary) && (
        <div className="w-full flex items-center justify-between px-4 py-2 border-b border-neutral-200/60 bg-white/70 backdrop-blur-xs shrink-0">
          <div className="flex items-center gap-2">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
                title="القائمة الجانبية"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}
            {onBackToLibrary && (
              <button
                onClick={onBackToLibrary}
                className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-neutral-900 px-2 py-1 rounded-lg hover:bg-neutral-100 transition cursor-pointer"
                title="العودة للمكتبة"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>المكتبة</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* BEGIN: MainContent (100% faithful to the exact design template) */}
      <div className="flex-1 flex flex-col justify-start items-center py-6 px-4">
        <main className="w-full max-w-xl flex flex-col items-center gap-5" data-purpose="app-container">
          
          {/* Top Bar with Saved Folders Capsule Button and Settings Button */}
          <div className="w-full flex justify-end items-center gap-2" dir="rtl">
            <button
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-amber-300 text-neutral-800 text-xs font-semibold shadow-xs hover:bg-[#FFE788] hover:border-[#FFC700] transition active:scale-95 cursor-pointer"
              onClick={() => setShowSettingsDialog(true)}
              title="الإعدادات"
              type="button"
            >
              <span className="material-symbols-outlined text-[17px] text-amber-500">settings</span>
              <span className="font-medium">الإعدادات</span>
            </button>
            <button
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-amber-300 text-neutral-800 text-xs font-semibold shadow-xs hover:bg-[#FFE788] hover:border-[#FFC700] transition active:scale-95 cursor-pointer"
              onClick={openDrawer}
              title="مجلداتي"
              type="button"
            >
              <span className="material-symbols-outlined text-[17px] text-amber-500">folder_open</span>
              <span className="font-medium">مجلداتي</span>
              <span className="mr-0.5 px-1.5 py-0.2 bg-[#FFC700] text-black text-[11px] font-bold rounded-full min-w-[18px] text-center">
                {savedVerbs.length}
              </span>
            </button>
          </div>

          {/* Minimal Clean Header */}
          <header className="w-full flex flex-col items-center gap-3 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Deutsche Verben</h1>
            
            {/* Harmonized, Readable & Elegant Verb Search Bar */}
            <div className="w-full max-w-[460px] flex flex-col gap-1.5 mt-1">
              <div className="relative flex items-center w-full bg-white rounded-2xl border-2 border-amber-300 focus-within:border-[#FFC700] focus-within:ring-4 focus-within:ring-amber-100 shadow-xs hover:shadow-md transition-all duration-200">
                {/* Search Icon */}
                <div className="absolute left-3.5 flex items-center pointer-events-none text-amber-500">
                  <Search className="w-5 h-5 stroke-[2.2]" />
                </div>

                {/* Input with prominent, clear typography */}
                <input
                  id="verb-search-input"
                  type="text"
                  autoComplete="off"
                  dir="auto"
                  value={searchVal}
                  disabled={isSearchingAi}
                  onChange={(e) => setSearchVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") executeSearch();
                  }}
                  placeholder="ابحث عن فعل (مثل sprechen أو يسافر)..."
                  className="w-full h-12 pl-11 pr-24 text-[15px] sm:text-base font-semibold text-neutral-900 placeholder:text-neutral-400 placeholder:font-normal bg-transparent rounded-2xl outline-hidden"
                />

                {/* Clear 'X' button if text exists */}
                {searchVal && !isSearchingAi && (
                  <button
                    type="button"
                    onClick={() => setSearchVal("")}
                    className="absolute right-20 p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition cursor-pointer"
                    title="مسح"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Action Search Button */}
                <button
                  id="btn-search-trigger"
                  type="button"
                  disabled={isSearchingAi || !searchVal.trim()}
                  onClick={executeSearch}
                  className="absolute right-1.5 h-9 px-4 bg-[#FFC700] hover:bg-[#F2BD00] active:scale-95 text-neutral-950 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearchingAi ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري...</span>
                    </>
                  ) : (
                    <span>بحث</span>
                  )}
                </button>
              </div>
            </div>
          </header>

          {/* BEGIN: FlashcardWidget */}
          {/* Authentic 1:1 Physical Textbook Card Replication */}
          <section aria-label="Konjugationskarte" className="w-full flex justify-center py-1">
            <div className="w-full max-w-[460px] flashcard-box flex flex-col" data-purpose="flashcard-container">
              {/* Header Bar: Solid Yellow Strip */}
              <div aria-hidden="true" className="w-full h-3.5 bg-[#FFC700]"></div>
              
              {/* Table Grid Container */}
              <div className="w-full flex flex-col bg-white">
                {/* Top Row: Blank Left Cell & Rounded Verb Pill in Right Cell */}
                <div className="flex items-center min-h-[58px] horizontal-row-split">
                  <div aria-hidden="true" className="cell-pronoun vertical-split h-full min-h-[58px]"></div>
                  <div className="cell-conjugation flex items-center py-2.5 justify-center">
                    {/* Rounded Pill Badge */}
                    <span className="inline-flex items-center justify-center px-6 py-1.5 rounded-full bg-[#FFE788] text-[#1a1a1a] text-xl font-medium tracking-tight shadow-none">
                      {currentVerbData.title}
                    </span>
                  </div>
                </div>

                {/* Conjugation Rows */}
                {/* Row 1: ich */}
                <div
                  className="flashcard-row flex items-center min-h-[50px] horizontal-row-split"
                  onClick={() => pronounceText(currentVerbData.plainForms.ich)}
                  title="اضغط للاستماع"
                >
                  <div className="cell-pronoun vertical-split py-2 text-[21px] font-normal tracking-wide text-[#1a1a1a]">
                    ich
                  </div>
                  <div
                    className="cell-conjugation py-2 text-[21px] font-normal tracking-wide text-[#1a1a1a] justify-center"
                    dangerouslySetInnerHTML={{ __html: currentVerbData.forms.ich }}
                  />
                </div>

                {/* Row 2: du */}
                <div
                  className="flashcard-row flex items-center min-h-[50px] horizontal-row-split"
                  onClick={() => pronounceText(currentVerbData.plainForms.du)}
                  title="اضغط للاستماع"
                >
                  <div className="cell-pronoun vertical-split py-2 text-[21px] font-normal tracking-wide text-[#1a1a1a]">
                    du
                  </div>
                  <div
                    className="cell-conjugation py-2 text-[21px] font-normal tracking-wide text-[#1a1a1a] justify-center"
                    dangerouslySetInnerHTML={{ __html: currentVerbData.forms.du }}
                  />
                </div>

                {/* Row 3: er / es / sie */}
                <div
                  className="flashcard-row flex items-center min-h-[50px] horizontal-row-split"
                  onClick={() => pronounceText(currentVerbData.plainForms.er)}
                  title="اضغط للاستماع"
                >
                  <div className="cell-pronoun vertical-split py-2 text-[21px] font-normal tracking-wide text-[#1a1a1a]">
                    er / es / sie
                  </div>
                  <div
                    className="cell-conjugation py-2 text-[21px] font-normal tracking-wide text-[#1a1a1a] justify-center"
                    dangerouslySetInnerHTML={{ __html: currentVerbData.forms.er }}
                  />
                </div>

                {/* Row 4: wir */}
                <div
                  className="flashcard-row flex items-center min-h-[50px] horizontal-row-split"
                  onClick={() => pronounceText(currentVerbData.plainForms.wir)}
                  title="اضغط للاستماع"
                >
                  <div className="cell-pronoun vertical-split py-2 text-[21px] font-normal tracking-wide text-[#1a1a1a]">
                    wir
                  </div>
                  <div
                    className="cell-conjugation py-2 text-[21px] font-normal tracking-wide text-[#1a1a1a] justify-center"
                    dangerouslySetInnerHTML={{ __html: currentVerbData.forms.wir }}
                  />
                </div>

                {/* Row 5: ihr */}
                <div
                  className="flashcard-row flex items-center min-h-[50px] horizontal-row-split"
                  onClick={() => pronounceText(currentVerbData.plainForms.ihr)}
                  title="اضغط للاستماع"
                >
                  <div className="cell-pronoun vertical-split py-2 text-[21px] font-normal tracking-wide text-[#1a1a1a]">
                    ihr
                  </div>
                  <div
                    className="cell-conjugation py-2 text-[21px] font-normal tracking-wide text-[#1a1a1a] justify-center"
                    dangerouslySetInnerHTML={{ __html: currentVerbData.forms.ihr }}
                  />
                </div>

                {/* Row 6: sie / Sie */}
                <div
                  className="flashcard-row flex items-center min-h-[50px]"
                  onClick={() => pronounceText(currentVerbData.plainForms.sie)}
                  title="اضغط للاستماع"
                >
                  <div className="cell-pronoun vertical-split py-2 text-[21px] font-normal tracking-wide text-[#1a1a1a]">
                    sie / Sie
                  </div>
                  <div
                    className="cell-conjugation py-2 text-[21px] font-normal tracking-wide text-[#1a1a1a]"
                    dangerouslySetInnerHTML={{ __html: currentVerbData.forms.sie }}
                  />
                </div>
              </div>
            </div>
          </section>
          {/* END: FlashcardWidget */}

          {/* Quick Verb Selection Slider (Moved Under the Table) */}
          <div className="relative w-full max-w-lg mx-auto flex items-center gap-1 pt-2 select-none">
            <button
              type="button"
              onClick={() => scrollSlider("left")}
              className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition shrink-0 cursor-pointer"
              title="السابق"
              aria-label="السابق"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <nav
              ref={sliderRef}
              aria-label="Schnellauswahl Verben"
              className="flex items-center gap-2 overflow-x-auto flex-nowrap py-1.5 px-0.5 w-full scroll-smooth"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {quickSliderVerbs.map((verb) => {
                const isActive = activeVerbKey === verb;
                const data = verbsStore[verb] || initialVerbDataStore[verb];
                return (
                  <button
                    key={verb}
                    className={`verb-btn shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold border cursor-pointer focus:outline-hidden transition-all duration-150 ${
                      isActive
                        ? "border-[#FFC700] bg-[#FFC700] text-black shadow-xs scale-105"
                        : "border-amber-300 bg-white text-neutral-800 shadow-xs hover:bg-[#FFE788]"
                    }`}
                    onClick={() => setActiveVerbKey(verb)}
                    type="button"
                  >
                    {data ? data.title : verb}
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => scrollSlider("right")}
              className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition shrink-0 cursor-pointer"
              title="التالي"
              aria-label="التالي"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </main>
      </div>
      {/* END: MainContent */}

      {/* BEGIN: Settings Modal */}
      {showSettingsDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 max-w-md w-full overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">settings</span>
                <h3 className="text-sm font-bold text-neutral-900">إعدادات القسم</h3>
              </div>
              <button
                onClick={() => setShowSettingsDialog(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition focus:outline-hidden cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4 text-right">
              {/* Voice Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-neutral-800">الصوت الناطق المعتمد</label>
                  {SITE_SUPPORTED_VOICES.find(v => v.id === selectedVoiceUri)?.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      {SITE_SUPPORTED_VOICES.find(v => v.id === selectedVoiceUri)?.badge}
                    </span>
                  )}
                </div>
                <select
                  value={selectedVoiceUri}
                  onChange={(e) => setSelectedVoiceUri(e.target.value)}
                  className="w-full text-xs rounded-xl border border-neutral-300 focus:border-[#FFC700] focus:ring-1 focus:ring-[#FFC700] py-2 px-3 bg-white outline-none font-sans"
                >
                  <optgroup label="🌐 محرك Google TTS (سريع ومستقر جداً)">
                    <option value="google">Google Translate TTS (صوت جوجل الألماني القياسي السريع)</option>
                  </optgroup>
                  
                  <optgroup label="🧠 أصوات Piper العصبية (عالية النقاء / Neural TTS)">
                    {SITE_SUPPORTED_VOICES.filter(v => v.category === "piper").map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </optgroup>

                  <optgroup label="🎙️ أصوات سيرفر Gradio الخارجي (Qwen3-TTS)">
                    {SITE_SUPPORTED_VOICES.filter(v => v.category === "gradio").map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </optgroup>

                  {availableVoices.length > 0 && (
                    <optgroup label="💻 أصوات المتصفح والنظام (Web Speech API)">
                      {availableVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {SITE_SUPPORTED_VOICES.find(v => v.id === selectedVoiceUri)?.description && (
                  <p className="text-[11px] text-neutral-500 mt-1">
                    {SITE_SUPPORTED_VOICES.find(v => v.id === selectedVoiceUri)?.description}
                  </p>
                )}

                <button
                  onClick={() => pronounceText("Guten Tag! Ich möchte Deutsch lernen und die Verben konjugieren.")}
                  disabled={isPlayingTestVoice}
                  className="mt-2 w-full py-1.5 px-3 bg-neutral-100 hover:bg-[#FFE788] text-neutral-800 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px] text-amber-600">
                    {isPlayingTestVoice ? "volume_up" : "play_circle"}
                  </span>
                  <span>{isPlayingTestVoice ? "جاري تشغيل الصوت..." : "تجربة الاستماع إلى الصوت"}</span>
                </button>
              </div>

              {/* AI Renewal & Model Selection (Exact match with Corrector) */}
              <div className="border-t border-neutral-100 pt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-neutral-800">نموذج الذكاء الاصطناعي لتصريف الأفعال</label>
                  {ALL_AVAILABLE_MODELS.find(m => m.key === selectedAiModel)?.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {ALL_AVAILABLE_MODELS.find(m => m.key === selectedAiModel)?.badge}
                    </span>
                  )}
                </div>

                <select
                  value={selectedAiModel}
                  onChange={(e) => setSelectedAiModel(e.target.value)}
                  className="w-full text-xs font-sans rounded-xl border border-neutral-300 focus:border-[#FFC700] focus:ring-1 focus:ring-[#FFC700] py-2 px-3 bg-white outline-none"
                >
                  <optgroup label="⚡ نماذج السعة الفائقة (500 طلب يومياً)">
                    {ALL_AVAILABLE_MODELS.filter((m) => m.group === "high_quota").map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                  
                  <optgroup label="🌟 النماذج الأساسية والمتقدمة">
                    {ALL_AVAILABLE_MODELS.filter((m) => m.group !== "high_quota").map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                </select>

                {ALL_AVAILABLE_MODELS.find(m => m.key === selectedAiModel)?.desc && (
                  <p className="text-[11px] text-neutral-500 mt-1">
                    {ALL_AVAILABLE_MODELS.find(m => m.key === selectedAiModel)?.desc}
                  </p>
                )}
              </div>

              {/* Custom Key Input */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1.5">مفتاح Gemini API (اختياري)</label>
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value.trim())}
                  placeholder="AIzaSy... (اتركه فارغاً لاستخدام مفتاح السيرفر)"
                  className="w-full text-xs font-mono rounded-xl border border-neutral-300 focus:border-[#FFC700] focus:ring-1 focus:ring-[#FFC700] py-2 px-3 bg-white outline-none"
                />
                <button
                  onClick={handleTestAi}
                  disabled={isTestingAi}
                  className="mt-2 w-full py-1.5 px-3 bg-amber-100 hover:bg-[#FFC700] text-black text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-60"
                  type="button"
                >
                  {isTestingAi ? "جاري فحص الاتصال..." : "اختبار اتصال الذكاء الاصطناعي"}
                </button>
                {aiTestFeedback && (
                  <p
                    className={`text-[11px] mt-1.5 font-semibold ${
                      aiTestFeedback.success ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {aiTestFeedback.msg}
                  </p>
                )}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/70 flex justify-end">
              <button
                onClick={handleSaveSettings}
                className="px-4 py-1.5 bg-[#FFC700] hover:bg-[#F2BD00] text-black text-xs font-semibold rounded-full transition cursor-pointer"
                type="button"
              >
                حفظ وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}
      {/* END: Settings Modal */}

      {/* BEGIN: Sidebar Folders System (Minimal Two-Level Slide Navigation) */}
      <aside
        aria-labelledby="drawer-level-title"
        aria-modal="true"
        className={`fixed inset-0 z-50 transition-all ${isDrawerOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        id="saved-drawer-container"
        role="dialog"
      >
        {/* Backdrop */}
        <div
          className={`drawer-backdrop fixed inset-0 bg-neutral-900/30 backdrop-blur-xs transition-opacity duration-300 ${
            isDrawerOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeDrawer}
        />

        {/* Slide-in Panel from Right */}
        <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 pointer-events-none">
          <div
            className={`drawer-panel pointer-events-auto w-screen max-w-sm bg-white shadow-2xl flex flex-col border-l-2 border-[#FFC700] overflow-hidden transition-transform duration-350 ease-out ${
              isDrawerOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {/* Sliding Container for 2 Views (Level 1: Folders, Level 2: Verbs) */}
            <div
              className="drawer-view-container flex w-[200%] h-full transition-transform duration-300 ease-out"
              style={{
                transform: drawerLevel === 2 ? "translateX(-50%)" : "translateX(0%)"
              }}
            >
              {/* LEVEL 1 VIEW: Ordner-Übersicht */}
              <div className="w-1/2 h-full flex flex-col bg-white">
                {/* Minimal Header */}
                <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-neutral-900 tracking-tight" id="drawer-level-title">
                    المجلدات والأفعال
                  </h2>
                  <button
                    aria-label="إغلاق"
                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition focus:outline-hidden cursor-pointer"
                    onClick={closeDrawer}
                    title="إغلاق"
                    type="button"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                    </svg>
                  </button>
                </div>

                {/* Quick Action: Create New Folder */}
                <div className="px-5 py-3 border-b border-neutral-100/70 bg-neutral-50/50 flex items-center justify-between">
                  <span className="text-xs text-neutral-500 font-medium">
                    {folders.length} مجلدات
                  </span>
                  <button
                    className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-800 hover:text-black px-2.5 py-1 rounded-full bg-amber-100 hover:bg-[#FFE788] transition cursor-pointer"
                    onClick={handleAddFolder}
                    type="button"
                  >
                    <span>+ مجلد جديد</span>
                  </button>
                </div>

                {/* Folders List */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5" id="folders-list-container">
                  {folders.length === 0 ? (
                    <div className="py-12 text-center text-neutral-400 text-xs">
                      لا توجد مجلدات حالياً.
                    </div>
                  ) : (
                    folders.map((f) => {
                      const count = savedVerbs.filter((v) => v.folder === f).length;
                      return (
                        <div
                          key={f}
                          onClick={() => setDrawerView(2, f)}
                          className="folder-row flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 border border-neutral-100 hover:border-amber-200 cursor-pointer transition group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="material-symbols-outlined text-[20px] text-amber-500">folder</span>
                            <span className="text-sm font-semibold text-neutral-800 truncate">{f}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full font-medium">
                              {count} أفعال
                            </span>
                            <span className="material-symbols-outlined text-neutral-300 group-hover:text-neutral-600 text-lg transition">
                              chevron_right
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* LEVEL 2 VIEW: Verben im ausgewählten Ordner */}
              <div className="w-1/2 h-full flex flex-col bg-white">
                {/* Back Header */}
                <div className="px-4 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
                  <button
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition focus:outline-hidden cursor-pointer"
                    onClick={() => setDrawerView(1)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    <span>رجوع</span>
                  </button>
                  <span className="text-xs font-bold text-neutral-900 truncate max-w-[170px]" id="current-folder-heading">
                    {currentFolder || "اسم المجلد"}
                  </span>
                  <button
                    aria-label="إغلاق"
                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition focus:outline-hidden cursor-pointer"
                    onClick={closeDrawer}
                    title="إغلاق"
                    type="button"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                    </svg>
                  </button>
                </div>

                {/* Quick Action: Add currently viewed verb to this folder */}
                <div className="px-4 py-2.5 border-b border-neutral-100 bg-amber-50/50 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">
                    {verbsInCurrentFolder.length} أفعال
                  </span>
                  <button
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded transition cursor-pointer ${
                      isCurrentInFolder ? "text-neutral-500" : "text-amber-900 hover:text-black"
                    }`}
                    onClick={handleToggleCurrentVerbInFolder}
                    type="button"
                  >
                    {isCurrentInFolder ? (
                      <>
                        <span className="text-neutral-400">✓</span>
                        <span>„{currentVerbData.title}“ موجود بالفعل</span>
                      </>
                    ) : (
                      <>
                        <span className="text-amber-500 font-bold">+</span>
                        <span>حفظ الفعل الحالي هنا</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Folder Verbs List */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5" id="folder-verbs-list">
                  {verbsInCurrentFolder.length === 0 ? (
                    <div className="py-14 flex flex-col items-center justify-center text-center text-neutral-400">
                      <span className="material-symbols-outlined text-3xl text-neutral-300 mb-1">folder_open</span>
                      <p className="text-xs text-neutral-500 font-medium">هذا المجلد فارغ حالياً</p>
                      <p className="text-[11px] text-neutral-400 mt-1">اضغط على الزر أعلاه لإضافة الفعل الحالي.</p>
                    </div>
                  ) : (
                    verbsInCurrentFolder.map((item) => {
                      const data = verbsStore[item.key] || initialVerbDataStore[item.key];
                      const title = data ? data.title : item.key;
                      const isActive = item.key === activeVerbKey;

                      return (
                        <div
                          key={item.key}
                          className={`flex items-center justify-between p-2.5 rounded-lg border transition group ${
                            isActive
                              ? "bg-[#FFE788]/20 border-[#FFC700]"
                              : "bg-white border-neutral-100 hover:border-amber-200"
                          }`}
                        >
                          <button
                            type="button"
                            className="btn-select-verb flex-1 text-left flex items-center gap-2 min-w-0 focus:outline-hidden cursor-pointer"
                            onClick={() => setActiveVerbKey(item.key)}
                          >
                            <span className="text-sm font-semibold text-neutral-800 hover:text-amber-700 transition truncate">
                              {title}
                            </span>
                            {isActive && (
                              <span className="text-[10px] bg-[#FFE788] px-1.5 py-0.5 rounded font-bold text-neutral-900">
                                نشط
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn-remove-verb p-1 text-neutral-300 hover:text-red-500 rounded transition cursor-pointer"
                            onClick={(e) => currentFolder && handleRemoveVerbFromFolder(item.key, currentFolder, e)}
                            title="إزالة من المجلد"
                          >
                            <span className="material-symbols-outlined text-[17px]">close</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
      {/* END: Sidebar Folders System */}
    </div>
  );
}

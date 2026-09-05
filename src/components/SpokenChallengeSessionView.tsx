import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Bot,
  Play,
  Pause,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Mic,
  MicOff,
  Sliders,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Trophy,
  Award,
  Layers,
  BookOpen,
  RefreshCw,
  Loader2,
  Check,
  X,
  Zap,
  Image as ImageIcon
} from "lucide-react";
import { Flashcard, SpeakingChallengeItem, DEFAULT_GRADIO_VOICES } from "../types";
import { preloadImage, speakClient, stopActiveAudio, playPiperLocalWasm, fetchGradioAudioBlob } from "./Modals";
import { ALL_AVAILABLE_MODELS } from "./AICorrectorWorkspace";
import { motion, AnimatePresence } from "motion/react";

export const CHALLENGE_VOICE_OPTIONS = [
  {
    group: "🚀 أصوات سيرفر Gradio العصبية (Qwen3-TTS)",
    options: DEFAULT_GRADIO_VOICES.map((v) => ({
      id: `gradio:${v.id}`,
      name: `🚀 Gradio: ${v.name} (${v.gender === "female" ? "أنثوي" : "ذكوري"})`
    }))
  },
  {
    group: "⚡ محركات النطق المباشرة",
    options: [
      { id: "google", name: "⚡ Google Translate TTS (نطق ألماني مباشر وسريع)" },
      { id: "webspeech", name: "🌐 Web Speech API (محرك نطق المتصفح الداخلي)" }
    ]
  },
  {
    group: "🧠 نماذج Piper العصبية (ألمانية)",
    options: [
      { id: "de_DE-thorsten-medium", name: "🇩🇪 Thorsten Medium (ذكوري ألماني طبيعي - موصى به)" },
      { id: "de_DE-thorsten_emotional-medium", name: "🇩🇪 Thorsten Emotional (تعبيري متنوع)" },
      { id: "de_DE-ramona-medium", name: "🇩🇪 Ramona Medium (أنثوي ألماني واضح)" },
      { id: "de_DE-karlsson-low", name: "🇩🇪 Karlsson Low (ذكوري سريع)" }
    ]
  }
];

interface SpokenChallengeSessionViewProps {
  cards: Flashcard[];
  folderName: string;
  onClose: () => void;
  onFinish?: (score: number, total: number) => void;
}

export const SpokenChallengeSessionView: React.FC<SpokenChallengeSessionViewProps> = ({
  cards,
  folderName,
  onClose,
  onFinish
}) => {
  // Setup / Pre-Analysis State
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      return (
        localStorage.getItem("spoken_challenge_selected_model") ||
        localStorage.getItem("ai_corrector_selected_model") ||
        "gemini-3.6-flash"
      );
    } catch {
      return "gemini-3.6-flash";
    }
  });

  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    try {
      return (
        localStorage.getItem("spoken_challenge_voice") ||
        localStorage.getItem("settings_primary_piper_model_de") ||
        "de_DE-thorsten-medium"
      );
    } catch {
      return "de_DE-thorsten-medium";
    }
  });

  const [customConditions, setCustomConditions] = useState<string>(() => {
    try {
      return localStorage.getItem("spoken_challenge_custom_conditions") || "";
    } catch {
      return "";
    }
  });

  const [challengeCount, setChallengeCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("spoken_challenge_count");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {}
    return Math.min(Math.max(cards.length, 3), 10);
  });

  const [isPlayingVoiceSample, setIsPlayingVoiceSample] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Active Session State
  const [challenges, setChallenges] = useState<SpeakingChallengeItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(6);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isSessionCompleted, setIsSessionCompleted] = useState<boolean>(false);

  // Audio Playback State
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);
  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(true);

  // Audio Single-Controller Refs
  const audioTimeoutRef = useRef<any>(null);
  const spokenChallengesSetRef = useRef<Set<string>>(new Set());

  // Speech Recognition (Mic Check) State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [userSpokenText, setUserSpokenText] = useState<string>("");
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Scores and Stats
  const [completedItems, setCompletedItems] = useState<{
    id: number | string;
    isCorrect: boolean;
    userTranscript?: string;
    similarity?: number;
  }[]>([]);

  // Timer reference
  const timerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  const currentChallenge = challenges[currentIndex] || null;

  // Initialize Speech Recognition if supported
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "de-DE";

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setUserSpokenText(transcript);

        if (currentChallenge) {
          const score = calculateSimilarity(transcript, currentChallenge.target_german);
          setMatchScore(score);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setSpeechError("يرجى السماح بالوصول إلى الميكروفون للتحقق من النطق.");
        } else if (event.error !== "no-speech") {
          setSpeechError("تعذر التقاط الصوت، يمكنك المحاولة مرة أخرى.");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [currentChallenge]);

  // Clean String for fuzzy matching
  const cleanForMatch = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Simple word-level and Levenshtein similarity calculation
  const calculateSimilarity = (spoken: string, target: string): number => {
    const s = cleanForMatch(spoken);
    const t = cleanForMatch(target);

    if (!s || !t) return 0;
    if (s === t) return 100;

    const sWords = s.split(" ");
    const tWords = t.split(" ");

    let matchingWords = 0;
    for (const w of sWords) {
      if (tWords.includes(w)) matchingWords++;
    }

    const wordScore = (matchingWords / Math.max(tWords.length, 1)) * 100;
    return Math.min(Math.round(wordScore), 100);
  };

  // Start Generation via API
  const handleStartGeneration = async () => {
    if (cards.length === 0) return;

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationStep("جاري تحليل القواعد والمفردات في المجلد...");

    try {
      // Step 1: Request challenges from backend
      setGenerationStep("جاري صياغة التحديات باللغة العربية وتحديد أزمنة النطق...");

      try {
        localStorage.setItem("spoken_challenge_selected_model", selectedModel);
      } catch (e) {}

      let userApiKey = "";
      let groqApiKey = "";
      try {
        userApiKey =
          localStorage.getItem("gemini_api_key") ||
          localStorage.getItem("settings_gemini_api_key") ||
          "";
        groqApiKey =
          localStorage.getItem("groq_api_key") ||
          localStorage.getItem("settings_groq_api_key") ||
          "";
      } catch (e) {}

      const response = await fetch("/api/generate-spoken-challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards,
          deck_title: folderName || "مجلد البطاقات",
          requested_count: challengeCount,
          selectedModel,
          custom_instructions: customConditions.trim(),
          userApiKey,
          geminiApiKey: userApiKey,
          groqApiKey
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "فشل توليد التحديات الصوتية من المجلد.");
      }

      const data = await response.json();
      if (!data.challenges || !Array.isArray(data.challenges) || data.challenges.length === 0) {
        throw new Error("لم يتم استخراج تحديات من المجلد. يرجى التأكد من محتوى البطاقات.");
      }

      // Preload first few images
      data.challenges.forEach((ch: SpeakingChallengeItem) => {
        if (ch.imageUrl) preloadImage(ch.imageUrl).catch(() => {});
      });

      setChallenges(data.challenges);
      setCurrentIndex(0);
      setIsRevealed(false);
      setTimeLeft(data.challenges[0].estimated_seconds || 6);
      setIsTimerRunning(true);
      setCompletedItems([]);
      setIsSessionCompleted(false);
    } catch (err: any) {
      console.error("Spoken challenges error:", err);
      setGenerationError(err.message || "حدث خطأ أثناء التواصل مع الذكاء الاصطناعي.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Stop active audio helper across all engines
  const cancelAllAudio = useCallback(() => {
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
      audioTimeoutRef.current = null;
    }
    stopActiveAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    setIsPlayingAudio(false);
    setIsPlayingVoiceSample(false);
  }, []);

  // Pronounce German sentence with selected voice and audio collision prevention
  const speakGerman = useCallback((text: string) => {
    if (!text) return;
    cancelAllAudio();
    setIsPlayingAudio(true);

    try {
      speakClient(text, "de", selectedVoice);
      const estDuration = Math.max(2200, Math.min(6500, text.split(" ").length * 500));
      audioTimeoutRef.current = setTimeout(() => {
        setIsPlayingAudio(false);
      }, estDuration);
    } catch (e) {
      setIsPlayingAudio(false);
    }
  }, [selectedVoice, cancelAllAudio]);

  // Preview Voice Sample
  const handleToggleVoicePreview = () => {
    if (isPlayingVoiceSample) {
      cancelAllAudio();
      return;
    }
    cancelAllAudio();
    setIsPlayingVoiceSample(true);
    try {
      speakClient("Hallo, das ist eine Sprachprobe für diese Übung.", "de", selectedVoice);
      audioTimeoutRef.current = setTimeout(() => {
        setIsPlayingVoiceSample(false);
      }, 3000);
    } catch {
      setIsPlayingVoiceSample(false);
    }
  };

  // Handle Reveal German Sentence (Strict single audio trigger)
  const handleReveal = useCallback(() => {
    if (isRevealed) return;
    setIsRevealed(true);
    setIsTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (currentChallenge && autoPlayAudio) {
      const challengeKey = `${currentChallenge.id || currentIndex}_${currentChallenge.target_german}`;
      if (!spokenChallengesSetRef.current.has(challengeKey)) {
        spokenChallengesSetRef.current.add(challengeKey);
        if (audioTimeoutRef.current) {
          clearTimeout(audioTimeoutRef.current);
        }
        audioTimeoutRef.current = setTimeout(() => {
          speakGerman(currentChallenge.target_german);
        }, 300);
      }
    }
  }, [isRevealed, currentChallenge, currentIndex, autoPlayAudio, speakGerman]);

  // Countdown timer effect
  useEffect(() => {
    if (!currentChallenge || !isTimerRunning || isRevealed) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleReveal();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentChallenge, isTimerRunning, isRevealed, handleReveal]);

  // Reset challenge item when index changes
  useEffect(() => {
    if (challenges.length > 0 && challenges[currentIndex]) {
      cancelAllAudio();
      const ch = challenges[currentIndex];
      setIsRevealed(false);
      setTimeLeft(ch.estimated_seconds || 6);
      setIsTimerRunning(true);
      setUserSpokenText("");
      setMatchScore(null);
      setSpeechError(null);
      if (isListening && recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    }
  }, [currentIndex, challenges, cancelAllAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAllAudio();
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [cancelAllAudio]);

  // Toggle Mic Listener
  const handleToggleMic = () => {
    if (!recognitionRef.current) {
      setSpeechError("خاصية التعرف على الصوت غير مدعومة في هذا المتصفح.");
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    } else {
      setUserSpokenText("");
      setMatchScore(null);
      setSpeechError(null);
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn("Failed to start speech recognition", e);
      }
    }
  };

  // Rate answer and proceed
  const handleCompleteChallenge = (isCorrect: boolean) => {
    if (!currentChallenge) return;

    setCompletedItems((prev) => [
      ...prev.filter((it) => it.id !== currentChallenge.id),
      {
        id: currentChallenge.id,
        isCorrect,
        userTranscript: userSpokenText,
        similarity: matchScore || (isCorrect ? 100 : 0)
      }
    ]);

    if (currentIndex < challenges.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsSessionCompleted(true);
      const totalCorrect = completedItems.filter((i) => i.isCorrect).length + (isCorrect ? 1 : 0);
      if (onFinish) onFinish(totalCorrect, challenges.length);
    }
  };

  // Safe Exit helper (stops all audio immediately)
  const handleSafeClose = useCallback(() => {
    cancelAllAudio();
    onClose();
  }, [cancelAllAudio, onClose]);

  // Calculate circular progress SVG values
  const totalSeconds = currentChallenge?.estimated_seconds || 6;
  const timerPercentage = Math.max(0, Math.min(100, (timeLeft / totalSeconds) * 100));
  const strokeDashoffset = 100 - timerPercentage;

  // 1. SETUP & PRE-ANALYSIS SCREEN
  if (challenges.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto bg-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-right">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-inner">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                تحدي التحدث والنطق بالذكاء الاصطناعي
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Spoken Recall & Repetition Challenge
              </p>
            </div>
          </div>
          <button
            onClick={handleSafeClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Prominent Current Cards Counter Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-200 dark:border-purple-800/80 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-purple-500/25 shrink-0">
              {cards.length}
            </div>
            <div>
              <div className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>رصيد البطاقات الحالية في المجلد:</span>
                <span className="text-purple-600 dark:text-purple-400 font-extrabold text-base">
                  {cards.length} بطاقة
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                مجلد: <strong className="text-slate-700 dark:text-slate-200">{folderName || "المجلد الحالي"}</strong> — سيقوم الذكاء الاصطناعي باستخراج الكلمات والقواعد منها لتكوين التحديات.
              </p>
            </div>
          </div>
          {cards.length === 0 ? (
            <span className="text-xs text-rose-600 dark:text-rose-400 font-bold bg-rose-100 dark:bg-rose-950/60 px-3 py-1.5 rounded-xl shrink-0">
              المجلد فارغ
            </span>
          ) : (
            <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>جاهزة للتحليل ({cards.length})</span>
            </span>
          )}
        </div>

        {/* Configuration Controls */}
        <div className="space-y-5 mb-8">
          {/* AI Model Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              موديل الذكاء الاصطناعي للتحليل والتوليد:
            </label>
            <select
              value={selectedModel}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedModel(val);
                try {
                  localStorage.setItem("spoken_challenge_selected_model", val);
                  localStorage.setItem("ai_corrector_selected_model", val);
                } catch (err) {}
              }}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-xs"
            >
              <optgroup label="🔥 الموديلات ذات الطلبات الكثيرة (500 RPD)">
                {ALL_AVAILABLE_MODELS.filter((m) => m.group === "high_quota").map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="✨ النماذج العامة والمتقدمة">
                {ALL_AVAILABLE_MODELS.filter((m) => m.group !== "high_quota").map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* 2. Voice / Speaker Selector for Automatic Pronunciation */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-purple-600" />
                <span>الناطق ومحرك الصوت للنطق التلقائي:</span>
              </span>
              <button
                type="button"
                onClick={handleToggleVoicePreview}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                  isPlayingVoiceSample
                    ? "bg-purple-600 text-white border-purple-600 animate-pulse"
                    : "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100"
                }`}
                title="استمع إلى عينة صوتية بالصوت المحدد"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isPlayingVoiceSample ? "جاري الاستماع..." : "استمع لعينة الصوت"}</span>
              </button>
            </div>
            <select
              value={selectedVoice}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedVoice(val);
                try {
                  localStorage.setItem("spoken_challenge_voice", val);
                } catch (err) {}
              }}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-xs"
            >
              {CHALLENGE_VOICE_OPTIONS.map((grp) => (
                <optgroup key={grp.group} label={grp.group}>
                  {grp.options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
              💡 هذا هو الصوت الذي سينطق الجملة الألمانية تلقائياً أو عند الضغط على زر الاستماع.
            </span>
          </div>

          {/* 3. Custom Description / Conditions for the AI */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>شروط أو وصف مخصص للذكاء الاصطناعي (اختياري):</span>
              </span>
              {customConditions.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomConditions("");
                    try {
                      localStorage.removeItem("spoken_challenge_custom_conditions");
                    } catch {}
                  }}
                  className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                >
                  مسح الشروط
                </button>
              )}
            </div>
            <textarea
              rows={3}
              value={customConditions}
              onChange={(e) => {
                const val = e.target.value;
                setCustomConditions(val);
                try {
                  localStorage.setItem("spoken_challenge_custom_conditions", val);
                } catch {}
              }}
              placeholder="اكتب هنا أي شروط أو متطلبات خاصة ترغب أن يلتزم بها الذكاء الاصطناعي (مثال: ركز على صيغة الماضي التام Perfekt، أو اجعل الجمل عن حجز الفنادق والسفر، أو استخدم الروابط weil و dass...). إن تركت هذا المربع فارغاً، سيتصرف الذكاء الاصطناعي بطريقته الطبيعية المعتادة."
              className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              {customConditions.trim()
                ? "⚡ سيلتزم الذكاء الاصطناعي بشروطك المكتوبة أثناء صياغة الجمل والتحديات."
                : "💡 لم يتم إدخال شروط، سيقوم الذكاء الاصطناعي ببناء التحديات بالطريقة المعتادة وفقاً لمستوى البطاقات."}
            </p>
          </div>

          {/* 4. Number of Challenges (Allows > 25, up to 100) */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              <span>عدد التحديات والجمل المطلوبة:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-xs">أدخل العدد:</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={challengeCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 1;
                    const clamped = Math.max(1, Math.min(100, val));
                    setChallengeCount(clamped);
                    try {
                      localStorage.setItem("spoken_challenge_count", String(clamped));
                    } catch {}
                  }}
                  className="w-16 px-2 py-1 text-center font-black text-sm text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-xs text-slate-500 font-bold">جملة</span>
              </div>
            </div>

            {/* Quick selector chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[5, 10, 15, 20, 25, 30, 40, 50].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setChallengeCount(num);
                    try {
                      localStorage.setItem("spoken_challenge_count", String(num));
                    } catch {}
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    challengeCount === num
                      ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20 scale-105"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            <input
              type="range"
              min="1"
              max="50"
              value={Math.min(challengeCount, 50)}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setChallengeCount(val);
                try {
                  localStorage.setItem("spoken_challenge_count", String(val));
                } catch {}
              }}
              className="w-full accent-purple-600 cursor-pointer"
            />
            {challengeCount > 50 && (
              <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold block mt-1">
                ⭐ تم اختيار {challengeCount} جملة يدوياً عبر حقل الإدخال.
              </span>
            )}
          </div>
        </div>

        {/* Error Message */}
        {generationError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2 mb-6">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{generationError}</span>
          </div>
        )}

        {/* Action Button / Loading State */}
        {isGenerating ? (
          <div className="w-full py-6 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 rounded-2xl flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="w-7 h-7 text-purple-600 animate-spin" />
            <div className="text-sm font-black text-purple-900 dark:text-purple-200">
              {generationStep || "جاري التحليل والتوليد..."}
            </div>
            <p className="text-[11px] text-purple-600/80 dark:text-purple-400">
              يستغرق التحليل بضع ثوانٍ لإعداد الصور والأزمنة التقديرية بدقة.
            </p>
          </div>
        ) : (
          <button
            onClick={handleStartGeneration}
            disabled={cards.length === 0}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-base rounded-2xl shadow-lg shadow-purple-500/25 flex items-center justify-center gap-3 transition-all transform active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5" />
            <span>بدء التحليل وتحدي التحدث ({challengeCount} جمل)</span>
          </button>
        )}
      </div>
    );
  }

  // 3. SESSION COMPLETED SUMMARY SCREEN
  if (isSessionCompleted) {
    const totalCorrect = completedItems.filter((i) => i.isCorrect).length;
    const accuracy = Math.round((totalCorrect / challenges.length) * 100) || 0;

    return (
      <div className="w-full max-w-xl mx-auto bg-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl text-center text-slate-900 dark:text-white">
        <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-xl shadow-purple-500/30 animate-bounce">
          <Trophy className="w-10 h-10" />
        </div>

        <h2 className="text-2xl font-black mb-1">اكتمل التحدي بنجاح!</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          أحسنت! أنهيت جلسة التحدث والنطق التفاعلي لمجلد {folderName}
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6 text-right">
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 block mb-1">النتيجة الكلية</span>
            <span className="text-xl font-black text-purple-600 dark:text-purple-400">
              {totalCorrect} / {challenges.length}
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 block mb-1">نسبة الإتقان</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {accuracy}%
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 block mb-1">المستوى</span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {challenges[0]?.cefr_level || "A1"}
            </span>
          </div>
        </div>

        {/* Mastered Rules List */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-6 text-right border border-slate-100 dark:border-slate-800 max-h-48 overflow-y-auto">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
            القواعد والمفردات التي تم التدرب عليها:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set(challenges.map((c) => c.grammar_focus))).map((g, idx) => (
              <span
                key={idx}
                className="bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[11px] px-2.5 py-1 rounded-lg font-bold"
              >
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setCurrentIndex(0);
              setIsSessionCompleted(false);
              setCompletedItems([]);
              setIsRevealed(false);
              setTimeLeft(challenges[0]?.estimated_seconds || 6);
              setIsTimerRunning(true);
            }}
            className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة التحدي</span>
          </button>
          <button
            onClick={handleSafeClose}
            className="flex-1 py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>إنهاء والعودة</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. ACTIVE CHALLENGE INTERACTION VIEW
  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      {/* Top Floating Control Bar */}
      <div className="w-full flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 mb-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs px-2.5 py-1 rounded-full font-black">
            {currentIndex + 1} / {challenges.length}
          </span>
          {currentChallenge.cefr_level && (
            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs px-2.5 py-1 rounded-full font-black">
              {currentChallenge.cefr_level}
            </span>
          )}
          {currentChallenge.grammar_focus && (
            <span className="hidden sm:inline-block bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2.5 py-1 rounded-full font-semibold">
              {currentChallenge.grammar_focus}
            </span>
          )}
        </div>

        {/* Audio & Playback Controls */}
        <div className="flex items-center gap-2">
          {/* Voice Selector in active session */}
          <select
            value={selectedVoice}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedVoice(val);
              try {
                localStorage.setItem("spoken_challenge_voice", val);
              } catch (err) {}
            }}
            className="hidden md:inline-block bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2 py-1 rounded-lg font-bold border-none focus:outline-none cursor-pointer max-w-[150px] truncate"
            title="الناطق الصوتي المحدد"
          >
            {CHALLENGE_VOICE_OPTIONS.map((grp) => (
              <optgroup key={grp.group} label={grp.group}>
                {grp.options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={() => setAutoPlayAudio(!autoPlayAudio)}
            className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
              autoPlayAudio
                ? "bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
            }`}
            title="تشغيل الصوت تلقائياً عند الكشف"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">نطق تلقائي</span>
          </button>
          <select
            value={audioSpeed}
            onChange={(e) => setAudioSpeed(parseFloat(e.target.value))}
            className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2 py-1 rounded-lg font-bold border-none focus:outline-none cursor-pointer"
          >
            <option value="0.8">0.8x</option>
            <option value="1.0">1.0x</option>
            <option value="1.2">1.2x</option>
          </select>
          <button
            onClick={handleSafeClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Split Challenge Card - Sleek Repetition Mode Aesthetic */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl overflow-hidden min-h-[460px]">
        {/* Left/Top Panel: Expressive Illustration Context */}
        <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80 relative overflow-hidden group">
          {currentChallenge.imageUrl ? (
            <div className="w-full h-56 sm:h-72 rounded-xl overflow-hidden relative shadow-md">
              <img
                src={currentChallenge.imageUrl}
                alt={currentChallenge.image_prompt || "Challenge context"}
                className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 pointer-events-none" />
              {currentChallenge.vocab_focus && currentChallenge.vocab_focus.length > 0 && (
                <div className="absolute bottom-3 right-3 left-3 flex flex-wrap gap-1">
                  {currentChallenge.vocab_focus.map((v, i) => (
                    <span
                      key={i}
                      className="bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-56 sm:h-72 rounded-xl bg-slate-200 dark:bg-slate-700/50 flex flex-col items-center justify-center text-slate-400 gap-2">
              <ImageIcon className="w-10 h-10" />
              <span className="text-xs font-semibold">صورة توضيحية للسياق</span>
            </div>
          )}

          {/* Grammar Focus Pill under Image */}
          <div className="w-full mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span className="font-semibold">{currentChallenge.image_prompt}</span>
            <span className="font-bold text-purple-600 dark:text-purple-400">
              {currentChallenge.grammar_focus}
            </span>
          </div>
        </div>

        {/* Right/Bottom Panel: Arabic Prompt & Interactive Reveal/TTS & Mic Check */}
        <div className="flex flex-col justify-between p-2 sm:p-4 text-right">
          {/* Section 1: Arabic Directive */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold tracking-wider text-purple-600 dark:text-purple-400 uppercase">
                ما يجب قوله بالألمانية:
              </span>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                <span>الزمن المقدر: {currentChallenge.estimated_seconds} ثوانٍ</span>
              </div>
            </div>

            {/* Arabic Instruction in Large Bold Typography */}
            <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-2xl mb-5">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-relaxed">
                "{currentChallenge.arabic_prompt}"
              </h3>
            </div>

            {/* Countdown Timer or German Sentence Reveal */}
            {!isRevealed ? (
              <div className="flex flex-col items-center justify-center py-6 gap-4">
                {/* Circular Animated Countdown Timer */}
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    {/* Background Ring */}
                    <path
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="3"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    {/* Active Animated Ring */}
                    <path
                      className={`transition-all duration-1000 ${
                        timeLeft > 3
                          ? "text-purple-600"
                          : timeLeft > 1
                          ? "text-amber-500"
                          : "text-rose-500 animate-pulse"
                      }`}
                      strokeDasharray="100, 100"
                      strokeDashoffset={strokeDashoffset}
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-slate-900 dark:text-white">
                      {timeLeft}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">ثانية</span>
                  </div>
                </div>

                <button
                  onClick={handleReveal}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-black rounded-xl shadow-md shadow-purple-500/20 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>كشف الجملة الألمانية والتحقق</span>
                </button>
              </div>
            ) : (
              /* REVEALED GERMAN SENTENCE & AUDIO & MIC CHECK */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Target German Sentence Card */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl relative">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">
                    الجملة الألمانية المستهدفة:
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-purple-700 dark:text-purple-300 select-text">
                    {currentChallenge.target_german}
                  </div>

                  {/* Audio Replay Button */}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => speakGerman(currentChallenge.target_german)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isPlayingAudio
                          ? "bg-purple-600 text-white animate-pulse"
                          : "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200"
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>إعادة النطق</span>
                    </button>

                    {/* Mic Check Button */}
                    <button
                      onClick={handleToggleMic}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isListening
                          ? "bg-rose-600 text-white animate-pulse"
                          : "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200"
                      }`}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      <span>{isListening ? "جاري الاستماع... (اضغط للإيقاف)" : "تحقق من نطقك (ميكروفون)"}</span>
                    </button>
                  </div>
                </div>

                {/* Live Speech Recognition Results */}
                {userSpokenText && (
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs">
                    <span className="text-slate-500 dark:text-slate-400 block mb-1 font-semibold">
                      ما تم التقاطه من صوتك:
                    </span>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      "{userSpokenText}"
                    </p>
                    {matchScore !== null && (
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md font-black text-xs ${
                            matchScore >= 80
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : matchScore >= 50
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          }`}
                        >
                          تطابق: {matchScore}%
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {matchScore >= 80 ? "نطق ممتاز ومطابق!" : matchScore >= 50 ? "جيد جداً، حاول مجدداً لتحسين النطق" : "حاول التحدث بوضوح أكثر"}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {speechError && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300">
                    {speechError}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Section 2: Action Rating & Next Controls */}
          {isRevealed && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <button
                onClick={() => handleCompleteChallenge(false)}
                className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>أحتاج تكرارها</span>
              </button>
              <button
                onClick={() => handleCompleteChallenge(true)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>أتقنتها بنجاح!</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

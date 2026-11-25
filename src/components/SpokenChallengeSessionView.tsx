import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Volume2,
  VolumeX,
  RotateCcw,
  RefreshCw,
  Bot,
  Play,
  Square,
  AlertCircle,
  Mic,
  MicOff,
  Sliders,
  Trophy,
  Loader2,
  Check,
  X,
  Eye,
  Timer
} from "lucide-react";
import { Flashcard, SpeakingChallengeItem, DEFAULT_GRADIO_VOICES, isImageUrlBroken, markImageUrlBroken } from "../types";
import { preloadImage, speakClient, stopActiveAudio } from "./Modals";
import { ALL_AVAILABLE_MODELS } from "./AICorrectorWorkspace";
import { motion } from "motion/react";
import { ReviewChatModal } from "./ReviewChatModal";
import { UnifiedNavigationTrack } from "./UnifiedNavigationTrack";

export const CHALLENGE_VOICE_OPTIONS = [
  {
    group: "أصوات Gradio العصبية",
    options: DEFAULT_GRADIO_VOICES.map((v) => ({
      id: `gradio:${v.id}`,
      name: `${v.name} (${v.gender === "female" ? "أنثوي" : "ذكوري"})`
    }))
  },
  {
    group: "محركات النطق المباشرة",
    options: [
      { id: "google", name: "Google Translate TTS" },
      { id: "webspeech", name: "Web Speech (المتصفح)" }
    ]
  },
  {
    group: "نماذج Piper (ألمانية)",
    options: [
      { id: "de_DE-thorsten-medium", name: "Thorsten Medium (ذكوري)" },
      { id: "de_DE-thorsten_emotional-medium", name: "Thorsten Emotional" },
      { id: "de_DE-ramona-medium", name: "Ramona Medium (أنثوي)" },
      { id: "de_DE-karlsson-low", name: "Karlsson Low (سريع)" }
    ]
  }
];

interface SpokenChallengeSessionViewProps {
  cards: Flashcard[];
  folderName: string;
  onClose: () => void;
  onFinish?: (score: number, total: number) => void;
  onOpenChat?: (context: {
    currentChallenge: SpeakingChallengeItem;
    challenges: SpeakingChallengeItem[];
    currentIndex: number;
  }) => void;
  onUpdateContext?: (context: {
    currentChallenge: SpeakingChallengeItem | null;
    challenges: SpeakingChallengeItem[];
    currentIndex: number;
  }) => void;
}

export const SpokenChallengeSessionView: React.FC<SpokenChallengeSessionViewProps> = ({
  cards,
  folderName,
  onClose,
  onFinish,
  onOpenChat,
  onUpdateContext
}) => {
  // Setup state
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
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Active session state
  const [challenges, setChallenges] = useState<SpeakingChallengeItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(6);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  // Timing mode: "ai" (default AI seconds), "custom" (fixed user seconds), "manual" (no timer)
  const [timerMode, setTimerMode] = useState<"ai" | "custom" | "manual">(() => {
    try {
      const savedMode = localStorage.getItem("spoken_challenge_timer_mode");
      if (savedMode === "ai" || savedMode === "custom" || savedMode === "manual") {
        return savedMode;
      }
      const legacyCountdown = localStorage.getItem("spoken_challenge_use_countdown");
      return legacyCountdown === "false" ? "manual" : "ai";
    } catch {
      return "ai";
    }
  });
  const [lastTimedMode, setLastTimedMode] = useState<"ai" | "custom">(() => {
    try {
      const saved = localStorage.getItem("spoken_challenge_last_timed_mode");
      return saved === "custom" ? "custom" : "ai";
    } catch {
      return "ai";
    }
  });
  const [customSeconds, setCustomSeconds] = useState<number>(() => {
    try {
      const saved = parseInt(localStorage.getItem("spoken_challenge_custom_seconds") || "", 10);
      if (!isNaN(saved) && saved >= 1 && saved <= 120) return saved;
    } catch {}
    return 8;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const useCountdown = timerMode !== "manual";
  const [isSessionCompleted, setIsSessionCompleted] = useState<boolean>(false);

  // Audio playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("spoken_challenge_autoplay");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  const audioTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spokenChallengesSetRef = useRef<Set<string>>(new Set());

  // Speech recognition state
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  });
  const [isListening, setIsListening] = useState<boolean>(false);
  const [userSpokenText, setUserSpokenText] = useState<string>("");
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Completion results
  const [completedItems, setCompletedItems] = useState<{
    id: number | string;
    isCorrect: boolean;
    userTranscript?: string;
    similarity?: number;
  }[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const generationRunIdRef = useRef<number>(0);
  const fetchingIndicesRef = useRef<Set<number>>(new Set());
  const loadedImageIndicesRef = useRef<Set<number>>(new Set());
  const imageCandidatesRef = useRef<Map<number, string[]>>(new Map());
  const failedImageUrlsRef = useRef<Set<string>>(new Set());
  const challengesRef = useRef<SpeakingChallengeItem[]>(challenges);
  challengesRef.current = challenges;
  const allChallengesRef = useRef<SpeakingChallengeItem[]>([]);
  const [isInternalChatOpen, setIsInternalChatOpen] = useState(false);

  const currentChallenge = challenges[currentIndex] || null;
  const currentChallengeRef = useRef<SpeakingChallengeItem | null>(currentChallenge);
  currentChallengeRef.current = currentChallenge;

  // Find a matching existing card image from the deck as instant/reliable fallback
  const getDeckFallbackImageForChallenge = useCallback((item: SpeakingChallengeItem): string => {
    const targetLower = (item.target_german || "").toLowerCase();
    const vocabList = (item.vocab_focus || []).map((v) =>
      v.replace(/^(der|die|das)\s+/i, "").trim().toLowerCase()
    ).filter((v) => v.length >= 2);

    for (const card of cards) {
      const cardImg = card.frontImage || card.backImage || card.autoImageCandidates?.[0] || "";
      if (!cardImg || failedImageUrlsRef.current.has(cardImg) || isImageUrlBroken(cardImg)) continue;
      const cleanCardWord = (card.frontText || "")
        .replace(/^(der|die|das)\s+/i, "")
        .trim()
        .toLowerCase();
      if (cleanCardWord.length >= 2 && (targetLower.includes(cleanCardWord) || vocabList.includes(cleanCardWord))) {
        return cardImg;
      }
    }
    return "";
  }, [cards]);

  // Pre-fetch into Cache Storage / blob URL and decode offscreen so display is instant
  const warmImageForDisplay = useCallback(async (rawUrl: string): Promise<string> => {
    if (!rawUrl || !rawUrl.trim()) return "";
    let resolvedUrl = rawUrl.trim();
    try {
      const preloaded = await preloadImage(resolvedUrl);
      if (preloaded) resolvedUrl = preloaded;
    } catch {}

    const decodedOk = await new Promise<boolean>((resolve) => {
      if (!resolvedUrl) {
        resolve(false);
        return;
      }
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), 6000);
      img.onload = async () => {
        try {
          if (typeof img.decode === "function") {
            await img.decode().catch(() => {});
          }
        } catch {}
        finish(true);
      };
      img.onerror = () => finish(false);
      img.src = resolvedUrl;
    });

    return decodedOk ? resolvedUrl : "";
  }, []);

  const advanceChallengeImageCandidate = useCallback(async (index: number, brokenUrl?: string) => {
    const runId = generationRunIdRef.current;
    if (brokenUrl) {
      failedImageUrlsRef.current.add(brokenUrl);
      markImageUrlBroken(brokenUrl);
    }

    const candidates = imageCandidatesRef.current.get(index) || [];
    const fallbackItem = challengesRef.current[index];
    const pool = [...candidates];
    if (fallbackItem) {
      const deckFallback = getDeckFallbackImageForChallenge(fallbackItem);
      if (deckFallback && !pool.includes(deckFallback)) pool.push(deckFallback);
    }

    let nextReadyUrl = "";
    for (const candidate of pool) {
      if (runId !== generationRunIdRef.current) return;
      if (!candidate || failedImageUrlsRef.current.has(candidate) || isImageUrlBroken(candidate)) continue;
      const warmed = await warmImageForDisplay(candidate);
      if (warmed) {
        nextReadyUrl = warmed;
        break;
      }
      failedImageUrlsRef.current.add(candidate);
      markImageUrlBroken(candidate);
    }

    if (runId !== generationRunIdRef.current) return;
    setChallenges((prev) => {
      if (!prev[index]) return prev;
      if (prev[index].imageUrl === nextReadyUrl) return prev;
      const updated = [...prev];
      updated[index] = { ...updated[index], imageUrl: nextReadyUrl };
      return updated;
    });
  }, [getDeckFallbackImageForChallenge, warmImageForDisplay]);

  // Fetch + pre-decode image for a challenge index cleanly before assigning imageUrl
  const fetchChallengeImage = useCallback(async (
    index: number,
    overrideItem?: SpeakingChallengeItem,
    expectedRunId?: number
  ): Promise<string> => {
    const runId = expectedRunId ?? generationRunIdRef.current;
    const item = overrideItem || challengesRef.current[index];
    if (!item || item.imageUrl) return item?.imageUrl || "";
    if (loadedImageIndicesRef.current.has(index) || fetchingIndicesRef.current.has(index)) {
      return "";
    }

    fetchingIndicesRef.current.add(index);
    try {
      const q = (item.image_prompt || `${item.target_german}`).trim();
      const fallback = (item.vocab_focus?.[0] || item.target_german || "").trim();
      const res = await fetch(
        `/api/spoken-challenges/image?q=${encodeURIComponent(q)}&fallback=${encodeURIComponent(fallback)}`
      );

      if (runId !== generationRunIdRef.current) return "";

      let candidateList: string[] = [];
      if (res.ok) {
        const data = await res.json();
        candidateList = Array.isArray(data.candidateUrls) && data.candidateUrls.length > 0
          ? data.candidateUrls
          : (data.imageUrl ? [data.imageUrl] : []);

        if (candidateList.length > 0) {
          imageCandidatesRef.current.set(index, candidateList);
        }
      }

      const deckFallback = getDeckFallbackImageForChallenge(item);
      if (deckFallback && !candidateList.includes(deckFallback)) {
        candidateList.push(deckFallback);
      }

      let readyUrl = "";
      for (const candidate of candidateList.slice(0, 4)) {
        if (runId !== generationRunIdRef.current) return "";
        if (!candidate || failedImageUrlsRef.current.has(candidate) || isImageUrlBroken(candidate)) continue;
        const warmed = await warmImageForDisplay(candidate);
        if (warmed) {
          readyUrl = warmed;
          break;
        }
        failedImageUrlsRef.current.add(candidate);
        markImageUrlBroken(candidate);
      }

      if (runId !== generationRunIdRef.current) return "";

      if (readyUrl) {
        loadedImageIndicesRef.current.add(index);
        setChallenges((prev) => {
          if (!prev[index] || prev[index].imageUrl) return prev;
          const updated = [...prev];
          updated[index] = { ...updated[index], imageUrl: readyUrl };
          return updated;
        });
      }
      return readyUrl;
    } catch (e) {
      console.warn(`Failed lazy loading image for challenge ${index}:`, e);
      return "";
    } finally {
      fetchingIndicesRef.current.delete(index);
    }
  }, [getDeckFallbackImageForChallenge, warmImageForDisplay]);

  useEffect(() => {
    if (challenges.length === 0) return;
    const runId = generationRunIdRef.current;
    let cancelled = false;

    const loadSequential = async () => {
      await fetchChallengeImage(currentIndex, undefined, runId);
      if (cancelled || runId !== generationRunIdRef.current) return;
      if (currentIndex + 1 < challenges.length) {
        await fetchChallengeImage(currentIndex + 1, undefined, runId);
      }
      if (cancelled || runId !== generationRunIdRef.current) return;
      if (currentIndex + 2 < challenges.length) {
        await fetchChallengeImage(currentIndex + 2, undefined, runId);
      }
    };

    loadSequential();
    return () => {
      cancelled = true;
    };
  }, [currentIndex, challenges.length, fetchChallengeImage]);

  const cleanForMatch = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const calculateSimilarity = useCallback((spoken: string, target: string): number => {
    const s = cleanForMatch(spoken);
    const t = cleanForMatch(target);
    if (!s || !t) return 0;
    if (s === t) return 100;

    const sWords = s.split(" ").filter(Boolean);
    const tWords = t.split(" ").filter(Boolean);
    if (sWords.length === 0 || tWords.length === 0) return 0;

    // Bag-of-words multiset overlap for accurate F1 score
    const tCounts = new Map<string, number>();
    for (const w of tWords) {
      tCounts.set(w, (tCounts.get(w) || 0) + 1);
    }
    let matches = 0;
    for (const w of sWords) {
      const rem = tCounts.get(w) || 0;
      if (rem > 0) {
        matches++;
        tCounts.set(w, rem - 1);
      }
    }

    const f1Score = ((2 * matches) / (sWords.length + tWords.length)) * 100;
    return Math.min(Math.round(f1Score), 100);
  }, []);

  // Initialize Speech Recognition once (uses currentChallengeRef so lazy image updates never abort active mic)
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

        const activeCh = currentChallengeRef.current;
        if (activeCh) {
          const score = calculateSimilarity(transcript, activeCh.target_german);
          setMatchScore(score);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          setSpeechError("يرجى السماح بالوصول إلى الميكروفون.");
        } else if (event.error !== "no-speech" && event.error !== "aborted") {
          setSpeechError("تعذر التقاط الصوت، حاول مجدداً.");
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
        } catch {}
      }
    };
  }, [calculateSimilarity]);

  const onUpdateContextRef = useRef(onUpdateContext);
  onUpdateContextRef.current = onUpdateContext;

  // Keep parent context synced without triggering loops from unstable callback identities
  useEffect(() => {
    onUpdateContextRef.current?.({
      currentChallenge,
      challenges,
      currentIndex
    });
  }, [currentChallenge, challenges, currentIndex]);

  const handleOpenAiChat = () => {
    if (!currentChallenge) return;
    if (onOpenChat) {
      onOpenChat({
        currentChallenge,
        challenges,
        currentIndex
      });
    } else {
      setIsInternalChatOpen(true);
    }
  };

  const cancelAllAudio = useCallback(() => {
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
      audioTimeoutRef.current = null;
    }
    stopActiveAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsPlayingAudio(false);
    setIsPlayingVoiceSample(false);
  }, []);

  const speakGerman = useCallback((text: string) => {
    if (!text) return;
    cancelAllAudio();
    setIsPlayingAudio(true);

    try {
      speakClient(text, "de", selectedVoice);
      const estDuration = Math.max(2000, Math.min(6000, text.split(" ").length * 500));
      audioTimeoutRef.current = setTimeout(() => {
        setIsPlayingAudio(false);
      }, estDuration);
    } catch {
      setIsPlayingAudio(false);
    }
  }, [selectedVoice, cancelAllAudio]);

  const handleToggleVoicePreview = () => {
    if (isPlayingVoiceSample) {
      cancelAllAudio();
      return;
    }
    cancelAllAudio();
    setIsPlayingVoiceSample(true);
    try {
      speakClient("Hallo, das ist eine Sprachprobe.", "de", selectedVoice);
      audioTimeoutRef.current = setTimeout(() => {
        setIsPlayingVoiceSample(false);
      }, 2800);
    } catch {
      setIsPlayingVoiceSample(false);
    }
  };

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
        if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
        audioTimeoutRef.current = setTimeout(() => {
          speakGerman(currentChallenge.target_german);
        }, 250);
      }
    }
  }, [isRevealed, currentChallenge, currentIndex, autoPlayAudio, speakGerman]);

  const useCountdownRef = useRef(useCountdown);
  useCountdownRef.current = useCountdown;
  const timerModeRef = useRef(timerMode);
  timerModeRef.current = timerMode;
  const customSecondsRef = useRef(customSeconds);
  customSecondsRef.current = customSeconds;

  const getTargetSeconds = useCallback((
    ch: SpeakingChallengeItem | null,
    mode: "ai" | "custom" | "manual" = timerModeRef.current,
    custom: number = customSecondsRef.current
  ) => {
    if (mode === "custom") return Math.max(1, Math.min(120, custom || 8));
    return ch?.estimated_seconds || 6;
  }, []);

  const applyTimerMode = useCallback((nextMode: "ai" | "custom" | "manual", nextCustom?: number) => {
    const resolvedCustom = Math.max(1, Math.min(120, nextCustom ?? customSecondsRef.current));
    setTimerMode(nextMode);
    if (nextMode !== "manual") {
      setLastTimedMode(nextMode);
      try {
        localStorage.setItem("spoken_challenge_last_timed_mode", nextMode);
      } catch {}
    }
    if (nextCustom !== undefined) {
      setCustomSeconds(resolvedCustom);
      try {
        localStorage.setItem("spoken_challenge_custom_seconds", String(resolvedCustom));
      } catch {}
    }
    try {
      localStorage.setItem("spoken_challenge_timer_mode", nextMode);
      localStorage.setItem("spoken_challenge_use_countdown", String(nextMode !== "manual"));
    } catch {}

    if (currentChallenge && !isRevealed) {
      if (nextMode === "manual") {
        setIsTimerRunning(false);
      } else {
        setTimeLeft(getTargetSeconds(currentChallenge, nextMode, resolvedCustom));
        setIsTimerRunning(true);
      }
    }
  }, [currentChallenge, isRevealed, getTargetSeconds]);

  // Countdown effect (pauses automatically while user speaks or settings modal is open)
  useEffect(() => {
    if (!currentChallenge || !useCountdown || !isTimerRunning || isRevealed || isListening || isSettingsOpen) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentChallenge, useCountdown, isTimerRunning, isRevealed, isListening, isSettingsOpen]);

  // Trigger reveal cleanly once countdown reaches zero
  useEffect(() => {
    if (currentChallenge && useCountdown && isTimerRunning && !isRevealed && !isSettingsOpen && timeLeft === 0) {
      handleReveal();
    }
  }, [currentChallenge, useCountdown, isTimerRunning, isRevealed, isSettingsOpen, timeLeft, handleReveal]);

  const activeChallengeId = currentChallenge?.id ?? null;
  const activeChallengeTarget = currentChallenge?.target_german ?? "";
  const activeChallengeSeconds = currentChallenge?.estimated_seconds || 6;

  // Reset per card index / challenge identity (avoid resetting when imageUrl lazy-loads)
  useEffect(() => {
    if (challenges.length > 0 && activeChallengeTarget) {
      cancelAllAudio();
      setIsRevealed(false);
      setTimeLeft(
        timerModeRef.current === "custom"
          ? Math.max(1, Math.min(120, customSecondsRef.current || 8))
          : activeChallengeSeconds
      );
      setIsTimerRunning(useCountdownRef.current);
      setUserSpokenText("");
      setMatchScore(null);
      setSpeechError(null);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    }
  }, [currentIndex, challenges.length, activeChallengeId, activeChallengeTarget, activeChallengeSeconds, cancelAllAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAllAudio();
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [cancelAllAudio]);

  const handleStartGeneration = async () => {
    if (cards.length === 0) return;
    setIsGenerating(true);
    setGenerationError(null);

    try {
      try {
        localStorage.setItem("spoken_challenge_selected_model", selectedModel);
      } catch {}

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
      } catch {}

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
        throw new Error(errorData.error || "فشل توليد التحديات.");
      }

      const data = await response.json();
      if (!data.challenges || !Array.isArray(data.challenges) || data.challenges.length === 0) {
        throw new Error("لم يتم استخراج تحديات من المجلد.");
      }

      const runId = ++generationRunIdRef.current;
      fetchingIndicesRef.current.clear();
      loadedImageIndicesRef.current.clear();
      imageCandidatesRef.current.clear();
      spokenChallengesSetRef.current.clear();

      const generatedList: SpeakingChallengeItem[] = data.challenges;

      // Pre-prepare first challenge image before entering so Q1 appears with its image ready
      // and Q2 immediately starts pre-warming in background as soon as Q1 opens
      if (generatedList[0]) {
        const firstReadyUrl = await Promise.race([
          fetchChallengeImage(0, generatedList[0], runId),
          new Promise<string>((resolve) => setTimeout(() => resolve(""), 3000))
        ]);
        if (firstReadyUrl && runId === generationRunIdRef.current) {
          generatedList[0] = { ...generatedList[0], imageUrl: firstReadyUrl };
        }
      }

      if (runId !== generationRunIdRef.current) return;
      allChallengesRef.current = generatedList;
      setChallenges(generatedList);
      setCurrentIndex(0);
      setIsRevealed(false);
      setTimeLeft(getTargetSeconds(generatedList[0] || null));
      setIsTimerRunning(useCountdown);
      setCompletedItems([]);
      setIsSessionCompleted(false);
    } catch (err: any) {
      setGenerationError(err.message || "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleMic = () => {
    if (!recognitionRef.current) {
      setSpeechError("التعرف على الصوت غير مدعوم في هذا المتصفح.");
      return;
    }
    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
    } else {
      cancelAllAudio();
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

  const handleCompleteChallenge = (isCorrect: boolean) => {
    if (!currentChallenge) return;

    const updatedCompleted = [
      ...completedItems.filter((it) => it.id !== currentChallenge.id),
      {
        id: currentChallenge.id,
        isCorrect,
        userTranscript: userSpokenText,
        similarity: matchScore ?? (isCorrect ? 100 : 0)
      }
    ];
    setCompletedItems(updatedCompleted);

    if (currentIndex < challenges.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      cancelAllAudio();
      setIsSessionCompleted(true);
      const totalCorrect = updatedCompleted.filter((i) => i.isCorrect).length;
      if (onFinish) onFinish(totalCorrect, challenges.length);
    }
  };

  const handleRetryMistakes = useCallback(() => {
    const activeList = challengesRef.current;
    const mistakeList = activeList.filter((ch) => {
      const entry = completedItems.find((i) => i.id === ch.id);
      return entry ? !entry.isCorrect : true;
    });
    if (mistakeList.length === 0) return;

    // Preserve any loaded images back onto the master list
    const imgById = new Map(activeList.filter((c) => c.imageUrl).map((c) => [c.id, c.imageUrl]));
    allChallengesRef.current = allChallengesRef.current.map((c) =>
      !c.imageUrl && imgById.has(c.id) ? { ...c, imageUrl: imgById.get(c.id) } : c
    );

    generationRunIdRef.current++;
    cancelAllAudio();
    if (timerRef.current) clearInterval(timerRef.current);
    spokenChallengesSetRef.current.clear();
    fetchingIndicesRef.current.clear();
    loadedImageIndicesRef.current.clear();
    imageCandidatesRef.current.clear();

    setChallenges(mistakeList);
    setCurrentIndex(0);
    setIsSessionCompleted(false);
    setCompletedItems([]);
    setIsRevealed(false);
    setUserSpokenText("");
    setMatchScore(null);
    setSpeechError(null);
    setTimeLeft(getTargetSeconds(mistakeList[0] || null));
    setIsTimerRunning(useCountdown);
  }, [completedItems, cancelAllAudio, getTargetSeconds, useCountdown]);

  const handleRestartFullSession = useCallback(() => {
    const imgById = new Map(challengesRef.current.filter((c) => c.imageUrl).map((c) => [c.id, c.imageUrl]));
    const fullList = (allChallengesRef.current.length > 0 ? allChallengesRef.current : challengesRef.current).map((c) =>
      !c.imageUrl && imgById.has(c.id) ? { ...c, imageUrl: imgById.get(c.id) } : c
    );
    allChallengesRef.current = fullList;

    generationRunIdRef.current++;
    cancelAllAudio();
    if (timerRef.current) clearInterval(timerRef.current);
    spokenChallengesSetRef.current.clear();
    fetchingIndicesRef.current.clear();
    loadedImageIndicesRef.current.clear();
    imageCandidatesRef.current.clear();

    setChallenges(fullList);
    setCurrentIndex(0);
    setIsSessionCompleted(false);
    setCompletedItems([]);
    setIsRevealed(false);
    setUserSpokenText("");
    setMatchScore(null);
    setSpeechError(null);
    setTimeLeft(getTargetSeconds(fullList[0] || null));
    setIsTimerRunning(useCountdown);
  }, [cancelAllAudio, getTargetSeconds, useCountdown]);

  const handleReturnToSetup = useCallback(() => {
    generationRunIdRef.current++;
    cancelAllAudio();
    if (timerRef.current) clearInterval(timerRef.current);
    spokenChallengesSetRef.current.clear();
    fetchingIndicesRef.current.clear();
    loadedImageIndicesRef.current.clear();
    imageCandidatesRef.current.clear();
    allChallengesRef.current = [];
    setChallenges([]);
    setCurrentIndex(0);
    setIsRevealed(false);
    setCompletedItems([]);
    setIsSessionCompleted(false);
  }, [cancelAllAudio]);

  const handleSafeClose = useCallback(() => {
    cancelAllAudio();
    onClose();
  }, [cancelAllAudio, onClose]);

  const totalSeconds = getTargetSeconds(currentChallenge, timerMode, customSeconds);
  const timerRatio = totalSeconds > 0 ? Math.max(0, Math.min(1, timeLeft / totalSeconds)) : 0;

  // =========================================================================
  // 1. CLEAN SETUP SCREEN
  // =========================================================================
  if (challenges.length === 0) {
    const quickCounts = Array.from(new Set([5, 10, 15, 25].filter((n) => n < cards.length)));
    return (
      <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[26px] p-5 sm:p-6 shadow-sm text-right space-y-5" dir="rtl">
        <div className="space-y-1 border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            تحدي النطق
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {folderName || "المجلد الحالي"} · {cards.length} بطاقة
          </p>
        </div>

        {/* Count Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              عدد الجمل
            </label>
            <input
              type="number"
              min="1"
              max={Math.max(cards.length, 100)}
              value={challengeCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 1;
                const clamped = Math.max(1, Math.min(Math.max(cards.length, 100), val));
                setChallengeCount(clamped);
                try {
                  localStorage.setItem("spoken_challenge_count", String(clamped));
                } catch {}
              }}
              className="w-16 h-8 text-center font-mono font-bold text-sm tabular-nums text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {quickCounts.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  setChallengeCount(num);
                  try {
                    localStorage.setItem("spoken_challenge_count", String(num));
                  } catch {}
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors cursor-pointer tabular-nums ${
                  challengeCount === num
                    ? "bg-primary text-white border-primary"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750"
                }`}
              >
                {num}
              </button>
            ))}
            {cards.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setChallengeCount(cards.length);
                  try {
                    localStorage.setItem("spoken_challenge_count", String(cards.length));
                  } catch {}
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors cursor-pointer tabular-nums ${
                  challengeCount === cards.length
                    ? "bg-primary text-white border-primary"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750"
                }`}
              >
                الكل ({cards.length})
              </button>
            )}
          </div>
        </div>

        {/* AI Model */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            النموذج
          </label>
          <select
            value={selectedModel}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedModel(val);
              try {
                localStorage.setItem("spoken_challenge_selected_model", val);
                localStorage.setItem("ai_corrector_selected_model", val);
              } catch {}
            }}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary cursor-pointer"
          >
            {ALL_AVAILABLE_MODELS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Voice Selector + Compact Preview */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            الصوت
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedVoice}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedVoice(val);
                try {
                  localStorage.setItem("spoken_challenge_voice", val);
                } catch {}
              }}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary cursor-pointer"
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
              type="button"
              onClick={handleToggleVoicePreview}
              className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                isPlayingVoiceSample
                  ? "bg-primary text-white border-primary"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750"
              }`}
              title={isPlayingVoiceSample ? "إيقاف المعاينة" : "تجربة الصوت"}
            >
              {isPlayingVoiceSample ? <Square className="w-3.5 h-3.5 fill-current" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Timing Mode Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            توقيت الكشف والإجابة
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: "ai" as const, label: "الافتراضي (الذكاء)" },
              { id: "custom" as const, label: "وقت محدد" },
              { id: "manual" as const, label: "كشف يدوي" }
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => applyTimerMode(opt.id)}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                  timerMode === opt.id
                    ? "bg-primary text-white border-primary"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {timerMode === "custom" && (
            <div className="flex items-center justify-between gap-2 pt-1 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                المدة لكل سؤال (بالثواني)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyTimerMode("custom", Math.max(1, customSeconds - 1))}
                  className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={customSeconds}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) applyTimerMode("custom", val);
                  }}
                  className="w-14 h-7 text-center font-mono font-bold text-xs tabular-nums text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => applyTimerMode("custom", Math.min(120, customSeconds + 1))}
                  className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Optional Custom Instructions */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              توجيه إضافي (اختياري)
            </label>
            {customConditions.trim() && (
              <button
                type="button"
                onClick={() => {
                  setCustomConditions("");
                  try {
                    localStorage.removeItem("spoken_challenge_custom_conditions");
                  } catch {}
                }}
                className="text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>
          <textarea
            rows={2}
            value={customConditions}
            onChange={(e) => {
              const val = e.target.value;
              setCustomConditions(val);
              try {
                if (val.trim()) localStorage.setItem("spoken_challenge_custom_conditions", val);
                else localStorage.removeItem("spoken_challenge_custom_conditions");
              } catch {}
            }}
            placeholder="مثال: ركز على زمن الماضي Perfekt أو جمل السفر..."
            className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary resize-none leading-relaxed"
          />
        </div>

        {generationError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{generationError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleStartGeneration}
          disabled={cards.length === 0 || isGenerating}
          className="w-full h-14 rounded-2xl bg-primary hover:opacity-95 text-white font-black text-base shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{challengeCount > 15 ? "جاري توليد ومطابقة الجمل..." : "جاري التجهيز..."}</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>ابدأ</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // =========================================================================
  // 2. CLEAN COMPLETION SUMMARY SCREEN
  // =========================================================================
  if (isSessionCompleted) {
    const incorrectItems = challenges.filter((ch) => {
      const entry = completedItems.find((i) => i.id === ch.id);
      return entry ? !entry.isCorrect : true;
    });
    const totalIncorrect = incorrectItems.length;
    const totalCorrect = challenges.length - totalIncorrect;
    const accuracy = Math.round((totalCorrect / challenges.length) * 100) || 0;

    return (
      <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[26px] p-6 shadow-sm text-center text-slate-900 dark:text-white space-y-5" dir="rtl">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
          <Trophy className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-black">اكتمل التحدي</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {folderName || "المجلد الحالي"} · {challenges.length} جملة
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">الدقة</span>
            <span className="text-xl font-black text-primary font-mono tabular-nums">{accuracy}%</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">صحيحة</span>
            <span className="text-xl font-black text-emerald-500 font-mono tabular-nums">{totalCorrect}</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">مراجعة</span>
            <span className="text-xl font-black text-rose-500 font-mono tabular-nums">{totalIncorrect}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 pt-1">
          {totalIncorrect > 0 && (
            <button
              type="button"
              onClick={handleRetryMistakes}
              title={`إعادة الأخطاء فقط (${totalIncorrect})`}
              aria-label={`إعادة الأخطاء فقط (${totalIncorrect})`}
              className="flex-1 h-13 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <RotateCcw className="w-5 h-5 stroke-[2.5]" />
              <span className="font-mono text-sm tabular-nums">{totalIncorrect}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleRestartFullSession}
            title="إعادة جميع الجمل"
            aria-label="إعادة جميع الجمل"
            className="flex-1 h-13 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-2xl transition-all flex items-center justify-center cursor-pointer active:scale-[0.98]"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleSafeClose}
            title="إنهاء"
            aria-label="إنهاء"
            className="flex-1 h-13 bg-primary hover:opacity-95 text-white font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center cursor-pointer active:scale-[0.98]"
          >
            <Check className="w-5 h-5 stroke-[2.75]" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleReturnToSetup}
          className="text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          توليد جمل جديدة
        </button>
      </div>
    );
  }

  // =========================================================================
  // 3. ACTIVE CHALLENGE VIEW — MATCHES CHALLENGE / WRITE / ARTICLE / CLASSIC
  // =========================================================================
  const hasImage = Boolean(currentChallenge?.imageUrl);

  return (
    <div className="w-full max-w-[min(420px,calc(100dvh-250px))] mx-auto flex flex-col items-center gap-5">
      {/* Unified 48px Compact Toolbar (Matches ReviewSession Toolbar) */}
      <div className="w-full shrink-0" dir="rtl">
        <div className="w-full h-12 bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-1 shadow-xs flex items-center justify-center gap-1.5 select-none backdrop-blur-xs">
          {/* Auto-play audio on reveal */}
          <button
            type="button"
            onClick={() => {
              const next = !autoPlayAudio;
              setAutoPlayAudio(next);
              try {
                localStorage.setItem("spoken_challenge_autoplay", String(next));
              } catch {}
            }}
            title={autoPlayAudio ? "إيقاف النطق التلقائي عند الكشف" : "تفعيل النطق التلقائي عند الكشف"}
            className={`h-9.5 w-9.5 sm:h-10 sm:w-10 rounded-lg transition-all duration-150 cursor-pointer active:scale-95 flex items-center justify-center ${
              autoPlayAudio
                ? "bg-sky-500/[0.08] dark:bg-sky-400/[0.12] text-sky-700 dark:text-sky-300 border border-sky-500/20 dark:border-sky-400/25"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border border-transparent"
            }`}
          >
            {autoPlayAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Toggle Countdown Timer */}
          <button
            type="button"
            onClick={() => {
              if (useCountdown) {
                applyTimerMode("manual");
              } else {
                applyTimerMode(lastTimedMode);
              }
            }}
            title={useCountdown ? "التبديل إلى الكشف اليدوي (بدون مؤقت)" : "تفعيل المؤقت التلقائي"}
            className={`h-9.5 w-9.5 sm:h-10 sm:w-10 rounded-lg transition-all duration-150 cursor-pointer active:scale-95 flex items-center justify-center ${
              useCountdown
                ? "bg-sky-500/[0.08] dark:bg-sky-400/[0.12] text-sky-700 dark:text-sky-300 border border-sky-500/20 dark:border-sky-400/25"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border border-transparent"
            }`}
          >
            <Timer className="w-4 h-4" />
          </button>

          {/* AI Chat */}
          <button
            type="button"
            onClick={handleOpenAiChat}
            title="مناقشة الجملة بالذكاء الاصطناعي"
            className="h-9.5 w-9.5 sm:h-10 sm:w-10 rounded-lg transition-all duration-150 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60 cursor-pointer active:scale-95 flex items-center justify-center border border-transparent"
          >
            <Bot className="w-4 h-4" />
          </button>

          {/* In-Session Settings */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title="إعدادات التحدي"
            className={`h-9.5 w-9.5 sm:h-10 sm:w-10 rounded-lg transition-all duration-150 cursor-pointer active:scale-95 flex items-center justify-center ${
              isSettingsOpen
                ? "bg-sky-500/[0.08] dark:bg-sky-400/[0.12] text-sky-700 dark:text-sky-300 border border-sky-500/20 dark:border-sky-400/25"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border border-transparent"
            }`}
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Master 1:1 Square Card (Identical Structure to Challenge / Write / Article / Classic) */}
      <div className="relative w-full aspect-square select-none overflow-hidden rounded-[26px] shadow-sm border border-outline-variant/30 dark:border-slate-800 bg-surface-container-lowest dark:bg-slate-900 flex flex-col justify-between p-4 sm:p-5">
        {/* Full-bleed background illustration when loaded (keyed per challenge so old image never lingers) */}
        {hasImage && (
          <div
            key={`bg-${currentChallenge.id ?? currentIndex}`}
            className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden"
          >
            <img
              key={`${currentChallenge.id ?? currentIndex}-${currentChallenge.imageUrl}`}
              src={currentChallenge.imageUrl}
              alt={currentChallenge.arabic_prompt || "Challenge illustration"}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => advanceChallengeImageCandidate(currentIndex, currentChallenge.imageUrl)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/30" />
          </div>
        )}

        {/* Top Bar inside Square Card: Speaker + Mic (Left) | Countdown Number (Right) */}
        <div className="w-full flex items-center justify-between relative z-20 select-none pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                speakGerman(currentChallenge.target_german);
              }}
              className={`h-9.5 w-9.5 sm:h-10 sm:w-10 rounded-xl transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm ${
                isPlayingAudio
                  ? "bg-primary border border-primary text-white"
                  : hasImage
                    ? "bg-black/40 hover:bg-black/65 backdrop-blur-md border border-white/25 text-white"
                    : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
              }`}
              title="استمع للنطق"
            >
              <Volume2 className="w-4.5 h-4.5" />
            </button>

            {isSpeechSupported && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleMic();
                }}
                className={`h-9.5 w-9.5 sm:h-10 sm:w-10 rounded-xl transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm ${
                  isListening
                    ? "bg-rose-500 border border-rose-500 text-white animate-pulse"
                    : hasImage
                      ? "bg-black/40 hover:bg-black/65 backdrop-blur-md border border-white/25 text-white"
                      : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                }`}
                title={isListening ? "إيقاف الميكروفون" : "اختبر نطقك"}
              >
                {isListening ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
              </button>
            )}
          </div>

          {!isRevealed && useCountdown && isTimerRunning && (
            <div
              className={`h-9.5 min-w-9.5 sm:h-10 sm:min-w-10 px-2.5 rounded-xl flex items-center justify-center font-mono font-black text-base tabular-nums transition-colors ${
                timeLeft <= 1
                  ? "bg-rose-500 text-white shadow-sm"
                  : hasImage
                    ? "bg-black/45 backdrop-blur-md border border-white/25 text-white"
                    : "bg-primary/10 border border-primary/25 text-primary"
              }`}
            >
              {timeLeft}
            </div>
          )}
        </div>

        {/* Center Prompt & Revealed Target Sentence */}
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center text-center px-2 py-4 pointer-events-auto gap-3.5">
          <h2
            dir="rtl"
            className={`font-black break-words whitespace-pre-wrap leading-snug transition-all ${
              isRevealed
                ? hasImage
                  ? "text-lg sm:text-xl text-white/75"
                  : "text-lg sm:text-xl text-slate-500 dark:text-slate-400"
                : hasImage
                  ? "text-2xl sm:text-3xl text-white drop-shadow-md"
                  : "text-2xl sm:text-3xl text-on-surface dark:text-white"
            }`}
          >
            {currentChallenge.arabic_prompt}
          </h2>

          {isRevealed && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.18 }}
              onClick={() => speakGerman(currentChallenge.target_german)}
              className="inline-flex items-center justify-center max-w-full px-3 py-1.5 rounded-2xl transition-transform active:scale-95 cursor-pointer"
              dir="ltr"
              title="استمع للجملة"
            >
              <span
                className={`text-2xl sm:text-3xl font-black break-words whitespace-pre-wrap leading-snug ${
                  hasImage ? "text-white drop-shadow-md" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {currentChallenge.target_german}
              </span>
            </motion.button>
          )}

          {/* Minimal Speech Recognition Result */}
          {userSpokenText && (
            <div
              className={`max-w-full px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                hasImage
                  ? "bg-black/55 backdrop-blur-md text-white border border-white/15"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              }`}
            >
              <span dir="ltr" className="truncate max-w-[200px]">
                {userSpokenText}
              </span>
              {matchScore !== null && (
                <span
                  className={`font-mono tabular-nums shrink-0 ${
                    matchScore >= 80
                      ? "text-emerald-400"
                      : matchScore >= 50
                        ? "text-amber-400"
                        : "text-rose-400"
                  }`}
                >
                  {matchScore}%
                </span>
              )}
            </div>
          )}

          {speechError && (
            <p className="text-[11px] font-bold text-amber-400 bg-black/50 px-3 py-1 rounded-lg">
              {speechError}
            </p>
          )}
        </div>

        {/* Subtle Bottom Timer Progress Bar (Identical to Challenge Mode) */}
        <div className="w-full h-2 relative z-20 pointer-events-none select-none flex items-end">
          {!isRevealed && useCountdown && isTimerRunning && (
            <div className={`w-full h-1 rounded-full overflow-hidden ${hasImage ? "bg-white/20" : "bg-slate-200 dark:bg-slate-800"}`}>
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                  timeLeft <= 1 ? "bg-rose-500" : "bg-primary"
                }`}
                style={{ width: `${timerRatio * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tactile Action Bar directly below Square Card */}
      <div className="w-full">
        {isRevealed ? (
          <div className="w-full grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleCompleteChallenge(false)}
              className="h-14 sm:h-15 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white shadow-sm flex items-center justify-center transition-all cursor-pointer active:scale-[0.99]"
              title="أحتاج تكرارها"
              aria-label="أحتاج تكرارها"
            >
              <X className="w-7 h-7 stroke-[3]" />
            </button>
            <button
              type="button"
              onClick={() => handleCompleteChallenge(true)}
              className="h-14 sm:h-15 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm flex items-center justify-center transition-all cursor-pointer active:scale-[0.99]"
              title="نطقتها بنجاح"
              aria-label="نطقتها بنجاح"
            >
              <Check className="w-7 h-7 stroke-[3]" />
            </button>
          </div>
        ) : (
          <div className="w-full flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleReveal}
              className="flex-1 h-14 sm:h-15 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black text-base flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
              title="كشف الجملة"
            >
              <Eye className="w-5 h-5" />
              <span>كشف</span>
            </button>

            {isSpeechSupported && (
              <button
                type="button"
                onClick={handleToggleMic}
                className={`h-14 sm:h-15 w-14 sm:w-16 rounded-2xl shadow-sm flex items-center justify-center transition-all cursor-pointer active:scale-[0.98] shrink-0 ${
                  isListening
                    ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse"
                    : "bg-primary hover:opacity-95 text-white"
                }`}
                title={isListening ? "إيقاف الميكروفون" : "انطق الآن"}
                aria-label={isListening ? "إيقاف الميكروفون" : "انطق الآن"}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Unified Navigation Trackpad & Buttons */}
      <div className="w-full shrink-0">
        <UnifiedNavigationTrack
          currentIndex={currentIndex}
          totalCards={challenges.length}
          onPrev={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          onNext={() => setCurrentIndex((prev) => Math.min(challenges.length - 1, prev + 1))}
        />
      </div>

      {/* Spoken Challenge Context-Aware AI Chat Modal */}
      {isInternalChatOpen && currentChallenge && (
        <ReviewChatModal
          isOpen={isInternalChatOpen}
          onClose={() => setIsInternalChatOpen(false)}
          card={{
            id: String(currentChallenge.id || `spoken-${currentIndex}`),
            frontText: currentChallenge.target_german,
            backText: currentChallenge.arabic_prompt || "جملة التحدث المستهدفة",
            translationHint: currentChallenge.grammar_focus ? `التركيز النحوي: ${currentChallenge.grammar_focus}` : undefined,
            frontLang: "de",
            backLang: "ar",
            isSpokenChallenge: true,
            grammarFocus: currentChallenge.grammar_focus,
            cefrLevel: currentChallenge.cefr_level,
            vocabularyUsed: currentChallenge.vocab_focus
          }}
          previousCards={challenges.slice(Math.max(0, currentIndex - 5), currentIndex).map((ch, idx) => ({
            id: String(ch.id || `prev-spoken-${idx}`),
            frontText: ch.target_german,
            backText: ch.arabic_prompt,
            translationHint: ch.grammar_focus,
            frontLang: "de",
            backLang: "ar",
            isSpokenChallenge: true,
            grammarFocus: ch.grammar_focus
          }))}
          nextCards={challenges.slice(currentIndex + 1, currentIndex + 6).map((ch, idx) => ({
            id: String(ch.id || `next-spoken-${idx}`),
            frontText: ch.target_german,
            backText: ch.arabic_prompt,
            translationHint: ch.grammar_focus,
            frontLang: "de",
            backLang: "ar",
            isSpokenChallenge: true,
            grammarFocus: ch.grammar_focus
          }))}
          folderInfo={{
            name: `تحدي النطق (${currentIndex + 1} من ${challenges.length})`,
            description: `ممارسة نطق وتحدث الجمل الألمانية - ${folderName}`,
            targetLanguage: "de",
            sourceLanguage: "ar"
          }}
          challengeContext={{
            isChallengeMode: true,
            scenario: currentChallenge.arabic_prompt,
            grammarFocus: currentChallenge.grammar_focus,
            cefrLevel: currentChallenge.cefr_level,
            vocabularyUsed: currentChallenge.vocab_focus,
            totalChallenges: challenges.length,
            challengeIndex: currentIndex
          }}
          onPlayPronunciation={(text) => {
            speakGerman(text);
          }}
        />
      )}

      {/* In-Session Settings Modal (Voice Engine + Timer Mode) */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsSettingsOpen(false)}
          dir="rtl"
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[26px] p-5 sm:p-6 shadow-xl text-right space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                إعدادات تحدي النطق
              </h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                aria-label="إغلاق الإعدادات"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Voice Engine */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                محرك الصوت المختار
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedVoice}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedVoice(val);
                    try {
                      localStorage.setItem("spoken_challenge_voice", val);
                    } catch {}
                  }}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary cursor-pointer"
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
                  type="button"
                  onClick={handleToggleVoicePreview}
                  className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                    isPlayingVoiceSample
                      ? "bg-primary text-white border-primary"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750"
                  }`}
                  title={isPlayingVoiceSample ? "إيقاف المعاينة" : "تجربة الصوت"}
                >
                  {isPlayingVoiceSample ? <Square className="w-3.5 h-3.5 fill-current" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !autoPlayAudio;
                  setAutoPlayAudio(next);
                  try {
                    localStorage.setItem("spoken_challenge_autoplay", String(next));
                  } catch {}
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <span>النطق التلقائي عند كشف الإجابة</span>
                <span
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                    autoPlayAudio
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {autoPlayAudio ? "مفعل" : "متوقف"}
                </span>
              </button>
            </div>

            {/* Question / Reveal Timing Mode */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                توقيت السؤال والإجابة
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applyTimerMode("ai")}
                  className={`p-2.5 rounded-xl border text-center transition-colors cursor-pointer space-y-0.5 ${
                    timerMode === "ai"
                      ? "bg-primary text-white border-primary"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="text-xs font-bold">ثواني الذكاء</div>
                  <div className={`text-[10px] tabular-nums ${timerMode === "ai" ? "text-white/85" : "text-slate-400"}`}>
                    الافتراضي ({currentChallenge?.estimated_seconds || 6}ث)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyTimerMode("custom")}
                  className={`p-2.5 rounded-xl border text-center transition-colors cursor-pointer space-y-0.5 ${
                    timerMode === "custom"
                      ? "bg-primary text-white border-primary"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="text-xs font-bold">وقت محدد</div>
                  <div className={`text-[10px] tabular-nums ${timerMode === "custom" ? "text-white/85" : "text-slate-400"}`}>
                    {customSeconds} ثانية
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyTimerMode("manual")}
                  className={`p-2.5 rounded-xl border text-center transition-colors cursor-pointer space-y-0.5 ${
                    timerMode === "manual"
                      ? "bg-primary text-white border-primary"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="text-xs font-bold">كشف يدوي</div>
                  <div className={`text-[10px] ${timerMode === "manual" ? "text-white/85" : "text-slate-400"}`}>
                    بدون توقيت
                  </div>
                </button>
              </div>

              {timerMode === "custom" && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      عدد الثواني لكل سؤال
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyTimerMode("custom", Math.max(1, customSeconds - 1))}
                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={customSeconds}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) applyTimerMode("custom", val);
                        }}
                        className="w-16 h-8 text-center font-mono font-bold text-sm tabular-nums text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => applyTimerMode("custom", Math.min(120, customSeconds + 1))}
                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[3, 5, 8, 10, 15, 20].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => applyTimerMode("custom", sec)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono tabular-nums border transition-colors cursor-pointer ${
                          customSeconds === sec
                            ? "bg-primary text-white border-primary"
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {sec}ث
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-1 space-y-2.5">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-full h-11 rounded-2xl bg-primary hover:opacity-95 text-white font-black text-sm shadow-sm transition-all cursor-pointer active:scale-[0.99]"
              >
                حفظ وإغلاق
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSettingsOpen(false);
                  handleReturnToSetup();
                }}
                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>توليد جمل جديدة (العودة للبداية)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

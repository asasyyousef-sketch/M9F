import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Headphones,
  Mic,
  MicOff,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  RefreshCw,
  Repeat,
  Plus,
  Trash2,
  FileText,
  Radio,
  Globe,
  Server,
  Zap,
  Check,
  BookOpen,
  Menu,
  Sliders,
  Sparkles,
  ArrowRight,
  Settings,
  Edit3,
  Bookmark,
  Download,
  Languages,
  FileArchive,
  CheckCheck,
  Loader2,
  Layers
} from "lucide-react";
import JSZip from "jszip";
import { Folder, Flashcard, DEFAULT_GRADIO_VOICES } from "../types";
import { fetchGradioAudioBlob, speakClient } from "./Modals";
import {
  ShadowingVoiceSettingsModal,
  ShadowingVoiceProvider,
} from "./ShadowingVoiceSettingsModal";
import { ReviewChatModal } from "./ReviewChatModal";
import { MessageSquare } from "lucide-react";

export type ShadowingProvider = ShadowingVoiceProvider;

export interface ShadowingSentence {
  id: string;
  text: string;
  translation?: string;
  userAudioBlob?: Blob;
  userAudioUrl?: string;
  userWaveform?: number[];
  recognizedText?: string;
  accuracyScore?: number;
}

export interface ShadowingSession {
  id: string;
  title: string;
  language: string;
  provider: ShadowingProvider;
  voiceId: string;
  rawText: string;
  sentences: ShadowingSentence[];
  createdAt: string;
  updatedAt: string;
}

interface ShadowingWorkspaceProps {
  folders?: Folder[];
  cards?: Flashcard[];
  onToggleSidebar?: () => void;
  onBackToLibrary?: () => void;
  onImportCard?: (newCards: Omit<Flashcard, "id" | "folderId" | "createdAt" | "streak">[]) => void;
}

// Built-in Dialogues & Practice Scripts
const PRESET_SCRIPTS = [
  {
    id: "de-cafe",
    title: "🇩🇪 محادثة في المقهى (Im Café - A1/A2)",
    language: "de",
    text: `Guten Tag! Was darf ich Ihnen bringen?
Ich hätte gerne einen Cappuccino und ein Stück Käsekuchen, bitte.
Möchten Sie den Kuchen mit Sahne?
Nein danke, einfach so.
Das macht zusammen sechs Euro fünfzig.
Hier sind zehn Euro, stimmt so!
Vielen Dank und einen schönen Tag noch!`
  },
  {
    id: "de-intro",
    title: "🇩🇪 التعارف والعمل (Vorstellung & Beruf - A2)",
    language: "de",
    text: `Hallo, mein Name ist Jonas und ich komme aus Berlin.
Ich arbeite als Softwareentwickler bei einer internationalen Firma.
In meiner Freizeit lerne ich gerne Fremdsprachen und treibe Sport.
Wie lange wohnen Sie schon in dieser Stadt?
Ich lebe hier seit ungefähr drei Jahren.
Es freut mich sehr, Sie kennenzulernen!`
  },
  {
    id: "de-interview",
    title: "🇩🇪 مقابلة عمل رسمية (Bewerbungsgespräch - B1)",
    language: "de",
    text: `Vielen Dank für die Einladung zu diesem Gespräch.
Ich habe große Erfahrung in der Organisation von Projekten und der Teamführung.
Meine größte Stärke ist es, auch unter Druck ruhig und lösungsorientiert zu arbeiten.
Warum haben Sie sich gerade für unser Unternehmen entschieden?
Weil Ihre Philosophie und Ihre innovativen Produkte mich sehr beeindrucken.
Ich bin überzeugt, dass ich einen wertvollen Beitrag leisten kann.`
  },
  {
    id: "en-daily",
    title: "🇺🇸 روتين العمل اليومي (Daily Work Routine - English)",
    language: "en",
    text: `Good morning everyone, let's start today's standup meeting.
Yesterday I finished reviewing the pull requests and updated the documentation.
Today my primary focus is resolving the performance bottleneck in the media player.
Are there any blockers preventing you from making progress?
No blockers at the moment, everything is going smoothly.
Great, let's keep up the momentum!`
  }
];

// Helper to format seconds like "00:02.4"
function formatTimeSeconds(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 10);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${millis}`;
}

// Clean string for fuzzy comparison
function cleanWord(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»،؟]/g, "")
    .trim();
}

// Levenshtein distance for word matching
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Extract real audio waveform from an AudioBuffer or Blob
async function extractRealWaveform(blob: Blob, barsCount = 80): Promise<number[]> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return [];
    const ctx = new AudioCtxClass();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / barsCount);
    const samples: number[] = [];

    let maxVal = 0.005;
    for (let i = 0; i < barsCount; i++) {
      let sum = 0;
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channelData.length);
      for (let j = start; j < end; j++) {
        sum += Math.abs(channelData[j]);
      }
      const avg = sum / (end - start || 1);
      samples.push(avg);
      if (avg > maxVal) maxVal = avg;
    }
    ctx.close().catch(() => {});

    return samples.map((s) => {
      const norm = Math.max(0.12, Math.min(0.95, s / maxVal));
      return parseFloat(norm.toFixed(2));
    });
  } catch (err) {
    console.warn("Waveform decode error:", err);
    return [];
  }
}

// Generate realistic simulated envelope peaks (used before audio decoded or for TTS)
function generateSimulatedPeaks(text: string, count = 80): number[] {
  const peaks: number[] = [];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  for (let i = 0; i < count; i++) {
    const v = Math.abs(Math.sin((i * 0.18) + (hash % 10)) * 0.7 + Math.cos((i * 0.05) + hash) * 0.3);
    const envelope = Math.sin((i / (count - 1)) * Math.PI);
    peaks.push(Math.max(0.14, Math.min(0.95, (v * 0.8 + 0.2) * (0.3 + 0.7 * envelope))));
  }
  return peaks;
}

// Helper to determine text direction
function detectDirection(text: string): "rtl" | "ltr" {
  if (!text) return "ltr";
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text) ? "rtl" : "ltr";
}

export function ShadowingWorkspace({
  folders = [],
  cards = [],
  onToggleSidebar,
  onBackToLibrary,
  onImportCard
}: ShadowingWorkspaceProps) {
  // Navigation tabs & Modals
  const [activeTab, setActiveTab] = useState<"practice" | "saved">("practice");
  const [showVoiceSettingsModal, setShowVoiceSettingsModal] = useState(false);
  const [showTextEditorModal, setShowTextEditorModal] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [chatSentenceItem, setChatSentenceItem] = useState<{ text: string; translation?: string } | null>(null);

  // Practice Script State
  const [scriptTitle, setScriptTitle] = useState<string>("🇩🇪 محادثة في المقهى (Im Café - A1/A2)");
  const [language, setLanguage] = useState<string>(() => {
    return localStorage.getItem("shadowing_language") || "de";
  });
  const [rawText, setRawText] = useState<string>(PRESET_SCRIPTS[0].text);
  const [sentences, setSentences] = useState<ShadowingSentence[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);

  // Provider & Voice Selection
  const [provider, setProvider] = useState<ShadowingProvider>(() => {
    return (localStorage.getItem("shadowing_voice_provider") as ShadowingProvider) || "google";
  });
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => {
    return localStorage.getItem("shadowing_voice_id") || "google";
  });
  const [gradioUrl, setGradioUrl] = useState<string>(() => {
    return (
      localStorage.getItem("settings_gradio_tts_url") ||
      localStorage.getItem("gradio_api_url") ||
      "http://192.168.0.159:7860"
    );
  });

  // Controls
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    const saved = localStorage.getItem("shadowing_playback_speed");
    return saved ? parseFloat(saved) : 1.0;
  });
  const [isLoopingModel, setIsLoopingModel] = useState<boolean>(false);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(false);

  // Model audio & progress states
  const [isPlayingModel, setIsPlayingModel] = useState<boolean>(false);
  const [modelAudioProgress, setModelAudioProgress] = useState<number>(0);
  const [modelAudioDuration, setModelAudioDuration] = useState<number>(0);
  const [modelAudioCurrentTime, setModelAudioCurrentTime] = useState<number>(0);
  const [isGeneratingModelAudio, setIsGeneratingModelAudio] = useState<boolean>(false);
  const [originalWaveform, setOriginalWaveform] = useState<number[]>([]);

  // User audio recording & playback states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingUserAudio, setIsPlayingUserAudio] = useState<boolean>(false);
  const [userAudioProgress, setUserAudioProgress] = useState<number>(0);
  const [userAudioDuration, setUserAudioDuration] = useState<number>(0);
  const [userAudioCurrentTime, setUserAudioCurrentTime] = useState<number>(0);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [userWaveform, setUserWaveform] = useState<number[]>([]);

  // Speech Recognition & Scoring States
  const [recognizedText, setRecognizedText] = useState<string>("");
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Saved Sessions
  const [savedSessions, setSavedSessions] = useState<ShadowingSession[]>(() => {
    try {
      const saved = localStorage.getItem("shadowing_studio_sessions");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Browser voices & toast notifications
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Refs for Audio playback and recording
  const modelAudioRef = useRef<HTMLAudioElement | null>(null);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const loopTimerRef = useRef<number | null>(null);
  const userWaveformSamplesRef = useRef<number[]>([]);
  const lastSampleTimeRef = useRef<number>(0);
  const audioCacheRef = useRef<Map<string, { url: string; blob?: Blob }>>(new Map());

  // Animation frames for smooth playhead tracks
  const modelAnimRef = useRef<number | null>(null);
  const userAnimRef = useRef<number | null>(null);

  // AI Translation State (Exclusive to Shadowing / Text Studio)
  const [isTranslatingWithAi, setIsTranslatingWithAi] = useState<boolean>(false);
  const [aiTranslationModel, setAiTranslationModel] = useState<string>(() => {
    return localStorage.getItem("shadowing_ai_translation_model") || "gemini-3.8-flash";
  });
  const [aiTargetLanguage, setAiTargetLanguage] = useState<string>(() => {
    return localStorage.getItem("shadowing_ai_target_lang") || "ar";
  });
  const [editingTranslationSentenceId, setEditingTranslationSentenceId] = useState<string | null>(null);
  const [editingTranslationText, setEditingTranslationText] = useState<string>("");

  // Sentence Pre-download & Audio Cache State
  const [downloadProgress, setDownloadProgress] = useState<{
    current: number;
    total: number;
    isRunning: boolean;
    currentSentence?: string;
  } | null>(null);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [cachedAudioKeys, setCachedAudioKeys] = useState<Record<string, boolean>>({});
  const cancelDownloadRef = useRef<boolean>(false);

  // Toast Helper
  const showToast = useCallback((msg: string, _type?: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Populate browser voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const updateVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        setBrowserVoices(v);
      }
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

  // Parse Text into Sentences
  const parseSentences = useCallback((text: string) => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed: ShadowingSentence[] = [];
    lines.forEach((line) => {
      const lineSentences = line
        .split(/(?<=[.?!;])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

      lineSentences.forEach((s) => {
        parsed.push({
          id: `sent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          text: s
        });
      });
    });

    setSentences(parsed);
    setCurrentSentenceIndex(0);
  }, []);

  // Initialize sentences on mount
  useEffect(() => {
    if (sentences.length === 0 && rawText.trim()) {
      parseSentences(rawText);
    }
  }, [parseSentences, rawText, sentences.length]);

  // Current active sentence
  const currentSentence = useMemo(() => {
    if (sentences.length === 0) return null;
    const idx = Math.max(0, Math.min(currentSentenceIndex, sentences.length - 1));
    return sentences[idx] || null;
  }, [sentences, currentSentenceIndex]);

  // Stop all audio playback & loop timers
  const stopAllAudio = useCallback(() => {
    if (loopTimerRef.current) {
      window.clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    if (modelAudioRef.current) {
      modelAudioRef.current.pause();
    }
    if (userAudioRef.current) {
      userAudioRef.current.pause();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingModel(false);
    setIsPlayingUserAudio(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllAudio();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (modelAnimRef.current) cancelAnimationFrame(modelAnimRef.current);
      if (userAnimRef.current) cancelAnimationFrame(userAnimRef.current);
    };
  }, [stopAllAudio]);

  // Reset states when changing active sentence
  useEffect(() => {
    stopAllAudio();
    if (isRecording) {
      stopRecording();
    }

    if (currentSentence) {
      setOriginalWaveform(generateSimulatedPeaks(currentSentence.text, 80));
      setRecordedAudioUrl(currentSentence.userAudioUrl || null);
      setRecognizedText(currentSentence.recognizedText || "");
      setSimilarityScore(currentSentence.accuracyScore ?? null);
      setUserWaveform(currentSentence.userWaveform || []);
    } else {
      setOriginalWaveform([]);
      setRecordedAudioUrl(null);
      setRecognizedText("");
      setSimilarityScore(null);
      setUserWaveform([]);
    }

    setModelAudioProgress(0);
    setModelAudioCurrentTime(0);
    setUserAudioProgress(0);
    setUserAudioCurrentTime(0);
    setIsLoopingModel(false);
    setSpeechError(null);
  }, [currentSentence?.id]);

  // Smooth 60fps tracking for Model Audio
  useEffect(() => {
    if (!isPlayingModel) {
      if (modelAnimRef.current) cancelAnimationFrame(modelAnimRef.current);
      return;
    }

    const updateSmoothModel = () => {
      const audio = modelAudioRef.current;
      if (audio && audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        const frac = Math.max(0, Math.min(1, audio.currentTime / audio.duration));
        setModelAudioProgress(frac * 100);
        setModelAudioCurrentTime(audio.currentTime);
        setModelAudioDuration(audio.duration);
      }
      if (isPlayingModel) {
        modelAnimRef.current = requestAnimationFrame(updateSmoothModel);
      }
    };

    modelAnimRef.current = requestAnimationFrame(updateSmoothModel);

    return () => {
      if (modelAnimRef.current) cancelAnimationFrame(modelAnimRef.current);
    };
  }, [isPlayingModel]);

  // Smooth 60fps tracking for User Audio
  useEffect(() => {
    if (!isPlayingUserAudio) {
      if (userAnimRef.current) cancelAnimationFrame(userAnimRef.current);
      return;
    }

    const updateSmoothUser = () => {
      const audio = userAudioRef.current;
      if (audio && audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        const frac = Math.max(0, Math.min(1, audio.currentTime / audio.duration));
        setUserAudioProgress(frac * 100);
        setUserAudioCurrentTime(audio.currentTime);
        setUserAudioDuration(audio.duration);
      }
      if (isPlayingUserAudio) {
        userAnimRef.current = requestAnimationFrame(updateSmoothUser);
      }
    };

    userAnimRef.current = requestAnimationFrame(updateSmoothUser);

    return () => {
      if (userAnimRef.current) cancelAnimationFrame(userAnimRef.current);
    };
  }, [isPlayingUserAudio]);

  // Get Reference Audio URL
  const getReferenceAudioUrl = useCallback(
    async (text: string): Promise<{ url: string; blob?: Blob } | null> => {
      const cacheKey = `${provider}|${selectedVoiceId}|${language}|${text}`;
      if (audioCacheRef.current.has(cacheKey)) {
        return audioCacheRef.current.get(cacheKey)!;
      }

      setIsGeneratingModelAudio(true);
      try {
        if (provider === "external") {
          const cleanVoice = selectedVoiceId.replace(/^gradio[:_]/i, "").trim() || "ryan";
          const effectiveGradioUrl = (
            gradioUrl ||
            localStorage.getItem("settings_gradio_tts_url") ||
            localStorage.getItem("gradio_api_url") ||
            "http://192.168.0.159:7860"
          ).trim();

          let blob = await fetchGradioAudioBlob(text, cleanVoice, language, effectiveGradioUrl, false);

          if (!blob) {
            try {
              const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
              const apiBase = isLocalhost ? "http://localhost:3000/api/tts" : "/api/tts";
              const fallbackRes = await fetch(
                `${apiBase}?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(language)}&voice=${encodeURIComponent(`gradio:${cleanVoice}`)}&gradioUrl=${encodeURIComponent(effectiveGradioUrl)}&_t=${Date.now()}`
              );
              if (fallbackRes.ok) {
                const cType = fallbackRes.headers.get("content-type") || "";
                if (cType.includes("audio")) {
                  blob = await fallbackRes.blob();
                }
              }
            } catch (fbErr) {
              console.warn("Direct GET /api/tts fallback in ShadowingWorkspace failed:", fbErr);
            }
          }

          if (blob && blob.size > 100) {
            const url = URL.createObjectURL(blob);
            const res = { url, blob };
            audioCacheRef.current.set(cacheKey, res);
            setCachedAudioKeys((prev) => ({ ...prev, [text]: true }));
            return res;
          }
          throw new Error("Failed to generate Gradio audio");
        } else if (provider === "piper") {
          const voiceParam = `&voice=${encodeURIComponent(selectedVoiceId)}`;
          const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${language}${voiceParam}`;
          const res = await fetch(url);
          if (res.ok) {
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const item = { url: objectUrl, blob };
            audioCacheRef.current.set(cacheKey, item);
            setCachedAudioKeys((prev) => ({ ...prev, [text]: true }));
            return item;
          }
          throw new Error("Piper TTS failed");
        } else {
          // Google TTS Server
          const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${language}&voice=google`;
          const res = await fetch(url);
          if (res.ok) {
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const item = { url: objectUrl, blob };
            audioCacheRef.current.set(cacheKey, item);
            setCachedAudioKeys((prev) => ({ ...prev, [text]: true }));
            return item;
          }
          return null; // Will fallback to WebSpeech
        }
      } catch (err) {
        console.warn("Audio generation error, falling back to WebSpeech:", err);
        return null;
      } finally {
        setIsGeneratingModelAudio(false);
      }
    },
    [provider, selectedVoiceId, language, gradioUrl]
  );

  // ---------------------------------------------------------------------------
  // AI TRANSLATION HANDLERS (FULL SCRIPT / INDIVIDUAL SENTENCES)
  // ---------------------------------------------------------------------------
  const handleTranslateAllWithAi = useCallback(
    async (sentencesList?: ShadowingSentence[]) => {
      const targetList = sentencesList && sentencesList.length > 0 ? sentencesList : sentences;
      if (targetList.length === 0) {
        showToast("لا توجد جمل للترجمة حالياً.");
        return;
      }

      setIsTranslatingWithAi(true);
      try {
        const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        const apiBase = isLocalhost ? "http://localhost:3000/api/shadowing/translate-sentences" : "/api/shadowing/translate-sentences";

        const res = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sentences: targetList.map((s) => ({ id: s.id, text: s.text })),
            rawText,
            sourceLanguage: language,
            targetLanguage: aiTargetLanguage,
            selectedModel: aiTranslationModel,
          }),
        });

        const resText = await res.text();
        let data: any = {};
        try {
          data = resText ? JSON.parse(resText) : {};
        } catch (jsonErr) {
          throw new Error(`تعذر قراءة استجابة السيرفر (${res.status})`);
        }

        if (!res.ok || !data.success) {
          throw new Error(data.error || "تعذر إتمام الترجمة عبر الذكاء الاصطناعي");
        }

        const translationsMap = data.translations || {};
        setSentences((prev) =>
          prev.map((sent) => ({
            ...sent,
            translation: translationsMap[sent.id] || sent.translation || "",
          }))
        );

        const count = Object.keys(translationsMap).length;
        showToast(`تمت ترجمة ${count} جملة بنجاح عبر نموذج ${data.usedModel || aiTranslationModel}! ✨`);
      } catch (err: any) {
        console.error("AI translation error:", err);
        showToast(`فشلت الترجمة بالذكاء الاصطناعي: ${err.message || "خطأ اتصال بالسيرفر"}`, "error");
      } finally {
        setIsTranslatingWithAi(false);
      }
    },
    [sentences, rawText, language, aiTargetLanguage, aiTranslationModel, showToast]
  );

  const handleTranslateSingleSentence = useCallback(
    async (sentenceId: string) => {
      const targetSent = sentences.find((s) => s.id === sentenceId);
      if (!targetSent) return;

      setIsTranslatingWithAi(true);
      try {
        const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        const apiBase = isLocalhost ? "http://localhost:3000/api/shadowing/translate-sentences" : "/api/shadowing/translate-sentences";

        const res = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sentences: [{ id: targetSent.id, text: targetSent.text }],
            sourceLanguage: language,
            targetLanguage: aiTargetLanguage,
            selectedModel: aiTranslationModel,
          }),
        });

        const resText = await res.text();
        let data: any = {};
        try {
          data = resText ? JSON.parse(resText) : {};
        } catch (jsonErr) {
          throw new Error(`تعذر قراءة استجابة السيرفر (${res.status})`);
        }

        if (!res.ok || !data.success) {
          throw new Error(data.error || "تعذر ترجمة الجملة");
        }

        const trans = data.translations?.[targetSent.id];
        if (trans) {
          setSentences((prev) =>
            prev.map((s) => (s.id === sentenceId ? { ...s, translation: trans } : s))
          );
          showToast("تمت ترجمة الجملة بنجاح! ✨");
        }
      } catch (err: any) {
        showToast(`فشل الترجمة: ${err.message}`, "error");
      } finally {
        setIsTranslatingWithAi(false);
      }
    },
    [sentences, language, aiTargetLanguage, aiTranslationModel, showToast]
  );

  const handleSaveSentenceTranslation = useCallback(
    (sentenceId: string, newTranslation: string) => {
      setSentences((prev) =>
        prev.map((s) => (s.id === sentenceId ? { ...s, translation: newTranslation.trim() } : s))
      );
      setEditingTranslationSentenceId(null);
      setEditingTranslationText("");
      showToast("تم حفظ الترجمة بنجاح.");
    },
    [showToast]
  );

  // ---------------------------------------------------------------------------
  // SENTENCE AUDIO PRE-DOWNLOAD & CACHING HANDLERS
  // ---------------------------------------------------------------------------
  const handlePreDownloadAllAudio = useCallback(async () => {
    if (sentences.length === 0) {
      showToast("لا توجد جمل لتنزيل أصواتها.");
      return;
    }

    cancelDownloadRef.current = false;
    setDownloadProgress({
      current: 0,
      total: sentences.length,
      isRunning: true,
    });

    let successCount = 0;
    for (let i = 0; i < sentences.length; i++) {
      if (cancelDownloadRef.current) {
        showToast("تم إيقاف عملية التنزيل المسبق.");
        break;
      }
      const s = sentences[i];
      setDownloadProgress({
        current: i + 1,
        total: sentences.length,
        isRunning: true,
        currentSentence: s.text,
      });

      try {
        const res = await getReferenceAudioUrl(s.text);
        if (res?.blob || res?.url) {
          successCount++;
          setCachedAudioKeys((prev) => ({ ...prev, [s.text]: true }));
        }
      } catch (err) {
        console.warn(`Pre-download failed for sentence ${i + 1}:`, err);
      }

      // Small throttle interval
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    setDownloadProgress(null);
    if (!cancelDownloadRef.current) {
      showToast(`تم تنزيل وتخزين ${successCount} من ${sentences.length} صوتاً محلياً بنجاح! 🎧`);
    }
  }, [sentences, getReferenceAudioUrl, showToast]);

  const handleCancelPreDownload = useCallback(() => {
    cancelDownloadRef.current = true;
    setDownloadProgress(null);
    showToast("تم إلغاء التنزيل المسبق.");
  }, [showToast]);

  const handleDownloadSingleSentenceAudio = useCallback(
    async (sent: ShadowingSentence, index: number) => {
      try {
        showToast("جاري تجهيز المقطع الصوتي للتحميل...");
        const res = await getReferenceAudioUrl(sent.text);
        if (!res?.blob) {
          throw new Error("تعذر الحصول على الملف الصوتي من المزود");
        }
        const ext = res.blob.type.includes("wav") ? "wav" : "mp3";
        const cleanText = sent.text.slice(0, 20).replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, "_");
        const filename = `shadowing_${(index + 1).toString().padStart(2, "0")}_${cleanText}.${ext}`;

        const url = URL.createObjectURL(res.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 4000);

        showToast(`تم تنزيل المقطع الصوتي (${filename}) بنجاح! 📥`);
      } catch (err: any) {
        showToast(`فشل تنزيل الصوت: ${err.message}`, "error");
      }
    },
    [getReferenceAudioUrl, showToast]
  );

  const handleDownloadAllAudioZip = useCallback(async () => {
    if (sentences.length === 0) {
      showToast("لا توجد جمل لتحميل حزمتها الصوتية.");
      return;
    }

    setIsExportingZip(true);
    showToast("جاري تجميع وحزم الأصوات والترجمات في ملف ZIP...");
    try {
      const zip = new JSZip();
      const folder = zip.folder("shadowing_audio") || zip;

      let transcriptContent = `=========================================\n` +
        ` استوديو الشادوينج - حزمة الأصوات والنصوص\n` +
        `=========================================\n` +
        `العنوان: ${scriptTitle}\n` +
        `اللغة: ${language}\n` +
        `مزود الصوت: ${provider} (${selectedVoiceId})\n` +
        `موديل الترجمة: ${aiTranslationModel}\n` +
        `تاريخ التصدير: ${new Date().toLocaleString("ar")}\n\n` +
        `=========================================\n\n`;

      for (let i = 0; i < sentences.length; i++) {
        const s = sentences[i];
        const idxStr = (i + 1).toString().padStart(2, "0");
        const cleanName = s.text.slice(0, 20).replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, "_");

        transcriptContent += `[${idxStr}] ${s.text}\n`;
        if (s.translation) {
          transcriptContent += `الترجمة: ${s.translation}\n`;
        }
        transcriptContent += `\n`;

        const res = await getReferenceAudioUrl(s.text);
        if (res?.blob) {
          const ext = res.blob.type.includes("wav") ? "wav" : "mp3";
          folder.file(`${idxStr}_${cleanName}.${ext}`, res.blob);
        }
      }

      folder.file("transcript_and_translations.txt", transcriptContent);

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const cleanTitle = scriptTitle.slice(0, 25).replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, "_");
      const filename = `Shadowing_${cleanTitle || "Audio"}_Package.zip`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(`تم تنزيل حزمة الأصوات (${filename}) بنجاح! 📦`);
    } catch (err: any) {
      console.error("ZIP export error:", err);
      showToast(`فشل تصدير حزمة ZIP: ${err.message}`, "error");
    } finally {
      setIsExportingZip(false);
    }
  }, [sentences, scriptTitle, language, provider, selectedVoiceId, aiTranslationModel, getReferenceAudioUrl, showToast]);

  // Play Model Audio Segment
  const handlePlayModel = useCallback(
    async (seekRatio?: number) => {
      if (!currentSentence) return;
      if (isPlayingModel && seekRatio === undefined) {
        stopAllAudio();
        setIsLoopingModel(false);
        return;
      }

      stopAllAudio();

      if (provider === "webspeech") {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(currentSentence.text);
          utterance.lang = language === "de" ? "de-DE" : language === "ar" ? "ar-SA" : "en-US";
          utterance.rate = playbackSpeed;

          const targetVoice = browserVoices.find(
            (v) => v.name === selectedVoiceId || v.voiceURI === selectedVoiceId
          );
          if (targetVoice) {
            utterance.voice = targetVoice;
          }

          utterance.onstart = () => setIsPlayingModel(true);
          utterance.onend = () => {
            setIsPlayingModel(false);
            setModelAudioProgress(100);
            if (isLoopingModel) {
              loopTimerRef.current = window.setTimeout(() => handlePlayModel(), 750);
            } else if (autoAdvance && currentSentenceIndex < sentences.length - 1) {
              setCurrentSentenceIndex((prev) => prev + 1);
            }
          };
          utterance.onerror = () => setIsPlayingModel(false);

          window.speechSynthesis.speak(utterance);
        }
        return;
      }

      const audioData = await getReferenceAudioUrl(currentSentence.text);

      if (!audioData) {
        // Fallback WebSpeech
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(currentSentence.text);
          utterance.lang = language === "de" ? "de-DE" : language === "ar" ? "ar-SA" : "en-US";
          utterance.rate = playbackSpeed;

          const targetVoice = browserVoices.find(
            (v) => v.name === selectedVoiceId || v.voiceURI === selectedVoiceId
          );
          if (targetVoice) {
            utterance.voice = targetVoice;
          }

          utterance.onstart = () => setIsPlayingModel(true);
          utterance.onend = () => {
            setIsPlayingModel(false);
            setModelAudioProgress(100);
            if (isLoopingModel) {
              loopTimerRef.current = window.setTimeout(() => handlePlayModel(), 750);
            } else if (autoAdvance && currentSentenceIndex < sentences.length - 1) {
              setCurrentSentenceIndex((prev) => prev + 1);
            }
          };
          utterance.onerror = () => setIsPlayingModel(false);

          window.speechSynthesis.speak(utterance);
        }
        return;
      }

      // Extract genuine waveform if we received a blob
      if (audioData.blob) {
        extractRealWaveform(audioData.blob, 80).then((peaks) => {
          if (peaks.length > 0) setOriginalWaveform(peaks);
        });
      }

      let audio = modelAudioRef.current;
      if (!audio) {
        audio = new Audio(audioData.url);
        modelAudioRef.current = audio;
      } else {
        if (audio.src !== audioData.url) {
          audio.src = audioData.url;
        }
      }

      audio.playbackRate = playbackSpeed;

      audio.onloadedmetadata = () => {
        if (audio) {
          setModelAudioDuration(audio.duration);
          if (seekRatio !== undefined) {
            audio.currentTime = seekRatio * audio.duration;
          }
        }
      };

      audio.onended = () => {
        setIsPlayingModel(false);
        setModelAudioProgress(100);
        if (isLoopingModel) {
          loopTimerRef.current = window.setTimeout(() => {
            if (modelAudioRef.current) {
              modelAudioRef.current.currentTime = 0;
              modelAudioRef.current.play().then(() => setIsPlayingModel(true)).catch(() => {});
            }
          }, 750);
        } else if (autoAdvance && currentSentenceIndex < sentences.length - 1) {
          setCurrentSentenceIndex((prev) => prev + 1);
        }
      };

      audio.onerror = () => {
        setIsPlayingModel(false);
      };

      if (seekRatio !== undefined && audio.duration) {
        audio.currentTime = seekRatio * audio.duration;
      }

      audio.play().then(() => {
        setIsPlayingModel(true);
      }).catch((e) => {
        console.warn("Audio play error:", e);
        setIsPlayingModel(false);
      });
    },
    [
      currentSentence,
      isPlayingModel,
      stopAllAudio,
      getReferenceAudioUrl,
      language,
      playbackSpeed,
      isLoopingModel,
      autoAdvance,
      currentSentenceIndex,
      sentences.length
    ]
  );

  // Original Waveform Click-to-Seek
  const handleOriginalWaveformSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (modelAudioRef.current && modelAudioRef.current.duration) {
      modelAudioRef.current.currentTime = frac * modelAudioRef.current.duration;
      setModelAudioProgress(frac * 100);
      if (!isPlayingModel) {
        modelAudioRef.current.play().then(() => setIsPlayingModel(true)).catch(() => {});
      }
    } else {
      handlePlayModel(frac);
    }
  };

  // User Recorded Audio Playback
  const handlePlayUserAudio = () => {
    if (!recordedAudioUrl) return;
    if (isPlayingUserAudio) {
      stopAllAudio();
      return;
    }
    stopAllAudio();

    let audio = userAudioRef.current;
    if (!audio) {
      audio = new Audio(recordedAudioUrl);
      userAudioRef.current = audio;
    } else {
      if (audio.src !== recordedAudioUrl) {
        audio.src = recordedAudioUrl;
      }
    }

    audio.playbackRate = playbackSpeed;

    audio.onloadedmetadata = () => {
      if (audio) setUserAudioDuration(audio.duration);
    };

    audio.onended = () => {
      setIsPlayingUserAudio(false);
      setUserAudioProgress(0);
    };

    audio.onerror = () => {
      setIsPlayingUserAudio(false);
    };

    audio.play().then(() => {
      setIsPlayingUserAudio(true);
    }).catch(console.error);
  };

  // User Waveform Click-to-Seek
  const handleUserWaveformSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!userAudioRef.current || !recordedAudioUrl || isRecording) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (userAudioRef.current.duration) {
      userAudioRef.current.currentTime = frac * userAudioRef.current.duration;
      setUserAudioProgress(frac * 100);
      if (!isPlayingUserAudio) {
        handlePlayUserAudio();
      }
    }
  };

  // Calculate Speech Similarity & Word Analysis (Same exact fuzzy evaluator as video modal)
  const evaluatePronunciation = useCallback((spoken: string, target: string) => {
    const sWords = spoken.split(/\s+/).map(cleanWord).filter(Boolean);
    const tWords = target.split(/\s+/).map(cleanWord).filter(Boolean);

    if (tWords.length === 0 || sWords.length === 0) return 0;

    let matchCount = 0;
    const matchedSIndices = new Set<number>();

    for (const tw of tWords) {
      let foundExact = false;
      for (let i = 0; i < sWords.length; i++) {
        if (!matchedSIndices.has(i) && sWords[i] === tw) {
          matchedSIndices.add(i);
          matchCount += 1.0;
          foundExact = true;
          break;
        }
      }
      if (!foundExact) {
        for (let i = 0; i < sWords.length; i++) {
          if (!matchedSIndices.has(i)) {
            const dist = levenshteinDistance(sWords[i], tw);
            if (dist <= 1 || (tw.length > 5 && dist <= 2)) {
              matchedSIndices.add(i);
              matchCount += 0.75;
              break;
            }
          }
        }
      }
    }

    const calculated = Math.round((matchCount / tWords.length) * 100);
    return Math.min(100, Math.max(10, calculated));
  }, []);

  // Start Mic Recording & Web Speech Recognition
  const startRecording = async () => {
    setSpeechError(null);
    setRecognizedText("");
    setSimilarityScore(null);
    stopAllAudio();
    userWaveformSamplesRef.current = [];
    setUserWaveform([]);
    lastSampleTimeRef.current = Date.now();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      micStreamRef.current = stream;

      // Audio Analyzer for live visualizer
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateMicVisual = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              const avg = sum / dataArray.length;
              const vol = Math.min(100, Math.round((avg / 128) * 100));
              setMicVolume(vol);

              // Sample waveform peaks (80 bars)
              const now = Date.now();
              if (now - lastSampleTimeRef.current >= 50) {
                lastSampleTimeRef.current = now;
                const norm = Math.max(0.12, Math.min(0.95, avg / 80));
                if (userWaveformSamplesRef.current.length < 80) {
                  userWaveformSamplesRef.current.push(parseFloat(norm.toFixed(2)));
                  setUserWaveform([...userWaveformSamplesRef.current]);
                } else {
                  userWaveformSamplesRef.current.push(parseFloat(norm.toFixed(2)));
                  const step = userWaveformSamplesRef.current.length / 80;
                  const resampled: number[] = [];
                  for (let b = 0; b < 80; b++) {
                    const idx = Math.floor(b * step);
                    resampled.push(userWaveformSamplesRef.current[idx] || 0.12);
                  }
                  setUserWaveform(resampled);
                }
              }

              animationFrameRef.current = requestAnimationFrame(updateMicVisual);
            }
          };
          updateMicVisual();
        }
      } catch (e) {
        console.warn("AudioContext visualizer error:", e);
      }

      // MediaRecorder to record user's audio file
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);

        // Decode genuine waveform (80 bars)
        const realWaves = await extractRealWaveform(audioBlob, 80);
        if (realWaves && realWaves.length > 0) {
          setUserWaveform(realWaves);
        }

        // Attach to current sentence state
        if (currentSentence) {
          setSentences((prev) =>
            prev.map((s) =>
              s.id === currentSentence.id
                ? {
                    ...s,
                    userAudioBlob: audioBlob,
                    userAudioUrl: url,
                    userWaveform: realWaves.length > 0 ? realWaves : userWaveform
                  }
                : s
            )
          );
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      // Web Speech Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        const langMap: Record<string, string> = {
          de: "de-DE",
          en: "en-US",
          fr: "fr-FR",
          es: "es-ES",
          ar: "ar-SA"
        };
        recognition.lang = langMap[language] || `${language}-${language.toUpperCase()}`;

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setRecognizedText(transcript);
          if (currentSentence) {
            const score = evaluatePronunciation(transcript, currentSentence.text);
            setSimilarityScore(score);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          if (event.error === "not-allowed") {
            setSpeechError("يرجى إعطاء الإذن للمتصفح باستخدام الميكروفون.");
          }
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {}
      }
    } catch (err) {
      console.error("Microphone access error:", err);
      setSpeechError("تعذر الوصول للميكروفون. يرجى التحقق من أذونات المتصفح.");
      setIsRecording(false);
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    setIsRecording(false);
    setMicVolume(0);

    if (recognizedText && currentSentence) {
      const finalScore = evaluatePronunciation(recognizedText, currentSentence.text);
      setSimilarityScore(finalScore);
      setSentences((prev) =>
        prev.map((s) =>
          s.id === currentSentence.id
            ? { ...s, recognizedText, accuracyScore: finalScore }
            : s
        )
      );
    }
  };

  // User waveform display normalization (80 bars)
  const displayUserWaveform = useMemo(() => {
    if (isRecording) {
      const bars = [...userWaveform];
      while (bars.length < 80) bars.push(0.12);
      return bars.slice(0, 80);
    }
    if (userWaveform.length > 0) {
      if (userWaveform.length === 80) return userWaveform;
      const step = userWaveform.length / 80;
      return Array.from({ length: 80 }, (_, i) => {
        const idx = Math.floor(i * step);
        return userWaveform[idx] || 0.12;
      });
    }
    return Array.from({ length: 80 }, () => 0.12);
  }, [isRecording, userWaveform]);

  // Target Words & Status Tokens
  const targetWords = useMemo(() => {
    return currentSentence ? currentSentence.text.split(/\s+/).filter(Boolean) : [];
  }, [currentSentence]);

  const recognizedCleanWords = useMemo(() => {
    return recognizedText.split(/\s+/).map(cleanWord).filter(Boolean);
  }, [recognizedText]);

  const getWordMatchStatus = (word: string): "correct" | "close" | "missing" | "untested" => {
    if (!recognizedText || similarityScore === null) return "untested";
    const cleaned = cleanWord(word);
    if (!cleaned) return "untested";

    if (recognizedCleanWords.includes(cleaned)) return "correct";
    const hasClose = recognizedCleanWords.some(
      (rw) => levenshteinDistance(rw, cleaned) <= 1 || (cleaned.length > 5 && levenshteinDistance(rw, cleaned) <= 2)
    );
    if (hasClose) return "close";
    return "missing";
  };

  // Save Session
  const handleSaveSession = () => {
    const newSession: ShadowingSession = {
      id: `session-${Date.now()}`,
      title: scriptTitle,
      language,
      provider,
      voiceId: selectedVoiceId,
      rawText,
      sentences,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [newSession, ...savedSessions.filter((s) => s.id !== newSession.id)];
    setSavedSessions(updated);
    localStorage.setItem("shadowing_studio_sessions", JSON.stringify(updated));
    showToast("تم حفظ جلسة الشادوينج بنجاح! 💾");
  };

  // Delete Session
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = savedSessions.filter((s) => s.id !== id);
    setSavedSessions(filtered);
    localStorage.setItem("shadowing_studio_sessions", JSON.stringify(filtered));
    showToast("تم حذف الجلسة.");
  };

  // Load Session
  const handleLoadSession = (session: ShadowingSession) => {
    setScriptTitle(session.title);
    setLanguage(session.language);
    setProvider(session.provider);
    setSelectedVoiceId(session.voiceId);
    setRawText(session.rawText);
    setSentences(session.sentences);
    setCurrentSentenceIndex(0);
    setActiveTab("practice");
    showToast(`تم تحميل جلسة: ${session.title}`);
  };

  // Load Preset
  const handleLoadPreset = (preset: typeof PRESET_SCRIPTS[0]) => {
    setScriptTitle(preset.title);
    setLanguage(preset.language);
    setRawText(preset.text);
    parseSentences(preset.text);
    setActiveTab("practice");
    showToast(`تم تحميل نموذج: ${preset.title}`);
  };

  // Export current sentence to Flashcards
  const handleExportCard = () => {
    if (!currentSentence || !onImportCard) return;
    onImportCard([
      {
        frontText: currentSentence.text,
        frontLang: language || "de",
        backText: currentSentence.translation || "",
        backLang: "ar"
      }
    ]);
    showToast("تمت إضافة الجملة إلى بطاقات الاستذكار! 🃏");
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans" dir="rtl">
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION / HEADER (Dark Studio Theme matching Video Modal) */}
      {/* ========================================================================= */}
      <header className="h-14 border-b border-slate-800/90 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 select-none z-30">
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="القائمة الجانبية"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">استوديو الشادوينج</h2>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onBackToLibrary && (
            <button
              type="button"
              onClick={onBackToLibrary}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="العودة للمكتبة"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-indigo-500/60 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-start">
        {/* ========================================================================= */}
        {/* VIEW 1: PRACTICE STUDIO (Exact visual parity with Video Shadowing Modal) */}
        {/* ========================================================================= */}
        {activeTab === "practice" && (
          <div className="w-full max-w-2xl flex flex-col gap-3.5 sm:gap-4 select-none">
            {/* Container Card Styled identically to Video Modal (Slate-900 / Slate-950) */}
            <div className="bg-slate-900 border border-slate-700/90 rounded-3xl p-4 sm:p-6 shadow-2xl text-slate-100 flex flex-col justify-between gap-3 sm:gap-4 text-right">
              {/* Card Header with sentence index, editor icon & LTR arrow buttons */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      استوديو الشادوينج
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
                  {/* Saved Sessions Icon Button */}
                  <button
                    type="button"
                    onClick={() => setShowSavedModal(true)}
                    className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center relative"
                    title={`المحفوظات (${savedSessions.length})`}
                    aria-label={`المحفوظات (${savedSessions.length})`}
                  >
                    <Bookmark className="w-4 h-4 text-amber-400" />
                    {savedSessions.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center">
                        {savedSessions.length}
                      </span>
                    )}
                  </button>

                  {/* Pre-Download All Audio Button (Placed right next to Saved Sessions) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (downloadProgress?.isRunning) {
                        handleCancelPreDownload();
                      } else {
                        handlePreDownloadAllAudio();
                      }
                    }}
                    disabled={sentences.length === 0}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center justify-center disabled:opacity-40 ${
                      downloadProgress?.isRunning
                        ? "bg-rose-950/70 border-rose-500/50 text-rose-300 hover:bg-rose-900"
                        : "bg-slate-800/90 hover:bg-slate-700 border-slate-700/80 text-emerald-400 hover:text-emerald-300"
                    }`}
                    title={downloadProgress?.isRunning ? "إيقاف التنزيل المسبق للأصوات" : "تنزيل وتخزين أصوات جميع الجمل مسبقاً"}
                    aria-label="تنزيل وتخزين أصوات جميع الجمل مسبقاً"
                  >
                    {downloadProgress?.isRunning ? (
                      <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 text-emerald-400" />
                    )}
                  </button>

                  {/* Single AI Translate All Button */}
                  <button
                    type="button"
                    onClick={() => handleTranslateAllWithAi()}
                    disabled={isTranslatingWithAi || sentences.length === 0}
                    className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-purple-400 hover:text-purple-300 transition-colors cursor-pointer flex items-center justify-center disabled:opacity-40"
                    title={`ترجمة جميع الجمل بالذكاء الاصطناعي (${aiTranslationModel})`}
                    aria-label={`ترجمة جميع الجمل بالذكاء الاصطناعي (${aiTranslationModel})`}
                  >
                    {isTranslatingWithAi ? (
                      <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                    ) : (
                      <Languages className="w-4 h-4 text-purple-400" />
                    )}
                  </button>

                  {/* AI Chat Icon Button for Current Sentence */}
                  <button
                    type="button"
                    onClick={() => {
                      if (currentSentence) {
                        setChatSentenceItem({
                          text: currentSentence.text,
                          translation: currentSentence.translation
                        });
                      }
                    }}
                    disabled={!currentSentence}
                    className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center disabled:opacity-40"
                    title="فتح شات ومناقشة الجملة الحالية مع الذكاء الاصطناعي"
                    aria-label="فتح شات ومناقشة الجملة الحالية مع الذكاء الاصطناعي"
                  >
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
                  </button>

                  {/* Text Editor Icon Button next to sentence navigation */}
                  <button
                    type="button"
                    onClick={() => setShowTextEditorModal(true)}
                    className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                    title="تحرير النص أو التقسيم"
                    aria-label="تحرير النص أو التقسيم"
                  >
                    <Edit3 className="w-4 h-4 text-indigo-400" />
                  </button>

                  {/* Audio Settings Icon Button next to sentence navigation */}
                  <button
                    type="button"
                    onClick={() => setShowVoiceSettingsModal(true)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center justify-center ${
                      showVoiceSettingsModal
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                        : "bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/80"
                    }`}
                    title="تخصيص وإعدادات الصوت وموديل الترجمة"
                    aria-label="تخصيص وإعدادات الصوت وموديل الترجمة"
                  >
                    <Sliders className="w-4 h-4 text-slate-300" />
                  </button>

                  {/* Sentence Navigation - Natural timeline LTR */}
                  <div className="flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700/80" dir="ltr">
                    <button
                      type="button"
                      disabled={currentSentenceIndex <= 0}
                      onClick={() => {
                        if (currentSentenceIndex > 0) {
                          setCurrentSentenceIndex((prev) => prev - 1);
                        }
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="الجملة السابقة (←)"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono font-bold px-2.5 text-slate-300 select-none">
                      {sentences.length > 0 ? currentSentenceIndex + 1 : 0} / {sentences.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentSentenceIndex >= sentences.length - 1}
                      onClick={() => {
                        if (currentSentenceIndex < sentences.length - 1) {
                          setCurrentSentenceIndex((prev) => prev + 1);
                        }
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="الجملة التالية (→)"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Pre-download Active Progress Notification Banner */}
              {downloadProgress?.isRunning && (
                <div className="p-3 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 flex items-center justify-between gap-3 text-xs text-emerald-200 animate-fadeIn">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>جاري تنزيل وتخزين أصوات الجمل مسبقاً:</span>
                        <span className="font-mono">
                          {downloadProgress.current} / {downloadProgress.total} (
                          {Math.round((downloadProgress.current / downloadProgress.total) * 100)}%)
                        </span>
                      </div>
                      {downloadProgress.currentSentence && (
                        <p className="text-[11px] text-emerald-300/80 truncate" dir="ltr">
                          {downloadProgress.currentSentence}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelPreDownload}
                    className="px-2.5 py-1 rounded-lg bg-emerald-900/80 hover:bg-rose-900 text-emerald-200 hover:text-rose-200 text-xs font-bold border border-emerald-600/50 transition-colors cursor-pointer shrink-0"
                  >
                    إلغاء
                  </button>
                </div>
              )}

              {/* Target Sentence Card */}
              <div className="min-h-36 shrink-0 p-3.5 sm:p-4 rounded-2xl bg-slate-950/60 border border-slate-800/90 relative flex flex-col justify-between overflow-hidden gap-2">
                {/* Timestamp & Info Tag */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono select-none shrink-0 pb-1.5 border-b border-slate-800/60">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      {formatTimeSeconds(modelAudioCurrentTime)} ➔ {formatTimeSeconds(modelAudioDuration || 2.5)}
                    </span>
                    <span className="text-slate-400">
                      ({(modelAudioDuration || 2.5).toFixed(1)}ث)
                    </span>
                  </div>
                </div>

                {/* Primary Sentence Text with Word Accuracy Highlights */}
                <div className="flex-1 my-1 space-y-2 flex flex-col justify-center">
                  <div
                    className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed select-text"
                    dir={detectDirection(currentSentence?.text || "")}
                  >
                    <p className="flex flex-wrap gap-x-2 gap-y-1 items-baseline">
                      {targetWords.map((word, idx) => {
                        const status = getWordMatchStatus(word);
                        if (status === "correct") {
                          return (
                            <span
                              key={idx}
                              className="text-emerald-400 font-bold underline decoration-emerald-400/50 underline-offset-4"
                            >
                              {word}
                            </span>
                          );
                        }
                        if (status === "close") {
                          return (
                            <span
                              key={idx}
                              className="text-amber-300 font-semibold underline decoration-amber-400/50 underline-offset-4"
                            >
                              {word}
                            </span>
                          );
                        }
                        if (status === "missing") {
                          return (
                            <span
                              key={idx}
                              className="text-rose-400/90 line-through decoration-rose-400/50"
                            >
                              {word}
                            </span>
                          );
                        }
                        return (
                          <span
                            key={idx}
                            className="text-slate-100 hover:text-sky-300 transition-colors"
                          >
                            {word}
                          </span>
                        );
                      })}
                    </p>
                  </div>

                  {/* Translation Display */}
                  {currentSentence?.translation ? (
                    <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <p
                        className="text-xs sm:text-sm text-purple-200 font-normal leading-relaxed select-text"
                        dir={detectDirection(currentSentence.translation)}
                      >
                        {currentSentence.translation}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                        ترجمة
                      </span>
                    </div>
                  ) : (
                    <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                      <span>لا توجد ترجمة مسجلة لهذه الجملة بعد.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Full-width Audio Sections (Identical Repetition Mode Layout) */}
              <div className="space-y-4">
                {/* SECTION 1: ORIGINAL AUDIO TRACK */}
                <div className="space-y-2">
                  {/* Toolbar */}
                  <div className="w-full flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80 flex-wrap" dir="ltr">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePlayModel()}
                        disabled={isGeneratingModelAudio}
                        className={`h-8 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                          isPlayingModel
                            ? "bg-sky-600 text-white shadow-sm shadow-sky-600/30"
                            : "bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white border border-slate-700"
                        }`}
                        title={isPlayingModel ? "إيقاف مؤقت" : "تشغيل المقطع"}
                      >
                        {isGeneratingModelAudio ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : isPlayingModel ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-sky-300" />
                        )}
                        <span>{isGeneratingModelAudio ? "تجهيز..." : isPlayingModel ? "إيقاف" : "تشغيل"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePlayModel(0)}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                        title="إعادة تشغيل من البداية"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const speeds = [0.5, 0.75, 1.0, 1.25];
                          const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
                          const newSpeed = speeds[nextIdx];
                          setPlaybackSpeed(newSpeed);
                          if (modelAudioRef.current) {
                            modelAudioRef.current.playbackRate = newSpeed;
                          }
                        }}
                        className="h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-mono font-bold transition-colors cursor-pointer"
                        title={`تغيير السرعة (الحالية: ${playbackSpeed}x)`}
                      >
                        {playbackSpeed}x
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsLoopingModel(!isLoopingModel)}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                          isLoopingModel
                            ? "bg-emerald-600 text-white border-emerald-400 shadow-sm"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700 hover:text-slate-200"
                        }`}
                        title={isLoopingModel ? "إيقاف التكرار التلقائي" : "تفعيل التكرار التلقائي"}
                      >
                        <Repeat className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (currentSentence) {
                            speakClient(currentSentence.text, language || "de");
                          }
                        }}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-sky-300 border border-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                        title="نطق نقي عبر الذكاء الاصطناعي (TTS)"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Time Readout */}
                    <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                      <span className="text-sky-400 font-bold">
                        {formatTimeSeconds(modelAudioCurrentTime)}
                      </span>
                      <span>/</span>
                      <span>{formatTimeSeconds(modelAudioDuration || 2.5)}</span>
                    </div>
                  </div>

                  {/* Full-width Waveform Track */}
                  <div
                    dir="ltr"
                    onClick={handleOriginalWaveformSeek}
                    className="relative w-full h-16 sm:h-20 bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 rounded-xl flex flex-row items-center justify-between px-2 gap-[2px] overflow-hidden group select-none cursor-pointer"
                    title="انقر لتحديد موضع التشغيل"
                  >
                    {/* Background Progress Fill */}
                    <div
                      className="absolute top-0 bottom-0 left-0 bg-sky-500/10 pointer-events-none"
                      style={{
                        width: `${modelAudioProgress}%`,
                        willChange: "width"
                      }}
                    />

                    {/* Smooth 60fps Laser Playhead Cursor */}
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)] pointer-events-none z-20"
                      style={{
                        left: `${modelAudioProgress}%`,
                        transform: "translateX(-50%)",
                        willChange: "left"
                      }}
                    />

                    {/* Waveform Bars (80 bars) */}
                    {originalWaveform.map((peak, idx) => {
                      const barFrac = ((idx + 0.5) / (originalWaveform.length || 80)) * 100;
                      const isPassed = isPlayingModel && barFrac <= modelAudioProgress;
                      return (
                        <div key={idx} className="flex-1 h-full flex items-center justify-center pointer-events-none">
                          <div
                            className={`w-full min-w-[2px] rounded-full transition-colors duration-75 ${
                              isPassed
                                ? "bg-sky-400 shadow-[0_0_4px_rgba(56,189,248,0.4)]"
                                : "bg-slate-700/60 group-hover:bg-slate-600/70"
                            }`}
                            style={{
                              height: `${Math.max(10, peak * 85)}%`
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SECTION 2: USER VOICE TRACK */}
                <div className="space-y-2">
                  {/* Toolbar */}
                  <div className="w-full flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80 flex-wrap" dir="ltr">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`h-8 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                          isRecording
                            ? "bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/40 animate-pulse"
                            : recordedAudioUrl
                            ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30"
                        }`}
                      >
                        {isRecording ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                            <MicOff className="w-3.5 h-3.5" />
                            <span>إيقاف التسجيل ({recordingSeconds}ث)</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5" />
                            <span>{recordedAudioUrl ? "إعادة التسجيل" : "تسجيل صوتك"}</span>
                          </>
                        )}
                      </button>

                      {recordedAudioUrl && !isRecording && (
                        <button
                          type="button"
                          onClick={handlePlayUserAudio}
                          className={`h-8 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                            isPlayingUserAudio
                              ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                              : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                          }`}
                          title={isPlayingUserAudio ? "إيقاف مؤقت" : "استماع لتسجيلك"}
                        >
                          {isPlayingUserAudio ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-emerald-300" />}
                          <span>{isPlayingUserAudio ? "إيقاف" : "استمع لتسجيلك"}</span>
                        </button>
                      )}

                      {recordedAudioUrl && !isRecording && (
                        <button
                          type="button"
                          onClick={() => {
                            stopAllAudio();
                            setRecordedAudioUrl(null);
                            setRecognizedText("");
                            setSimilarityScore(null);
                            setUserWaveform([]);
                            if (currentSentence) {
                              setSentences((prev) =>
                                prev.map((s) =>
                                  s.id === currentSentence.id
                                    ? { ...s, userAudioBlob: undefined, userAudioUrl: undefined, accuracyScore: undefined }
                                    : s
                                )
                              );
                            }
                          }}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 border border-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                          title="حذف التسجيل"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {similarityScore !== null && (
                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                        similarityScore >= 80
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : similarityScore >= 50
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}>
                        دقة النطق: {similarityScore}%
                      </span>
                    )}
                  </div>

                  {/* Full-width Waveform Track */}
                  <div
                    dir="ltr"
                    onClick={handleUserWaveformSeek}
                    className={`relative w-full h-16 sm:h-20 rounded-xl flex flex-row items-center justify-between px-2 gap-[2px] overflow-hidden select-none border transition-colors ${
                      isRecording
                        ? "bg-slate-950/80 border-rose-500/40 cursor-default"
                        : recordedAudioUrl
                        ? "bg-slate-950/60 border-slate-800 hover:border-slate-700/80 cursor-pointer"
                        : "bg-slate-950/40 border-slate-800/40 cursor-default"
                    }`}
                    title={recordedAudioUrl ? "انقر لتحديد موضع التشغيل" : ""}
                  >
                    {/* Background Progress Fill */}
                    {isPlayingUserAudio && (
                      <div
                        className="absolute top-0 bottom-0 left-0 bg-emerald-500/10 pointer-events-none"
                        style={{
                          width: `${userAudioProgress}%`,
                          willChange: "width"
                        }}
                      />
                    )}

                    {/* Smooth 60fps Laser Playhead Cursor */}
                    {isPlayingUserAudio && (
                      <div
                        className="absolute top-0 bottom-0 w-[2px] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] pointer-events-none z-20"
                        style={{
                          left: `${userAudioProgress}%`,
                          transform: "translateX(-50%)",
                          willChange: "left"
                        }}
                      />
                    )}

                    {/* Waveform Bars (80 bars) */}
                    {displayUserWaveform.map((peak, idx) => {
                      const barFrac = ((idx + 0.5) / displayUserWaveform.length) * 100;
                      const isPassed = isPlayingUserAudio && barFrac <= userAudioProgress;
                      return (
                        <div key={idx} className="flex-1 h-full flex items-center justify-center pointer-events-none">
                          <div
                            className={`w-full min-w-[2px] rounded-full transition-colors duration-75 ${
                              isRecording
                                ? "bg-rose-400/90"
                                : isPassed
                                ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.4)]"
                                : recordedAudioUrl
                                ? "bg-slate-700/60"
                                : "bg-slate-800/40"
                            }`}
                            style={{
                              height: `${Math.max(10, peak * 85)}%`
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Pronunciation Error Notice */}
              {speechError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{speechError}</span>
                </div>
              )}

              {/* Pronunciation Assessment & Feedback Box */}
              {similarityScore !== null && (
                <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                        similarityScore >= 80
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : similarityScore >= 50
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-slate-300">دقة النطق:</span>
                    <span
                      className={`font-mono font-bold ${
                        similarityScore >= 80
                          ? "text-emerald-400"
                          : similarityScore >= 50
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {similarityScore}%
                    </span>
                  </div>

                  {recognizedText && (
                    <span
                      className="text-[11px] text-purple-200/80 italic truncate max-w-[220px]"
                      dir={detectDirection(recognizedText)}
                      title={recognizedText}
                    >
                      "{recognizedText}"
                    </span>
                  )}
                </div>
              )}

              {/* Card Footer: Auto Advance, Export & Save Session */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex-wrap gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoAdvance}
                    onChange={(e) => setAutoAdvance(e.target.checked)}
                    className="rounded-sm bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0"
                  />
                  <span>انتقال تلقائي للجملة التالية</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveSession}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm shadow-indigo-600/30"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>حفظ الجلسة</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sentences Queue List (Dark themed) */}
            {sentences.length > 0 && (
              <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-xl space-y-3 text-right">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">
                      قائمة الجمل المجدولة للشادوينج ({sentences.length}):
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Text Editor Button */}
                    <button
                      type="button"
                      onClick={() => setShowTextEditorModal(true)}
                      className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 border border-slate-700/80 transition-colors cursor-pointer flex items-center justify-center"
                      title="تحرير النص أو التقسيم"
                      aria-label="تحرير النص أو التقسيم"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {sentences.map((sent, idx) => {
                    const isSelected = idx === currentSentenceIndex;
                    const isCached = !!cachedAudioKeys[sent.text];
                    return (
                      <div
                        key={sent.id}
                        onClick={() => {
                          stopAllAudio();
                          setCurrentSentenceIndex(idx);
                        }}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer group ${
                          isSelected
                            ? "bg-indigo-950/70 border-indigo-500/90 text-white font-medium shadow-sm"
                            : "bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/70 text-slate-300"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 font-bold mt-0.5 ${
                              isSelected ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {idx + 1}
                          </span>

                          <div className="min-w-0 flex-1 space-y-1 text-right">
                            <p className="text-xs text-slate-100 font-medium truncate select-text" dir="ltr">
                              {sent.text}
                            </p>
                            {sent.translation && (
                              <p
                                className="text-[11px] text-purple-300/80 truncate select-text"
                                dir={detectDirection(sent.translation)}
                              >
                                {sent.translation}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* User recording score if available */}
                        {sent.accuracyScore !== undefined && (
                          <span className="text-[10px] font-mono font-bold text-indigo-400 px-1 shrink-0">
                            {sent.accuracyScore}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Text Editor & Segmentation Modal */}
        {showTextEditorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-right">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">محرر نصوص الشادوينج</h3>
                    <p className="text-xs text-slate-400">الصق أي محادثة أو نص وسيتم تقسيمه تلقائياً إلى جمل للمحاكاة</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={scriptTitle}
                    onChange={(e) => setScriptTitle(e.target.value)}
                    placeholder="عنوان النص"
                    className="text-xs font-semibold bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 w-44 sm:w-60 text-slate-100 focus:outline-hidden focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTextEditorModal(false)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    title="إغلاق"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <textarea
                rows={10}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="اكتب أو الصق النص هنا..."
                className="w-full text-sm font-mono p-4 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 focus:outline-hidden focus:border-indigo-500 leading-relaxed"
                dir="ltr"
              />

              <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                <span className="text-xs text-slate-400">
                  الحروف: {rawText.length} | الكلمات: {rawText.trim().split(/\s+/).filter(Boolean).length}
                </span>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setRawText("")}
                    className="px-3 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
                  >
                    مسح
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      parseSentences(rawText);
                      setShowTextEditorModal(false);
                      setActiveTab("practice");
                      showToast("تم تقسيم النص وبدء التدريب! 🚀");
                    }}
                    disabled={!rawText.trim()}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    تقسيم النص فقط
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      parseSentences(rawText);
                      setShowTextEditorModal(false);
                      setActiveTab("practice");
                      showToast("تم تقسيم النص، جاري بدء الترجمة الذكية... ✨");
                      // Immediately trigger translation
                      setTimeout(() => {
                        handleTranslateAllWithAi();
                      }, 200);
                    }}
                    disabled={!rawText.trim()}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>تقسيم وترجمة فورية (AI)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Saved Sessions Modal */}
        {showSavedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-right max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                    <Bookmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">جلسات الشادوينج المحفوظة</h3>
                    <p className="text-xs text-slate-400">إجمالي الجلسات: {savedSessions.length}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSavedModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto pr-1 flex-1">
                {savedSessions.length === 0 ? (
                  <div className="border border-slate-800/80 rounded-2xl p-10 text-center space-y-3 bg-slate-950/40">
                    <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-300">لا توجد جلسات محفوظة بعد</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      أثناء التدريب في استوديو الشادوينج، اضغط على زر "حفظ الجلسة" لتتمكن من الرجوع إليها وممارسة نطقها في أي وقت.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {savedSessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => {
                          handleLoadSession(session);
                          setShowSavedModal(false);
                        }}
                        className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-4 hover:border-indigo-500/80 transition-all cursor-pointer space-y-2.5 group"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">
                            {session.title}
                          </h4>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(session.id, e)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                            title="حذف الجلسة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <p className="text-xs text-slate-400 line-clamp-2 select-text" dir="ltr">
                          {session.rawText}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 font-bold text-slate-300">
                              {session.language.toUpperCase()}
                            </span>
                            <span>{session.sentences?.length || 0} جمل</span>
                          </div>
                          <span className="font-mono">
                            {new Date(session.updatedAt).toLocaleDateString("ar-EG")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VOICE & TTS MODEL SETTINGS MODAL */}
        <ShadowingVoiceSettingsModal
          isOpen={showVoiceSettingsModal}
          onClose={() => setShowVoiceSettingsModal(false)}
          provider={provider}
          selectedVoiceId={selectedVoiceId}
          language={language}
          playbackSpeed={playbackSpeed}
          gradioUrl={gradioUrl}
          currentSentenceText={currentSentence?.text || ""}
          aiTranslationModel={aiTranslationModel}
          aiTargetLanguage={aiTargetLanguage}
          onSaveSettings={(newSettings) => {
            setProvider(newSettings.provider);
            setSelectedVoiceId(newSettings.selectedVoiceId);
            setLanguage(newSettings.language);
            setPlaybackSpeed(newSettings.playbackSpeed);
            setGradioUrl(newSettings.gradioUrl);
            setAiTranslationModel(newSettings.aiTranslationModel);
            setAiTargetLanguage(newSettings.aiTargetLanguage);

            // Persist preferences
            localStorage.setItem("shadowing_voice_provider", newSettings.provider);
            localStorage.setItem("shadowing_voice_id", newSettings.selectedVoiceId);
            localStorage.setItem("shadowing_language", newSettings.language);
            localStorage.setItem("shadowing_playback_speed", newSettings.playbackSpeed.toString());
            localStorage.setItem("settings_gradio_tts_url", newSettings.gradioUrl);
            localStorage.setItem("gradio_api_url", newSettings.gradioUrl);
            localStorage.setItem("shadowing_ai_translation_model", newSettings.aiTranslationModel);
            localStorage.setItem("shadowing_ai_target_lang", newSettings.aiTargetLanguage);

            // Invalidate audio cache
            audioCacheRef.current.clear();
            stopAllAudio();
            showToast(`تم تطبيق إعدادات الصوت والترجمة (${newSettings.aiTranslationModel}) 🎧`);
          }}
        />

        {/* VIEW: SAVED SESSIONS (Also kept for direct tab if triggered) */}
        {activeTab === "saved" && (
          <div className="w-full max-w-2xl space-y-4 text-right">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">جلسات الشادوينج المحفوظة:</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">إجمالي الجلسات: {savedSessions.length}</span>
                <button
                  type="button"
                  onClick={() => setActiveTab("practice")}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  العودة للاستوديو
                </button>
              </div>
            </div>

            {savedSessions.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
                <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-300">لا توجد جلسات محفوظة بعد</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  أثناء التدريب في استوديو الشادوينج، اضغط على زر "حفظ الجلسة" لتتمكن من الرجوع إليها وممارسة نطقها في أي وقت.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {savedSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleLoadSession(session)}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-indigo-500/80 transition-all cursor-pointer space-y-2.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">
                        {session.title}
                      </h4>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        title="حذف الجلسة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 select-text" dir="ltr">
                      {session.rawText}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 font-bold text-slate-300">
                          {session.language.toUpperCase()}
                        </span>
                        <span>{session.sentences?.length || 0} جمل</span>
                      </div>
                      <span className="font-mono">
                        {new Date(session.updatedAt).toLocaleDateString("ar-EG")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive AI Chat Modal for Selected Sentence */}
      {chatSentenceItem && (
        <ReviewChatModal
          isOpen={!!chatSentenceItem}
          onClose={() => setChatSentenceItem(null)}
          card={{
            id: "shadowing_sentence_" + Date.now(),
            frontText: chatSentenceItem.text,
            backText: chatSentenceItem.translation || "",
            germanText: chatSentenceItem.text,
            primaryText: chatSentenceItem.text,
            text: chatSentenceItem.text,
            arabicText: chatSentenceItem.translation || "",
            translation: chatSentenceItem.translation || "",
          }}
          folderInfo={{
            targetLanguage: language === "de" ? "German" : language === "en" ? "English" : language === "fr" ? "French" : language === "es" ? "Spanish" : "German",
            name: "استوديو الشادوينج - مناقشة جملة"
          }}
          onPlayPronunciation={(text) => speakClient(text, language || "de")}
        />
      )}
    </div>
  );
}

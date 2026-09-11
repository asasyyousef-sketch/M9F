import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Mic,
  MicOff,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sliders,
  Repeat,
  Headphones,
  Award,
  Loader2,
  Lightbulb,
  Radio,
  VolumeX,
  Languages,
  Copy,
  Check,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { SubtitleCue } from "../types";
import { formatSecondsToClock } from "../utils/subtitleParser";
import { speakClient } from "./Modals";

export interface ShadowingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  cue: SubtitleCue & { secondaryText?: string };
  allCues: SubtitleCue[];
  currentCueIndex: number;
  onSelectCue: (cue: SubtitleCue) => void;
  primaryLanguage?: string; // e.g. "de", "en", "fr"
  secondaryLanguage?: string; // e.g. "ar"
  onPlayOriginalSegment: (startTime: number, endTime: number, speed?: number) => void;
  onStopOriginalSegment: () => void;
  isPlayingOriginal: boolean;
  currentTime: number;
}

export const CONTINUOUS_LANGUAGES = [
  { code: "de-DE", label: "ألماني", flag: "🇩🇪" },
  { code: "en-US", label: "إنجليزي", flag: "🇺🇸" },
  { code: "fr-FR", label: "فرنسي", flag: "🇫🇷" },
  { code: "es-ES", label: "إسباني", flag: "🇪🇸" },
  { code: "it-IT", label: "إيطالي", flag: "🇮🇹" },
  { code: "tr-TR", label: "تركي", flag: "🇹🇷" },
  { code: "ar-SA", label: "عربي", flag: "🇸🇦" },
];

const getInitialContinuousLang = (primaryLang?: string): string => {
  if (!primaryLang) return "de-DE";
  const map: Record<string, string> = {
    de: "de-DE",
    en: "en-US",
    fr: "fr-FR",
    es: "es-ES",
    it: "it-IT",
    tr: "tr-TR",
    ar: "ar-SA"
  };
  return map[primaryLang.toLowerCase()] || "de-DE";
};

// Clean string for fuzzy comparison
function cleanWord(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»،؟]/g, "")
    .trim();
}

// Levenshtein distance for word-level match check
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
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

// Helper to determine text direction
function detectDirection(text: string): "rtl" | "ltr" {
  if (!text) return "ltr";
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text) ? "rtl" : "ltr";
}

export const ShadowingStudioModal: React.FC<ShadowingStudioModalProps> = ({
  isOpen,
  onClose,
  cue,
  allCues,
  currentCueIndex,
  onSelectCue,
  primaryLanguage = "de",
  secondaryLanguage = "ar",
  onPlayOriginalSegment,
  onStopOriginalSegment,
  isPlayingOriginal,
  currentTime
}) => {
  // Modes: "listen-repeat" (استمع ثم ردّد), "simultaneous" (محاكاة متزامنة), "loop" (تكرار تدريبي)
  const [shadowingMode, setShadowingMode] = useState<"listen-repeat" | "simultaneous" | "loop">("listen-repeat");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLoopingSegment, setIsLoopingSegment] = useState<boolean>(false);

  // Active View Tab: "simple" (الاستماع المستمر - مثل التصميم البسيط المطلوب) or "studio" (الاستوديو المتقدم)
  const [viewTab, setViewTab] = useState<"simple" | "studio">("simple");

  // Simple Continuous Speech Recognition State (نظام الاستماع المستمر المباشر)
  const [simpleListening, setSimpleListening] = useState<boolean>(false);
  const [simpleFinalTranscript, setSimpleFinalTranscript] = useState<string>("");
  const [simpleInterimTranscript, setSimpleInterimTranscript] = useState<string>("");
  const [simpleLog, setSimpleLog] = useState<string>("");
  const [simpleFontSize, setSimpleFontSize] = useState<number>(20);
  const [simpleLang, setSimpleLang] = useState<string>(() => getInitialContinuousLang(primaryLanguage));
  const [copiedSimpleTranscript, setCopiedSimpleTranscript] = useState<boolean>(false);

  const simpleRecognitionRef = useRef<any>(null);
  const manuallyStoppedRef = useRef<boolean>(true);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingUserAudio, setIsPlayingUserAudio] = useState<boolean>(false);
  const [userAudioProgress, setUserAudioProgress] = useState<number>(0);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [micVolume, setMicVolume] = useState<number>(0);

  // Speech Recognition & Scoring States
  const [recognizedText, setRecognizedText] = useState<string>("");
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // AI Pronunciation Coach States
  const [aiTips, setAiTips] = useState<string | null>(null);
  const [isLoadingAiTips, setIsLoadingAiTips] = useState<boolean>(false);
  const [showAiTips, setShowAiTips] = useState<boolean>(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const userAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const loopTimerRef = useRef<number | null>(null);

  // Start Continuous Speech Recognition (exact behavior, auto-reconnect and interim results from snippet)
  const startSimpleListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSimpleLog("متصفحك لا يدعم Web Speech API. جرّب Chrome أو Edge.");
      return;
    }

    manuallyStoppedRef.current = false;
    setSimpleLog("");

    if (simpleRecognitionRef.current) {
      try {
        simpleRecognitionRef.current.abort();
      } catch (e) {}
      simpleRecognitionRef.current = null;
    }

    function createRecognition() {
      if (manuallyStoppedRef.current) return null;
      const r = new SpeechRecognition();
      r.lang = simpleLang;
      r.continuous = true;
      r.interimResults = true;

      r.onstart = () => {
        setSimpleListening(true);
      };

      r.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setSimpleFinalTranscript((prev) => prev + transcript + " ");
          } else {
            interim += transcript;
          }
        }
        setSimpleInterimTranscript(interim);
      };

      r.onerror = (event: any) => {
        console.warn("Continuous SpeechRecognition error:", event.error);
        if (event.error !== "no-speech") {
          setSimpleLog("خطأ: " + event.error + (event.error === "not-allowed" ? " (يرجى السماح بالوصول للميكروفون)" : ""));
        }
      };

      // Chrome يوقف الجلسة تلقائيًا بعد سكوت طويل حتى مع continuous=true
      // هذا يعيد تشغيلها تلقائيًا بدون فقدان النص
      r.onend = () => {
        if (!manuallyStoppedRef.current) {
          const nextR = createRecognition();
          if (nextR) {
            simpleRecognitionRef.current = nextR;
            try {
              nextR.start();
            } catch (e) {
              setSimpleListening(false);
            }
          }
        } else {
          setSimpleListening(false);
        }
      };

      return r;
    }

    const rec = createRecognition();
    if (rec) {
      simpleRecognitionRef.current = rec;
      try {
        rec.start();
      } catch (e) {
        console.warn("Failed to start speech recognition:", e);
        setSimpleListening(false);
      }
    }
  }, [simpleLang]);

  // Stop Continuous Speech Recognition
  const stopSimpleListening = useCallback(() => {
    manuallyStoppedRef.current = true;
    if (simpleRecognitionRef.current) {
      try {
        simpleRecognitionRef.current.stop();
      } catch (e) {}
      simpleRecognitionRef.current = null;
    }
    setSimpleListening(false);
    setSimpleInterimTranscript("");
  }, []);

  // Clear Simple Transcript
  const clearSimpleTranscript = useCallback(() => {
    setSimpleFinalTranscript("");
    setSimpleInterimTranscript("");
    setSimpleLog("");
  }, []);

  // Copy recognized text
  const handleCopySimpleTranscript = () => {
    const textToCopy = (simpleFinalTranscript + " " + simpleInterimTranscript).trim();
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedSimpleTranscript(true);
      setTimeout(() => setCopiedSimpleTranscript(false), 2000);
    });
  };

  // Change Language in Simple Continuous Mode
  const handleSelectSimpleLanguage = (langCode: string) => {
    setSimpleLang(langCode);
    if (simpleListening) {
      stopSimpleListening();
      setTimeout(() => {
        startSimpleListening();
      }, 200);
    }
  };

  // Target sentence word tokens
  const targetWords = useMemo(() => cue.text.split(/\s+/).filter(Boolean), [cue.text]);

  // Check if target word is heard in simple transcript
  const isWordInSimpleTranscript = useCallback((targetWord: string) => {
    if (!simpleFinalTranscript) return false;
    const cleanedTarget = cleanWord(targetWord);
    if (!cleanedTarget) return false;
    const spokenWords = simpleFinalTranscript.split(/\s+/).map(cleanWord).filter(Boolean);
    if (spokenWords.includes(cleanedTarget)) return true;
    return spokenWords.some(
      (sw) => levenshteinDistance(sw, cleanedTarget) <= 1 || (cleanedTarget.length > 5 && levenshteinDistance(sw, cleanedTarget) <= 2)
    );
  }, [simpleFinalTranscript]);

  const matchedTargetWordCount = useMemo(() => {
    return targetWords.filter((w) => isWordInSimpleTranscript(w)).length;
  }, [targetWords, isWordInSimpleTranscript]);

  // Reset state when cue changes
  useEffect(() => {
    stopRecording();
    stopUserAudio();
    onStopOriginalSegment();
    setRecordedAudioUrl(null);
    setRecognizedText("");
    setSimilarityScore(null);
    setSpeechError(null);
    setAiTips(null);
    setShowAiTips(false);
    setIsLoopingSegment(false);
  }, [cue.id]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopSimpleListening();
      stopRecording();
      stopUserAudio();
      onStopOriginalSegment();
      if (loopTimerRef.current) {
        window.clearTimeout(loopTimerRef.current);
      }
      if (userAudioElementRef.current) {
        userAudioElementRef.current.pause();
        userAudioElementRef.current = null;
      }
    };
  }, [stopSimpleListening]);

  // Handle loop mode playback logic
  useEffect(() => {
    if (!isLoopingSegment) {
      if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current);
      return;
    }
    // If not currently playing, trigger play with 800ms pause between repeats
    if (!isPlayingOriginal && isLoopingSegment) {
      loopTimerRef.current = window.setTimeout(() => {
        if (isLoopingSegment) {
          onPlayOriginalSegment(cue.startTime, cue.endTime, playbackSpeed);
        }
      }, 750);
    }
    return () => {
      if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current);
    };
  }, [isLoopingSegment, isPlayingOriginal, cue.startTime, cue.endTime, playbackSpeed]);

  // Audio Playback progress calculation for Original Segment
  const segmentDuration = Math.max(0.2, cue.endTime - cue.startTime);
  const segmentProgress = Math.max(
    0,
    Math.min(100, ((currentTime - cue.startTime) / segmentDuration) * 100)
  );

  // Play Original Native Segment
  const handlePlayOriginal = () => {
    if (isPlayingOriginal) {
      onStopOriginalSegment();
      setIsLoopingSegment(false);
    } else {
      onPlayOriginalSegment(cue.startTime, cue.endTime, playbackSpeed);
    }
  };

  // Playback with TTS Fallback (if user wants clear studio voice)
  const handlePlayTtsFallback = () => {
    speakClient(cue.text, primaryLanguage || "de");
  };

  // Calculate Speech Similarity & Word Analysis
  const evaluatePronunciation = useCallback((spoken: string, target: string) => {
    const sWords = spoken.split(/\s+/).map(cleanWord).filter(Boolean);
    const tWords = target.split(/\s+/).map(cleanWord).filter(Boolean);

    if (tWords.length === 0) return 0;
    if (sWords.length === 0) return 0;

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
        // Try fuzzy / close match
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

  // Stop User Recorded Audio Playback
  const stopUserAudio = () => {
    if (userAudioElementRef.current) {
      userAudioElementRef.current.pause();
      userAudioElementRef.current.currentTime = 0;
    }
    setIsPlayingUserAudio(false);
    setUserAudioProgress(0);
  };

  // Play User's Recorded Voice
  const handlePlayUserAudio = () => {
    if (!recordedAudioUrl) return;
    if (isPlayingUserAudio) {
      stopUserAudio();
      return;
    }

    if (!userAudioElementRef.current) {
      const audio = new Audio(recordedAudioUrl);
      userAudioElementRef.current = audio;

      audio.onended = () => {
        setIsPlayingUserAudio(false);
        setUserAudioProgress(0);
      };

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setUserAudioProgress((audio.currentTime / audio.duration) * 100);
        }
      };
    } else {
      userAudioElementRef.current.src = recordedAudioUrl;
    }

    userAudioElementRef.current.play().then(() => {
      setIsPlayingUserAudio(true);
    }).catch(console.error);
  };

  // Start Mic Recording & Web Speech Recognition
  const startRecording = async () => {
    setSpeechError(null);
    setRecognizedText("");
    setSimilarityScore(null);
    stopUserAudio();

    // If simultaneous shadowing mode is on, play original audio at the exact same moment!
    if (shadowingMode === "simultaneous") {
      onPlayOriginalSegment(cue.startTime, cue.endTime, playbackSpeed);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
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
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
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

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);
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
        // Set speech language code based on primary language
        const langMap: Record<string, string> = {
          de: "de-DE",
          en: "en-US",
          fr: "fr-FR",
          es: "es-ES",
          it: "it-IT",
          ru: "ru-RU",
          ar: "ar-SA",
          tr: "tr-TR"
        };
        recognition.lang = langMap[primaryLanguage] || `${primaryLanguage}-${primaryLanguage.toUpperCase()}`;

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setRecognizedText(transcript);
          const score = evaluatePronunciation(transcript, cue.text);
          setSimilarityScore(score);
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
    } catch (err: any) {
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

    // Final evaluation if recognizedText exists
    if (recognizedText) {
      const finalScore = evaluatePronunciation(recognizedText, cue.text);
      setSimilarityScore(finalScore);
    }
  };

  // Fetch AI Pronunciation Coach Tips
  const handleFetchAiCoachTips = async () => {
    if (aiTips) {
      setShowAiTips(!showAiTips);
      return;
    }

    setIsLoadingAiTips(true);
    setShowAiTips(true);

    try {
      let apiKey = "";
      try {
        apiKey =
          localStorage.getItem("gemini_api_key") ||
          localStorage.getItem("settings_gemini_api_key") ||
          "";
      } catch (e) {}

      const prompt = `أنت خبير ومدرب محترف في تقنية الشادوينج (Shadowing) ومخارج الحروف واللكنة لمتعلمي اللغات.
الجملة المستهدفة: "${cue.text}"
الترجمة: "${cue.secondaryText || ""}"
اللغة الأصلية: ${primaryLanguage}

قدم للمتعلم نصائح سريعة ومباشرة باللغة العربية (في نقاط مختصرة وممتعة):
1. الكلمات الأكثر صعوبة في النطق وكيفية إخراج أصواتها وحروفها بدقة.
2. مواضع النبر (Stress) وإيقاع الجملة (Intonation) كما ينطقها المتحدث الأصلي.
3. سر ذهبي لإتقان هذه الجملة عبر الشادوينج.
اجعل النصيحة مركزة ومحفزة بدون إطالة.`;

      const res = await fetch("/api/ai/sentence-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentence: cue.text,
          secondaryText: cue.secondaryText || "",
          userPrompt: prompt,
          customApiKey: apiKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiTips(data.reply || data.text || "تم تحليل الجملة، احرص على تكرار المقطع ومحاكاة النبرة بدقة.");
      } else {
        setAiTips("نصيحة شادوينج: استمع للجملة بسرعات متدرجة (0.75x ثم 1.0x)، وركّز على نطق المقاطع المشددة مع محاكاة تنفس المتحدث.");
      }
    } catch (e) {
      setAiTips("نصيحة شادوينج: استمع للجملة بسرعات متدرجة (0.75x ثم 1.0x)، وركّز على نطق المقاطع المشددة مع محاكاة تنفس المتحدث.");
    } finally {
      setIsLoadingAiTips(false);
    }
  };

  // Word-level Visualizer Tokens
  const recognizedCleanWords = recognizedText.split(/\s+/).map(cleanWord).filter(Boolean);

  const getWordMatchStatus = (word: string): "correct" | "close" | "missing" | "untested" => {
    if (!recognizedText || similarityScore === null) return "untested";
    const cleaned = cleanWord(word);
    if (!cleaned) return "untested";

    if (recognizedCleanWords.includes(cleaned)) {
      return "correct";
    }
    const hasClose = recognizedCleanWords.some(
      (rw) => levenshteinDistance(rw, cleaned) <= 1 || (cleaned.length > 5 && levenshteinDistance(rw, cleaned) <= 2)
    );
    if (hasClose) return "close";
    return "missing";
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#1e1e2e] border border-slate-700/90 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl text-[#eee] flex flex-col gap-4 max-h-[92vh] overflow-y-auto animate-scaleUp text-right font-sans"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                  <span>استوديو الشادوينج والمحاكاة الصوتية</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Shadowing
                  </span>
                </h3>
              </div>
              <p className="text-[11px] text-slate-400">
                محاكاة النطق الأصلي، تسجيل صوتك، ومقارنة الأداء وفق المعايير القياسية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sentence Index & Navigation */}
            <div className="flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700">
              <button
                type="button"
                disabled={currentCueIndex <= 0}
                onClick={() => {
                  if (currentCueIndex > 0) {
                    onSelectCue(allCues[currentCueIndex - 1]);
                  }
                }}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="الجملة السابقة (السهم الأيمن)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono font-bold px-2 text-purple-300">
                {currentCueIndex + 1} / {allCues.length}
              </span>
              <button
                type="button"
                disabled={currentCueIndex >= allCues.length - 1}
                onClick={() => {
                  if (currentCueIndex < allCues.length - 1) {
                    onSelectCue(allCues[currentCueIndex + 1]);
                  }
                }}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="الجملة التالية (السهم الأيسر)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/70 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              stopRecording();
              setViewTab("simple");
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              viewTab === "simple"
                ? "bg-[#3498db] text-white shadow-md shadow-blue-500/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>الوضع البسيط (الاستماع المستمر)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              stopSimpleListening();
              setViewTab("studio");
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              viewTab === "studio"
                ? "bg-purple-600 text-white shadow-md shadow-purple-500/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>استوديو التحليل والتقييم المتقدم</span>
          </button>
        </div>

        {viewTab === "simple" ? (
          /* ========================================================================= */
          /* Simple Continuous Speech Recognition Mode (مطابق تماماً للشكل المطلوب)    */
          /* ========================================================================= */
          <div className="space-y-4 animate-fadeIn">
            {/* Header Title & Language Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <h1 className="text-base sm:text-[20px] font-bold text-white flex items-center gap-2">
                <span>🎤</span>
                <span>
                  تجربة الاستماع المستمر ({CONTINUOUS_LANGUAGES.find((l) => l.code === simpleLang)?.label || "ألماني"})
                </span>
              </h1>

              {/* Language Selector */}
              <div className="flex items-center gap-1 bg-[#2a2a3d] p-1 rounded-xl border border-slate-700/60">
                <Languages className="w-3.5 h-3.5 text-slate-400 ml-1 mr-1 shrink-0" />
                {CONTINUOUS_LANGUAGES.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => handleSelectSimpleLanguage(opt.code)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      simpleLang === opt.code
                        ? "bg-[#3498db] text-white shadow-xs"
                        : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                    }`}
                    title={opt.label}
                  >
                    <span>{opt.flag}</span>
                    <span className="mr-1">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Status & Stats */}
            <div className="flex items-center justify-between">
              <div>
                <span
                  id="status"
                  className={`inline-block px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                    simpleListening
                      ? "bg-[#2ecc71] text-black font-bold animate-pulse shadow-md shadow-emerald-500/20"
                      : "bg-[#444] text-[#ccc]"
                  }`}
                >
                  {simpleListening ? "يستمع الآن..." : "متوقف"}
                </span>
              </div>

              {/* Word Count / Matched counter */}
              <div className="text-xs text-slate-400 flex items-center gap-2 font-mono">
                <span>
                  الكلمات الملتقطة:{" "}
                  <strong className="text-blue-300">
                    {simpleFinalTranscript.trim() ? simpleFinalTranscript.trim().split(/\s+/).length : 0}
                  </strong>
                </span>
                {simpleFinalTranscript.trim() && (
                  <span className="text-emerald-400 font-bold mr-2">
                    ({matchedTargetWordCount} / {targetWords.length} من الجملة)
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons (ابدأ الاستماع / إيقاف / مسح) */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                id="startBtn"
                type="button"
                onClick={startSimpleListening}
                className="text-[16px] px-7 py-3 rounded-lg font-medium cursor-pointer transition-colors bg-[#3498db] hover:bg-[#2980b9] text-white shadow-md active:scale-95 flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>ابدأ الاستماع</span>
              </button>

              <button
                id="stopBtn"
                type="button"
                onClick={stopSimpleListening}
                className="text-[16px] px-7 py-3 rounded-lg font-medium cursor-pointer transition-colors bg-[#e74c3c] hover:bg-[#c0392b] text-white shadow-md active:scale-95 flex items-center gap-2"
              >
                <Pause className="w-4 h-4 fill-white" />
                <span>إيقاف</span>
              </button>

              <button
                id="clearBtn"
                type="button"
                onClick={clearSimpleTranscript}
                className="text-[16px] px-7 py-3 rounded-lg font-medium cursor-pointer transition-colors bg-slate-700 hover:bg-slate-600 text-white shadow-md active:scale-95 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>مسح</span>
              </button>

              {/* Font Size Zoom Controller */}
              <div className="mr-auto flex items-center gap-1.5 bg-[#2a2a3d] p-1 rounded-xl border border-slate-700/60 text-xs">
                <span className="text-[11px] text-slate-400 px-1 font-mono">حجم الكلمات:</span>
                <button
                  type="button"
                  onClick={() => setSimpleFontSize((prev) => Math.max(16, prev - 2))}
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="تصغير الخط"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold text-blue-300 px-1">{simpleFontSize}px</span>
                <button
                  type="button"
                  onClick={() => setSimpleFontSize((prev) => Math.min(32, prev + 2))}
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="تكبير الخط"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Target Sentence Card for Shadowing Practice (بما يناسب لكي ارى الكلمات) */}
            <div className="p-4 rounded-2xl bg-[#2a2a3d]/80 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-700/60">
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-bold text-slate-200">الجملة للمحاكاة والشادوينج:</span>
                  <span className="text-[11px] text-purple-300">
                    ({formatSecondsToClock(cue.startTime)} ➔ {formatSecondsToClock(cue.endTime)})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePlayOriginal}
                    className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isPlayingOriginal
                        ? "bg-indigo-600 text-white shadow-sm animate-pulse"
                        : "bg-slate-700/80 hover:bg-slate-700 text-slate-200"
                    }`}
                  >
                    {isPlayingOriginal ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlayingOriginal ? "إيقاف الأصلي" : "استماع للأصلي"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePlayTtsFallback}
                    className="text-xs px-3 py-1.5 rounded-xl font-bold bg-slate-700/80 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="نطق نقي عبر محرك الأصوات"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                    <span>نطق TTS</span>
                  </button>
                </div>
              </div>

              {/* Target Words with Real-time Detection Glow */}
              <div
                className="text-base sm:text-lg font-semibold text-white leading-relaxed select-text"
                dir={detectDirection(cue.text)}
              >
                <div className="flex flex-wrap gap-1.5">
                  {targetWords.map((word, idx) => {
                    const isMatched = isWordInSimpleTranscript(word);
                    return (
                      <span
                        key={idx}
                        className={`inline-block px-2.5 py-1 rounded-lg border text-base sm:text-lg transition-all ${
                          isMatched
                            ? "text-emerald-300 bg-emerald-950/90 border-emerald-500 font-bold shadow-md shadow-emerald-900/30 scale-105"
                            : "text-slate-200 bg-slate-800/80 border-slate-700"
                        }`}
                      >
                        {word}
                      </span>
                    );
                  })}
                </div>
              </div>

              {cue.secondaryText && (
                <div
                  className="pt-1 text-xs sm:text-sm text-emerald-300 font-medium leading-relaxed"
                  dir={detectDirection(cue.secondaryText)}
                >
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 ml-2">
                    الترجمة
                  </span>
                  {cue.secondaryText}
                </div>
              )}
            </div>

            {/* Live Output Box (#output) */}
            <div>
              <div className="flex items-center justify-between pb-1.5 text-xs text-slate-400">
                <span className="font-bold flex items-center gap-1.5 text-slate-300">
                  <span>النص المكتشف عبر الميكروفون المباشر:</span>
                </span>
                {simpleFinalTranscript && (
                  <button
                    type="button"
                    onClick={handleCopySimpleTranscript}
                    className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2 py-0.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {copiedSimpleTranscript ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSimpleTranscript ? "تم النسخ" : "نسخ النص"}</span>
                  </button>
                )}
              </div>

              <div
                id="output"
                className="p-5 min-h-[150px] bg-[#2a2a3d] rounded-[10px] leading-[1.8] text-left select-text border border-slate-700/60 overflow-y-auto max-h-[350px]"
                dir="ltr"
                style={{ fontSize: `${simpleFontSize}px` }}
              >
                {simpleFinalTranscript || simpleInterimTranscript ? (
                  <>
                    <span className="text-[#eee] font-medium whitespace-pre-wrap">{simpleFinalTranscript}</span>
                    {simpleInterimTranscript && (
                      <span className="interim text-[#888] italic ml-1.5 whitespace-pre-wrap">
                        {simpleInterimTranscript}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[#666] italic select-none">النص هيظهر هنا...</span>
                )}
              </div>
            </div>

            {/* Diagnostic Log Box (#log) */}
            <div id="log" className="text-[12px] text-[#888] mt-3 whitespace-pre-wrap font-mono min-h-[18px]">
              {simpleLog}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* Advanced Studio Mode                                                      */
          /* ========================================================================= */
          <>
            {/* Target Sentence Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-900 border border-slate-700/80 relative overflow-hidden space-y-3">
              {/* Timestamp and Duration Tag */}
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5 font-mono">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <span>
                    {formatSecondsToClock(cue.startTime)} ➔ {formatSecondsToClock(cue.endTime)}
                  </span>
                  <span className="text-slate-500">
                    ({(cue.endTime - cue.startTime).toFixed(1)} ثانية)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePlayTtsFallback}
                    className="text-[11px] font-bold text-slate-400 hover:text-purple-300 flex items-center gap-1 hover:bg-slate-700/60 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                    title="نطق نقي عبر محرك الأصوات الاصطناعية"
                  >
                    <Volume2 className="w-3 h-3 text-purple-400" />
                    <span>نطق TTS</span>
                  </button>
                </div>
              </div>

          {/* Primary Sentence Text (Word Tokens) */}
          <div
            className="text-base sm:text-lg font-semibold text-white leading-relaxed select-text"
            dir={detectDirection(cue.text)}
          >
            <div className="flex flex-wrap gap-1.5">
              {targetWords.map((word, idx) => {
                const status = getWordMatchStatus(word);
                let badgeStyle = "text-slate-100 bg-slate-800/60 border-slate-700/60";
                if (status === "correct") {
                  badgeStyle = "text-emerald-300 bg-emerald-950/80 border-emerald-500/80 font-bold shadow-xs";
                } else if (status === "close") {
                  badgeStyle = "text-amber-300 bg-amber-950/80 border-amber-500/80 font-bold";
                } else if (status === "missing") {
                  badgeStyle = "text-rose-300 bg-rose-950/70 border-rose-500/70";
                }

                return (
                  <span
                    key={idx}
                    className={`inline-block px-1.5 py-0.5 rounded-md border text-sm sm:text-base transition-all ${badgeStyle}`}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Secondary Translation Subtitle */}
          {cue.secondaryText && (
            <div
              className="pt-2.5 border-t border-slate-700/60 flex items-start gap-2"
              dir={detectDirection(cue.secondaryText)}
            >
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                الترجمة
              </span>
              <p className="text-xs sm:text-sm text-emerald-200 font-medium leading-relaxed">
                {cue.secondaryText}
              </p>
            </div>
          )}
        </div>

        {/* Shadowing Modes & Speed Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-800/50 border border-slate-700/60">
          {/* Mode Tabs */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setShadowingMode("listen-repeat");
                setIsLoopingSegment(false);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                shadowingMode === "listen-repeat"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/60"
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>استمع ثم ردّد</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShadowingMode("simultaneous");
                setIsLoopingSegment(false);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                shadowingMode === "simultaneous"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/60"
              }`}
              title="يبدأ تشغيل الصوت الأصلي والتسجيل معاً في نفس اللحظة لمحاكاة النطق المباشر"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>شادوينج متزامن</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShadowingMode("loop");
                setIsLoopingSegment(true);
                onPlayOriginalSegment(cue.startTime, cue.endTime, playbackSpeed);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                shadowingMode === "loop"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/60"
              }`}
              title="تكرار تشغيل الجملة الأصلية باستمرار لترويض الأذن وتثبيت النغمات"
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>تكرار مستمر</span>
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[11px] text-slate-400 font-bold ml-1">السرعة:</span>
            {[0.75, 0.9, 1.0].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPlaybackSpeed(s)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  playbackSpeed === s
                    ? "bg-purple-500/30 text-purple-200 border border-purple-500/50"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Audio Action Hub (Original Player & Mic Recording Side-by-Side) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card 1: Original Audio Model */}
          <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/70 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-indigo-400" />
                <span>صوت المتحدث الأصلي</span>
              </span>
              {isPlayingOriginal && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  جارٍ التشغيل...
                </span>
              )}
            </div>

            {/* Original Progress Timeline */}
            <div className="w-full bg-slate-950/80 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-full transition-all duration-100 ease-linear rounded-full"
                style={{ width: `${isPlayingOriginal ? segmentProgress : 0}%` }}
              />
            </div>

            <button
              type="button"
              onClick={handlePlayOriginal}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isPlayingOriginal
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-700 hover:bg-slate-600 text-white"
              }`}
            >
              {isPlayingOriginal ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>إيقاف المقطع الأصلي</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>استماع للمتحدث الأصلي ({playbackSpeed}x)</span>
                </>
              )}
            </button>
          </div>

          {/* Card 2: Voice Recording & User Mic */}
          <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/70 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-purple-400" />
                <span>تسجيل صوتك ومحاكاتك</span>
              </span>
              {isRecording ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  جارٍ التسجيل ({recordingSeconds} ث)
                </span>
              ) : recordedAudioUrl ? (
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  تم التسجيل بنجاح
                </span>
              ) : null}
            </div>

            {/* Mic Live Volume Level Bar */}
            <div className="w-full bg-slate-950/80 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-75 rounded-full ${
                  isRecording ? "bg-purple-500" : "bg-transparent"
                }`}
                style={{ width: `${isRecording ? Math.max(5, micVolume) : 0}%` }}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isRecording
                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 animate-pulse"
                    : "bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/25"
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>إنهاء التسجيل</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>{recordedAudioUrl ? "إعادة التسجيل" : "ابدأ التسجيل والمحاكاة"}</span>
                  </>
                )}
              </button>

              {/* Play Recorded Voice Button */}
              {recordedAudioUrl && !isRecording && (
                <button
                  type="button"
                  onClick={handlePlayUserAudio}
                  className={`p-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center ${
                    isPlayingUserAudio
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                      : "bg-slate-700 hover:bg-slate-600 text-emerald-300"
                  }`}
                  title="الاستماع لتسجيلك الصوتي ومقارنته"
                >
                  {isPlayingUserAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Pronunciation Assessment & Feedback Box */}
        {speechError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{speechError}</span>
          </div>
        )}

        {similarityScore !== null && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-800/80 to-slate-800/80 border border-purple-500/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                    similarityScore >= 80
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : similarityScore >= 50
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  }`}
                >
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white">دقة المحاكاة والنطق:</span>
                  <span
                    className={`font-mono font-black text-sm mr-2 ${
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
              </div>

              <span className="text-xs font-bold text-slate-300">
                {similarityScore >= 85
                  ? "🌟 نطق متقن ورائع!"
                  : similarityScore >= 65
                  ? "👍 أداء جيد جداً، واصل الترديد"
                  : "🔄 كرر المحاكاة مع السرعة البطيئة"}
              </span>
            </div>

            {/* Recognized Words Preview */}
            {recognizedText && (
              <div className="pt-2 border-t border-slate-700/60 text-xs text-slate-300">
                <span className="text-slate-400 ml-1.5 font-bold text-[11px]">ما تم التقاطه:</span>
                <span className="italic font-medium text-purple-200" dir={detectDirection(recognizedText)}>
                  "{recognizedText}"
                </span>
              </div>
            )}
          </div>
        )}

        {/* AI Pronunciation Coach Advice (Collapsible) */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleFetchAiCoachTips}
            className="w-full py-2 px-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-xs transition-colors flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>نصائح وتوجيهات الذكاء الاصطناعي لمخارج هذه الجملة (Pronunciation Coach)</span>
            </span>
            {isLoadingAiTips ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
            ) : (
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            )}
          </button>

          {showAiTips && aiTips && (
            <div className="mt-2 p-3.5 rounded-xl bg-slate-950/80 border border-purple-500/20 text-xs text-slate-200 leading-relaxed space-y-1.5 animate-fadeIn">
              <div className="whitespace-pre-line text-slate-300 font-sans">
                {aiTips}
              </div>
            </div>
          )}
        </div>
        </>
      )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-[11px] text-slate-400">
          {viewTab === "simple" ? (
            <div className="flex items-center gap-2 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block animate-pulse"></span>
              <span>نظام Web Speech API للاستماع المستمر والتعرف التلقائي مع تتبع الكلمات</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                أخضر = سليم
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                أصفر = تقريبي
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
                أحمر = مفقود
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

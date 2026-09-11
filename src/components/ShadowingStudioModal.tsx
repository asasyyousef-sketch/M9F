import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Activity,
  Globe,
  Waves,
  ExternalLink,
  RefreshCw,
  Zap,
  Copy,
  Trash2
} from "lucide-react";
import { SubtitleCue } from "../types";
import { formatSecondsToClock } from "../utils/subtitleParser";
import { speakClient } from "./Modals";

export const SUPPORTED_SPEECH_LANGS = [
  { code: "de-DE", label: "الألمانية (Deutsch)", flag: "🇩🇪" },
  { code: "en-US", label: "الإنجليزية (English - US)", flag: "🇺🇸" },
  { code: "en-GB", label: "الإنجليزية (English - UK)", flag: "🇬🇧" },
  { code: "fr-FR", label: "الفرنسية (Français)", flag: "🇫🇷" },
  { code: "es-ES", label: "الإسبانية (Español)", flag: "🇪🇸" },
  { code: "it-IT", label: "الإيطالية (Italiano)", flag: "🇮🇹" },
  { code: "ru-RU", label: "الروسية (Русский)", flag: "🇷🇺" },
  { code: "ar-SA", label: "العربية (العالم العربي)", flag: "🇸🇦" },
  { code: "tr-TR", label: "التركية (Türkçe)", flag: "🇹🇷" },
  { code: "ja-JP", label: "اليابانية (日本語)", flag: "🇯🇵" },
  { code: "zh-CN", label: "الصينية (中文)", flag: "🇨🇳" },
];

export function resolveSpeechLang(lang?: string): string {
  const code = (lang || "").toLowerCase();
  if (code.startsWith("de")) return "de-DE";
  if (code.startsWith("en")) return "en-US";
  if (code.startsWith("fr")) return "fr-FR";
  if (code.startsWith("es")) return "es-ES";
  if (code.startsWith("it")) return "it-IT";
  if (code.startsWith("ru")) return "ru-RU";
  if (code.startsWith("ar")) return "ar-SA";
  if (code.startsWith("tr")) return "tr-TR";
  if (code.startsWith("ja")) return "ja-JP";
  if (code.startsWith("zh")) return "zh-CN";
  return "de-DE";
}

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

  // Audio Recording States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingUserAudio, setIsPlayingUserAudio] = useState<boolean>(false);
  const [userAudioProgress, setUserAudioProgress] = useState<number>(0);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [micVolume, setMicVolume] = useState<number>(0);

  // Studio Primary Tabs: "qtranslate-live" (استماع لايف مثل QTranslate) vs "recording-studio" (استوديو التسجيل والمحاكاة)
  const [studioTab, setStudioTab] = useState<"qtranslate-live" | "recording-studio">("qtranslate-live");
  const [liveEngine, setLiveEngine] = useState<"fast-server" | "web-speech">("fast-server");
  const [isLiveListening, setIsLiveListening] = useState<boolean>(false);
  const isLiveListeningRef = useRef<boolean>(false);
  const liveFinalTextRef = useRef<string>("");

  // Speech Recognition & Scoring States
  const [selectedSpeechLang, setSelectedSpeechLang] = useState<string>(() => resolveSpeechLang(primaryLanguage));
  const [interimText, setInterimText] = useState<string>("");
  const [finalText, setFinalText] = useState<string>("");
  const [isSpeechListening, setIsSpeechListening] = useState<boolean>(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(true);
  const [recognizedText, setRecognizedText] = useState<string>("");
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Fast Cloud STT / Server Fallback States (Like QTranslate)
  const [isTranscribingWithServer, setIsTranscribingWithServer] = useState<boolean>(false);
  const [transcriptionNotice, setTranscriptionNotice] = useState<string | null>(null);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const lastRecordedBlobRef = useRef<Blob | null>(null);

  // AI Pronunciation Coach States
  const [aiTips, setAiTips] = useState<string | null>(null);
  const [isLoadingAiTips, setIsLoadingAiTips] = useState<boolean>(false);
  const [showAiTips, setShowAiTips] = useState<boolean>(false);

  // Refs
  const isRecordingRef = useRef<boolean>(false);
  const recognizedTextRef = useRef<string>("");
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

  // Detect iframe environment (Crucial for Chromium Web Speech API permission handling)
  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }
  }, []);

  // Synchronize language when primaryLanguage prop changes
  useEffect(() => {
    setSelectedSpeechLang(resolveSpeechLang(primaryLanguage));
  }, [primaryLanguage]);

  // Check Web Speech API support
  useEffect(() => {
    const hasSR = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    setIsSpeechSupported(hasSR);
  }, []);

  // Reset state when cue changes
  useEffect(() => {
    stopLiveListening();
    stopRecording();
    stopUserAudio();
    onStopOriginalSegment();
    setRecordedAudioUrl(null);
    clearLiveText();
    setSpeechError(null);
    setAiTips(null);
    setShowAiTips(false);
    setIsLoopingSegment(false);
  }, [cue.id]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopLiveListening();
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
  }, []);

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

  // Clear recognized live text
  const clearLiveText = () => {
    liveFinalTextRef.current = "";
    setRecognizedText("");
    recognizedTextRef.current = "";
    setInterimText("");
    setFinalText("");
    setSimilarityScore(null);
  };

  // Start Fast Server Live Listening (Works in 100% of browsers, iframes, networks, and countries)
  const startFastLiveListening = async () => {
    setSpeechError(null);
    stopRecording();
    stopUserAudio();
    onStopOriginalSegment();
    clearLiveText();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      // Realtime Audio Volume Meter
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

      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: mediaRecorder.mimeType || "audio/webm",
          });
          lastRecordedBlobRef.current = audioBlob;
          const url = URL.createObjectURL(audioBlob);
          setRecordedAudioUrl(url);
          // Transcribe immediately with our ultra-fast server
          transcribeAudioWithServer(audioBlob);
        }
      };

      mediaRecorder.start(250);
      setIsLiveListening(true);
      isLiveListeningRef.current = true;
    } catch (err: any) {
      console.error("Fast live listening start error:", err);
      setIsLiveListening(false);
      isLiveListeningRef.current = false;
      setSpeechError("تعذر الوصول للميكروفون: " + (err?.message || "يرجى منح إذن الميكروفون للمتصفح (Allow Microphone)."));
    }
  };

  const stopFastLiveListening = () => {
    setIsLiveListening(false);
    isLiveListeningRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setMicVolume(0);
  };

  // Google Web Speech Live Recognition (Direct continuous mode)
  const startGoogleLiveListening = () => {
    setSpeechError(null);
    stopRecording();
    stopUserAudio();
    onStopOriginalSegment();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      setLiveEngine("fast-server");
      setSpeechError(
        "متصفحك لا يدعم محرك Web Speech. تم تحويلك تلقائياً إلى المحرك الصامد فائق السرعة الذي يعمل في كل مكان!"
      );
      startFastLiveListening();
      return;
    }

    // Stop any existing recognition cleanly
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = selectedSpeechLang;

      recognition.onstart = () => {
        setIsLiveListening(true);
        isLiveListeningRef.current = true;
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          const transcript = item[0].transcript;
          if (item.isFinal) {
            finalChunk += transcript + " ";
          } else {
            currentInterim += transcript;
          }
        }

        if (finalChunk) {
          liveFinalTextRef.current = (liveFinalTextRef.current ? liveFinalTextRef.current + " " : "") + finalChunk.trim();
        }

        const combined = (liveFinalTextRef.current + " " + currentInterim).trim();
        setRecognizedText(combined);
        recognizedTextRef.current = combined;
        setInterimText(currentInterim);
        setFinalText(liveFinalTextRef.current);

        if (combined) {
          const score = evaluatePronunciation(combined, cue.text);
          setSimilarityScore(score);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Live Speech recognition error:", event.error);
        if (event.error === "no-speech") {
          return;
        }
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setIsLiveListening(false);
          isLiveListeningRef.current = false;
          setSpeechError(
            isInIframe
              ? "يمنع متصفح Chrome محرك Google Speech داخل شاشة المعاينة. يمكنك استخدام 'المحرك الصامد فائق السرعة' أدناه، فهو يعمل في كل مكان!"
              : "لم يتم منح إذن الميكروفون للمتصفح. انقر على أيقونة الإعدادات/القفل بجوار الرابط وتأكد من تفعيل الميكروفون (Allow)."
          );
        } else if (event.error === "network") {
          setSpeechError(
            "خدمة Google Speech تعذّر الاتصال بها على شبكتك (قيود جدار ناري أو بلد). نقترح استخدام 'المحرك الصامد فائق السرعة' أعلاه فوراً."
          );
        } else {
          setSpeechError(`تنبيه: ${event.error}. يمكنك التبديل إلى المحرك الصامد فائق السرعة بنقرة واحدة.`);
        }
      };

      recognition.onend = () => {
        if (isLiveListeningRef.current) {
          setTimeout(() => {
            if (isLiveListeningRef.current) {
              try {
                const freshRec = new SpeechRecognition();
                freshRec.continuous = true;
                freshRec.interimResults = true;
                freshRec.maxAlternatives = 1;
                freshRec.lang = selectedSpeechLang;
                freshRec.onstart = recognition.onstart;
                freshRec.onresult = recognition.onresult;
                freshRec.onerror = recognition.onerror;
                freshRec.onend = recognition.onend;
                freshRec.start();
                recognitionRef.current = freshRec;
              } catch (e) {
                console.warn("Speech recognition restart error:", e);
              }
            }
          }, 100);
        } else {
          setIsLiveListening(false);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsLiveListening(true);
      isLiveListeningRef.current = true;
    } catch (err: any) {
      console.error("Failed to start Google live listening:", err);
      setIsLiveListening(false);
      isLiveListeningRef.current = false;
      setSpeechError("تعذر بدء محرك Google Web Speech: " + (err?.message || ""));
    }
  };

  // Unified Live Listening Toggle
  const toggleLiveListening = () => {
    if (isLiveListening) {
      if (liveEngine === "fast-server") {
        stopFastLiveListening();
      } else {
        stopLiveListening();
      }
    } else {
      if (liveEngine === "fast-server") {
        startFastLiveListening();
      } else {
        startGoogleLiveListening();
      }
    }
  };

  // Stop Live Listening (both engines)
  const stopLiveListening = () => {
    isLiveListeningRef.current = false;
    setIsLiveListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    stopFastLiveListening();
  };

  // Start Mic Recording & Web Speech Recognition
  const startRecording = async () => {
    setSpeechError(null);
    setRecognizedText("");
    setFinalText("");
    setInterimText("");
    recognizedTextRef.current = "";
    setSimilarityScore(null);
    stopUserAudio();
    isRecordingRef.current = true;

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
        lastRecordedBlobRef.current = audioBlob;
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);

        // Fallback: If Web Speech did not yield recognized words (e.g. iframe sandbox or Firefox), auto-transcribe!
        const currentText = (recognizedTextRef.current || "").trim();
        if (!currentText && audioBlob.size > 2000) {
          transcribeAudioWithServer(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      // Web Speech Recognition (Google Speech Engine in Chrome/Edge/Android)
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = selectedSpeechLang;

        recognition.onstart = () => {
          setIsSpeechListening(true);
          setSpeechError(null);
        };

        recognition.onresult = (event: any) => {
          let final = "";
          let interim = "";
          for (let i = 0; i < event.results.length; i++) {
            const item = event.results[i];
            if (item.isFinal) {
              final += item[0].transcript + " ";
            } else {
              interim += item[0].transcript;
            }
          }
          const cleanFinal = final.trim();
          const cleanInterim = interim.trim();
          setFinalText(cleanFinal);
          setInterimText(cleanInterim);

          const full = (final + interim).trim();
          recognizedTextRef.current = full;
          setRecognizedText(full);

          if (full) {
            const score = evaluatePronunciation(full, cue.text);
            setSimilarityScore(score);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          if (event.error === "no-speech") {
            // Silence or brief pause - ignore silently and let it continue listening
            return;
          }
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            setSpeechError(
              isInIframe
                ? "يمنع المتصفح محرك Google Web Speech المباشر داخل إطار المعاينة (Iframe). اضغط على 'فتح في نافذة مستقلة' أعلاه ليعمل فوراً، أو سيقوم النظام بتفريغ صوتك تلقائياً عند إنهاء التسجيل."
                : "يرجى منح إذن الميكروفون للمتصفح."
            );
          } else if (event.error === "network") {
            setSpeechError("تعذر الاتصال بخدمة Google للتعرف الصوتي، سيتم تفريغ الصوت عبر المحرك البديل تلقائياً.");
          }
        };

        recognition.onend = () => {
          setIsSpeechListening(false);
          // If the user is still actively recording, restart recognition cleanly with a fresh instance
          if (isRecordingRef.current) {
            try {
              const freshRec = new SpeechRecognition();
              freshRec.continuous = true;
              freshRec.interimResults = true;
              freshRec.maxAlternatives = 1;
              freshRec.lang = selectedSpeechLang;
              freshRec.onresult = recognition.onresult;
              freshRec.onerror = recognition.onerror;
              freshRec.onend = recognition.onend;
              freshRec.start();
              recognitionRef.current = freshRec;
              setIsSpeechListening(true);
            } catch (e) {
              console.warn("Speech recognition restart failed:", e);
            }
          }
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.warn("Recognition start failed:", e);
        }
      } else {
        setIsSpeechSupported(false);
      }
    } catch (err: any) {
      console.error("Microphone access error:", err);
      setSpeechError("تعذر الوصول للميكروفون. يرجى التحقق من أذونات المتصفح.");
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  // Fast Server Speech Transcription (Works in all browsers, iframes, Firefox, Chrome, Safari)
  const transcribeAudioWithServer = async (audioBlob: Blob) => {
    if (!audioBlob || audioBlob.size < 500) return;
    setIsTranscribingWithServer(true);
    setTranscriptionNotice("جاري استخراج الكلمات المنطوقة من تسجيلك الصوتي بدقة وسرعة...");
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const dataUrl = await base64Promise;

      let customApiKey = "";
      try {
        customApiKey =
          localStorage.getItem("gemini_api_key") ||
          sessionStorage.getItem("gemini_api_key") ||
          "";
      } catch (e) {}

      const res = await fetch("/api/shadowing/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: dataUrl,
          mimeType: audioBlob.type || "audio/webm",
          language: selectedSpeechLang,
          targetSentence: cue.text,
          customApiKey,
        }),
      });

      const data = await res.json();
      if (data.text) {
        const cleanText = data.text.trim();
        setFinalText(cleanText);
        setInterimText("");
        setRecognizedText(cleanText);
        recognizedTextRef.current = cleanText;
        const score = evaluatePronunciation(cleanText, cue.text);
        setSimilarityScore(score);
        setTranscriptionNotice("✅ تم تفريغ الكلمات بنجاح ومطابقتها مع النص!");
      } else {
        setTranscriptionNotice("لم يتم رصد كلمات واضحة في التسجيل الصوتي.");
      }
    } catch (err: any) {
      console.error("Transcription error:", err);
      setTranscriptionNotice("تعذر التفريغ التلقائي، يمكنك إعادة المحاولة بالضغط على زر التفريغ السريع.");
    } finally {
      setIsTranscribingWithServer(false);
    }
  };

  // Stop Recording
  const stopRecording = () => {
    isRecordingRef.current = false;
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
    setIsSpeechListening(false);
    setMicVolume(0);

    // Final evaluation with latest recognized speech
    const latestText = (recognizedTextRef.current || recognizedText).trim();
    if (latestText) {
      const finalScore = evaluatePronunciation(latestText, cue.text);
      setSimilarityScore(finalScore);
    } else if (lastRecordedBlobRef.current && lastRecordedBlobRef.current.size > 2000) {
      // If Web Speech API didn't pick up speech, fallback to server transcription immediately
      transcribeAudioWithServer(lastRecordedBlobRef.current);
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
  const targetWords = cue.text.split(/\s+/).filter(Boolean);
  const currentFullSpeech = (recognizedTextRef.current || recognizedText || "").trim();
  const recognizedCleanWords = currentFullSpeech.split(/\s+/).map(cleanWord).filter(Boolean);

  const getWordMatchStatus = (word: string): "correct" | "close" | "missing" | "untested" => {
    if (!currentFullSpeech) return "untested";
    const cleaned = cleanWord(word);
    if (!cleaned) return "untested";

    if (recognizedCleanWords.includes(cleaned)) {
      return "correct";
    }
    const hasClose = recognizedCleanWords.some(
      (rw) => levenshteinDistance(rw, cleaned) <= 1 || (cleaned.length > 5 && levenshteinDistance(rw, cleaned) <= 2)
    );
    if (hasClose) return "close";

    // While recording is in progress, words not yet spoken remain pending (untested)
    if (isRecording) {
      return "untested";
    }
    return "missing";
  };

  const matchedWordsCount = targetWords.filter((w) => {
    const s = getWordMatchStatus(w);
    return s === "correct" || s === "close";
  }).length;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/90 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl text-slate-100 flex flex-col gap-4 max-h-[92vh] overflow-y-auto animate-scaleUp text-right"
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

        {/* Iframe tip banner: Explains why Web Speech API behaves in preview and gives 1-click open in new tab */}
        {isInIframe && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/80 via-indigo-950/70 to-slate-900 border border-purple-500/50 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-purple-200 shadow-lg">
            <div className="flex items-start sm:items-center gap-3">
              <span className="text-2xl shrink-0">🌐</span>
              <div className="leading-snug">
                <span className="font-bold text-white text-xs sm:text-sm">كيف يعمل الاستماع اللحظي (مثل QTranslate)؟</span>
                <p className="text-[11px] text-purple-300/90 mt-0.5 max-w-xl">
                  متصفحك (Chrome/Edge) يمنع الميكروفون المباشر داخل شاشة المعاينة المصغّرة. افتح التطبيق في <strong>صفحة متصفح مستقلة (New Tab)</strong> وسيعمل معك الاستماع اللحظي وبناء الجمل فوراً!
                </p>
              </div>
            </div>
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all shrink-0 cursor-pointer text-center"
              title="فتح التطبيق في صفحة متصفح جديدة مستقلة"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span>افتح في تبويب جديد (اضغط هنا)</span>
            </a>
          </div>
        )}

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
              {(isRecording || isLiveListening) && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold animate-pulse flex items-center gap-1 mr-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  مطابقة حية: {matchedWordsCount}/{targetWords.length}
                </span>
              )}
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
                  badgeStyle = "text-emerald-300 bg-emerald-950/90 border-emerald-400 font-bold shadow-sm shadow-emerald-500/20 ring-1 ring-emerald-500/50 scale-[1.02]";
                } else if (status === "close") {
                  badgeStyle = "text-amber-300 bg-amber-950/80 border-amber-500/80 font-bold";
                } else if (status === "missing") {
                  badgeStyle = "text-rose-300 bg-rose-950/70 border-rose-500/70";
                }

                return (
                  <span
                    key={idx}
                    className={`inline-block px-2 py-0.5 rounded-lg border text-sm sm:text-base transition-all duration-150 ${badgeStyle}`}
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

        {/* Primary Studio Selector: QTranslate Live vs Recording Studio */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-800/80 border border-slate-700/80">
          <button
            type="button"
            onClick={() => {
              setStudioTab("qtranslate-live");
              stopRecording();
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              studioTab === "qtranslate-live"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>⚡ استماع لايف وبناء الجمل (مثل QTranslate)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStudioTab("recording-studio");
              stopLiveListening();
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              studioTab === "recording-studio"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Mic className="w-4 h-4 text-purple-300" />
            <span>🎙️ استوديو التسجيل الصوتي والمحاكاة</span>
          </button>
        </div>

        {/* TAB 1: QTranslate Live Speech Recognition Panel */}
        {studioTab === "qtranslate-live" && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950 border border-purple-500/40 shadow-xl shadow-purple-950/30 space-y-4">
            {/* Top Bar: Description, Live Status & Language selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                  <Zap className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <span>محرك الاستماع اللحظي (Direct Live STT)</span>
                    {isLiveListening && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold animate-pulse">
                        🟢 يستمع لك الآن
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    تحدّث بالجملة وسيتم التقاط كلماتك ومطابقتها فوراً وحساب دقة نطقك
                  </p>
                </div>
              </div>

              {/* Speech Language Selector & Match Badge */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-purple-300 font-bold">
                  🎯 مطابقة: {matchedWordsCount} / {targetWords.length}
                </span>

                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg text-xs">
                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={selectedSpeechLang}
                    disabled={isLiveListening}
                    onChange={(e) => {
                      setSelectedSpeechLang(e.target.value);
                      if (isLiveListening) {
                        stopLiveListening();
                      }
                    }}
                    className="bg-transparent text-slate-200 text-xs font-bold outline-none cursor-pointer disabled:opacity-60"
                    title="لغة الاستماع الصوتي"
                  >
                    {SUPPORTED_SPEECH_LANGS.map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                        {lang.flag} {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Engine Selection Bar (Dual Engine) */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">نوع المحرك:</span>
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (isLiveListening) stopLiveListening();
                      setLiveEngine("fast-server");
                      setSpeechError(null);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      liveEngine === "fast-server"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="text-amber-300">🚀</span>
                    <span>المحرك الصامد فائق السرعة (مضمون 100%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isLiveListening) stopLiveListening();
                      setLiveEngine("web-speech");
                      setSpeechError(null);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      liveEngine === "web-speech"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>⚡ محرك Google المباشر (Web Speech)</span>
                  </button>
                </div>
              </div>
              <span className="text-[11px] text-slate-500">
                {liveEngine === "fast-server" ? "يعمل على كل المتصفحات والشبكات والدول" : "يتطلب متصفح Chrome وشبكة غير مقيدة"}
              </span>
            </div>

            {/* Live Mic Activity & Volume Meter (Instant Visual Feedback) */}
            {isLiveListening && (
              <div className="p-3 rounded-xl bg-purple-950/50 border border-purple-500/40 flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <Waves className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>الميكروفون نشط ويلتقط صوتك الآن — تكلّم بالجملة</span>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] text-purple-300 font-medium">مستوى حساسية الصوت:</span>
                  <div className="w-28 h-2.5 rounded-full bg-slate-900 border border-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-purple-500 transition-all duration-75"
                      style={{ width: `${Math.max(8, micVolume)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-emerald-300 w-8 text-left">{micVolume}%</span>
                </div>
              </div>
            )}

            {/* Action Buttons: Big Start / Stop / Clear / Play Original */}
            <div className="flex flex-wrap items-center gap-3">
              {!isLiveListening ? (
                <button
                  type="button"
                  onClick={toggleLiveListening}
                  className="flex-1 min-w-[220px] py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-purple-600/30 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Mic className="w-5 h-5 text-white animate-pulse" />
                  <span>
                    {liveEngine === "fast-server"
                      ? "🎙️ ابدأ التحدث الآن (استماع وتحقق فوري)"
                      : "⚡ ابدأ الاستماع المباشر (مثل QTranslate)"}
                  </span>
                </button>
              ) : (
                <div className="flex-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleLiveListening}
                    className="flex-1 min-w-[200px] py-3.5 px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-rose-600/30 transition-all cursor-pointer animate-pulse"
                  >
                    <MicOff className="w-5 h-5" />
                    <span>
                      {liveEngine === "fast-server"
                        ? "⏹️ إنهاء واستخراج الكلمات فوراً"
                        : "⏹️ إيقاف الاستماع"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={clearLiveText}
                    className="px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>مسح</span>
                  </button>
                </div>
              )}

              {/* Play original audio segment button for fast listening */}
              <button
                type="button"
                onClick={handlePlayOriginal}
                className={`py-3 px-4 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer border ${
                  isPlayingOriginal
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                    : "bg-slate-800/80 hover:bg-slate-700 text-indigo-300 border-slate-700"
                }`}
                title="استمع للمتحدث الأصلي لمقارنة النطق"
              >
                {isPlayingOriginal ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>استماع للأصل ({playbackSpeed}x)</span>
              </button>
            </div>

            {/* Server transcription active loader */}
            {isTranscribingWithServer && (
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-xs text-indigo-200 flex items-center gap-2.5 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                <span className="font-bold">جاري استخراج كلماتك المنطوقة بدقة وحساب نسبة التطابق فوراً...</span>
              </div>
            )}

            {/* Real-time sentence display canvas */}
            <div
              className={`p-4 rounded-2xl min-h-[90px] border transition-all flex flex-col justify-between gap-2 ${
                isLiveListening
                  ? "bg-slate-950 border-purple-500/60 shadow-inner ring-1 ring-purple-500/20"
                  : "bg-slate-950/70 border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-bold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  <span>ما تنطقه يظهر هنا مباشرة كلمة بكلمة:</span>
                </span>
                {similarityScore !== null && (
                  <span
                    className={`font-bold px-2 py-0.5 rounded-lg border text-xs ${
                      similarityScore >= 80
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : similarityScore >= 50
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    }`}
                  >
                    🏆 نسبة الدقة: {similarityScore}%
                  </span>
                )}
              </div>

              {/* Words Output Canvas */}
              <div className="py-2">
                {isLiveListening && !recognizedText && !interimText ? (
                  <div className="flex items-center gap-2.5 text-xs text-purple-300 animate-pulse">
                    <Waves className="w-4 h-4 text-purple-400 animate-pulse shrink-0" />
                    <span>
                      {liveEngine === "fast-server"
                        ? "الميكروفون يستمع لصوتك الآن! انطق الجملة واضغط 'إنهاء واستخراج الكلمات' لترى نتيجتك فوراً."
                        : "الميكروفون مفتوح ويستمع لصوتك الآن... تحدّث بوضوح وستظهر الكلمات فوراً هنا!"}
                    </span>
                  </div>
                ) : !recognizedText && !interimText ? (
                  <p className="text-xs text-slate-500">
                    اضغط على الزر أعلاه وانطق الجملة ليتم تفريغها ومطابقتها كلمة بكلمة.
                  </p>
                ) : (
                  <div
                    className="text-base sm:text-lg leading-relaxed font-semibold break-words select-text"
                    dir={detectDirection(recognizedText || interimText)}
                  >
                    {finalText && <span className="text-white font-bold">{finalText} </span>}
                    {interimText && (
                      <span className="text-purple-300 italic font-semibold border-b border-purple-400/50">
                        {interimText}
                      </span>
                    )}
                    {isLiveListening && (
                      <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse align-middle ml-1 mr-0.5 rounded-xs" />
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Actions on Recognized Text */}
              {recognizedText && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs text-slate-400">
                  <span>{recognizedText.split(/\s+/).filter(Boolean).length} كلمة تم التقاطها</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(recognizedText)}
                      className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 hover:bg-slate-800 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>نسخ النص</span>
                    </button>
                    <button
                      type="button"
                      onClick={clearLiveText}
                      className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:bg-rose-950/30 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>مسح</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Error or Iframe Alert Message with 1-click fallback */}
            {speechError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">
                    <p className="font-medium">{speechError}</p>
                  </div>
                </div>
                {liveEngine === "web-speech" && (
                  <button
                    type="button"
                    onClick={() => {
                      setLiveEngine("fast-server");
                      setSpeechError(null);
                      startFastLiveListening();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
                  >
                    <span>🚀 التبديل والبدء فوراً بالمحرك الصامد فائق السرعة (مضمون 100%)</span>
                  </button>
                )}
                {isInIframe && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>اضغط هنا لفتح التطبيق في نافذة مستقلة (Direct Tab)</span>
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Recording Studio & Simulation */}
        {studioTab === "recording-studio" && (
          <div className="space-y-3">
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

        {/* Live Speech Recognition & Streaming Box (عرض الكلمات مباشرة أثناء التسجيل ومحرك STT السريع) */}
        {(isRecording || recognizedText || interimText || recordedAudioUrl || isTranscribingWithServer) && (
          <div
            className={`p-4 rounded-2xl border transition-all duration-200 space-y-3 ${
              isRecording
                ? "bg-slate-900/90 border-purple-500/70 shadow-xl shadow-purple-950/40 ring-1 ring-purple-500/30"
                : "bg-slate-800/70 border-slate-700/70"
            }`}
          >
            {/* Box Header: Status, Live Indicator, Match Counter, and Speech Language Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                {isRecording ? (
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                  </span>
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                    <span>
                      {isRecording
                        ? "الاستماع المباشر لكلماتك (Google Speech Engine)"
                        : isTranscribingWithServer
                        ? "جاري تفريغ الصوت السريع..."
                        : "ما تم التقاطه صوتياً"}
                    </span>
                  </span>
                  {isSpeechListening && isRecording && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold animate-pulse">
                      الاستماع نشط
                    </span>
                  )}
                </div>
              </div>

              {/* Language Selector, Retranscribe button, & Matched Count */}
              <div className="flex items-center gap-2">
                {/* Fast STT button for recorded audio */}
                {recordedAudioUrl && !isRecording && (
                  <button
                    type="button"
                    disabled={isTranscribingWithServer}
                    onClick={() => lastRecordedBlobRef.current && transcribeAudioWithServer(lastRecordedBlobRef.current)}
                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    title="إعادة تفريغ الكلمات من تسجيلك الصوتي بدقة وسرعة"
                  >
                    {isTranscribingWithServer ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3 text-amber-300" />
                    )}
                    <span>تفريغ سريع (Fast STT)</span>
                  </button>
                )}

                {/* Matched Words Counter */}
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-purple-300 font-bold">
                  🎯 {matchedWordsCount} / {targetWords.length} كلمات مطابقة
                </span>

                {/* Speech Language Dropdown */}
                <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-lg text-xs">
                  <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                  <select
                    value={selectedSpeechLang}
                    disabled={isRecording}
                    onChange={(e) => setSelectedSpeechLang(e.target.value)}
                    className="bg-transparent text-slate-200 text-[11px] font-bold outline-none cursor-pointer disabled:opacity-60"
                    title="اختر لغة التعرف الصوتي"
                  >
                    {SUPPORTED_SPEECH_LANGS.map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                        {lang.flag} {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Live Text Display Stream */}
            <div className="min-h-[48px] flex items-center px-1">
              {isTranscribingWithServer ? (
                <div className="flex items-center gap-2.5 text-xs text-purple-300 animate-pulse py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
                  <span>جاري استخراج الكلمات المنطوقة من تسجيلك بسرعة وبدون تأخير...</span>
                </div>
              ) : isRecording && !recognizedText && !interimText ? (
                <div className="flex items-center gap-2.5 text-xs text-slate-400 animate-pulse py-1">
                  <Waves className="w-4 h-4 text-purple-400 animate-pulse shrink-0" />
                  <span>تكلّم الآن بصوت واضح... ما تقوله سيظهر هنا كلمة بكلمة في الوقت الفعلي أثناء نطقك.</span>
                </div>
              ) : !isRecording && !recognizedText && !interimText && recordedAudioUrl ? (
                <div className="flex items-center justify-between w-full py-1 text-xs text-slate-400">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>لم يتم التقاط الكلمات تلقائياً أثناء التسجيل. اضغط لتفريغها الآن من تسجيلك:</span>
                  </span>
                  <button
                    type="button"
                    disabled={isTranscribingWithServer}
                    onClick={() => lastRecordedBlobRef.current && transcribeAudioWithServer(lastRecordedBlobRef.current)}
                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>تفريغ التسجيل الآن</span>
                  </button>
                </div>
              ) : (
                <div
                  className="w-full text-sm sm:text-base leading-relaxed break-words select-text font-medium"
                  dir={detectDirection(recognizedText || interimText)}
                >
                  {/* Final recognized words */}
                  {finalText && (
                    <span className="text-white font-bold drop-shadow-xs">{finalText} </span>
                  )}
                  {/* Interim streaming words */}
                  {interimText && (
                    <span className="text-purple-300 italic font-semibold">{interimText}</span>
                  )}
                  {isRecording && (
                    <span className="inline-block w-1.5 h-4 bg-purple-400 animate-pulse align-middle ml-1 mr-0.5 rounded-xs" />
                  )}
                </div>
              )}
            </div>

            {/* Transcription notice banner */}
            {transcriptionNotice && (
              <div className="text-[11px] text-purple-300 bg-purple-950/40 border border-purple-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>{transcriptionNotice}</span>
              </div>
            )}

            {/* Live Recognition Hint for user */}
            {isRecording && (
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-800/80">
                <span>💡 تحدّث بطلاقة، الكلمات المطابقة للجملة أعلاه ستضيء فوراً بالأخضر!</span>
                <span className="text-purple-300 font-mono font-bold">Live STT Active</span>
              </div>
            )}
          </div>
        )}
          </div>
        )}

        {!isSpeechSupported && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              متصفحك الحالي لا يدعم محرك Web Speech المباشر. لرؤية كلماتك تظهر مباشرة أثناء النطق، يرجى فتح التطبيق في <strong>Google Chrome</strong> أو <strong>Microsoft Edge</strong> أو متصفح أندرويد.
            </span>
          </div>
        )}

        {/* Pronunciation Assessment & Feedback Box */}
        {speechError && studioTab === "recording-studio" && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{speechError}</span>
          </div>
        )}

        {similarityScore !== null && studioTab === "recording-studio" && (
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

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-[11px] text-slate-400">
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

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Volume2,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Headphones,
  Award
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

  // Speech Recognition & Scoring States
  const [recognizedText, setRecognizedText] = useState<string>("");
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

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

  // Reset state when cue changes
  useEffect(() => {
    stopRecording();
    stopUserAudio();
    onStopOriginalSegment();
    setRecordedAudioUrl(null);
    setRecognizedText("");
    setSimilarityScore(null);
    setSpeechError(null);
    setIsLoopingSegment(false);
  }, [cue.id]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
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

  // Word-level Visualizer Tokens
  const targetWords = cue.text.split(/\s+/).filter(Boolean);
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
        className="bg-slate-900 border border-slate-700/90 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl text-slate-100 flex flex-col gap-4 max-h-[92vh] overflow-y-auto animate-scaleUp text-right"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
              <Headphones className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">
              شادوينج
            </h3>
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
                  <span>استماع للمتحدث الأصلي</span>
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

        {/* Modal Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-800 text-[11px] text-slate-400">
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

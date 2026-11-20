import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
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
  Headphones,
  Award,
  Waves,
  RefreshCw,
  Repeat,
  Sliders
} from "lucide-react";
import { SubtitleCue } from "../types";
import { fetchGradioAudioBlob, speakClient } from "./Modals";
import {
  ShadowingVoiceSettingsModal,
  ShadowingVoiceProvider
} from "./ShadowingVoiceSettingsModal";
import {
  requestMobileSafeMicrophoneStream,
  getMicrophoneErrorMessage,
  createCompatibleMediaRecorder,
  isHttpInsecureOrigin,
  getHttpsSwitchUrl
} from "../utils/audioRecording";
import {
  SmoothWaveformTrack,
  SmoothWaveformTrackHandle
} from "./SmoothWaveformTrack";

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
  getCurrentTime?: () => number;
  mediaUrl?: string;
}

// Format time to 00:01.4
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

// Real Audio Waveform Extraction from Blob (RMS + Peak envelope for detailed speech contrast)
async function extractRealWaveform(blob: Blob, barsCount = 80): Promise<number[]> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return [];
    const ctx = new AudioCtxClass();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / barsCount);
    if (blockSize <= 0) {
      ctx.close().catch(() => {});
      return [];
    }
    const samples: number[] = [];

    let maxVal = 0.001;
    for (let i = 0; i < barsCount; i++) {
      let sumSq = 0;
      let maxAbs = 0;
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channelData.length);
      for (let j = start; j < end; j++) {
        const s = channelData[j];
        const a = Math.abs(s);
        sumSq += s * s;
        if (a > maxAbs) maxAbs = a;
      }
      const rms = Math.sqrt(sumSq / (end - start || 1));
      const energy = rms * 0.65 + maxAbs * 0.35;
      samples.push(energy);
      if (energy > maxVal) maxVal = energy;
    }
    ctx.close().catch(() => {});

    return samples.map((s) => {
      const ratio = Math.min(1, s / maxVal);
      const norm = 0.1 + Math.pow(ratio, 0.85) * 0.88;
      return parseFloat(Math.max(0.1, Math.min(0.98, norm)).toFixed(2));
    });
  } catch (err) {
    console.warn("Waveform decode error:", err);
    return [];
  }
}

// Caches for instant detailed waveforms across cues and re-entries
const mediaAudioBufferCache = new Map<string, AudioBuffer>();
const mediaAudioBufferPromiseCache = new Map<string, Promise<AudioBuffer | null>>();
const segmentPeaksCache = new Map<string, number[]>();
const segmentPeaksPromiseCache = new Map<string, Promise<number[]>>();

function makeSegmentPeaksKey(mediaUrl: string, startTime: number, endTime: number, barsCount: number): string {
  return `${mediaUrl}|${startTime.toFixed(3)}|${endTime.toFixed(3)}|${barsCount}`;
}

async function getOrDecodeMediaBuffer(mediaUrl: string): Promise<AudioBuffer | null> {
  const existing = mediaAudioBufferCache.get(mediaUrl);
  if (existing) return existing;

  const inflight = mediaAudioBufferPromiseCache.get(mediaUrl);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return null;
      const resp = await fetch(mediaUrl);
      if (!resp.ok) return null;
      const arrayBuffer = await resp.arrayBuffer();
      const ctx = new AudioCtxClass();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      mediaAudioBufferCache.set(mediaUrl, decoded);
      ctx.close().catch(() => {});
      return decoded;
    } catch {
      return null;
    } finally {
      mediaAudioBufferPromiseCache.delete(mediaUrl);
    }
  })();

  mediaAudioBufferPromiseCache.set(mediaUrl, promise);
  return promise;
}

// Extract exact detailed peaks from Server ffmpeg endpoint first, with deduplicated client AudioBuffer fallback
async function getMediaSegmentPeaks(mediaUrl: string, startTime: number, endTime: number, barsCount = 80): Promise<number[]> {
  if (!mediaUrl) return [];
  const key = makeSegmentPeaksKey(mediaUrl, startTime, endTime, barsCount);
  const cached = segmentPeaksCache.get(key);
  if (cached && cached.length > 0) return cached;

  const inflight = segmentPeaksPromiseCache.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      // 1. Fast Server Segment Extraction (~30ms for any file size, even large videos or mobile)
      if (!mediaUrl.startsWith("blob:") && !mediaUrl.startsWith("data:")) {
        try {
          const qs = new URLSearchParams({
            url: mediaUrl,
            startTime: String(Math.max(0, startTime)),
            endTime: String(Math.max(startTime + 0.2, endTime)),
            bars: String(barsCount)
          });
          const res = await fetch(`/api/media/waveform-segment?${qs.toString()}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.success && Array.isArray(data.peaks) && data.peaks.length > 0) {
              segmentPeaksCache.set(key, data.peaks);
              return data.peaks as number[];
            }
          }
        } catch {}
      }

      // 2. Client-side deduplicated AudioBuffer slice fallback
      const audioBuffer = await getOrDecodeMediaBuffer(mediaUrl);
      if (!audioBuffer) return [];

      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.max(0, Math.floor(startTime * sampleRate));
      const endSample = Math.min(channelData.length, Math.floor(endTime * sampleRate));
      const segmentLength = endSample - startSample;
      if (segmentLength <= 0) return [];

      const blockSize = Math.floor(segmentLength / barsCount);
      if (blockSize <= 0) return [];

      const peaks: number[] = [];
      let max = 0.0005;

      for (let i = 0; i < barsCount; i++) {
        let sumSq = 0;
        let maxAbs = 0;
        const start = startSample + i * blockSize;
        const end = Math.min(start + blockSize, endSample);
        for (let j = start; j < end; j++) {
          const s = channelData[j];
          const a = Math.abs(s);
          sumSq += s * s;
          if (a > maxAbs) maxAbs = a;
        }
        const rms = Math.sqrt(sumSq / (end - start || 1));
        const energy = rms * 0.65 + maxAbs * 0.35;
        peaks.push(energy);
        if (energy > max) max = energy;
      }

      const normalized = peaks.map((p) => {
        const ratio = Math.min(1, p / max);
        return parseFloat(Math.max(0.1, Math.min(0.98, 0.1 + Math.pow(ratio, 0.85) * 0.88)).toFixed(2));
      });
      segmentPeaksCache.set(key, normalized);
      return normalized;
    } catch {
      return [];
    } finally {
      segmentPeaksPromiseCache.delete(key);
    }
  })();

  segmentPeaksPromiseCache.set(key, promise);
  return promise;
}

// Natural speech-envelope simulated peaks (matches Repetition mode)
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
  currentTime,
  getCurrentTime,
  mediaUrl
}) => {
  // Modes: "listen-repeat" (استمع ثم ردّد), "simultaneous" (محاكاة متزامنة), "loop" (تكرار تدريبي)
  const [shadowingMode, setShadowingMode] = useState<"listen-repeat" | "simultaneous" | "loop">("listen-repeat");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLoopingSegment, setIsLoopingSegment] = useState<boolean>(false);
  const [showVoiceSettingsModal, setShowVoiceSettingsModal] = useState<boolean>(false);

  // Voice selection states
  const [voiceProvider, setVoiceProvider] = useState<ShadowingVoiceProvider>(() => {
    return (localStorage.getItem("shadowing_voice_provider") as ShadowingVoiceProvider) || "google";
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

  // Audio Recording States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingUserAudio, setIsPlayingUserAudio] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [userWaveform, setUserWaveform] = useState<number[]>([]);

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
  const userWaveformSamplesRef = useRef<number[]>([]);
  const lastSampleTimeRef = useRef<number>(0);
  const originalTrackRef = useRef<SmoothWaveformTrackHandle | null>(null);
  const userTrackRef = useRef<SmoothWaveformTrackHandle | null>(null);
  const originalTimeTextRef = useRef<HTMLSpanElement | null>(null);
  const lastScrubSeekMsRef = useRef<number>(0);
  const getCurrentTimeRef = useRef(getCurrentTime);
  getCurrentTimeRef.current = getCurrentTime;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const playbackSpeedRef = useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;

  // High-fidelity original audio waveform (80 bars)
  const [originalWaveform, setOriginalWaveform] = useState<number[]>(() => {
    if (mediaUrl) {
      const cached = segmentPeaksCache.get(makeSegmentPeaksKey(mediaUrl, cue.startTime, cue.endTime, 80));
      if (cached && cached.length > 0) return cached;
    }
    return generateSimulatedPeaks(cue.text, 80);
  });

  useEffect(() => {
    let isCancelled = false;
    const cached = mediaUrl
      ? segmentPeaksCache.get(makeSegmentPeaksKey(mediaUrl, cue.startTime, cue.endTime, 80))
      : undefined;

    if (cached && cached.length > 0) {
      setOriginalWaveform(cached);
    } else {
      setOriginalWaveform(generateSimulatedPeaks(cue.text, 80));
      if (mediaUrl) {
        getMediaSegmentPeaks(mediaUrl, cue.startTime, cue.endTime, 80).then((peaks) => {
          if (!isCancelled && peaks.length > 0) {
            setOriginalWaveform(peaks);
          }
        });
      }
    }

    // Background-preload next cue waveform so switching sentences is instantaneous
    if (mediaUrl && allCues && currentCueIndex >= 0 && currentCueIndex + 1 < allCues.length) {
      const nextCue = allCues[currentCueIndex + 1];
      if (nextCue) {
        getMediaSegmentPeaks(mediaUrl, nextCue.startTime, nextCue.endTime, 80).catch(() => {});
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [cue.id, cue.startTime, cue.endTime, cue.text, mediaUrl, currentCueIndex, allCues]);

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
    setUserWaveform([]);
    userWaveformSamplesRef.current = [];
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

  // Keyboard Navigation between cues (ArrowLeft for previous, ArrowRight for next)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyNav = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentCueIndex > 0) {
          onSelectCue(allCues[currentCueIndex - 1]);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (currentCueIndex < allCues.length - 1) {
          onSelectCue(allCues[currentCueIndex + 1]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyNav);
    return () => window.removeEventListener("keydown", handleKeyNav);
  }, [isOpen, currentCueIndex, allCues, onSelectCue]);

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

  // Smooth 60/120fps GPU-composited playhead for original media segment (zero React re-renders)
  const originalAnimRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlayingOriginal) {
      if (originalAnimRef.current) cancelAnimationFrame(originalAnimRef.current);
      const cur = getCurrentTimeRef.current ? getCurrentTimeRef.current() : currentTimeRef.current;
      const clampedOffset = Math.max(0, Math.min(segmentDuration, cur - cue.startTime));
      const frac = Math.max(0, Math.min(1, clampedOffset / segmentDuration));
      originalTrackRef.current?.setProgress(frac);
      if (originalTimeTextRef.current) {
        originalTimeTextRef.current.textContent = formatTimeSeconds(clampedOffset);
      }
      return;
    }

    let lastMediaTime = getCurrentTimeRef.current ? getCurrentTimeRef.current() : currentTimeRef.current;
    let lastPerfMs = performance.now();
    let hasStartedAdvancing = false;
    let lastTextUpdateMs = 0;

    const updateSmoothOriginal = (now: number) => {
      const rawCur = getCurrentTimeRef.current ? getCurrentTimeRef.current() : currentTimeRef.current;
      if (Math.abs(rawCur - lastMediaTime) > 0.002) {
        lastMediaTime = rawCur;
        lastPerfMs = now;
        hasStartedAdvancing = true;
      }

      // Interpolate smoothly between coarse mobile HTMLMediaElement ticks (capped at +140ms)
      const effectiveCur = hasStartedAdvancing
        ? Math.min(
            lastMediaTime + 0.14,
            lastMediaTime + ((now - lastPerfMs) / 1000) * playbackSpeedRef.current
          )
        : rawCur;

      const clampedOffset = Math.max(0, Math.min(segmentDuration, effectiveCur - cue.startTime));
      const frac = Math.max(0, Math.min(1, clampedOffset / segmentDuration));
      originalTrackRef.current?.setProgress(frac);

      if (originalTimeTextRef.current && now - lastTextUpdateMs >= 80) {
        lastTextUpdateMs = now;
        originalTimeTextRef.current.textContent = formatTimeSeconds(clampedOffset);
      }

      originalAnimRef.current = requestAnimationFrame(updateSmoothOriginal);
    };

    originalAnimRef.current = requestAnimationFrame(updateSmoothOriginal);

    return () => {
      if (originalAnimRef.current) cancelAnimationFrame(originalAnimRef.current);
    };
  }, [isPlayingOriginal, cue.startTime, segmentDuration]);

  // Smooth 60/120fps GPU-composited playhead for user audio (zero React re-renders)
  const userAnimRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlayingUserAudio) {
      if (userAnimRef.current) cancelAnimationFrame(userAnimRef.current);
      return;
    }

    let lastMediaTime = userAudioElementRef.current?.currentTime ?? 0;
    let lastPerfMs = performance.now();
    let hasStartedAdvancing = false;

    const updateSmoothUser = (now: number) => {
      const audio = userAudioElementRef.current;
      if (audio && audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        const rawCur = audio.currentTime;
        if (Math.abs(rawCur - lastMediaTime) > 0.002) {
          lastMediaTime = rawCur;
          lastPerfMs = now;
          hasStartedAdvancing = true;
        }
        const effectiveCur =
          hasStartedAdvancing && !audio.paused && !audio.ended
            ? Math.min(lastMediaTime + 0.14, lastMediaTime + ((now - lastPerfMs) / 1000) * (audio.playbackRate || 1))
            : rawCur;
        const frac = Math.max(0, Math.min(1, effectiveCur / audio.duration));
        userTrackRef.current?.setProgress(frac);
      }
      userAnimRef.current = requestAnimationFrame(updateSmoothUser);
    };

    userAnimRef.current = requestAnimationFrame(updateSmoothUser);

    return () => {
      if (userAnimRef.current) cancelAnimationFrame(userAnimRef.current);
    };
  }, [isPlayingUserAudio]);

  // Play Original Native Segment
  const handlePlayOriginal = () => {
    if (isPlayingOriginal) {
      onStopOriginalSegment();
      setIsLoopingSegment(false);
    } else {
      onPlayOriginalSegment(cue.startTime, cue.endTime, playbackSpeed);
    }
  };

  // Touch & Mouse Scrub Seek within Original Segment Waveform
  const seekOriginalByFraction = (frac: number) => {
    const clampedOffset = frac * segmentDuration;
    const seekTarget = cue.startTime + clampedOffset;
    if (originalTimeTextRef.current) {
      originalTimeTextRef.current.textContent = formatTimeSeconds(clampedOffset);
    }
    onPlayOriginalSegment(seekTarget, cue.endTime, playbackSpeed);
  };

  const handleOriginalSeekMove = (frac: number) => {
    const clampedOffset = frac * segmentDuration;
    if (originalTimeTextRef.current) {
      originalTimeTextRef.current.textContent = formatTimeSeconds(clampedOffset);
    }
    const now = performance.now();
    if (now - lastScrubSeekMsRef.current >= 110) {
      lastScrubSeekMsRef.current = now;
      onPlayOriginalSegment(cue.startTime + clampedOffset, cue.endTime, playbackSpeed);
    }
  };

  // Touch & Mouse Scrub Seek within User Audio Waveform
  const seekUserByFraction = (frac: number, autoPlayIfPaused: boolean) => {
    const audio = userAudioElementRef.current;
    if (!audio || !recordedAudioUrl || isRecording) return;
    if (audio.duration && !isNaN(audio.duration)) {
      audio.currentTime = frac * audio.duration;
      userTrackRef.current?.setProgress(frac);
      if (autoPlayIfPaused && !isPlayingUserAudio) {
        handlePlayUserAudio();
      }
    }
  };

  // Playback with TTS Fallback (if user wants clear studio voice)
  const handlePlayTtsFallback = async () => {
    const lang = primaryLanguage || "de";
    try {
      if (voiceProvider === "external") {
        const cleanVoice = selectedVoiceId.replace(/^gradio[:_]/i, "").trim() || "ryan";
        const effectiveGradioUrl = (
          gradioUrl ||
          localStorage.getItem("settings_gradio_tts_url") ||
          localStorage.getItem("gradio_api_url") ||
          "http://192.168.0.159:7860"
        ).trim();

        let blob = await fetchGradioAudioBlob(cue.text, cleanVoice, lang, effectiveGradioUrl, false);

        if (!blob) {
          try {
            const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
            const apiBase = isLocalhost ? "http://localhost:3000/api/tts" : "/api/tts";
            const fallbackRes = await fetch(
              `${apiBase}?text=${encodeURIComponent(cue.text)}&lang=${encodeURIComponent(lang)}&voice=${encodeURIComponent(`gradio:${cleanVoice}`)}&gradioUrl=${encodeURIComponent(effectiveGradioUrl)}&_t=${Date.now()}`
            );
            if (fallbackRes.ok) {
              const cType = fallbackRes.headers.get("content-type") || "";
              if (cType.includes("audio")) {
                blob = await fallbackRes.blob();
              }
            }
          } catch (fbErr) {
            console.warn("Direct GET /api/tts fallback in StudioModal failed:", fbErr);
          }
        }

        if (blob && blob.size > 100) {
          const audio = new Audio(URL.createObjectURL(blob));
          audio.playbackRate = playbackSpeed;
          audio.play();
          return;
        }
      } else if (voiceProvider === "piper") {
        const voiceParam = `&voice=${encodeURIComponent(selectedVoiceId)}`;
        const url = `/api/tts?text=${encodeURIComponent(cue.text)}&lang=${lang}${voiceParam}`;
        const res = await fetch(url);
        if (res.ok) {
          const blob = await res.blob();
          const audio = new Audio(URL.createObjectURL(blob));
          audio.playbackRate = playbackSpeed;
          audio.play();
          return;
        }
      }
    } catch (e) {
      console.warn("TTS fetch error, using fallback speech:", e);
    }
    speakClient(cue.text, lang);
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
    userTrackRef.current?.setProgress(0);
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
      audio.preload = "auto";
      userAudioElementRef.current = audio;

      audio.onended = () => {
        setIsPlayingUserAudio(false);
        userTrackRef.current?.setProgress(0);
      };
    } else if (userAudioElementRef.current.src !== recordedAudioUrl) {
      userAudioElementRef.current.src = recordedAudioUrl;
    }

    userAudioElementRef.current.play().then(() => {
      setIsPlayingUserAudio(true);
    }).catch(console.error);
  };

  // Start Mic Recording & Web Speech Recognition (Mobile-Safe, Zero 60fps React Re-renders)
  const startRecording = async () => {
    setSpeechError(null);
    setRecognizedText("");
    setSimilarityScore(null);
    stopUserAudio();
    userWaveformSamplesRef.current = [];
    setUserWaveform([]);
    userTrackRef.current?.resetLiveBars();
    lastSampleTimeRef.current = performance.now();

    try {
      // Request microphone FIRST inside user gesture before starting simultaneous playback
      const stream = await requestMobileSafeMicrophoneStream();
      micStreamRef.current = stream;

      if (shadowingMode === "simultaneous") {
        onPlayOriginalSegment(cue.startTime, cue.endTime, playbackSpeed);
      }

      // Audio Analyzer for silky 60fps direct-DOM visualizer (zero React setState in rAF!)
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          ctx.resume?.().catch(() => {});
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.55;
          source.connect(analyser);
          analyserRef.current = analyser;

          const timeData = new Uint8Array(analyser.fftSize);
          const liveDisplayBars = Array.from({ length: 80 }, () => 0.14);
          let smoothedLevel = 0.14;

          const updateMicVisual = (now: number) => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteTimeDomainData(timeData);
            let sumSq = 0;
            for (let i = 0; i < timeData.length; i++) {
              const centered = (timeData[i] - 128) / 128;
              sumSq += centered * centered;
            }
            const rms = Math.sqrt(sumSq / timeData.length);
            const instant = Math.max(0.14, Math.min(1.0, 0.14 + Math.pow(rms * 3.4, 0.85) * 0.86));
            smoothedLevel = smoothedLevel * 0.5 + instant * 0.5;

            if (now - lastSampleTimeRef.current >= 36) {
              lastSampleTimeRef.current = now;
              const sampleVal = parseFloat(smoothedLevel.toFixed(2));
              userWaveformSamplesRef.current.push(sampleVal);

              if (userWaveformSamplesRef.current.length <= 80) {
                const idx = userWaveformSamplesRef.current.length - 1;
                liveDisplayBars[idx] = sampleVal;
              } else {
                // Smooth sliding window while recording so movement stays effortless
                liveDisplayBars.shift();
                liveDisplayBars.push(sampleVal);
              }
              userTrackRef.current?.setLiveBars(liveDisplayBars);
            }

            animationFrameRef.current = requestAnimationFrame(updateMicVisual);
          };
          animationFrameRef.current = requestAnimationFrame(updateMicVisual);
        }
      } catch (e) {
        console.warn("AudioContext visualizer error:", e);
      }

      // Cross-browser MediaRecorder (works on iOS Safari mp4/aac as well as Chrome Android webm)
      audioChunksRef.current = [];
      const { recorder: mediaRecorder, mimeType: recordedMimeType } = createCompatibleMediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeType });
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);

        // Decode the REAL AudioBuffer to get 100% genuine waveform from user's voice (80 bars)
        const realWaves = await extractRealWaveform(audioBlob, 80);
        if (realWaves && realWaves.length > 0) {
          setUserWaveform(realWaves);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      // Web Speech Recognition (Optional overlay; never stops MediaRecorder on mobile conflicts)
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
          console.warn("Speech recognition notice:", event.error);
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {}
      }
    } catch (err: any) {
      console.error("Microphone access error:", err);
      setSpeechError(getMicrophoneErrorMessage(err));
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

    // Final evaluation if recognizedText exists
    if (recognizedText) {
      const finalScore = evaluatePronunciation(recognizedText, cue.text);
      setSimilarityScore(finalScore);
    }
  };

  const displayUserWaveform = useMemo(() => {
    if (isRecording) {
      const bars = [...userWaveform];
      while (bars.length < 80) {
        bars.push(0.12);
      }
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
      className="fixed inset-0 z-[100] bg-black/90 sm:backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="my-auto bg-slate-900 border border-slate-700/90 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl text-slate-100 flex flex-col justify-between gap-3 sm:gap-4 animate-scaleUp text-right"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
              <Headphones className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">
              استوديو الشادوينج
            </h3>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Voice Settings Icon Button */}
            <button
              type="button"
              onClick={() => setShowVoiceSettingsModal(true)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center justify-center ${
                showVoiceSettingsModal
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                  : "bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/80"
              }`}
              title="تخصيص وإعدادات الصوت والموديل"
              aria-label="تخصيص وإعدادات الصوت والموديل"
            >
              <Sliders className="w-4 h-4 text-slate-300" />
            </button>

            {/* Sentence Index & Navigation - Natural LTR timeline (Left: Previous, Right: Next) */}
            <div className="flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700/80" dir="ltr">
              <button
                type="button"
                disabled={currentCueIndex <= 0}
                onClick={() => {
                  if (currentCueIndex > 0) {
                    onSelectCue(allCues[currentCueIndex - 1]);
                  }
                }}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="الجملة السابقة (←)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold px-2.5 text-slate-300 select-none">
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
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="الجملة التالية (→)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Target Sentence Card - Expands naturally with no scrollbar and no timestamp header */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex flex-col justify-center gap-2.5">
          {/* Primary Sentence Text */}
          <div
            className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed select-text"
            dir={detectDirection(cue.text)}
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

          {/* Secondary Translation Subtitle */}
          {cue.secondaryText && (
            <p
              className="text-sm sm:text-base text-purple-200/90 font-normal leading-relaxed pt-2 border-t border-slate-800/70 select-text"
              dir={detectDirection(cue.secondaryText)}
            >
              {cue.secondaryText}
            </p>
          )}
        </div>

        {/* Full-width Audio Sections (Repetition Mode Style) */}
        <div className="space-y-4">
          {/* Section 1: Original Audio Track */}
          <div className="space-y-2">
            {/* Toolbar */}
            <div className="w-full flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80 flex-wrap" dir="ltr">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePlayOriginal}
                  className={`h-8 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                    isPlayingOriginal
                      ? "bg-sky-600 text-white shadow-sm shadow-sky-600/30"
                      : "bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white border border-slate-700"
                  }`}
                  title={isPlayingOriginal ? "إيقاف مؤقت" : "تشغيل المقطع"}
                >
                  {isPlayingOriginal ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-sky-300" />}
                  <span>{isPlayingOriginal ? "إيقاف" : "تشغيل"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onPlayOriginalSegment(cue.startTime, cue.endTime, playbackSpeed)}
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
                    if (isPlayingOriginal) {
                      onPlayOriginalSegment(cue.startTime, cue.endTime, newSpeed);
                    }
                  }}
                  className="h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-mono font-bold transition-colors cursor-pointer"
                  title={`تغيير السرعة (الحالية: ${playbackSpeed}x)`}
                >
                  {playbackSpeed}x
                </button>

                <button
                  type="button"
                  onClick={() => setIsLoopingSegment(!isLoopingSegment)}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                    isLoopingSegment
                      ? "bg-emerald-600 text-white border-emerald-400 shadow-sm"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700 hover:text-slate-200"
                  }`}
                  title={isLoopingSegment ? "إيقاف التكرار التلقائي" : "تفعيل التكرار التلقائي"}
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handlePlayTtsFallback}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-sky-300 border border-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                  title="نطق نقي عبر الذكاء الاصطناعي (TTS)"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Time Readout */}
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <span ref={originalTimeTextRef} className="text-sky-400 font-bold">
                  {formatTimeSeconds(Math.max(0, Math.min(segmentDuration, ((getCurrentTime ? getCurrentTime() : currentTime) - cue.startTime))))}
                </span>
                <span>/</span>
                <span>{formatTimeSeconds(segmentDuration)}</span>
              </div>
            </div>

            {/* Full-width GPU-Composited Waveform Track */}
            <SmoothWaveformTrack
              ref={originalTrackRef}
              peaks={originalWaveform}
              accent="sky"
              isPlaying={isPlayingOriginal}
              interactive={true}
              title="اسحب أو انقر لتحديد موضع التشغيل"
              onSeekStart={seekOriginalByFraction}
              onSeekMove={handleOriginalSeekMove}
              onSeekEnd={seekOriginalByFraction}
            />
          </div>

          {/* Section 2: User Voice Track */}
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
                      <span className="w-2 h-2 rounded-full bg-white" />
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
                      stopUserAudio();
                      setRecordedAudioUrl(null);
                      setRecognizedText("");
                      setSimilarityScore(null);
                      setUserWaveform([]);
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

            {/* Full-width GPU-Composited User Waveform Track */}
            <SmoothWaveformTrack
              ref={userTrackRef}
              peaks={displayUserWaveform}
              accent="emerald"
              isPlaying={isPlayingUserAudio}
              isRecording={isRecording}
              interactive={Boolean(recordedAudioUrl)}
              title={recordedAudioUrl ? "اسحب أو انقر لتحديد موضع التشغيل" : ""}
              onSeekStart={(frac) => seekUserByFraction(frac, false)}
              onSeekMove={(frac) => seekUserByFraction(frac, false)}
              onSeekEnd={(frac) => seekUserByFraction(frac, true)}
            />
          </div>
        </div>

        {/* Pronunciation Assessment & Feedback Box */}
        {speechError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{speechError}</span>
            </div>
            {isHttpInsecureOrigin() && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1.5 border-t border-rose-500/20">
                <span className="text-[11px] text-rose-200/80">
                  عند الفتح لأول مرة، اضغط «خيارات متقدمة (Advanced)» ثم «المتابعة (Proceed)».
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const httpsUrl = getHttpsSwitchUrl();
                    if (httpsUrl) window.location.href = httpsUrl;
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition-colors cursor-pointer"
                >
                  فتح عبر HTTPS الآن
                </button>
              </div>
            )}
          </div>
        )}

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

        {/* VOICE & TTS MODEL SETTINGS MODAL */}
        <ShadowingVoiceSettingsModal
          isOpen={showVoiceSettingsModal}
          onClose={() => setShowVoiceSettingsModal(false)}
          provider={voiceProvider}
          selectedVoiceId={selectedVoiceId}
          language={primaryLanguage || "de"}
          playbackSpeed={playbackSpeed}
          gradioUrl={gradioUrl}
          currentSentenceText={cue.text || ""}
          onSaveSettings={(newSettings) => {
            setVoiceProvider(newSettings.provider);
            setSelectedVoiceId(newSettings.selectedVoiceId);
            setPlaybackSpeed(newSettings.playbackSpeed);
            setGradioUrl(newSettings.gradioUrl);

            // Persist preferences
            localStorage.setItem("shadowing_voice_provider", newSettings.provider);
            localStorage.setItem("shadowing_voice_id", newSettings.selectedVoiceId);
            localStorage.setItem("shadowing_playback_speed", newSettings.playbackSpeed.toString());
            localStorage.setItem("settings_gradio_tts_url", newSettings.gradioUrl);
            localStorage.setItem("gradio_api_url", newSettings.gradioUrl);
          }}
        />
      </div>
    </div>
  );
};

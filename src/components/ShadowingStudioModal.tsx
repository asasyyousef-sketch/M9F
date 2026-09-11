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
  Clock,
  Headphones,
  Award,
  Waves,
  RefreshCw,
  Repeat
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

// Real Audio Waveform Extraction from Blob (default 80 bars for high fidelity)
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

// Cache of decoded AudioBuffers to avoid re-fetching
const mediaAudioBufferCache = new Map<string, AudioBuffer>();

// Extract exact peaks from Media URL slice between startTime and endTime
async function getMediaSegmentPeaks(mediaUrl: string, startTime: number, endTime: number, barsCount = 80): Promise<number[]> {
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return [];

    let audioBuffer = mediaAudioBufferCache.get(mediaUrl);
    if (!audioBuffer) {
      const resp = await fetch(mediaUrl);
      if (!resp.ok) return [];
      const arrayBuffer = await resp.arrayBuffer();
      const ctx = new AudioCtxClass();
      audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      mediaAudioBufferCache.set(mediaUrl, audioBuffer);
      ctx.close().catch(() => {});
    }

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.max(0, Math.floor(startTime * sampleRate));
    const endSample = Math.min(channelData.length, Math.floor(endTime * sampleRate));
    const segmentLength = endSample - startSample;
    if (segmentLength <= 0) return [];

    const blockSize = Math.floor(segmentLength / barsCount);
    if (blockSize <= 0) return [];

    const peaks: number[] = [];
    let max = 0.001;

    for (let i = 0; i < barsCount; i++) {
      let sum = 0;
      const start = startSample + i * blockSize;
      const end = Math.min(start + blockSize, endSample);
      for (let j = start; j < end; j++) {
        sum += Math.abs(channelData[j]);
      }
      const avg = sum / (end - start || 1);
      peaks.push(avg);
      if (avg > max) max = avg;
    }

    return peaks.map((p) => Math.max(0.12, Math.min(0.95, p / max)));
  } catch (err) {
    return [];
  }
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

  // Audio Recording States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingUserAudio, setIsPlayingUserAudio] = useState<boolean>(false);
  const [userAudioProgress, setUserAudioProgress] = useState<number>(0);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [micVolume, setMicVolume] = useState<number>(0);
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
  const originalWaveformContainerRef = useRef<HTMLDivElement | null>(null);

  // High-fidelity original audio waveform (80 bars)
  const [originalWaveform, setOriginalWaveform] = useState<number[]>(() => generateSimulatedPeaks(cue.text, 80));

  useEffect(() => {
    let isCancelled = false;
    setOriginalWaveform(generateSimulatedPeaks(cue.text, 80));

    if (mediaUrl) {
      getMediaSegmentPeaks(mediaUrl, cue.startTime, cue.endTime, 80).then((peaks) => {
        if (!isCancelled && peaks.length > 0) {
          setOriginalWaveform(peaks);
        }
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [cue.id, cue.startTime, cue.endTime, cue.text, mediaUrl]);

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

  // Smooth 60fps playhead progress for original media segment
  const [smoothOriginalProgress, setSmoothOriginalProgress] = useState<number>(0);
  const originalAnimRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlayingOriginal) {
      if (originalAnimRef.current) cancelAnimationFrame(originalAnimRef.current);
      const cur = getCurrentTime ? getCurrentTime() : currentTime;
      const frac = Math.max(0, Math.min(1, (cur - cue.startTime) / segmentDuration));
      setSmoothOriginalProgress(frac * 100);
      return;
    }

    const updateSmoothOriginal = () => {
      const cur = getCurrentTime ? getCurrentTime() : currentTime;
      const frac = Math.max(0, Math.min(1, (cur - cue.startTime) / segmentDuration));
      setSmoothOriginalProgress(frac * 100);

      if (isPlayingOriginal) {
        originalAnimRef.current = requestAnimationFrame(updateSmoothOriginal);
      }
    };

    originalAnimRef.current = requestAnimationFrame(updateSmoothOriginal);

    return () => {
      if (originalAnimRef.current) cancelAnimationFrame(originalAnimRef.current);
    };
  }, [isPlayingOriginal, currentTime, cue.startTime, segmentDuration, getCurrentTime]);

  // Smooth 60fps playhead progress for user audio
  const userAnimRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlayingUserAudio) {
      if (userAnimRef.current) cancelAnimationFrame(userAnimRef.current);
      return;
    }

    const updateSmoothUser = () => {
      const audio = userAudioElementRef.current;
      if (audio && audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        const frac = Math.max(0, Math.min(1, audio.currentTime / audio.duration));
        setUserAudioProgress(frac * 100);
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

  // Play Original Native Segment
  const handlePlayOriginal = () => {
    if (isPlayingOriginal) {
      onStopOriginalSegment();
      setIsLoopingSegment(false);
    } else {
      onPlayOriginalSegment(cue.startTime, cue.endTime, playbackSpeed);
    }
  };

  // Seek within Original Segment Waveform
  const handleOriginalWaveformSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTarget = cue.startTime + frac * segmentDuration;
    onPlayOriginalSegment(seekTarget, cue.endTime, playbackSpeed);
  };

  // Seek within User Audio Waveform
  const handleUserWaveformSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!userAudioElementRef.current || !recordedAudioUrl || isRecording) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (userAudioElementRef.current.duration) {
      userAudioElementRef.current.currentTime = frac * userAudioElementRef.current.duration;
      setUserAudioProgress(frac * 100);
      if (!isPlayingUserAudio) {
        handlePlayUserAudio();
      }
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
    userWaveformSamplesRef.current = [];
    setUserWaveform([]);
    lastSampleTimeRef.current = Date.now();

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
              const vol = Math.min(100, Math.round((avg / 128) * 100));
              setMicVolume(vol);

              // Sample waveform peaks for live animated track (80 bars)
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

        {/* Target Sentence Card - Clean, eye-comfortable presentation without clutter or heavy boxed chips */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/40 border border-slate-800/80 relative space-y-3">
          {/* Timestamp and Duration Tag */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono select-none">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {formatSecondsToClock(cue.startTime)} ➔ {formatSecondsToClock(cue.endTime)}
              </span>
              <span className="text-slate-400">
                ({(cue.endTime - cue.startTime).toFixed(1)}ث)
              </span>
            </div>
          </div>

          {/* Primary Sentence Text (Clean flowing words, no exhausting boxed borders) */}
          <div
            className="text-lg sm:text-xl font-medium text-slate-100 leading-relaxed select-text"
            dir={detectDirection(cue.text)}
          >
            <p className="flex flex-wrap gap-x-2 gap-y-1.5 items-baseline">
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
              className="text-sm sm:text-base text-slate-400 font-normal leading-relaxed pt-2.5 border-t border-slate-800/60"
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
                <span className="text-sky-400 font-bold">
                  {formatTimeSeconds(Math.max(0, Math.min(segmentDuration, ((getCurrentTime ? getCurrentTime() : currentTime) - cue.startTime))))}
                </span>
                <span>/</span>
                <span>{formatTimeSeconds(segmentDuration)}</span>
              </div>
            </div>

            {/* Full-width Waveform Track */}
            <div
              ref={originalWaveformContainerRef}
              dir="ltr"
              onClick={handleOriginalWaveformSeek}
              className="relative w-full h-16 sm:h-20 bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 rounded-xl flex flex-row items-center justify-between px-2 gap-[2px] overflow-hidden group select-none cursor-pointer"
              title="انقر لتحديد موضع التشغيل"
            >
              {/* Background Progress Fill */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-sky-500/10 pointer-events-none"
                style={{
                  width: `${smoothOriginalProgress}%`,
                  willChange: "width"
                }}
              />

              {/* Smooth 60fps Laser Playhead Cursor */}
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)] pointer-events-none z-20"
                style={{
                  left: `${smoothOriginalProgress}%`,
                  transform: "translateX(-50%)",
                  willChange: "left"
                }}
              />

              {/* Waveform Bars */}
              {originalWaveform.map((peak, idx) => {
                const barFrac = ((idx + 0.5) / originalWaveform.length) * 100;
                const isPassed = isPlayingOriginal && barFrac <= smoothOriginalProgress;
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

              {/* Waveform Bars */}
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

        {/* Pronunciation Assessment & Feedback Box */}
        {speechError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{speechError}</span>
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
      </div>
    </div>
  );
};

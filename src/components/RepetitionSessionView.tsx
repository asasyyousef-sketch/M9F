import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Repeat,
  Volume2,
  VolumeX,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Eye,
  EyeOff,
  Sliders,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Music,
  Zap,
  Activity,
  Layers,
  HelpCircle,
  Clock,
  Loader2,
  Bot,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon
} from "lucide-react";
import { Flashcard, getSafeImageStyle, getCardSearchQuery } from "../types";
import { preloadTTS, preloadImage, playPiperLocalWasm, fetchGradioAudioBlob, ttsCache, speakClient } from "./Modals";
import { getSharedAudioContext, ImageWithSkeleton, brokenImagesSet, ddgImagesCache } from "./ReviewSession";
import { ReviewChatModal } from "./ReviewChatModal";

interface RepetitionSessionViewProps {
  card: Flashcard;
  currentIndex: number;
  totalCards: number;
  onNext: () => void;
  onPrev: () => void;
  onKnow: () => void;
  onRepeat: () => void;
  isSecondaryAudioEnabled?: boolean;
  reviewVoiceTarget?: "primary" | "secondary";
  onToggleVoiceTarget?: () => void;
  onOpenChat?: () => void;
  previousCards?: Flashcard[];
  nextCards?: Flashcard[];
  folderInfo?: {
    name?: string;
    description?: string;
    targetLanguage?: string;
    sourceLanguage?: string;
  };
}

export const RepetitionSessionView: React.FC<RepetitionSessionViewProps> = ({
  card,
  currentIndex,
  totalCards,
  onNext,
  onPrev,
  onKnow,
  onRepeat,
  isSecondaryAudioEnabled,
  reviewVoiceTarget = "primary",
  onToggleVoiceTarget,
  onOpenChat,
  previousCards = [],
  nextCards = [],
  folderInfo
}) => {
  // Audio state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [loopCount, setLoopCount] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showBackText, setShowBackText] = useState<boolean>(false);
  const [lastSeekPoint, setLastSeekPoint] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isRegeneratingAudio, setIsRegeneratingAudio] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  // Waveform Peaks Data
  const [wavePeaks, setWavePeaks] = useState<number[]>([]);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Image candidates and error handling state
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [isLoadingImages, setIsLoadingImages] = useState<boolean>(false);
  const [imagePage, setImagePage] = useState<number>(1);

  // References
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const wasPlayingBeforeDragRef = useRef<boolean>(false);
  const animFrameRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Image swipe references
  const imgTouchStartX = useRef<number | null>(null);
  const imgMouseStartX = useRef<number | null>(null);
  const isImgMouseDown = useRef<boolean>(false);

  // Image fetch & error handling
  const fetchDdgImages = useCallback(async (query: string, pageNum: number, isInitial: boolean) => {
    if (!query) return;

    if (isInitial && ddgImagesCache[query]) {
      const cachedUrls = ddgImagesCache[query].filter(url => !brokenImagesSet.has(url));
      setExtraImages(prev => {
        const combined = [...prev];
        cachedUrls.forEach((url: string) => {
          if (url && !combined.includes(url) && !brokenImagesSet.has(url)) {
            combined.push(url);
          }
        });
        return combined;
      });
      return;
    }

    setIsLoadingImages(true);
    try {
      const res = await fetch(`/api/images?q=${encodeURIComponent(query)}&page=${pageNum}&provider=duckduckgo`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.hits && data.hits.length > 0) {
          const newImageUrls = data.hits.slice(0, 10)
            .map((h: any) => h.largeImageURL || h.webformatURL || h.image || h.url)
            .filter((url: string) => typeof url === "string" && url.startsWith("http") && !brokenImagesSet.has(url));

          if (isInitial) {
            ddgImagesCache[query] = newImageUrls;
          }

          // Preload in background
          newImageUrls.forEach((url: string) => {
            preloadImage(url).catch(() => {
              brokenImagesSet.add(url);
            });
          });

          setExtraImages(prev => {
            const combined = [...prev];
            newImageUrls.forEach((url: string) => {
              if (url && !combined.includes(url) && !brokenImagesSet.has(url)) {
                combined.push(url);
              }
            });
            return combined;
          });
        }
      }
    } catch (err) {
      console.warn("Failed to fetch candidate images in repetition mode:", err);
    } finally {
      setIsLoadingImages(false);
    }
  }, []);

  const handleImageError = useCallback((failedUrl: string) => {
    if (!failedUrl) return;
    brokenImagesSet.add(failedUrl);

    setExtraImages(prev => {
      const filtered = prev.filter(url => url !== failedUrl && !brokenImagesSet.has(url));

      // If remaining images are low, fetch next batch seamlessly in background
      if (filtered.length < 3) {
        const nextPage = imagePage + 1;
        setImagePage(nextPage);
        const qTerm = getCardSearchQuery(card);
        if (qTerm) fetchDdgImages(qTerm, nextPage, false);
      }

      setCurrentImageIndex(prevIndex => {
        if (prevIndex >= filtered.length) {
          return Math.max(0, filtered.length - 1);
        }
        return prevIndex;
      });

      return filtered;
    });
  }, [card, imagePage, fetchDdgImages]);

  // Synchronize image candidates on card change
  useEffect(() => {
    const initialList: string[] = (card.frontImage && !brokenImagesSet.has(card.frontImage)) ? [card.frontImage] : [];

    try {
      const rawAuto = localStorage.getItem(`auto_images_${card.id}`);
      if (rawAuto) {
        const parsedAuto = JSON.parse(rawAuto);
        if (Array.isArray(parsedAuto)) {
          parsedAuto.forEach((url: string) => {
            if (url && typeof url === "string" && !initialList.includes(url) && !brokenImagesSet.has(url)) {
              initialList.push(url);
            }
          });
        }
      }
    } catch (e) {}

    if (Array.isArray(card.autoImageCandidates)) {
      card.autoImageCandidates.forEach((url: string) => {
        if (url && typeof url === "string" && !initialList.includes(url) && !brokenImagesSet.has(url)) {
          initialList.push(url);
        }
      });
    }

    setExtraImages(initialList);
    setCurrentImageIndex(0);
    setImagePage(1);

    if (initialList.length < 2) {
      const qTerm = getCardSearchQuery(card);
      if (qTerm) fetchDdgImages(qTerm, 1, true);
    }
  }, [card.id, card.frontImage, card.frontText, fetchDdgImages]);

  const handlePrevImage = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    }
  }, [currentImageIndex]);

  const handleNextImage = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentImageIndex < extraImages.length - 1) {
      const nextIdx = currentImageIndex + 1;
      setCurrentImageIndex(nextIdx);

      if (nextIdx >= extraImages.length - 1 && !isLoadingImages) {
        const nextPage = imagePage + 1;
        setImagePage(nextPage);
        const qTerm = getCardSearchQuery(card);
        if (qTerm) fetchDdgImages(qTerm, nextPage, false);
      }
    }
  }, [currentImageIndex, extraImages.length, isLoadingImages, imagePage, card, fetchDdgImages]);

  const handleImgTouchStart = (e: React.TouchEvent) => {
    imgTouchStartX.current = e.touches[0].clientX;
  };

  const handleImgTouchEnd = (e: React.TouchEvent) => {
    if (imgTouchStartX.current === null) return;
    const diffX = e.changedTouches[0].clientX - imgTouchStartX.current;
    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        handlePrevImage();
      } else {
        handleNextImage();
      }
    }
    imgTouchStartX.current = null;
  };

  const handleImgMouseDown = (e: React.MouseEvent) => {
    imgMouseStartX.current = e.clientX;
    isImgMouseDown.current = true;
  };

  const handleImgMouseUp = (e: React.MouseEvent) => {
    if (!isImgMouseDown.current || imgMouseStartX.current === null) return;
    const diffX = e.clientX - imgMouseStartX.current;
    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        handlePrevImage();
      } else {
        handleNextImage();
      }
    }
    imgMouseStartX.current = null;
    isImgMouseDown.current = false;
  };

  // Helper to format time (e.g. "00:01.4")
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 10);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${millis}`;
  };

  // Generate fallback pseudo-randomized natural waveform peaks from text string
  const generateSimulatedPeaks = useCallback((text: string, count = 80): number[] => {
    const peaks: number[] = [];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < count; i++) {
      const v = Math.abs(Math.sin((i * 0.18) + (hash % 10)) * 0.7 + Math.cos((i * 0.05) + hash) * 0.3);
      // Bell-shaped envelope for realistic speech utterance
      const envelope = Math.sin((i / (count - 1)) * Math.PI);
      peaks.push(Math.max(0.12, Math.min(1.0, (v * 0.8 + 0.2) * (0.3 + 0.7 * envelope))));
    }
    return peaks;
  }, []);

  // Decode real audio buffer into waveform peaks and exact duration using Web Audio API
  const extractPeaksFromBlob = useCallback(async (blob: Blob, barsCount = 90): Promise<{ peaks: number[]; duration: number }> => {
    try {
      const ctx = getSharedAudioContext() || new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const audioDuration = audioBuffer.duration;
      
      const rawData = audioBuffer.getChannelData(0);
      const blockSize = Math.floor(rawData.length / barsCount);
      const peaks: number[] = [];

      for (let i = 0; i < barsCount; i++) {
        const start = i * blockSize;
        let max = 0;
        for (let j = 0; j < blockSize; j++) {
          const val = Math.abs(rawData[start + j] || 0);
          if (val > max) max = val;
        }
        peaks.push(max);
      }

      // Normalize peaks
      const maxPeak = Math.max(...peaks, 0.01);
      return {
        peaks: peaks.map((p) => Math.max(0.12, p / maxPeak)),
        duration: audioDuration
      };
    } catch (e) {
      console.warn("Failed to extract exact audio peaks from AudioBuffer, using fallback:", e);
      return { peaks: [], duration: 0 };
    }
  }, []);

  // Fetch or generate audio for the card's front text
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingAudio(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLastSeekPoint(0);
    setLoopCount(0);

    // Stop current playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const frontText = card.frontText?.trim();
    const frontLang = card.frontLang || "de";

    if (!frontText) {
      setIsLoadingAudio(false);
      return;
    }

    // Set initial fallback peaks while loading
    setWavePeaks(generateSimulatedPeaks(frontText, 90));

    const loadAudio = async () => {
      try {
        const langShort = frontLang.toLowerCase().split("-")[0].split("_")[0];
        const defaultPrimary = langShort === "de" ? "de_DE-thorsten-medium" : langShort === "ar" ? "ar_JO-kareem-medium" : "en_US-lessac-medium";
        const voiceKey = reviewVoiceTarget === "secondary"
          ? (localStorage.getItem(`settings_secondary_piper_model_${langShort}`) || localStorage.getItem("settings_secondary_piper_model") || "google")
          : (localStorage.getItem(`settings_primary_piper_model_${langShort}`) || localStorage.getItem("settings_primary_piper_model") || defaultPrimary);

        let url = "";
        let foundBlob: Blob | null = null;

        // 1. TIER 1: Check if card has explicit attached audio URL (card.frontAudioUrl)
        if (card.frontAudioUrl && card.frontAudioUrl.trim()) {
          try {
            const resp = await fetch(card.frontAudioUrl);
            if (resp.ok) {
              const b = await resp.blob();
              if (b && b.size > 100) {
                foundBlob = b;
                url = URL.createObjectURL(b);
              }
            }
          } catch (e) {
            url = card.frontAudioUrl;
          }
        }

        // 2. TIER 2: Check memory cache (ttsCache)
        if (!url && !foundBlob) {
          const cacheKeys = [
            `${frontText}_${frontLang}_${voiceKey}`,
            `${frontText}_${frontLang}`,
            `${frontText}_${langShort}`,
            `gradio:${voiceKey.replace(/^gradio[:_]/i, "")}_${frontText}_${frontLang}`,
            `${frontText}_${frontLang}_gradio:${voiceKey.replace(/^gradio[:_]/i, "")}`
          ];

          for (const k of cacheKeys) {
            if (ttsCache[k]) {
              const cached = ttsCache[k];
              try {
                const resp = await fetch(cached);
                if (resp.ok) {
                  const b = await resp.blob();
                  if (b && b.size > 100) {
                    foundBlob = b;
                    url = cached;
                    break;
                  }
                }
              } catch (e) {
                url = cached;
                break;
              }
            }
          }
        }

        // 3. TIER 3: Check Browser CacheStorage (tts-audio-cache-v1 & anki-voice-cache-v1)
        // This instantly retrieves audio downloaded via "تنزيل الصوتيات" or cached during Face/Back review!
        if (!url && !foundBlob && typeof window !== "undefined" && "caches" in window) {
          const cacheNames = ["tts-audio-cache-v1", "anki-voice-cache-v1"];
          for (const cName of cacheNames) {
            if (url) break;
            try {
              const cache = await caches.open(cName);
              // Direct URL lookup
              const directUrls = [
                `/api/tts?text=${encodeURIComponent(frontText)}&lang=${frontLang}&voice=${encodeURIComponent(voiceKey)}`,
                `/api/tts?text=${encodeURIComponent(frontText)}&lang=${frontLang}`,
                `/api/tts?text=${encodeURIComponent(frontText)}&lang=${langShort}`,
                `/api/tts?text=${encodeURIComponent(frontText)}`
              ];

              for (const dUrl of directUrls) {
                const matched = await cache.match(dUrl);
                if (matched && matched.ok) {
                  const b = await matched.blob();
                  if (b && b.size > 100) {
                    foundBlob = b;
                    url = URL.createObjectURL(b);
                    // Populate memory cache
                    ttsCache[`${frontText}_${frontLang}_${voiceKey}`] = url;
                    ttsCache[`${frontText}_${frontLang}`] = url;
                    break;
                  }
                }
              }

              // If direct match didn't find, scan keys for matching text query
              if (!url) {
                const keys = await cache.keys();
                const encodedText = encodeURIComponent(frontText);
                const matchedReq = keys.find(req => 
                  req.url.includes(`text=${encodedText}`) ||
                  req.url.includes(`text=${frontText}`) ||
                  (req.url.includes(encodedText) && (req.url.includes(frontLang) || req.url.includes(langShort)))
                );
                if (matchedReq) {
                  const matched = await cache.match(matchedReq);
                  if (matched && matched.ok) {
                    const b = await matched.blob();
                    if (b && b.size > 100) {
                      foundBlob = b;
                      url = URL.createObjectURL(b);
                      ttsCache[`${frontText}_${frontLang}_${voiceKey}`] = url;
                      ttsCache[`${frontText}_${frontLang}`] = url;
                      break;
                    }
                  }
                }
              }
            } catch (cErr) {
              console.warn(`Error checking cache ${cName}:`, cErr);
            }
          }
        }

        // 4. TIER 4: If not in cache, synthesize according to user's EXACT configured engine
        const isGradioVoice = voiceKey.startsWith("gradio:") || voiceKey.startsWith("gradio_") || ["ryan", "serena", "vivian", "aiden", "eric", "dylan", "uncle_fu", "ono_anna", "sohee"].includes(voiceKey.toLowerCase());
        const ttsExecutionMode = localStorage.getItem("settings_tts_execution_mode") || "server";

        // If user explicitly configured Gradio engine
        if (!url && !foundBlob && isGradioVoice) {
          const gradioUrl = localStorage.getItem("settings_gradio_tts_url") || "http://192.168.0.159:7860";
          const voiceName = voiceKey.replace(/^gradio[:_]/i, "").trim() || "ryan";
          const customGradioLang = reviewVoiceTarget === "secondary"
            ? localStorage.getItem(`settings_secondary_gradio_lang_${langShort}`)
            : localStorage.getItem(`settings_primary_gradio_lang_${langShort}`);
          const targetGradioLang = customGradioLang || frontLang;
          const blob = await fetchGradioAudioBlob(frontText, voiceName, targetGradioLang, gradioUrl);
          if (blob && blob.size > 100) {
            foundBlob = blob;
            url = URL.createObjectURL(blob);
            ttsCache[`${frontText}_${frontLang}_${voiceKey}`] = url;
            ttsCache[`${frontText}_${frontLang}`] = url;
            if (typeof window !== "undefined" && "caches" in window) {
              try {
                const cache = await caches.open("tts-audio-cache-v1");
                await cache.put(`/api/tts?text=${encodeURIComponent(frontText)}&lang=${frontLang}&voice=${encodeURIComponent(voiceKey)}`, new Response(blob.slice(0), {
                  headers: { "Content-Type": blob.type || "audio/wav" }
                }));
              } catch (e) {}
            }
          }
        }

        // If user explicitly configured local Piper WASM execution mode
        if (!url && !foundBlob && !isGradioVoice && ttsExecutionMode === "local") {
          try {
            const piperWeb = await import("@mintplex-labs/piper-tts-web");
            if (piperWeb?.TtsSession?.WASM_LOCATIONS) {
              piperWeb.TtsSession.WASM_LOCATIONS.onnxWasm = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
            }
            let targetVoiceId = (voiceKey || "").replace(/\.onnx$/, "").trim();
            if (!targetVoiceId || targetVoiceId === "webspeech" || targetVoiceId === "local" || targetVoiceId === "google") {
              if (langShort === "de") targetVoiceId = "de_DE-thorsten-medium";
              else if (langShort === "ar") targetVoiceId = "ar_JO-kareem-medium";
              else targetVoiceId = "en_US-lessac-medium";
            }
            if (piperWeb?.TtsSession) {
              piperWeb.TtsSession._instance = null;
            }
            const blob = await piperWeb.predict({
              text: frontText,
              voiceId: targetVoiceId as any
            });
            if (blob && blob.size > 100) {
              foundBlob = blob;
              url = URL.createObjectURL(blob);
              ttsCache[`${frontText}_${frontLang}_${voiceKey}`] = url;
              ttsCache[`${frontText}_${frontLang}`] = url;
              if (typeof window !== "undefined" && "caches" in window) {
                try {
                  const cache = await caches.open("tts-audio-cache-v1");
                  await cache.put(`/api/tts?text=${encodeURIComponent(frontText)}&lang=${frontLang}&voice=${encodeURIComponent(voiceKey)}`, new Response(blob.slice(0), {
                    headers: { "Content-Type": "audio/wav" }
                  }));
                } catch (e) {}
              }
            }
          } catch (piperErr) {
            console.warn("Local Piper generation error:", piperErr);
          }
        }

        // Standard preloadTTS / Server API TTS fallback
        if (!url && !foundBlob) {
          url = await preloadTTS(frontText, frontLang, voiceKey);
        }

        if (isCancelled) return;

        if (foundBlob) {
          setAudioBlob(foundBlob);
          const { peaks: realPeaks, duration: realDuration } = await extractPeaksFromBlob(foundBlob, 90);
          if (!isCancelled) {
            if (realPeaks.length > 0) setWavePeaks(realPeaks);
            if (realDuration > 0) setDuration(realDuration);
          }
        }

        if (url) {
          setAudioUrl(url);

          // Eagerly probe metadata for instant duration before playback
          const probe = new Audio(url);
          probe.addEventListener("loadedmetadata", () => {
            if (!isCancelled && probe.duration && isFinite(probe.duration) && probe.duration > 0) {
              setDuration(probe.duration);
            }
          });

          // If blob wasn't extracted yet, fetch from url to get exact peaks
          if (!foundBlob) {
            try {
              const resp = await fetch(url);
              if (resp.ok) {
                const blob = await resp.blob();
                if (!isCancelled && blob && blob.size > 100) {
                  setAudioBlob(blob);
                  const { peaks: realPeaks, duration: realDuration } = await extractPeaksFromBlob(blob, 90);
                  if (!isCancelled) {
                    if (realPeaks.length > 0) setWavePeaks(realPeaks);
                    if (realDuration > 0) setDuration(realDuration);
                  }
                }
              }
            } catch (blobErr) {
              console.warn("Could not fetch blob for waveform visualization:", blobErr);
            }
          }
        }
      } catch (err) {
        console.error("Error loading repetition audio:", err);
      } finally {
        if (!isCancelled) {
          setIsLoadingAudio(false);
        }
      }
    };

    loadAudio();

    return () => {
      isCancelled = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [card.id, card.frontText, card.frontLang, reviewVoiceTarget, generateSimulatedPeaks, extractPeaksFromBlob]);

  // Handle Play / Pause
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || isLoadingAudio) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // If at or very close to the end, restart from beginning
      if (audioRef.current.ended || (duration > 0 && audioRef.current.currentTime >= duration - 0.05)) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
      }
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((e) => {
            console.warn("Audio playback interrupted or blocked:", e);
            setIsPlaying(false);
          });
      }
    }
  }, [isPlaying, isLoadingAudio, duration]);

  // Seek to specific time
  const seekToTime = useCallback((time: number, autoPlay = true) => {
    if (!audioRef.current) return;
    const currentDur = duration || (audioRef.current && isFinite(audioRef.current.duration) ? audioRef.current.duration : 100);
    const clampedTime = Math.max(0, Math.min(currentDur, time));
    audioRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
    setLastSeekPoint(clampedTime);

    if (autoPlay) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  }, [duration]);

  // Replay from last seek marker or 0
  const replayFromMarker = useCallback(() => {
    seekToTime(lastSeekPoint, true);
  }, [lastSeekPoint, seekToTime]);

  // Replay from start
  const replayFromStart = useCallback(() => {
    seekToTime(0, true);
  }, [seekToTime]);

  // Regenerate audio / Request a new voice synthesis for current front text
  const handleRegenerateAudio = useCallback(async () => {
    if (isRegeneratingAudio || isLoadingAudio) return;

    const frontText = card.frontText?.trim();
    const frontLang = card.frontLang || "de";
    if (!frontText) return;

    setIsRegeneratingAudio(true);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    try {
      const langShort = frontLang.toLowerCase().split("-")[0].split("_")[0];
      const voiceKey = reviewVoiceTarget === "secondary"
        ? (localStorage.getItem(`settings_secondary_piper_model_${langShort}`) || localStorage.getItem("settings_secondary_piper_model") || "google")
        : (localStorage.getItem(`settings_primary_piper_model_${langShort}`) || localStorage.getItem("settings_primary_piper_model") || (langShort === "de" ? "de_DE-thorsten-medium" : "en_US-lessac-medium"));

      // Clear memory cache keys
      const cacheKey = voiceKey ? `${frontText}_${frontLang}_${voiceKey}` : `${frontText}_${frontLang}`;
      delete ttsCache[cacheKey];
      delete ttsCache[`${frontText}_${frontLang}`];

      // Clear persistent Cache Storage for this text
      if ("caches" in window) {
        try {
          const cache = await caches.open("tts-audio-cache-v1");
          const keys = await cache.keys();
          for (const req of keys) {
            if (req.url.includes(encodeURIComponent(frontText)) || req.url.includes(frontText)) {
              await cache.delete(req);
            }
          }
        } catch (cErr) {
          console.warn("Could not purge persistent TTS cache:", cErr);
        }
      }

      let newUrl = "";
      let newBlob: Blob | null = null;

      const isGradioVoice = voiceKey.startsWith("gradio:") || voiceKey.startsWith("gradio_") || ["ryan", "serena", "vivian", "aiden", "eric", "dylan", "uncle_fu", "ono_anna", "sohee"].includes(voiceKey.toLowerCase());

      if (isGradioVoice) {
        const gradioUrl = localStorage.getItem("settings_gradio_tts_url") || "http://192.168.0.159:7860";
        const voiceName = voiceKey.replace(/^gradio[:_]/i, "").trim() || "ryan";
        const customGradioLang = localStorage.getItem(`settings_primary_gradio_lang_${langShort}`) || frontLang;
        newBlob = await fetchGradioAudioBlob(frontText, voiceName, customGradioLang, gradioUrl);
        if (newBlob) {
          newUrl = URL.createObjectURL(newBlob);
        }
      }

      if (!newUrl) {
        // Fetch fresh audio from API with nocache timestamp parameter
        const voiceParam = voiceKey ? `&voice=${encodeURIComponent(voiceKey)}` : "";
        const url = `/api/tts?text=${encodeURIComponent(frontText)}&lang=${frontLang}${voiceParam}&_nocache=${Date.now()}`;
        const res = await fetch(url);
        if (res.ok) {
          newBlob = await res.blob();
          if (newBlob && newBlob.size > 100) {
            newUrl = URL.createObjectURL(newBlob);
          }
        }
      }

      if (!newUrl) {
        // Fallback to preloadTTS
        newUrl = await preloadTTS(frontText, frontLang, voiceKey);
      }

      if (newUrl) {
        setAudioUrl(newUrl);
        setCurrentTime(0);
        setLastSeekPoint(0);

        if (newBlob) {
          setAudioBlob(newBlob);
          const { peaks: realPeaks, duration: realDuration } = await extractPeaksFromBlob(newBlob, 90);
          if (realPeaks.length > 0) setWavePeaks(realPeaks);
          if (realDuration > 0) setDuration(realDuration);
        } else {
          try {
            const resp = await fetch(newUrl);
            if (resp.ok) {
              const b = await resp.blob();
              setAudioBlob(b);
              const { peaks: realPeaks, duration: realDuration } = await extractPeaksFromBlob(b, 90);
              if (realPeaks.length > 0) setWavePeaks(realPeaks);
              if (realDuration > 0) setDuration(realDuration);
            }
          } catch (e) {}
        }

        // Eagerly probe metadata for instant duration
        const probe = new Audio(newUrl);
        probe.addEventListener("loadedmetadata", () => {
          if (probe.duration && isFinite(probe.duration) && probe.duration > 0) {
            setDuration(probe.duration);
          }
        });
      }
    } catch (err) {
      console.error("Failed to regenerate audio:", err);
    } finally {
      setIsRegeneratingAudio(false);
    }
  }, [isRegeneratingAudio, isLoadingAudio, card, reviewVoiceTarget, extractPeaksFromBlob]);

  // Calculate time from client X coordinate
  const getTimeFromClientX = useCallback((clientX: number) => {
    const currentDur = duration || (audioRef.current && isFinite(audioRef.current.duration) ? audioRef.current.duration : 0);
    if (!waveformContainerRef.current || !currentDur) return 0;
    const rect = waveformContainerRef.current.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, offsetX / rect.width));
    return percentage * currentDur;
  }, [duration]);

  // Start dragging playhead (mouse or touch)
  const startDragging = useCallback((clientX: number) => {
    const currentDur = duration || (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0 ? audioRef.current.duration : 0);
    if (!currentDur || isLoadingAudio) return;

    isDraggingRef.current = true;
    setIsDragging(true);
    wasPlayingBeforeDragRef.current = isPlaying;

    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
    }

    const targetTime = getTimeFromClientX(clientX);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
    setCurrentTime(targetTime);
    setLastSeekPoint(targetTime);

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current) return;
      const x = "touches" in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const newTime = getTimeFromClientX(x);
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
      }
      setCurrentTime(newTime);
      setLastSeekPoint(newTime);
    };

    const handleEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);

      if (wasPlayingBeforeDragRef.current && audioRef.current) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
  }, [duration, isLoadingAudio, isPlaying, getTimeFromClientX]);

  // Handle clicking or mouse down on waveform
  const handleWaveformMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    startDragging(e.clientX);
  };

  const handleWaveformTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      startDragging(e.touches[0].clientX);
    }
  };

  // Handle hovering over waveform
  const handleWaveformMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const currentDur = duration || (audioRef.current && isFinite(audioRef.current.duration) ? audioRef.current.duration : 0);
    if (isDraggingRef.current || !waveformContainerRef.current || !currentDur) return;
    const rect = waveformContainerRef.current.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, hoverX / rect.width));
    setHoverTime(percentage * currentDur);
  };

  const handleWaveformMouseLeave = () => {
    if (!isDraggingRef.current) {
      setHoverTime(null);
    }
  };

  // Keep animated current time in sync
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio) {
        setCurrentTime(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration)) {
          setDuration(audio.duration);
        }
      }
      if (isPlaying) {
        animFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(updateProgress);
    } else if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Audio ended handler - keep waveform fully highlighted on completion
  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    if (isLooping) {
      setLoopCount((prev) => prev + 1);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          setCurrentTime(0);
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      }, 300); // Clean 300ms pause between loops for natural shadowing
    } else {
      // Keep entire waveform fully colored (at 100% / duration) when playback ends
      const endDuration = duration || (audioRef.current && isFinite(audioRef.current.duration) ? audioRef.current.duration : 0);
      if (endDuration > 0) {
        setCurrentTime(endDuration);
      }
    }
  }, [isLooping, duration]);

  // Audio event bindings
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      handleAudioEnded();
    };

    const onPlay = () => {
      setIsPlaying(true);
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    const onTimeUpdate = () => {
      if (!isDraggingRef.current) {
        setCurrentTime(audio.currentTime);
      }
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [audioUrl, handleAudioEnded]);

  // Update playback speed and volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Copy Front Text
  const handleCopyText = () => {
    if (card.frontText) {
      navigator.clipboard.writeText(card.frontText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Keyboard Shortcuts (Space: Play/Pause, R: Replay, 1: Repeat, 2: Know, Left/Right: Navigate)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid hotkeys if an input or textarea is focused
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === "r" || e.key === "R" || e.key === "ق") {
        e.preventDefault();
        replayFromMarker();
      } else if (e.key === "l" || e.key === "L" || e.key === "م") {
        setIsLooping((prev) => !prev);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "1") {
        e.preventDefault();
        onRepeat();
      } else if (e.key === "2") {
        e.preventDefault();
        onKnow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayPause, replayFromMarker, onNext, onPrev, onRepeat, onKnow]);

  // Saved chat messages count for current card
  const savedChatCount = useMemo(() => {
    try {
      const saved = localStorage.getItem(`review_chat_history_${card.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch (e) {}
    return 0;
  }, [card.id, isChatOpen]);

  // Article color detection
  const detectedArticle = useMemo(() => {
    if (card.correctArticle && (card.correctArticle.toLowerCase() === "der" || card.correctArticle.toLowerCase() === "die" || card.correctArticle.toLowerCase() === "das")) {
      return card.correctArticle.toLowerCase();
    }
    const front = card.frontText?.trim().toLowerCase() || "";
    if (front.startsWith("der ") || front === "der") return "der";
    if (front.startsWith("die ") || front === "die") return "die";
    if (front.startsWith("das ") || front === "das") return "das";
    return null;
  }, [card.frontText, card.correctArticle]);

  const articleBadgeStyle = useMemo(() => {
    if (detectedArticle === "der") return "bg-blue-600 text-white border-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.5)]";
    if (detectedArticle === "die") return "bg-rose-600 text-white border-rose-400 shadow-[0_0_10px_rgba(225,29,72,0.5)]";
    if (detectedArticle === "das") return "bg-emerald-600 text-white border-emerald-400 shadow-[0_0_10px_rgba(5,150,105,0.5)]";
    return "bg-purple-600 text-white border-purple-400";
  }, [detectedArticle]);

  const articleColor = useMemo(() => {
    const front = card.frontText?.trim().toLowerCase() || "";
    if (front.startsWith("der ") || card.correctArticle === "der") return "text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/5";
    if (front.startsWith("die ") || card.correctArticle === "die") return "text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/5";
    if (front.startsWith("das ") || card.correctArticle === "das") return "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5";
    return "text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/5";
  }, [card.frontText, card.correctArticle]);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4 select-none">
      {/* Hidden native audio element with explicit event hooks */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (d && !isNaN(d) && isFinite(d) && d > 0) setDuration(d);
          }}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (d && !isNaN(d) && isFinite(d) && d > 0) setDuration(d);
          }}
          onCanPlay={(e) => {
            const d = e.currentTarget.duration;
            if (d && !isNaN(d) && isFinite(d) && d > 0) setDuration(d);
          }}
          onLoadedData={(e) => {
            const d = e.currentTarget.duration;
            if (d && !isNaN(d) && isFinite(d) && d > 0) setDuration(d);
          }}
          onTimeUpdate={(e) => {
            if (!isDraggingRef.current) {
              setCurrentTime(e.currentTarget.currentTime);
            }
          }}
          onEnded={handleAudioEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}

      {/* Main 50% / 50% Split Screen Layout */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch min-h-[480px] lg:min-h-[540px]">
        {/* HALF 1 (50%): Image Screen Container - strictly rounded-none with Auto-Skip on broken/blocked images & candidate carousel */}
        <div 
          className="w-full h-full min-h-[300px] md:min-h-[480px] bg-slate-950 border-2 border-slate-800 rounded-none relative overflow-hidden flex flex-col justify-between p-4 group select-none cursor-grab active:cursor-grabbing"
          onTouchStart={handleImgTouchStart}
          onTouchEnd={handleImgTouchEnd}
          onMouseDown={handleImgMouseDown}
          onMouseUp={handleImgMouseUp}
        >
          {extraImages.length > 0 && extraImages[currentImageIndex] ? (
            <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center bg-black/40">
              <ImageWithSkeleton
                src={extraImages[currentImageIndex]}
                alt={card.frontText}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 select-none pointer-events-none"
                style={currentImageIndex === 0 && card.frontImage ? getSafeImageStyle(card.frontImagePosition) : { objectFit: "cover" }}
                referrerPolicy="no-referrer"
                loading="eager"
                fetchPriority="high"
                onError={handleImageError}
              />
              {/* Dark gradient overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

              {/* Navigation arrows (appear on hover or touch) */}
              {extraImages.length > 1 && (
                <>
                  {currentImageIndex > 0 && (
                    <button
                      type="button"
                      onClick={handlePrevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-none bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-20 border border-white/20 cursor-pointer active:scale-95"
                      title="الصورة السابقة"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  {currentImageIndex < extraImages.length - 1 && (
                    <button
                      type="button"
                      onClick={handleNextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-none bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-20 border border-white/20 cursor-pointer active:scale-95"
                      title="الصورة التالية"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </>
              )}

              {/* Micro counter indicator & search spinner */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-20 pointer-events-none select-none bg-black/60 backdrop-blur-md text-[11px] text-white/95 px-2.5 py-1 rounded-none font-mono border border-white/10 shadow-sm">
                {isLoadingImages && (
                  <RefreshCw className="w-3 h-3 animate-spin text-purple-400" />
                )}
                <span>
                  {`${currentImageIndex + 1}/${extraImages.length}`}
                </span>
              </div>
            </div>
          ) : isLoadingImages ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-3" />
              <p className="text-xs font-mono font-bold text-slate-400">جاري فحص وتجهيز الصور التوضيحية...</p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-900 via-purple-950/40 to-slate-900">
              <div className="w-20 h-20 border-2 border-purple-500/40 bg-purple-500/10 flex items-center justify-center mb-4 rounded-none text-purple-400">
                <Music className="w-10 h-10 animate-pulse" />
              </div>
              <p className="text-sm font-bold text-slate-400 max-w-xs font-mono">
                {card.frontLang ? card.frontLang.toUpperCase() : "AUDIO"} FLASHCARD
              </p>
              <p className="text-xs text-slate-500 mt-1">
                تدريب النطق والترديد السمعي المباشر
              </p>
            </div>
          )}

          {/* Top Floating Badge on Image (German Article der/die/das only if exists) */}
          {detectedArticle && (
            <div className="relative z-10 flex items-center justify-start w-full">
              <span className={`px-3 py-1 font-mono font-black text-xs uppercase tracking-wider rounded-none border ${articleBadgeStyle}`}>
                {detectedArticle}
              </span>
            </div>
          )}
        </div>

        {/* HALF 2 (50%): Audio Player, Front Text & Waveform Track - strictly rounded-none, no border, padding, or background */}
        <div className="w-full h-full min-h-[300px] md:min-h-[480px] bg-transparent text-white border-0 p-0 rounded-none flex flex-col justify-between shadow-none">
          {/* Top Section: Master Audio Box + Front Text */}
          <div className="flex flex-col gap-3">
            {/* Master Audio Box: Tools directly on top of the waveform track without outer background */}
            <div className="flex flex-col gap-2.5 bg-transparent rounded-none" dir="ltr">
              {/* Top Row of Audio Box: Toolbar Buttons directly above waveform */}
              <div className="w-full flex items-center justify-between gap-1 sm:gap-2 pb-1 border-b border-slate-800/80 flex-wrap">
                {/* Control Tools Buttons */}
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                  {/* 1. Main Play / Pause */}
                  <button
                    onClick={togglePlayPause}
                    disabled={isLoadingAudio}
                    className="w-8 h-8 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white border border-purple-400 rounded-none flex items-center justify-center cursor-pointer transition-all disabled:opacity-50"
                    title={isPlaying ? "إيقاف مؤقت (مسافة)" : "تشغيل الصوت (مسافة)"}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                  </button>

                  {/* 2. Replay from Marker */}
                  <button
                    onClick={replayFromMarker}
                    disabled={isLoadingAudio}
                    className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-purple-200 border border-slate-700 rounded-none flex items-center justify-center transition-all cursor-pointer"
                    title="إعادة من النقطة المحددة (R)"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  {/* 3. Replay from Start */}
                  <button
                    onClick={replayFromStart}
                    disabled={isLoadingAudio}
                    className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-none flex items-center justify-center transition-all cursor-pointer"
                    title="إعادة من البداية"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  {/* 4. Loop / Shadowing */}
                  <button
                    onClick={() => setIsLooping(!isLooping)}
                    className={`w-8 h-8 border rounded-none flex items-center justify-center transition-all cursor-pointer ${
                      isLooping
                        ? "bg-emerald-600 text-white border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
                    }`}
                    title={isLooping ? "إيقاف التكرار المستمر (L)" : "تفعيل التكرار المستمر (L)"}
                  >
                    <Repeat className="w-4 h-4" />
                  </button>

                  {/* 5. Regenerate Audio (AI Re-synthesis) */}
                  <button
                    onClick={handleRegenerateAudio}
                    disabled={isLoadingAudio || isRegeneratingAudio}
                    className={`w-8 h-8 border rounded-none flex items-center justify-center transition-all cursor-pointer ${
                      isRegeneratingAudio
                        ? "bg-purple-900/70 border-purple-400 text-purple-200 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                        : "bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-purple-100 border-slate-700"
                    } disabled:opacity-50`}
                    title={isRegeneratingAudio ? "جاري توليد نطق صوتي جديد..." : "طلب صوت جديد / إعادة توليد النطق الصوتي"}
                  >
                    {isRegeneratingAudio ? (
                      <Loader2 className="w-4 h-4 animate-spin text-purple-300" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </button>

                  {/* 6. Voice Target Toggle */}
                  {isSecondaryAudioEnabled && onToggleVoiceTarget && (
                    <button
                      onClick={onToggleVoiceTarget}
                      className={`w-8 h-8 border rounded-none flex items-center justify-center transition-all cursor-pointer ${
                        reviewVoiceTarget === "secondary"
                          ? "bg-amber-500 text-slate-950 border-amber-400 font-bold"
                          : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                      }`}
                      title={reviewVoiceTarget === "secondary" ? "الصوت الحالي: الثانوي ⚡ (انقر للأساسي)" : "الصوت الحالي: الأساسي (انقر للثانوي)"}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* 6. Playback Speed Selector */}
                  <button
                    onClick={() => {
                      const speeds = [0.5, 0.75, 1.0, 1.25];
                      const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
                      setPlaybackSpeed(speeds[nextIdx]);
                    }}
                    className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white border border-slate-700 rounded-none transition-all cursor-pointer flex items-center justify-center overflow-hidden p-0"
                    title={`سرعة الصوت: ${playbackSpeed} (انقر للتبديل بين 0.5, 0.75, 1, 1.25)`}
                  >
                    <span className="text-[11px] font-mono font-black tracking-tight leading-none text-center whitespace-nowrap">
                      {playbackSpeed}
                    </span>
                  </button>

                  {/* 7. Reveal / Hide Translation */}
                  <button
                    onClick={() => setShowBackText(!showBackText)}
                    className={`w-8 h-8 border rounded-none flex items-center justify-center transition-all cursor-pointer ${
                      showBackText
                        ? "bg-purple-950/70 text-purple-300 border-purple-500/50"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700 hover:text-slate-200"
                    }`}
                    title={showBackText ? "إخفاء المعنى والترجمة" : "كشف المعنى والترجمة"}
                  >
                    {showBackText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>

                  {/* 8. Mute / Unmute */}
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`w-8 h-8 border rounded-none flex items-center justify-center transition-all cursor-pointer ${
                      isMuted
                        ? "bg-rose-950/70 text-rose-400 border-rose-600"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:text-white"
                    }`}
                    title={isMuted ? "إلغاء كتم الصوت" : "كتم الصوت"}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  {/* 9. Copy Text */}
                  <button
                    onClick={handleCopyText}
                    className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-none flex items-center justify-center transition-all cursor-pointer"
                    title="نسخ النص"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>

                  {/* 10. AI Chat / Discussion Tutor Button (Matches Face & Back mode) */}
                  <button
                    onClick={() => {
                      if (onOpenChat) {
                        onOpenChat();
                      } else {
                        setIsChatOpen(true);
                      }
                    }}
                    className={`w-8 h-8 border rounded-none flex items-center justify-center transition-all cursor-pointer relative shadow-sm ${
                      savedChatCount > 0
                        ? "bg-indigo-900/80 hover:bg-indigo-850 text-indigo-200 border-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                        : "bg-indigo-950/60 hover:bg-indigo-900/70 text-indigo-400 border-indigo-600/40 hover:border-indigo-500/70"
                    }`}
                    title={savedChatCount > 0 ? `محادثات البطاقة (${savedChatCount} رسائل محفوظة) - مناقشة واستفسار بالذكاء الاصطناعي` : "مناقشة واستفسار بالذكاء الاصطناعي والمصحح اللغوي (محادثة الكرت AI)"}
                  >
                    <Bot className="w-4 h-4 text-indigo-300" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-none bg-indigo-500 animate-pulse" />
                    {savedChatCount > 0 && (
                      <span className="absolute -bottom-1 -right-1 px-1 bg-indigo-600 text-[9px] font-bold text-white leading-none rounded-none border border-indigo-400 shadow-xs">
                        {savedChatCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Time Indicators & Loop status inside audio box header */}
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 ml-auto">
                  <div className="flex items-center gap-1.5 bg-transparent px-2 py-1 border border-slate-800">
                    <span className="text-purple-400 font-bold text-sm">
                      {formatTime(currentTime)}
                    </span>
                    <span>/</span>
                    <span>{formatTime(duration)}</span>
                  </div>

                  {isLooping && (
                    <span className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold font-sans">
                      تكرار {loopCount > 0 ? `(${loopCount})` : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Interactive Waveform Container (Strictly LTR, No rounded borders, Draggable playhead) */}
              <div
                ref={waveformContainerRef}
                onMouseDown={handleWaveformMouseDown}
                onTouchStart={handleWaveformTouchStart}
                onMouseMove={handleWaveformMouseMove}
                onMouseLeave={handleWaveformMouseLeave}
                dir="ltr"
                className={`relative w-full h-20 sm:h-24 bg-transparent border border-slate-700 rounded-none flex flex-row items-center justify-between px-1 gap-[2px] overflow-hidden group/wave select-none ${
                  isDragging ? "cursor-grabbing" : "cursor-pointer"
                }`}
                title="انقر أو اسحب الخط لتحديد موضع الصوت"
              >
                {/* Playback progress background tint (Starts strictly from Left, silky smooth 60fps sync) */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-purple-500/20 pointer-events-none"
                  style={{
                    width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                    willChange: "width"
                  }}
                />

                {/* Cursor / Playhead Line - Clean continuous vertical laser line */}
                <div
                  className="absolute top-0 bottom-0 w-[2.5px] bg-purple-400 shadow-[0_0_12px_#c084fc] pointer-events-none z-20"
                  style={{
                    left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                    transform: "translateX(-50%)",
                    willChange: "left"
                  }}
                />

                {/* Waveform Bars (Rendered from Left [start] to Right [end]) */}
                {wavePeaks.map((peak, idx) => {
                  const barProgress = (idx + 0.5) / wavePeaks.length;
                  const currentProgress = duration > 0 ? currentTime / duration : 0;
                  const isPassed = barProgress <= currentProgress;

                  return (
                    <div
                      key={idx}
                      className="flex-1 h-full flex items-center justify-center pointer-events-none"
                    >
                      <div
                        className={`w-full ${
                          isPassed
                            ? "bg-purple-400 shadow-[0_0_4px_rgba(192,132,252,0.5)]"
                            : "bg-slate-700 group-hover/wave:bg-slate-600"
                        }`}
                        style={{
                          height: `${Math.max(10, peak * 85)}%`,
                          minWidth: "2px"
                        }}
                      />
                    </div>
                  );
                })}

                {/* Loading Overlay */}
                {isLoadingAudio && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center gap-2 z-30 font-sans text-xs text-purple-300">
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                    <span>جاري معالجة وتجهيز المقطع الصوتي...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Prominent Front Text - strictly LTR (Left-to-Right) */}
            <div className="py-2 text-left" dir="ltr">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tight text-white leading-relaxed select-text text-left">
                {card.frontText}
              </h2>
              {card.translationHint && (
                <p className="text-xs text-slate-400 font-medium mt-1 text-right" dir="rtl">
                  💡 {card.translationHint}
                </p>
              )}
            </div>

            {/* Revealed Back Text box if active */}
            {showBackText && (
              <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-none text-right animate-in fade-in duration-200">
                <span className="text-[10px] text-purple-300 font-mono block mb-0.5">المعنى العربي:</span>
                <p className="text-base font-bold text-purple-100">{card.backText}</p>
              </div>
            )}
          </div>

          {/* Bottom Section: Unified Single-Row Assessment & Navigation Controls (Strictly rounded-none, equal height) */}
          <div className="pt-2 border-t border-slate-800">
            <div className="w-full grid grid-cols-[1fr_auto_auto_auto_1fr] items-stretch gap-2">
              {/* 1. البطاقة السابقة */}
              <button
                onClick={onPrev}
                disabled={currentIndex === 0}
                className="h-11 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-none text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:pointer-events-none transition-all shadow-2xs"
                title="البطاقة السابقة (السهم الأيمن)"
              >
                <ArrowRight className="w-4 h-4 shrink-0" />
                <span className="truncate">السابقة</span>
              </button>

              {/* 2. أحتاج دراستها (أيقونة إعادة فقط) */}
              <button
                onClick={onRepeat}
                className="h-11 w-12 bg-rose-950/50 hover:bg-rose-900/70 text-rose-300 border-2 border-rose-800/80 rounded-none flex items-center justify-center cursor-pointer active:scale-98 transition-all shadow-xs"
                title="أحتاج دراستها وتكرارها (اختصار: 1)"
              >
                <RotateCcw className="w-5 h-5 text-rose-400" />
              </button>

              {/* 3. مربع العدد */}
              <div className="h-11 px-4 bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-slate-400 flex items-center justify-center text-center select-none min-w-[70px]">
                {currentIndex + 1} / {totalCards}
              </div>

              {/* 4. أتقنت (أيقونة صح فقط) */}
              <button
                onClick={onKnow}
                className="h-11 w-12 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border-2 border-emerald-600 rounded-none flex items-center justify-center cursor-pointer active:scale-98 transition-all shadow-md"
                title="أتقنت البطاقة والترديد (اختصار: 2)"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </button>

              {/* 5. البطاقة التالية */}
              <button
                onClick={onNext}
                disabled={currentIndex >= totalCards - 1}
                className="h-11 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-none text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:pointer-events-none transition-all shadow-2xs"
                title="البطاقة التالية (السهم الأيسر)"
              >
                <span className="truncate">التالية</span>
                <ArrowLeft className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive AI Review Mode Chat & Corrector Modal */}
      {isChatOpen && (
        <ReviewChatModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          card={card}
          previousCards={previousCards || []}
          nextCards={nextCards || []}
          folderInfo={folderInfo}
          onPlayPronunciation={(text, lang) => {
            if (reviewVoiceTarget === "secondary") {
              const langShort = (lang || card.frontLang || "de").toLowerCase().split("-")[0];
              const secVoice = localStorage.getItem(`settings_secondary_piper_model_${langShort}`) || localStorage.getItem("settings_secondary_piper_model") || "google";
              speakClient(text, lang || card.frontLang || "de", secVoice);
            } else {
              speakClient(text, lang || card.frontLang || "de");
            }
          }}
        />
      )}
    </div>
  );
};

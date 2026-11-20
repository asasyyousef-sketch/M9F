import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Scissors,
  Play,
  Pause,
  Plus,
  Trash2,
  Check,
  X,
  RefreshCw,
  Volume2,
  AlertCircle,
  Crosshair
} from "lucide-react";
import { SubtitleCue } from "../types";
import {
  MediaPlaybackSnapshot,
  PlaybackClockState,
  createPlaybackClockState,
  beginPlaybackSeekHold,
  stepMonotonicPlaybackClock
} from "../utils/audioRecording";
import {
  getMediaSegmentPeaks,
  generateSimulatedPeaks
} from "./ShadowingStudioModal";

export interface SplitPieceDraft {
  id: string;
  startOffset: number; // relative to cue.startTime (seconds)
  endOffset: number;   // relative to cue.startTime (seconds)
  text: string;
}

export interface CueSplitModalProps {
  cue: SubtitleCue;
  mediaUrl?: string;
  activeTrackLabel: string;
  secondaryTrackLabel?: string;
  initialSyncSecondary: boolean;
  isPlaying: boolean;
  getPlaybackSnapshot: () => MediaPlaybackSnapshot;
  onPlaySegment: (startTime: number, endTime: number) => void;
  onStopSegment: () => void;
  onSaveSplit: (originalCueId: string, splitCues: SubtitleCue[], syncSecondary: boolean) => void;
  onClose: () => void;
}

const PIECE_PALETTE = [
  { hex: "#38bdf8", fill: "rgba(56, 189, 248, 0.16)", border: "border-sky-500/70", text: "text-sky-300", badge: "bg-sky-500" },
  { hex: "#34d399", fill: "rgba(52, 211, 153, 0.16)", border: "border-emerald-500/70", text: "text-emerald-300", badge: "bg-emerald-500" },
  { hex: "#fbbf24", fill: "rgba(251, 191, 36, 0.16)", border: "border-amber-500/70", text: "text-amber-300", badge: "bg-amber-500" },
  { hex: "#a78bfa", fill: "rgba(167, 139, 250, 0.16)", border: "border-violet-500/70", text: "text-violet-300", badge: "bg-violet-500" },
  { hex: "#fb7185", fill: "rgba(251, 113, 133, 0.16)", border: "border-rose-500/70", text: "text-rose-300", badge: "bg-rose-500" },
  { hex: "#22d3ee", fill: "rgba(34, 211, 238, 0.16)", border: "border-cyan-500/70", text: "text-cyan-300", badge: "bg-cyan-500" }
];

function formatRelTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

function detectDirection(text: string): "rtl" | "ltr" {
  if (!text) return "ltr";
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text) ? "rtl" : "ltr";
}

function roundTenth(n: number): number {
  return Math.round(n * 10) / 10;
}

export const CueSplitModal: React.FC<CueSplitModalProps> = ({
  cue,
  mediaUrl,
  activeTrackLabel,
  secondaryTrackLabel,
  initialSyncSecondary,
  isPlaying,
  getPlaybackSnapshot,
  onPlaySegment,
  onStopSegment,
  onSaveSplit,
  onClose
}) => {
  const segmentDuration = Math.max(0.4, roundTenth(cue.endTime - cue.startTime));
  const originalWords = useMemo(
    () => cue.text.trim().split(/\s+/).filter(Boolean),
    [cue.text]
  );

  // Initialize with minimum 2 pieces
  const [pieces, setPieces] = useState<SplitPieceDraft[]>(() => {
    const midTime = roundTenth(segmentDuration / 2);
    const words = cue.text.trim().split(/\s+/).filter(Boolean);
    const midWord = words.length > 1 ? Math.max(1, Math.ceil(words.length / 2)) : words.length;
    const part1Text = words.length > 1 ? words.slice(0, midWord).join(" ") : cue.text.trim();
    const part2Text = words.length > 1 ? words.slice(midWord).join(" ") : "";

    return [
      {
        id: `part-1-${Date.now()}`,
        startOffset: 0,
        endOffset: Math.max(0.2, midTime),
        text: part1Text
      },
      {
        id: `part-2-${Date.now() + 1}`,
        startOffset: Math.min(segmentDuration - 0.2, Math.max(0.2, midTime)),
        endOffset: segmentDuration,
        text: part2Text
      }
    ];
  });

  const [activePieceIndex, setActivePieceIndex] = useState<number>(0);
  const [syncSecondary, setSyncSecondary] = useState<boolean>(initialSyncSecondary);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [playingMode, setPlayingMode] = useState<"none" | "full" | number>("none");

  // Waveform peaks for the entire sentence
  const [peaks, setPeaks] = useState<number[]>(() => generateSimulatedPeaks(cue.text, 80));

  useEffect(() => {
    let cancelled = false;
    if (mediaUrl) {
      getMediaSegmentPeaks(mediaUrl, cue.startTime, cue.endTime, 80).then((realPeaks) => {
        if (!cancelled && realPeaks.length > 0) {
          setPeaks(realPeaks);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [mediaUrl, cue.startTime, cue.endTime]);

  // Cleanup playback on unmount
  useEffect(() => {
    return () => {
      onStopSegment();
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      setPlayingMode("none");
    }
  }, [isPlaying]);

  // Canvas & PLL Playhead state (zero React re-renders during playback or handle drag)
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef<{ width: number; height: number; dpr: number }>({ width: 0, height: 0, dpr: 1 });
  const playheadOffsetRef = useRef<number>(0);
  const playheadTextRef = useRef<HTMLSpanElement | null>(null);
  const clockRef = useRef<PlaybackClockState>(createPlaybackClockState(cue.startTime));
  const animRef = useRef<number | null>(null);

  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const activePieceIndexRef = useRef(activePieceIndex);
  activePieceIndexRef.current = activePieceIndex;
  const peaksRef = useRef(peaks);
  peaksRef.current = peaks;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Dragging handles on waveform canvas ("start" | "end" | "scrub" | null)
  const dragModeRef = useRef<"start" | "end" | "scrub" | null>(null);
  const dragRangeRef = useRef<{ start: number; end: number } | null>(null);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height, dpr } = sizeRef.current;
    if (width <= 0 || height <= 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const padX = 12;
    const innerW = Math.max(20, width - padX * 2);
    const barList = peaksRef.current;
    const count = barList.length || 80;
    const gap = 2;
    const barW = Math.max(1.5, (innerW - gap * (count - 1)) / count);
    const radius = Math.min(barW / 2, 2.5);
    const topBand = 16;
    const waveTop = topBand + 4;
    const waveHeight = Math.max(24, height - waveTop - 16);
    const centerY = waveTop + waveHeight / 2;

    const allPieces = piecesRef.current;
    const activeIdx = Math.min(activePieceIndexRef.current, allPieces.length - 1);
    const activeColor = PIECE_PALETTE[activeIdx % PIECE_PALETTE.length];

    const timeToX = (offsetSec: number) =>
      padX + Math.max(0, Math.min(1, offsetSec / segmentDuration)) * innerW;

    // 1. Draw subtle background bands for all pieces
    allPieces.forEach((p, idx) => {
      const palette = PIECE_PALETTE[idx % PIECE_PALETTE.length];
      const range =
        idx === activeIdx && dragRangeRef.current
          ? dragRangeRef.current
          : { start: p.startOffset, end: p.endOffset };

      const x1 = timeToX(range.start);
      const x2 = timeToX(range.end);
      const w = Math.max(2, x2 - x1);

      ctx.fillStyle = palette.fill;
      ctx.globalAlpha = idx === activeIdx ? 1.0 : 0.32;
      ctx.fillRect(x1, topBand, w, height - topBand);
      ctx.globalAlpha = 1.0;

      // Top index label pill inside header band
      if (w >= 14) {
        ctx.fillStyle = idx === activeIdx ? palette.hex : "rgba(148, 163, 184, 0.65)";
        ctx.font = "bold 10px ui-monospace, SFMono-Regular, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(idx + 1), x1 + w / 2, topBand / 2 + 1);
      }
    });

    // 2. Active piece start/end bounds
    const currentPiece = allPieces[activeIdx];
    const activeRange =
      dragRangeRef.current && currentPiece
        ? dragRangeRef.current
        : currentPiece
        ? { start: currentPiece.startOffset, end: currentPiece.endOffset }
        : { start: 0, end: segmentDuration };

    const activeX1 = timeToX(activeRange.start);
    const activeX2 = timeToX(activeRange.end);

    // 3. Draw waveform bars (active region highlighted, outside dimmed)
    ctx.fillStyle = activeColor.hex;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = padX + i * (barW + gap);
      const barCenter = x + barW * 0.5;
      if (barCenter < activeX1 || barCenter > activeX2) continue;
      const peak = Math.max(0.1, Math.min(1, barList[i] ?? 0.14));
      const barH = Math.max(4, waveHeight * Math.min(0.92, peak * 0.88));
      const y = centerY - barH / 2;
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, barW, barH, radius);
      } else {
        ctx.rect(x, y, barW, barH);
      }
    }
    ctx.fill();

    ctx.fillStyle = "rgba(100, 116, 139, 0.48)";
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = padX + i * (barW + gap);
      const barCenter = x + barW * 0.5;
      if (barCenter >= activeX1 && barCenter <= activeX2) continue;
      const peak = Math.max(0.1, Math.min(1, barList[i] ?? 0.14));
      const barH = Math.max(4, waveHeight * Math.min(0.92, peak * 0.88));
      const y = centerY - barH / 2;
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, barW, barH, radius);
      } else {
        ctx.rect(x, y, barW, barH);
      }
    }
    ctx.fill();

    // 4. Active Start & End Boundary Drag Lines + Touch Grab Tabs
    const drawHandle = (x: number, isStart: boolean) => {
      ctx.fillStyle = activeColor.hex;
      ctx.fillRect(x - 1.5, topBand, 3, height - topBand);

      // Grab handle pill at bottom of boundary line
      const tabW = 18;
      const tabH = 14;
      const tabX = Math.max(2, Math.min(width - tabW - 2, x - tabW / 2));
      const tabY = height - tabH;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(tabX, tabY, tabW, tabH, [4, 4, 0, 0]);
      } else {
        ctx.rect(tabX, tabY, tabW, tabH);
      }
      ctx.fill();

      // Tiny arrow inside grab tab
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isStart ? "▸" : "◂", tabX + tabW / 2, tabY + tabH / 2 + 0.5);
    };

    drawHandle(activeX1, true);
    drawHandle(activeX2, false);

    // 5. Moving Playhead Cursor
    const playX = timeToX(playheadOffsetRef.current);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(playX - 1, topBand, 2, height - topBand);
  }, [segmentDuration]);

  // HiDPI Canvas ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (
        sizeRef.current.width !== width ||
        sizeRef.current.height !== height ||
        sizeRef.current.dpr !== dpr
      ) {
        sizeRef.current = { width, height, dpr };
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        drawWaveform();
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [drawWaveform]);

  useEffect(() => {
    drawWaveform();
  }, [pieces, activePieceIndex, peaks, drawWaveform]);

  // Smooth PLL playhead animation while playing audio inside Split Modal
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    if (clockRef.current.pendingSeekTarget === null) {
      clockRef.current = createPlaybackClockState(getPlaybackSnapshot().currentTime);
    }

    let lastTextMs = 0;
    const tick = (now: number) => {
      const effectiveAbs = stepMonotonicPlaybackClock(clockRef.current, getPlaybackSnapshot(), now);
      const rel = Math.max(0, Math.min(segmentDuration, effectiveAbs - cue.startTime));
      playheadOffsetRef.current = rel;
      drawWaveform();

      if (playheadTextRef.current && now - lastTextMs >= 70) {
        lastTextMs = now;
        playheadTextRef.current.textContent = formatRelTime(rel);
      }
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, cue.startTime, segmentDuration, getPlaybackSnapshot, drawWaveform]);

  const offsetFromClientX = (clientX: number): { offset: number; xPx: number; padX: number; innerW: number } => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) {
      return { offset: 0, xPx: 0, padX: 12, innerW: 100 };
    }
    const padX = 12;
    const innerW = Math.max(20, rect.width - padX * 2);
    const xPx = clientX - rect.left;
    const frac = Math.max(0, Math.min(1, (xPx - padX) / innerW));
    return {
      offset: roundTenth(frac * segmentDuration),
      xPx,
      padX,
      innerW
    };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const active = pieces[activePieceIndex];
    if (!active) return;

    const { offset, xPx, padX, innerW } = offsetFromClientX(e.clientX);
    const startPx = padX + (active.startOffset / segmentDuration) * innerW;
    const endPx = padX + (active.endOffset / segmentDuration) * innerW;

    const distStart = Math.abs(xPx - startPx);
    const distEnd = Math.abs(xPx - endPx);
    const hitRadius = 28;

    if (distStart <= hitRadius || distEnd <= hitRadius) {
      if (distStart <= distEnd) {
        dragModeRef.current = "start";
      } else {
        dragModeRef.current = "end";
      }
      dragRangeRef.current = { start: active.startOffset, end: active.endOffset };
    } else {
      // Tapped outside boundary handles -> seek & preview play from that exact timestamp
      dragModeRef.current = "scrub";
      playheadOffsetRef.current = offset;
      if (playheadTextRef.current) playheadTextRef.current.textContent = formatRelTime(offset);
      drawWaveform();
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragModeRef.current) return;
    e.preventDefault();
    const { offset } = offsetFromClientX(e.clientX);

    if (dragModeRef.current === "scrub") {
      playheadOffsetRef.current = offset;
      if (playheadTextRef.current) playheadTextRef.current.textContent = formatRelTime(offset);
      drawWaveform();
      return;
    }

    const currentRange = dragRangeRef.current;
    if (!currentRange) return;

    const minLen = 0.2;
    if (dragModeRef.current === "start") {
      const clampedStart = Math.max(0, Math.min(roundTenth(currentRange.end - minLen), offset));
      dragRangeRef.current = { start: clampedStart, end: currentRange.end };
      playheadOffsetRef.current = clampedStart;
      if (playheadTextRef.current) playheadTextRef.current.textContent = formatRelTime(clampedStart);
    } else if (dragModeRef.current === "end") {
      const clampedEnd = Math.min(segmentDuration, Math.max(roundTenth(currentRange.start + minLen), offset));
      dragRangeRef.current = { start: currentRange.start, end: clampedEnd };
      playheadOffsetRef.current = clampedEnd;
      if (playheadTextRef.current) playheadTextRef.current.textContent = formatRelTime(clampedEnd);
    }
    drawWaveform();
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const mode = dragModeRef.current;
    if (!mode) return;
    dragModeRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    const { offset } = offsetFromClientX(e.clientX);

    if (mode === "scrub") {
      const absTarget = cue.startTime + offset;
      beginPlaybackSeekHold(
        clockRef.current,
        absTarget,
        performance.now(),
        getPlaybackSnapshot().currentTime
      );
      setPlayingMode("full");
      onPlaySegment(absTarget, cue.endTime);
      return;
    }

    const finalRange = dragRangeRef.current;
    dragRangeRef.current = null;
    if (finalRange) {
      setPieces((prev) =>
        prev.map((p, idx) =>
          idx === activePieceIndex
            ? { ...p, startOffset: finalRange.start, endOffset: finalRange.end }
            : p
        )
      );
      setErrorMsg(null);
    }
  };

  // Playback helpers
  const playPiece = (idx: number) => {
    const target = pieces[idx];
    if (!target) return;
    setActivePieceIndex(idx);
    if (playingMode === idx && isPlaying) {
      onStopSegment();
      setPlayingMode("none");
      return;
    }
    const absStart = cue.startTime + target.startOffset;
    const absEnd = cue.startTime + target.endOffset;
    playheadOffsetRef.current = target.startOffset;
    if (playheadTextRef.current) playheadTextRef.current.textContent = formatRelTime(target.startOffset);
    drawWaveform();
    beginPlaybackSeekHold(clockRef.current, absStart, performance.now(), getPlaybackSnapshot().currentTime);
    setPlayingMode(idx);
    onPlaySegment(absStart, absEnd);
  };

  const playFullCue = () => {
    if (playingMode === "full" && isPlaying) {
      onStopSegment();
      setPlayingMode("none");
      return;
    }
    playheadOffsetRef.current = 0;
    if (playheadTextRef.current) playheadTextRef.current.textContent = formatRelTime(0);
    drawWaveform();
    beginPlaybackSeekHold(clockRef.current, cue.startTime, performance.now(), getPlaybackSnapshot().currentTime);
    setPlayingMode("full");
    onPlaySegment(cue.startTime, cue.endTime);
  };

  // Update active piece timing via buttons or pin-to-playhead
  const updatePieceRange = (idx: number, newStart: number, newEnd: number) => {
    const minLen = 0.2;
    const clampedStart = Math.max(0, Math.min(roundTenth(segmentDuration - minLen), roundTenth(newStart)));
    const clampedEnd = Math.min(segmentDuration, Math.max(roundTenth(clampedStart + minLen), roundTenth(newEnd)));
    setPieces((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, startOffset: clampedStart, endOffset: clampedEnd } : p))
    );
    setErrorMsg(null);
  };

  // Add a new audio piece (minimum is 2, user can add 3, 4, ...)
  const handleAddPiece = () => {
    setPieces((prev) => {
      const last = prev[prev.length - 1];
      let newStart = last ? last.endOffset : 0;
      let newEnd = segmentDuration;

      // If last piece already consumes up to segmentDuration, split the last piece cleanly in half
      if (newStart >= segmentDuration - 0.3 && last) {
        const lastDur = last.endOffset - last.startOffset;
        if (lastDur >= 0.4) {
          const splitPoint = roundTenth(last.startOffset + lastDur / 2);
          const updatedLast = { ...last, endOffset: splitPoint };
          newStart = splitPoint;
          newEnd = segmentDuration;
          const next = [
            ...prev.slice(0, -1),
            updatedLast,
            {
              id: `part-${prev.length + 1}-${Date.now()}`,
              startOffset: newStart,
              endOffset: newEnd,
              text: ""
            }
          ];
          setActivePieceIndex(next.length - 1);
          return next;
        }
        newStart = Math.max(0, roundTenth(segmentDuration - 0.5));
      }

      const next = [
        ...prev,
        {
          id: `part-${prev.length + 1}-${Date.now()}`,
          startOffset: Math.min(roundTenth(segmentDuration - 0.2), newStart),
          endOffset: newEnd,
          text: ""
        }
      ];
      setActivePieceIndex(next.length - 1);
      return next;
    });
    setErrorMsg(null);
  };

  const handleRemovePiece = (idx: number) => {
    if (pieces.length <= 2) {
      setErrorMsg("الحد الأدنى للتقطيع هو قطعتان (2)");
      return;
    }
    setPieces((prev) => prev.filter((_, i) => i !== idx));
    setActivePieceIndex((prevIdx) => Math.max(0, Math.min(prevIdx, pieces.length - 2)));
    setErrorMsg(null);
  };

  // Interactive Word-Cut Tap: assigns words up to wordIndex to the active piece,
  // and flows the remaining words into the next piece
  const wordAssignmentRange = useMemo(() => {
    // Compute how many words preceding pieces already consumed greedily from originalWords
    const ranges: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    for (let i = 0; i < pieces.length; i++) {
      const pWords = pieces[i].text.trim().split(/\s+/).filter(Boolean);
      if (pWords.length === 0) {
        ranges.push({ start: cursor, end: cursor - 1 });
        continue;
      }
      const start = cursor;
      const end = Math.min(originalWords.length - 1, cursor + pWords.length - 1);
      ranges.push({ start, end });
      cursor = end + 1;
    }
    return ranges;
  }, [pieces, originalWords]);

  const handleTapWordCut = (wordIdx: number) => {
    if (originalWords.length === 0) return;
    const prevEnd = activePieceIndex > 0 ? wordAssignmentRange[activePieceIndex - 1]?.end ?? -1 : -1;
    const startWord = Math.min(originalWords.length - 1, Math.max(0, prevEnd + 1));
    const endWord = Math.max(startWord, wordIdx);

    const chosenText = originalWords.slice(startWord, endWord + 1).join(" ");
    const remainingText = originalWords.slice(endWord + 1).join(" ");

    setPieces((prev) =>
      prev.map((p, idx) => {
        if (idx === activePieceIndex) {
          return { ...p, text: chosenText };
        }
        // Automatically flow remaining words into the immediate next piece if this isn't the last piece
        if (idx === activePieceIndex + 1 && activePieceIndex < prev.length - 1) {
          return { ...p, text: remainingText };
        }
        return p;
      })
    );
    setErrorMsg(null);
  };

  // Validate & Save split cues
  const handleSave = () => {
    if (pieces.length < 2) {
      setErrorMsg("يجب أن يحتوي التقطيع على قطعتين على الأقل.");
      return;
    }

    for (let i = 0; i < pieces.length; i++) {
      if (!pieces[i].text.trim()) {
        setErrorMsg(`يرجى كتابة أو تحديد نص القطعة رقم (${i + 1}) قبل الحفظ.`);
        setActivePieceIndex(i);
        return;
      }
      if (pieces[i].endOffset - pieces[i].startOffset < 0.15) {
        setErrorMsg(`مدة القطعة رقم (${i + 1}) قصيرة جداً. اسحب خط النهاية لتوسيعها.`);
        setActivePieceIndex(i);
        return;
      }
    }

    const baseStamp = Date.now();
    const newCues: SubtitleCue[] = pieces
      .map((p, idx) => {
        const absStart = Math.max(0, roundTenth(cue.startTime + p.startOffset));
        const absEnd = Math.max(roundTenth(absStart + 0.2), roundTenth(cue.startTime + p.endOffset));
        return {
          id: `${cue.id}-split-${idx + 1}-${baseStamp}`,
          startTime: absStart,
          endTime: absEnd,
          text: p.text.trim()
        };
      })
      .sort((a, b) => a.startTime - b.startTime);

    onStopSegment();
    onSaveSplit(cue.id, newCues, syncSecondary);
  };

  const activePiece = pieces[activePieceIndex] || pieces[0];
  const activePalette = PIECE_PALETTE[activePieceIndex % PIECE_PALETTE.length];

  return (
    <div
      className="fixed inset-0 z-[105] bg-black/85 sm:backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="my-auto bg-slate-900 border border-slate-700/90 text-white rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 animate-scaleUp text-right"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-sky-500/15 border border-sky-500/35 text-sky-300 flex items-center justify-center shrink-0">
              <Scissors className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-sm sm:text-base truncate">
                تقطيع الجملة إلى مقاطع صوتية ونصية
              </h3>
              <p className="text-xs text-slate-400 truncate tabular-nums">
                {activeTrackLabel} · المدة الكلية: {segmentDuration.toFixed(1)}ث · القطع: {pieces.length}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onStopSegment();
              onClose();
            }}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Full Sentence + Tap-to-Cut Word Strip */}
        <div className="p-3.5 rounded-2xl bg-slate-950/75 border border-slate-800/90 space-y-2">
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>اضغط على آخر كلمة تريدها للقطعة ({activePieceIndex + 1}) أو عدّل النص يدوياً بالأسفل</span>
            <button
              type="button"
              onClick={playFullCue}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                playingMode === "full" && isPlaying
                  ? "bg-sky-600 text-white"
                  : "bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700"
              }`}
            >
              {playingMode === "full" && isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{playingMode === "full" && isPlaying ? "إيقاف" : "سماع الجملة كاملة"}</span>
            </button>
          </div>

          <div
            className="flex flex-wrap gap-1.5 pt-1"
            dir={detectDirection(cue.text)}
          >
            {originalWords.map((word, wIdx) => {
              // Find which piece currently owns this word
              let ownerIdx = -1;
              for (let pIdx = 0; pIdx < wordAssignmentRange.length; pIdx++) {
                const r = wordAssignmentRange[pIdx];
                if (wIdx >= r.start && wIdx <= r.end) {
                  ownerIdx = pIdx;
                  break;
                }
              }
              const ownerPalette = ownerIdx >= 0 ? PIECE_PALETTE[ownerIdx % PIECE_PALETTE.length] : null;
              const isOwnedByActive = ownerIdx === activePieceIndex;

              return (
                <button
                  key={`${word}-${wIdx}`}
                  type="button"
                  onClick={() => handleTapWordCut(wIdx)}
                  className={`px-2 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer border ${
                    isOwnedByActive
                      ? "bg-slate-800 text-white border-sky-400/70"
                      : ownerPalette
                      ? "bg-slate-900 text-slate-200 border-slate-700/80 hover:border-slate-500"
                      : "bg-slate-900/50 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                  style={ownerPalette ? { borderBottomColor: ownerPalette.hex, borderBottomWidth: "2px" } : undefined}
                  title={`تحديد النص حتى "${word}" للقطعة ${activePieceIndex + 1}`}
                >
                  {word}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Multi-Range Audio Waveform Canvas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs" dir="ltr">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => playPiece(activePieceIndex)}
                className={`min-h-[36px] px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  playingMode === activePieceIndex && isPlaying
                    ? "bg-sky-600 text-white"
                    : "bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700"
                }`}
              >
                {playingMode === activePieceIndex && isPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>
                  {playingMode === activePieceIndex && isPlaying
                    ? `إيقاف القطعة ${activePieceIndex + 1}`
                    : `معاينة القطعة ${activePieceIndex + 1}`}
                </span>
              </button>
            </div>

            <div className="font-mono tabular-nums text-slate-400 flex items-center gap-1">
              <span ref={playheadTextRef} className="text-sky-400 font-bold">
                00:00.0
              </span>
              <span>/</span>
              <span>{formatRelTime(segmentDuration)}</span>
            </div>
          </div>

          <div
            ref={containerRef}
            dir="ltr"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            style={{ contain: "strict", touchAction: "none" }}
            className="relative w-full h-24 sm:h-28 rounded-xl overflow-hidden bg-slate-950/85 border border-slate-800 cursor-ew-resize select-none"
            title="اسحب خط البداية أو النهاية لتحديد القطعة، أو انقر في أي مكان للاستماع"
          >
            <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />
          </div>

          {/* Active Piece Boundary Nudge & Pin-to-Playhead Controls */}
          {activePiece && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              {/* Start Line Controls */}
              <div className="flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className={`text-[11px] font-bold ${activePalette.text}`}>
                  بداية {activePieceIndex + 1}: <span className="font-mono tabular-nums">{formatRelTime(activePiece.startOffset)}</span>
                </span>
                <div className="flex items-center gap-1" dir="ltr">
                  <button
                    type="button"
                    onClick={() => updatePieceRange(activePieceIndex, activePiece.startOffset - 0.1, activePiece.endOffset)}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-mono font-bold text-slate-300 cursor-pointer"
                  >
                    -0.1
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePieceRange(activePieceIndex, activePiece.startOffset + 0.1, activePiece.endOffset)}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-mono font-bold text-slate-300 cursor-pointer"
                  >
                    +0.1
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePieceRange(activePieceIndex, playheadOffsetRef.current, activePiece.endOffset)}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-sky-300 flex items-center gap-1 cursor-pointer"
                    title="تعيين البداية عند موضع المؤشر الحالي"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>عند المؤشر</span>
                  </button>
                </div>
              </div>

              {/* End Line Controls */}
              <div className="flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className={`text-[11px] font-bold ${activePalette.text}`}>
                  نهاية {activePieceIndex + 1}: <span className="font-mono tabular-nums">{formatRelTime(activePiece.endOffset)}</span>
                </span>
                <div className="flex items-center gap-1" dir="ltr">
                  <button
                    type="button"
                    onClick={() => updatePieceRange(activePieceIndex, activePiece.startOffset, activePiece.endOffset - 0.1)}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-mono font-bold text-slate-300 cursor-pointer"
                  >
                    -0.1
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePieceRange(activePieceIndex, activePiece.startOffset, activePiece.endOffset + 0.1)}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-mono font-bold text-slate-300 cursor-pointer"
                  >
                    +0.1
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePieceRange(activePieceIndex, activePiece.startOffset, playheadOffsetRef.current)}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-sky-300 flex items-center gap-1 cursor-pointer"
                    title="تعيين النهاية عند موضع المؤشر الحالي"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>عند المؤشر</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pieces List (Minimum 2) */}
        <div className="space-y-2.5 max-h-[38vh] overflow-y-auto pl-0.5">
          {pieces.map((piece, idx) => {
            const palette = PIECE_PALETTE[idx % PIECE_PALETTE.length];
            const isActive = idx === activePieceIndex;
            const pieceDur = Math.max(0, roundTenth(piece.endOffset - piece.startOffset));

            return (
              <div
                key={piece.id}
                onClick={() => setActivePieceIndex(idx)}
                className={`p-3 rounded-2xl border transition-colors cursor-pointer space-y-2 ${
                  isActive
                    ? `bg-slate-950/90 ${palette.border}`
                    : "bg-slate-950/45 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg ${palette.badge} text-slate-950 font-black text-xs flex items-center justify-center shrink-0 tabular-nums`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-white">القطعة {idx + 1}</span>
                    <span className="text-[11px] text-slate-400 font-mono tabular-nums" dir="ltr">
                      {formatRelTime(piece.startOffset)} → {formatRelTime(piece.endOffset)} · {pieceDur.toFixed(1)}s
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const prevEnd = pieces[idx - 1].endOffset;
                          updatePieceRange(idx, prevEnd, Math.max(prevEnd + 0.3, piece.endOffset));
                          setActivePieceIndex(idx);
                        }}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium cursor-pointer"
                        title={`ربط بداية هذه القطعة بنهاية القطعة ${idx}`}
                      >
                        ابدأ بعد {idx}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => playPiece(idx)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        playingMode === idx && isPlaying
                          ? "bg-sky-600 text-white border-sky-500"
                          : "bg-slate-800 hover:bg-slate-700 text-sky-300 border-slate-700"
                      }`}
                      title={`تشغيل القطعة ${idx + 1}`}
                    >
                      {playingMode === idx && isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    </button>

                    {pieces.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePiece(idx)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors cursor-pointer"
                        title="حذف هذه القطعة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={piece.text}
                  onFocus={() => setActivePieceIndex(idx)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPieces((prev) => prev.map((p, pIdx) => (pIdx === idx ? { ...p, text: val } : p)));
                    if (errorMsg) setErrorMsg(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  dir={detectDirection(piece.text || cue.text)}
                  placeholder={`اكتب نص القطعة ${idx + 1} هنا...`}
                  className="w-full text-xs sm:text-sm font-medium p-2.5 bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-xl text-white placeholder-slate-500 resize-none focus:outline-hidden leading-relaxed"
                />
              </div>
            );
          })}

          {/* Add Audio Piece Button */}
          <button
            type="button"
            onClick={handleAddPiece}
            className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-700 hover:border-sky-500/70 bg-slate-950/40 hover:bg-slate-800/60 text-sky-300 hover:text-sky-200 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة قطعة صوتية جديدة (قطعة {pieces.length + 1})</span>
          </button>
        </div>

        {/* Optional Secondary Track Alignment Toggle */}
        {secondaryTrackLabel && (
          <div
            onClick={() => setSyncSecondary(!syncSecondary)}
            className={`p-3 rounded-2xl border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
              syncSecondary
                ? "bg-blue-950/40 border-blue-500/50 text-blue-200"
                : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <RefreshCw className="w-4 h-4 text-blue-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  تقسيم ومزامنة الترجمة الثانية ({secondaryTrackLabel}) تلقائياً
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  يوزّع الترجمة المرافقة على القطع الجديدة بنفس التوقيت
                </div>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                syncSecondary ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-700"
              }`}
            >
              {syncSecondary && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>
        )}

        {/* Validation Error */}
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              onStopSegment();
              onClose();
            }}
            className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[44px] px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-sky-600/25 flex items-center gap-1.5 cursor-pointer"
          >
            <Scissors className="w-4 h-4" />
            <span>حفظ التقطيع ({pieces.length} جمل)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

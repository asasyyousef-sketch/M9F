import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef
} from "react";

export interface SmoothWaveformTrackHandle {
  /** Updates playhead position on single canvas without React re-renders */
  setProgress: (fraction: number) => void;
  /** Updates live recording bars on single canvas without React re-renders */
  setLiveBars: (peaks: number[]) => void;
  /** Resets live bars back to baseline */
  resetLiveBars: () => void;
}

export interface SmoothWaveformTrackProps {
  peaks: number[];
  accent: "sky" | "emerald";
  isPlaying: boolean;
  isRecording?: boolean;
  interactive?: boolean;
  title?: string;
  initialProgress?: number; // 0..1
  onSeekStart?: (fraction: number) => void;
  onSeekMove?: (fraction: number) => void;
  onSeekEnd?: (fraction: number) => void;
}

export const SmoothWaveformTrack = forwardRef<SmoothWaveformTrackHandle, SmoothWaveformTrackProps>(
  (
    {
      peaks,
      accent,
      isPlaying,
      isRecording = false,
      interactive = true,
      title,
      initialProgress = 0,
      onSeekStart,
      onSeekMove,
      onSeekEnd
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sizeRef = useRef<{ width: number; height: number; dpr: number }>({
      width: 0,
      height: 0,
      dpr: 1
    });

    const isDraggingRef = useRef<boolean>(false);
    const lastFractionRef = useRef<number>(initialProgress);
    const lastDrawnCursorPxRef = useRef<number>(-1);
    const isPlayingRef = useRef<boolean>(isPlaying);
    isPlayingRef.current = isPlaying;
    const isRecordingRef = useRef<boolean>(isRecording);
    isRecordingRef.current = isRecording;
    const interactiveRef = useRef<boolean>(interactive);
    interactiveRef.current = interactive;

    const peaksRef = useRef<number[]>(peaks);
    peaksRef.current = peaks.length > 0 ? peaks : Array.from({ length: 80 }, () => 0.12);
    const liveBarsRef = useRef<number[] | null>(null);

    const drawCanvas = useCallback(
      (rawFraction: number, forceRedraw: boolean = false) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { width, height, dpr } = sizeRef.current;
        if (width <= 0 || height <= 0) return;

        const frac = Math.max(0, Math.min(1, Number.isFinite(rawFraction) ? rawFraction : 0));
        lastFractionRef.current = frac;

        const cursorX = frac * width;
        // Skip redundant redraws if cursor moved less than 0.4px and not forced
        if (
          !forceRedraw &&
          !isRecordingRef.current &&
          lastDrawnCursorPxRef.current >= 0 &&
          Math.abs(cursorX - lastDrawnCursorPxRef.current) < 0.4
        ) {
          return;
        }
        lastDrawnCursorPxRef.current = cursorX;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const bars = isRecordingRef.current && liveBarsRef.current ? liveBarsRef.current : peaksRef.current;
        const count = bars.length || 80;

        const showPlayhead =
          !isRecordingRef.current &&
          (isPlayingRef.current || isDraggingRef.current || frac > 0.001);

        const isSky = accent === "sky";

        // 1. Subtle progress background tint (cheap single fillRect, zero layout cost)
        if (showPlayhead && cursorX > 0.5) {
          ctx.fillStyle = isSky ? "rgba(56, 189, 248, 0.10)" : "rgba(52, 211, 153, 0.10)";
          ctx.fillRect(0, 0, cursorX, height);
        }

        // 2. Draw all bars cleanly in one ultra-fast pass (~0.08ms even on budget Android)
        const padX = 8;
        const innerW = Math.max(10, width - padX * 2);
        const gap = 2;
        const barW = Math.max(1.5, (innerW - gap * (count - 1)) / count);
        const radius = Math.min(barW / 2, 2.5);
        const centerY = height / 2;

        const passedColor = isSky ? "#38bdf8" : "#34d399";
        const baseColor = isRecordingRef.current
          ? "rgba(251, 113, 133, 0.92)"
          : interactiveRef.current
          ? "rgba(71, 85, 105, 0.65)"
          : "rgba(30, 41, 59, 0.55)";

        // Batch 1: Active / passed bars (left of cursor)
        if (showPlayhead && cursorX > padX) {
          ctx.fillStyle = passedColor;
          ctx.beginPath();
          for (let i = 0; i < count; i++) {
            const x = padX + i * (barW + gap);
            const barCenter = x + barW * 0.5;
            if (barCenter > cursorX) break;
            const peak = Math.max(0.1, Math.min(1, bars[i] ?? 0.12));
            const barH = Math.max(4, height * Math.min(0.9, peak * 0.85));
            const y = centerY - barH / 2;
            if (typeof ctx.roundRect === "function") {
              ctx.roundRect(x, y, barW, barH, radius);
            } else {
              ctx.rect(x, y, barW, barH);
            }
          }
          ctx.fill();
        }

        // Batch 2: Remaining / inactive bars
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const x = padX + i * (barW + gap);
          const barCenter = x + barW * 0.5;
          if (showPlayhead && barCenter <= cursorX) continue;
          const peak = Math.max(0.1, Math.min(1, bars[i] ?? 0.12));
          const barH = Math.max(4, height * Math.min(0.9, peak * 0.85));
          const y = centerY - barH / 2;
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(x, y, barW, barH, radius);
          } else {
            ctx.rect(x, y, barW, barH);
          }
        }
        ctx.fill();

        // 3. Crisp 2px Laser Cursor Line (zero CSS blur overhead)
        if (showPlayhead && interactiveRef.current) {
          const clampedX = Math.max(1, Math.min(width - 1, cursorX));
          ctx.fillStyle = passedColor;
          ctx.fillRect(clampedX - 1, 0, 2, height);
        }
      },
      [accent]
    );

    // ResizeObserver keeps canvas pixel-sharp across mobile orientation & resize
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
          drawCanvas(lastFractionRef.current, true);
        }
      };

      updateSize();
      const ro = new ResizeObserver(updateSize);
      ro.observe(container);
      return () => ro.disconnect();
    }, [drawCanvas]);

    useImperativeHandle(
      ref,
      () => ({
        setProgress: (fraction: number) => {
          if (isDraggingRef.current) return;
          drawCanvas(fraction, false);
        },
        setLiveBars: (bars: number[]) => {
          liveBarsRef.current = bars;
          drawCanvas(0, true);
        },
        resetLiveBars: () => {
          liveBarsRef.current = Array.from({ length: 80 }, () => 0.14);
          drawCanvas(0, true);
        }
      }),
      [drawCanvas]
    );

    // Redraw whenever peaks, playing, recording, or interactive state changes
    useEffect(() => {
      if (!isRecording) {
        liveBarsRef.current = null;
      }
      if (!isDraggingRef.current) {
        const target = isPlaying ? lastFractionRef.current : initialProgress;
        drawCanvas(target, true);
      }
    }, [peaks, isPlaying, isRecording, interactive, initialProgress, drawCanvas]);

    const getFractionFromClientX = (clientX: number): number => {
      const el = containerRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive || isRecording) return;
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      const frac = getFractionFromClientX(e.clientX);
      drawCanvas(frac, true);
      onSeekStart?.(frac);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || !interactive || isRecording) return;
      e.preventDefault();
      const frac = getFractionFromClientX(e.clientX);
      drawCanvas(frac, true);
      onSeekMove?.(frac);
    };

    const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {}
      const frac = getFractionFromClientX(e.clientX);
      drawCanvas(frac, true);
      onSeekEnd?.(frac);
    };

    return (
      <div
        ref={containerRef}
        dir="ltr"
        title={title}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        style={{
          contain: "strict",
          touchAction: interactive && !isRecording ? "none" : "auto"
        }}
        className={`relative w-full h-16 sm:h-20 rounded-xl overflow-hidden select-none border transition-colors ${
          isRecording
            ? "bg-slate-950/85 border-rose-500/45 cursor-default"
            : interactive
            ? "bg-slate-950/65 border-slate-800 hover:border-slate-700/80 cursor-pointer"
            : "bg-slate-950/40 border-slate-800/40 cursor-default"
        }`}
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full pointer-events-none"
        />
      </div>
    );
  }
);

SmoothWaveformTrack.displayName = "SmoothWaveformTrack";

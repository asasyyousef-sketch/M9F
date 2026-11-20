import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef
} from "react";

export interface SmoothWaveformTrackHandle {
  /** Directly updates GPU-composited playhead cursor, fill bar, and clipped active bars at 60/120fps without React re-renders */
  setProgress: (fraction: number) => void;
  /** Directly updates live recording bar heights via GPU transform: scaleY(...) without React re-renders */
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
    const fillRef = useRef<HTMLDivElement | null>(null);
    const activeLayerRef = useRef<HTMLDivElement | null>(null);
    const cursorTrackRef = useRef<HTMLDivElement | null>(null);
    const liveBarRefs = useRef<Array<HTMLDivElement | null>>([]);
    const isDraggingRef = useRef<boolean>(false);
    const lastFractionRef = useRef<number>(initialProgress);
    const isPlayingRef = useRef<boolean>(isPlaying);
    isPlayingRef.current = isPlaying;

    const applyProgressToDom = (rawFraction: number) => {
      const frac = Math.max(0, Math.min(1, Number.isFinite(rawFraction) ? rawFraction : 0));
      lastFractionRef.current = frac;
      const pct = frac * 100;
      const rightClipPct = Math.max(0, 100 - pct);
      const showCursor = isPlayingRef.current || isDraggingRef.current || frac > 0.001;

      if (fillRef.current) {
        fillRef.current.style.transform = `translate3d(0,0,0) scaleX(${frac.toFixed(4)})`;
        fillRef.current.style.opacity = showCursor ? "1" : "0";
      }
      if (activeLayerRef.current) {
        activeLayerRef.current.style.clipPath = `inset(0 ${rightClipPct.toFixed(2)}% 0 0)`;
        activeLayerRef.current.style.opacity = showCursor ? "1" : "0";
      }
      if (cursorTrackRef.current) {
        cursorTrackRef.current.style.transform = `translate3d(${pct.toFixed(3)}%, 0, 0)`;
        cursorTrackRef.current.style.opacity = showCursor ? "1" : "0";
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        setProgress: (fraction: number) => {
          // While user finger is scrubbing, don't fight their finger position
          if (isDraggingRef.current) return;
          applyProgressToDom(fraction);
        },
        setLiveBars: (bars: number[]) => {
          const count = liveBarRefs.current.length;
          for (let i = 0; i < count; i++) {
            const el = liveBarRefs.current[i];
            if (!el) continue;
            const val = bars[i] ?? 0.12;
            const scale = Math.max(0.12, Math.min(1, val));
            el.style.transform = `translate3d(0,0,0) scaleY(${scale.toFixed(3)})`;
          }
        },
        resetLiveBars: () => {
          const count = liveBarRefs.current.length;
          for (let i = 0; i < count; i++) {
            const el = liveBarRefs.current[i];
            if (el) {
              el.style.transform = "translate3d(0,0,0) scaleY(0.14)";
            }
          }
        }
      }),
      []
    );

    // Sync initialProgress & visibility when reset or playing state changes
    useEffect(() => {
      if (!isDraggingRef.current) {
        applyProgressToDom(isPlaying ? lastFractionRef.current : initialProgress);
      }
    }, [initialProgress, peaks, isPlaying]);

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
      applyProgressToDom(frac);
      onSeekStart?.(frac);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || !interactive || isRecording) return;
      e.preventDefault();
      const frac = getFractionFromClientX(e.clientX);
      applyProgressToDom(frac);
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
      applyProgressToDom(frac);
      onSeekEnd?.(frac);
    };

    const isSky = accent === "sky";
    const fillBg = isSky ? "bg-sky-500/12" : "bg-emerald-500/12";
    const cursorColor = isSky
      ? "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.85)]"
      : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]";
    const activeBarColor = isSky ? "bg-sky-400" : "bg-emerald-400";
    const inactiveBarColor = isRecording
      ? "bg-rose-400/90"
      : interactive
      ? "bg-slate-700/65"
      : "bg-slate-800/45";

    const safePeaks = peaks.length > 0 ? peaks : Array.from({ length: 80 }, () => 0.12);

    return (
      <div
        ref={containerRef}
        dir="ltr"
        title={title}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        style={{ contain: "layout paint style", touchAction: interactive && !isRecording ? "none" : "auto" }}
        className={`relative w-full h-16 sm:h-20 rounded-xl overflow-hidden select-none border transition-colors ${
          isRecording
            ? "bg-slate-950/85 border-rose-500/45 cursor-default"
            : interactive
            ? "bg-slate-950/65 border-slate-800 hover:border-slate-700/80 cursor-pointer"
            : "bg-slate-950/40 border-slate-800/40 cursor-default"
        }`}
      >
        {/* GPU-Composited Progress Fill (scaleX from left) */}
        <div
          ref={fillRef}
          className={`absolute inset-0 pointer-events-none origin-left ${fillBg}`}
          style={{
            transform: "translate3d(0,0,0) scaleX(0)",
            willChange: "transform",
            opacity: 0
          }}
        />

        {/* Base Waveform Bars (Static during playback, or GPU scaleY during live recording) */}
        <div className="absolute inset-0 flex flex-row items-center justify-between px-2 gap-[2px] pointer-events-none">
          {safePeaks.map((peak, idx) => {
            if (isRecording) {
              return (
                <div key={idx} className="flex-1 h-full flex items-center justify-center">
                  <div
                    ref={(el) => {
                      liveBarRefs.current[idx] = el;
                    }}
                    className={`w-full min-w-[2px] h-[85%] rounded-full origin-center ${inactiveBarColor}`}
                    style={{
                      transform: `translate3d(0,0,0) scaleY(${Math.max(0.12, Math.min(1, peak)).toFixed(3)})`,
                      willChange: "transform"
                    }}
                  />
                </div>
              );
            }
            return (
              <div key={idx} className="flex-1 h-full flex items-center justify-center">
                <div
                  className={`w-full min-w-[2px] rounded-full ${inactiveBarColor}`}
                  style={{
                    height: `${Math.max(10, Math.min(92, peak * 85))}%`
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Active Passed Waveform Bars Overlay (Clipped cleanly on GPU via clipPath, zero React re-renders) */}
        {!isRecording && (
          <div
            ref={activeLayerRef}
            className="absolute inset-0 flex flex-row items-center justify-between px-2 gap-[2px] pointer-events-none"
            style={{
              clipPath: "inset(0 100% 0 0)",
              willChange: "clip-path",
              opacity: 0
            }}
          >
            {safePeaks.map((peak, idx) => (
              <div key={idx} className="flex-1 h-full flex items-center justify-center">
                <div
                  className={`w-full min-w-[2px] rounded-full ${activeBarColor}`}
                  style={{
                    height: `${Math.max(10, Math.min(92, peak * 85))}%`
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* GPU-Composited 60/120fps Laser Playhead Cursor */}
        {!isRecording && interactive && (
          <div
            ref={cursorTrackRef}
            className="absolute inset-0 pointer-events-none z-20"
            style={{
              transform: "translate3d(0%, 0, 0)",
              willChange: "transform",
              opacity: 0
            }}
          >
            <div className={`absolute top-0 bottom-0 left-0 w-[2px] -translate-x-1/2 ${cursorColor}`} />
          </div>
        )}
      </div>
    );
  }
);

SmoothWaveformTrack.displayName = "SmoothWaveformTrack";

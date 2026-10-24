import React, { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface UnifiedNavigationTrackProps {
  currentIndex: number;
  totalCards: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

export const UnifiedNavigationTrack: React.FC<UnifiedNavigationTrackProps> = ({
  currentIndex,
  totalCards,
  onPrev,
  onNext,
  className = ""
}) => {
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= totalCards - 1;

  const trackRef = useRef<HTMLDivElement | null>(null);

  // Dragging and interaction states
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [hoverSide, setHoverSide] = useState<"prev" | "next" | null>(null);

  const startXRef = useRef<number | null>(null);
  const hasMovedRef = useRef(false);

  // Minimum drag distance to trigger a swipe action (pixels)
  const SWIPE_THRESHOLD = 24;
  // Maximum visual travel for the center pill
  const MAX_DRAG = 55;

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      startXRef.current = e.touches[0].clientX;
      hasMovedRef.current = false;
      setIsDragging(true);
      setDragOffset(0);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startXRef.current === null || e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;

    if (Math.abs(diff) > 6) {
      hasMovedRef.current = true;
    }

    // Soft resistance when at boundary
    let effective = diff * 0.55;
    if ((diff > 0 && isFirst) || (diff < 0 && isLast)) {
      effective = diff * 0.2;
    }
    const clamped = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, effective));
    setDragOffset(clamped);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startXRef.current !== null) {
      if (hasMovedRef.current && Math.abs(dragOffset) >= SWIPE_THRESHOLD) {
        // In RTL Arabic: Swiping Left moves forward to Next, Swiping Right moves back to Prev
        if (dragOffset < 0 && !isLast) {
          onNext();
        } else if (dragOffset > 0 && !isFirst) {
          onPrev();
        }
      } else if (!hasMovedRef.current) {
        // Simple tap / click without swiping
        const touch = e.changedTouches[0];
        if (trackRef.current && touch) {
          const rect = trackRef.current.getBoundingClientRect();
          const tapX = touch.clientX - rect.left;
          const ratio = tapX / rect.width;
          // In RTL: Right half (ratio >= 0.5) is Prev (السابقة), Left half (ratio < 0.5) is Next (التالية)
          if (ratio >= 0.5) {
            if (!isFirst) onPrev();
          } else {
            if (!isLast) onNext();
          }
        }
      }
    }

    startXRef.current = null;
    hasMovedRef.current = false;
    setIsDragging(false);
    setDragOffset(0);
  };

  // Mouse handlers for desktop
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    startXRef.current = e.clientX;
    hasMovedRef.current = false;
    setIsDragging(true);
    setDragOffset(0);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (startXRef.current === null) return;
      const diff = e.clientX - startXRef.current;
      if (Math.abs(diff) > 6) {
        hasMovedRef.current = true;
      }
      let effective = diff * 0.55;
      if ((diff > 0 && isFirst) || (diff < 0 && isLast)) {
        effective = diff * 0.2;
      }
      const clamped = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, effective));
      setDragOffset(clamped);
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (startXRef.current !== null) {
        if (hasMovedRef.current && Math.abs(dragOffset) >= SWIPE_THRESHOLD) {
          if (dragOffset < 0 && !isLast) {
            onNext();
          } else if (dragOffset > 0 && !isFirst) {
            onPrev();
          }
        } else if (!hasMovedRef.current) {
          if (trackRef.current) {
            const rect = trackRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const ratio = clickX / rect.width;
            if (ratio >= 0.5) {
              if (!isFirst) onPrev();
            } else {
              if (!isLast) onNext();
            }
          }
        }
      }

      startXRef.current = null;
      hasMovedRef.current = false;
      setIsDragging(false);
      setDragOffset(0);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging, dragOffset, isFirst, isLast, onNext, onPrev]);

  const handleTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (startXRef.current === null && trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const ratio = cursorX / rect.width;
      setHoverSide(ratio >= 0.5 ? "prev" : "next");
    }
  };

  const handleMouseLeave = () => {
    if (!isDragging) {
      setHoverSide(null);
    }
  };

  // Keyboard navigation support
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      if (!isLast) onNext();
    } else if (e.key === "ArrowRight") {
      if (!isFirst) onPrev();
    }
  };

  // Calculate glow opacity based on drag distance
  const glowOpacity = isDragging ? Math.min(Math.abs(dragOffset) / 25, 0.95) : 0;

  return (
    <div className={`w-full ${className}`} dir="rtl">
      {/* Outer Controller Bar */}
      <div
        ref={trackRef}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleTrackMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full h-14 sm:h-15 bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl relative flex items-center justify-between px-5 sm:px-7 select-none cursor-pointer touch-none overflow-hidden transition-colors shadow-sm group"
        title="اسحب المقبض الأوسط لليمين أو اليسار للتقليب، أو انقر على الأطراف"
      >
        {/* Soft Radial Glow on Active Drag */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            opacity: glowOpacity,
            background:
              dragOffset < 0
                ? "radial-gradient(circle at 35% 50%, rgba(56, 189, 248, 0.18), transparent 70%)"
                : "radial-gradient(circle at 65% 50%, rgba(56, 189, 248, 0.18), transparent 70%)"
          }}
        />

        {/* Hover Side Highlight Indicator */}
        {!isDragging && hoverSide && (
          <div
            className={`absolute inset-y-0 w-1/2 pointer-events-none transition-all duration-200 bg-white/[0.02] ${
              hoverSide === "prev" ? "right-0 rounded-r-2xl" : "left-0 rounded-l-2xl"
            }`}
          />
        )}

        {/* Right Side: السابقة (Side Arrow & Label) */}
        <div
          className={`flex items-center gap-1.5 relative z-10 transition-all duration-150 pointer-events-none ${
            isFirst
              ? "opacity-25 text-slate-600"
              : dragOffset > 10 || hoverSide === "prev"
              ? "text-white font-bold translate-x-0.5 scale-105"
              : "text-slate-400 group-hover:text-slate-300 font-medium"
          }`}
        >
          <ChevronRight className="w-5 h-5 shrink-0 transition-transform stroke-[2.5]" />
          <span className="text-xs sm:text-sm hidden xs:inline">السابقة</span>
        </div>

        {/* Central Sliding Pill (المقبض الأملس العريض في المنتصف) */}
        <div
          className="absolute top-1/2 left-1/2 -translate-y-1/2 w-[52%] max-w-[260px] h-[calc(100%-14px)] bg-white/[0.04] group-hover:bg-white/[0.07] border border-white/[0.07] group-hover:border-white/[0.12] rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 z-20 pointer-events-none shadow-xs"
          style={{
            transform: `translate(calc(-50% + ${dragOffset}px), -50%)`,
            transition: isDragging ? "none" : "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, border-color 0.2s ease"
          }}
        >
          {/* 3 Minimalist Drag Dots (علامات السحب الضمنية) */}
          <div className="flex items-center gap-2 pointer-events-none">
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-150 ${
                isDragging || hoverSide ? "bg-white/70" : "bg-white/35 group-hover:bg-white/55"
              }`}
            />
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-150 ${
                isDragging || hoverSide ? "bg-white/70" : "bg-white/35 group-hover:bg-white/55"
              }`}
            />
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-150 ${
                isDragging || hoverSide ? "bg-white/70" : "bg-white/35 group-hover:bg-white/55"
              }`}
            />
          </div>
        </div>

        {/* Left Side: التالية (Side Arrow & Label) */}
        <div
          className={`flex items-center gap-1.5 relative z-10 transition-all duration-150 pointer-events-none ${
            isLast
              ? "opacity-25 text-slate-600"
              : dragOffset < -10 || hoverSide === "next"
              ? "text-white font-bold -translate-x-0.5 scale-105"
              : "text-slate-400 group-hover:text-slate-300 font-medium"
          }`}
        >
          <span className="text-xs sm:text-sm hidden xs:inline">التالية</span>
          <ChevronLeft className="w-5 h-5 shrink-0 transition-transform stroke-[2.5]" />
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef } from "react";
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

  const buttonRef = useRef<HTMLDivElement | null>(null);

  // Gesture & interaction states
  const [hoverSide, setHoverSide] = useState<"prev" | "next" | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const startXRef = useRef<number | null>(null);
  const hasSwipedRef = useRef(false);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      startXRef.current = e.touches[0].clientX;
      hasSwipedRef.current = false;
      setIsPressed(true);
      setDragOffset(0);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startXRef.current === null || e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;

    // Movement threshold to consider it a swipe rather than a tap
    if (Math.abs(diff) > 8) {
      hasSwipedRef.current = true;
    }

    // Apply soft drag resistance
    let effective = diff * 0.45;
    if ((diff > 0 && isFirst) || (diff < 0 && isLast)) {
      effective = diff * 0.2;
    }
    const clamped = Math.max(-28, Math.min(28, effective));
    setDragOffset(clamped);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startXRef.current !== null) {
      // Check if user swiped from anywhere on the button
      if (hasSwipedRef.current && Math.abs(dragOffset) >= 12) {
        // In RTL Arabic: Swiping Left moves forward to Next, Swiping Right moves back to Prev
        if (dragOffset < 0 && !isLast) {
          onNext();
        } else if (dragOffset > 0 && !isFirst) {
          onPrev();
        }
      } else if (!hasSwipedRef.current) {
        // It was a tap! Check which 50% half of the button was tapped
        const touch = e.changedTouches[0];
        if (buttonRef.current && touch) {
          const rect = buttonRef.current.getBoundingClientRect();
          const tapX = touch.clientX - rect.left;
          const ratio = tapX / rect.width;
          // In RTL: Right 50% (ratio >= 0.5) is Prev (السابقة), Left 50% (ratio < 0.5) is Next (التالية)
          if (ratio >= 0.5) {
            if (!isFirst) onPrev();
          } else {
            if (!isLast) onNext();
          }
        }
      }
    }

    startXRef.current = null;
    hasSwipedRef.current = false;
    setIsPressed(false);
    setDragOffset(0);
  };

  // Mouse handlers for desktop
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    startXRef.current = e.clientX;
    hasSwipedRef.current = false;
    setIsPressed(true);
    setDragOffset(0);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // If not dragging, track hover side (which 50% the cursor is on)
    if (startXRef.current === null) {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const ratio = cursorX / rect.width;
        // Right 50% = Prev (السابقة), Left 50% = Next (التالية)
        setHoverSide(ratio >= 0.5 ? "prev" : "next");
      }
      return;
    }

    // Active drag tracking
    const diff = e.clientX - startXRef.current;
    if (Math.abs(diff) > 8) {
      hasSwipedRef.current = true;
    }

    let effective = diff * 0.45;
    if ((diff > 0 && isFirst) || (diff < 0 && isLast)) {
      effective = diff * 0.2;
    }
    const clamped = Math.max(-28, Math.min(28, effective));
    setDragOffset(clamped);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (startXRef.current !== null) {
      // Swiped from anywhere on the button
      if (hasSwipedRef.current && Math.abs(dragOffset) >= 12) {
        if (dragOffset < 0 && !isLast) {
          onNext();
        } else if (dragOffset > 0 && !isFirst) {
          onPrev();
        }
      } else if (!hasSwipedRef.current) {
        // Click on 50% half
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
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
    hasSwipedRef.current = false;
    setIsPressed(false);
    setDragOffset(0);
  };

  const handleMouseLeave = () => {
    startXRef.current = null;
    hasSwipedRef.current = false;
    setIsPressed(false);
    setDragOffset(0);
    setHoverSide(null);
  };

  // Keyboard navigation support
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      if (!isLast) onNext();
    } else if (e.key === "ArrowRight") {
      if (!isFirst) onPrev();
    }
  };

  return (
    <div className={`w-full ${className}`} dir="rtl">
      {/* 
        Single Long Smart Button (زر واحد ذكي موحد):
        - Click on 50% right half -> Previous (السابقة)
        - Click on 50% left half -> Next (التالية)
        - Swipe / Drag left or right anywhere on this button -> flips according to swipe direction!
      */}
      <div
        ref={buttonRef}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className={`w-full h-12 bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs relative overflow-hidden select-none cursor-pointer flex items-center transition-all ${
          isPressed ? "scale-[0.99] ring-2 ring-primary/20 dark:ring-blue-500/20" : "hover:border-slate-300 dark:hover:border-slate-700"
        }`}
        title="زر ذكي موحد: انقر على نصف التالية أو السابقة، أو اسحب يميناً ويساراً من أي مكان للتقليب"
      >
        {/* Dynamic Interactive Backdrop: highlights active 50% half or swipe direction */}
        {dragOffset !== 0 ? (
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity duration-150 ${
              dragOffset < 0
                ? "bg-gradient-to-l from-transparent via-primary/5 to-primary/10 dark:to-blue-500/15"
                : "bg-gradient-to-r from-transparent via-primary/5 to-primary/10 dark:to-blue-500/15"
            }`}
          />
        ) : hoverSide ? (
          <div
            className={`absolute inset-y-0 w-1/2 pointer-events-none transition-all duration-200 bg-slate-100/60 dark:bg-slate-800/50 ${
              hoverSide === "prev" ? "right-0 rounded-r-2xl" : "left-0 rounded-l-2xl"
            }`}
          />
        ) : null}

        {/* Content of the Single Unified Button */}
        <div
          className="w-full h-full flex items-center justify-between px-4 sm:px-6 relative z-10 transition-transform duration-75 pointer-events-none"
          style={{ transform: `translateX(${dragOffset}px)` }}
        >
          {/* Right 50% Zone Content: السابقة */}
          <div
            className={`flex items-center gap-1.5 transition-all duration-150 ${
              isFirst
                ? "opacity-30 text-slate-400 dark:text-slate-600"
                : hoverSide === "prev" || dragOffset > 5
                ? "text-slate-900 dark:text-white font-black translate-x-0.5"
                : "text-slate-700 dark:text-slate-300 font-bold"
            }`}
          >
            <ChevronRight className="w-4 h-4 shrink-0 transition-transform" />
            <span className="text-xs sm:text-sm">السابقة</span>
          </div>

          {/* Center Counter */}
          <div className="shrink-0 flex items-center justify-center pointer-events-none select-none">
            <span className="text-xs sm:text-sm font-semibold font-mono text-slate-500 dark:text-slate-400" dir="ltr">
              {currentIndex + 1} / {totalCards}
            </span>
          </div>

          {/* Left 50% Zone Content: التالية */}
          <div
            className={`flex items-center gap-1.5 transition-all duration-150 ${
              isLast
                ? "opacity-30 text-slate-400 dark:text-slate-600"
                : hoverSide === "next" || dragOffset < -5
                ? "text-slate-900 dark:text-white font-black -translate-x-0.5"
                : "text-slate-700 dark:text-slate-300 font-bold"
            }`}
          >
            <span className="text-xs sm:text-sm">التالية</span>
            <ChevronLeft className="w-4 h-4 shrink-0 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};

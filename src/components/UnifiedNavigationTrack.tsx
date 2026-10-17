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

  // Interaction states - button remains 100% stationary and never moves
  const [hoverSide, setHoverSide] = useState<"prev" | "next" | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const startXRef = useRef<number | null>(null);
  const totalDiffRef = useRef<number>(0);
  const hasSwipedRef = useRef(false);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      startXRef.current = e.touches[0].clientX;
      totalDiffRef.current = 0;
      hasSwipedRef.current = false;
      setIsPressed(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startXRef.current === null || e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;
    totalDiffRef.current = diff;

    if (Math.abs(diff) > 20) {
      hasSwipedRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startXRef.current !== null) {
      const diff = totalDiffRef.current;

      // If user swiped from anywhere on the button (threshold: 25px)
      if (hasSwipedRef.current && Math.abs(diff) >= 25) {
        // In RTL Arabic: Swiping Left moves forward to Next, Swiping Right moves back to Prev
        if (diff < 0 && !isLast) {
          onNext();
        } else if (diff > 0 && !isFirst) {
          onPrev();
        }
      } else {
        // Pure tap/click: check which 50% half was tapped
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
    totalDiffRef.current = 0;
    hasSwipedRef.current = false;
    setIsPressed(false);
  };

  // Mouse handlers for desktop
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    startXRef.current = e.clientX;
    totalDiffRef.current = 0;
    hasSwipedRef.current = false;
    setIsPressed(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // If not dragging, track hover side (which 50% the cursor is on)
    if (startXRef.current === null) {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const ratio = cursorX / rect.width;
        setHoverSide(ratio >= 0.5 ? "prev" : "next");
      }
      return;
    }

    // Tracking swipe motion
    const diff = e.clientX - startXRef.current;
    totalDiffRef.current = diff;
    if (Math.abs(diff) > 20) {
      hasSwipedRef.current = true;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (startXRef.current !== null) {
      const diff = totalDiffRef.current;

      if (hasSwipedRef.current && Math.abs(diff) >= 25) {
        if (diff < 0 && !isLast) {
          onNext();
        } else if (diff > 0 && !isFirst) {
          onPrev();
        }
      } else {
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
    totalDiffRef.current = 0;
    hasSwipedRef.current = false;
    setIsPressed(false);
  };

  const handleMouseLeave = () => {
    startXRef.current = null;
    totalDiffRef.current = 0;
    hasSwipedRef.current = false;
    setIsPressed(false);
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
    <div className={`w-full max-w-sm sm:max-w-md mx-auto ${className}`} dir="rtl">
      {/* 
        Single Long Smart Button (زر واحد ذكي موحد وثابت في مكانه تماماً):
        - The button stays 100% stationary (لا يتحرك ولا يُسحب من مكانه).
        - Click on 50% right half -> Previous (السابقة)
        - Click on 50% left half -> Next (التالية)
        - Swipe left or right anywhere on this button -> flips according to swipe direction!
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
        className={`w-full h-12 bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs relative overflow-hidden select-none cursor-pointer flex items-center transition-colors ${
          isPressed ? "bg-slate-50 dark:bg-slate-850" : "hover:border-slate-300 dark:hover:border-slate-700"
        }`}
        title="زر ذكي موحد: انقر على نصف التالية أو السابقة، أو اسحب يميناً ويساراً من أي مكان للتقليب"
      >
        {/* Soft highlight on the hovered 50% half without moving the button */}
        {hoverSide && !isPressed && (
          <div
            className={`absolute inset-y-0 w-1/2 pointer-events-none transition-all duration-200 bg-slate-100/60 dark:bg-slate-800/50 ${
              hoverSide === "prev" ? "right-0 rounded-r-2xl" : "left-0 rounded-l-2xl"
            }`}
          />
        )}

        {/* Static content: perfectly fixed and stationary */}
        <div className="w-full h-full flex items-center justify-between px-4 sm:px-6 relative z-10 pointer-events-none">
          {/* Right 50% Zone Content: السابقة */}
          <div
            className={`flex items-center gap-1.5 transition-colors duration-150 ${
              isFirst
                ? "opacity-30 text-slate-400 dark:text-slate-600"
                : hoverSide === "prev"
                ? "text-slate-900 dark:text-white font-black"
                : "text-slate-700 dark:text-slate-300 font-bold"
            }`}
          >
            <ChevronRight className="w-4 h-4 shrink-0" />
            <span className="text-xs sm:text-sm">السابقة</span>
          </div>

          {/* Center Counter Pill */}
          <div className="shrink-0 px-2.5 py-1 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/60 rounded-xl flex items-center justify-center shadow-2xs pointer-events-none select-none">
            <span className="text-[11px] sm:text-xs font-bold font-mono text-slate-600 dark:text-slate-300">
              {currentIndex + 1} من {totalCards}
            </span>
          </div>

          {/* Left 50% Zone Content: التالية */}
          <div
            className={`flex items-center gap-1.5 transition-colors duration-150 ${
              isLast
                ? "opacity-30 text-slate-400 dark:text-slate-600"
                : hoverSide === "next"
                ? "text-slate-900 dark:text-white font-black"
                : "text-slate-700 dark:text-slate-300 font-bold"
            }`}
          >
            <span className="text-xs sm:text-sm">التالية</span>
            <ChevronLeft className="w-4 h-4 shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
};

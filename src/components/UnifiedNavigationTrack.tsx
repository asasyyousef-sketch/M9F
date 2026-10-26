import React from "react";
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

  return (
    <div
      className={`flex items-center justify-between gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs select-none ${className}`}
      dir="rtl"
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={isFirst}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
          isFirst
            ? "opacity-30 cursor-not-allowed text-slate-400"
            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 active:scale-95"
        }`}
        title="البطاقة السابقة"
      >
        <ChevronRight className="w-4 h-4" />
        <span>السابق</span>
      </button>

      <div className="flex items-center gap-1 text-xs font-black text-slate-600 dark:text-slate-300">
        <span className="text-[#0056f6] dark:text-blue-400 font-extrabold">{currentIndex + 1}</span>
        <span className="text-slate-400 font-medium">/</span>
        <span>{totalCards}</span>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={isLast}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
          isLast
            ? "opacity-30 cursor-not-allowed text-slate-400"
            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 active:scale-95"
        }`}
        title="البطاقة التالية"
      >
        <span>التالي</span>
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  );
};

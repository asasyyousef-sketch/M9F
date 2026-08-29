import React, { useState, useEffect } from "react";
import { Clock, Play, Check, X, RefreshCw, Sparkles, MapPin, Plus, Minus } from "lucide-react";
import { SubtitleCue } from "../types";
import { formatSecondsToClock, parseTimeToSeconds } from "../utils/subtitleParser";

interface CleanCueEditorModalProps {
  cue: SubtitleCue;
  activeTrackLabel: string;
  secondaryTrackLabel?: string;
  currentTime: number;
  initialSyncSecondary: boolean;
  onSave: (updatedCue: SubtitleCue, syncSecondary: boolean) => void;
  onClose: () => void;
  onPreview: (start: number, end: number) => void;
}

export const CleanCueEditorModal: React.FC<CleanCueEditorModalProps> = ({
  cue,
  activeTrackLabel,
  secondaryTrackLabel,
  currentTime,
  initialSyncSecondary,
  onSave,
  onClose,
  onPreview
}) => {
  const [text, setText] = useState<string>(cue.text);
  const [startTime, setStartTime] = useState<number>(cue.startTime);
  const [endTime, setEndTime] = useState<number>(cue.endTime);

  // User input text states for clean typing (e.g., "01:30" or "01:30.0")
  const [startInput, setStartInput] = useState<string>(() => formatSecondsToClock(cue.startTime));
  const [endInput, setEndInput] = useState<string>(() => formatSecondsToClock(cue.endTime));
  const [syncSecondary, setSyncSecondary] = useState<boolean>(initialSyncSecondary);
  const [inputError, setInputError] = useState<string | null>(null);

  // Sync inputs whenever numerical values are adjusted via buttons
  const updateStartTime = (newSec: number) => {
    const validStart = Math.max(0, Math.round(newSec * 10) / 10);
    setStartTime(validStart);
    setStartInput(formatSecondsToClock(validStart));
    if (endTime <= validStart) {
      const validEnd = Math.round((validStart + 0.5) * 10) / 10;
      setEndTime(validEnd);
      setEndInput(formatSecondsToClock(validEnd));
    }
    setInputError(null);
  };

  const updateEndTime = (newSec: number) => {
    const validEnd = Math.max(startTime + 0.2, Math.round(newSec * 10) / 10);
    setEndTime(validEnd);
    setEndInput(formatSecondsToClock(validEnd));
    setInputError(null);
  };

  // Handle typing inside Start Time box
  const handleStartInputChange = (val: string) => {
    setStartInput(val);
    const parsed = parseTimeToSeconds(val);
    if (parsed !== null && parsed >= 0) {
      setStartTime(parsed);
      if (endTime <= parsed) {
        setEndTime(parsed + 0.5);
        setEndInput(formatSecondsToClock(parsed + 0.5));
      }
      setInputError(null);
    }
  };

  // Handle typing inside End Time box
  const handleEndInputChange = (val: string) => {
    setEndInput(val);
    const parsed = parseTimeToSeconds(val);
    if (parsed !== null && parsed >= 0) {
      setEndTime(Math.max(startTime + 0.2, parsed));
      setInputError(null);
    }
  };

  // On blur, reformat to pretty MM:SS.s
  const handleStartBlur = () => {
    const parsed = parseTimeToSeconds(startInput);
    if (parsed !== null && parsed >= 0) {
      updateStartTime(parsed);
    } else {
      setStartInput(formatSecondsToClock(startTime));
    }
  };

  const handleEndBlur = () => {
    const parsed = parseTimeToSeconds(endInput);
    if (parsed !== null && parsed >= 0) {
      updateEndTime(parsed);
    } else {
      setEndInput(formatSecondsToClock(endTime));
    }
  };

  // Handle Save
  const handleSave = () => {
    const parsedStart = parseTimeToSeconds(startInput);
    const parsedEnd = parseTimeToSeconds(endInput);

    const finalStart = parsedStart !== null && parsedStart >= 0 ? parsedStart : startTime;
    let finalEnd = parsedEnd !== null && parsedEnd >= 0 ? parsedEnd : endTime;

    if (finalEnd <= finalStart) {
      finalEnd = finalStart + 0.5;
    }

    if (!text.trim()) {
      setInputError("يرجى كتابة نص للجملة قبل الحفظ");
      return;
    }

    onSave(
      {
        ...cue,
        startTime: finalStart,
        endTime: finalEnd,
        text: text.trim()
      },
      syncSecondary
    );
  };

  const duration = Math.max(0, Math.round((endTime - startTime) * 10) / 10);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-slate-900 border border-slate-700/90 text-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4.5 animate-scaleUp"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold shadow-xs">
              <Clock className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-black text-white text-sm sm:text-base">تعديل توقيت الجملة</h3>
              <p className="text-[11px] text-slate-400">
                المسار: <span className="text-blue-400 font-bold">{activeTrackLabel}</span> • مدة الظهور:{" "}
                <span className="text-emerald-400 font-bold font-mono">{duration} ثانية</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Subtitle Text Field */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-300">نص الجملة / الترجمة:</label>
          <textarea
            rows={2}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (inputError) setInputError(null);
            }}
            placeholder="اكتب نص الجملة هنا..."
            className="w-full text-xs sm:text-sm font-medium p-3 bg-slate-950 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 resize-none focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 leading-relaxed transition-all"
          />
        </div>

        {/* Clean Timing Inputs in Minutes & Seconds (MM:SS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* --- START TIME CARD --- */}
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>وقت البداية</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">(دقيقة:ثانية)</span>
            </div>

            {/* Direct MM:SS Input */}
            <div className="relative">
              <input
                type="text"
                value={startInput}
                onChange={(e) => handleStartInputChange(e.target.value)}
                onBlur={handleStartBlur}
                placeholder="01:30"
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 text-emerald-300 text-center font-mono font-black text-sm rounded-xl focus:outline-hidden focus:border-emerald-500 transition-all shadow-inner"
              />
            </div>

            {/* Quick Step Buttons */}
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={() => updateStartTime(startTime - 1)}
                className="py-1 text-[10px] font-mono font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg transition-colors cursor-pointer"
                title="إنقاص ثانية"
              >
                -1s
              </button>
              <button
                type="button"
                onClick={() => updateStartTime(startTime - 0.1)}
                className="py-1 text-[10px] font-mono font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg transition-colors cursor-pointer"
                title="إنقاص جزء من الثانية"
              >
                -0.1s
              </button>
              <button
                type="button"
                onClick={() => updateStartTime(startTime + 0.1)}
                className="py-1 text-[10px] font-mono font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg transition-colors cursor-pointer"
                title="زيادة جزء من الثانية"
              >
                +0.1s
              </button>
              <button
                type="button"
                onClick={() => updateStartTime(startTime + 1)}
                className="py-1 text-[10px] font-mono font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg transition-colors cursor-pointer"
                title="زيادة ثانية"
              >
                +1s
              </button>
            </div>

            {/* Snap to Player Time Button */}
            <button
              type="button"
              onClick={() => updateStartTime(currentTime)}
              className="w-full py-1 px-2 text-[11px] font-bold text-emerald-300 hover:text-emerald-200 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800/60 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <MapPin className="w-3 h-3 text-emerald-400" />
              <span>ضبط على موضع الفيديو ({formatSecondsToClock(currentTime)})</span>
            </button>
          </div>

          {/* --- END TIME CARD --- */}
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span>وقت النهاية</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">(دقيقة:ثانية)</span>
            </div>

            {/* Direct MM:SS Input */}
            <div className="relative">
              <input
                type="text"
                value={endInput}
                onChange={(e) => handleEndInputChange(e.target.value)}
                onBlur={handleEndBlur}
                placeholder="01:35"
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 text-rose-300 text-center font-mono font-black text-sm rounded-xl focus:outline-hidden focus:border-rose-500 transition-all shadow-inner"
              />
            </div>

            {/* Quick Step Buttons */}
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={() => updateEndTime(endTime - 1)}
                className="py-1 text-[10px] font-mono font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg transition-colors cursor-pointer"
                title="إنقاص ثانية"
              >
                -1s
              </button>
              <button
                type="button"
                onClick={() => updateEndTime(endTime - 0.1)}
                className="py-1 text-[10px] font-mono font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg transition-colors cursor-pointer"
                title="إنقاص جزء من الثانية"
              >
                -0.1s
              </button>
              <button
                type="button"
                onClick={() => updateEndTime(endTime + 0.1)}
                className="py-1 text-[10px] font-mono font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg transition-colors cursor-pointer"
                title="زيادة جزء من الثانية"
              >
                +0.1s
              </button>
              <button
                type="button"
                onClick={() => updateEndTime(endTime + 1)}
                className="py-1 text-[10px] font-mono font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg transition-colors cursor-pointer"
                title="زيادة ثانية"
              >
                +1s
              </button>
            </div>

            {/* Snap to Player Time Button */}
            <button
              type="button"
              onClick={() => updateEndTime(currentTime)}
              className="w-full py-1 px-2 text-[11px] font-bold text-rose-300 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/60 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <MapPin className="w-3 h-3 text-rose-400" />
              <span>ضبط على موضع الفيديو ({formatSecondsToClock(currentTime)})</span>
            </button>
          </div>
        </div>

        {/* Secondary Subtitle Synchronization Toggle */}
        {secondaryTrackLabel ? (
          <div
            onClick={() => setSyncSecondary(!syncSecondary)}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              syncSecondary
                ? "bg-blue-950/50 border-blue-500/60 text-blue-200 shadow-xs"
                : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold shrink-0 transition-colors ${
                  syncSecondary ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncSecondary ? "animate-spin-slow" : ""}`} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                  <span>مزامنة التوقيت مع الترجمة الثانية</span>
                  <span className="text-[10px] text-blue-400 font-mono font-bold bg-blue-900/60 px-1.5 py-0.5 rounded-md border border-blue-700/50">
                    {secondaryTrackLabel}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  تطبيق نفس توقيت البداية والنهاية على الجملة المقابلة تلقائياً
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center">
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                  syncSecondary ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-700"
                }`}
              >
                {syncSecondary && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>
          </div>
        ) : null}

        {/* Error message if any */}
        {inputError && (
          <div className="p-2 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl text-center font-medium">
            {inputError}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Quick Play Audio Preview */}
          <button
            type="button"
            onClick={() => onPreview(startTime, endTime)}
            className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700/70"
            title="تشغيل لمعاينة التوقيت"
          >
            <Play className="w-3.5 h-3.5 fill-current text-blue-400" />
            <span>معاينة الصوت</span>
          </button>

          <div className="flex-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>حفظ التعديل والمزامنة ✓</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

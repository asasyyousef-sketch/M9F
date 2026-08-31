import React, { useState } from "react";
import {
  X,
  Languages,
  Subtitles,
  Split,
  Sparkles,
  Mic,
  Upload,
  Download,
  Trash2,
  Check,
  Plus,
  Palette,
  FileText,
  Copy,
  CheckCheck,
  Settings2,
  Layers,
  ArrowRightLeft,
  ArrowRight
} from "lucide-react";
import { MediaFile } from "../types";

export interface SubtitleOptionsPanelProps {
  currentFile: MediaFile | null;
  activeTrackId: string | null;
  secondaryTrackId: string | null;
  showDualSubtitles: boolean;
  showSubtitlesOverlay: boolean;
  onToggleSubtitlesOverlay: () => void;
  onSelectPrimaryTrack: (id: string | null) => void;
  onSelectSecondaryTrack: (id: string | null) => void;
  onSwapTracks?: () => void;
  onToggleDualSubtitles: () => void;
  onDeleteTrack: (id: string) => void;
  onOpenUploadModal: () => void;
  onOpenGradioModal: () => void;
  onOpenTranslateModal: () => void;
  onOpenStyleModal: () => void;
  onDownloadSubtitles: (format: "srt" | "vtt" | "txt") => void;
  onCopyTranscript: () => void;
  isCopiedTranscript: boolean;
  selectedAiModel?: string;
  onSelectAiModel?: (modelKey: string) => void;
  onClose?: () => void;
  onBackToTranscript?: () => void;
  isEmbedded?: boolean;
}

export interface SubtitleOptionsModalProps extends SubtitleOptionsPanelProps {
  isOpen: boolean;
}

export const SubtitleOptionsPanel: React.FC<SubtitleOptionsPanelProps> = ({
  currentFile,
  activeTrackId,
  secondaryTrackId,
  showDualSubtitles,
  showSubtitlesOverlay,
  onToggleSubtitlesOverlay,
  onSelectPrimaryTrack,
  onSelectSecondaryTrack,
  onSwapTracks,
  onToggleDualSubtitles,
  onDeleteTrack,
  onOpenUploadModal,
  onOpenGradioModal,
  onOpenTranslateModal,
  onOpenStyleModal,
  onDownloadSubtitles,
  onCopyTranscript,
  isCopiedTranscript,
  onClose,
  onBackToTranscript,
  isEmbedded = false
}) => {
  const [activeTab, setActiveTab] = useState<"tracks" | "ai" | "tools">("tracks");

  if (!currentFile) {
    return (
      <div className="p-6 text-center text-slate-400">
        <Languages className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-xs">لم يتم اختيار أي ملف وسائط حالياً</p>
      </div>
    );
  }

  const subtitles = currentFile.subtitles || [];
  const activeTrack = subtitles.find((t) => t.id === activeTrackId) || null;
  const secondaryTrack = subtitles.find((t) => t.id === secondaryTrackId) || null;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 select-none overflow-hidden" dir="rtl">
      {/* Navigation Tabs Bar */}
      <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-900 px-2 pt-1.5 gap-1 shrink-0 text-xs font-bold">
        <button
          onClick={() => setActiveTab("tracks")}
          className={`pb-2 px-1 text-center border-b-2 transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "tracks"
              ? "border-indigo-500 text-indigo-400 font-black"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">المسارات</span>
          <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-md font-mono shrink-0">
            {subtitles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("ai")}
          className={`pb-2 px-1 text-center border-b-2 transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "ai"
              ? "border-emerald-500 text-emerald-400 font-black"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">الذكاء والتفريغ</span>
        </button>

        <button
          onClick={() => setActiveTab("tools")}
          className={`pb-2 px-1 text-center border-b-2 transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "tools"
              ? "border-blue-500 text-blue-400 font-black"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Settings2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">إضافة وتصدير</span>
        </button>
      </div>

      {/* Tab Body Content */}
      <div className="p-2.5 sm:p-3 overflow-y-auto flex-1 space-y-3 custom-scrollbar text-xs">
        
        {/* ==================================================== */}
        {/* TAB 1: TRACKS & DUAL SUBTITLES */}
        {/* ==================================================== */}
        {activeTab === "tracks" && (
          <div className="space-y-3 animate-fadeIn">
            {/* Primary Track Selection Card */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 sm:p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/30 shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">
                      المسار الأساسي (الترجمة الأولى)
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      المسار الرئيسي المعروض ومصدر قائمة الجمل
                    </p>
                  </div>
                </div>

                {activeTrack && (
                  <span className="text-[9.5px] bg-indigo-950 text-indigo-300 font-bold px-1.5 py-0.5 rounded-full border border-indigo-500/30 shrink-0">
                    {activeTrack.cues.length} مقطع
                  </span>
                )}
              </div>

              {subtitles.length === 0 ? (
                <div className="py-4 text-center text-slate-400 space-y-2">
                  <Subtitles className="w-6 h-6 text-slate-600 mx-auto" />
                  <p className="text-xs">لا يوجد مسارات ترجمة لهذا الملف حتى الآن</p>
                  <button
                    onClick={() => {
                      if (onClose) onClose();
                      onOpenUploadModal();
                    }}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة ترجمة جديدة</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 pt-0.5">
                  {subtitles.map((track) => {
                    const isPrimary = activeTrackId === track.id;
                    return (
                      <div
                        key={track.id}
                        onClick={() => onSelectPrimaryTrack(track.id)}
                        className={`p-2 sm:p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isPrimary
                            ? "bg-indigo-600/20 border-indigo-500/80 text-white shadow-xs"
                            : "bg-slate-900/80 border-slate-800/80 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                              isPrimary
                                ? "border-indigo-400 bg-indigo-500 text-white"
                                : "border-slate-600"
                            }`}
                          >
                            {isPrimary && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate flex items-center gap-1.5">
                              <span>{track.label}</span>
                              {track.source === "ai" && (
                                <span className="text-[8.5px] bg-emerald-950 text-emerald-300 px-1 py-0.2 rounded border border-emerald-500/30">
                                  AI
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {track.cues.length} جملة • {track.language || "تلقائي"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onDeleteTrack(track.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                            title="حذف هذا المسار"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={() => onSelectPrimaryTrack(null)}
                    className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all border text-center cursor-pointer ${
                      activeTrackId === null
                        ? "bg-slate-800 text-slate-200 border-slate-600"
                        : "bg-transparent text-slate-500 hover:text-slate-400 border-dashed border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    إيقاف المسار الأساسي (Off)
                  </button>
                </div>
              )}
            </div>

            {/* Quick Swap Button */}
            {subtitles.length > 1 && onSwapTracks && (
              <div className="flex items-center justify-center -my-1">
                <button
                  onClick={onSwapTracks}
                  className="px-3 py-1 bg-slate-950 hover:bg-slate-800 text-indigo-300 hover:text-indigo-200 border border-slate-800 rounded-full text-[11px] font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="تبديل الترجمة الأولى لتصبح الثانية والعكس"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                  <span>تبديل ترتيب الترجمتين (1 ⇄ 2)</span>
                </button>
              </div>
            )}

            {/* Secondary Track Selection Card (Dual Subtitles) */}
            {subtitles.length > 1 && (
              <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-2.5 sm:p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/30 shrink-0">
                      2
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                        <span>الترجمة الثانوية (المزدوجة)</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded-sm font-mono">
                          Dual
                        </span>
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        لعرض لغتين معاً (ألماني + عربي)
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={onToggleDualSubtitles}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer border ${
                      showDualSubtitles
                        ? "bg-emerald-600 text-white border-emerald-500 shadow-xs"
                        : "bg-slate-900 text-slate-400 border-slate-800"
                    }`}
                  >
                    {showDualSubtitles ? "مفعل ✓" : "معطل"}
                  </button>
                </div>

                <div className="space-y-1.5 pt-0.5">
                  {subtitles
                    .filter((t) => t.id !== activeTrackId)
                    .map((track) => {
                      const isSecondary = secondaryTrackId === track.id;
                      return (
                        <div
                          key={track.id}
                          onClick={() => onSelectSecondaryTrack(track.id)}
                          className={`p-2 sm:p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isSecondary && showDualSubtitles
                              ? "bg-emerald-600/20 border-emerald-500/80 text-white shadow-xs"
                              : "bg-slate-900/80 border-slate-800/80 text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                isSecondary && showDualSubtitles
                                  ? "border-emerald-400 bg-emerald-500 text-white"
                                  : "border-slate-600"
                              }`}
                            >
                              {isSecondary && showDualSubtitles && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{track.label}</p>
                              <p className="text-[10px] text-slate-400">
                                {track.cues.length} جملة متزامنة
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  <button
                    onClick={() => onSelectSecondaryTrack(null)}
                    className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all border text-center cursor-pointer ${
                      secondaryTrackId === null || !showDualSubtitles
                        ? "bg-slate-800 text-slate-200 border-slate-600"
                        : "bg-transparent text-slate-500 hover:text-slate-400 border-dashed border-slate-800"
                    }`}
                  >
                    بدون مسار ثانوي (ترجمة مفردة)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: AI & TRANSCRIPTION HUB */}
        {/* ==================================================== */}
        {activeTab === "ai" && (
          <div className="space-y-3 animate-fadeIn">
            {/* Gemini Arabic Translation */}
            <div className="bg-gradient-to-br from-emerald-950/40 to-slate-950 border border-emerald-500/40 rounded-xl p-3 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-md">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                    <span>ترجمة المسار للعربية (Gemini AI)</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-full font-bold">
                      🇸🇦 فوري
                    </span>
                  </h3>
                  <p className="text-[10.5px] text-slate-300 mt-0.5 leading-relaxed">
                    يترجم جميع مقاطع المسار النشط مع الحفاظ الدقيق على التوقيت بالمللي ثانية لإنشاء مسار عربي متزامن.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (onClose) onClose();
                  onOpenTranslateModal();
                }}
                disabled={!activeTrack}
                className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span className="truncate">
                  {activeTrack
                    ? `ترجمة (${activeTrack.label}) للعربية 🇸🇦`
                    : "يرجى تحديد مسار نشط أولاً"}
                </span>
              </button>
            </div>

            {/* Local Gradio German Whisper STT Server */}
            <div className="bg-gradient-to-br from-indigo-950/40 to-slate-950 border border-indigo-500/40 rounded-xl p-3 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
                  <Mic className="w-4 h-4 text-indigo-200" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                    <span>تفريغ ألماني بسيرفر Gradio المحلي</span>
                    <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded-full font-bold">
                      🇩🇪 Whisper
                    </span>
                  </h3>
                  <p className="text-[10.5px] text-slate-300 mt-0.5 leading-relaxed">
                    تفريغ الفيديو أو الصوت بالكامل واستخراج التوقيتات الألمانية الدقيقة محلياً.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (onClose) onClose();
                  onOpenGradioModal();
                }}
                className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>فتح نافذة تفريغ Gradio 🇩🇪</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 3: TOOLS, UPLOAD & EXPORT */}
        {/* ==================================================== */}
        {activeTab === "tools" && (
          <div className="space-y-3 animate-fadeIn">
            {/* Upload or Add Subtitle */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                <span>إضافة مسار ترجمة جديد</span>
              </h3>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    if (onClose) onClose();
                    onOpenUploadModal();
                  }}
                  className="p-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-right transition-all cursor-pointer flex flex-col gap-0.5"
                >
                  <span className="text-xs font-bold text-blue-400 flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع SRT / VTT</span>
                  </span>
                  <span className="text-[9.5px] text-slate-400">
                    ملف متزامن من جهازك
                  </span>
                </button>

                <button
                  onClick={() => {
                    if (onClose) onClose();
                    onOpenUploadModal();
                  }}
                  className="p-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-right transition-all cursor-pointer flex flex-col gap-0.5"
                >
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span>لصق نص يدوي</span>
                  </span>
                  <span className="text-[9.5px] text-slate-400">
                    لصق كود SRT مباشرة
                  </span>
                </button>
              </div>
            </div>

            {/* Export & Copy Subtitles */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-purple-400" />
                  <span>تصدير المسار النشط</span>
                </h3>
                {activeTrack && (
                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-[110px]">
                    {activeTrack.label}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => onDownloadSubtitles("srt")}
                  disabled={!activeTrack}
                  className="py-1.5 px-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all text-center cursor-pointer disabled:opacity-40"
                >
                  .SRT
                </button>
                <button
                  onClick={() => onDownloadSubtitles("vtt")}
                  disabled={!activeTrack}
                  className="py-1.5 px-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all text-center cursor-pointer disabled:opacity-40"
                >
                  .VTT
                </button>
                <button
                  onClick={() => onDownloadSubtitles("txt")}
                  disabled={!activeTrack}
                  className="py-1.5 px-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all text-center cursor-pointer disabled:opacity-40"
                >
                  .TXT
                </button>
              </div>

              <button
                onClick={onCopyTranscript}
                disabled={!activeTrack}
                className="w-full py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {isCopiedTranscript ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">تم نسخ النص للحافظة!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ النص كاملاً للحافظة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Embedded / Bottom Return Action */}
      {onBackToTranscript && (
        <div className="p-2 sm:p-2.5 bg-slate-950/95 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={onBackToTranscript}
            className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>العودة لقائمة الجمل والتفريغ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
};

export const SubtitleOptionsModal: React.FC<SubtitleOptionsModalProps> = ({
  isOpen,
  onClose,
  ...panelProps
}) => {
  if (!isOpen || !panelProps.currentFile) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100 animate-scaleUp">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
              <Languages className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <span>خيارات وإعدادات الترجمة</span>
                <span className="text-[10px] font-mono font-bold bg-slate-800 text-indigo-400 px-2 py-0.5 rounded-full border border-slate-700">
                  {panelProps.currentFile.subtitles?.length || 0} مسار
                </span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Panel Body */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <SubtitleOptionsPanel {...panelProps} onClose={onClose} />
        </div>
      </div>
    </div>
  );
};

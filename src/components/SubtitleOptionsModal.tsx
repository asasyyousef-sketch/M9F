import React, { useState, useEffect } from "react";
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
  ArrowRight,
  MoreVertical,
  Star
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
  const [trackMenuAnchor, setTrackMenuAnchor] = useState<{
    trackId: string;
    x: number;
    y: number;
    openAbove: boolean;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = () => {
      setTrackMenuAnchor(null);
    };
    if (trackMenuAnchor) {
      window.addEventListener("click", handleClickOutside);
      window.addEventListener("resize", handleClickOutside);
      window.addEventListener("scroll", handleClickOutside, true);
    }
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("resize", handleClickOutside);
      window.removeEventListener("scroll", handleClickOutside, true);
    };
  }, [trackMenuAnchor]);

  const handleToggleTrackMenu = (trackId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (trackMenuAnchor?.trackId === trackId) {
      setTrackMenuAnchor(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const openAbove = rect.bottom + 190 > window.innerHeight;
    const menuWidth = 175;
    let posX = rect.left - (menuWidth - rect.width);
    if (posX < 10) posX = 10;
    if (posX + menuWidth > window.innerWidth - 10) posX = window.innerWidth - menuWidth - 10;

    setTrackMenuAnchor({
      trackId,
      x: posX,
      y: openAbove ? rect.top - 6 : rect.bottom + 6,
      openAbove,
    });
  };

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
  const targetMenuTrack = trackMenuAnchor ? subtitles.find((t) => t.id === trackMenuAnchor.trackId) || null : null;

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
        {/* TAB 1: TRACKS */}
        {/* ==================================================== */}
        {activeTab === "tracks" && (
          <div className="space-y-3 animate-fadeIn">
            {/* Clean Subtitle Tracks List */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 sm:p-3 space-y-2">
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
                <div className="space-y-1.5">
                  {subtitles.map((track) => {
                    const isPrimary = activeTrackId === track.id;
                    const isSecondary = secondaryTrackId === track.id && showDualSubtitles;
                    return (
                      <div
                        key={track.id}
                        onClick={() => onSelectPrimaryTrack(track.id)}
                        className={`p-2 sm:p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isPrimary
                            ? "bg-indigo-600/20 border-indigo-500/80 text-white shadow-xs"
                            : isSecondary
                            ? "bg-emerald-600/15 border-emerald-500/60 text-slate-100"
                            : "bg-slate-900/80 border-slate-800/80 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isPrimary
                                ? "border-indigo-400 bg-indigo-500 text-white"
                                : isSecondary
                                ? "border-emerald-400 bg-emerald-500 text-white"
                                : "border-slate-600"
                            }`}
                          >
                            {isPrimary && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            {isSecondary && !isPrimary && <span className="text-[9px] font-black leading-none">2</span>}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate flex items-center gap-1.5 flex-wrap">
                              <span className="truncate">{track.label}</span>
                              {track.source === "ai" && (
                                <span className="text-[8.5px] bg-emerald-950 text-emerald-300 px-1 py-0.2 rounded border border-emerald-500/30">
                                  AI
                                </span>
                              )}
                              {isPrimary && (
                                <span className="text-[9px] bg-indigo-500/25 text-indigo-300 font-bold px-1.5 py-0.2 rounded border border-indigo-500/30">
                                  أساسي
                                </span>
                              )}
                              {isSecondary && (
                                <span className="text-[9px] bg-emerald-500/25 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
                                  ثانوي
                                </span>
                              )}
                            </p>
                            <p className="text-[10.5px] text-slate-400 truncate mt-0.5">
                              {track.cues.length} جملة • {track.language || "تلقائي"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleToggleTrackMenu(track.id, e)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center border-0 outline-none ${
                              trackMenuAnchor?.trackId === track.id
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "text-slate-400 hover:text-white hover:bg-slate-800"
                            }`}
                            title="خيارات المسار"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={() => {
                      if (onClose) onClose();
                      onOpenUploadModal();
                    }}
                    className="w-full mt-1.5 py-1.5 bg-slate-900/60 hover:bg-slate-800 text-indigo-300 hover:text-white border border-dashed border-slate-800 hover:border-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة مسار ترجمة جديد</span>
                  </button>
                </div>
              )}
            </div>
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

      {/* Floating Track Options Context Menu */}
      {trackMenuAnchor && targetMenuTrack && (
        <div
          className={`fixed z-[100] min-w-[175px] bg-slate-900/98 backdrop-blur-md rounded-2xl p-1.5 shadow-2xl text-right border-0 shadow-black/80 ring-1 ring-white/10 ${
            trackMenuAnchor.openAbove ? "origin-bottom animate-scaleUp" : "origin-top animate-scaleUp"
          }`}
          style={{
            top: trackMenuAnchor.openAbove ? undefined : `${trackMenuAnchor.y}px`,
            bottom: trackMenuAnchor.openAbove ? `${window.innerHeight - trackMenuAnchor.y}px` : undefined,
            left: `${trackMenuAnchor.x}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. تحديد كـ أساسي */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectPrimaryTrack(targetMenuTrack.id);
              setTrackMenuAnchor(null);
            }}
            className={`w-full px-2.5 py-2 hover:bg-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer border-0 ${
              targetMenuTrack.id === activeTrackId ? "text-indigo-400 bg-indigo-500/10" : "text-slate-200 hover:text-white"
            }`}
          >
            <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>تحديد كـ أساسي</span>
          </button>

          {/* 2. تحديد كـ ثانوي (ان كان هناك اساسي بالاصل يظهر هذا الخيار) */}
          {activeTrackId !== null && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSecondaryTrack(targetMenuTrack.id);
                if (!showDualSubtitles) {
                  onToggleDualSubtitles();
                }
                setTrackMenuAnchor(null);
              }}
              className={`w-full px-2.5 py-2 hover:bg-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer border-0 ${
                targetMenuTrack.id === secondaryTrackId && showDualSubtitles
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-slate-200 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>تحديد كـ ثانوي</span>
            </button>
          )}

          {/* 3. تبديل (ان كان هناك اساسي وثانوي محددين وتريد التبديل بينهما) */}
          {activeTrackId && secondaryTrackId && activeTrackId !== secondaryTrackId && onSwapTracks && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSwapTracks();
                setTrackMenuAnchor(null);
              }}
              className="w-full px-2.5 py-2 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer border-0"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>تبديل الأساسي والثانوي</span>
            </button>
          )}

          {/* 4. زر الحذف */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTrack(targetMenuTrack.id);
              setTrackMenuAnchor(null);
            }}
            className="w-full px-2.5 py-2 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer border-0"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>حذف المسار</span>
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

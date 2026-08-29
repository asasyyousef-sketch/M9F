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
  Bot,
  Plus,
  Palette,
  FileText,
  Copy,
  CheckCheck,
  Settings2,
  Globe,
  Layers,
  ArrowRightLeft,
  ChevronLeft
} from "lucide-react";
import { MediaFile, MediaSubtitleTrack, SubtitleCue } from "../types";

interface SubtitleOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFile: MediaFile | null;
  activeTrackId: string | null;
  secondaryTrackId: string | null;
  showDualSubtitles: boolean;
  showSubtitlesOverlay: boolean;
  onToggleSubtitlesOverlay: () => void;
  onSelectPrimaryTrack: (id: string | null) => void;
  onSelectSecondaryTrack: (id: string | null) => void;
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
}

export const SubtitleOptionsModal: React.FC<SubtitleOptionsModalProps> = ({
  isOpen,
  onClose,
  currentFile,
  activeTrackId,
  secondaryTrackId,
  showDualSubtitles,
  showSubtitlesOverlay,
  onToggleSubtitlesOverlay,
  onSelectPrimaryTrack,
  onSelectSecondaryTrack,
  onToggleDualSubtitles,
  onDeleteTrack,
  onOpenUploadModal,
  onOpenGradioModal,
  onOpenTranslateModal,
  onOpenStyleModal,
  onDownloadSubtitles,
  onCopyTranscript,
  isCopiedTranscript
}) => {
  const [activeTab, setActiveTab] = useState<"tracks" | "ai" | "tools">("tracks");

  if (!isOpen || !currentFile) return null;

  const subtitles = currentFile.subtitles || [];
  const activeTrack = subtitles.find((t) => t.id === activeTrackId) || null;
  const secondaryTrack = subtitles.find((t) => t.id === secondaryTrackId) || null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100 animate-scaleUp">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-indigo-600 via-blue-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>خيارات وإعدادات الترجمة</span>
                <span className="text-[11px] font-mono font-bold bg-slate-800 text-indigo-400 px-2 py-0.5 rounded-full border border-slate-700">
                  {subtitles.length} مسار
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                الترجمة الأولى، الترجمة المزدوجة، الذكاء الاصطناعي والتفريغ الصوتي
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Quick Toggle Bar */}
        <div className="px-4 sm:px-5 py-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSubtitlesOverlay}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                showSubtitlesOverlay
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              }`}
            >
              <Subtitles className="w-3.5 h-3.5" />
              <span>{showSubtitlesOverlay ? "عرض الترجمة: مفعل ✓" : "عرض الترجمة: معطل"}</span>
            </button>

            {subtitles.length > 1 && (
              <button
                onClick={onToggleDualSubtitles}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  showDualSubtitles
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span>{showDualSubtitles ? "ترجمة مزدوجة (لغتين) ✓" : "ترجمة مفردة"}</span>
              </button>
            )}
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenStyleModal();
            }}
            className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="تخصيص ألوان وخطوط ومواقع الترجمة"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>تخصيص الستايل</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/90 px-4 pt-2 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab("tracks")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "tracks"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>مسارات الترجمة</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-md font-mono">
              {subtitles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("ai")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "ai"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>الذكاء الاصطناعي والتفريغ</span>
          </button>

          <button
            onClick={() => setActiveTab("tools")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "tools"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>إضافة وتصدير</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: TRACKS & DUAL SUBTITLES */}
          {activeTab === "tracks" && (
            <div className="space-y-4">
              {/* Primary Track Selection Card */}
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/30">
                      1
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-200">
                        المسار الأساسي (الترجمة الأولى)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        المسار الرئيسي المعروض ومصدر قائمة الجمل التفاعلية
                      </p>
                    </div>
                  </div>

                  {activeTrack && (
                    <span className="text-[10px] bg-indigo-950 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                      {activeTrack.cues.length} مقطع
                    </span>
                  )}
                </div>

                {subtitles.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 space-y-2">
                    <Subtitles className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs">لا يوجد مسارات ترجمة لهذا الملف حتى الآن</p>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenUploadModal();
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 mt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة ترجمة جديدة</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    {subtitles.map((track) => {
                      const isPrimary = activeTrackId === track.id;
                      return (
                        <div
                          key={track.id}
                          onClick={() => onSelectPrimaryTrack(track.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isPrimary
                              ? "bg-indigo-600/20 border-indigo-500/80 text-white shadow-xs"
                              : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
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
                                  <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30">
                                    AI
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {track.cues.length} جملة متزامنة • {track.language || "تلقائي"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => onDeleteTrack(track.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
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
                      className={`w-full py-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                        activeTrackId === null
                          ? "bg-slate-800 text-slate-200 border-slate-600"
                          : "bg-transparent text-slate-500 hover:text-slate-400 border-dashed border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      إيقاف الترجمة الأولى (Off)
                    </button>
                  </div>
                )}
              </div>

              {/* Secondary Track Selection Card (Dual Subtitles) */}
              {subtitles.length > 1 && (
                <div className="bg-slate-800/60 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/30">
                        2
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                          <span>الترجمة الثانوية (المسار الثاني / المزدوج)</span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-md">
                            Dual CC
                          </span>
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          لعرض لغتين معاً في نفس الوقت (مثال: ألماني أصلي + عربي مترجم)
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={onToggleDualSubtitles}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                        showDualSubtitles
                          ? "bg-emerald-600 text-white border-emerald-500 shadow-xs"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {showDualSubtitles ? "مفعل ✓" : "معطل"}
                    </button>
                  </div>

                  <div className="space-y-2 pt-1">
                    {subtitles
                      .filter((t) => t.id !== activeTrackId)
                      .map((track) => {
                        const isSecondary = secondaryTrackId === track.id;
                        return (
                          <div
                            key={track.id}
                            onClick={() => onSelectSecondaryTrack(track.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSecondary && showDualSubtitles
                                ? "bg-emerald-600/20 border-emerald-500/80 text-white shadow-xs"
                                : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
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
                      className={`w-full py-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
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

          {/* TAB 2: AI & TRANSCRIPTION HUB */}
          {activeTab === "ai" && (
            <div className="space-y-4">
              {/* Gemini Arabic Translation */}
              <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <span>ترجمة المسار للعربية بالذكاء الاصطناعي (Gemini)</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                        🇸🇦 ترجمة فورية
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                      يترجم جميع مقاطع المسار النشط مع الحفاظ الدقيق على التوقيت بالمللي ثانية لإنشاء مسار عربي متزامن مباشرة للترجمة المزدوجة.
                    </p>
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenTranslateModal();
                    }}
                    disabled={!activeTrack}
                    className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>
                      {activeTrack
                        ? `ترجمة المسار (${activeTrack.label}) للعربية 🇸🇦`
                        : "يرجى تحديد مسار نشط أولاً"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Local Gradio German Whisper STT Server */}
              <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <span>تفريغ صوتي ألماني بسيرفر Gradio المحلي</span>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                        🇩🇪 Local Whisper
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                      تفريغ أي فيديو أو ملف صوتي بالكامل واستخراج التوقيتات الألمانية الدقيقة بدون استهلاك إنترنت خارجي.
                    </p>
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenGradioModal();
                    }}
                    className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>فتح نافذة تفريغ Gradio 🇩🇪</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TOOLS, UPLOAD & EXPORT */}
          {activeTab === "tools" && (
            <div className="space-y-4">
              {/* Upload or Add Subtitle */}
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-400" />
                  <span>إضافة مسار ترجمة جديد</span>
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenUploadModal();
                    }}
                    className="p-3 bg-slate-900 hover:bg-slate-850 border border-slate-700 rounded-xl text-right transition-all cursor-pointer flex flex-col gap-1"
                  >
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>رفع ملف SRT / VTT</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      رفع ملف جاهز متزامن من جهازك
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      onOpenUploadModal();
                    }}
                    className="p-3 bg-slate-900 hover:bg-slate-850 border border-slate-700 rounded-xl text-right transition-all cursor-pointer flex flex-col gap-1"
                  >
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>لصق نص يدوي</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      كتابة أو لصق كود SRT مباشرة
                    </span>
                  </button>
                </div>
              </div>

              {/* Export & Copy Subtitles */}
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Download className="w-4 h-4 text-purple-400" />
                    <span>تصدير وتحميل المسار الحالي</span>
                  </h3>
                  {activeTrack && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {activeTrack.label}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => onDownloadSubtitles("srt")}
                    disabled={!activeTrack}
                    className="py-2 px-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all text-center cursor-pointer disabled:opacity-40"
                  >
                    تحميل (.SRT)
                  </button>
                  <button
                    onClick={() => onDownloadSubtitles("vtt")}
                    disabled={!activeTrack}
                    className="py-2 px-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all text-center cursor-pointer disabled:opacity-40"
                  >
                    تحميل (.VTT)
                  </button>
                  <button
                    onClick={() => onDownloadSubtitles("txt")}
                    disabled={!activeTrack}
                    className="py-2 px-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all text-center cursor-pointer disabled:opacity-40"
                  >
                    نص عادي (.TXT)
                  </button>
                </div>

                <button
                  onClick={onCopyTranscript}
                  disabled={!activeTrack}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-850 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  {isCopiedTranscript ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">تم نسخ النص كاملاً للحافظة!</span>
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

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};

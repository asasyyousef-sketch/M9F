import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Sparkles,
  Upload,
  Settings,
  X,
  Play,
  Check,
  Copy,
  Download,
  AlertCircle,
  Clock,
  Radio,
  FileText,
  Subtitles,
  Film,
  Music,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  Server,
  Info,
  Palette
} from "lucide-react";
import { MediaFile, SubtitleCue } from "../types";
import {
  transcribeFileWithGradio,
  DEFAULT_GRADIO_URL,
  GradioTranscribeResult
} from "../utils/gradioTranscription";
import { parseSubtitleContent } from "../utils/subtitleParser";

interface GradioTranscriberModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFile: MediaFile | null;
  onSubtitlesGenerated: (trackLabel: string, cues: SubtitleCue[], rawSrt: string) => Promise<void>;
  onOpenStyleModal?: () => void;
}

export const GradioTranscriberModal: React.FC<GradioTranscriberModalProps> = ({
  isOpen,
  onClose,
  currentFile,
  onSubtitlesGenerated,
  onOpenStyleModal
}) => {
  // Source Selection: 'current' (active media file) or 'upload' (new file from device)
  const [sourceMode, setSourceMode] = useState<"current" | "upload">(
    currentFile ? "current" : "upload"
  );
  const [selectedLocalFile, setSelectedLocalFile] = useState<File | null>(null);

  // Server URL
  const [serverUrl, setServerUrl] = useState<string>(() => {
    return localStorage.getItem("gradio_local_stt_url") || DEFAULT_GRADIO_URL;
  });

  // Hyperparameters
  const [beamSize, setBeamSize] = useState<number>(5);
  const [bestOf, setBestOf] = useState<number>(5);
  const [temperature, setTemperature] = useState<number>(0.0);
  const [conditionOnPreviousText, setConditionOnPreviousText] = useState<boolean>(true);
  const [vadFilter, setVadFilter] = useState<boolean>(true);
  const [minSilenceDurationMs, setMinSilenceDurationMs] = useState<number>(2000);
  const [noSpeechThreshold, setNoSpeechThreshold] = useState<number>(0.6);
  const [compressionRatioThreshold, setCompressionRatioThreshold] = useState<number>(2.4);
  const [logProbThreshold, setLogProbThreshold] = useState<number>(-1.0);

  // UI state
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<"idle" | "uploading" | "calling" | "processing" | "completed" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Output Result
  const [result, setResult] = useState<GradioTranscribeResult | null>(null);
  const [parsedCuesCount, setParsedCuesCount] = useState<number>(0);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [activeTabResult, setActiveTabResult] = useState<"text" | "subtitles" | "videoHtml">("text");

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Save server URL to localStorage when changed
  const handleServerUrlChange = (val: string) => {
    setServerUrl(val);
    localStorage.setItem("gradio_local_stt_url", val);
  };

  // Manage elapsed timer during processing
  useEffect(() => {
    if (isProcessing) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isProcessing]);

  // Cancel / Abort operation
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setCurrentStep("idle");
    setStatusMessage("تم إلغاء عملية التفريغ.");
  };

  // Trigger Transcription
  const handleStartTranscribe = async () => {
    setErrorMessage(null);
    setResult(null);

    let targetFileBlob: File | Blob | null = null;
    let targetFileName = "media_audio.mp4";

    if (sourceMode === "current") {
      if (!currentFile) {
        setErrorMessage("لا يوجد مقطع مشغل حالياً. يرجى اختيار ملف من جهازك.");
        return;
      }
      targetFileName = currentFile.originalName || `${currentFile.title}.${currentFile.type === "video" ? "mp4" : "mp3"}`;

      setStatusMessage("جاري تحضير ملف الوسائط من السيرفر...");
      setIsProcessing(true);
      setCurrentStep("uploading");

      try {
        const streamUrl = `/api/media/download/${currentFile.id}`;
        const response = await fetch(streamUrl);
        if (!response.ok) {
          throw new Error("تعذر جلب ملف المقطع لتمريره للسيرفر المحلي.");
        }
        targetFileBlob = await response.blob();
      } catch (err: any) {
        setIsProcessing(false);
        setCurrentStep("error");
        setErrorMessage(`خطأ في جلب المقطع: ${err.message}`);
        return;
      }
    } else {
      if (!selectedLocalFile) {
        setErrorMessage("يرجى اختيار ملف صوت أو فيديو من جهازك أولاً.");
        return;
      }
      targetFileBlob = selectedLocalFile;
      targetFileName = selectedLocalFile.name;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsProcessing(true);

    try {
      const res = await transcribeFileWithGradio(targetFileBlob, targetFileName, {
        serverUrl,
        beamSize,
        bestOf,
        temperature,
        conditionOnPreviousText,
        vadFilter,
        minSilenceDurationMs,
        noSpeechThreshold,
        compressionRatioThreshold,
        logProbThreshold,
        signal: controller.signal,
        onStatusUpdate: (msg, step) => {
          setStatusMessage(msg);
          setCurrentStep(step);
        }
      });

      setResult(res);
      setCurrentStep("completed");

      // Parse SRT and automatically save to subtitles
      if (res.srtText && res.srtText.trim().length > 0) {
        const cues = parseSubtitleContent(res.srtText);
        setParsedCuesCount(cues.length);
        if (cues.length > 0) {
          const trackLabel = `🇩🇪 ألماني (سيرفر Gradio)`;
          await onSubtitlesGenerated(trackLabel, cues, res.srtText);
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setStatusMessage("تم الإلغاء.");
      } else {
        console.error("Gradio Transcription Error:", err);
        setErrorMessage(err.message || "حدث خطأ غير متوقع أثناء معالجة التفريغ.");
        setCurrentStep("error");
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  // Helper format seconds
  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Copy plain text
  const handleCopyPlainText = () => {
    if (!result?.plainText) return;
    navigator.clipboard.writeText(result.plainText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Download raw file helpers
  const handleDownloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 animate-scaleUp">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Mic className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-slate-100 text-base sm:text-lg">
                  التفريغ الصوتي بالسيرفر المحلي (Gradio 🇩🇪)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                  Local Network
                </span>
              </div>
              <p className="text-xs text-slate-400">
                ربط مباشر بنظام Speech-to-Text الألماني عبر منفذ الشبكة المحلية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenStyleModal && (
              <button
                type="button"
                onClick={onOpenStyleModal}
                className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="تخصيص ألوان وخطوط ومواقع الترجمة"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>تخصيص الستايل</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">

          {/* SERVER CONNECTION BANNER & URL SETTING */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Server className="w-4 h-4 text-indigo-400" />
                <span>عنوان سيرفر Gradio على شبكتك:</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-700">
                {serverUrl}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => handleServerUrlChange(e.target.value)}
                placeholder="http://192.168.0.159:7861"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={() => handleServerUrlChange(DEFAULT_GRADIO_URL)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                title="استعادة العنوان الافتراضي"
              >
                الافتراضي
              </button>
            </div>
          </div>

          {/* SOURCE SELECTION TABS */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              اختر مصدر الملف للتفريغ:
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700">
              <button
                type="button"
                onClick={() => setSourceMode("current")}
                disabled={!currentFile}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  sourceMode === "current"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                }`}
              >
                {currentFile?.type === "video" ? <Film className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                <span>المقطع المشغل حالياً</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceMode("upload")}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  sourceMode === "upload"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>رفع ملف جديد من الجهاز</span>
              </button>
            </div>

            {/* Source Details Card */}
            {sourceMode === "current" && currentFile && (
              <div className="mt-2.5 bg-slate-950/60 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-900/40 text-indigo-400 flex items-center justify-center shrink-0">
                  {currentFile.type === "video" ? <Film className="w-5 h-5" /> : <Music className="w-5 h-5" />}
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-xs font-bold text-slate-200 truncate">{currentFile.title}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{currentFile.originalName}</p>
                </div>
              </div>
            )}

            {sourceMode === "upload" && (
              <div className="mt-2.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="audio/*,video/*,.mp4,.mp3,.wav,.m4a,.webm,.ogg,.mkv,.flac"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setSelectedLocalFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 bg-indigo-950/20 hover:bg-indigo-950/40 rounded-2xl p-5 text-center cursor-pointer transition-all"
                >
                  <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                  {selectedLocalFile ? (
                    <div>
                      <p className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم اختيار: {selectedLocalFile.name}</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        الحجم: {(selectedLocalFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-slate-200">
                        انقر لاختيار ملف صوتي أو فيديو من حاسوبك
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        يدعم صيغ MP4, MP3, WAV, M4A, WEBM, MKV
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ADVANCED PARAMETERS ACCORDION */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full p-3 flex items-center justify-between text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>إعدادات المودل المتقدمة (Beam Size, VAD, Temperature...)</span>
              </div>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="p-4 border-t border-slate-800 bg-slate-900/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Beam Size */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Beam Size (الافتراضي 5):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={beamSize}
                    onChange={(e) => setBeamSize(parseInt(e.target.value) || 5)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Best Of */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Best Of (الافتراضي 5):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={bestOf}
                    onChange={(e) => setBestOf(parseInt(e.target.value) || 5)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Temperature */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Temperature (الافتراضي 0.0):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.0"
                    max="1.0"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Min Silence ms */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Min Silence Duration ms (الافتراضي 2000):
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={minSilenceDurationMs}
                    onChange={(e) => setMinSilenceDurationMs(parseInt(e.target.value) || 2000)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="vadCheck"
                    checked={vadFilter}
                    onChange={(e) => setVadFilter(e.target.checked)}
                    className="rounded text-indigo-600 accent-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="vadCheck" className="text-[11px] text-slate-300 cursor-pointer">
                    تفعيل VAD Filter لتصفية الصمت
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="condCheck"
                    checked={conditionOnPreviousText}
                    onChange={(e) => setConditionOnPreviousText(e.target.checked)}
                    className="rounded text-indigo-600 accent-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="condCheck" className="text-[11px] text-slate-300 cursor-pointer">
                    Condition On Previous Text
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* PROGRESS & LIVE STATUS TRACKER */}
          {isProcessing && (
            <div className="bg-indigo-950/40 border border-indigo-500/40 rounded-2xl p-4 space-y-3 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  <span className="text-xs font-black text-indigo-200">
                    جاري المعالجة على سيرفر Gradio...
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-indigo-900/60 text-indigo-300 px-2.5 py-1 rounded-xl text-xs font-mono font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatTimer(elapsedSeconds)}</span>
                </div>
              </div>

              {/* Progress Steps Visual */}
              <div className="grid grid-cols-3 gap-2 text-[10px] text-center font-bold">
                <div className={`p-2 rounded-xl border ${currentStep === "uploading" ? "bg-indigo-600 text-white border-indigo-400" : "bg-slate-800/80 text-slate-400 border-slate-700"}`}>
                  1. رفع الملف 📤
                </div>
                <div className={`p-2 rounded-xl border ${currentStep === "calling" ? "bg-indigo-600 text-white border-indigo-400" : "bg-slate-800/80 text-slate-400 border-slate-700"}`}>
                  2. استدعاء المودل ⚙️
                </div>
                <div className={`p-2 rounded-xl border ${currentStep === "processing" ? "bg-indigo-600 text-white border-indigo-400" : "bg-slate-800/80 text-slate-400 border-slate-700"}`}>
                  3. البث والتفريغ 🇩🇪
                </div>
              </div>

              {/* Status Message Text */}
              <p className="text-xs text-indigo-300 font-mono bg-slate-950/80 p-2.5 rounded-xl border border-indigo-900">
                {statusMessage}
              </p>

              <div className="text-left">
                <button
                  onClick={handleCancel}
                  className="text-xs text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
                >
                  إلغاء العملية
                </button>
              </div>
            </div>
          )}

          {/* ERROR ALERT */}
          {errorMessage && (
            <div className="bg-rose-950/60 border border-rose-600/50 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-200">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">تعذر إكمال عملية التفريغ:</p>
                <p className="text-[11px] leading-relaxed text-rose-300">{errorMessage}</p>
                <p className="text-[10px] text-rose-400/80 mt-1">
                  💡 تلميح: تأكد أن سيرفر Gradio يعمل على العنوان المحدد وأن متصفحك يستطيع الوصول للعنوان (192.168.0.159).
                </p>
              </div>
            </div>
          )}

          {/* RESULTS DISPLAY PANEL */}
          {result && (
            <div className="bg-slate-800/90 border border-emerald-500/40 rounded-2xl p-4 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-100">
                      اكتمل التفريغ بنجاح!
                    </h4>
                    <p className="text-[10px] text-emerald-400">
                      تم استخراج {parsedCuesCount} مقطع ترجمة متزامن وتثبيتها بالمشغل
                    </p>
                  </div>
                </div>

                {/* Sub-tabs for result view */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700 text-[11px] font-bold">
                  <button
                    onClick={() => setActiveTabResult("text")}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      activeTabResult === "text" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    النص الألماني (Plain Text)
                  </button>
                  <button
                    onClick={() => setActiveTabResult("subtitles")}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      activeTabResult === "subtitles" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    نص الترجمة (SRT)
                  </button>
                  {result.videoHtml && (
                    <button
                      onClick={() => setActiveTabResult("videoHtml")}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        activeTabResult === "videoHtml" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      فيديو مع الترجمة (HTML)
                    </button>
                  )}
                </div>
              </div>

              {/* TAB 1: PLAIN TEXT */}
              {activeTabResult === "text" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400">
                      النص المفرغ كاملاً:
                    </span>
                    <button
                      onClick={handleCopyPlainText}
                      className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                    >
                      {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedText ? "تم النسخ!" : "نسخ النص"}</span>
                    </button>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-700 text-xs font-mono text-slate-200 leading-relaxed max-h-48 overflow-y-auto select-text">
                    {result.plainText || "لا يوجد نص عادي متاح."}
                  </div>
                </div>
              )}

              {/* TAB 2: SRT FORMATTED */}
              {activeTabResult === "subtitles" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400">
                      ملف الترجمة المتزامنة (SRT):
                    </span>
                    <button
                      onClick={() => handleDownloadFile(result.srtText, "transcript.srt", "text/plain")}
                      className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تحميل SRT</span>
                    </button>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-700 text-xs font-mono text-emerald-300/90 leading-relaxed max-h-48 overflow-y-auto select-text whitespace-pre-wrap">
                    {result.srtText || "لا يوجد نص SRT."}
                  </div>
                </div>
              )}

              {/* TAB 3: VIDEO HTML IF AVAILABLE */}
              {activeTabResult === "videoHtml" && result.videoHtml && (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-400">
                    معاينة الفيديو المولد من سيرفر Gradio مع الترجمة المتزامنة:
                  </p>
                  <div
                    className="bg-black rounded-xl overflow-hidden p-2 border border-slate-700 max-h-60 flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: result.videoHtml }}
                  />
                </div>
              )}

              {/* DOWNLOAD LINKS ROW */}
              <div className="pt-2 border-t border-slate-700/80 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 ml-1">
                  تحميل النتائج:
                </span>

                {result.plainText && (
                  <button
                    onClick={() => handleDownloadFile(result.plainText, "german_transcript.txt", "text/plain")}
                    className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>ملف نص (.TXT)</span>
                  </button>
                )}

                {result.srtText && (
                  <button
                    onClick={() => handleDownloadFile(result.srtText, "subtitles.srt", "text/plain")}
                    className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>ملف ترجمة (.SRT)</span>
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>يتم التفريغ مباشرة على المعالج (CPU/GPU) لسيرفرك المحلي.</span>
          </div>

          <div className="flex items-center gap-2">
            {result ? (
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>العودة إلى المشغل والتفريغ التفاعلي</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  onClick={handleStartTranscribe}
                  disabled={isProcessing || (sourceMode === "upload" && !selectedLocalFile) || (sourceMode === "current" && !currentFile)}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-rose-600 to-amber-500 hover:from-indigo-500 hover:to-amber-400 text-white rounded-xl font-black text-xs shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التفريغ ({formatTimer(elapsedSeconds)})...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>بدء التفريغ بالذكاء الاصطناعي (Transcribe) ⚡</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

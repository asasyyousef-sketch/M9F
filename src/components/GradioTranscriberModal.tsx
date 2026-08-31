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
  Palette,
  Tv,
  ExternalLink,
  Zap,
  ArrowRight,
  Layers
} from "lucide-react";
import { MediaFile, SubtitleCue } from "../types";
import {
  transcribeFileWithGradio,
  getYouTubeInfo,
  processYouTubeLink,
  pollYouTubeStatus,
  DEFAULT_GRADIO_URL,
  GradioTranscribeResult,
  YouTubeVideoInfo,
  YouTubeVideoFormat
} from "../utils/gradioTranscription";
import { parseSubtitleContent } from "../utils/subtitleParser";

interface GradioTranscriberModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFile: MediaFile | null;
  initialMode?: "youtube" | "current" | "upload";
  onSubtitlesGenerated: (trackLabel: string, cues: SubtitleCue[], rawSrt: string) => Promise<void>;
  onVideoDownloaded?: (mediaFile: MediaFile, rawSrt: string, cues: SubtitleCue[]) => Promise<void>;
  onOpenStyleModal?: () => void;
}

export const GradioTranscriberModal: React.FC<GradioTranscriberModalProps> = ({
  isOpen,
  onClose,
  currentFile,
  initialMode,
  onSubtitlesGenerated,
  onVideoDownloaded,
  onOpenStyleModal
}) => {
  // Source Selection: 'youtube' (YouTube URL download & transcribe), 'current' (active media file), or 'upload' (file from device)
  const [sourceMode, setSourceMode] = useState<"youtube" | "current" | "upload">(
    initialMode || (currentFile ? "current" : "youtube")
  );

  // Sync initialMode when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialMode) {
        setSourceMode(initialMode);
      } else if (currentFile) {
        setSourceMode("current");
      } else {
        setSourceMode("youtube");
      }
    }
  }, [isOpen, initialMode, currentFile]);

  // YouTube Mode state
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [youtubeInfo, setYoutubeInfo] = useState<YouTubeVideoInfo | null>(null);
  const [isLoadingYtInfo, setIsLoadingYtInfo] = useState<boolean>(false);
  const [selectedFormatId, setSelectedFormatId] = useState<string>("22");
  const [showFullDescription, setShowFullDescription] = useState<boolean>(false);
  const [liveVideoUrl, setLiveVideoUrl] = useState<string | null>(null);
  const [liveVttTrackUrl, setLiveVttTrackUrl] = useState<string | null>(null);
  const [liveStage, setLiveStage] = useState<string>("idle");
  const [liveStageLabel, setLiveStageLabel] = useState<string>("");

  // Local File state
  const [selectedLocalFile, setSelectedLocalFile] = useState<File | null>(null);

  // Server URL
  const [serverUrl, setServerUrl] = useState<string>(() => {
    return localStorage.getItem("gradio_local_stt_url") || DEFAULT_GRADIO_URL;
  });

  // Whisper Hyperparameters
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
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Output Result
  const [result, setResult] = useState<GradioTranscribeResult | null>(null);
  const [downloadedMediaFile, setDownloadedMediaFile] = useState<MediaFile | null>(null);
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
    setStatusMessage("تم إلغاء عملية المعالجة.");
  };

  // Fetch YouTube Info (Step 1)
  const handleFetchYouTubeInfo = async () => {
    if (!youtubeUrl.trim()) {
      setErrorMessage("يرجى إدخال رابط فيديو يوتيوب صحيح أولاً.");
      return;
    }
    setErrorMessage(null);
    setIsLoadingYtInfo(true);
    setYoutubeInfo(null);
    setLiveVideoUrl(null);
    setLiveVttTrackUrl(null);
    setLiveStage("idle");

    try {
      const info = await getYouTubeInfo(youtubeUrl.trim(), serverUrl);
      setYoutubeInfo(info);
      if (info.qualities && info.qualities.length > 0) {
        // Pick 720p or highest available format by default
        const has720 = info.qualities.find((q) => q.label === "720p" || q.formatId === "22");
        setSelectedFormatId(has720 ? has720.formatId : info.qualities[0].formatId);
      } else if (info.formats && info.formats.length > 0) {
        const has720 = info.formats.find((f) => f.formatId === "720p" || f.resolution.includes("720"));
        setSelectedFormatId(has720 ? "720p" : info.formats[0].formatId);
      }
    } catch (err: any) {
      console.error("YouTube Info error:", err);
      setErrorMessage(err.message || "فشل جلب معلومات الفيديو من السيرفر. تحقق من الرابط والسيرفر.");
    } finally {
      setIsLoadingYtInfo(false);
    }
  };

  // Trigger YouTube Download & Transcription Pipeline (Step 2 & Step 3)
  const handleStartYouTubeDownloadAndTranscribe = async () => {
    if (!youtubeUrl.trim()) {
      setErrorMessage("يرجى إدخال رابط فيديو يوتيوب أولاً.");
      return;
    }

    setErrorMessage(null);
    setResult(null);
    setDownloadedMediaFile(null);
    setLiveVttTrackUrl(null);
    setIsProcessing(true);
    setCurrentStep("uploading");
    setLiveStage("downloading");
    setLiveStageLabel("جاري التحميل");
    setProgressPercent(5);
    setStatusMessage("جاري الاتصال بالسيرفر لبدء مهمة تنزيل الفيديو وتفريغه بالدقة المحددة...");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 1. Trigger process job
      const jobId = await processYouTubeLink(youtubeUrl.trim(), selectedFormatId, {
        serverUrl,
        includeSubtitles: true,
        beamSize,
        bestOf,
        temperature,
        vadFilter,
        minSilenceDurationMs,
        signal: controller.signal
      });

      setCurrentStep("processing");

      // 2. Poll for completion
      const completedJob = await pollYouTubeStatus(
        jobId,
        (status) => {
          setStatusMessage(status.statusMsg || status.message || "جاري المعالجة...");
          setProgressPercent(status.percent ?? status.progress ?? 0);
          setLiveStage(status.stage);
          if (status.stageLabel) setLiveStageLabel(status.stageLabel);

          // Early video display: as soon as videoUrl is present, set it!
          if (status.videoUrl) {
            setLiveVideoUrl(status.videoUrl);
          }
        },
        serverUrl,
        controller.signal
      );

      const srtText = completedJob.srtText || "";
      const plainText = completedJob.plainText || "";
      const vttContent = completedJob.vttContent || completedJob.vttText || "";

      if (completedJob.videoUrl) {
        setLiveVideoUrl(completedJob.videoUrl);
      }

      // Attach WebVTT track if available
      if (vttContent) {
        try {
          const vttBlob = new Blob([vttContent], { type: "text/vtt;charset=utf-8" });
          const blobUrl = URL.createObjectURL(vttBlob);
          setLiveVttTrackUrl(blobUrl);
        } catch (e) {
          console.warn("Could not create WebVTT blob track:", e);
        }
      }

      const resObj: GradioTranscribeResult = {
        plainText,
        srtText,
        vttText: vttContent,
        audioFileUrl: completedJob.videoUrl
      };
      setResult(resObj);
      setCurrentStep("completed");
      setLiveStage("done");
      setLiveStageLabel("اكتمل");
      setProgressPercent(100);

      // Parse Subtitle cues
      const cues = parseSubtitleContent(srtText);
      setParsedCuesCount(cues.length);

      // 3. Save as MediaFile to Express backend library
      try {
        const saveRes = await fetch("/api/media/from-youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: completedJob.title || youtubeInfo?.title || "فيديو يوتيوب مفرغ",
            videoId: completedJob.videoId || youtubeInfo?.videoId,
            videoUrl: completedJob.videoUrl || liveVideoUrl,
            srtText,
            cues,
            duration: completedJob.duration || youtubeInfo?.duration,
            thumbnailUrl: completedJob.thumbnailUrl || youtubeInfo?.thumbnailUrl,
            formatId: selectedFormatId,
            author: completedJob.author || youtubeInfo?.author,
            description: youtubeInfo?.description
          })
        });

        if (saveRes.ok) {
          const savedData = await saveRes.json();
          if (savedData.file) {
            setDownloadedMediaFile(savedData.file);
            // Notify parent workspace to auto-load newly created media file
            if (onVideoDownloaded) {
              await onVideoDownloaded(savedData.file, srtText, cues);
            }
          }
        }
      } catch (saveErr) {
        console.warn("Could not auto-save media to backend:", saveErr);
      }

      // If there is an active file, also save subtitles directly
      if (currentFile && cues.length > 0) {
        const trackLabel = `🇩🇪 تفريغ يوتيوب (${selectedFormatId})`;
        await onSubtitlesGenerated(trackLabel, cues, srtText);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setStatusMessage("تم إلغاء العملية.");
      } else {
        console.error("YouTube download & transcribe error:", err);
        setErrorMessage(err.message || "حدث خطأ أثناء تنزيل وتفريغ الفيديو.");
        setCurrentStep("error");
        setLiveStage("error");
        setLiveStageLabel("فشل");
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  // Trigger File Transcription (Active File or Uploaded Local File)
  const handleStartTranscribe = async () => {
    if (sourceMode === "youtube") {
      return handleStartYouTubeDownloadAndTranscribe();
    }

    setErrorMessage(null);
    setResult(null);

    let targetFileBlob: File | Blob | null = null;
    let targetFileName = "media_audio.mp4";

    if (sourceMode === "current") {
      if (!currentFile) {
        setErrorMessage("لا يوجد مقطع مشغل حالياً. يرجى اختيار ملف من جهازك أو من يوتيوب.");
        return;
      }
      targetFileName = currentFile.originalName || `${currentFile.title}.${currentFile.type === "video" ? "mp4" : "mp3"}`;

      setStatusMessage("جاري تحضير ملف الوسائط من السيرفر...");
      setIsProcessing(true);
      setCurrentStep("uploading");
      setProgressPercent(20);

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
          if (step === "uploading") setProgressPercent(30);
          else if (step === "calling") setProgressPercent(60);
          else if (step === "processing") setProgressPercent(85);
          else if (step === "completed") setProgressPercent(100);
        }
      });

      setResult(res);
      setCurrentStep("completed");
      setProgressPercent(100);

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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 animate-scaleUp">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-600 via-amber-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Tv className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-slate-100 text-base sm:text-lg">
                  تنزيل وتفريغ الوسائط (Gradio 🇩🇪 & YouTube)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                  v2.0 Updated
                </span>
              </div>
              <p className="text-xs text-slate-400">
                تنزيل مقاطع يوتيوب بالدقة المحددة مع استخراج وتوليد ترجمة Whisper المتزامنة
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
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs sm:text-sm">
          
          {/* SERVER CONFIGURATION BAR */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-slate-300 font-bold text-xs">
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

          {/* 3 SOURCE SELECTION TABS: YOUTUBE, CURRENT FILE, LOCAL UPLOAD */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              اختر مصدر المحتوى للتحميل والتفريغ:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700">
              {/* Tab 1: YouTube */}
              <button
                type="button"
                onClick={() => setSourceMode("youtube")}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  sourceMode === "youtube"
                    ? "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-600/30 font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Tv className="w-4 h-4 text-red-300" />
                <span>تنزيل من يوتيوب 🎥⚡</span>
              </button>

              {/* Tab 2: Current File */}
              <button
                type="button"
                onClick={() => setSourceMode("current")}
                disabled={!currentFile}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  sourceMode === "current"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black"
                    : "text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                }`}
              >
                {currentFile?.type === "video" ? <Film className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                <span>المقطع المشغل حالياً</span>
              </button>

              {/* Tab 3: Local Upload */}
              <button
                type="button"
                onClick={() => setSourceMode("upload")}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  sourceMode === "upload"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>رفع ملف من الجهاز</span>
              </button>
            </div>

            {/* TAB CONTENT: 1. YOUTUBE MODE */}
            {sourceMode === "youtube" && (
              <div className="mt-3.5 space-y-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>رابط فيديو يوتيوب (YouTube URL):</span>
                    <span className="text-[10px] text-slate-400">مثال: https://youtube.com/watch?v=...</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleFetchYouTubeInfo();
                      }}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleFetchYouTubeInfo}
                      disabled={isLoadingYtInfo || !youtubeUrl.trim()}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm shadow-rose-600/20"
                    >
                      {isLoadingYtInfo ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جلب البيانات...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>فحص الفيديو 🔍</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Fetched YouTube Metadata Card */}
                {youtubeInfo && (
                  <div className="mt-3 bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 space-y-3 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row items-start gap-3.5">
                      {/* Thumbnail with duration badge */}
                      <div className="relative w-full sm:w-44 aspect-video rounded-xl overflow-hidden bg-black shrink-0 border border-slate-700">
                        <img
                          src={youtubeInfo.thumbnailUrl}
                          alt={youtubeInfo.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        {youtubeInfo.durationFormatted && (
                          <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-black/85 backdrop-blur-xs text-white text-[10px] font-mono font-bold rounded-md">
                            {youtubeInfo.durationFormatted}
                          </div>
                        )}
                      </div>

                      {/* Video Details */}
                      <div className="flex-1 space-y-1 overflow-hidden">
                        <h3 className="font-bold text-sm text-slate-100 leading-snug line-clamp-2">
                          {youtubeInfo.title}
                        </h3>
                        {youtubeInfo.author && (
                          <p className="text-xs text-rose-400 font-medium flex items-center gap-1">
                            <span>القناة:</span>
                            <span className="text-slate-300">{youtubeInfo.author}</span>
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400">
                          معرف الفيديو: <span className="font-mono text-slate-300">{youtubeInfo.videoId}</span>
                        </p>

                        {/* Collapsible description */}
                        {youtubeInfo.description && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setShowFullDescription(!showFullDescription)}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer font-bold"
                            >
                              <span>{showFullDescription ? "إخفاء وصف الفيديو" : "عرض وصف الفيديو الكامل 📜"}</span>
                              {showFullDescription ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                            {showFullDescription && (
                              <div className="mt-1.5 p-2.5 bg-slate-950 rounded-xl text-[11px] text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap font-sans border border-slate-800">
                                {youtubeInfo.description}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SELECT RESOLUTION / FORMAT (تحديد الدقة) */}
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-rose-400" />
                          <span>اختر جودة ودقة الفيديو المطلوبة (الخطوة 2):</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {youtubeInfo.qualities?.length || youtubeInfo.formats?.length || 0} دقات متوفرة
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        {((youtubeInfo.qualities && youtubeInfo.qualities.length > 0)
                          ? youtubeInfo.qualities
                          : (youtubeInfo.formats || []).map((f) => ({
                              label: f.resolution,
                              formatId: f.formatId,
                              note: f.note,
                              filesizeFormatted: f.filesizeFormatted
                            }))
                        ).map((qual) => {
                          const isSelected = selectedFormatId === qual.formatId;
                          return (
                            <button
                              key={qual.formatId}
                              type="button"
                              onClick={() => setSelectedFormatId(qual.formatId)}
                              className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-between gap-1 ${
                                isSelected
                                  ? "bg-rose-950/50 border-rose-500 text-white shadow-sm ring-2 ring-rose-500/50"
                                  : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-900"
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-xs text-rose-300">
                                  {qual.label}
                                </span>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                              </div>
                              {qual.note && (
                                <span className="text-[9px] text-slate-400 line-clamp-1">
                                  {qual.note}
                                </span>
                              )}
                              {qual.filesizeFormatted && (
                                <span className="font-mono text-[9px] text-slate-500">
                                  {qual.filesizeFormatted}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: 2. CURRENT FILE */}
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

            {/* TAB CONTENT: 3. LOCAL UPLOAD */}
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
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                    selectedLocalFile
                      ? "border-emerald-500/50 bg-emerald-950/20"
                      : "border-slate-700 hover:border-indigo-500/50 bg-slate-950/40 hover:bg-slate-950/70"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 text-indigo-400 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    {selectedLocalFile ? (
                      <div>
                        <p className="font-bold text-emerald-300 text-xs truncate max-w-sm">
                          {selectedLocalFile.name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {(selectedLocalFile.size / (1024 * 1024)).toFixed(2)} MB • جاهز للتفريغ
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-slate-300 text-xs">
                          اضغط لاختيار ملف صوتي أو فيديو من جهازك
                        </p>
                        <p className="text-[10px] text-slate-500">
                          يدعم MP4, MP3, WAV, M4A, WEBM, MKV, OGG
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ADVANCED PARAMETERS ACCORDION */}
          <div className="border border-slate-800 rounded-2xl bg-slate-950/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full p-3 flex items-center justify-between text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>إعدادات نموذج Whisper المتقدمة (اختياري)</span>
              </div>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="p-4 pt-2 border-t border-slate-800/80 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Beam Size */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400">حجم الشعاع (Beam Size):</span>
                      <span className="font-mono text-indigo-400 font-bold">{beamSize}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={beamSize}
                      onChange={(e) => setBeamSize(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  {/* Best Of */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400">أفضل العينات (Best Of):</span>
                      <span className="font-mono text-indigo-400 font-bold">{bestOf}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={bestOf}
                      onChange={(e) => setBestOf(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  {/* Temperature */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400">درجة الحرارة (Temperature):</span>
                      <span className="font-mono text-indigo-400 font-bold">{temperature.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.0}
                      max={1.0}
                      step={0.1}
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  {/* Min Silence Duration MS */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400">الحد الأدنى للصمت (ms):</span>
                      <span className="font-mono text-indigo-400 font-bold">{minSilenceDurationMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min={500}
                      max={5000}
                      step={250}
                      value={minSilenceDurationMs}
                      onChange={(e) => setMinSilenceDurationMs(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={vadFilter}
                      onChange={(e) => setVadFilter(e.target.checked)}
                      className="rounded accent-indigo-500 w-4 h-4"
                    />
                    <span>فلتر كشف الصوت والصمت (VAD Filter)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={conditionOnPreviousText}
                      onChange={(e) => setConditionOnPreviousText(e.target.checked)}
                      className="rounded accent-indigo-500 w-4 h-4"
                    />
                    <span>الاعتماد على السياق السابق للجمل</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* STATUS & LIVE PROGRESS BAR */}
          {isProcessing && (
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  <div>
                    <span className="font-bold text-xs text-indigo-200 block">
                      {liveStageLabel ? `${liveStageLabel}: ${statusMessage}` : (statusMessage || "جاري المعالجة...")}
                    </span>
                    {liveStage === "transcribing" && liveVideoUrl && (
                      <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
                        ⚡ تم اكتمال تحميل الفيديو — جاري تفريغ الصوت وإنشاء السكربت...
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatTimer(elapsedSeconds)}</span>
                </div>
              </div>

              {/* Progress Line */}
              <div className="space-y-1">
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, progressPercent)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>التقدم: {progressPercent}%</span>
                  <span>{liveStageLabel || (currentStep === "uploading" ? "1/3 التحميل" : currentStep === "processing" ? "2/3 التفريغ" : "3/3 الانتهاء")}</span>
                </div>
              </div>

              {/* Early Video Player Preview (appears as soon as videoUrl is available) */}
              {liveVideoUrl && (
                <div className="mt-3 pt-3 border-t border-indigo-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5" />
                      <span>معاينة الفيديو المباشرة (جاهز للتشغيل):</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">
                      {liveStage === "transcribing" ? "جاري إنشاء الترجمة..." : "✓ الفيديو جاهز"}
                    </span>
                  </div>
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-700 relative">
                    <video
                      src={liveVideoUrl}
                      controls
                      className="w-full h-full object-contain"
                      playsInline
                    >
                      {liveVttTrackUrl && (
                        <track
                          kind="subtitles"
                          src={liveVttTrackUrl}
                          srcLang="de"
                          label="ترجمة متزامنة"
                          default
                        />
                      )}
                      متصفحك لا يدعم مشغل الفيديو.
                    </video>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ERROR ALERT */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800 text-rose-200 rounded-2xl flex items-start gap-3 animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-bold text-xs">تعذر إكمال العملية</p>
                <p className="text-[11px] text-rose-300/90 leading-relaxed font-sans">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* COMPLETED RESULTS DISPLAY */}
          {result && (
            <div className="bg-slate-950/90 border border-emerald-500/40 rounded-2xl p-4 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>تم التنزيل والتفريغ النصي بنجاح! ({parsedCuesCount} سطر ترجمة)</span>
                </div>

                {downloadedMediaFile && (
                  <span className="text-[11px] px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg font-bold">
                    ✓ تمت إضافة الفيديو للمكتبة
                  </span>
                )}
              </div>

              {/* Final Video Player Preview with attached <track> */}
              {(liveVideoUrl || result.audioFileUrl) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-emerald-400" />
                      <span>مشغل الفيديو مع الترجمة المتزامنة المدمجة:</span>
                    </span>
                    {liveVttTrackUrl && (
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-mono font-bold">
                        CC Subtitles Active
                      </span>
                    )}
                  </div>
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 relative">
                    <video
                      src={liveVideoUrl || result.audioFileUrl}
                      controls
                      className="w-full h-full object-contain"
                      playsInline
                    >
                      {liveVttTrackUrl && (
                        <track
                          kind="subtitles"
                          src={liveVttTrackUrl}
                          srcLang="de"
                          label="الألمانية (الأصلية)"
                          default
                        />
                      )}
                      متصفحك لا يدعم مشغل الفيديو.
                    </video>
                  </div>
                </div>
              )}

              {/* TABS: PLAIN TEXT vs SRT SUBTITLES */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveTabResult("text")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTabResult === "text"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    النص الكامل (Text)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTabResult("subtitles")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTabResult === "subtitles"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    ملف الترجمة (SRT)
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyPlainText}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? "تم النسخ" : "نسخ النص"}</span>
                  </button>
                  {result.srtText && (
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(result.srtText, "subtitles.srt", "text/plain")}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تنزيل SRT</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Text Area */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 max-h-48 overflow-y-auto text-xs text-slate-200 font-sans leading-relaxed whitespace-pre-wrap">
                {activeTabResult === "text"
                  ? result.plainText || "لا يوجد نص مفرغ"
                  : result.srtText || "لا يوجد ملف ترجمة"}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>

          <div className="flex items-center gap-2">
            {isProcessing ? (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء المعالجة ✕
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartTranscribe}
                disabled={
                  isProcessing ||
                  (sourceMode === "youtube" && !youtubeUrl.trim()) ||
                  (sourceMode === "upload" && !selectedLocalFile) ||
                  (sourceMode === "current" && !currentFile)
                }
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${
                  sourceMode === "youtube"
                    ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30 font-black"
                    : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-600/30"
                }`}
              >
                {sourceMode === "youtube" ? (
                  <>
                    <Tv className="w-4 h-4" />
                    <span>بدء تنزيل وتفريغ يوتيوب ⚡</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>بدء التفريغ الصوتي الآن</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

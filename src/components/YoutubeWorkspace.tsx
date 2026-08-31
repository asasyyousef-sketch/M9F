import React, { useState, useEffect, useRef } from "react";
import { 
  Youtube, 
  Search, 
  Trash2, 
  Edit3, 
  Sparkles, 
  ArrowRight, 
  Clock, 
  Save, 
  Plus, 
  CheckCircle2, 
  Languages, 
  FileText, 
  Play, 
  Loader2, 
  Video, 
  Maximize2,
  Menu,
  Compass,
  Download,
  Server,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Copy,
  Check,
  Film,
  Music
} from "lucide-react";
import { TranscriptDocument, TranscriptSegment } from "../types";
import {
  getYouTubeInfo,
  processYouTubeLink,
  pollYouTubeStatus,
  DEFAULT_GRADIO_URL,
  YouTubeVideoInfo,
  YouTubeJobStatus
} from "../utils/gradioTranscription";
import { parseSubtitleContent } from "../utils/subtitleParser";

// Format seconds into MM:SS format
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const mStr = m.toString().padStart(2, "0");
  const sStr = s.toString().padStart(2, "0");
  
  if (h > 0) {
    return `${h}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

interface YoutubeWorkspaceProps {
  transcripts: TranscriptDocument[];
  onSaveTranscripts: (updatedTranscripts: TranscriptDocument[]) => void;
  onSendToAI: (transcript: TranscriptDocument) => void;
  onToggleSidebar: () => void;
  onBackToLibrary?: () => void;
}

export const YoutubeWorkspace: React.FC<YoutubeWorkspaceProps> = React.memo(({
  transcripts,
  onSaveTranscripts,
  onSendToAI,
  onToggleSidebar,
  onBackToLibrary
}) => {
  // Navigation states: "list" or "view"
  const [activeDoc, setActiveDoc] = useState<TranscriptDocument | null>(null);
  
  // Extraction states
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<"youtube_ai" | "direct">("youtube_ai");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [checkingUrl, setCheckingUrl] = useState(false);
  const [checkingError, setCheckingError] = useState<string | null>(null);
  
  // Gradio Server URL
  const [serverUrl, setServerUrl] = useState<string>(() => {
    return localStorage.getItem("gradio_local_stt_url") || DEFAULT_GRADIO_URL;
  });

  // Video Metadata returned from API
  const [videoInfo, setVideoInfo] = useState<YouTubeVideoInfo | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState<string>("720p");
  
  // Hyperparameters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [beamSize, setBeamSize] = useState<number>(5);
  const [bestOf, setBestOf] = useState<number>(5);
  const [temperature, setTemperature] = useState<number>(0.0);
  const [vadFilter, setVadFilter] = useState<boolean>(true);

  // Active Job Processing & Polling State
  const [isProcessingJob, setIsProcessingJob] = useState(false);
  const [jobStatus, setJobStatus] = useState<YouTubeJobStatus | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [extractSuccess, setExtractSuccess] = useState(false);

  // Result state
  const [completedResult, setCompletedResult] = useState<{
    plainText: string;
    srtText: string;
    videoUrl?: string;
  } | null>(null);

  // File upload states for direct text upload
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedText, setUploadedText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [shouldSplit, setShouldSplit] = useState(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<any>(null);

  // Manage elapsed timer during processing
  useEffect(() => {
    if (isProcessingJob) {
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
  }, [isProcessingJob]);

  // Global search in Library list
  const [listSearch, setListSearch] = useState("");
  
  // Search within active document transcript segments
  const [docSearch, setDocSearch] = useState("");
  
  // Editing state for active document
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null);
  const [editingSegmentText, setEditingSegmentText] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Save server URL
  const handleServerUrlChange = (val: string) => {
    setServerUrl(val);
    localStorage.setItem("gradio_local_stt_url", val);
  };

  // Step 1: Check YouTube URL & fetch metadata/formats
  const handleCheckUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    setCheckingUrl(true);
    setCheckingError(null);
    setVideoInfo(null);
    setCompletedResult(null);
    setJobStatus(null);

    try {
      const info = await getYouTubeInfo(youtubeUrl.trim(), serverUrl);
      setVideoInfo(info);
      if (info.formats && info.formats.length > 0) {
        // Pre-select 720p or 1080p if available
        const prefFormat = info.formats.find(f => f.resolution.includes("720") || f.formatId.includes("720")) || info.formats[0];
        setSelectedFormatId(prefFormat.formatId);
      }
    } catch (err: any) {
      setCheckingError(err.message || "حدث خطأ أثناء التحقق من رابط الفيديو.");
    } finally {
      setCheckingUrl(false);
    }
  };

  // Step 2 & 3: Start YouTube Process and Poll status until complete
  const handleStartYouTubeProcessing = async () => {
    if (!youtubeUrl.trim() || !videoInfo) return;

    setCheckingError(null);
    setIsProcessingJob(true);
    setCompletedResult(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 1. Trigger process job
      const jobId = await processYouTubeLink(youtubeUrl.trim(), selectedFormatId, {
        serverUrl,
        beamSize,
        bestOf,
        temperature,
        vadFilter,
        signal: controller.signal
      });

      // 2. Poll job status
      const finalStatus = await pollYouTubeStatus(
        jobId,
        (statusUpdate) => {
          setJobStatus(statusUpdate);
        },
        serverUrl,
        controller.signal
      );

      setJobStatus(finalStatus);

      // 3. Process completed result
      const plain = finalStatus.plainText || "";
      const srt = finalStatus.srtText || "";
      setCompletedResult({
        plainText: plain,
        srtText: srt,
        videoUrl: finalStatus.videoUrl
      });

      // Parse segments
      let segments: TranscriptSegment[] = [];
      if (srt && srt.trim().length > 0) {
        const cues = parseSubtitleContent(srt);
        segments = cues.map((c) => ({
          start: c.startTime,
          duration: Math.max(1, c.endTime - c.startTime),
          text: c.text
        }));
      }

      if (segments.length === 0 && plain.trim().length > 0) {
        const { segments: autoSegs } = splitTextAutomatically(plain);
        segments = autoSegs;
      }

      // Create new spT document
      const newDoc: TranscriptDocument = {
        id: `spt-yt-${Date.now()}`,
        title: videoInfo.title || "فيديو يوتيوب مفرغ",
        videoId: videoInfo.videoId,
        videoUrl: `https://www.youtube.com/watch?v=${videoInfo.videoId}`,
        thumbnailUrl: videoInfo.thumbnailUrl,
        languageCode: "de",
        languageLabel: "ألماني (سيرفر التفريغ الذكي 🇩🇪)",
        segments: segments.length > 0 ? segments : [{ start: 0, duration: 10, text: plain || "مقطع يوتيوب مفرغ" }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updatedList = [newDoc, ...transcripts];
      onSaveTranscripts(updatedList);
      setExtractSuccess(true);

      setTimeout(() => {
        setExtractSuccess(false);
        setActiveDoc(newDoc);
        setDocTitle(newDoc.title);
        setHasChanges(false);
      }, 1800);

    } catch (err: any) {
      if (err.name === "AbortError") {
        setCheckingError("تم إلغاء العملية بناءً على طلبك.");
      } else {
        console.error("YouTube Processing Error:", err);
        setCheckingError(err.message || "حدث خطأ أثناء تنزيل وتفريغ فيديو اليوتيوب.");
      }
    } finally {
      setIsProcessingJob(false);
      abortControllerRef.current = null;
    }
  };

  // Cancel operation
  const handleCancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessingJob(false);
    setJobStatus(null);
  };

  // Direct Text File upload handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".txt")) {
        setCheckingError("الرجاء اختيار ملف نصي بصيغة .txt فقط.");
        return;
      }
      setUploadedFile(file);
      setCheckingError(null);
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        setUploadedText(text);
      };
      reader.onerror = () => {
        setCheckingError("فشل في قراءة محتوى الملف.");
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.endsWith(".txt")) {
        setCheckingError("الرجاء اختيار ملف نصي بصيغة .txt فقط.");
        return;
      }
      setUploadedFile(file);
      setCheckingError(null);
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        setUploadedText(text);
      };
      reader.readAsText(file);
    }
  };

  // Automatic splitting helper
  const splitTextAutomatically = (text: string): { segments: TranscriptSegment[]; isUnsplit: boolean } => {
    const rawText = text.trim();
    if (!rawText) {
      return { segments: [], isUnsplit: false };
    }

    if (!shouldSplit) {
      const segments: TranscriptSegment[] = [{
        start: 0,
        duration: 10,
        text: rawText
      }];
      return { segments, isUnsplit: true };
    }

    const newlineLines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (newlineLines.length > 1) {
      const segments = newlineLines.map((line, index) => ({
        start: index * 5,
        duration: 5,
        text: line
      }));
      return { segments, isUnsplit: false };
    }

    const sentenceRegex = /([^.!?،؟]+[.!?،؟]*)/g;
    const matches = rawText.match(sentenceRegex);
    const sentenceSegments = matches
      ? matches.map((s) => s.trim()).filter((s) => s.length > 0)
      : [];

    if (sentenceSegments.length > 1) {
      const segments = sentenceSegments.map((sentence, index) => ({
        start: index * 5,
        duration: 5,
        text: sentence
      }));
      return { segments, isUnsplit: false };
    }

    const segments: TranscriptSegment[] = [{
      start: 0,
      duration: 10,
      text: rawText
    }];

    return { segments, isUnsplit: true };
  };

  // Extract from uploaded text file
  const handleExtractDirectText = async () => {
    if (!uploadedText.trim()) {
      setCheckingError("الرجاء رفع ملف نصي .txt يحتوي على النص الدراسي أولاً.");
      return;
    }

    setCheckingError(null);

    try {
      const fileName = uploadedFile?.name || "ملف نصي";
      const cleanFileName = fileName.replace(/\.txt$/i, "");
      
      const { segments, isUnsplit } = splitTextAutomatically(uploadedText);

      if (segments.length === 0) {
        throw new Error("الملف النصي المرفوع فارغ أو لا يحتوي على أسطر صالحة.");
      }

      const title = isUnsplit ? `spTT - ${cleanFileName}` : cleanFileName;
      const isSpTT = isUnsplit;

      const newDoc: TranscriptDocument = {
        id: `spt-${Date.now()}`,
        title: title,
        thumbnailUrl: isSpTT 
          ? "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=400"
          : "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=400",
        languageCode: isSpTT ? "spTT" : "uploaded",
        languageLabel: isSpTT ? "spTT (غير مقسم)" : "ملف مرفوع",
        segments: segments,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updatedList = [newDoc, ...transcripts];
      onSaveTranscripts(updatedList);
      
      setExtractSuccess(true);
      setTimeout(() => {
        setExtractSuccess(false);
        setShowAddForm(false);
        setUploadedFile(null);
        setUploadedText("");
        setActiveDoc(newDoc);
        setDocTitle(newDoc.title);
        setHasChanges(false);
      }, 1200);

    } catch (err: any) {
      setCheckingError(err.message || "حدث خطأ أثناء استخراج النص.");
    }
  };

  // Edit segment handler
  const handleStartEditSegment = (index: number, text: string) => {
    setEditingSegmentIndex(index);
    setEditingSegmentText(text);
  };

  const handleSaveSegmentEdit = (index: number) => {
    if (!activeDoc) return;
    
    const updatedSegments = [...activeDoc.segments];
    updatedSegments[index] = {
      ...updatedSegments[index],
      text: editingSegmentText
    };

    setActiveDoc({
      ...activeDoc,
      segments: updatedSegments
    });
    
    setEditingSegmentIndex(null);
    setHasChanges(true);
  };

  // Save changes to active spT Document
  const handleSaveDocChanges = () => {
    if (!activeDoc) return;

    const updatedDoc: TranscriptDocument = {
      ...activeDoc,
      title: docTitle,
      updatedAt: new Date().toISOString()
    };

    const updatedList = transcripts.map(doc => doc.id === activeDoc.id ? updatedDoc : doc);
    onSaveTranscripts(updatedList);
    
    setActiveDoc(updatedDoc);
    setHasChanges(false);
  };

  // Delete an spT document
  const handleDeleteDoc = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف هذا الملف النصي بشكل نهائي؟")) {
      return;
    }

    const updatedList = transcripts.filter(doc => doc.id !== id);
    onSaveTranscripts(updatedList);
    
    if (activeDoc && activeDoc.id === id) {
      setActiveDoc(null);
    }
  };

  // Download file helper
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

  // Search filtered library lists
  const filteredDocs = transcripts.filter(doc => 
    doc.title.toLowerCase().includes(listSearch.toLowerCase())
  );

  // Search filtered active doc segments
  const filteredSegments = activeDoc ? activeDoc.segments.map((seg, origIdx) => ({
    ...seg,
    origIdx
  })).filter(seg => 
    seg.text.toLowerCase().includes(docSearch.toLowerCase())
  ) : [];

  return (
    <main className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-hidden" dir="rtl">
      {/* HEADER SECTION */}
      <header className="px-6 md:px-8 py-4 bg-[#f8fafc] border-b border-slate-100 flex items-center justify-between shrink-0">
        {/* Right side: Navigation & Action Buttons */}
        <div className="flex items-center gap-2">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors active:scale-95"
              title="القائمة الجانبية"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {activeDoc ? (
            <button
              onClick={() => setActiveDoc(null)}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-all cursor-pointer active:scale-95"
            >
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span>العودة للمقاطع</span>
            </button>
          ) : (
            <>
              {onBackToLibrary && (
                <button
                  onClick={onBackToLibrary}
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-all cursor-pointer active:scale-95"
                >
                  <Compass className="w-3.5 h-3.5 text-slate-400" />
                  <span>الرجوع للمكتبة</span>
                </button>
              )}

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg border text-[10px] font-bold transition-all cursor-pointer active:scale-95 ${
                  showAddForm 
                    ? "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-150" 
                    : "bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100"
                }`}
              >
                <span>{showAddForm ? "عرض المقاطع المحفوظة" : "تنزيل وتفريغ يوتيوب بالذكاء ⚡"}</span>
              </button>
            </>
          )}
        </div>

        {/* Left side: Simple Icon + Title */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800">تفريغ وتنزيل اليوتيوب الذكي (spT 🇩🇪)</span>
          <Youtube className="w-4 h-4 text-rose-600 animate-pulse" />
        </div>
      </header>

      {/* DETAILED WORKSPACE CANVAS */}
      <div className="flex-1 overflow-hidden relative">
        {activeDoc ? (
          /* ACTIVE DOCUMENT TRANSCRIPT VIEW & EDITOR */
          <div className="h-full flex flex-col md:flex-row overflow-hidden">
            
            {/* Right side panel: Document Details & Video Metadata */}
            <div className="w-full md:w-80 bg-white border-l border-slate-100 p-5 overflow-y-auto flex flex-col gap-5 shrink-0">
              {/* Cover Banner */}
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-xs border border-slate-100">
                <img 
                  src={activeDoc.thumbnailUrl || `https://img.youtube.com/vi/${activeDoc.videoId}/0.jpg`} 
                  alt={activeDoc.title}
                  className="w-full h-full object-cover"
                />
                {activeDoc.videoUrl && (
                  <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                    <a 
                      href={activeDoc.videoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-3 bg-white/90 hover:bg-white hover:scale-110 transition-all rounded-full text-rose-600 shadow-md cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-rose-600 shrink-0" />
                    </a>
                  </div>
                )}
              </div>

              {/* Editable Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">اسم الملف النصي (spT):</label>
                <input 
                  type="text" 
                  value={docTitle} 
                  onChange={(e) => {
                    setDocTitle(e.target.value);
                    setHasChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 focus:border-rose-500 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>

              {/* Status and Details */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold">اللغة المصحوبة:</span>
                  <span className="px-2 py-0.5 bg-rose-50 border border-rose-100 rounded-md text-[10px] font-black text-rose-600">
                    {activeDoc.languageLabel || activeDoc.languageCode || "غير محدد"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold">عدد الأسطر:</span>
                  <span className="font-bold text-slate-700">{activeDoc.segments.length} سطر</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold">تاريخ السحب:</span>
                  <span className="font-bold text-slate-500 text-[10px]" dir="ltr">
                    {new Date(activeDoc.createdAt).toLocaleDateString("ar-EG")}
                  </span>
                </div>
              </div>

              {/* Control Actions */}
              <div className="mt-auto space-y-2 pt-4">
                {hasChanges && (
                  <button
                    onClick={handleSaveDocChanges}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-emerald-100 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ كافة التعديلات</span>
                  </button>
                )}

                <button
                  onClick={() => onSendToAI(activeDoc)}
                  className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-violet-100 cursor-pointer animate-pulse"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>توليد فلاش كارد بالذكاء ⚡</span>
                </button>

                <button
                  onClick={() => handleDeleteDoc(activeDoc.id)}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف الملف نهائياً</span>
                </button>
              </div>
            </div>

            {/* Left Main Pane: Interactive Subtitles List */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Document Search Bar */}
              <div className="p-4 bg-white border-b border-slate-100 shrink-0">
                <div className="relative">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ابحث عن كلمة أو فكرة معينة داخل المحاضرة..."
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-rose-500 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-rose-500/10 transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Transcript list container */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/50">
                {filteredSegments.length > 0 ? (
                  filteredSegments.map((seg) => {
                    const isEditing = editingSegmentIndex === seg.origIdx;
                    return (
                      <div 
                        key={seg.origIdx}
                        className={`group bg-white p-3.5 rounded-2xl border transition-all flex items-start gap-4 ${
                          isEditing 
                            ? "border-rose-500 shadow-sm" 
                            : "border-slate-100 hover:border-slate-200 hover:shadow-xs"
                        }`}
                      >
                        {/* Timestamp badge */}
                        <div className="flex items-center gap-1 shrink-0 px-2.5 py-1.5 bg-slate-50 text-slate-500 rounded-xl font-mono text-[11px] font-bold">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatTime(seg.start)}</span>
                        </div>

                        {/* Text display / input area */}
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={editingSegmentText}
                                onChange={(e) => setEditingSegmentText(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-xs font-semibold leading-relaxed"
                                rows={2}
                              />
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => setEditingSegmentIndex(null)}
                                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer"
                                >
                                  إلغاء
                                </button>
                                <button
                                  onClick={() => handleSaveSegmentEdit(seg.origIdx)}
                                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold cursor-pointer flex items-center gap-1"
                                >
                                  <Save className="w-3 h-3" />
                                  <span>تطبيق</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                                {seg.text}
                              </p>
                              
                              <button
                                onClick={() => handleStartEditSegment(seg.origIdx, seg.text)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all cursor-pointer shrink-0"
                                title="تعديل هذا الجزء من النص"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center text-center">
                    <FileText className="w-10 h-10 text-slate-200 mb-2" />
                    <span className="text-xs font-bold text-slate-400">
                      {docSearch ? "لا توجد نتائج بحث مطابقة." : "التفريغ فارغ حالياً."}
                    </span>
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : showAddForm ? (
          /* extraction screen */
          <div className="h-full overflow-y-auto p-6 flex justify-center">
            <div className="max-w-3xl w-full space-y-6 mt-2 pb-10">
              
              {/* Tab Selector */}
              <div className="flex bg-slate-200/70 p-1.5 rounded-2xl border border-slate-200" dir="rtl">
                <button
                  type="button"
                  onClick={() => {
                    setAddMode("youtube_ai");
                    setCheckingError(null);
                    setUploadedFile(null);
                    setUploadedText("");
                  }}
                  className={`flex-1 py-3 text-xs font-black rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                    addMode === "youtube_ai"
                      ? "bg-white text-rose-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  <Youtube className="w-4 h-4 text-rose-600" />
                  <span>تنزيل وتفريغ يوتيوب عبر السيرفر الذكي ⚡</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddMode("direct");
                    setCheckingError(null);
                    setVideoInfo(null);
                    setUploadedFile(null);
                    setUploadedText("");
                  }}
                  className={`flex-1 py-3 text-xs font-black rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                    addMode === "direct"
                      ? "bg-white text-rose-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>رفع ملف نصي مباشر (.txt)</span>
                </button>
              </div>

              {addMode === "youtube_ai" ? (
                <>
                  {/* SERVER URL CONFIG */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <Server className="w-4 h-4 text-indigo-500" />
                        <span>عنوان سيرفر التفريغ المحلي (Gradio Server):</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                        {serverUrl}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={serverUrl}
                        onChange={(e) => handleServerUrlChange(e.target.value)}
                        placeholder="http://192.168.0.159:7861"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleServerUrlChange(DEFAULT_GRADIO_URL)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                      >
                        الافتراضي
                      </button>
                    </div>
                  </div>

                  {/* URL INPUT & CHECK */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                        <Youtube className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800">1. أدخل رابط فيديو اليوتيوب للتحقق وتحديد الدقة</h3>
                        <p className="text-[11px] text-slate-400">سيقوم السيرفر بجلب معلومات الفيديو وخيارات الجودة المتاحة</p>
                      </div>
                    </div>

                    <form onSubmit={handleCheckUrl} className="flex gap-2">
                      <input
                        type="url"
                        placeholder="ضع رابط فيديو يوتيوب هنا، مثلاً: https://www.youtube.com/watch?v=..."
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        disabled={checkingUrl || isProcessingJob}
                        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-xs font-semibold"
                        required
                      />
                      <button
                        type="submit"
                        disabled={checkingUrl || !youtubeUrl.trim() || isProcessingJob}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                      >
                        {checkingUrl ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            <span>جاري الفحص...</span>
                          </>
                        ) : (
                          <span>فحص الفيديو 🔍</span>
                        )}
                      </button>
                    </form>

                    {checkingError && (
                      <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-xs rounded-2xl flex items-start gap-2 leading-relaxed">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>{checkingError}</span>
                      </div>
                    )}
                  </div>

                  {/* Video Info Card & Quality Selection (Step 2 & 3) */}
                  {videoInfo && (
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in flex flex-col md:flex-row">
                      {/* Thumbnail Cover */}
                      <div className="w-full md:w-64 aspect-video md:aspect-auto relative shrink-0 bg-slate-100">
                        <img 
                          src={videoInfo.thumbnailUrl} 
                          alt={videoInfo.title}
                          className="w-full h-full object-cover"
                        />
                        {videoInfo.durationFormatted && (
                          <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white rounded text-[10px] font-mono font-bold">
                            {videoInfo.durationFormatted}
                          </span>
                        )}
                      </div>

                      {/* Details, Quality Dropdown, and Start controls */}
                      <div className="flex-1 p-6 flex flex-col justify-between gap-5">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-rose-50 text-[10px] font-black text-rose-600 rounded-md border border-rose-100">
                              يوتيوب 🎥
                            </span>
                            {videoInfo.author && (
                              <span className="text-[11px] text-slate-500 font-bold">
                                القناة: {videoInfo.author}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-black text-slate-800 leading-snug">
                            {videoInfo.title}
                          </h4>
                        </div>

                        {/* QUALITY SELECTION DROPDOWN */}
                        <div className="space-y-2 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                          <label className="block text-xs font-bold text-slate-700">
                            2. حدد دقة الفيديو أو الصوت للتنزيل والتفريغ:
                          </label>
                          <select
                            value={selectedFormatId}
                            onChange={(e) => setSelectedFormatId(e.target.value)}
                            disabled={isProcessingJob}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-rose-500 focus:outline-none cursor-pointer"
                          >
                            {videoInfo.formats.map((fmt) => (
                              <option key={fmt.formatId} value={fmt.formatId}>
                                {fmt.resolution} {fmt.note ? `— (${fmt.note})` : ""} {fmt.filesizeFormatted ? `[${fmt.filesizeFormatted}]` : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* ADVANCED PARAMETERS ACCORDION */}
                        <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/50">
                          <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full p-3 flex items-center justify-between text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                              <span>إعدادات مودل التفريغ (Beam size, VAD)</span>
                            </div>
                            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>

                          {showAdvanced && (
                            <div className="p-3.5 border-t border-slate-200 bg-white grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-1">Beam Size (افتراضي 5):</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={beamSize}
                                  onChange={(e) => setBeamSize(parseInt(e.target.value) || 5)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-1">Best Of (افتراضي 5):</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={bestOf}
                                  onChange={(e) => setBestOf(parseInt(e.target.value) || 5)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* LIVE PROGRESS BAR & LINE (During Processing & Polling) */}
                        {isProcessingJob && (
                          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3 animate-pulse">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                                <span className="text-xs font-black text-indigo-900">
                                  {jobStatus?.stage === "downloading" ? "جاري تنزيل فيديو اليوتيوب..." : "جاري تفريغ الصوت بالذكاء الاصطناعي..."}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-xl text-xs font-mono font-bold">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{Math.floor(elapsedSeconds / 60).toString().padStart(2, "0")}:{(elapsedSeconds % 60).toString().padStart(2, "0")}</span>
                              </div>
                            </div>

                            {/* Active Progress Bar Line */}
                            <div className="w-full bg-indigo-200/80 rounded-full h-3 overflow-hidden p-0.5">
                              <div 
                                className="bg-gradient-to-r from-indigo-600 via-rose-500 to-amber-500 h-full rounded-full transition-all duration-300 shadow-sm"
                                style={{ width: `${Math.max(5, jobStatus?.progress || 15)}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px] font-bold text-indigo-700">
                              <span>{jobStatus?.statusMsg || "جاري المعالجة على السيرفر..."}</span>
                              <span className="font-mono">{jobStatus?.progress || 15}%</span>
                            </div>

                            <div className="text-left pt-1">
                              <button
                                type="button"
                                onClick={handleCancelProcessing}
                                className="text-xs text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                              >
                                إلغاء العملية
                              </button>
                            </div>
                          </div>
                        )}

                        {/* START PROCESSING BUTTON OR SUCCESS BANNER */}
                        {extractSuccess ? (
                          <div className="py-3 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 border border-emerald-200 shadow-sm">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>تم تنزيل وتفريغ الفيديو بنجاح وحفظه في المكتبة الدراسية!</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleStartYouTubeProcessing}
                            disabled={isProcessingJob}
                            className="w-full py-3.5 bg-gradient-to-r from-rose-600 via-indigo-600 to-indigo-700 hover:from-rose-500 hover:to-indigo-600 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer transition-all disabled:opacity-50"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>3. بدء التنزيل والتفريغ النصي الذكي ⚡ (Download & Transcribe)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Direct Upload Tab */
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4 animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-rose-600 shrink-0" />
                    <h3 className="text-sm font-black text-slate-800">ارفع ملفاً نصياً مباشرة للدراسة</h3>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                      ارفع ملف نصي بمحاضرتك أو نصوصك الدراسية. سيقوم النظام بـ <span className="text-emerald-600 font-bold">تجزئة النص تلقائياً لأسطر تفاعلية</span> لتتمكن من دراستها والتعامل مع المساعد الذكي.
                    </p>

                    <div className="space-y-1">
                      {/* Drag and Drop Zone */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                          isDragging 
                            ? "border-rose-500 bg-rose-50/55" 
                            : uploadedFile 
                              ? "border-emerald-500 bg-emerald-50/20" 
                              : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                        }`}
                      >
                        <input
                          type="file"
                          id="txt-upload-direct"
                          accept=".txt"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <label htmlFor="txt-upload-direct" className="cursor-pointer block space-y-2">
                          <FileText className={`w-10 h-10 mx-auto ${uploadedFile ? "text-emerald-500" : "text-slate-400"}`} />
                          {uploadedFile ? (
                            <div className="text-xs font-bold text-slate-800">
                              تم اختيار الملف: <span className="text-emerald-600">{uploadedFile.name}</span>
                            </div>
                          ) : (
                            <div className="text-[11px] font-bold text-slate-500">
                              اسحب وأسقط ملف الـ txt هنا، أو <span className="text-rose-600 hover:underline">انقر للاختيار من جهازك</span>
                            </div>
                          )}
                          <p className="text-[9px] text-slate-400 font-semibold">الملفات المدعومة: .txt فقط (ترميز UTF-8)</p>
                        </label>
                      </div>
                    </div>

                    {uploadedFile && (
                      <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 truncate max-w-[250px]">
                          {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedFile(null);
                            setUploadedText("");
                          }}
                          className="p-1 hover:bg-rose-100 text-rose-500 rounded-lg transition-colors cursor-pointer"
                          title="إزالة الملف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Splitting Option Checkbox */}
                    <label className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100/80 p-3.5 rounded-2xl border border-slate-200/50 cursor-pointer transition-colors select-none">
                      <input
                        type="checkbox"
                        checked={shouldSplit}
                        onChange={(e) => setShouldSplit(e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 accent-rose-600 cursor-pointer"
                      />
                      <div className="space-y-0.5 text-right flex-1">
                        <span className="text-xs font-black text-slate-700 block">تجزئة النص تلقائياً لأسطر تفاعلية</span>
                        <span className="text-[10px] font-semibold text-slate-400 block">عند إلغاء التحديد، سيتم حفظ النص بالكامل كقطعة واحدة غير مقسمة (spTT).</span>
                      </div>
                    </label>

                    {checkingError && (
                      <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 font-semibold text-xs rounded-xl leading-relaxed">
                        ⚠️ {checkingError}
                      </div>
                    )}

                    {extractSuccess ? (
                      <div className="py-2.5 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-emerald-100">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>تم معالجة الملف بنجاح وحفظه في المكتبة الدراسية!</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleExtractDirectText}
                        disabled={!uploadedText.trim()}
                        className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-rose-100 cursor-pointer disabled:opacity-50"
                      >
                        <FileText className="w-4 h-4" />
                        <span>حفظ واستخراج النص (spT)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-slate-500 text-[11px] leading-relaxed space-y-1.5 font-bold">
                <span className="text-slate-800 font-black block">💡 نصيحة تفيدك كطالب:</span>
                <p>تعتبر الفيديوهات والمحاضرات على يوتيوب كنزاً دراسياً كبيراً. نظامنا المطور يتصل مباشرة بسيرفر التفريغ الألماني ويحمل الفيديو بالدقة التي تختارها ويفرغه تلقائياً بدقة متناهية مع ملفات الترجمة (.SRT) لتوليد بطاقات دراسية غنية ومثالية.</p>
              </div>

            </div>
          </div>
        ) : (
          /* SAVED TRANSCRIPTS LIST LIBRARY */
          <div className="h-full flex flex-col overflow-hidden">
            {/* Search Bar */}
            <div className="p-4 bg-white border-b border-slate-100 flex items-center gap-4 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث داخل مكتبتك عن الملفات النصية المسحوبة spT..."
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-rose-500 rounded-xl text-xs focus:outline-none transition-all font-semibold"
                />
              </div>
            </div>

            {/* Scrollable grid of documents */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredDocs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredDocs.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => {
                        setActiveDoc(doc);
                        setDocTitle(doc.title);
                        setHasChanges(false);
                      }}
                      className="group bg-white rounded-3xl border border-slate-100 hover:border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer flex flex-col justify-between"
                    >
                      {/* Image Banner */}
                      <div className="aspect-video relative w-full overflow-hidden bg-slate-100">
                        <img 
                          src={doc.thumbnailUrl || `https://img.youtube.com/vi/${doc.videoId}/0.jpg`} 
                          alt={doc.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/45 backdrop-blur-xs text-[9px] font-black text-white rounded">
                          {doc.languageLabel || doc.languageCode || "spT"}
                        </div>
                      </div>

                      {/* Info & Card Metadata */}
                      <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="text-xs font-black text-slate-800 line-clamp-2 leading-relaxed">
                            {doc.title}
                          </h3>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{doc.segments.length} سطر</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSendToAI(doc);
                              }}
                              className="p-1.5 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded-xl transition-all border border-violet-100/50"
                              title="التحويل للمساعد الذكي"
                            >
                              <Sparkles className="w-3.5 h-3.5 shrink-0" />
                            </button>
                            
                            <button
                              onClick={(e) => handleDeleteDoc(doc.id, e)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all border border-rose-100/50"
                              title="حذف الملف"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-3 border border-rose-100">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-black text-slate-700">مكتبتك خالية حالياً</h3>
                  <p className="text-xs text-slate-400 font-bold mt-1 max-w-sm">
                    {listSearch 
                      ? "لا توجد ملفات نصية تطابق عبارة البحث." 
                      : "لم تقم بسحب أي نصوص يوتيوب بعد. انقر على 'سحب فيديو جديد' في الأعلى للبدء."}
                  </p>
                  
                  {!listSearch && (
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      تنزيل وتفريغ أول فيديو الآن 🎥⚡
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
});

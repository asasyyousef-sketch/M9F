import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeft,
  Search,
  ChevronRight,
  Info,
  Pencil,
  Check,
  FolderUp,
  FileArchive,
  X,
  Zap,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Clock,
  UploadCloud,
  Copy,
  Terminal,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Bug
} from "lucide-react";
import { InteractiveBook, BookPage, BookPageMedia, MediaFile } from "../types";
import {
  fetchBooksFromServer,
  uploadBookToServer,
  uploadBookFolderToServer,
  deleteBookFromServer,
  UploadDiagnosticException
} from "../utils/bookStorage";
import {
  DiagnosticReport,
  MicroStage,
  INITIAL_30_STAGES
} from "../utils/bookUploadDiagnostics";

interface BookReaderWorkspaceProps {
  onPlayMediaInStudio?: (file: Partial<MediaFile>) => void;
  onBackToMediaExplorer?: () => void;
}

export const BookReaderWorkspace: React.FC<BookReaderWorkspaceProps> = ({
  onPlayMediaInStudio,
  onBackToMediaExplorer
}) => {
  // Books list loaded from server / local storage
  const [books, setBooks] = useState<InteractiveBook[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBook, setSelectedBook] = useState<InteractiveBook | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Hidden upload inputs and upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);

  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 🔬 30-Micro-Stage Deep Diagnostics State
  const [stages, setStages] = useState<MicroStage[]>(INITIAL_30_STAGES);
  const [currentStage, setCurrentStage] = useState<MicroStage | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [expandRealtimeStages, setExpandRealtimeStages] = useState<boolean>(true);

  // Load books on mount
  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const serverBooks = await fetchBooksFromServer();
      setBooks(serverBooks);
    } catch (e) {
      console.error("Error loading books:", e);
    } finally {
      setLoading(false);
    }
  };

  // 📋 Copy Complete 30-Stage Diagnostic Report to Clipboard
  const copyFullDiagnosticReport = () => {
    if (!diagnosticReport) {
      if (uploadError) {
        navigator.clipboard?.writeText(uploadError);
        setCopiedReport(true);
        setTimeout(() => setCopiedReport(false), 3000);
      }
      return;
    }

    const jsonReport = JSON.stringify(diagnosticReport, null, 2);
    const textReport = [
      `=================================================================`,
      `📋 تقرير تشخيص رفع الكتاب التفاعلي (30 مرحلة فحص مجهرية)`,
      `=================================================================`,
      `معرف التقرير: ${diagnosticReport.reportId}`,
      `توقيت التوليد: ${diagnosticReport.generatedAt}`,
      `اسم الملف: ${diagnosticReport.fileName} (${diagnosticReport.fileSizeFormatted})`,
      `حجم البايتات: ${diagnosticReport.fileSizeBytes}`,
      `نوع الملف: ${diagnosticReport.fileType}`,
      `المسار المستهدف: ${diagnosticReport.targetEndpoint || "N/A"}`,
      `-----------------------------------------------------------------`,
      `❌ المرحلة التي توقف عندها النظام: مرحلة ${diagnosticReport.failedStageNumber} / 30`,
      `عنوان المرحلة: ${diagnosticReport.failedStageTitle}`,
      `سبب التوقف: ${diagnosticReport.errorMessage}`,
      `رمز الاستجابة HTTP: ${diagnosticReport.httpStatus ?? "None"} ${diagnosticReport.httpStatusText || ""}`,
      `استجابة السيرفر الخام: ${diagnosticReport.rawServerResponse || "No body response"}`,
      `معلومات المتصفح: ${diagnosticReport.clientInfo.userAgent}`,
      `متصل بالإنترنت: ${diagnosticReport.clientInfo.isOnline ? "نعم" : "لا"}`,
      `-----------------------------------------------------------------`,
      `سجل المراحل الـ 30 المفصل:`,
      ...diagnosticReport.stagesLog.map((s) => {
        const mark = s.status === "completed" ? "✓ [ناجحة]" : s.status === "failed" ? "✗ [فاشلة]" : s.status === "running" ? "⏳ [جارية]" : "○ [لم تبدأ]";
        return `${s.id.toString().padStart(2, "0")}. ${mark} ${s.titleAr} (${s.durationMs ? s.durationMs + "ms" : "-"}) - ${s.details || ""}${s.error ? " | خطأ: " + s.error : ""}`;
      }),
      `-----------------------------------------------------------------`,
      `الكود البرمجي الخام (JSON):`,
      jsonReport,
      `=================================================================`
    ].join("\n");

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textReport).then(() => {
          setCopiedReport(true);
          setTimeout(() => setCopiedReport(false), 3500);
        });
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = textReport;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 3500);
    }
  };

  // ⚡ Handle uploading ZIP (Super-fast client-side unzip + IndexedDB storage)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadStatusText("بدء نظام الفحص المجهري (30 مرحلة تشخيصية)...");
    setUploadError(null);
    setDiagnosticReport(null);
    setCopiedReport(false);
    setStages(INITIAL_30_STAGES.map((s) => ({ ...s })));
    setCurrentStage(INITIAL_30_STAGES[0]);
    setShowUploadModal(false);

    try {
      const newBook = await uploadBookToServer(file, {
        onProgress: (pct, status) => {
          setUploadProgress(pct);
          if (status) setUploadStatusText(status);
        },
        onStageUpdate: (updatedStages, activeStage) => {
          setStages([...updatedStages]);
          setCurrentStage(activeStage);
        },
        onDiagnosticReport: (report) => {
          setDiagnosticReport(report);
        }
      });

      const updatedList = await fetchBooksFromServer();
      setBooks(updatedList);

      setTimeout(() => {
        setUploading(false);
        setSelectedBook(newBook);
        const mediaIdx = newBook.pages.findIndex((p) => p.media && p.media.length > 0);
        setCurrentPageIndex(mediaIdx >= 0 ? mediaIdx : 0);
      }, 500);
    } catch (err: any) {
      console.error("[Book Upload Error Caught]:", err);
      if (err instanceof UploadDiagnosticException && err.report) {
        setDiagnosticReport(err.report);
        setUploadError(`توقف الفحص عند المرحلة ${err.report.failedStageNumber || "?"} (${err.report.failedStageTitle || ""}): ${err.message}`);
      } else if (err.report) {
        setDiagnosticReport(err.report);
        setUploadError(err.message || "حدث خطأ أثناء معالجة ملف الكتاب");
      } else {
        setUploadError(err?.message || "حدث خطأ أثناء معالجة ملف الكتاب");
      }
      setUploading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ⚡ Handle uploading Book Folder directly (Fastest, zero compression overhead)
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(10);
    setUploadStatusText("جاري قراءة مجلد الكتاب وربط الصوتيات والفيديوهات بالصفحات...");
    setUploadError(null);
    setShowUploadModal(false);

    try {
      const newBook = await uploadBookFolderToServer(files, {
        onProgress: (pct, status) => {
          setUploadProgress(pct);
          if (status) setUploadStatusText(status);
        }
      });

      const updatedList = await fetchBooksFromServer();
      setBooks(updatedList);

      setTimeout(() => {
        setUploading(false);
        setSelectedBook(newBook);
        const mediaIdx = newBook.pages.findIndex((p) => p.media && p.media.length > 0);
        setCurrentPageIndex(mediaIdx >= 0 ? mediaIdx : 0);
      }, 500);
    } catch (err: any) {
      setUploadError(err?.message || "حدث خطأ أثناء قراءة مجلد الكتاب");
      setUploading(false);
    } finally {
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  // Delete book from server
  const handleDeleteBook = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteBookFromServer(id);
      const updated = await fetchBooksFromServer();
      setBooks(updated);
      if (selectedBook?.id === id) {
        setSelectedBook(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Active page calculation
  const activePage: BookPage | undefined = selectedBook?.pages?.[currentPageIndex];

  // Previous and next pages for 3-page carousel
  const prevPage: BookPage | undefined =
    selectedBook && currentPageIndex > 0 ? selectedBook.pages[currentPageIndex - 1] : undefined;

  const nextPage: BookPage | undefined =
    selectedBook && currentPageIndex < selectedBook.pages.length - 1
      ? selectedBook.pages[currentPageIndex + 1]
      : undefined;

  // Media tracks for current page
  const pageTracks: BookPageMedia[] = useMemo(() => {
    if (!selectedBook) return [];
    if (activePage && activePage.media && activePage.media.length > 0) {
      return activePage.media;
    }
    // Fallback: If no page-specific media, return book's allMedia
    return selectedBook.allMedia || [];
  }, [selectedBook, activePage]);

  // Play media directly in studio player (مشغل الوسائط)
  const handlePlayTrack = (media: BookPageMedia) => {
    if (onPlayMediaInStudio) {
      onPlayMediaInStudio({
        id: `book-media-${media.id}`,
        title: media.title,
        type: media.type,
        url: media.url || "",
        originalName: media.fileName,
        filename: media.fileName,
        mimeType: media.type === "video" ? "video/mp4" : "audio/mpeg",
        size: 1024 * 1024 * 2,
        uploadedAt: new Date().toISOString()
      });
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (selectedBook && currentPageIndex < selectedBook.pages.length - 1) {
      setCurrentPageIndex((prev) => prev + 1);
    }
  };

  // =========================================================================
  // VIEW 2: BOOK READER VIEW (EXACTLY MATCHING image_100aa631.png)
  // =========================================================================
  if (selectedBook) {
    return (
      <div className="w-full h-full bg-white text-slate-900 flex flex-col font-sans select-none overflow-y-auto" dir="ltr">
        {/* Top Header: Back Arrow + "Book" on left, Search on right */}
        <div className="h-14 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedBook(null)}
              className="p-1 text-slate-900 hover:text-slate-600 cursor-pointer transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
            </button>
            <span className="text-xl font-bold tracking-tight text-slate-900">Book</span>
          </div>

          <button className="p-1 text-slate-900 hover:text-slate-600 cursor-pointer transition-colors">
            <Search className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Centered Book Subtitle */}
        <div className="text-center text-sm font-medium text-slate-900 py-1 px-4">
          {selectedBook.title}
        </div>

        {/* 3-Page Carousel Display */}
        <div className="relative w-full flex items-center justify-center overflow-hidden py-3 px-2 sm:px-6">
          <div className="flex items-center justify-center gap-4 sm:gap-8 max-w-4xl w-full">
            {/* Left Page (Previous) */}
            <div
              onClick={handlePrevPage}
              className={`w-1/4 sm:w-1/3 aspect-[3/4] max-h-[290px] rounded-sm overflow-hidden shadow-md border border-slate-200 transition-all cursor-pointer ${
                prevPage ? "opacity-90 hover:opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {prevPage?.pageImage ? (
                <img
                  src={prevPage.pageImage}
                  alt={`Page ${prevPage.pageNumber}`}
                  className="w-full h-full object-contain bg-white"
                />
              ) : (
                <div className="w-full h-full bg-white border border-dashed border-slate-300" />
              )}
            </div>

            {/* Center Active Page */}
            <div className="w-1/2 sm:w-2/5 aspect-[3/4] max-h-[360px] rounded-sm overflow-hidden shadow-xl border border-slate-200 bg-white z-10 transition-transform">
              {activePage?.pageImage ? (
                <img
                  src={activePage.pageImage}
                  alt={`Page ${activePage.pageNumber}`}
                  className="w-full h-full object-contain bg-white"
                />
              ) : (
                <div className="w-full h-full bg-white flex items-center justify-center text-slate-400 text-xs">
                  Page {activePage?.pageNumber || currentPageIndex + 1}
                </div>
              )}
            </div>

            {/* Right Page (Next) */}
            <div
              onClick={handleNextPage}
              className={`w-1/4 sm:w-1/3 aspect-[3/4] max-h-[290px] rounded-sm overflow-hidden shadow-md border border-slate-200 transition-all cursor-pointer ${
                nextPage ? "opacity-90 hover:opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {nextPage?.pageImage ? (
                <img
                  src={nextPage.pageImage}
                  alt={`Page ${nextPage.pageNumber}`}
                  className="w-full h-full object-contain bg-white"
                />
              ) : (
                <div className="w-full h-full bg-white border border-dashed border-slate-300" />
              )}
            </div>
          </div>
        </div>

        {/* Page Number indicator centered below carousel */}
        <div className="text-center text-sm font-normal text-slate-400 py-1">
          {activePage?.displayLabel || activePage?.pageNumber || currentPageIndex + 1}
        </div>

        {/* Tracks List (Exactly matching image_100aa631.png) */}
        <div className="flex-1 w-full border-t border-slate-200 divide-y divide-slate-200 bg-white">
          {pageTracks.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No tracks for this page
            </div>
          ) : (
            pageTracks.map((media) => (
              <div
                key={media.id}
                onClick={() => handlePlayTrack(media)}
                className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              >
                {/* Left Track Info */}
                <div className="flex flex-col min-w-0 pr-4">
                  <span className="text-base font-semibold text-slate-900 truncate">
                    {media.title}
                  </span>
                  <span className="text-sm text-slate-400 capitalize mt-0.5">
                    {media.type === "video" ? "Video" : "Audio"}
                  </span>
                </div>

                {/* Right Action: Solid Blue Play Triangle or Video Icon */}
                <div className="shrink-0 pl-2">
                  {media.type === "video" ? (
                    <svg className="w-6 h-6 fill-[#007aff] text-[#007aff]" viewBox="0 0 24 24">
                      <path d="M4 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.5l4 2.5V7l-4 2.5V8a2 2 0 0 0-2-2H4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 fill-[#007aff] text-[#007aff]" viewBox="0 0 24 24">
                      <polygon points="6 3 20 12 6 21 6 3" />
                    </svg>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: MY BOOKS LIBRARY (EXACTLY MATCHING image_0f369acc.png)
  // =========================================================================
  return (
    <div className="w-full h-full bg-white text-slate-900 flex flex-col font-sans select-none overflow-y-auto" dir="ltr">
      {/* Hidden File Input for ZIP Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Hidden File Input for Folder Upload */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        // @ts-ignore
        directory="true"
        multiple
        onChange={handleFolderUpload}
        className="hidden"
      />

      {/* Top Header: "My Books" on left, Edit Pencil on right */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-gray-100 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Books</h1>

        <button
          onClick={() => setIsEditMode((e) => !e)}
          className="p-2 text-slate-800 hover:text-slate-600 cursor-pointer transition-colors"
          title="Edit Books"
        >
          {isEditMode ? <Check className="w-5 h-5 text-blue-600" /> : <Pencil className="w-5 h-5 stroke-[2.2]" />}
        </button>
      </div>

      {/* Uploading progress notification if active */}
      {uploading && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 text-xs font-semibold text-blue-900 shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
              <span className="font-bold text-sm text-blue-900">{uploadStatusText || "جاري حفظ الكتاب على السيرفر..."}</span>
            </div>
            <span className="font-mono font-bold text-base text-blue-700">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-blue-200/60 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload error banner if any */}
      {uploadError && (
        <div className="p-3 bg-rose-50 border-b border-rose-200 text-xs font-semibold text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold">تنبيه:</span>
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="underline ml-2 cursor-pointer">إغلاق</button>
        </div>
      )}

      {/* "Add Book" Section (Matching image_0f369acc.png) */}
      <div
        onClick={() => !uploading && setShowUploadModal(true)}
        className="p-4 flex items-center gap-4 border-b border-gray-200 cursor-pointer hover:bg-slate-50/60 transition-colors"
      >
        {/* Blue Scan Frame with Plus Icon */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 bg-[#007aff] rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
          <svg className="w-14 h-14 text-white stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3M16 20h3a1 1 0 0 0 1-1v-3" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="9" x2="12" y2="15" strokeLinecap="round" />
            <line x1="9" y1="12" x2="15" y2="12" strokeLinecap="round" />
          </svg>
        </div>

        {/* Blue Text "Add Book" */}
        <div className="flex flex-col">
          <span className="text-base font-bold text-[#007aff]">Add Book</span>
          <span className="text-xs text-slate-400 mt-0.5">رفع كتاب تفاعلي جديد (ملف ZIP أو مجلد مباشر)</span>
        </div>
      </div>

      {/* Modal: Select Upload Method (ZIP or Folder) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-right" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-base font-bold text-slate-900">إضافة كتاب تفاعلي إلى السيرفر</h3>
            </div>

            <div className="p-5 space-y-3.5">
              <p className="text-xs text-slate-500 leading-relaxed">
                اختر الطريقة المناسبة لك (تتم المعالجة والفهرسة محلياً وفورياً في ثوانٍ معدودة):
              </p>

              {/* Option 1: High-Speed Native ZIP Upload */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 rounded-xl border-2 border-blue-500/30 hover:border-blue-600 bg-blue-50/50 hover:bg-blue-50 text-right transition-all flex items-start gap-3 cursor-pointer group"
              >
                <div className="p-2.5 rounded-lg bg-blue-600 text-white shrink-0 group-hover:scale-105 transition-transform">
                  <FileArchive className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-blue-950">رفع ملف ZIP مضغوط (مثل 530_25460.zip)</h4>
                    <span className="text-[10px] font-bold bg-blue-200/80 text-blue-800 px-1.5 py-0.5 rounded">فوري وسهل</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">
                    ارفع ملف الـ ZIP مباشرة، سيتم فك الحزمة وفهرسة الصفحات والصوتيات والفيديوهات وفتح الكتاب خلال ثوانٍ.
                  </p>
                </div>
              </button>

              {/* Option 2: Direct Folder Upload */}
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="w-full p-4 rounded-xl border border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50 text-right transition-all flex items-start gap-3 cursor-pointer group"
              >
                <div className="p-2.5 rounded-lg bg-slate-800 text-white shrink-0 group-hover:scale-105 transition-transform">
                  <FolderUp className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">رفع مجلد الكتاب المباشر (prod)</h4>
                    <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">بدون ضغط</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">
                    اختر مجلد <span className="font-mono font-bold text-slate-700">prod</span> المفكوك على حاسوبك لقراءته فوراً.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 Real-Time 30-Stage Upload Stepper Modal (When Uploading) */}
      {uploading && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden text-right p-6 flex flex-col" dir="rtl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">نظام الرفع والمعالجة المجهري (30 مرحلة)</h3>
                  <p className="text-xs text-slate-500">جاري فحص وتدفق الحزمة بدقة متناهية...</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                {uploadProgress}%
              </span>
            </div>

            {/* Current Active Micro-Stage Banner */}
            <div className="my-4 p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-2xl flex items-start gap-3">
              <Zap className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900">
                    مرحلة {currentStage?.id || 1} من 30: {currentStage?.titleAr || "جاري التنفيذ..."}
                  </span>
                  <span className="text-[10px] text-blue-600 font-mono">
                    {currentStage?.durationMs ? `${currentStage.durationMs}ms` : "نشطة الآن"}
                  </span>
                </div>
                <p className="text-xs text-blue-700 mt-0.5 leading-snug">
                  {currentStage?.details || uploadStatusText || "جاري التحقق والمعالجة في السيرفر..."}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 h-full rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${Math.max(uploadProgress, 8)}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 mb-4">
              <span>يتم النقل والتخزين المباشر على القرص الصلب</span>
              <span className="font-bold text-blue-600">{uploadProgress}% مكتمل</span>
            </div>

            {/* Realtime 30 Stages Mini Scrollable Stepper */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
              <button
                type="button"
                onClick={() => setExpandRealtimeStages(!expandRealtimeStages)}
                className="w-full px-3 py-2 bg-slate-100/70 hover:bg-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer transition-colors"
              >
                <span>متابعة المراحل الـ 30 لحظياً</span>
                {expandRealtimeStages ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {expandRealtimeStages && (
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 p-2 text-xs">
                  {stages.map((stg) => (
                    <div
                      key={stg.id}
                      className={`py-1.5 px-2 flex items-center justify-between rounded-lg transition-colors ${
                        stg.status === "running"
                          ? "bg-blue-100/70 font-semibold text-blue-900"
                          : stg.status === "completed"
                          ? "text-slate-600 hover:bg-white"
                          : "text-slate-400 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {stg.status === "completed" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : stg.status === "running" ? (
                          <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0 flex items-center justify-center text-[9px] text-slate-400 font-mono">
                            {stg.id}
                          </div>
                        )}
                        <span className="truncate">{stg.id}. {stg.titleAr}</span>
                      </div>
                      <span className="text-[10px] font-mono shrink-0 pl-1">
                        {stg.durationMs ? `${stg.durationMs}ms` : stg.status === "running" ? "⏳" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🔬 Deep 30-Stage Diagnostic Error Modal with Copy Button */}
      {uploadError && !uploading && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] shadow-2xl border border-rose-100 overflow-hidden flex flex-col text-right animate-in fade-in zoom-in-95 duration-200" dir="rtl">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-rose-50 to-orange-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-600 text-white rounded-2xl shadow-sm">
                  <Bug className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    تقرير تشخيص الرفع المجهري (30 مرحلة)
                  </h3>
                  <p className="text-xs text-rose-700 font-medium">
                    توقف النظام وحدد بالضبط أين وكيف حدث الخلل
                  </p>
                </div>
              </div>
              <button
                onClick={() => setUploadError(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-white/80 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {/* 🌟 PROMINENT ONE-CLICK COPY REPORT ACTION */}
              <div className="p-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-right">
                  <div className="p-2 bg-white/20 rounded-xl shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">تقرير تشخيصي متكامل جاهز للمطور</h4>
                    <p className="text-xs text-blue-100 leading-snug">
                      اضغط على الزر لنسخ التقرير الشامل ومشاركته لحل المشكلة فوراً.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={copyFullDiagnosticReport}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                    copiedReport
                      ? "bg-emerald-500 text-white ring-2 ring-emerald-300"
                      : "bg-white text-blue-700 hover:bg-blue-50 active:scale-95"
                  }`}
                >
                  {copiedReport ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>تم النسخ بنجاح! الصقه هنا</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 stroke-[2.5]" />
                      <span>نسخ التقرير التشخيصي الكامل</span>
                    </>
                  )}
                </button>
              </div>

              {/* Summary Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Metric 1: Failed Stage */}
                <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200">
                  <span className="text-[11px] font-bold text-rose-800 block">المرحلة المتوقفة</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-black text-rose-600 font-mono">
                      #{diagnosticReport?.failedStageNumber || "?"}
                    </span>
                    <span className="text-xs font-bold text-rose-900 truncate">
                      {diagnosticReport?.failedStageTitle || "غير محدد"}
                    </span>
                  </div>
                </div>

                {/* Metric 2: HTTP Status */}
                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <span className="text-[11px] font-bold text-amber-800 block">رمز استجابة السيرفر</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-black text-amber-700 font-mono">
                      {diagnosticReport?.httpStatus ?? "None"}
                    </span>
                    <span className="text-xs text-amber-800 truncate">
                      {diagnosticReport?.httpStatusText || "انقطاع أو إجهاض"}
                    </span>
                  </div>
                </div>

                {/* Metric 3: File Size */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-600 block">حجم الحزمة</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-black text-slate-800 font-mono">
                      {diagnosticReport?.fileSizeFormatted || "N/A"}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({diagnosticReport?.fileName || "ملف"})
                    </span>
                  </div>
                </div>
              </div>

              {/* Error Explanation Box */}
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span className="text-xs font-bold">السبب الفعلي للتوقف:</span>
                </div>
                <p className="text-xs font-mono font-medium leading-relaxed bg-white/70 p-2.5 rounded-xl border border-rose-200/60 break-words">
                  {diagnosticReport?.errorMessage || uploadError}
                </p>
                {diagnosticReport?.rawServerResponse && (
                  <div className="mt-2 text-[11px]">
                    <span className="text-rose-700 font-bold block mb-1">نص استجابة السيرفر:</span>
                    <pre className="bg-slate-900 text-slate-100 p-2 rounded-lg font-mono text-[10px] overflow-x-auto max-h-24">
                      {diagnosticReport.rawServerResponse}
                    </pre>
                  </div>
                )}
              </div>

              {/* Actionable Solution Guide for 404 / Stage 7 */}
              {(diagnosticReport?.failedStageNumber === 7 || uploadError?.includes("404")) && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 text-amber-950">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-amber-600 text-white rounded-md text-[11px] font-bold">الحل المباشر</span>
                    <h5 className="text-sm font-bold text-amber-900">كيف تحل هذه المشكلة في ثوانٍ على لابتوبك الشخصي:</h5>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-amber-900 leading-relaxed font-sans pr-1">
                    <li>
                      <strong>أوقف السيرفر القديم في التيرمينال:</strong> انتقل إلى نافذة موجه الأوامر (Command Prompt / PowerShell / Terminal) التي تشغل بها السيرفر على لابتوبك، واضغط <kbd className="px-1.5 py-0.5 bg-white border border-amber-300 rounded font-mono font-bold text-[11px]">Ctrl + C</kbd> لإيقاف النسخة القديمة العالقة في الذاكرة.
                    </li>
                    <li>
                      <strong>شغل السيرفر مجدداً:</strong> اكتب الأمر <code className="px-2 py-0.5 bg-slate-900 text-emerald-400 rounded font-mono font-bold text-xs">npm run dev</code> واضغط Enter لتحميل مسارات السيرفر الجديدة في ذاكرة الـ RAM.
                    </li>
                    <li>
                      <strong>أعد المحاولة:</strong> حدّث الصفحة في المتصفح وارفع ملف الـ ZIP مجدداً، وستمر المراحل الـ 30 بنجاح تام!
                    </li>
                  </ol>
                </div>
              )}

              {/* Stepper Timeline: All 30 Micro-Stages */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>سجل فحص المراحل الـ 30 بالتسلسل الدقيق</span>
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500">
                    مكتمل: {stages.filter((s) => s.status === "completed").length} | فاشل: {stages.filter((s) => s.status === "failed").length}
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {stages.map((stg) => {
                    const isFailed = stg.status === "failed" || stg.id === diagnosticReport?.failedStageNumber;
                    const isCompleted = stg.status === "completed";
                    const isRunning = stg.status === "running";

                    return (
                      <div
                        key={stg.id}
                        className={`p-3 flex items-start gap-3 transition-colors ${
                          isFailed
                            ? "bg-rose-50/80 border-r-4 border-rose-600"
                            : isCompleted
                            ? "hover:bg-slate-50/50"
                            : "opacity-50"
                        }`}
                      >
                        {/* Status Icon */}
                        <div className="shrink-0 mt-0.5">
                          {isFailed ? (
                            <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                              ✕
                            </div>
                          ) : isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : isRunning ? (
                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-mono">
                              {stg.id}
                            </div>
                          )}
                        </div>

                        {/* Stage Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${isFailed ? "text-rose-900" : isCompleted ? "text-slate-900" : "text-slate-400"}`}>
                              مرحلة {stg.id}: {stg.titleAr}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {stg.durationMs ? `${stg.durationMs}ms` : ""}
                            </span>
                          </div>

                          <p className={`text-[11px] mt-0.5 ${isFailed ? "text-rose-800 font-medium" : "text-slate-500"}`}>
                            {stg.descriptionAr}
                          </p>

                          {stg.details && (
                            <p className="text-[10px] text-slate-600 bg-slate-100/70 p-1.5 rounded-md mt-1 font-mono">
                              {stg.details}
                            </p>
                          )}

                          {isFailed && stg.error && (
                            <p className="text-[11px] text-rose-700 bg-rose-100 p-2 rounded-md mt-1 font-mono font-bold">
                              خطأ المرحلة: {stg.error}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Collapsible Full Technical Details / JSON */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-slate-500" />
                    <span>عرض البيانات التقنية الخام (JSON / Headers / Stack)</span>
                  </span>
                  {showTechnicalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showTechnicalDetails && (
                  <div className="p-3 bg-slate-900 text-slate-100 text-[10px] font-mono overflow-x-auto max-h-56">
                    <pre>{JSON.stringify(diagnosticReport || { error: uploadError }, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={copyFullDiagnosticReport}
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {copiedReport ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedReport ? "تم نسخ التقرير!" : "نسخ التقرير التشخيصي"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUploadError(null);
                  setShowUploadModal(true);
                }}
                className="py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>محاولة أخرى</span>
              </button>

              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="py-2.5 px-4 text-slate-500 hover:text-slate-800 text-xs font-semibold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Books List (Matching image_0f369acc.png rows) */}
      <div className="flex-1 divide-y divide-gray-200">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Loading books from server...
          </div>
        ) : books.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No books yet. Click "Add Book" to upload one.
          </div>
        ) : (
          books.map((book) => (
            <div
              key={book.id}
              onClick={() => {
                setSelectedBook(book);
                // Default to page with media if available, or first page
                const mediaIdx = book.pages.findIndex((p) => p.media && p.media.length > 0);
                setCurrentPageIndex(mediaIdx >= 0 ? mediaIdx : 0);
              }}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
            >
              {/* Left: Book Cover + Title & Subtitle */}
              <div className="flex items-center gap-4 min-w-0 pr-2">
                {/* Book Cover Thumbnail */}
                <div className="w-16 h-22 sm:w-20 sm:h-26 rounded-xs overflow-hidden shadow-xs border border-gray-100 shrink-0 bg-slate-100 flex items-center justify-center">
                  {book.coverImage ? (
                    <img
                      src={book.coverImage}
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-slate-400 font-bold">Book</span>
                  )}
                </div>

                {/* Title & Subtitle */}
                <div className="flex flex-col min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {book.title}
                  </h3>
                  <span className="text-sm font-normal text-slate-400 truncate mt-0.5">
                    {book.subtitle || "Kurs- und Arbeitsbuch"}
                  </span>
                </div>
              </div>

              {/* Right: Chevron > at top and Info (i) at bottom */}
              <div className="flex flex-col items-end justify-between h-20 shrink-0 pl-2">
                {isEditMode ? (
                  <button
                    onClick={(e) => handleDeleteBook(e, book.id)}
                    className="p-1 text-rose-500 hover:text-rose-700 text-xs font-bold"
                  >
                    Delete
                  </button>
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
                <Info className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

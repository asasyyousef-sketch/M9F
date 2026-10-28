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
  Loader2,
  Clock,
  UploadCloud
} from "lucide-react";
import { InteractiveBook, BookPage, BookPageMedia, MediaFile } from "../types";
import {
  fetchBooksFromServer,
  uploadBookWithDiagnostics,
  UploadStageInfo,
  deleteBookFromServer
} from "../utils/bookStorage";

interface BookReaderWorkspaceProps {
  onPlayMediaInStudio?: (file: Partial<MediaFile>) => void;
  onBackToMediaExplorer?: () => void;
}

const INITIAL_STAGES: Record<number, UploadStageInfo> = {
  1: { stageNumber: 1, stageName: "المرحلة 1: فحص واستخراج محتويات الحزمة", status: "pending", details: "في انتظار بدء التحليل الموضعي...", percentage: 0 },
  2: { stageNumber: 2, stageName: "المرحلة 2: قراءة بيانات الكتاب والتنسيق (JSON)", status: "pending", details: "في انتظار مطابقة الفهرس...", percentage: 0 },
  3: { stageNumber: 3, stageName: "المرحلة 3: تهيئة مساحة الكتاب على السيرفر", status: "pending", details: "في انتظار حجز المجلد بالسيرفر...", percentage: 0 },
  4: { stageNumber: 4, stageName: "المرحلة 4: حفظ صور الصفحات وملفات التنسيق", status: "pending", details: "في انتظار نقل الصفحات...", percentage: 0 },
  5: { stageNumber: 5, stageName: "المرحلة 5: حفظ الصوتيات والفيديوهات (تجزئة آمنة)", status: "pending", details: "في انتظار نقل الوسائط بالتجزئة...", percentage: 0 },
  6: { stageNumber: 6, stageName: "المرحلة 6: الاعتماد النهائي وفهرسة الكتاب", status: "pending", details: "في انتظار اعتماد الفهرس...", percentage: 0 }
};

export const BookReaderWorkspace: React.FC<BookReaderWorkspaceProps> = ({
  onPlayMediaInStudio,
  onBackToMediaExplorer
}) => {
  // Books list loaded from server
  const [books, setBooks] = useState<InteractiveBook[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBook, setSelectedBook] = useState<InteractiveBook | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Hidden upload inputs and upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [skipVideos, setSkipVideos] = useState<boolean>(false);

  // Stages Diagnostic Tracking State
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState<boolean>(false);
  const [stages, setStages] = useState<Record<number, UploadStageInfo>>(INITIAL_STAGES);
  const [currentStageNum, setCurrentStageNum] = useState<number>(1);

  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Load books from server on mount
  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const serverBooks = await fetchBooksFromServer();
      setBooks(serverBooks);
    } catch (e) {
      console.error("Error loading books from server:", e);
    } finally {
      setLoading(false);
    }
  };

  const resetStages = () => {
    setStages(JSON.parse(JSON.stringify(INITIAL_STAGES)));
    setCurrentStageNum(1);
    setUploadError(null);
  };

  // Handle uploading ZIP to server with Stage Diagnostics & Chunking
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    resetStages();
    setUploading(true);
    setShowUploadModal(false);
    setShowDiagnosticsModal(true);

    try {
      const newBook = await uploadBookWithDiagnostics(file, {
        skipVideos: skipVideos,
        onStageUpdate: (info) => {
          setStages((prev) => ({
            ...prev,
            [info.stageNumber]: info
          }));
          setCurrentStageNum(info.stageNumber);
          setUploadProgress(info.percentage);
          setUploadStatusText(`${info.stageName}: ${info.details}`);
        }
      });

      // Reload books from server to ensure complete persistence
      const updatedList = await fetchBooksFromServer();
      setBooks(updatedList);

      setTimeout(() => {
        setShowDiagnosticsModal(false);
        setSelectedBook(newBook);
        const mediaIdx = newBook.pages.findIndex((p) => p.media && p.media.length > 0);
        setCurrentPageIndex(mediaIdx >= 0 ? mediaIdx : 0);
      }, 1200);
    } catch (err: any) {
      setUploadError(err?.message || "حدث خطأ أثناء تنفيذ مراحل حفظ الكتاب");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle uploading Book Folder directly with Stage Diagnostics & Chunking
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    resetStages();
    setUploading(true);
    setShowUploadModal(false);
    setShowDiagnosticsModal(true);

    try {
      const newBook = await uploadBookWithDiagnostics(files, {
        skipVideos: skipVideos,
        onStageUpdate: (info) => {
          setStages((prev) => ({
            ...prev,
            [info.stageNumber]: info
          }));
          setCurrentStageNum(info.stageNumber);
          setUploadProgress(info.percentage);
          setUploadStatusText(`${info.stageName}: ${info.details}`);
        }
      });

      const updatedList = await fetchBooksFromServer();
      setBooks(updatedList);

      setTimeout(() => {
        setShowDiagnosticsModal(false);
        setSelectedBook(newBook);
        const mediaIdx = newBook.pages.findIndex((p) => p.media && p.media.length > 0);
        setCurrentPageIndex(mediaIdx >= 0 ? mediaIdx : 0);
      }, 1200);
    } catch (err: any) {
      setUploadError(err?.message || "فشل حفظ وفهرسة مجلد الكتاب على السيرفر");
    } finally {
      setUploading(false);
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

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                تم تحديث محرك السيرفر ليعمل بدون استهلاك الذاكرة المؤقتة (RAM) نهائياً مع فك ضغط فوري وحفظ مباشر على القرص:
              </p>

              {/* Option 1: Direct Folder Upload */}
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="w-full p-4 rounded-xl border-2 border-blue-500/30 hover:border-blue-600 bg-blue-50/50 hover:bg-blue-50 text-right transition-all flex items-start gap-3 cursor-pointer group"
              >
                <div className="p-2.5 rounded-lg bg-blue-600 text-white shrink-0 group-hover:scale-105 transition-transform">
                  <FolderUp className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-blue-950">رفع مجلد الكتاب المباشر (الأفضل والأنصح)</h4>
                    <span className="text-[10px] font-bold bg-blue-200/80 text-blue-800 px-1.5 py-0.5 rounded">موصى به</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">
                    اختر مجلد <span className="font-mono font-bold text-slate-700">prod</span> المفكوك مباشرة من حاسوبك بدون الحاجة لضغطه.
                  </p>
                </div>
              </button>

              {/* Option 2: High-Speed Native ZIP Upload */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 rounded-xl border border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50 text-right transition-all flex items-start gap-3 cursor-pointer group"
              >
                <div className="p-2.5 rounded-lg bg-slate-800 text-white shrink-0 group-hover:scale-105 transition-transform">
                  <FileArchive className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">رفع ملف ZIP مضغوط</h4>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">فك فوري بالقرص</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">
                    رفع ملف الـ ZIP مباشرة عبر معالج النظام فائق السرعة وبدون أي استهلاك للـ RAM.
                  </p>
                </div>
              </button>

              {/* Fast mode: Skip bulky video files (optional) */}
              <label className="flex items-center gap-2.5 pt-2 px-1 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={skipVideos}
                  onChange={(e) => setSkipVideos(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>تخطي الفيديوهات الضخمة لتسريع الرفع 10 أضعاف (رفع الصفحات والأصوات فقط)</span>
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Live Stage Diagnostics & Error Handling Modal */}
      {showDiagnosticsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden text-right flex flex-col max-h-[90vh]" dir="rtl">
            {/* Modal Header */}
            <div className="p-4 px-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${uploadError ? 'bg-rose-100 text-rose-600' : uploading ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>
                  {uploadError ? <AlertCircle className="w-5 h-5" /> : uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">تشخيص وتقييم مراحل حفظ الكتاب</h3>
                  <p className="text-[11px] text-slate-400 font-medium">متابعة لحظية لكل مرحلة لضمان عدم انقطاع الاتصال بالسيرفر</p>
                </div>
              </div>
              {(!uploading || uploadError) && (
                <button
                  onClick={() => setShowDiagnosticsModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Error Banner if any stage failed */}
            {uploadError && (
              <div className="m-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-rose-800">توقف الحفظ عند {stages[currentStageNum]?.stageName}</p>
                    <p className="font-mono text-rose-700 text-[11px] leading-relaxed break-all">{uploadError}</p>
                    <p className="text-slate-600 text-[11px] mt-1 pt-1 border-t border-rose-200/60">
                      سبب محتمل: إذا كان حجم الحزمة كبيراً جداً، جرّب <b>"رفع مجلد الكتاب المباشر"</b> مع تفعيل <b>"تخطي الفيديوهات"</b> لتقليل الحجم من 1GB إلى 130MB فقط.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Overall Progress Bar */}
            <div className="px-5 pt-3 pb-1">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
                <span>التقدم الإجمالي</span>
                <span className="font-mono font-bold text-blue-600">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${uploadError ? 'bg-rose-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>

            {/* Stages Timeline List */}
            <div className="p-5 space-y-3 overflow-y-auto flex-1">
              {[1, 2, 3, 4, 5, 6].map((num) => {
                const stage = stages[num];
                const isCurrent = currentStageNum === num && uploading && !uploadError;
                const isCompleted = stage.status === "completed";
                const isError = stage.status === "error";

                return (
                  <div
                    key={num}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isError
                        ? "border-rose-300 bg-rose-50/60 shadow-xs"
                        : isCurrent
                        ? "border-blue-400 bg-blue-50/50 shadow-md ring-2 ring-blue-500/10"
                        : isCompleted
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-slate-100 bg-slate-50/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        {/* Status Icon */}
                        <div className="mt-0.5 shrink-0">
                          {isError ? (
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : isCurrent ? (
                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                          ) : (
                            <Clock className="w-4 h-4 text-slate-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className={`text-xs font-bold ${isError ? 'text-rose-900' : isCompleted ? 'text-emerald-900' : isCurrent ? 'text-blue-900' : 'text-slate-600'}`}>
                              {stage.stageName}
                            </h4>
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/80 border border-slate-200/60 text-slate-600">
                              {isError ? 'خطأ' : isCompleted ? 'اكتملت 100%' : isCurrent ? `${stage.percentage}%` : 'قيد الانتظار'}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                            {stage.details}
                          </p>

                          {/* Live mini progress bar for active stage */}
                          {isCurrent && stage.percentage > 0 && (
                            <div className="w-full bg-blue-100 rounded-full h-1.5 mt-2 overflow-hidden">
                              <div
                                className="bg-blue-600 h-full rounded-full transition-all duration-200"
                                style={{ width: `${stage.percentage}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              {uploadError ? (
                <div className="flex items-center justify-between w-full">
                  <button
                    onClick={() => {
                      setShowDiagnosticsModal(false);
                      setShowUploadModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    تجربة طريقة رفع أخرى (مجلد أو خفيف)
                  </button>
                  <button
                    onClick={() => setShowDiagnosticsModal(false)}
                    className="px-3 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
                  >
                    إغلاق النافذة
                  </button>
                </div>
              ) : uploading ? (
                <div className="flex items-center gap-2 text-xs text-blue-700 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري تنفيذ النقل والتجزئة بأمان تام...</span>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full text-xs text-emerald-700 font-bold">
                  <span>تم حفظ وفهرسة الكتاب التفاعلي بالكامل على السيرفر!</span>
                  <button
                    onClick={() => setShowDiagnosticsModal(false)}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    فتح الكتاب
                  </button>
                </div>
              )}
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

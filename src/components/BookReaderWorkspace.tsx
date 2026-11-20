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
  Bug,
  Sparkles,
  Menu,
  ImagePlus,
  Save,
  BookOpen
} from "lucide-react";
import { InteractiveBook, BookPage, BookPageMedia, MediaFile } from "../types";
import {
  fetchBooksFromServer,
  getCachedBooks,
  uploadBookToServer,
  uploadBookFolderToServer,
  deleteBookFromServer,
  updateBookMetadataOnServer,
  uploadBookCoverToServer,
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
  onToggleSidebar?: () => void;
  initialBookId?: string | null;
  initialPageIndex?: number;
}

export const BookReaderWorkspace: React.FC<BookReaderWorkspaceProps> = ({
  onPlayMediaInStudio,
  onBackToMediaExplorer,
  onToggleSidebar,
  initialBookId,
  initialPageIndex
}) => {
  // Helper: Filter book pages to show only pages with audio/video (unless no page has mapped media)
  const getVisibleBookPages = (book: InteractiveBook): BookPage[] => {
    const pagesWithMedia = (book.pages || []).filter(
      (p) => Array.isArray(p.media) && p.media.length > 0
    );
    return pagesWithMedia.length > 0 ? pagesWithMedia : (book.pages || []);
  };

  // Synchronous initial snapshot from memory cache for instant return from Studio
  const initialCachedBooks = getCachedBooks();
  const initialMatchedBook = initialBookId
    ? initialCachedBooks.find((b) => b.id === initialBookId) || null
    : null;

  // Books list loaded from server / local storage
  const [books, setBooks] = useState<InteractiveBook[]>(initialCachedBooks);
  const [loading, setLoading] = useState<boolean>(initialCachedBooks.length === 0);
  const [selectedBook, setSelectedBook] = useState<InteractiveBook | null>(initialMatchedBook);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(() => {
    if (!initialMatchedBook) return 0;
    const visible = getVisibleBookPages(initialMatchedBook);
    if (typeof initialPageIndex === "number" && initialPageIndex >= 0 && initialPageIndex < visible.length) {
      return initialPageIndex;
    }
    try {
      const savedPage = localStorage.getItem(`interactive_book_last_page_${initialMatchedBook.id}`);
      if (savedPage !== null) {
        const parsed = parseInt(savedPage, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < visible.length) return parsed;
      }
    } catch {}
    return 0;
  });
  const appliedInitialContextRef = useRef<string | null>(
    initialMatchedBook ? `${initialMatchedBook.id}:${initialPageIndex ?? ""}` : null
  );
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Inline Audio Player State
  const [activeInlineMedia, setActiveInlineMedia] = useState<BookPageMedia | null>(null);
  const [isPlayingInline, setIsPlayingInline] = useState<boolean>(false);
  const [inlineCurrentTime, setInlineCurrentTime] = useState<number>(0);
  const [inlineDuration, setInlineDuration] = useState<number>(0);
  const [inlinePlaybackRate, setInlinePlaybackRate] = useState<number>(1.0);
  const [activeVideoFallback, setActiveVideoFallback] = useState<BookPageMedia | null>(null);
  const inlineAudioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  // Helper: Restore saved last-read page for a book from localStorage
  const selectBookAndRestorePage = (book: InteractiveBook) => {
    setSelectedBook(book);
    setActiveInlineMedia(null);
    const visible = getVisibleBookPages(book);
    try {
      const savedPage = localStorage.getItem(`interactive_book_last_page_${book.id}`);
      if (savedPage !== null) {
        const parsed = parseInt(savedPage, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < visible.length) {
          setCurrentPageIndex(parsed);
          return;
        }
      }
    } catch (e) {}

    setCurrentPageIndex(0);
  };

  // Save current page position to localStorage whenever selectedBook or currentPageIndex changes
  useEffect(() => {
    if (selectedBook && typeof currentPageIndex === "number") {
      try {
        localStorage.setItem(`interactive_book_last_page_${selectedBook.id}`, currentPageIndex.toString());
      } catch (e) {}
    }
  }, [selectedBook, currentPageIndex]);

  // Page Jump & Search state
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [pageSearchInput, setPageSearchInput] = useState<string>("");

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

  // Book Details & Edit Modal State (Persisted to Server for Everyone)
  const [editingBook, setEditingBook] = useState<InteractiveBook | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editSubtitle, setEditSubtitle] = useState<string>("");
  const [editAuthor, setEditAuthor] = useState<string>("");
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string>("");
  const [savingDetails, setSavingDetails] = useState<boolean>(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // Load books on mount
  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    if (books.length === 0) {
      setLoading(true);
    }
    try {
      const serverBooks = await fetchBooksFromServer();
      setBooks(serverBooks);
      if (initialBookId) {
        const ctxKey = `${initialBookId}:${initialPageIndex ?? ""}`;
        const found = serverBooks.find((b) => b.id === initialBookId);
        if (found) {
          if (appliedInitialContextRef.current !== ctxKey) {
            appliedInitialContextRef.current = ctxKey;
            selectBookAndRestorePage(found);
            const visible = getVisibleBookPages(found);
            if (typeof initialPageIndex === "number" && initialPageIndex >= 0 && initialPageIndex < visible.length) {
              setCurrentPageIndex(initialPageIndex);
            }
          } else {
            // Update selected book reference cleanly without resetting user's active page
            setSelectedBook((prev) => (prev?.id === found.id ? found : prev));
          }
        }
      }
    } catch (e) {
      console.error("Error loading books:", e);
    } finally {
      setLoading(false);
    }
  };

  // Sync when initialBookId or initialPageIndex change from props
  useEffect(() => {
    if (!initialBookId || books.length === 0) return;
    const ctxKey = `${initialBookId}:${initialPageIndex ?? ""}`;
    if (appliedInitialContextRef.current === ctxKey) return;
    const found = books.find((b) => b.id === initialBookId);
    if (found) {
      appliedInitialContextRef.current = ctxKey;
      selectBookAndRestorePage(found);
      const visible = getVisibleBookPages(found);
      if (typeof initialPageIndex === "number" && initialPageIndex >= 0 && initialPageIndex < visible.length) {
        setCurrentPageIndex(initialPageIndex);
      }
    }
  }, [initialBookId, initialPageIndex, books]);

  // Jump to specific page by number or label
  const handleJumpToPage = (query: string) => {
    if (!selectedBook || !query.trim()) return;
    const visible = getVisibleBookPages(selectedBook);
    const clean = query.trim().toLowerCase();
    const num = parseInt(clean, 10);

    // 1. Try finding by pageNumber
    if (!isNaN(num)) {
      const idxByNum = visible.findIndex((p) => p.pageNumber === num);
      if (idxByNum !== -1) {
        setCurrentPageIndex(idxByNum);
        setIsSearchOpen(false);
        setPageSearchInput("");
        return;
      }
    }

    // 2. Try finding by displayLabel
    const idxByLabel = visible.findIndex(
      (p) => p.displayLabel && p.displayLabel.toLowerCase() === clean
    );
    if (idxByLabel !== -1) {
      setCurrentPageIndex(idxByLabel);
      setIsSearchOpen(false);
      setPageSearchInput("");
      return;
    }

    // 3. Try partial match on label
    const idxByPartial = visible.findIndex(
      (p) => p.displayLabel && p.displayLabel.toLowerCase().includes(clean)
    );
    if (idxByPartial !== -1) {
      setCurrentPageIndex(idxByPartial);
      setIsSearchOpen(false);
      setPageSearchInput("");
      return;
    }

    // 4. Fallback: 1-based visible index
    if (!isNaN(num) && num >= 1 && num <= visible.length) {
      setCurrentPageIndex(num - 1);
      setIsSearchOpen(false);
      setPageSearchInput("");
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
        setCurrentPageIndex(0);
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
        setCurrentPageIndex(0);
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

  // Open Book Details & Edit Modal
  const openBookDetailsModal = (e: React.MouseEvent, book: InteractiveBook) => {
    e.stopPropagation();
    if (editCoverPreview && editCoverPreview.startsWith("blob:")) {
      try { URL.revokeObjectURL(editCoverPreview); } catch {}
    }
    setEditingBook(book);
    setEditTitle(book.title || "");
    setEditSubtitle(book.subtitle || "");
    setEditAuthor(book.author || "");
    setEditCoverFile(null);
    setEditCoverPreview(book.coverImage || "");
    setDetailsError(null);
    setSavingDetails(false);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const closeBookDetailsModal = () => {
    if (savingDetails) return;
    if (editCoverPreview && editCoverPreview.startsWith("blob:")) {
      try { URL.revokeObjectURL(editCoverPreview); } catch {}
    }
    setEditingBook(null);
    setEditCoverFile(null);
    setEditCoverPreview("");
    setDetailsError(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const handleCoverFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(file.name)) {
      setDetailsError("الرجاء اختيار ملف صورة صالح (PNG, JPG, WebP)");
      return;
    }
    if (editCoverPreview && editCoverPreview.startsWith("blob:")) {
      try { URL.revokeObjectURL(editCoverPreview); } catch {}
    }
    setEditCoverFile(file);
    setEditCoverPreview(URL.createObjectURL(file));
    setDetailsError(null);
  };

  const handleSaveBookDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook) return;
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setDetailsError("الرجاء إدخال اسم للكتاب");
      return;
    }

    setSavingDetails(true);
    setDetailsError(null);

    try {
      let updatedBook: InteractiveBook = editingBook;
      if (editCoverFile) {
        updatedBook = await uploadBookCoverToServer(editingBook.id, editCoverFile);
      }
      updatedBook = await updateBookMetadataOnServer(editingBook.id, {
        title: trimmedTitle,
        subtitle: editSubtitle.trim(),
        author: editAuthor.trim()
      });

      setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
      if (selectedBook?.id === updatedBook.id) {
        setSelectedBook(updatedBook);
      }

      if (editCoverPreview && editCoverPreview.startsWith("blob:")) {
        try { URL.revokeObjectURL(editCoverPreview); } catch {}
      }
      setEditingBook(null);
      setEditCoverFile(null);
      setEditCoverPreview("");
      if (coverInputRef.current) coverInputRef.current.value = "";
    } catch (err: any) {
      setDetailsError(err?.message || "حدث خطأ أثناء حفظ بيانات الكتاب على السيرفر");
    } finally {
      setSavingDetails(false);
    }
  };

  // Visible pages: only pages that contain audio/video (unless the book has no page-mapped media at all)
  const visiblePages: BookPage[] = useMemo(() => {
    if (!selectedBook) return [];
    return getVisibleBookPages(selectedBook);
  }, [selectedBook]);

  const safePageIndex =
    visiblePages.length > 0 ? Math.min(Math.max(0, currentPageIndex), visiblePages.length - 1) : 0;

  // Active page calculation
  const activePage: BookPage | undefined = visiblePages[safePageIndex];

  // Previous and next pages for 3-page carousel
  const prevPage: BookPage | undefined =
    safePageIndex > 0 ? visiblePages[safePageIndex - 1] : undefined;

  const nextPage: BookPage | undefined =
    safePageIndex < visiblePages.length - 1 ? visiblePages[safePageIndex + 1] : undefined;

  // Media tracks for current page
  const pageTracks: BookPageMedia[] = useMemo(() => {
    if (!selectedBook || !activePage) return [];
    if (Array.isArray(activePage.media) && activePage.media.length > 0) {
      return activePage.media;
    }
    const hasAnyPageMappedMedia = (selectedBook.pages || []).some(
      (p) => Array.isArray(p.media) && p.media.length > 0
    );
    if (!hasAnyPageMappedMedia) {
      return selectedBook.allMedia || [];
    }
    return [];
  }, [selectedBook, activePage]);

  // Sync audio playback state & speed reliably with the <audio> element
  useEffect(() => {
    const audio = inlineAudioRef.current;
    if (!audio || !activeInlineMedia || activeInlineMedia.type !== "audio") return;
    audio.playbackRate = inlinePlaybackRate;
    if (isPlayingInline) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [activeInlineMedia, isPlayingInline, inlinePlaybackRate]);

  // 1. Play / toggle audio inline or open video
  const handleInlinePlayTrack = (media: BookPageMedia, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (media.type === "video") {
      if (onPlayMediaInStudio && selectedBook) {
        handlePlayTrackInStudio(media, e);
      } else {
        setIsPlayingInline(false);
        setActiveVideoFallback(media);
      }
      return;
    }

    if (activeInlineMedia?.id === media.id) {
      setIsPlayingInline((prev) => !prev);
    } else {
      setActiveInlineMedia(media);
      setIsPlayingInline(true);
      setInlineCurrentTime(0);
      setInlineDuration(0);
    }
  };

  // Cycle playback speed: 1.0x -> 1.2x -> 1.5x -> 0.8x -> 1.0x
  const handleCyclePlaybackRate = () => {
    const rates = [1.0, 1.2, 1.5, 0.8];
    const currentIdx = rates.findIndex((r) => Math.abs(r - inlinePlaybackRate) < 0.05);
    const nextRate = rates[(currentIdx + 1) % rates.length];
    setInlinePlaybackRate(nextRate);
    if (inlineAudioRef.current) {
      inlineAudioRef.current.playbackRate = nextRate;
    }
  };

  // 2. Play media explicitly in Studio workspace
  const handlePlayTrackInStudio = (media: BookPageMedia, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsPlayingInline(false);
    setActiveInlineMedia(null);
    if (onPlayMediaInStudio && selectedBook) {
      onPlayMediaInStudio({
        id: `book-media-${media.id}`,
        title: media.title,
        type: media.type,
        url: media.url || "",
        originalName: media.fileName,
        filename: media.fileName,
        mimeType: media.type === "video" ? "video/mp4" : "audio/mpeg",
        size: 1024 * 1024 * 2,
        uploadedAt: new Date().toISOString(),
        subtitles: media.subtitles || [],
        bookContext: {
          bookId: selectedBook.id,
          bookTitle: selectedBook.title,
          pageIndex: safePageIndex,
          pageNumber: activePage?.pageNumber || safePageIndex + 1,
          displayLabel: activePage?.displayLabel
        }
      });
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handlePrevPage = () => {
    if (safePageIndex > 0) {
      setCurrentPageIndex(safePageIndex - 1);
    }
  };

  const handleNextPage = () => {
    if (safePageIndex < visiblePages.length - 1) {
      setCurrentPageIndex(safePageIndex + 1);
    }
  };

  // =========================================================================
  // VIEW 2: BOOK READER VIEW (Exact Match to Reference Screenshot)
  // =========================================================================
  if (selectedBook) {
    const sliderProgressPct =
      inlineDuration > 0 ? Math.min(100, Math.max(0, (inlineCurrentTime / inlineDuration) * 100)) : 0;

    return (
      <div
        className="w-full flex-1 bg-white text-[#111827] flex flex-col font-sans select-none overflow-hidden"
        dir="ltr"
      >
        {/* Hidden audio element for inline playback */}
        {activeInlineMedia && activeInlineMedia.type === "audio" && (
          <audio
            ref={inlineAudioRef}
            src={activeInlineMedia.url}
            preload="metadata"
            onCanPlay={(e) => {
              e.currentTarget.playbackRate = inlinePlaybackRate;
              if (isPlayingInline && e.currentTarget.paused) {
                e.currentTarget.play().catch(() => {});
              }
            }}
            onTimeUpdate={(e) => setInlineCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              setInlineDuration(e.currentTarget.duration || 0);
              e.currentTarget.playbackRate = inlinePlaybackRate;
            }}
            onEnded={() => setIsPlayingInline(false)}
          />
        )}

        {/* Top Header: Back Arrow + "Book" on left, Search on right */}
        <div className="h-14 px-4 sm:px-5 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setSelectedBook(null);
                setActiveInlineMedia(null);
                setIsPlayingInline(false);
                setIsSearchOpen(false);
                setPageSearchInput("");
              }}
              className="p-1 -ml-1 text-[#111827] hover:text-gray-600 cursor-pointer transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2]" />
            </button>
            <span className="text-[20px] font-bold tracking-tight text-[#111827]">Book</span>
          </div>

          <div className="flex items-center gap-2">
            {isSearchOpen ? (
              <div className="flex items-center gap-1.5 border border-gray-300 rounded-lg px-2.5 py-1 bg-white">
                <Search className="w-4 h-4 text-gray-500 shrink-0" />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Page..."
                  value={pageSearchInput}
                  onChange={(e) => setPageSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleJumpToPage(pageSearchInput);
                    if (e.key === "Escape") {
                      setIsSearchOpen(false);
                      setPageSearchInput("");
                    }
                  }}
                  className="w-20 sm:w-28 bg-transparent text-sm text-[#111827] placeholder-gray-400 outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(false);
                    setPageSearchInput("");
                  }}
                  className="p-0.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                  aria-label="Close search"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="p-1 text-[#111827] hover:text-gray-600 cursor-pointer transition-colors"
                aria-label="Search page"
              >
                <Search className="w-5 h-5 stroke-[2]" />
              </button>
            )}
          </div>
        </div>

        {/* Centered Book Title */}
        <div className="text-center text-[15px] sm:text-[16px] font-normal text-[#1F2937] pt-1 pb-3 px-4 truncate shrink-0">
          {selectedBook.title}
        </div>

        {/* 3-Page Carousel Stage (Compact height, side pages cropped at viewport edges) */}
        <div
          className="relative w-full flex items-center justify-center overflow-hidden py-1 shrink-0 min-h-[155px] sm:min-h-[185px] md:min-h-[205px]"
          onTouchStart={(e) => {
            touchStartXRef.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (touchStartXRef.current === null) return;
            const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
            const diff = touchStartXRef.current - endX;
            touchStartXRef.current = null;
            if (Math.abs(diff) > 40) {
              if (diff > 0) handleNextPage();
              else handlePrevPage();
            }
          }}
        >
          {/* Left Page (Previous - bleeding off left edge) */}
          {prevPage && (
            <button
              type="button"
              onClick={handlePrevPage}
              aria-label={`Previous page ${prevPage.displayLabel || prevPage.pageNumber}`}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[45%] w-[100px] sm:w-[120px] md:w-[134px] aspect-[210/297] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.16)] border border-black/5 overflow-hidden cursor-pointer focus:outline-none"
            >
              {prevPage.pageImage ? (
                <img
                  src={prevPage.pageImage}
                  alt={`Page ${prevPage.pageNumber}`}
                  className="w-full h-full object-contain bg-white"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full bg-white flex items-center justify-center text-gray-400 text-xs">
                  {prevPage.displayLabel || prevPage.pageNumber}
                </div>
              )}
            </button>
          )}

          {/* Center Active Page */}
          <div className="relative z-10 w-[104px] sm:w-[126px] md:w-[140px] aspect-[210/297] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.18)] border border-black/5 overflow-hidden">
            {activePage?.pageImage ? (
              <img
                src={activePage.pageImage}
                alt={`Page ${activePage.pageNumber}`}
                className="w-full h-full object-contain bg-white"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-white flex items-center justify-center text-gray-400 text-sm tabular-nums">
                {activePage?.displayLabel || activePage?.pageNumber || safePageIndex + 1}
              </div>
            )}
          </div>

          {/* Right Page (Next - bleeding off right edge) */}
          {nextPage && (
            <button
              type="button"
              onClick={handleNextPage}
              aria-label={`Next page ${nextPage.displayLabel || nextPage.pageNumber}`}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[45%] w-[100px] sm:w-[120px] md:w-[134px] aspect-[210/297] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.16)] border border-black/5 overflow-hidden cursor-pointer focus:outline-none"
            >
              {nextPage.pageImage ? (
                <img
                  src={nextPage.pageImage}
                  alt={`Page ${nextPage.pageNumber}`}
                  className="w-full h-full object-contain bg-white"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full bg-white flex items-center justify-center text-gray-400 text-xs">
                  {nextPage.displayLabel || nextPage.pageNumber}
                </div>
              )}
            </button>
          )}
        </div>

        {/* Centered Page Number & Hairline Bottom Divider */}
        <div className="shrink-0 text-center text-[15px] font-normal text-[#8E8E93] pt-2 pb-2.5 border-b border-[#D1D5DB] tabular-nums bg-white">
          {activePage?.displayLabel || activePage?.pageNumber || safePageIndex + 1}
        </div>

        {/* Clean White Media Tracks List */}
        <div className="flex-1 w-full overflow-y-auto bg-white min-h-0">
          {pageTracks.length === 0 ? (
            <div className="py-12 text-center text-[#8E8E93] text-sm">
              No media tracks for this page
            </div>
          ) : (
            <div className="divide-y divide-[#D1D5DB] border-b border-[#D1D5DB]">
              {pageTracks.map((media) => {
                const isActiveAudio = media.type === "audio" && activeInlineMedia?.id === media.id;

                return (
                  <div
                    key={media.id}
                    onClick={() => handleInlinePlayTrack(media)}
                    className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4 bg-white hover:bg-gray-50/70 transition-colors cursor-pointer"
                  >
                    {/* Left Track Title & Type */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-[15px] sm:text-[16px] font-normal text-[#111827] leading-snug truncate">
                        {media.title}
                      </span>
                      <span className="text-[14px] font-normal text-[#8E8E93] leading-snug mt-0.5">
                        {media.type === "video" ? "Video" : "Audio"}
                      </span>
                    </div>

                    {/* Right Action Icons: Simple Studio Icon + Play/Pause/Video Icon (Uniform size) */}
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handlePlayTrackInStudio(media, e)}
                        className="p-1 text-[#8E8E93] hover:text-[#007AFF] transition-colors cursor-pointer"
                        title="فتح في الاستوديو"
                        aria-label={`Open ${media.title} in studio`}
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>

                      {media.type === "video" ? (
                        <button
                          type="button"
                          onClick={(e) => handleInlinePlayTrack(media, e)}
                          className="p-1 text-[#007AFF] hover:opacity-80 transition-opacity cursor-pointer"
                          aria-label={`Play video ${media.title}`}
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 10.2V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h11c.55 0 1-.45 1-1v-3.2l5 3.7V6.5l-5 3.7z" />
                          </svg>
                        </button>
                      ) : isActiveAudio ? (
                        <button
                          type="button"
                          onClick={(e) => handleInlinePlayTrack(media, e)}
                          className="p-1 text-[#007AFF] hover:opacity-80 transition-opacity cursor-pointer"
                          aria-label={isPlayingInline ? "Pause" : "Play"}
                        >
                          {isPlayingInline ? (
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleInlinePlayTrack(media, e)}
                          className="p-1 text-[#007AFF] hover:opacity-80 transition-opacity cursor-pointer"
                          aria-label={`Play audio ${media.title}`}
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Fixed Audio Scrubber Bar (Exact Match to Screenshot) */}
        {activeInlineMedia && activeInlineMedia.type === "audio" && (
          <div className="shrink-0 bg-white px-4 py-2.5 flex items-center gap-3">
            <span className="text-[13px] sm:text-[14px] font-normal text-[#111827] tabular-nums shrink-0">
              {formatTime(inlineCurrentTime)}
            </span>

            <input
              type="range"
              min={0}
              max={inlineDuration || 100}
              step={0.1}
              value={inlineCurrentTime}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setInlineCurrentTime(val);
                if (inlineAudioRef.current) {
                  inlineAudioRef.current.currentTime = val;
                }
              }}
              aria-label="Audio progress"
              className="flex-1 h-[3px] appearance-none rounded-full cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#007AFF] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#007AFF] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              style={{
                background: `linear-gradient(to right, #007AFF 0%, #007AFF ${sliderProgressPct}%, #D1D5DB ${sliderProgressPct}%, #D1D5DB 100%)`
              }}
            />

            <span className="text-[13px] sm:text-[14px] font-normal text-[#111827] tabular-nums shrink-0">
              {formatTime(inlineDuration)}
            </span>

            <button
              type="button"
              onClick={handleCyclePlaybackRate}
              className="bg-[#007AFF] hover:bg-[#0066D6] text-white text-[13px] font-medium px-2.5 py-2 rounded-[4px] tabular-nums leading-none shrink-0 cursor-pointer transition-colors"
              aria-label="Playback speed"
            >
              {inlinePlaybackRate.toFixed(1)}x
            </button>
          </div>
        )}

        {/* Fallback Inline Video Modal (only if Studio callback is not provided) */}
        {activeVideoFallback && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setActiveVideoFallback(null)}
          >
            <div
              className="w-full max-w-3xl bg-black rounded-xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 text-white">
                <span className="text-sm font-medium truncate">{activeVideoFallback.title}</span>
                <button
                  type="button"
                  onClick={() => setActiveVideoFallback(null)}
                  className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                  aria-label="Close video"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <video
                src={activeVideoFallback.url}
                controls
                autoPlay
                className="w-full max-h-[75vh] bg-black"
              />
            </div>
          </div>
        )}
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
        <div className="flex items-center gap-2.5">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="md:hidden p-2 -mr-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
              aria-label="Open menu"
              title="القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Books</h1>
        </div>

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
                selectBookAndRestorePage(book);
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
                    className="p-1 text-rose-500 hover:text-rose-700 text-xs font-bold cursor-pointer"
                  >
                    Delete
                  </button>
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
                <button
                  type="button"
                  onClick={(e) => openBookDetailsModal(e, book)}
                  className="p-1.5 -m-1.5 rounded-full text-gray-400 hover:text-[#007aff] hover:bg-blue-50 transition-colors cursor-pointer"
                  title="تفاصيل وتعديل الكتاب"
                  aria-label={`Details for ${book.title}`}
                >
                  <Info className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Book Details & Edit Modal (Saved directly on server for all users) */}
      {editingBook && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={closeBookDetailsModal}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-right"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-[#007aff]">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">تفاصيل الكتاب</h3>
                  <p className="text-[11px] text-slate-500">
                    التعديلات تُحفظ على السيرفر وتظهر لجميع المستخدمين
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeBookDetailsModal}
                disabled={savingDetails}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer disabled:opacity-50"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBookDetails} className="p-5 space-y-4">
              {/* Hidden Cover File Input */}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/*"
                onChange={handleCoverFileSelect}
                className="hidden"
              />

              {/* Cover Preview + Upload Button */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="w-20 h-28 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0 flex items-center justify-center shadow-xs">
                  {editCoverPreview ? (
                    <img
                      src={editCoverPreview}
                      alt={editTitle || editingBook.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-slate-400 font-semibold">بدون صورة</span>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="text-xs font-bold text-slate-800">صورة غلاف الكتاب</div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {editCoverFile
                      ? `تم اختيار: ${editCoverFile.name}`
                      : "اختر صورة من جهازك ليتم رفعها وحفظها كغلاف دائم على السيرفر."}
                  </p>
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={savingDetails}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-[#007aff] hover:text-[#007aff] text-xs font-semibold text-slate-700 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <ImagePlus className="w-4 h-4" />
                    <span>{editCoverPreview ? "تغيير الصورة" : "إضافة صورة"}</span>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم الكتاب <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="أدخل اسم الكتاب..."
                  disabled={savingDetails}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-[#007aff] focus:ring-2 focus:ring-blue-500/15 outline-none text-sm text-slate-900 bg-white transition-all"
                  dir="auto"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الوصف أو العنوان الفرعي
                </label>
                <input
                  type="text"
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  placeholder="مثال: Kurs- und Arbeitsbuch"
                  disabled={savingDetails}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-[#007aff] focus:ring-2 focus:ring-blue-500/15 outline-none text-sm text-slate-900 bg-white transition-all"
                  dir="auto"
                />
              </div>

              {/* Author */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  المؤلف / دار النشر
                </label>
                <input
                  type="text"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  placeholder="مثال: Hueber Verlag"
                  disabled={savingDetails}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-[#007aff] focus:ring-2 focus:ring-blue-500/15 outline-none text-sm text-slate-900 bg-white transition-all"
                  dir="auto"
                />
              </div>

              {/* Book Info Stats */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
                <span>عدد الصفحات: <strong className="text-slate-700">{editingBook.pages?.length || editingBook.totalPages || 0}</strong></span>
                <span>الملفات الصوتية والمرئية: <strong className="text-slate-700">{editingBook.allMedia?.length || 0}</strong></span>
              </div>

              {detailsError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{detailsError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeBookDetailsModal}
                  disabled={savingDetails}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingDetails}
                  className="px-5 py-2 rounded-xl bg-[#007aff] hover:bg-[#0066d6] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-60"
                >
                  {savingDetails ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>حفظ على السيرفر</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef, useMemo } from "react";
import JSZip from "jszip";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Search,
  Play,
  Pause,
  Upload,
  BookOpen,
  Folder,
  Volume2,
  Film,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Trash2,
  Plus,
  RotateCcw,
  Sparkles,
  ExternalLink,
  X,
  FileText,
  SlidersHorizontal,
  FolderInput
} from "lucide-react";
import { InteractiveBook, BookPage, BookPageMedia, MediaFile } from "../types";
import { getAllBooksFromDB, saveBookToDB, deleteBookFromDB, DEMO_BOOK } from "../utils/bookStorage";

interface BookReaderWorkspaceProps {
  onPlayMediaInStudio?: (file: Partial<MediaFile>) => void;
  onBackToMediaExplorer?: () => void;
}

export const BookReaderWorkspace: React.FC<BookReaderWorkspaceProps> = ({
  onPlayMediaInStudio,
  onBackToMediaExplorer
}) => {
  const [books, setBooks] = useState<InteractiveBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<InteractiveBook | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Audio Playback State for active page track
  const [activePlayingMediaId, setActivePlayingMediaId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // File Inputs for ZIP and Folder Upload
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Load books from IndexedDB on initial mount
  useEffect(() => {
    async function loadBooks() {
      try {
        const storedBooks = await getAllBooksFromDB();
        if (storedBooks.length === 0) {
          // Seed initial demo book
          await saveBookToDB(DEMO_BOOK);
          setBooks([DEMO_BOOK]);
          setSelectedBook(DEMO_BOOK);
          // Default to page 175 (index 2)
          setCurrentPageIndex(2);
        } else {
          setBooks(storedBooks);
          setSelectedBook(storedBooks[0]);
          // Find page index 175 if it exists or default to 0
          const initialIdx = storedBooks[0].pages.findIndex((p) => p.pageNumber === 175);
          setCurrentPageIndex(initialIdx >= 0 ? initialIdx : 0);
        }
      } catch (err) {
        console.error("Failed to load books from DB:", err);
        setBooks([DEMO_BOOK]);
        setSelectedBook(DEMO_BOOK);
        setCurrentPageIndex(2);
      }
    }
    loadBooks();
  }, []);

  // Handle active page
  const activePage: BookPage | null = useMemo(() => {
    if (!selectedBook || !selectedBook.pages || selectedBook.pages.length === 0) return null;
    return selectedBook.pages[currentPageIndex] || selectedBook.pages[0];
  }, [selectedBook, currentPageIndex]);

  // Previous and Next pages for 3-card carousel
  const prevPage: BookPage | null = useMemo(() => {
    if (!selectedBook || currentPageIndex <= 0) return null;
    return selectedBook.pages[currentPageIndex - 1];
  }, [selectedBook, currentPageIndex]);

  const nextPage: BookPage | null = useMemo(() => {
    if (!selectedBook || currentPageIndex >= selectedBook.pages.length - 1) return null;
    return selectedBook.pages[currentPageIndex + 1];
  }, [selectedBook, currentPageIndex]);

  // Keyboard navigation (ArrowLeft & ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSearchOpen || isZoomModalOpen) return;
      if (e.key === "ArrowRight") {
        // In Arabic/RTL, ArrowRight can move to previous or next depending on layout
        handleNextPage();
      } else if (e.key === "ArrowLeft") {
        handlePrevPage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPageIndex, selectedBook, isSearchOpen, isZoomModalOpen]);

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
      stopAudio();
    }
  };

  const handleNextPage = () => {
    if (selectedBook && currentPageIndex < selectedBook.pages.length - 1) {
      setCurrentPageIndex((prev) => prev + 1);
      stopAudio();
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlayingAudio(false);
  };

  // Play audio track
  const handlePlayMedia = (media: BookPageMedia) => {
    if (activePlayingMediaId === media.id && isPlayingAudio) {
      audioRef.current?.pause();
      setIsPlayingAudio(false);
      return;
    }

    setActivePlayingMediaId(media.id);

    // If media has a real resolved URL, play it
    if (media.url) {
      if (audioRef.current) {
        audioRef.current.src = media.url;
        audioRef.current.play().catch((err) => console.error(err));
        setIsPlayingAudio(true);
      }
    } else {
      // Simulate real tone / speech synthesizer for demo tracks
      simulateEducationalAudio(media.title);
    }
  };

  // Web Audio educational speech synthesis fallback for demo media
  const simulateEducationalAudio = (title: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const cleanTitle = title.replace(/^\d+\/\d+\s*[-–]\s*/, "");
      const utterance = new SpeechSynthesisUtterance(cleanTitle + ". Lektion sieben. Hören Sie und sprechen Sie nach.");
      utterance.lang = "de-DE";
      utterance.rate = 0.9;
      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsPlayingAudio(true);
      setTimeout(() => setIsPlayingAudio(false), 3000);
    }
  };

  // Open track in full Media Player Workspace
  const handleOpenInStudioPlayer = (media: BookPageMedia) => {
    if (onPlayMediaInStudio) {
      onPlayMediaInStudio({
        id: `book-media-${media.id}`,
        title: media.title,
        type: media.type,
        url: media.url || "",
        originalName: media.fileName,
        size: 1024 * 1024 * 2,
        uploadedAt: new Date().toISOString()
      });
    }
  };

  // ZIP File Handler
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus("جاري فك ضغط ملف الكتاب وقراءة البيانات...");

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);

      // Find content.json or book.json
      let jsonFile: JSZip.JSZipObject | null = null;
      let bookMetaFile: JSZip.JSZipObject | null = null;

      contents.forEach((relativePath, zipEntry) => {
        if (relativePath.toLowerCase().endsWith("content.json")) {
          jsonFile = zipEntry;
        } else if (relativePath.toLowerCase().endsWith("book.json")) {
          bookMetaFile = zipEntry;
        }
      });

      let rawContentData: any = null;
      let rawBookMetaData: any = null;

      if (jsonFile) {
        const text = await (jsonFile as JSZip.JSZipObject).async("text");
        rawContentData = JSON.parse(text);
      }

      if (bookMetaFile) {
        const metaText = await (bookMetaFile as JSZip.JSZipObject).async("text");
        rawBookMetaData = JSON.parse(metaText);
      }

      const bookTitle = rawBookMetaData?.title || rawContentData?.book_title || file.name.replace(/\.[^/.]+$/, "");

      // Collect image Blobs from pages/
      setImportStatus("جاري معالجة صور الصفحات والوسائط...");
      const pageImagesMap = new Map<string, string>();
      const mediaFilesMap = new Map<string, string>();

      const entries = Object.keys(contents.files);
      for (const entryPath of entries) {
        const entry = contents.files[entryPath];
        if (entry.dir) continue;

        const lower = entryPath.toLowerCase();
        const baseName = entryPath.split("/").pop() || "";

        if (lower.match(/\.(jpg|jpeg|png|webp)$/)) {
          const blob = await entry.async("blob");
          const url = URL.createObjectURL(blob);
          pageImagesMap.set(baseName, url);
        } else if (lower.match(/\.(mp3|wav|ogg|m4a|mp4|webm)$/)) {
          const blob = await entry.async("blob");
          const url = URL.createObjectURL(blob);
          mediaFilesMap.set(baseName, url);
        }
      }

      // Build pages
      const pages: BookPage[] = [];

      if (rawContentData && Array.isArray(rawContentData.pages)) {
        rawContentData.pages.forEach((p: any, idx: number) => {
          const pageImgName = p.page_img || p.image || "";
          const resolvedImg = pageImagesMap.get(pageImgName) || "/assets/aistudio/image_629fa44a.png";

          const mediaList: BookPageMedia[] = [];
          if (Array.isArray(p.media)) {
            p.media.forEach((m: any, mIdx: number) => {
              const fileName = m.file_name || m.fileName || "";
              const mediaUrl = mediaFilesMap.get(fileName);
              mediaList.push({
                id: `m-${p.page || idx}-${mIdx}`,
                trackNumber: m.track_number || m.trackNumber || `${idx + 1}/${mIdx + 1}`,
                title: m.title || m.label || `${m.type === "video" ? "Video" : "Audio"}: ${fileName}`,
                type: m.type === "video" ? "video" : "audio",
                fileName,
                url: mediaUrl
              });
            });
          }

          pages.push({
            pageNumber: p.page || idx + 1,
            displayLabel: p.label || String(p.page || idx + 1),
            pageImage: resolvedImg,
            media: mediaList
          });
        });
      } else {
        // Fallback: organize detected images into pages
        const sortedImages = Array.from(pageImagesMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        sortedImages.forEach(([name, url], idx) => {
          pages.push({
            pageNumber: idx + 1,
            displayLabel: String(idx + 1),
            pageImage: url,
            media: []
          });
        });
      }

      if (pages.length === 0) {
        throw new Error("لم يتم العثور على صفحات داخل الملف المضغوط");
      }

      const newBook: InteractiveBook = {
        id: `book-${Date.now()}`,
        title: bookTitle,
        totalPages: pages.length,
        createdAt: new Date().toISOString(),
        pages
      };

      await saveBookToDB(newBook);
      setBooks((prev) => [newBook, ...prev]);
      setSelectedBook(newBook);
      setCurrentPageIndex(0);
      setImportStatus("");
      setIsImporting(false);
    } catch (err: any) {
      console.error(err);
      setImportStatus(`خطأ في استيراد الكتاب: ${err.message || "الملف غير صالح"}`);
      setTimeout(() => {
        setIsImporting(false);
        setImportStatus("");
      }, 4000);
    }
  };

  // Folder Upload Handler
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    setImportStatus("جاري قراءة ملفات المجلد المحلي...");

    try {
      let jsonFile: File | null = null;
      const pageImagesMap = new Map<string, string>();
      const mediaFilesMap = new Map<string, string>();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const lower = file.name.toLowerCase();
        if (lower.endsWith("content.json")) {
          jsonFile = file;
        } else if (lower.match(/\.(jpg|jpeg|png|webp)$/)) {
          pageImagesMap.set(file.name, URL.createObjectURL(file));
        } else if (lower.match(/\.(mp3|wav|ogg|m4a|mp4|webm)$/)) {
          mediaFilesMap.set(file.name, URL.createObjectURL(file));
        }
      }

      let rawContentData: any = null;
      if (jsonFile) {
        const text = await (jsonFile as File).text();
        rawContentData = JSON.parse(text);
      }

      const folderName = files[0].webkitRelativePath?.split("/")[0] || "كتاب رقمي جديد";
      const pages: BookPage[] = [];

      if (rawContentData && Array.isArray(rawContentData.pages)) {
        rawContentData.pages.forEach((p: any, idx: number) => {
          const pageImgName = p.page_img || p.image || "";
          const resolvedImg = pageImagesMap.get(pageImgName) || "/assets/aistudio/image_629fa44a.png";

          const mediaList: BookPageMedia[] = [];
          if (Array.isArray(p.media)) {
            p.media.forEach((m: any, mIdx: number) => {
              const fileName = m.file_name || m.fileName || "";
              const mediaUrl = mediaFilesMap.get(fileName);
              mediaList.push({
                id: `m-${p.page || idx}-${mIdx}`,
                trackNumber: m.track_number || m.trackNumber || `${idx + 1}/${mIdx + 1}`,
                title: m.title || m.label || `${m.type === "video" ? "Video" : "Audio"}: ${fileName}`,
                type: m.type === "video" ? "video" : "audio",
                fileName,
                url: mediaUrl
              });
            });
          }

          pages.push({
            pageNumber: p.page || idx + 1,
            displayLabel: p.label || String(p.page || idx + 1),
            pageImage: resolvedImg,
            media: mediaList
          });
        });
      } else {
        const sortedImages = Array.from(pageImagesMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        sortedImages.forEach(([name, url], idx) => {
          pages.push({
            pageNumber: idx + 1,
            displayLabel: String(idx + 1),
            pageImage: url,
            media: []
          });
        });
      }

      const newBook: InteractiveBook = {
        id: `book-${Date.now()}`,
        title: folderName,
        totalPages: pages.length,
        createdAt: new Date().toISOString(),
        pages
      };

      await saveBookToDB(newBook);
      setBooks((prev) => [newBook, ...prev]);
      setSelectedBook(newBook);
      setCurrentPageIndex(0);
      setIsImporting(false);
      setImportStatus("");
    } catch (err: any) {
      console.error(err);
      setImportStatus(`خطأ في معالجة المجلد: ${err.message || "الملفات غير صالحة"}`);
      setTimeout(() => {
        setIsImporting(false);
        setImportStatus("");
      }, 4000);
    }
  };

  const handleDeleteBook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("هل أنت متأكد من حذف هذا الكتاب من التطبيق؟")) return;
    try {
      await deleteBookFromDB(id);
      const remaining = books.filter((b) => b.id !== id);
      setBooks(remaining);
      if (selectedBook?.id === id) {
        setSelectedBook(remaining[0] || null);
        setCurrentPageIndex(0);
      }
    } catch (err) {
      console.error("Failed to delete book:", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white select-none overflow-hidden min-h-[600px] font-sans" dir="ltr">
      {/* Hidden Audio Player Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setAudioCurrentTime((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={(e) => setAudioDuration((e.target as HTMLAudioElement).duration)}
        onEnded={() => setIsPlayingAudio(false)}
      />

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={zipInputRef}
        onChange={handleZipUpload}
        accept=".zip,application/zip"
        className="hidden"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderUpload}
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        className="hidden"
      />

      {/* ======================================================== */}
      {/* 1. TOP APP BAR (Matching Image: Left Arrow, Book, Search) */}
      {/* ======================================================== */}
      <header className="h-14 border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 bg-white shrink-0 z-10 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (onBackToMediaExplorer) {
                onBackToMediaExplorer();
              }
            }}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-800 transition-colors cursor-pointer"
            title="العودة لمستعرض الوسائط"
          >
            <ArrowLeft className="w-5 h-5 text-slate-900" />
          </button>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">Book</h1>
        </div>

        {/* Right Action Icons: Search & Books Shelf Switcher */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isSearchOpen ? "bg-blue-50 text-[#0056f6]" : "hover:bg-slate-100 text-slate-800"
            }`}
            title="البحث أو الانتقال لرقم صفحة"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Import New Book Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => zipInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0056f6] hover:bg-[#0047d1] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ml-1"
              title="استيراد كتاب مضغوط ZIP"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">استيراد كتاب ZIP</span>
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* SEARCH / PAGE JUMP BAR (COLLAPSIBLE)                     */}
      {/* ======================================================== */}
      {isSearchOpen && (
        <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="number"
              placeholder="انتقل مباشرة إلى رقم الصفحة (مثال: 175)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim() && selectedBook) {
                  const targetNum = parseInt(searchQuery.trim(), 10);
                  const idx = selectedBook.pages.findIndex((p) => p.pageNumber === targetNum);
                  if (idx >= 0) {
                    setCurrentPageIndex(idx);
                    setIsSearchOpen(false);
                    setSearchQuery("");
                  }
                }
              }}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-800 w-full focus:outline-hidden focus:border-[#0056f6]"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Switcher if multiple books exist */}
            {books.length > 1 && (
              <select
                value={selectedBook?.id || ""}
                onChange={(e) => {
                  const b = books.find((x) => x.id === e.target.value);
                  if (b) {
                    setSelectedBook(b);
                    setCurrentPageIndex(0);
                  }
                }}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700"
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => setIsSearchOpen(false)}
              className="p-1 hover:bg-slate-200 text-slate-500 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Loading & Import Status Notification */}
      {isImporting && (
        <div className="bg-blue-600 text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-sm animate-pulse">
          <Sparkles className="w-4 h-4 animate-spin" />
          <span>{importStatus || "جاري الاستيراد..."}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MAIN BOOK VIEWER STAGE                                */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto pt-3 pb-8 px-2 sm:px-6">
        {selectedBook ? (
          <div className="w-full max-w-4xl flex flex-col items-center">
            {/* Book Title (Matching Image: Centered subtitle above pages) */}
            <h2 className="text-sm sm:text-base font-bold text-slate-800 text-center mb-3 tracking-tight">
              {selectedBook.title}
            </h2>

            {/* ======================================================== */}
            {/* 3-CARD HORIZONTAL PAGE CAROUSEL (Exact Screenshot layout)*/}
            {/* ======================================================== */}
            <div className="w-full relative flex items-center justify-center gap-2 sm:gap-4 md:gap-6 py-2 overflow-hidden select-none">
              {/* Previous Page Card (Left) */}
              <div
                onClick={handlePrevPage}
                className={`w-28 sm:w-44 md:w-56 aspect-[3/4] bg-white rounded-lg border border-slate-200/80 shadow-xs flex flex-col items-center justify-center cursor-pointer transition-all duration-300 opacity-60 hover:opacity-85 transform hover:scale-[1.02] shrink-0 overflow-hidden relative ${
                  !prevPage ? "invisible" : ""
                }`}
                title={prevPage ? `الانتقال للصفحة ${prevPage.pageNumber}` : ""}
              >
                {prevPage && (
                  <img
                    src={prevPage.pageImage}
                    alt={`Page ${prevPage.pageNumber}`}
                    className="w-full h-full object-cover pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute inset-0 bg-white/10" />
              </div>

              {/* ACTIVE CENTER PAGE (Exact design with red accent bar & drop shadow) */}
              <div
                onClick={() => setIsZoomModalOpen(true)}
                className="w-48 sm:w-64 md:w-80 aspect-[3/4] bg-white rounded-lg border border-slate-200 shadow-xl flex flex-col items-center justify-center cursor-zoom-in transition-all duration-300 transform scale-100 hover:shadow-2xl shrink-0 overflow-hidden relative group"
                title="انقر لتكبير الصفحة وعرضها بحجم كامل"
              >
                {/* Book Header Bar Accent (Red accent indicator like German textbooks) */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-red-500 to-rose-400" />

                {activePage ? (
                  <img
                    src={activePage.pageImage}
                    alt={`Page ${activePage.pageNumber}`}
                    className="w-full h-full object-contain pointer-events-none bg-white p-1"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-300 p-4">
                    <BookOpen className="w-12 h-12" />
                    <span className="text-xs font-bold mt-2">لا توجد صورة</span>
                  </div>
                )}

                {/* Hover Zoom Icon Badge */}
                <div className="absolute top-3 right-3 p-1.5 bg-black/60 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none backdrop-blur-xs">
                  <Maximize2 className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Next Page Card (Right) */}
              <div
                onClick={handleNextPage}
                className={`w-28 sm:w-44 md:w-56 aspect-[3/4] bg-white rounded-lg border border-slate-200/80 shadow-xs flex flex-col items-center justify-center cursor-pointer transition-all duration-300 opacity-60 hover:opacity-85 transform hover:scale-[1.02] shrink-0 overflow-hidden relative ${
                  !nextPage ? "invisible" : ""
                }`}
                title={nextPage ? `الانتقال للصفحة ${nextPage.pageNumber}` : ""}
              >
                {nextPage && (
                  <img
                    src={nextPage.pageImage}
                    alt={`Page ${nextPage.pageNumber}`}
                    className="w-full h-full object-cover pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute inset-0 bg-white/10" />
              </div>
            </div>

            {/* ======================================================== */}
            {/* PAGE NUMBER INDICATOR (Matching Screenshot: 175)         */}
            {/* ======================================================== */}
            <div className="flex items-center justify-center gap-4 my-3 text-slate-400">
              <button
                onClick={handlePrevPage}
                disabled={!prevPage}
                className="p-1.5 rounded-full hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-slate-600 transition-colors"
                title="الصفحة السابقة"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <span className="text-sm font-semibold text-slate-500 font-mono tracking-wider min-w-[3rem] text-center">
                {activePage?.pageNumber || currentPageIndex + 1}
              </span>

              <button
                onClick={handleNextPage}
                disabled={!nextPage}
                className="p-1.5 rounded-full hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-slate-600 transition-colors"
                title="الصفحة التالية"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* ======================================================== */}
            {/* PAGE MEDIA TRACKS LIST (Exact Screenshot rows with ▶)     */}
            {/* ======================================================== */}
            <div className="w-full border-t border-slate-200 mt-2">
              {activePage?.media && activePage.media.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {activePage.media.map((media) => {
                    const isCurrentPlaying = activePlayingMediaId === media.id && isPlayingAudio;

                    return (
                      <div
                        key={media.id}
                        className={`py-3 px-2 sm:px-4 flex items-center justify-between transition-colors ${
                          isCurrentPlaying ? "bg-blue-50/70" : "hover:bg-slate-50"
                        }`}
                      >
                        {/* Track Info (Title and Audio/Video Subtitle) */}
                        <div className="min-w-0 flex-1 pr-4">
                          <h3
                            className={`text-sm sm:text-base font-semibold truncate ${
                              isCurrentPlaying ? "text-[#0056f6]" : "text-slate-900"
                            }`}
                          >
                            {media.title}
                          </h3>
                          <p className="text-xs text-slate-400 font-medium capitalize mt-0.5">
                            {media.type === "video" ? "Video" : "Audio"}
                          </p>
                        </div>

                        {/* Right Actions: Play Triangle & Open in Studio */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Quick Studio Player Open */}
                          {onPlayMediaInStudio && (
                            <button
                              onClick={() => handleOpenInStudioPlayer(media)}
                              className="p-2 hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
                              title="تشغيل في استوديو المشغل المتقدم"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}

                          {/* Solid Blue Play Button (Matching Screenshot ▶) */}
                          <button
                            onClick={() => handlePlayMedia(media)}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-[#0056f6] hover:bg-blue-100/60 transition-all cursor-pointer active:scale-95"
                            title={isCurrentPlaying ? "إيقاف مؤقت" : "تشغيل المقطع الصوتي"}
                          >
                            {isCurrentPlaying ? (
                              <Pause className="w-5 h-5 fill-current" />
                            ) : (
                              <Play className="w-5 h-5 fill-current translate-x-0.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <span>لا توجد مقاطع وسائط مرتبطة بهذه الصفحة</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Empty Book State */
          <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400">
            <BookOpen className="w-16 h-16 text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-700">لا يوجد كتاب محدد</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              قم باستيراد ملف ZIP أو مجلد يحتوي على هيكل الكتاب الرقمي لتصفحه هنا
            </p>
            <button
              onClick={() => zipInputRef.current?.click()}
              className="mt-4 px-4 py-2 bg-[#0056f6] text-white rounded-xl text-xs font-bold hover:bg-[#0047d1] cursor-pointer shadow-xs"
            >
              استيراد كتاب الآن
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 4. LIGHTBOX / ZOOM MODAL FOR ACTIVE PAGE                  */}
      {/* ======================================================== */}
      {isZoomModalOpen && activePage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-between p-4 animate-fadeIn"
          onClick={() => setIsZoomModalOpen(false)}
        >
          {/* Zoom Modal Toolbar */}
          <div
            className="w-full max-w-3xl flex items-center justify-between text-white pb-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-white/20 px-2.5 py-1 rounded-md">
                صفحة {activePage.pageNumber}
              </span>
              <span className="text-xs text-slate-300 hidden sm:inline">{selectedBook?.title}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.2))}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white cursor-pointer"
                title="تصغير"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold w-12 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white cursor-pointer"
                title="تكبير"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white cursor-pointer text-xs font-bold"
                title="إعادة التعيين"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsZoomModalOpen(false)}
                className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer ml-2"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* High-res Image Container */}
          <div
            className="flex-1 flex items-center justify-center overflow-auto w-full p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activePage.pageImage}
              alt={`Page ${activePage.pageNumber}`}
              style={{ transform: `scale(${zoomLevel})` }}
              className="max-h-[85vh] max-w-[95vw] object-contain rounded-md shadow-2xl transition-transform duration-150"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Page Switcher in Lightbox */}
          <div
            className="flex items-center gap-4 text-white pt-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handlePrevPage}
              disabled={!prevPage}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-lg text-xs font-bold cursor-pointer"
            >
              الصفحة السابقة
            </button>
            <span className="text-xs font-mono">
              {currentPageIndex + 1} من {selectedBook?.totalPages || selectedBook?.pages.length}
            </span>
            <button
              onClick={handleNextPage}
              disabled={!nextPage}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-lg text-xs font-bold cursor-pointer"
            >
              الصفحة التالية
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

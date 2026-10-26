import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Search,
  Play,
  Pause,
  Video as VideoIcon,
  Pencil,
  Info,
  X,
  Volume2,
  ChevronLeft,
  Loader2
} from "lucide-react";
import { InteractiveBook, BookPage, BookPageMedia, MediaFile } from "../types";

interface BookReaderWorkspaceProps {
  onPlayMediaInStudio?: (file: Partial<MediaFile>) => void;
  onBackToMediaExplorer?: () => void;
}

export const BookReaderWorkspace: React.FC<BookReaderWorkspaceProps> = ({
  onPlayMediaInStudio,
  onBackToMediaExplorer
}) => {
  // Navigation View: "shelf" (My Books - Image 1) vs "reader" (Book reader - Image 2)
  const [viewMode, setViewMode] = useState<"shelf" | "reader">("shelf");

  // Books State (Fetched from Server)
  const [books, setBooks] = useState<InteractiveBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<InteractiveBook | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isLoadingBooks, setIsLoadingBooks] = useState<boolean>(true);
  const [isUploadingZip, setIsUploadingZip] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<string>("");

  // Search State in Reader
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchPageInput, setSearchPageInput] = useState<string>("");

  // Info Modal for Book Shelf
  const [infoBook, setInfoBook] = useState<InteractiveBook | null>(null);

  // Audio Playback State
  const [activeAudioMedia, setActiveAudioMedia] = useState<BookPageMedia | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Video Modal State
  const [activeVideoMedia, setActiveVideoMedia] = useState<BookPageMedia | null>(null);

  // ZIP File Input
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Fetch books from server on mount
  const fetchBooksFromServer = async () => {
    try {
      setIsLoadingBooks(true);
      const res = await fetch("/api/books");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.books)) {
          setBooks(data.books);
          if (data.books.length > 0 && !selectedBook) {
            setSelectedBook(data.books[0]);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch books from server:", e);
    } finally {
      setIsLoadingBooks(false);
    }
  };

  useEffect(() => {
    fetchBooksFromServer();
  }, []);

  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Handle ZIP file upload to server with real upload progress tracking
  const handleZipFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingZip(true);
    setUploadProgress(0);
    setUploadMessage("جاري بدء رفع الملف إلى السيرفر...");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/books/upload-zip");

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
        if (percent < 100) {
          setUploadMessage(`جاري رفع الملف إلى السيرفر: ${percent}%`);
        } else {
          setUploadMessage("اكتمل الرفع، جاري فك الضغط وتجهيز صفحات وصوتيات الكتاب على السيرفر...");
        }
      }
    };

    xhr.onload = async () => {
      setIsUploadingZip(false);
      setUploadProgress(0);
      setUploadMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      let responseJson: any = null;
      try {
        if (xhr.responseText) {
          responseJson = JSON.parse(xhr.responseText);
        }
      } catch (jsonErr) {
        console.warn("Could not parse response as JSON:", xhr.responseText);
      }

      if (xhr.status >= 200 && xhr.status < 300 && responseJson?.book) {
        await fetchBooksFromServer();
        setSelectedBook(responseJson.book);
        setCurrentPageIndex(0);
        setViewMode("reader");
      } else {
        const errorText =
          responseJson?.error ||
          xhr.responseText ||
          `فشل رفع واستخراج الكتاب (رمز السيرفر: ${xhr.status})`;
        console.error("ZIP Upload failed:", errorText);
        setErrorMessage(errorText);
      }
    };

    xhr.onerror = () => {
      setIsUploadingZip(false);
      setUploadProgress(0);
      setUploadMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setErrorMessage("حدث خطأ في الاتصال بالسيرفر أثناء رفع الملف المضغوط");
    };

    xhr.send(formData);
  };

  // Open a specific book
  const handleOpenBook = (book: InteractiveBook) => {
    setSelectedBook(book);
    // If book is A1.1, jump to page 186 (index 185) like in the screenshot, or first page
    if (book.id === "miteinander-a1-1" && book.pages.length >= 186) {
      setCurrentPageIndex(185);
    } else {
      // Find first page with media or page 0
      const firstWithMedia = book.pages.findIndex((p) => p.media && p.media.length > 0);
      setCurrentPageIndex(firstWithMedia >= 0 ? firstWithMedia : 0);
    }
    setViewMode("reader");
  };

  // Active, Prev, Next pages for 3-card carousel
  const activePage: BookPage | null = useMemo(() => {
    if (!selectedBook || !selectedBook.pages || selectedBook.pages.length === 0) return null;
    return selectedBook.pages[currentPageIndex] || selectedBook.pages[0];
  }, [selectedBook, currentPageIndex]);

  const prevPage: BookPage | null = useMemo(() => {
    if (!selectedBook || currentPageIndex <= 0) return null;
    return selectedBook.pages[currentPageIndex - 1];
  }, [selectedBook, currentPageIndex]);

  const nextPage: BookPage | null = useMemo(() => {
    if (!selectedBook || currentPageIndex >= selectedBook.pages.length - 1) return null;
    return selectedBook.pages[currentPageIndex + 1];
  }, [selectedBook, currentPageIndex]);

  // Page navigation
  const goToNextPage = () => {
    if (selectedBook && currentPageIndex < selectedBook.pages.length - 1) {
      setCurrentPageIndex((prev) => prev + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  // Jump to specific page
  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook) return;
    const targetNum = parseInt(searchPageInput.trim(), 10);
    if (!isNaN(targetNum)) {
      const idx = selectedBook.pages.findIndex((p) => p.pageNumber === targetNum);
      if (idx >= 0) {
        setCurrentPageIndex(idx);
        setIsSearchOpen(false);
        setSearchPageInput("");
        return;
      }
    }
    alert(`الصفحة ${searchPageInput} غير موجودة في هذا الكتاب`);
  };

  // Audio Playback
  const handlePlayAudio = (media: BookPageMedia) => {
    if (activeAudioMedia?.id === media.id) {
      if (isPlayingAudio) {
        audioRef.current?.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current?.play();
        setIsPlayingAudio(true);
      }
      return;
    }

    setActiveAudioMedia(media);
    setIsPlayingAudio(true);
  };

  useEffect(() => {
    if (activeAudioMedia && audioRef.current) {
      const streamUrl = activeAudioMedia.url || `/api/media/stream/${encodeURIComponent(activeAudioMedia.fileName)}`;
      audioRef.current.src = streamUrl;
      audioRef.current.play().catch((err) => {
        console.warn("Audio autoplay blocked or failed:", err);
      });
      setIsPlayingAudio(true);
    }
  }, [activeAudioMedia]);

  // Keyboard navigation
  useEffect(() => {
    if (viewMode !== "reader") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goToPrevPage();
      } else if (e.key === "ArrowRight") {
        goToNextPage();
      } else if (e.key === "Escape") {
        if (activeVideoMedia) setActiveVideoMedia(null);
        else if (isSearchOpen) setIsSearchOpen(false);
        else setViewMode("shelf");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, currentPageIndex, selectedBook, activeVideoMedia, isSearchOpen]);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // =========================================================================
  // SCREEN 1: "My Books" (Exact replica of Image 1 / image_2553d493.png)
  // =========================================================================
  if (viewMode === "shelf") {
    return (
      <div className="w-full min-h-screen bg-white text-gray-900 font-sans select-none pb-16">
        {/* Top Header */}
        <header className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0 z-10">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Books</h1>
          <button
            type="button"
            className="p-1.5 text-gray-800 hover:text-black transition"
            title="Edit Books"
          >
            <Pencil className="w-6 h-6 stroke-[2]" />
          </button>
        </header>

        {/* Hidden File Input for ZIP Upload */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleZipFileSelected}
          accept=".zip,application/zip"
          className="hidden"
        />

        {/* Error Banner if any */}
        {errorMessage && (
          <div className="mx-5 my-3 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center justify-between">
            <span className="pr-2">{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              className="p-1 text-red-400 hover:text-red-700 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Add Book Row */}
        <div
          onClick={() => !isUploadingZip && fileInputRef.current?.click()}
          className={`w-full px-5 py-5 flex items-center gap-5 border-b border-gray-100 transition ${
            isUploadingZip ? "cursor-wait bg-blue-50/20" : "cursor-pointer hover:bg-gray-50/70"
          }`}
        >
          {/* Blue Viewfinder Card */}
          <div className="w-32 h-32 rounded-2xl bg-[#007aff] flex items-center justify-center text-white shadow-sm flex-shrink-0">
            {isUploadingZip ? (
              <div className="flex flex-col items-center gap-1">
                <Loader2 className="w-10 h-10 animate-spin text-white" />
                <span className="text-xs font-semibold text-white">{uploadProgress}%</span>
              </div>
            ) : (
              <svg
                className="w-14 h-14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* 4 Viewfinder Corners */}
                <path d="M4 8V5a1 1 0 0 1 1-1h3" />
                <path d="M16 4h3a1 1 0 0 1 1 1v3" />
                <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
                <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
                {/* Plus in Center */}
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            )}
          </div>

          <div className="flex flex-col flex-1 min-w-0 pr-4">
            <span className="text-[#007aff] font-semibold text-lg">Add Book</span>
            {isUploadingZip ? (
              <div className="mt-2 max-w-xs">
                <div className="w-full bg-blue-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#007aff] h-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 mt-1.5 block truncate">{uploadMessage}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-400 mt-0.5">رفع واستخراج ملف كتاب مضغوط (ZIP)</span>
            )}
          </div>
        </div>

        {/* Books List */}
        <div className="w-full divide-y divide-gray-100">
          {isLoadingBooks ? (
            <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-sm">جاري تحميل الكتب من السيرفر...</span>
            </div>
          ) : (
            books.map((book) => (
              <div
                key={book.id}
                onClick={() => handleOpenBook(book)}
                className="w-full px-5 py-3.5 flex items-center cursor-pointer hover:bg-gray-50/70 transition"
              >
                {/* Cover Thumbnail */}
                <div className="w-20 h-28 bg-gray-100 rounded overflow-hidden flex-shrink-0 shadow-sm border border-gray-100 flex items-center justify-center">
                  <img
                    src={book.coverImage || "/assets/aistudio/cover_a1_1.png"}
                    alt={book.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/assets/aistudio/cover_a1_1.png";
                    }}
                  />
                </div>

                {/* Details */}
                <div className="flex-1 ml-4 pr-2 min-w-0">
                  <h2 className="text-base font-bold text-gray-900 leading-snug truncate">
                    {book.title}
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5 truncate">
                    {book.subtitle || "Kurs- und Arbeitsbuch"}
                  </p>
                </div>

                {/* Right Column: Chevron & Info */}
                <div className="flex flex-col items-end justify-between h-24 flex-shrink-0 pl-2">
                  <ChevronRight className="w-6 h-6 text-gray-300 stroke-[1.5]" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInfoBook(book);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 transition"
                    title="معلومات الكتاب"
                  >
                    <Info className="w-5 h-5 stroke-[1.75]" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info Modal */}
        {infoBook && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-900">{infoBook.title}</h3>
                <button
                  type="button"
                  onClick={() => setInfoBook(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <p>
                  <strong className="text-gray-800">الناشر:</strong> {infoBook.author || "Hueber Verlag"}
                </p>
                <p>
                  <strong className="text-gray-800">العنوان الفرعي:</strong>{" "}
                  {infoBook.subtitle || "Kurs- und Arbeitsbuch"}
                </p>
                <p>
                  <strong className="text-gray-800">إجمالي الصفحات:</strong>{" "}
                  {infoBook.totalPages || infoBook.pages?.length || 0}
                </p>
                <p>
                  <strong className="text-gray-800">مكان الحفظ:</strong> سيرفر النظام (Express Server)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const b = infoBook;
                  setInfoBook(null);
                  handleOpenBook(b);
                }}
                className="w-full mt-6 py-2.5 bg-[#007aff] text-white rounded-xl font-medium hover:bg-blue-600 transition"
              >
                فتح الكتاب
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // SCREEN 2: "Book" Reader (Exact replica of Image 2 / image_9ed8165c.png)
  // =========================================================================
  const currentPageMedia: BookPageMedia[] = activePage?.media || [];

  return (
    <div className="w-full min-h-screen bg-white text-gray-900 font-sans select-none flex flex-col pb-24">
      {/* Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setAudioCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setAudioDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => setIsPlayingAudio(false)}
      />

      {/* Top Header */}
      <header className="w-full px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0 z-20">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.pause();
                setIsPlayingAudio(false);
              }
              setViewMode("shelf");
            }}
            className="p-1.5 -ml-1.5 text-gray-900 hover:text-black transition"
            title="Back to My Books"
          >
            <ArrowLeft className="w-6 h-6 stroke-[2]" />
          </button>
          <span className="text-xl font-bold text-gray-900 ml-2">Book</span>
        </div>

        <button
          type="button"
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          className="p-1.5 text-gray-900 hover:text-black transition"
          title="Search / Jump to Page"
        >
          <Search className="w-6 h-6 stroke-[2]" />
        </button>
      </header>

      {/* Search Input Bar (Expandable) */}
      {isSearchOpen && (
        <form
          onSubmit={handleJumpToPage}
          className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2"
        >
          <input
            type="number"
            min={1}
            max={selectedBook?.totalPages || 250}
            value={searchPageInput}
            onChange={(e) => setSearchPageInput(e.target.value)}
            placeholder="أدخل رقم الصفحة (مثلاً: 186)..."
            className="flex-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <button
            type="submit"
            className="px-4 py-1.5 bg-[#007aff] text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition"
          >
            انتقال
          </button>
          <button
            type="button"
            onClick={() => setIsSearchOpen(false)}
            className="p-1.5 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </form>
      )}

      {/* Book Title Centered */}
      <div className="w-full text-center py-3">
        <h2 className="text-base font-normal text-gray-800 tracking-tight">
          {selectedBook?.title || "Miteinander! A1.1 KB+AB"}
        </h2>
      </div>

      {/* 3-Card Carousel */}
      <div className="w-full flex items-center justify-center overflow-hidden py-2 px-2 relative min-h-[300px]">
        {/* Previous Page Card (Faded on Left) */}
        <div
          onClick={goToPrevPage}
          className={`w-1/3 max-w-[210px] aspect-[3/4] bg-white rounded-sm shadow border border-gray-100 flex items-center justify-center overflow-hidden cursor-pointer transform scale-[0.88] opacity-80 hover:opacity-100 transition-all duration-200 -mr-4 ${
            !prevPage ? "invisible" : ""
          }`}
          title={prevPage ? `الصفحة السابقة ${prevPage.pageNumber}` : ""}
        >
          {prevPage && (
            <img
              src={prevPage.pageImage || "/assets/aistudio/image_629fa44a.png"}
              alt={`Page ${prevPage.pageNumber}`}
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/aistudio/image_629fa44a.png";
              }}
            />
          )}
        </div>

        {/* Center Active Page Card */}
        <div className="w-1/2 max-w-[280px] sm:max-w-[320px] aspect-[3/4] bg-white rounded-sm shadow-md border border-gray-200 z-10 flex items-center justify-center overflow-hidden transition-all duration-200">
          {activePage ? (
            <img
              src={activePage.pageImage || "/assets/aistudio/image_629fa44a.png"}
              alt={`Page ${activePage.pageNumber}`}
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/aistudio/image_629fa44a.png";
              }}
            />
          ) : (
            <div className="text-gray-300 text-sm">جاري التحميل...</div>
          )}
        </div>

        {/* Next Page Card (Faded on Right) */}
        <div
          onClick={goToNextPage}
          className={`w-1/3 max-w-[210px] aspect-[3/4] bg-white rounded-sm shadow border border-gray-100 flex items-center justify-center overflow-hidden cursor-pointer transform scale-[0.88] opacity-80 hover:opacity-100 transition-all duration-200 -ml-4 ${
            !nextPage ? "invisible" : ""
          }`}
          title={nextPage ? `الصفحة التالية ${nextPage.pageNumber}` : ""}
        >
          {nextPage && (
            <img
              src={nextPage.pageImage || "/assets/aistudio/image_629fa44a.png"}
              alt={`Page ${nextPage.pageNumber}`}
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/aistudio/image_629fa44a.png";
              }}
            />
          )}
        </div>

        {/* Left / Right Chevron Click Helpers for Mobile & Desktop */}
        {prevPage && (
          <button
            type="button"
            onClick={goToPrevPage}
            className="absolute left-2 p-2 rounded-full bg-white/80 shadow text-gray-700 hover:bg-white z-20"
            title="الصفحة السابقة"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {nextPage && (
          <button
            type="button"
            onClick={goToNextPage}
            className="absolute right-2 p-2 rounded-full bg-white/80 shadow text-gray-700 hover:bg-white z-20"
            title="الصفحة التالية"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Page Number Indicator */}
      <div className="w-full text-center py-2">
        <span className="text-gray-400 text-sm font-normal">
          {activePage?.pageNumber || currentPageIndex + 1}
        </span>
      </div>

      {/* Divider */}
      <div className="w-full border-t border-gray-200 mt-1" />

      {/* Media Rows Exclusively for this Page */}
      <div className="w-full divide-y divide-gray-100 flex-1">
        {currentPageMedia.length === 0 ? (
          <div className="py-12 text-center text-gray-300 text-sm">
            لا توجد تسجيلات صوتية أو فيديو حصرية لهذه الصفحة
          </div>
        ) : (
          currentPageMedia.map((m) => {
            const isThisAudioPlaying = isPlayingAudio && activeAudioMedia?.id === m.id;

            return (
              <div
                key={m.id}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/60 transition"
              >
                {/* Media Details */}
                <div className="flex-1 pr-4 min-w-0">
                  <div className="text-base font-normal text-gray-900 leading-snug truncate">
                    {m.title}
                  </div>
                  <div className="text-sm text-gray-400 mt-0.5 capitalize">
                    {m.type === "video" ? "Video" : "Audio"}
                  </div>
                </div>

                {/* Right Action Button */}
                {m.type === "video" ? (
                  <button
                    type="button"
                    onClick={() => setActiveVideoMedia(m)}
                    className="p-1 text-[#007aff] hover:opacity-80 transition flex-shrink-0"
                    title="تشغيل الفيديو"
                  >
                    {/* Solid Blue Camera Icon matching screenshot */}
                    <div className="w-7 h-7 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-[#007aff] fill-[#007aff]"
                        viewBox="0 0 24 24"
                      >
                        <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" />
                        <rect x="3" y="6" width="12" height="12" rx="2" />
                      </svg>
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePlayAudio(m)}
                    className="p-1 text-[#007aff] hover:opacity-80 transition flex-shrink-0"
                    title={isThisAudioPlaying ? "إيقاف مؤقت" : "تشغيل الصوت"}
                  >
                    {/* Solid Blue Triangle Play Icon matching screenshot */}
                    <div className="w-7 h-7 flex items-center justify-center">
                      {isThisAudioPlaying ? (
                        <Pause className="w-5 h-5 text-[#007aff] fill-[#007aff]" />
                      ) : (
                        <svg
                          className="w-5 h-5 text-[#007aff] fill-[#007aff]"
                          viewBox="0 0 24 24"
                        >
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      )}
                    </div>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Bottom Audio Player Bar */}
      {activeAudioMedia && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg z-30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (isPlayingAudio) {
                  audioRef.current?.pause();
                  setIsPlayingAudio(false);
                } else {
                  audioRef.current?.play();
                  setIsPlayingAudio(true);
                }
              }}
              className="w-10 h-10 rounded-full bg-[#007aff] text-white flex items-center justify-center hover:bg-blue-600 transition flex-shrink-0 shadow-sm"
            >
              {isPlayingAudio ? (
                <Pause className="w-5 h-5 fill-white" />
              ) : (
                <Play className="w-5 h-5 fill-white ml-0.5" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {activeAudioMedia.title}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400 font-mono">
                  {formatTime(audioCurrentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={audioDuration || 100}
                  value={audioCurrentTime}
                  onChange={(e) => {
                    const time = parseFloat(e.target.value);
                    setAudioCurrentTime(time);
                    if (audioRef.current) audioRef.current.currentTime = time;
                  }}
                  className="flex-1 h-1.5 bg-gray-200 rounded-lg accent-[#007aff] cursor-pointer"
                />
                <span className="text-xs text-gray-400 font-mono">
                  {formatTime(audioDuration)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.pause();
                setIsPlayingAudio(false);
              }
              setActiveAudioMedia(null);
            }}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full flex-shrink-0"
            title="إغلاق المشغل"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Video Modal Player */}
      {activeVideoMedia && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-black rounded-2xl overflow-hidden max-w-2xl w-full shadow-2xl relative flex flex-col">
            {/* Modal Header */}
            <div className="p-4 bg-gray-900/90 flex items-center justify-between text-white border-b border-gray-800">
              <span className="font-medium text-sm truncate pr-2">
                {activeVideoMedia.title}
              </span>
              <button
                type="button"
                onClick={() => setActiveVideoMedia(null)}
                className="p-1 text-gray-400 hover:text-white rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player */}
            <div className="relative aspect-video bg-black flex items-center justify-center">
              <video
                src={activeVideoMedia.url || `/api/media/stream/${encodeURIComponent(activeVideoMedia.fileName)}`}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

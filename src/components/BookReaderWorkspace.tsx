import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  BookOpen,
  Upload,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Edit2,
  Search,
  Music,
  Film,
  Layers,
  Sparkles,
  ExternalLink,
  Check,
  X,
  AlertCircle,
  FileText,
  Clock,
  Radio
} from "lucide-react";
import { InteractiveBook, BookPage, BookPageMedia, MediaFile } from "../types";
import {
  fetchAllBooks,
  uploadBookArchive,
  deleteBookFromServer,
  updateBookMetadata
} from "../utils/bookStorage";

interface BookReaderWorkspaceProps {
  onPlayMediaInStudio?: (mediaInfo: Partial<MediaFile>) => void;
  onBackToMediaExplorer?: () => void;
}

export const BookReaderWorkspace: React.FC<BookReaderWorkspaceProps> = ({
  onPlayMediaInStudio,
  onBackToMediaExplorer
}) => {
  // Books library state
  const [books, setBooks] = useState<InteractiveBook[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBook, setSelectedBook] = useState<InteractiveBook | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Edit / Delete modal state
  const [editingBook, setEditingBook] = useState<InteractiveBook | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);

  // Reader state
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showMediaDrawer, setShowMediaDrawer] = useState<boolean>(true);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [pageFit, setPageFit] = useState<"contain" | "width">("contain");

  // Audio playback state
  const [currentMedia, setCurrentMedia] = useState<BookPageMedia | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load books on mount
  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const list = await fetchAllBooks();
      setBooks(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Filter books
  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim()) return books;
    const q = searchQuery.toLowerCase().trim();
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.subtitle && b.subtitle.toLowerCase().includes(q)) ||
        (b.author && b.author.toLowerCase().includes(q))
    );
  }, [books, searchQuery]);

  // Current page object
  const currentPage: BookPage | undefined = selectedBook?.pages?.[currentPageIndex];

  // Media tracks for current page
  const currentPageMedia = useMemo(() => {
    if (!selectedBook) return [];
    const all = selectedBook.allMedia || [];
    const pageNum = currentPageIndex + 1;
    return all.filter((m) => m.pageNumber === pageNum);
  }, [selectedBook, currentPageIndex]);

  // Audio time & event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, []);

  // Sync playback rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Sync mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Handle play/pause track
  const handleTogglePlayMedia = (media: BookPageMedia) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentMedia?.id === media.id) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(console.error);
      }
    } else {
      setCurrentMedia(media);
      audio.src = media.url || "";
      audio.currentTime = 0;
      audio.play().catch(console.error);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!selectedBook) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "ArrowLeft") {
        // Next page in RTL or previous
        handleNextPage();
      } else if (e.key === "ArrowRight") {
        handlePrevPage();
      } else if (e.key === " ") {
        e.preventDefault();
        if (currentMedia && audioRef.current) {
          if (isPlaying) audioRef.current.pause();
          else audioRef.current.play().catch(console.error);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBook, currentPageIndex, currentMedia, isPlaying]);

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

  // Upload book handler
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("الرجاء اختيار ملف مضغوط (ZIP) للكتاب.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const newBook = await uploadBookArchive(uploadFile, uploadTitle, (pct) => {
        setUploadProgress(pct);
      });

      setBooks((prev) => [newBook, ...prev]);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTitle("");
      // Open the new book immediately
      setSelectedBook(newBook);
      setCurrentPageIndex(0);
    } catch (err: any) {
      setUploadError(err.message || "فشل رفع واستخراج الكتاب");
    } finally {
      setUploading(false);
    }
  };

  // Delete book handler
  const handleDeleteBook = async (id: string) => {
    try {
      const ok = await deleteBookFromServer(id);
      if (ok) {
        setBooks((prev) => prev.filter((b) => b.id !== id));
        if (selectedBook?.id === id) {
          setSelectedBook(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingBookId(null);
    }
  };

  // Rename book handler
  const handleSaveRename = async () => {
    if (!editingBook || !editTitle.trim()) return;
    try {
      const updated = await updateBookMetadata(editingBook.id, { title: editTitle.trim() });
      if (updated) {
        setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
        if (selectedBook?.id === updated.id) {
          setSelectedBook(updated);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setEditingBook(null);
      setEditTitle("");
    }
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Send media to Advanced Studio Player
  const handleSendToStudioPlayer = (media: BookPageMedia) => {
    if (!onPlayMediaInStudio) return;
    onPlayMediaInStudio({
      id: media.id,
      title: `${selectedBook?.title || "كتاب"} - ${media.title}`,
      originalName: media.fileName,
      filename: media.fileName,
      url: media.url,
      type: media.type
    });
  };

  // ==========================================
  // VIEW: READER VIEW (WHEN BOOK IS OPEN)
  // ==========================================
  if (selectedBook) {
    return (
      <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden" dir="rtl">
        <audio ref={audioRef} />

        {/* Top Control Bar */}
        <header className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 flex items-center justify-between gap-3 shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (audioRef.current) audioRef.current.pause();
                setSelectedBook(null);
                setCurrentMedia(null);
              }}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="العودة لمكتبة الكتب"
            >
              <ArrowRight className="w-4 h-4" />
              <span>مكتبة الكتب</span>
            </button>

            <div className="h-4 w-px bg-slate-800" />

            <div className="flex flex-col min-w-0 max-w-[220px] sm:max-w-md">
              <span className="text-xs font-black truncate text-white">{selectedBook.title}</span>
              <span className="text-[10px] text-slate-400 font-medium">
                الصفحة {currentPageIndex + 1} من {selectedBook.pages.length}
              </span>
            </div>
          </div>

          {/* Center: Page Jump & Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPageIndex <= 0}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                currentPageIndex <= 0
                  ? "opacity-30 cursor-not-allowed text-slate-600"
                  : "hover:bg-slate-800 text-slate-300 hover:text-white active:scale-95"
              }`}
              title="الصفحة السابقة"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700/60 text-xs font-bold">
              <input
                type="number"
                min={1}
                max={selectedBook.pages.length}
                value={currentPageIndex + 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= selectedBook.pages.length) {
                    setCurrentPageIndex(val - 1);
                  }
                }}
                className="w-10 bg-transparent text-center font-extrabold text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
              />
              <span className="text-slate-500">/</span>
              <span className="text-slate-400">{selectedBook.pages.length}</span>
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPageIndex >= selectedBook.pages.length - 1}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                currentPageIndex >= selectedBook.pages.length - 1
                  ? "opacity-30 cursor-not-allowed text-slate-600"
                  : "hover:bg-slate-800 text-slate-300 hover:text-white active:scale-95"
              }`}
              title="الصفحة التالية"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Right Controls: Zoom, Fit, Media Drawer */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="تصغير"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="text-[10px] font-bold text-slate-400 w-9 text-center">{zoomLevel}%</span>

            <button
              onClick={() => setZoomLevel((z) => Math.min(250, z + 15))}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="تكبير"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              onClick={() => setPageFit((f) => (f === "contain" ? "width" : "contain"))}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer text-xs font-bold ${
                pageFit === "width" ? "bg-blue-600/30 text-blue-400 border border-blue-500/40" : "hover:bg-slate-800 text-slate-400"
              }`}
              title={pageFit === "width" ? "ملاءمة الارتفاع" : "ملاءمة العرض"}
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-slate-800 mx-1" />

            <button
              onClick={() => setShowMediaDrawer((d) => !d)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                showMediaDrawer
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-xs"
                  : "hover:bg-slate-800 text-slate-400"
              }`}
              title="مسارات الصوت والوسائط"
            >
              <Music className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">المسارات ({selectedBook.allMedia?.length || 0})</span>
            </button>
          </div>
        </header>

        {/* Main Body */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Page Image Display Viewport */}
          <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center p-4 relative">
            {currentPage && currentPage.pageImage ? (
              <div
                className="transition-transform duration-200 ease-out shadow-2xl rounded-lg overflow-hidden border border-slate-800/80 bg-white"
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: "center center",
                  maxHeight: pageFit === "contain" ? "calc(100vh - 170px)" : undefined,
                  maxWidth: pageFit === "width" ? "100%" : undefined
                }}
              >
                <img
                  src={currentPage.pageImage}
                  alt={`صفحة ${currentPageIndex + 1}`}
                  className={`block select-none pointer-events-auto ${
                    pageFit === "contain" ? "max-h-[calc(100vh-170px)] object-contain" : "w-full object-contain"
                  }`}
                  loading="eager"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900/60 rounded-3xl border border-slate-800 max-w-md">
                <BookOpen className="w-16 h-16 text-slate-700 mb-3" />
                <h4 className="text-base font-black text-slate-200 mb-1">لا توجد صورة لهذه الصفحة</h4>
                <p className="text-xs text-slate-500">
                  يمكنك الاستماع للمسارات الصوتية المصاحبة للكتاب من اللائحة الجانبية.
                </p>
              </div>
            )}

            {/* Quick floating on-page audio badges if this page has audio */}
            {currentPageMedia.length > 0 && (
              <div className="absolute top-6 right-6 flex flex-col gap-2 z-20">
                {currentPageMedia.map((m) => {
                  const isCurrent = currentMedia?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleTogglePlayMedia(m)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-2xl backdrop-blur-md border text-xs font-black shadow-lg transition-all cursor-pointer ${
                        isCurrent && isPlaying
                          ? "bg-amber-500 text-slate-950 border-amber-400 scale-105"
                          : "bg-slate-900/90 hover:bg-slate-800 text-amber-400 border-amber-500/40"
                      }`}
                    >
                      {isCurrent && isPlaying ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>{m.title}</span>
                      {m.trackNumber && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20">#{m.trackNumber}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right/Left Drawer: Media Tracks Explorer */}
          {showMediaDrawer && (
            <aside className="w-80 sm:w-96 bg-slate-900/95 border-r border-slate-800 flex flex-col shrink-0 z-20">
              <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black text-white">المسارات التفاعلية</span>
                  <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
                    {selectedBook.allMedia?.length || 0} مقطع
                  </span>
                </div>

                <button
                  onClick={() => setShowMediaDrawer(false)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Media list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {(!selectedBook.allMedia || selectedBook.allMedia.length === 0) ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    لا توجد مسارات صوتية أو مرئية مفهرسة في هذا الكتاب.
                  </div>
                ) : (
                  selectedBook.allMedia.map((m, idx) => {
                    const isCurrent = currentMedia?.id === m.id;
                    const isForThisPage = m.pageNumber === currentPageIndex + 1;

                    return (
                      <div
                        key={m.id || idx}
                        className={`p-3 rounded-2xl border transition-all flex flex-col gap-2 ${
                          isCurrent
                            ? "bg-amber-500/10 border-amber-500/60 shadow-xs"
                            : isForThisPage
                            ? "bg-slate-800/80 border-slate-700"
                            : "bg-slate-900/60 hover:bg-slate-800/50 border-slate-800/80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <button
                              onClick={() => handleTogglePlayMedia(m)}
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                                isCurrent && isPlaying
                                  ? "bg-amber-500 text-slate-950 scale-105"
                                  : "bg-slate-800 hover:bg-amber-500 hover:text-slate-900 text-amber-400"
                              }`}
                            >
                              {isCurrent && isPlaying ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current mr-0.5" />
                              )}
                            </button>

                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-black truncate text-slate-200">{m.title}</span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                {m.trackNumber && <span>مسار #{m.trackNumber}</span>}
                                {m.pageNumber && (
                                  <button
                                    onClick={() => setCurrentPageIndex((m.pageNumber || 1) - 1)}
                                    className="text-blue-400 hover:underline font-bold"
                                  >
                                    ص {m.pageNumber}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action to send to Studio Player */}
                          {onPlayMediaInStudio && (
                            <button
                              onClick={() => handleSendToStudioPlayer(m)}
                              className="px-2 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                              title="فتح المقطع في استوديو المشغل المتقدم للتكرار والترجمة"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>استوديو</span>
                            </button>
                          )}
                        </div>

                        {/* If this is the active media, show miniature scrubber */}
                        {isCurrent && (
                          <div className="pt-2 border-t border-amber-500/20 flex flex-col gap-1.5">
                            <input
                              type="range"
                              min={0}
                              max={duration || 100}
                              value={currentTime}
                              onChange={(e) => {
                                const newTime = parseFloat(e.target.value);
                                setCurrentTime(newTime);
                                if (audioRef.current) audioRef.current.currentTime = newTime;
                              }}
                              className="w-full h-1.5 bg-slate-700 accent-amber-500 rounded-lg cursor-pointer"
                            />
                            <div className="flex justify-between items-center text-[10px] font-bold text-amber-400/80">
                              <span>{formatTime(currentTime)}</span>
                              <span>{formatTime(duration)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Bottom Audio Player Bar (when audio is active) */}
        {currentMedia && (
          <footer className="h-16 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between gap-4 shrink-0 z-30">
            <div className="flex items-center gap-3 min-w-0 max-w-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400">
                <Music className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black truncate text-white">{currentMedia.title}</span>
                <span className="text-[10px] text-slate-400 font-medium truncate">
                  {currentMedia.trackNumber ? `مسار #${currentMedia.trackNumber}` : currentMedia.fileName}
                </span>
              </div>
            </div>

            {/* Center: Transport Controls & Scrubber */}
            <div className="flex-1 max-w-xl flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 5);
                  }}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="تراجع 5 ثواني"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleTogglePlayMedia(currentMedia)}
                  className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current mr-0.5" />
                  )}
                </button>

                <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-300">
                  {[0.75, 1.0, 1.25].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                      className={`px-1.5 py-0.5 rounded transition-colors ${
                        playbackRate === rate ? "bg-amber-500 text-slate-950 font-black" : "hover:text-white"
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-8 text-left">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => {
                    const newTime = parseFloat(e.target.value);
                    setCurrentTime(newTime);
                    if (audioRef.current) audioRef.current.currentTime = newTime;
                  }}
                  className="flex-1 h-1.5 bg-slate-700 accent-amber-500 rounded-lg cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 w-8 text-right">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right: Volume & Studio Player Link */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMuted((m) => !m)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {onPlayMediaInStudio && (
                <button
                  onClick={() => handleSendToStudioPlayer(currentMedia)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح في مشغل الاستوديو</span>
                </button>
              )}
            </div>
          </footer>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: BOOKS LIBRARY VIEW
  // ==========================================
  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 overflow-y-auto select-none" dir="rtl">
      {/* Header */}
      <div className="max-w-7xl mx-auto w-full mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs">
              <BookOpen className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">الكتب الرقمية التفاعلية</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                تصفح الكتب الدراسية مع المقاطع الصوتية والمرئية المصاحبة لكل صفحة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onBackToMediaExplorer && (
              <button
                onClick={onBackToMediaExplorer}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>مستعرض الوسائط</span>
              </button>
            )}

            <button
              onClick={() => {
                setUploadError(null);
                setUploadProgress(0);
                setShowUploadModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Upload className="w-4 h-4 stroke-[2.5]" />
              <span>إضافة كتاب تفاعلي (ZIP)</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="البحث في الكتب التفاعلية..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pr-10 pl-4 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
          <span className="text-xs font-bold text-slate-400">
            {filteredBooks.length} {filteredBooks.length === 1 ? "كتاب" : "كتب"}
          </span>
        </div>
      </div>

      {/* Books Grid */}
      <div className="max-w-7xl mx-auto w-full flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-xs font-bold text-slate-500">جاري تحميل مكتبة الكتب...</span>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 shadow-xs">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-200 mb-1">
              لا توجد كتب رقمية مضافة حتى الآن
            </h3>
            <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
              قم برفع كتابك الدراسي بصيغة ملف مضغوط (ZIP) يحتوي على صور الصفحات ومسارات الاستماع (MP3)، وسيتم استخراجه وفهرسته تفاعلياً تلقائياً!
            </p>
            <button
              onClick={() => {
                setUploadError(null);
                setUploadProgress(0);
                setShowUploadModal(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Upload className="w-4 h-4 stroke-[2.5]" />
              <span>رفع كتاب جديد الآن</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredBooks.map((book) => (
              <div
                key={book.id}
                className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-lg transition-all flex flex-col justify-between"
              >
                {/* Book Cover Area */}
                <div
                  onClick={() => {
                    setSelectedBook(book);
                    setCurrentPageIndex(0);
                  }}
                  className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 relative cursor-pointer overflow-hidden flex items-center justify-center"
                >
                  {book.coverImage ? (
                    <img
                      src={book.coverImage}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <BookOpen className="w-12 h-12 text-slate-400 group-hover:scale-110 transition-transform" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3.5">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      <span>فتح وقراءة الكتاب</span>
                      <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                    </span>
                  </div>

                  <span className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-xl border border-slate-700/60 shadow-xs">
                    {book.totalPages} صفحة
                  </span>
                </div>

                {/* Book Info */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white truncate mb-1">
                      {book.title}
                    </h4>
                    {book.subtitle && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2 font-medium">
                        {book.subtitle}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      <Music className="w-3.5 h-3.5" />
                      <span>{book.allMedia?.length || 0} مسار صوتي</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBook(book);
                          setEditTitle(book.title);
                        }}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="تعديل اسم الكتاب"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingBookId(book.id);
                        }}
                        className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="حذف الكتاب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* MODAL: UPLOAD INTERACTIVE BOOK (ZIP) */}
      {/* ========================================== */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs select-none">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">إضافة كتاب تفاعلي</h3>
                  <p className="text-[11px] text-slate-500">رفع واستخراج حزمة الكتاب الرقمي (ZIP)</p>
                </div>
              </div>

              {!uploading && (
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  عنوان الكتاب (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: Schritte International Neu 1"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  disabled={uploading}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              {/* Drag & Drop File Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  ملف الكتاب المضغوط (ZIP Archive)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      if (!uploadTitle.trim()) {
                        const base = f.name.replace(/\.zip$/i, "").replace(/[_-]/g, " ");
                        setUploadTitle(base);
                      }
                    }
                  }}
                  className="hidden"
                />

                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                    uploadFile
                      ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                      : "border-slate-300 dark:border-slate-700 hover:border-amber-500 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <BookOpen className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                  {uploadFile ? (
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block truncate">
                        {uploadFile.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        ({(uploadFile.size / (1024 * 1024)).toFixed(1)} ميجابايت)
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                        انقر لاختيار ملف الـ ZIP أو اسحبه هنا
                      </span>
                      <span className="text-[10px] text-slate-400">
                        يدعم حزم الكتب الرقمية التفاعلية مع ملفات الصوت والصور
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress indicator */}
              {uploading && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-600 dark:text-slate-300">
                      {uploadProgress < 100 ? "جاري رفع الملف للسيرفر..." : "جاري فك الضغط وفهرسة الصفحات والوسائط..."}
                    </span>
                    <span className="text-amber-500 font-black">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-200 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error banner */}
              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{uploadError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                    uploading || !uploadFile
                      ? "opacity-40 cursor-not-allowed bg-slate-300 dark:bg-slate-700 text-slate-500"
                      : "bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950"
                  }`}
                >
                  {uploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>جاري المعالجة...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 stroke-[2.5]" />
                      <span>بدء الرفع والاستخراج</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deletingBookId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs select-none">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">حذف الكتاب التفاعلي؟</h3>
            <p className="text-xs text-slate-500 mb-5">
              سيتم حذف الكتاب وجميع ملفات الصفحات والمسارات الصوتية التابعة له من السيرفر نهائياً.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setDeletingBookId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                تراجع
              </button>
              <button
                onClick={() => handleDeleteBook(deletingBookId)}
                className="px-5 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer shadow-md"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RENAME BOOK */}
      {editingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs select-none">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-3">تعديل اسم الكتاب</h3>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30 mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingBook(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveRename}
                className="px-5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all cursor-pointer shadow-md"
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

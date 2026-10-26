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
  Volume2,
  Film,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  ExternalLink,
  X,
  FileText,
  FolderInput,
  CheckCircle2,
  Trash2,
  Music,
  Video as VideoIcon
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

  // Tabs for Media Section: "page" (current page media) vs "all" (all media in book)
  const [activeMediaTab, setActiveMediaTab] = useState<"page" | "all">("page");
  const [mediaSearchQuery, setMediaSearchQuery] = useState<string>("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"all" | "audio" | "video">("all");

  // Audio Playback State for active page track
  const [activePlayingMediaId, setActivePlayingMediaId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Video Modal State for watching book videos
  const [activeVideoModal, setActiveVideoModal] = useState<BookPageMedia | null>(null);

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
          // Find first page that has media or default to page 175 if exists
          const initialIdx = storedBooks[0].pages.findIndex((p) => p.media && p.media.length > 0);
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

  // All Media items in book
  const allBookMedia: BookPageMedia[] = useMemo(() => {
    if (!selectedBook) return [];
    if (selectedBook.allMedia && selectedBook.allMedia.length > 0) {
      return selectedBook.allMedia;
    }
    // Collect from pages if allMedia wasn't populated
    const gathered: BookPageMedia[] = [];
    const seen = new Set<string>();
    selectedBook.pages.forEach((p) => {
      if (Array.isArray(p.media)) {
        p.media.forEach((m) => {
          if (!seen.has(m.id || m.fileName)) {
            seen.add(m.id || m.fileName);
            gathered.push({ ...m, pageNumber: p.pageNumber });
          }
        });
      }
    });
    return gathered;
  }, [selectedBook]);

  // Find index of first page that has media in the current book
  const firstPageWithMediaIndex = useMemo(() => {
    if (!selectedBook) return -1;
    return selectedBook.pages.findIndex((p) => p.media && p.media.length > 0);
  }, [selectedBook]);

  // Filtered list for "All Media" tab
  const filteredAllMedia = useMemo(() => {
    return allBookMedia.filter((m) => {
      const matchesType =
        mediaTypeFilter === "all" || m.type === mediaTypeFilter;
      const matchesQuery =
        !mediaSearchQuery.trim() ||
        m.title.toLowerCase().includes(mediaSearchQuery.toLowerCase()) ||
        m.fileName.toLowerCase().includes(mediaSearchQuery.toLowerCase()) ||
        (m.trackNumber && m.trackNumber.toLowerCase().includes(mediaSearchQuery.toLowerCase()));
      return matchesType && matchesQuery;
    });
  }, [allBookMedia, mediaTypeFilter, mediaSearchQuery]);

  // Total audio and video counts
  const audioCount = useMemo(() => allBookMedia.filter((m) => m.type === "audio").length, [allBookMedia]);
  const videoCount = useMemo(() => allBookMedia.filter((m) => m.type === "video").length, [allBookMedia]);

  // Keyboard navigation (ArrowLeft & ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSearchOpen || isZoomModalOpen || activeVideoModal) return;
      if (e.key === "ArrowRight") {
        handleNextPage();
      } else if (e.key === "ArrowLeft") {
        handlePrevPage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPageIndex, selectedBook, isSearchOpen, isZoomModalOpen, activeVideoModal]);

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

  // Play audio or open video
  const handlePlayMedia = (media: BookPageMedia) => {
    if (media.type === "video") {
      // Open direct video modal player
      stopAudio();
      setActiveVideoModal(media);
      return;
    }

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
        audioRef.current.play().catch((err) => console.error("Audio playback error:", err));
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
        filename: media.fileName,
        mimeType: media.type === "video" ? "video/mp4" : "audio/mpeg",
        size: 1024 * 1024 * 2,
        uploadedAt: new Date().toISOString()
      });
    }
  };

  // Jump to specific page by number
  const handleJumpToPage = (pageNum: number) => {
    if (!selectedBook) return;
    const idx = selectedBook.pages.findIndex((p) => p.pageNumber === pageNum);
    if (idx >= 0) {
      setCurrentPageIndex(idx);
      setActiveMediaTab("page");
    }
  };

  // =========================================================================
  // ROBUST MULTI-STRATEGY BOOK ARCHIVE PARSER (ZIP & FOLDER)
  // =========================================================================
  const parseAndLoadBook = async (
    filesMap: {
      getAllFiles: () => Promise<
        Array<{
          path: string;
          name: string;
          getAsBlob: () => Promise<Blob>;
          getAsText: () => Promise<string>;
        }>
      >;
      defaultTitle: string;
    }
  ) => {
    setIsImporting(true);
    setImportStatus("جاري فحص محتويات الأرشيف وملفات الوسائط...");

    try {
      const allFiles = await filesMap.getAllFiles();

      // Dictionaries & Collections
      interface FoundMedia {
        id: string;
        fileName: string;
        cleanName: string;
        normalizedPath: string;
        url: string;
        blob: Blob;
        type: "audio" | "video";
        title: string;
        trackNumber?: string;
        detectedPageNum?: number;
      }

      interface FoundImage {
        fileName: string;
        normalizedPath: string;
        url: string;
        blob: Blob;
        detectedPageNum?: number;
      }

      const foundMedias: FoundMedia[] = [];
      const foundImages: FoundImage[] = [];
      const jsonTexts: Array<{ path: string; text: string; data: any }> = [];

      setImportStatus(`جاري معالجة ${allFiles.length} ملف (صور، صوتيات، فيديوهات، وفهارس)...`);

      for (const f of allFiles) {
        const lower = f.path.toLowerCase();
        const baseName = f.name;
        const normalized = f.path.replace(/\\/g, "/");

        // 1. JSON files
        if (lower.endsWith(".json")) {
          try {
            const txt = await f.getAsText();
            const parsed = JSON.parse(txt);
            jsonTexts.push({ path: normalized, text: txt, data: parsed });
          } catch (e) {
            console.warn("Could not parse JSON:", f.path, e);
          }
        }
        // 2. Images (Pages)
        else if (lower.match(/\.(jpg|jpeg|png|webp|svg|bmp)$/)) {
          const blob = await f.getAsBlob();
          const url = URL.createObjectURL(blob);
          // Detect page number from filename: e.g. "530_25460-p-001.jpg" or "page_1" or "001"
          const pageMatch = baseName.match(/(?:[-_]p[-_]?|page[-_]?|p)(\d{1,4})/i) || baseName.match(/\b(\d{1,4})\b/);
          const detectedPageNum = pageMatch ? parseInt(pageMatch[1], 10) : undefined;

          foundImages.push({
            fileName: baseName,
            normalizedPath: normalized,
            url,
            blob,
            detectedPageNum
          });
        }
        // 3. Audio & Video (Media)
        else if (lower.match(/\.(mp3|wav|ogg|m4a|aac|flac|wma|mp4|webm|mov|mkv|m4v)$/)) {
          const isVideo = Boolean(lower.match(/\.(mp4|webm|mov|mkv|m4v)$/));
          const blob = await f.getAsBlob();
          const url = URL.createObjectURL(blob);
          const cleanName = baseName.replace(/\.[^/.]+$/, "");

          // Detect potential page number from filename e.g. "530_25460-a-001" or "p-175"
          const pageMatch = baseName.match(/(?:[-_]p[-_]?|page[-_]?|p)(\d{1,4})/i) || baseName.match(/\b(\d{1,4})\b/);
          const detectedPageNum = pageMatch ? parseInt(pageMatch[1], 10) : undefined;

          // Track title formatting
          const title = cleanName
            .replace(/^audio\//i, "")
            .replace(/^video\//i, "")
            .replace(/[-_]/g, " ")
            .trim();

          foundMedias.push({
            id: `media-${Date.now()}-${foundMedias.length}`,
            fileName: baseName,
            cleanName: cleanName.toLowerCase(),
            normalizedPath: normalized.toLowerCase(),
            url,
            blob,
            type: isVideo ? "video" : "audio",
            title: title || `${isVideo ? "فيديو" : "صوت"} ${foundMedias.length + 1}`,
            trackNumber: detectedPageNum ? `${detectedPageNum}` : undefined,
            detectedPageNum
          });
        }
      }

      // Smart Media Lookup Function
      const findMediaMatch = (mediaRef: string): FoundMedia | undefined => {
        if (!mediaRef) return undefined;
        const refNorm = mediaRef.replace(/\\/g, "/").toLowerCase();
        const refBase = refNorm.split("/").pop() || "";
        const refClean = refBase.replace(/\.[^/.]+$/, "");

        return foundMedias.find((m) => {
          if (m.fileName.toLowerCase() === refBase) return true;
          if (m.normalizedPath.endsWith(refNorm) || refNorm.endsWith(m.normalizedPath)) return true;
          if (m.cleanName === refClean) return true;
          if (refClean.length > 2 && (m.cleanName.includes(refClean) || refClean.includes(m.cleanName))) return true;
          return false;
        });
      };

      // Smart Image Lookup Function
      const findImageMatch = (imgRef: string): FoundImage | undefined => {
        if (!imgRef) return undefined;
        const refNorm = imgRef.replace(/\\/g, "/").toLowerCase();
        const refBase = refNorm.split("/").pop() || "";
        const refClean = refBase.replace(/\.[^/.]+$/, "");

        return foundImages.find((img) => {
          if (img.fileName.toLowerCase() === refBase) return true;
          if (img.normalizedPath.toLowerCase().endsWith(refNorm)) return true;
          const imgClean = img.fileName.toLowerCase().replace(/\.[^/.]+$/, "");
          if (imgClean === refClean) return true;
          return false;
        });
      };

      // Identify Content JSON and Book Meta JSON
      let contentJSON: any = null;
      let bookMetaJSON: any = null;

      for (const item of jsonTexts) {
        const pathLower = item.path.toLowerCase();
        const data = item.data;

        // Check if data is array of pages or contains pages/content
        if (
          Array.isArray(data) ||
          Array.isArray(data.pages) ||
          Array.isArray(data.content) ||
          Array.isArray(data.items) ||
          Array.isArray(data.data) ||
          Array.isArray(data.chapters) ||
          (data.book && Array.isArray(data.book.pages))
        ) {
          contentJSON = data;
        }

        if (pathLower.includes("book.json") || pathLower.includes("meta") || data.title || data.book_title) {
          bookMetaJSON = data;
        }
      }

      const bookTitle =
        bookMetaJSON?.title ||
        bookMetaJSON?.book_title ||
        contentJSON?.book_title ||
        contentJSON?.title ||
        filesMap.defaultTitle;

      // Extract raw page objects array
      let rawPages: any[] = [];
      if (contentJSON) {
        if (Array.isArray(contentJSON)) {
          rawPages = contentJSON;
        } else if (Array.isArray(contentJSON.pages)) {
          rawPages = contentJSON.pages;
        } else if (Array.isArray(contentJSON.content)) {
          rawPages = contentJSON.content;
        } else if (Array.isArray(contentJSON.items)) {
          rawPages = contentJSON.items;
        } else if (Array.isArray(contentJSON.data)) {
          rawPages = contentJSON.data;
        } else if (contentJSON.book && Array.isArray(contentJSON.book.pages)) {
          rawPages = contentJSON.book.pages;
        }
      }

      // Build pages
      const constructedPages: BookPage[] = [];
      const assignedMediaIds = new Set<string>();

      if (rawPages.length > 0) {
        // Construct pages from JSON
        rawPages.forEach((p, idx) => {
          const pageNum = parseInt(String(p.page ?? p.page_number ?? p.pageNumber ?? p.id ?? idx + 1), 10) || idx + 1;
          const displayLabel = String(p.label ?? p.display_label ?? p.pageLabel ?? pageNum);

          // Find page image
          const rawImgRef = p.page_img || p.image || p.img || p.pageImage || p.src || p.file || "";
          let matchedImage = findImageMatch(rawImgRef);
          if (!matchedImage) {
            // Try matching image by page number
            matchedImage = foundImages.find((img) => img.detectedPageNum === pageNum);
          }
          if (!matchedImage && foundImages[idx]) {
            matchedImage = foundImages[idx];
          }

          const pageImageUrl = matchedImage?.url || "/assets/aistudio/image_629fa44a.png";

          // Parse page media
          const pageMediaList: BookPageMedia[] = [];
          const rawMediaArr: any[] = [];

          if (Array.isArray(p.media)) rawMediaArr.push(...p.media);
          if (Array.isArray(p.audios)) rawMediaArr.push(...p.audios);
          if (Array.isArray(p.videos)) rawMediaArr.push(...p.videos);
          if (Array.isArray(p.tracks)) rawMediaArr.push(...p.tracks);
          if (Array.isArray(p.files)) rawMediaArr.push(...p.files);
          if (typeof p.audio === "string") rawMediaArr.push({ type: "audio", file_name: p.audio });
          if (typeof p.video === "string") rawMediaArr.push({ type: "video", file_name: p.video });

          rawMediaArr.forEach((m, mIdx) => {
            const rawFileName = m.file_name || m.fileName || m.filename || m.file || m.src || m.path || m.url || m.name || "";
            const matchedMedia = findMediaMatch(rawFileName);

            const isVideo = m.type === "video" || matchedMedia?.type === "video" || Boolean(rawFileName.match(/\.(mp4|webm|mov|mkv)$/i));
            const mediaType: "audio" | "video" = isVideo ? "video" : "audio";
            const trackNum = m.track_number || m.trackNumber || m.track || `${pageNum}/${mIdx + 1}`;
            const mediaTitle = m.title || m.label || m.name || matchedMedia?.title || `${mediaType === "video" ? "Video" : "Audio"}: ${rawFileName}`;

            if (matchedMedia) {
              assignedMediaIds.add(matchedMedia.id);
            }

            pageMediaList.push({
              id: matchedMedia ? matchedMedia.id : `media-${pageNum}-${mIdx}`,
              trackNumber: trackNum,
              title: mediaTitle,
              type: mediaType,
              fileName: matchedMedia?.fileName || rawFileName,
              url: matchedMedia?.url,
              blob: matchedMedia?.blob,
              pageNumber: pageNum
            });
          });

          constructedPages.push({
            pageNumber: pageNum,
            displayLabel,
            pageImage: pageImageUrl,
            imageBlob: matchedImage?.blob,
            media: pageMediaList
          });
        });
      } else {
        // Fallback: Build pages directly from detected images sorted by name/number
        const sortedImages = [...foundImages].sort((a, b) => {
          if (a.detectedPageNum !== undefined && b.detectedPageNum !== undefined) {
            return a.detectedPageNum - b.detectedPageNum;
          }
          return a.fileName.localeCompare(b.fileName, undefined, { numeric: true });
        });

        sortedImages.forEach((img, idx) => {
          const pageNum = img.detectedPageNum ?? idx + 1;
          constructedPages.push({
            pageNumber: pageNum,
            displayLabel: String(pageNum),
            pageImage: img.url,
            imageBlob: img.blob,
            media: []
          });
        });
      }

      // Auto-assign any unassigned media to pages by detected page number!
      foundMedias.forEach((m) => {
        if (!assignedMediaIds.has(m.id) && m.detectedPageNum) {
          const targetPage = constructedPages.find((p) => p.pageNumber === m.detectedPageNum);
          if (targetPage) {
            targetPage.media.push({
              id: m.id,
              trackNumber: `${m.detectedPageNum}`,
              title: m.title,
              type: m.type,
              fileName: m.fileName,
              url: m.url,
              blob: m.blob,
              pageNumber: m.detectedPageNum
            });
            assignedMediaIds.add(m.id);
          }
        }
      });

      // Prepare comprehensive allMedia list (contains EVERY single media file in the archive)
      const allBookMediaList: BookPageMedia[] = foundMedias.map((m) => {
        // Find which page this media is attached to, if any
        let linkedPageNum = m.detectedPageNum;
        for (const pg of constructedPages) {
          if (pg.media.some((item) => item.id === m.id || item.fileName === m.fileName)) {
            linkedPageNum = pg.pageNumber;
            break;
          }
        }

        return {
          id: m.id,
          trackNumber: linkedPageNum ? `ص ${linkedPageNum}` : undefined,
          title: m.title,
          type: m.type,
          fileName: m.fileName,
          url: m.url,
          blob: m.blob,
          pageNumber: linkedPageNum
        };
      });

      if (constructedPages.length === 0) {
        throw new Error("لم يتم العثور على أي صفحات أو صور داخل الأرشيف المرفوع.");
      }

      const audiosFound = foundMedias.filter((m) => m.type === "audio").length;
      const videosFound = foundMedias.filter((m) => m.type === "video").length;

      const newBook: InteractiveBook = {
        id: `book-${Date.now()}`,
        title: bookTitle,
        totalPages: constructedPages.length,
        createdAt: new Date().toISOString(),
        pages: constructedPages,
        allMedia: allBookMediaList
      };

      await saveBookToDB(newBook);
      setBooks((prev) => [newBook, ...prev]);
      setSelectedBook(newBook);

      // Automatically navigate to the first page that contains media, or page 0
      const firstMediaIdx = constructedPages.findIndex((p) => p.media && p.media.length > 0);
      setCurrentPageIndex(firstMediaIdx >= 0 ? firstMediaIdx : 0);

      // Default tab: if the active page has media, show "page", otherwise switch to "all" so user immediately sees all media!
      if (firstMediaIdx === -1 && allBookMediaList.length > 0) {
        setActiveMediaTab("all");
      } else {
        setActiveMediaTab("page");
      }

      setImportStatus(
        `✅ تم الاستيراد بنجاح! تم تجهيز ${constructedPages.length} صفحة و ${allBookMediaList.length} ملف وسائط (${audiosFound} صوتي، ${videosFound} فيديو).`
      );

      setTimeout(() => {
        setIsImporting(false);
        setImportStatus("");
      }, 5000);
    } catch (err: any) {
      console.error("Book import failed:", err);
      setImportStatus(`❌ خطأ أثناء استيراد الكتاب: ${err.message || "الملف غير صالح"}`);
      setTimeout(() => {
        setIsImporting(false);
        setImportStatus("");
      }, 5000);
    }
  };

  // ZIP File Handler
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);

      await parseAndLoadBook({
        defaultTitle: file.name.replace(/\.[^/.]+$/, ""),
        getAllFiles: async () => {
          const files: Array<{
            path: string;
            name: string;
            getAsBlob: () => Promise<Blob>;
            getAsText: () => Promise<string>;
          }> = [];

          const entries = Object.keys(loadedZip.files);
          for (const p of entries) {
            const entry = loadedZip.files[p];
            if (entry.dir) continue;
            const base = p.split("/").pop() || "";
            files.push({
              path: p,
              name: base,
              getAsBlob: () => entry.async("blob"),
              getAsText: () => entry.async("text")
            });
          }
          return files;
        }
      });
    } catch (err: any) {
      console.error("ZIP Load Error:", err);
      setImportStatus(`خطأ في فك ضغط ZIP: ${err.message || "الملف غير صالح"}`);
      setTimeout(() => {
        setIsImporting(false);
        setImportStatus("");
      }, 5000);
    } finally {
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  };

  // Folder Upload Handler
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;

    const filesArray = Array.from(rawFiles);
    const folderName = filesArray[0].webkitRelativePath?.split("/")[0] || "كتاب رقمي جديد";

    await parseAndLoadBook({
      defaultTitle: folderName,
      getAllFiles: async () => {
        return filesArray.map((f) => ({
          path: f.webkitRelativePath || f.name,
          name: f.name,
          getAsBlob: async () => f,
          getAsText: async () => f.text()
        }));
      }
    });

    if (folderInputRef.current) folderInputRef.current.value = "";
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

        {/* Right Action Icons: Search, Folder Upload & ZIP Upload */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isSearchOpen ? "bg-blue-50 text-[#0056f6]" : "hover:bg-slate-100 text-slate-800"
            }`}
            title="البحث أو الانتقال لرقم صفحة"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Import Folder Option */}
          <button
            onClick={() => folderInputRef.current?.click()}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="استيراد مجلد محلي للكتاب"
          >
            <FolderInput className="w-3.5 h-3.5 text-slate-600" />
            <span>استيراد مجلد</span>
          </button>

          {/* Import ZIP Button */}
          <button
            onClick={() => zipInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0056f6] hover:bg-[#0047d1] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="استيراد كتاب مضغوط ZIP"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>استيراد ZIP</span>
          </button>
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
      {importStatus && (
        <div
          className={`px-4 py-2.5 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-sm transition-all ${
            importStatus.startsWith("❌")
              ? "bg-rose-600 text-white"
              : importStatus.startsWith("✅")
              ? "bg-emerald-600 text-white"
              : "bg-blue-600 text-white animate-pulse"
          }`}
        >
          {isImporting ? <Sparkles className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{importStatus}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MAIN BOOK VIEWER STAGE                                */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto pt-3 pb-12 px-2 sm:px-6">
        {selectedBook ? (
          <div className="w-full max-w-4xl flex flex-col items-center">
            {/* Book Title (Matching Image: Centered subtitle above pages) */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <h2 className="text-sm sm:text-base font-bold text-slate-800 text-center tracking-tight">
                {selectedBook.title}
              </h2>
              {books.length > 1 && (
                <button
                  onClick={(e) => handleDeleteBook(selectedBook.id, e)}
                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="حذف هذا الكتاب"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

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
            {/* DUAL-TAB MEDIA NAVIGATION BAR                            */}
            {/* ======================================================== */}
            <div className="w-full border-t border-slate-200 mt-2">
              <div className="flex items-center justify-between border-b border-slate-200 px-2 py-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveMediaTab("page")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeMediaTab === "page"
                        ? "bg-blue-50 text-[#0056f6] shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>وسائط الصفحة ({activePage?.media?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveMediaTab("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeMediaTab === "all"
                        ? "bg-blue-50 text-[#0056f6] shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>جميع وسائط الكتاب ({allBookMedia.length})</span>
                  </button>
                </div>

                <div className="text-2xs font-mono text-slate-400">
                  {audioCount > 0 && `${audioCount} صوت`}
                  {audioCount > 0 && videoCount > 0 && " • "}
                  {videoCount > 0 && `${videoCount} فيديو`}
                </div>
              </div>

              {/* ======================================================== */}
              {/* TAB 1: ACTIVE PAGE MEDIA TRACKS (Exact Screenshot rows)  */}
              {/* ======================================================== */}
              {activeMediaTab === "page" && (
                <div>
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
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-400 font-medium capitalize flex items-center gap-1">
                                  {media.type === "video" ? (
                                    <>
                                      <VideoIcon className="w-3 h-3 text-purple-500" />
                                      Video
                                    </>
                                  ) : (
                                    <>
                                      <Music className="w-3 h-3 text-blue-500" />
                                      Audio
                                    </>
                                  )}
                                </span>
                                {media.fileName && (
                                  <span className="text-2xs font-mono text-slate-400 truncate max-w-[200px]">
                                    ({media.fileName})
                                  </span>
                                )}
                              </div>
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
                                title={
                                  media.type === "video"
                                    ? "مشاهدة الفيديو"
                                    : isCurrentPlaying
                                    ? "إيقاف مؤقت"
                                    : "تشغيل المقطع الصوتي"
                                }
                              >
                                {media.type === "video" ? (
                                  <Play className="w-5 h-5 fill-current translate-x-0.5 text-purple-600" />
                                ) : isCurrentPlaying ? (
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
                    /* Helpful Empty State with Shortcuts to All Media */
                    <div className="py-8 px-4 text-center flex flex-col items-center justify-center bg-slate-50/60 rounded-xl my-3 border border-dashed border-slate-200">
                      <Volume2 className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-700">
                        لا توجد مقاطع وسائط مرتبطة مباشرة بالصفحة الحالية ({activePage?.pageNumber || currentPageIndex + 1})
                      </p>
                      {allBookMedia.length > 0 ? (
                        <div className="mt-2 text-xs text-slate-500 flex flex-col items-center gap-2">
                          <span>
                            يحتوي هذا الكتاب على <strong>{allBookMedia.length} مقطع وسائط</strong> ({audioCount} صوت، {videoCount} فيديو) في باقي الصفحات والمجلدات.
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={() => setActiveMediaTab("all")}
                              className="px-3 py-1.5 bg-[#0056f6] text-white rounded-lg text-xs font-bold hover:bg-[#0047d1] cursor-pointer shadow-2xs"
                            >
                              استعراض جميع وسائط الكتاب ({allBookMedia.length})
                            </button>
                            {firstPageWithMediaIndex >= 0 && (
                              <button
                                onClick={() => setCurrentPageIndex(firstPageWithMediaIndex)}
                                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                              >
                                الانتقال لصفحة {selectedBook.pages[firstPageWithMediaIndex].pageNumber} (تحتوي وسائط)
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-2xs text-slate-400 mt-1">
                          لم يتم العثور على ملفات صوتية أو فيديو في هذا الكتاب
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 2: COMPREHENSIVE ALL BOOK MEDIA BROWSER              */}
              {/* ======================================================== */}
              {activeMediaTab === "all" && (
                <div className="pt-2">
                  {/* Search and Filters Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-3 px-2">
                    <div className="relative w-full sm:w-72">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="ابحث في الصوتيات والفيديوهات..."
                        value={mediaSearchQuery}
                        onChange={(e) => setMediaSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#0056f6]"
                      />
                    </div>

                    <div className="flex items-center gap-1 w-full sm:w-auto">
                      <button
                        onClick={() => setMediaTypeFilter("all")}
                        className={`px-2.5 py-1 text-2xs font-bold rounded-md cursor-pointer transition-all ${
                          mediaTypeFilter === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        الكل ({allBookMedia.length})
                      </button>
                      <button
                        onClick={() => setMediaTypeFilter("audio")}
                        className={`px-2.5 py-1 text-2xs font-bold rounded-md cursor-pointer transition-all ${
                          mediaTypeFilter === "audio" ? "bg-[#0056f6] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        صوتيات ({audioCount})
                      </button>
                      <button
                        onClick={() => setMediaTypeFilter("video")}
                        className={`px-2.5 py-1 text-2xs font-bold rounded-md cursor-pointer transition-all ${
                          mediaTypeFilter === "video" ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        فيديوهات ({videoCount})
                      </button>
                    </div>
                  </div>

                  {filteredAllMedia.length > 0 ? (
                    <div className="divide-y divide-slate-200 max-h-[380px] overflow-y-auto">
                      {filteredAllMedia.map((media) => {
                        const isCurrentPlaying = activePlayingMediaId === media.id && isPlayingAudio;

                        return (
                          <div
                            key={media.id}
                            className={`py-2.5 px-3 flex items-center justify-between transition-colors ${
                              isCurrentPlaying ? "bg-blue-50/70" : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-3xs font-black uppercase ${
                                    media.type === "video"
                                      ? "bg-purple-100 text-purple-700"
                                      : "bg-blue-100 text-blue-700"
                                  }`}
                                >
                                  {media.type}
                                </span>
                                <h4
                                  className={`text-xs sm:text-sm font-semibold truncate ${
                                    isCurrentPlaying ? "text-[#0056f6]" : "text-slate-800"
                                  }`}
                                >
                                  {media.title}
                                </h4>
                              </div>
                              <div className="flex items-center gap-3 text-2xs text-slate-400 font-mono mt-0.5">
                                <span>{media.fileName}</span>
                                {media.pageNumber && (
                                  <button
                                    onClick={() => handleJumpToPage(media.pageNumber!)}
                                    className="text-[#0056f6] hover:underline cursor-pointer font-bold"
                                  >
                                    ← صفحة {media.pageNumber}
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {onPlayMediaInStudio && (
                                <button
                                  onClick={() => handleOpenInStudioPlayer(media)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                                  title="فتح في استوديو المشغل"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => handlePlayMedia(media)}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-[#0056f6] hover:bg-blue-100/60 transition-all cursor-pointer active:scale-95"
                                title={media.type === "video" ? "مشاهدة الفيديو" : "تشغيل الصوت"}
                              >
                                {media.type === "video" ? (
                                  <Play className="w-4 h-4 fill-current text-purple-600 translate-x-0.5" />
                                ) : isCurrentPlaying ? (
                                  <Pause className="w-4 h-4 fill-current" />
                                ) : (
                                  <Play className="w-4 h-4 fill-current translate-x-0.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      لا توجد وسائط تطابق معايير البحث
                    </div>
                  )}
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
              قم باستيراد ملف ZIP أو مجلد يحتوي على هيكل الكتاب الرقمي لتصفحه هنا مع الوسائط
            </p>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => zipInputRef.current?.click()}
                className="px-4 py-2 bg-[#0056f6] text-white rounded-xl text-xs font-bold hover:bg-[#0047d1] cursor-pointer shadow-xs"
              >
                استيراد ملف ZIP
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                استيراد مجلد
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. INLINE VIDEO PLAYER MODAL                             */}
      {/* ======================================================== */}
      {activeVideoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 animate-fadeIn"
          onClick={() => setActiveVideoModal(null)}
        >
          <div
            className="w-full max-w-3xl bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Video Header */}
            <div className="p-3 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between text-white">
              <div className="flex items-center gap-2 min-w-0">
                <VideoIcon className="w-4 h-4 text-purple-400 shrink-0" />
                <h3 className="text-sm font-bold truncate">{activeVideoModal.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                {onPlayMediaInStudio && (
                  <button
                    onClick={() => {
                      handleOpenInStudioPlayer(activeVideoModal);
                      setActiveVideoModal(null);
                    }}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>فتح في الاستوديو</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveVideoModal(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Video Player */}
            <div className="bg-black flex items-center justify-center aspect-video w-full">
              {activeVideoModal.url ? (
                <video
                  src={activeVideoModal.url}
                  controls
                  autoPlay
                  className="w-full h-full max-h-[70vh] object-contain"
                />
              ) : (
                <div className="text-slate-400 text-xs p-8 text-center">
                  رابط الفيديو غير متوفر
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

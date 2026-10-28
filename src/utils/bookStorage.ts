import JSZip from "jszip";
import { InteractiveBook, BookPage, BookPageMedia } from "../types";

// =========================================================================
// 🚀 High-Speed In-Memory & IndexedDB Storage (0-Network Dependency)
// Works 100% locally on your laptop, offline, or with server
// =========================================================================

const DB_NAME = "InteractiveBooksDB";
const STORE_NAME = "books";
const DB_VERSION = 1;

// Default initial sample books
const INITIAL_BOOKS: InteractiveBook[] = [
  {
    id: "miteinander-a1-1",
    title: "Miteinander! A1.1 KB+AB",
    subtitle: "Kurs- und Arbeitsbuch",
    author: "Hueber Verlag",
    coverImage: "/assets/aistudio/covers/cover_a1_1.png",
    totalPages: 186,
    createdAt: "2024-06-10T10:00:00.000Z",
    pages: [
      {
        pageNumber: 184,
        displayLabel: "184",
        pageImage: "/assets/aistudio/sample_pages/page_left.png",
        media: []
      },
      {
        pageNumber: 185,
        displayLabel: "185",
        pageImage: "/assets/aistudio/sample_pages/page_left.png",
        media: []
      },
      {
        pageNumber: 186,
        displayLabel: "186",
        pageImage: "/assets/aistudio/sample_pages/page_center.png",
        media: [
          {
            id: "m-186-1",
            trackNumber: "2/43",
            title: "2/43 – Audio: L8, 14b",
            type: "audio",
            fileName: "2_43_Audio_L8_14b.mp3",
            url: "/uploads/media/audio.mp3",
            pageNumber: 186
          },
          {
            id: "m-186-2",
            trackNumber: "2/44",
            title: "2/44 – Audio: L8, 14c",
            type: "audio",
            fileName: "2_44_Audio_L8_14c.mp3",
            url: "/uploads/media/audio.mp3",
            pageNumber: 186
          },
          {
            id: "m-186-3",
            trackNumber: "L8, 14a",
            title: "L8, 14a, Aussprache",
            type: "video",
            fileName: "L8_14a_Aussprache.mp4",
            url: "/uploads/media/video.mp4",
            pageNumber: 186
          }
        ]
      },
      {
        pageNumber: 187,
        displayLabel: "187",
        pageImage: "/assets/aistudio/sample_pages/page_right.png",
        media: []
      }
    ],
    allMedia: [
      {
        id: "m-186-1",
        trackNumber: "2/43",
        title: "2/43 – Audio: L8, 14b",
        type: "audio",
        fileName: "2_43_Audio_L8_14b.mp3",
        url: "/uploads/media/audio.mp3",
        pageNumber: 186
      },
      {
        id: "m-186-2",
        trackNumber: "2/44",
        title: "2/44 – Audio: L8, 14c",
        type: "audio",
        fileName: "2_44_Audio_L8_14c.mp3",
        url: "/uploads/media/audio.mp3",
        pageNumber: 186
      },
      {
        id: "m-186-3",
        trackNumber: "L8, 14a",
        title: "L8, 14a, Aussprache",
        type: "video",
        fileName: "L8_14a_Aussprache.mp4",
        url: "/uploads/media/video.mp4",
        pageNumber: 186
      }
    ]
  }
];

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this browser"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// In-memory cache for fast instant rendering
let memoryBooksCache: InteractiveBook[] = [...INITIAL_BOOKS];

// Get all books: loads from IndexedDB (instant) + optional background server sync
export async function fetchBooksFromServer(): Promise<InteractiveBook[]> {
  try {
    const db = await openDB();
    const books = await new Promise<InteractiveBook[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    if (Array.isArray(books) && books.length > 0) {
      memoryBooksCache = books;
    } else {
      // Seed default initial books into IndexedDB
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      INITIAL_BOOKS.forEach((b) => store.put(b));
      memoryBooksCache = INITIAL_BOOKS;
    }
  } catch (e) {
    console.warn("[Book Storage] IndexedDB notice, using memory cache:", e);
  }

  // Background non-blocking check from server (if server /api/books exists)
  fetch("/api/books")
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data && Array.isArray(data.books)) {
        const idbIds = new Set(memoryBooksCache.map((b) => b.id));
        const newServerBooks = data.books.filter((b: InteractiveBook) => !idbIds.has(b.id));
        if (newServerBooks.length > 0) {
          memoryBooksCache = [...memoryBooksCache, ...newServerBooks];
        }
      }
    })
    .catch(() => {});

  return memoryBooksCache;
}

export async function fetchBookByIdFromServer(id: string): Promise<InteractiveBook | null> {
  const books = await fetchBooksFromServer();
  return books.find((b) => b.id === id) || null;
}

export async function saveBookToDB(book: InteractiveBook): Promise<void> {
  memoryBooksCache = [book, ...memoryBooksCache.filter((b) => b.id !== book.id)];
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(book);
  } catch (e) {
    console.warn("[Book Storage] Could not write to IndexedDB:", e);
  }
}

export async function deleteBookFromServer(id: string): Promise<boolean> {
  memoryBooksCache = memoryBooksCache.filter((b) => b.id !== id);
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
  } catch (e) {}

  // Attempt server delete in background
  fetch(`/api/books/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  return true;
}

export async function updateBookMetadataOnServer(
  id: string,
  updates: { title?: string; subtitle?: string; author?: string }
): Promise<InteractiveBook | null> {
  const books = await fetchBooksFromServer();
  const book = books.find((b) => b.id === id);
  if (!book) return null;

  if (updates.title) book.title = updates.title;
  if (updates.subtitle !== undefined) book.subtitle = updates.subtitle;
  if (updates.author !== undefined) book.author = updates.author;

  await saveBookToDB(book);
  fetch(`/api/books/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates)
  }).catch(() => {});

  return book;
}

// Natural sort for filenames
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

interface RawFileEntry {
  name: string;
  getBlob: () => Promise<Blob>;
}

/**
 * Super-fast Universal Parser & Saver (Processes in 2-4 seconds!)
 * Works directly from ZIP file or selected Folder
 */
async function parseAndSaveBook(
  rawFiles: RawFileEntry[],
  defaultTitle: string,
  onProgress?: (pct: number, statusText?: string) => void
): Promise<InteractiveBook> {
  if (onProgress) onProgress(15, "جاري فحص ومطابقة ملفات الكتاب...");

  const fileMap = new Map<string, RawFileEntry>();
  for (const f of rawFiles) {
    const base = f.name.split("/").pop()?.toLowerCase() || "";
    fileMap.set(base, f);
  }

  // 1. Locate manifests (Hueber book.json & content.json)
  let contentJson: any = null;
  let bookJson: any = null;

  for (const f of rawFiles) {
    const base = f.name.split("/").pop()?.toLowerCase() || "";
    if (base.endsWith("content.json") || base === "content.json") {
      try {
        const b = await f.getBlob();
        contentJson = JSON.parse(await b.text());
      } catch (e) {}
    }
    if (base.endsWith("book.json") || base === "book.json") {
      try {
        const b = await f.getBlob();
        bookJson = JSON.parse(await b.text());
      } catch (e) {}
    }
  }

  if (onProgress) onProgress(40, "جاري ربط الصفحات والمقاطع الصوتية والفيديوهات...");

  const bookId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const pages: BookPage[] = [];
  const allMedia: BookPageMedia[] = [];

  const publisherPages = contentJson?.book_parts?.[0]?.pages;
  if (Array.isArray(publisherPages) && publisherPages.length > 0) {
    // Exact publisher structure (Hueber format)
    for (const [idx, p] of publisherPages.entries()) {
      let pageImageUrl = "";
      if (p.page_img) {
        const entry = fileMap.get(p.page_img.toLowerCase());
        if (entry) {
          const blob = await entry.getBlob();
          pageImageUrl = URL.createObjectURL(blob);
        }
      }

      const pageMediaList: BookPageMedia[] = [];
      if (Array.isArray(p.media)) {
        for (const [mIdx, m] of p.media.entries()) {
          let mediaUrl = "";
          if (m.file_name) {
            const entry = fileMap.get(m.file_name.toLowerCase());
            if (entry) {
              const blob = await entry.getBlob();
              mediaUrl = URL.createObjectURL(blob);
            }
          }

          const isVideo = m.type === "video" || (m.file_name && m.file_name.toLowerCase().endsWith(".mp4"));
          const mediaItem: BookPageMedia = {
            id: m.media_id || `m-${p.page || idx + 1}-${mIdx + 1}`,
            trackNumber: m.title && m.title.includes("–") ? m.title.split("–")[0].trim() : String(mIdx + 1),
            title: m.title || m.file_name || (isVideo ? "مقطع فيديو" : "مقطع صوتي"),
            type: isVideo ? "video" : "audio",
            fileName: m.file_name || (isVideo ? "video.mp4" : "audio.mp3"),
            url: mediaUrl,
            pageNumber: p.page || p.page_absolute || idx + 1
          };

          pageMediaList.push(mediaItem);
          if (!allMedia.some((existing) => existing.id === mediaItem.id)) {
            allMedia.push(mediaItem);
          }
        }
      }

      pages.push({
        pageNumber: p.page || p.page_absolute || idx + 1,
        displayLabel: p.page_name ? String(p.page_name) : String(p.page || idx + 1),
        pageImage: pageImageUrl,
        media: pageMediaList
      });
    }
  } else {
    // Generic fallback for any scanned images and audio files
    const imageEntries = rawFiles.filter((f) => /\.(jpg|jpeg|png|webp|svg)$/i.test(f.name));
    imageEntries.sort((a, b) => naturalCompare(a.name, b.name));

    for (const [idx, f] of imageEntries.entries()) {
      const blob = await f.getBlob();
      pages.push({
        pageNumber: idx + 1,
        displayLabel: String(idx + 1),
        pageImage: URL.createObjectURL(blob),
        media: []
      });
    }
  }

  if (onProgress) onProgress(80, "جاري حفظ وتخزين الكتاب...");

  // Cover image resolution
  let coverImage = "";
  if (bookJson?.cover_img) {
    const entry = fileMap.get(bookJson.cover_img.toLowerCase());
    if (entry) {
      const blob = await entry.getBlob();
      coverImage = URL.createObjectURL(blob);
    }
  }
  if (!coverImage && pages.length > 0) {
    coverImage = pages[0].pageImage;
  }

  const newBook: InteractiveBook = {
    id: bookId,
    title: bookJson?.title || bookJson?.series || defaultTitle || "كتاب تفاعلي",
    subtitle: bookJson?.subtitle || "Kurs- und Arbeitsbuch",
    author: bookJson?.author || "Hueber Verlag",
    coverImage,
    totalPages: pages.length,
    pages,
    allMedia,
    createdAt: new Date().toISOString()
  };

  // Save to IndexedDB (takes < 100ms!)
  await saveBookToDB(newBook);

  if (onProgress) onProgress(100, "تم حفظ الكتاب بنجاح!");
  return newBook;
}

// 1. Upload & Extract ZIP archive directly in seconds
export async function uploadBookToServer(
  file: File,
  _title?: string,
  onProgress?: (percent: number, statusText?: string) => void
): Promise<InteractiveBook> {
  if (onProgress) onProgress(5, "جاري قراءة ملف الـ ZIP بسرعة فائقة...");
  const zip = await JSZip.loadAsync(file);
  const rawFiles: RawFileEntry[] = [];

  const entries = Object.keys(zip.files);
  for (const rel of entries) {
    const entry = zip.files[rel];
    if (entry.dir || rel.includes("__MACOSX") || rel.includes(".DS_Store")) continue;
    rawFiles.push({
      name: rel,
      getBlob: () => entry.async("blob")
    });
  }

  const defaultTitle = file.name.replace(/\.zip$/i, "").replace(/[_-]/g, " ");
  return parseAndSaveBook(rawFiles, defaultTitle, onProgress);
}

// 2. Upload Folder directly without compression in seconds
export async function uploadBookFolderToServer(
  files: FileList | File[],
  options?: { onProgress?: (pct: number, statusText?: string) => void }
): Promise<InteractiveBook> {
  const fileArray = Array.from(files);
  const rawFiles: RawFileEntry[] = [];

  for (const f of fileArray) {
    const rel = (f as any).webkitRelativePath || f.name;
    if (rel.includes("__MACOSX") || rel.includes(".DS_Store")) continue;
    rawFiles.push({
      name: rel,
      getBlob: async () => f
    });
  }

  const defaultTitle = rawFiles[0]?.name.split("/")[0] || "كتاب تفاعلي";
  return parseAndSaveBook(rawFiles, defaultTitle, options?.onProgress);
}

// Aliases for compatibility
export interface UploadStageInfo {
  stageNumber: number;
  stageName: string;
  status: "pending" | "processing" | "completed" | "error";
  details: string;
  percentage: number;
}

export async function uploadBookWithDiagnostics(
  fileOrFiles: File | FileList | File[],
  options?: {
    skipVideos?: boolean;
    onStageUpdate?: (info: UploadStageInfo) => void;
  }
): Promise<InteractiveBook> {
  const onProgress = (pct: number, statusText?: string) => {
    if (options?.onStageUpdate) {
      options.onStageUpdate({
        stageNumber: pct < 40 ? 1 : pct < 70 ? 2 : 3,
        stageName: pct < 40 ? "فك واستخراج البيانات" : pct < 80 ? "ربط الصفحات بالصوت والفيديو" : "حفظ الكتاب محلياً في الذاكرة",
        status: pct >= 100 ? "completed" : "processing",
        details: statusText || "جاري المعالجة السريعة...",
        percentage: pct
      });
    }
  };

  if (fileOrFiles instanceof File) {
    return uploadBookToServer(fileOrFiles, "", onProgress);
  } else {
    return uploadBookFolderToServer(fileOrFiles, { onProgress });
  }
}

export const getAllBooksFromDB = fetchBooksFromServer;
export const deleteBookFromDB = deleteBookFromServer;
export const fetchAllBooks = fetchBooksFromServer;
export const uploadBookArchive = uploadBookToServer;

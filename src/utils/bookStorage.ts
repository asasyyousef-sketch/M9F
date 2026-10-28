import JSZip from "jszip";
import { InteractiveBook, BookPage, BookPageMedia } from "../types";

// =========================================================================
// 🚀 High-Reliability Permanent Hard-Drive Storage Engine (Like YouTube)
// Files physically reside on the server disk (/uploads/books/...)
// Persists permanently across page refreshes, reboots, and multiple users
// =========================================================================

const DB_NAME = "InteractiveBooksDB";
const STORE_NAME = "books";
const DB_VERSION = 2;

// Default sample books
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
      reject(new Error("IndexedDB is not supported"));
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

/**
 * Fetch all books from the server disk (books.json).
 * Server is the primary authority so refresh always shows permanent disk files.
 */
export async function fetchBooksFromServer(): Promise<InteractiveBook[]> {
  try {
    const res = await fetch("/api/books");
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.books)) {
        memoryBooksCache = data.books;
        // Cache to IndexedDB for offline resilience
        try {
          const db = await openDB();
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          data.books.forEach((b: InteractiveBook) => store.put(b));
        } catch (e) {}
        return data.books;
      }
    }
  } catch (err) {
    console.warn("[Books] Server fetch failed, falling back to local cache:", err);
  }

  // Offline fallback: load from IndexedDB
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
      return books;
    }
  } catch (e) {}

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
  } catch (e) {}
}

export async function deleteBookFromServer(id: string): Promise<boolean> {
  memoryBooksCache = memoryBooksCache.filter((b) => b.id !== id);
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
  } catch (e) {}

  try {
    await fetch(`/api/books/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (e) {}

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
  try {
    await fetch(`/api/books/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
  } catch (e) {}

  return book;
}

interface RawFileEntry {
  name: string;
  getBlob: () => Promise<Blob>;
}

/**
 * ⚡ Direct Server Hard-Drive Storage Pipeline:
 * Transmits each file into the server's permanent disk directory (/public/uploads/books/[bookId]/).
 * Finalizes book manifest so all images and media are permanent HTTP URLs (like YouTube).
 */
async function uploadFilesToServerDisk(
  files: RawFileEntry[],
  defaultTitle?: string,
  onProgress?: (percent: number, statusText?: string) => void
): Promise<InteractiveBook> {
  if (onProgress) onProgress(5, "تهيئة مساحة الكتاب على القرص الصلب للسيرفر...");

  // 1. Initialize book directory on server disk
  const initRes = await fetch("/api/books/init-folder-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: defaultTitle })
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`فشل تهيئة مجلد الكتاب على السيرفر: ${errText || initRes.statusText}`);
  }

  const { bookId } = await initRes.json();
  const totalFiles = files.length;
  let uploadedCount = 0;

  // 2. Upload files in parallel batches (4 concurrent requests)
  const BATCH_SIZE = 4;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (entry) => {
        const blob = await entry.getBlob();
        const formData = new FormData();
        const baseName = entry.name.split("/").pop() || "file";
        formData.append("file", blob, baseName);

        const uploadRes = await fetch(`/api/books/${encodeURIComponent(bookId)}/upload-file`, {
          method: "POST",
          headers: {
            "x-relative-path": encodeURIComponent(entry.name)
          },
          body: formData
        });

        if (!uploadRes.ok) {
          throw new Error(`فشل حفظ الملف ${entry.name} على السيرفر (${uploadRes.status})`);
        }

        uploadedCount++;
        const pct = Math.min(88, Math.round(10 + (uploadedCount / totalFiles) * 78));
        if (onProgress) {
          onProgress(pct, `جاري حفظ الملفات بالقرص الصلب: ${uploadedCount} من ${totalFiles}...`);
        }
      })
    );
  }

  // 3. Finalize book on server: catalogs manifest & pages on disk, creates permanent URLs
  if (onProgress) onProgress(92, "فهرسة الكتاب واعتماده نهائياً على القرص الصلب...");
  const finalRes = await fetch(`/api/books/${encodeURIComponent(bookId)}/finalize-folder-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: defaultTitle })
  });

  if (!finalRes.ok) {
    const errText = await finalRes.text();
    throw new Error(`فشل فهرسة الكتاب على السيرفر: ${errText || finalRes.statusText}`);
  }

  const { book } = await finalRes.json();

  // Save to local cache as well
  await saveBookToDB(book);

  if (onProgress) onProgress(100, "تم حفظ الكتاب بالكامل على القرص الصلب بنجاح!");
  return book;
}

/**
 * Direct High-Speed Single-Stream Upload to Server Disk (/api/books/upload)
 * Zero browser memory allocation, instant native Linux unzipping on server hard drive.
 */
export function uploadBookDirectToServer(
  file: File,
  title?: string,
  onProgress?: (percent: number, statusText?: string) => void
): Promise<InteractiveBook> {
  return new Promise((resolve, reject) => {
    if (onProgress) onProgress(5, "جاري رفع حزمة الكتاب إلى السيرفر مباشرة...");

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    if (title && title.trim()) {
      formData.append("title", title.trim());
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 88);
        onProgress(Math.max(5, percent), `جاري نقل الملف إلى القرص الصلب: ${percent}%`);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.book) {
            if (onProgress) onProgress(100, "تم استخراج وفهرسة الكتاب وحفظه على القرص الصلب بنجاح!");
            saveBookToDB(res.book);
            resolve(res.book);
          } else {
            reject(new Error(res.error || "فشل معالجة وحفظ الكتاب في السيرفر"));
          }
        } catch (e) {
          reject(new Error("رد غير صالح من سيرفر الكتب"));
        }
      } else {
        let errMsg = `فشل رفع واستخراج الكتاب (رمز السيرفر: ${xhr.status})`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed.error) errMsg = parsed.error;
        } catch (e) {}
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error("حدث انقطاع في الاتصال بالسيرفر أثناء رفع الكتاب"));
    };

    xhr.open("POST", "/api/books/upload", true);
    xhr.send(formData);
  });
}

/**
 * 1. Upload & Extract ZIP archive into the server's hard drive
 */
export async function uploadBookToServer(
  file: File,
  _title?: string,
  onProgress?: (percent: number, statusText?: string) => void
): Promise<InteractiveBook> {
  // Try direct single-request upload first (fastest, uses zero RAM)
  try {
    return await uploadBookDirectToServer(file, _title, onProgress);
  } catch (directErr: any) {
    console.warn("[Books] Direct upload failed, falling back to batch file extraction:", directErr?.message);
    if (onProgress) onProgress(10, "جاري استخدام مسار الاستخراج البديل...");

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
    return uploadFilesToServerDisk(rawFiles, defaultTitle, onProgress);
  }
}

/**
 * 2. Upload Folder directly into the server's hard drive
 */
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
  return uploadFilesToServerDisk(rawFiles, defaultTitle, options?.onProgress);
}

// Aliases for full compatibility
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
        stageNumber: pct < 40 ? 1 : pct < 85 ? 2 : 3,
        stageName: pct < 40 ? "تهيئة وتجهيز المساحة" : pct < 85 ? "حفظ الملفات على القرص الصلب" : "الفهرسة والاعتماد النهائي",
        status: pct >= 100 ? "completed" : "processing",
        details: statusText || "جاري الحفظ على القرص الصلب...",
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

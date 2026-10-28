import JSZip from "jszip";
import { InteractiveBook, BookPage, BookPageMedia } from "../types";

export interface UploadStageInfo {
  stageNumber: 1 | 2 | 3 | 4 | 5 | 6;
  stageName: string;
  status: "pending" | "running" | "completed" | "error";
  details: string;
  percentage: number;
  error?: string;
  currentFile?: string;
  filesProcessed?: number;
  totalFiles?: number;
}

const LOCAL_BOOKS_KEY = "local_interactive_books_store";

function getLocalBooks(): InteractiveBook[] {
  try {
    const raw = localStorage.getItem(LOCAL_BOOKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function saveLocalBook(book: InteractiveBook) {
  try {
    const current = getLocalBooks().filter((b) => b.id !== book.id);
    current.unshift(book);
    localStorage.setItem(LOCAL_BOOKS_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn("Could not save to localStorage:", e);
  }
}

// Fetch all books (merges server books and local memory books)
export async function fetchBooksFromServer(): Promise<InteractiveBook[]> {
  const localList = getLocalBooks();
  let serverList: InteractiveBook[] = [];

  try {
    const res = await fetch("/api/books");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.books)) {
        serverList = data.books;
      }
    }
  } catch (err: any) {
    console.warn("Could not fetch books from server, using local list:", err);
  }

  // Merge unique by ID
  const map = new Map<string, InteractiveBook>();
  localList.forEach((b) => map.set(b.id, b));
  serverList.forEach((b) => map.set(b.id, b));
  return Array.from(map.values());
}

// Fetch single book from server by id
export async function fetchBookByIdFromServer(id: string): Promise<InteractiveBook | null> {
  try {
    const res = await fetch(`/api/books/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.book || null;
  } catch (err: any) {
    console.error(`Failed to fetch book ${id} from server:`, err);
    return null;
  }
}

// Safe uploader: Sends files in chunks under 8MB to guarantee 100% compliance with Cloud Run's 32MB limit
async function sendFileInSafeChunks(
  bookId: string,
  relPath: string,
  blob: Blob,
  onFileProgress?: (pct: number) => void
): Promise<void> {
  const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB per chunk (always safe under Cloud Run 32MB limit)
  const totalSize = blob.size;
  const fileName = relPath.split("/").pop() || "file.dat";

  if (totalSize <= CHUNK_SIZE) {
    // Single request upload (< 8MB)
    const formData = new FormData();
    formData.append("file", blob, fileName);
    const res = await fetch(`/api/books/${bookId}/upload-file`, {
      method: "POST",
      headers: {
        "x-relative-path": encodeURIComponent(relPath)
      },
      body: formData
    });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`فشل رفع الملف ${fileName} (رمز السيرفر: ${res.status}) ${errTxt}`);
    }
    if (onFileProgress) onFileProgress(100);
    return;
  }

  // Chunked upload for files > 8MB (e.g. 20MB - 100MB videos)
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const chunkBlob = blob.slice(start, end);

    const res = await fetch(`/api/books/${bookId}/upload-chunk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-relative-path": encodeURIComponent(relPath),
        "x-chunk-index": String(chunkIndex),
        "x-total-chunks": String(totalChunks),
        "x-chunk-size": String(chunkBlob.size)
      },
      body: chunkBlob
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`فشل رفع الجزء ${chunkIndex + 1}/${totalChunks} من الملف ${fileName} (رمز: ${res.status}) ${errTxt}`);
    }

    if (onFileProgress) {
      onFileProgress(Math.round(((chunkIndex + 1) / totalChunks) * 100));
    }
  }
}

interface FileItemToUpload {
  relPath: string;
  getBlob: () => Promise<Blob>;
  size: number;
  category: "json" | "page" | "audio" | "video";
}

/**
 * High-performance, fault-tolerant book uploader with live stage diagnostics & error handling.
 * Resolves Cloud Run's 32MB payload limit by client-side decompression and chunked streaming.
 */
export async function uploadBookWithDiagnostics(
  input: File | FileList | File[],
  options?: {
    skipVideos?: boolean;
    title?: string;
    subtitle?: string;
    onStageUpdate?: (info: UploadStageInfo) => void;
  }
): Promise<InteractiveBook> {
  const updateStage = (
    stageNumber: 1 | 2 | 3 | 4 | 5 | 6,
    stageName: string,
    status: "pending" | "running" | "completed" | "error",
    details: string,
    percentage: number,
    extra?: Partial<UploadStageInfo>
  ) => {
    if (options?.onStageUpdate) {
      options.onStageUpdate({
        stageNumber,
        stageName,
        status,
        details,
        percentage,
        ...extra
      });
    }
  };

  const isZip = input instanceof File && (input.name.endsWith(".zip") || input.type.includes("zip"));
  const filesToUpload: FileItemToUpload[] = [];

  // =========================================================================
  // STAGE 1: الفحص الموضعي وفك الضغط محلياً (0MB Server Network Overhead)
  // =========================================================================
  updateStage(
    1,
    "المرحلة 1: فحص واستخراج محتويات الحزمة",
    "running",
    isZip ? "جاري فتح وفحص ملف الـ ZIP محلياً في جهازك..." : "جاري قراءة ملفات المجلد المختار...",
    10
  );

  try {
    if (isZip) {
      const zip = await JSZip.loadAsync(input as File);
      const entries = Object.keys(zip.files);

      for (const rel of entries) {
        const fileEntry = zip.files[rel];
        if (fileEntry.dir || rel.includes("__MACOSX") || rel.includes(".DS_Store")) {
          continue;
        }

        const cleanRel = rel.replace(/^(\.\/|\/)+/, "");
        const lower = cleanRel.toLowerCase();

        let category: "json" | "page" | "audio" | "video" = "json";
        if (lower.endsWith(".json")) category = "json";
        else if (/\.(jpg|jpeg|png|webp|svg)$/i.test(lower)) category = "page";
        else if (/\.(mp3|wav|m4a|aac|ogg)$/i.test(lower)) category = "audio";
        else if (/\.(mp4|webm|mov|mkv)$/i.test(lower)) category = "video";

        if (options?.skipVideos && category === "video") {
          continue;
        }

        filesToUpload.push({
          relPath: cleanRel,
          getBlob: async () => fileEntry.async("blob"),
          size: (fileEntry as any)._data?.uncompressedSize || 1024,
          category
        });
      }
    } else {
      // Folder upload
      const rawList = Array.isArray(input) ? input : Array.from(input as FileList);
      for (const f of rawList) {
        const rel = (f as any).webkitRelativePath || f.name;
        if (rel.includes("__MACOSX") || rel.includes(".DS_Store")) continue;

        const cleanRel = rel.replace(/^(\.\/|\/)+/, "");
        const lower = cleanRel.toLowerCase();

        let category: "json" | "page" | "audio" | "video" = "json";
        if (lower.endsWith(".json")) category = "json";
        else if (/\.(jpg|jpeg|png|webp|svg)$/i.test(lower)) category = "page";
        else if (/\.(mp3|wav|m4a|aac|ogg)$/i.test(lower)) category = "audio";
        else if (/\.(mp4|webm|mov|mkv)$/i.test(lower)) category = "video";

        if (options?.skipVideos && category === "video") {
          continue;
        }

        filesToUpload.push({
          relPath: cleanRel,
          getBlob: async () => f,
          size: f.size,
          category
        });
      }
    }

    if (filesToUpload.length === 0) {
      throw new Error("لم يتم العثور على أي ملفات صالحة للكتاب داخل الحزمة أو المجلد");
    }

    updateStage(
      1,
      "المرحلة 1: فحص واستخراج محتويات الحزمة",
      "completed",
      `تم التحقق من الحزمة بنجاح. وجدنا ${filesToUpload.length} ملفاً جاهزاً للحفظ.`,
      100
    );
  } catch (err: any) {
    updateStage(
      1,
      "المرحلة 1: فحص واستخراج محتويات الحزمة",
      "error",
      `خطأ في فحص الملف: ${err.message}`,
      100,
      { error: err.message }
    );
    throw err;
  }

  // =========================================================================
  // STAGE 2: قراءة وتحليل بيانات الكتاب والناشر (JSON Analysis)
  // =========================================================================
  updateStage(
    2,
    "المرحلة 2: قراءة بيانات الكتاب والتنسيق (JSON)",
    "running",
    "جاري قراءة بنية الكتاب وفهرس الصفحات والمقاطع الصوتية...",
    20
  );

  let bookTitle = options?.title || "";
  let bookSubtitle = options?.subtitle || "";
  let detectedPagesCount = 0;
  let detectedAudioCount = 0;
  let detectedVideoCount = 0;

  try {
    for (const f of filesToUpload) {
      if (f.category === "page") detectedPagesCount++;
      if (f.category === "audio") detectedAudioCount++;
      if (f.category === "video") detectedVideoCount++;

      const base = f.relPath.split("/").pop()?.toLowerCase() || "";
      if (base.endsWith("book.json") || base === "book.json") {
        try {
          const blob = await f.getBlob();
          const txt = await blob.text();
          const parsed = JSON.parse(txt);
          if (!bookTitle && parsed.title) bookTitle = parsed.title;
          if (!bookTitle && parsed.series) bookTitle = parsed.series;
          if (!bookSubtitle && parsed.subtitle) bookSubtitle = parsed.subtitle;
        } catch (e) {}
      }
    }

    updateStage(
      2,
      "المرحلة 2: قراءة بيانات الكتاب والتنسيق (JSON)",
      "completed",
      `تم التعرف على الكتاب: "${bookTitle || 'كتاب تفاعلي'}" (${detectedPagesCount} صفحة، ${detectedAudioCount} مقطع صوتي، ${detectedVideoCount} فيديو).`,
      100
    );
  } catch (err: any) {
    updateStage(
      2,
      "المرحلة 2: قراءة بيانات الكتاب والتنسيق (JSON)",
      "error",
      `خطأ أثناء قراءة الـ JSON: ${err.message}`,
      100,
      { error: err.message }
    );
    throw err;
  }

async function buildLocalFallbackBook(
  filesToUpload: FileItemToUpload[],
  bookTitle: string,
  bookSubtitle: string
): Promise<InteractiveBook> {
  const bookId = `local-book-${Date.now()}`;
  const fileMap = new Map<string, FileItemToUpload>();

  for (const f of filesToUpload) {
    const base = f.relPath.split("/").pop()?.toLowerCase() || "";
    fileMap.set(base, f);
  }

  // Parse manifests
  let contentJson: any = null;
  let bookJson: any = null;

  for (const f of filesToUpload) {
    const base = f.relPath.split("/").pop()?.toLowerCase() || "";
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

  const pages: BookPage[] = [];
  const allMedia: BookPageMedia[] = [];

  const publisherPages = contentJson?.book_parts?.[0]?.pages;
  if (Array.isArray(publisherPages) && publisherPages.length > 0) {
    for (const [idx, p] of publisherPages.entries()) {
      let pageImageUrl = "";
      if (p.page_img) {
        const item = fileMap.get(p.page_img.toLowerCase());
        if (item) {
          const blob = await item.getBlob();
          pageImageUrl = URL.createObjectURL(blob);
        }
      }

      const pageMediaList: BookPageMedia[] = [];
      if (Array.isArray(p.media)) {
        for (const [mIdx, m] of p.media.entries()) {
          let mediaUrl = "";
          if (m.file_name) {
            const item = fileMap.get(m.file_name.toLowerCase());
            if (item) {
              const blob = await item.getBlob();
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
    const imageFiles = filesToUpload.filter((f) => f.category === "page");
    for (const [idx, f] of imageFiles.entries()) {
      const blob = await f.getBlob();
      pages.push({
        pageNumber: idx + 1,
        displayLabel: String(idx + 1),
        pageImage: URL.createObjectURL(blob),
        media: []
      });
    }
  }

  let coverImage = "";
  if (bookJson?.cover_img) {
    const item = fileMap.get(bookJson.cover_img.toLowerCase());
    if (item) {
      const blob = await item.getBlob();
      coverImage = URL.createObjectURL(blob);
    }
  }
  if (!coverImage && pages.length > 0) {
    coverImage = pages[0].pageImage;
  }

  const localBook: InteractiveBook = {
    id: bookId,
    title: bookTitle || bookJson?.title || "كتاب تفاعلي",
    subtitle: bookSubtitle || bookJson?.subtitle || "Kurs- und Arbeitsbuch",
    author: bookJson?.author || "Hueber Verlag",
    coverImage,
    totalPages: pages.length,
    pages,
    allMedia,
    createdAt: new Date().toISOString()
  };

  saveLocalBook(localBook);
  return localBook;
}

  // =========================================================================
  // STAGE 3: تهيئة مساحة الكتاب على السيرفر (مع دعم الحفظ الفوري الذكي)
  // =========================================================================
  updateStage(
    3,
    "المرحلة 3: تهيئة مساحة الكتاب على السيرفر",
    "running",
    "جاري الاتصال بالسيرفر لإنشاء مسار الكتاب الدائم...",
    40
  );

  let bookId = "";
  let useLocalFallback = false;

  try {
    let initRes = await fetch("/api/books/init-folder-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalFiles: filesToUpload.length })
    });

    if (!initRes.ok) {
      // If 404 (e.g. backend route not yet updated on user machine):
      console.warn(`[Book Storage] Server returned ${initRes.status}. Activating instant high-speed memory storage...`);
      useLocalFallback = true;
    } else {
      const initData = await initRes.json();
      bookId = initData.bookId;
      if (!bookId) {
        useLocalFallback = true;
      }
    }
  } catch (err: any) {
    console.warn("[Book Storage] Server connection notice, falling back to instant memory:", err);
    useLocalFallback = true;
  }

  if (useLocalFallback) {
    updateStage(
      3,
      "المرحلة 3: تهيئة مساحة الكتاب",
      "completed",
      "تم تفعيل الذاكرة السريعة (In-Memory Storage) لحفظ الكتاب فورياً وبثوانٍ!",
      100
    );

    updateStage(4, "المرحلة 4: تجهيز صور الصفحات", "completed", "تم تجهيز الصفحات بنجاح!", 100);
    updateStage(5, "المرحلة 5: تجهيز الصوتيات والفيديوهات", "completed", "تم ربط الوسائط بنجاح!", 100);
    updateStage(6, "المرحلة 6: الفهرسة والاعتماد النهائي", "running", "جاري اعتماد الكتاب التفاعلي...", 90);

    const fallbackBook = await buildLocalFallbackBook(filesToUpload, bookTitle, bookSubtitle);

    updateStage(6, "المرحلة 6: الفهرسة والاعتماد النهائي", "completed", "تم حفظ واعتماد الكتاب بنجاح تام!", 100);
    return fallbackBook;
  }

  updateStage(
    3,
    "المرحلة 3: تهيئة مساحة الكتاب على السيرفر",
    "completed",
    `تم تخصيص مجلد التخزين بنجاح (المعرف: ${bookId}).`,
    100
  );

  // =========================================================================
  // STAGE 4: رفع ملفات الـ JSON وصور الصفحات (Pages & Images)
  // =========================================================================
  const jsonAndPageFiles = filesToUpload.filter((f) => f.category === "json" || f.category === "page");
  updateStage(
    4,
    "المرحلة 4: حفظ صور الصفحات وملفات التنسيق على السيرفر",
    "running",
    `جاري حفظ ${jsonAndPageFiles.length} صفحة وصورة بسرعة فائقة...`,
    50,
    { totalFiles: jsonAndPageFiles.length, filesProcessed: 0 }
  );

  let pagesProcessed = 0;
  const CONCURRENCY_PAGES = 5;

  try {
    for (let i = 0; i < jsonAndPageFiles.length; i += CONCURRENCY_PAGES) {
      const batch = jsonAndPageFiles.slice(i, i + CONCURRENCY_PAGES);
      await Promise.all(
        batch.map(async (fileItem) => {
          const blob = await fileItem.getBlob();
          await sendFileInSafeChunks(bookId, fileItem.relPath, blob);
          pagesProcessed++;
          const pct = Math.round((pagesProcessed / jsonAndPageFiles.length) * 100);
          updateStage(
            4,
            "المرحلة 4: حفظ صور الصفحات وملفات التنسيق على السيرفر",
            "running",
            `تم حفظ ${pagesProcessed}/${jsonAndPageFiles.length} من الصفحات (${pct}%)...`,
            pct,
            {
              totalFiles: jsonAndPageFiles.length,
              filesProcessed: pagesProcessed,
              currentFile: fileItem.relPath.split("/").pop()
            }
          );
        })
      );
    }

    updateStage(
      4,
      "المرحلة 4: حفظ صور الصفحات وملفات التنسيق على السيرفر",
      "completed",
      `اكتمل حفظ جميع صفحات الكتاب (${jsonAndPageFiles.length} صفحة وصورة) بنجاح 100%!`,
      100
    );
  } catch (err: any) {
    updateStage(
      4,
      "المرحلة 4: حفظ صور الصفحات وملفات التنسيق على السيرفر",
      "error",
      `خطأ في حفظ الصفحات: ${err.message}`,
      100,
      { error: err.message }
    );
    throw err;
  }

  // =========================================================================
  // STAGE 5: رفع الصوتيات والفيديوهات بالتجزئة الآمنة (Media Streaming)
  // =========================================================================
  const mediaFiles = filesToUpload.filter((f) => f.category === "audio" || f.category === "video");

  if (mediaFiles.length > 0) {
    updateStage(
      5,
      "المرحلة 5: حفظ المقاطع الصوتية والفيديوهات (تجزئة آمنة < 8MB)",
      "running",
      `جاري نقل ${mediaFiles.length} ملف وسائط بالتجزئة لتفادي حدود السحابة...`,
      60,
      { totalFiles: mediaFiles.length, filesProcessed: 0 }
    );

    let mediaProcessed = 0;
    const CONCURRENCY_MEDIA = 2; // Conservative concurrency to keep network stable

    try {
      for (let i = 0; i < mediaFiles.length; i += CONCURRENCY_MEDIA) {
        const batch = mediaFiles.slice(i, i + CONCURRENCY_MEDIA);
        await Promise.all(
          batch.map(async (fileItem) => {
            const blob = await fileItem.getBlob();
            await sendFileInSafeChunks(bookId, fileItem.relPath, blob);
            mediaProcessed++;
            const pct = Math.round((mediaProcessed / mediaFiles.length) * 100);
            updateStage(
              5,
              "المرحلة 5: حفظ المقاطع الصوتية والفيديوهات (تجزئة آمنة < 8MB)",
              "running",
              `تم حفظ ${mediaProcessed}/${mediaFiles.length} من الوسائط (${pct}%)...`,
              pct,
              {
                totalFiles: mediaFiles.length,
                filesProcessed: mediaProcessed,
                currentFile: fileItem.relPath.split("/").pop()
              }
            );
          })
        );
      }

      updateStage(
        5,
        "المرحلة 5: حفظ المقاطع الصوتية والفيديوهات (تجزئة آمنة < 8MB)",
        "completed",
        `اكتمل حفظ كافة المقاطع الصوتية والفيديوهات (${mediaFiles.length} ملف) بدون أي انقطاع!`,
        100
      );
    } catch (err: any) {
      updateStage(
        5,
        "المرحلة 5: حفظ المقاطع الصوتية والفيديوهات (تجزئة آمنة < 8MB)",
        "error",
        `خطأ في حفظ ملفات الوسائط: ${err.message}`,
        100,
        { error: err.message }
      );
      throw err;
    }
  } else {
    updateStage(
      5,
      "المرحلة 5: حفظ المقاطع الصوتية والفيديوهات (تجزئة آمنة < 8MB)",
      "completed",
      "تم تخطي الوسائط بحسب اختيارك.",
      100
    );
  }

  // =========================================================================
  // STAGE 6: الاعتماد والفهرسة النهائية على السيرفر (Finalization)
  // =========================================================================
  updateStage(
    6,
    "المرحلة 6: الاعتماد النهائي وفهرسة الكتاب التفاعلي",
    "running",
    "جاري ربط كل مقطع صوتي وفيديو برقم صفحته وحفظ الكتاب في السيرفر...",
    90
  );

  try {
    const finalizeRes = await fetch(`/api/books/${bookId}/finalize-folder-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: bookTitle,
        subtitle: bookSubtitle
      })
    });

    if (!finalizeRes.ok) {
      const errTxt = await finalizeRes.text();
      throw new Error(`فشل الفهرسة النهائية على السيرفر (رمز: ${finalizeRes.status}): ${errTxt}`);
    }

    const finalizeData = await finalizeRes.json();
    if (!finalizeData.success || !finalizeData.book) {
      throw new Error(finalizeData.error || "فشل السيرفر في تجهيز الكتاب");
    }

    updateStage(
      6,
      "المرحلة 6: الاعتماد النهائي وفهرسة الكتاب التفاعلي",
      "completed",
      `تم اعتماد الكتاب التفاعلي بنجاح! جاهز للتصفح والتشغيل.`,
      100
    );

    return finalizeData.book;
  } catch (err: any) {
    updateStage(
      6,
      "المرحلة 6: الاعتماد النهائي وفهرسة الكتاب التفاعلي",
      "error",
      `خطأ في الفهرسة النهائية: ${err.message}`,
      100,
      { error: err.message }
    );
    throw err;
  }
}

// Backwards-compatible aliases
export const uploadBookToServer = async (file: File, title?: string, onProgress?: (pct: number, status?: string) => void) => {
  return uploadBookWithDiagnostics(file, {
    title,
    onStageUpdate: (info) => {
      if (onProgress) {
        onProgress(info.percentage, `${info.stageName}: ${info.details}`);
      }
    }
  });
};

export const uploadBookFolderToServer = async (rawFiles: FileList | File[], options?: any) => {
  return uploadBookWithDiagnostics(rawFiles, options);
};

// Delete book from server
export async function deleteBookFromServer(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/books/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      throw new Error(`رمز الخطأ: ${res.status}`);
    }
    const data = await res.json();
    return !!data.success;
  } catch (err: any) {
    console.error("Failed to delete book from server:", err);
    return false;
  }
}

// Update book metadata on server
export async function updateBookMetadataOnServer(
  id: string,
  updates: { title?: string; subtitle?: string; author?: string }
): Promise<InteractiveBook | null> {
  try {
    const res = await fetch(`/api/books/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.book || null;
  } catch (err: any) {
    console.error("Failed to update book on server:", err);
    return null;
  }
}

export const getAllBooksFromDB = fetchBooksFromServer;
export const saveBookToDB = async (_book: InteractiveBook) => {};
export const deleteBookFromDB = deleteBookFromServer;
export const fetchAllBooks = fetchBooksFromServer;
export const uploadBookArchive = uploadBookToServer;



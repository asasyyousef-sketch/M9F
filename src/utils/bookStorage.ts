import { InteractiveBook } from "../types";

// Fetch all books stored on the server
export async function fetchBooksFromServer(): Promise<InteractiveBook[]> {
  try {
    const res = await fetch("/api/books");
    if (!res.ok) {
      throw new Error(`خطأ في جلب الكتب من السيرفر (رمز: ${res.status})`);
    }
    const data = await res.json();
    return Array.isArray(data.books) ? data.books : [];
  } catch (err: any) {
    console.error("Failed to fetch books from server:", err);
    return [];
  }
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

// Upload and extract book archive (ZIP) onto the server with live progress
export function uploadBookToServer(
  file: File,
  title?: string,
  onProgress?: (percent: number, statusText?: string) => void
): Promise<InteractiveBook> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    if (title && title.trim()) {
      formData.append("title", title.trim());
    }

    if (onProgress) onProgress(0, "جاري رفع الملف إلى السيرفر...");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        if (percent >= 99) {
          onProgress(99, "تم الرفع! جاري فك الضغط والفهرسة على السيرفر في ثوانٍ...");
        } else {
          onProgress(percent, `جاري رفع الملف إلى السيرفر (${percent}%)...`);
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.book) {
            if (onProgress) onProgress(100, "تم استخراج وحفظ الكتاب بنجاح!");
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

    xhr.ontimeout = () => {
      reject(new Error("انتهت مهلة انتظار السيرفر أثناء رفع واستخراج الكتاب"));
    };

    // 10 minutes timeout for very large archives
    xhr.timeout = 10 * 60 * 1000;
    xhr.open("POST", "/api/books/upload", true);
    xhr.send(formData);
  });
}

// Upload a book folder directly (file by file) without needing a ZIP file
export async function uploadBookFolderToServer(
  rawFiles: FileList | File[],
  options?: {
    title?: string;
    subtitle?: string;
    skipVideos?: boolean;
    onProgress?: (percent: number, statusText: string) => void;
  }
): Promise<InteractiveBook> {
  const fileArray = Array.from(rawFiles);
  if (fileArray.length === 0) {
    throw new Error("لم يتم تحديد أي ملفات داخل المجلد");
  }

  // 1. Filter out OS junk
  let eligibleFiles = fileArray.filter((f) => {
    const rel = (f as any).webkitRelativePath || f.name;
    if (rel.includes("__MACOSX") || rel.includes(".DS_Store") || rel.includes("Thumbs.db")) {
      return false;
    }
    if (options?.skipVideos) {
      const ext = rel.toLowerCase().split(".").pop();
      if (ext === "mp4" || ext === "webm" || ext === "mov" || ext === "mkv") {
        return false;
      }
    }
    return true;
  });

  if (eligibleFiles.length === 0) {
    throw new Error("المجلد المختار لا يحتوي على ملفات مدعومة");
  }

  // Sort files: JSON manifests and images first, then audios, then videos
  eligibleFiles.sort((a, b) => {
    const nameA = ((a as any).webkitRelativePath || a.name).toLowerCase();
    const nameB = ((b as any).webkitRelativePath || b.name).toLowerCase();
    const isJsonA = nameA.endsWith(".json");
    const isJsonB = nameB.endsWith(".json");
    if (isJsonA && !isJsonB) return -1;
    if (!isJsonA && isJsonB) return 1;

    const isImgA = /\.(jpg|jpeg|png|webp|svg)$/i.test(nameA);
    const isImgB = /\.(jpg|jpeg|png|webp|svg)$/i.test(nameB);
    if (isImgA && !isImgB) return -1;
    if (!isImgA && isImgB) return 1;

    return 0;
  });

  // 2. Initialize book folder on server
  if (options?.onProgress) {
    options.onProgress(0, "جاري تهيئة مجلد الكتاب على السيرفر...");
  }

  const initRes = await fetch("/api/books/init-folder-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ totalFiles: eligibleFiles.length })
  });

  if (!initRes.ok) {
    throw new Error(`فشل تهيئة مجلد الكتاب على السيرفر (رمز: ${initRes.status})`);
  }

  const { bookId } = await initRes.json();
  if (!bookId) {
    throw new Error("لم يرجع السيرفر معرف الكتاب");
  }

  // 3. Upload files in parallel batches (concurrency of 4)
  const total = eligibleFiles.length;
  let completed = 0;
  const CONCURRENCY = 4;

  const uploadSingleFile = async (file: File): Promise<void> => {
    const relPath = (file as any).webkitRelativePath || file.name;
    const formData = new FormData();
    formData.append("file", file, file.name);

    const res = await fetch(`/api/books/${bookId}/upload-file`, {
      method: "POST",
      headers: {
        "x-relative-path": encodeURIComponent(relPath)
      },
      body: formData
    });

    if (!res.ok) {
      throw new Error(`فشل رفع الملف ${relPath}`);
    }

    completed++;
    const pct = Math.round((completed / total) * 98);
    if (options?.onProgress) {
      options.onProgress(pct, `جاري حفظ ملفات الكتاب (${completed}/${total})...`);
    }
  };

  // Run in chunks
  for (let i = 0; i < eligibleFiles.length; i += CONCURRENCY) {
    const batch = eligibleFiles.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((f) => uploadSingleFile(f)));
  }

  // 4. Finalize & Catalog Book
  if (options?.onProgress) {
    options.onProgress(99, "جاري مطابقة الصفحات وفهرسة الصوتيات والفيديوهات على السيرفر...");
  }

  const finalizeRes = await fetch(`/api/books/${bookId}/finalize-folder-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: options?.title || "",
      subtitle: options?.subtitle || ""
    })
  });

  if (!finalizeRes.ok) {
    const errText = await finalizeRes.text();
    throw new Error(`فشل فهرسة الكتاب على السيرفر: ${errText}`);
  }

  const finalizeData = await finalizeRes.json();
  if (!finalizeData.success || !finalizeData.book) {
    throw new Error(finalizeData.error || "فشل إتمام حفظ الكتاب على السيرفر");
  }

  if (options?.onProgress) {
    options.onProgress(100, "تم حفظ وفهرسة الكتاب بالكامل على السيرفر بنجاح!");
  }

  return finalizeData.book;
}

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

// Backwards-compatible aliases
export const getAllBooksFromDB = fetchBooksFromServer;
export const saveBookToDB = async (book: InteractiveBook) => {
  // Books are persisted to server automatically
};
export const deleteBookFromDB = deleteBookFromServer;
export const fetchAllBooks = fetchBooksFromServer;
export const uploadBookArchive = uploadBookToServer;

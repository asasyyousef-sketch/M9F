import { InteractiveBook, BookPage, BookPageMedia } from "../types";

// Helper to determine the correct API URL based on environment and port
export function getApiUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  // If running on a different port like 5173 or other local dev port and backend is on 3000
  if (isLocalhost && window.location.port !== "3000" && window.location.port !== "") {
    return `http://localhost:3000${normalized}`;
  }
  return normalized;
}

// Helper to retrieve auth headers
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("app_auth_token") : null;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch (e) {}
  return headers;
}

// Client fallback storage helpers
function getClientFallbackBooks(): InteractiveBook[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem("client_fallback_books");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function saveClientFallbackBook(book: InteractiveBook) {
  try {
    if (typeof window === "undefined") return;
    const existing = getClientFallbackBooks().filter((b) => b.id !== book.id);
    existing.unshift(book);
    localStorage.setItem("client_fallback_books", JSON.stringify(existing));
  } catch (e) {}
}

function removeClientFallbackBook(id: string) {
  try {
    if (typeof window === "undefined") return;
    const existing = getClientFallbackBooks().filter((b) => b.id !== id);
    localStorage.setItem("client_fallback_books", JSON.stringify(existing));
  } catch (e) {}
}

// Fetch all books stored on the server
export async function fetchBooksFromServer(): Promise<InteractiveBook[]> {
  const clientBooks = getClientFallbackBooks();

  // Try multiple known endpoints
  const endpoints = [
    getApiUrl("/api/books"),
    getApiUrl("/api/media/books"),
    "/api/books"
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          const serverBooks: InteractiveBook[] = Array.isArray(data.books) ? data.books : [];
          
          // Merge with client-side fallback books
          const seen = new Set(serverBooks.map((b) => b.id));
          const merged = [...serverBooks];
          for (const cb of clientBooks) {
            if (!seen.has(cb.id)) {
              merged.push(cb);
            }
          }
          return merged;
        }
      }
    } catch (err: any) {
      // Continue to next endpoint or fallback
    }
  }

  return clientBooks;
}

// Fetch single book from server by id
export async function fetchBookByIdFromServer(id: string): Promise<InteractiveBook | null> {
  const clientBooks = getClientFallbackBooks();
  const localFound = clientBooks.find((b) => b.id === id);

  const endpoints = [
    getApiUrl(`/api/books/${encodeURIComponent(id)}`),
    getApiUrl(`/api/media/books/${encodeURIComponent(id)}`),
    `/api/books/${encodeURIComponent(id)}`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.book) return data.book;
      }
    } catch (err: any) {}
  }

  return localFound || null;
}

// Client-side extraction fallback using JSZip when backend is unreachable
async function extractBookClientSide(
  fileOrFiles: File | File[],
  title?: string,
  onProgress?: (percent: number) => void
): Promise<InteractiveBook> {
  const JSZip = (await import("jszip")).default;
  const fileList = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  const primary = fileList[0];
  const bookId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const bookTitle = (title && title.trim()) || primary.name.replace(/\.[^/.]+$/, "");

  const pages: BookPage[] = [];
  const allMedia: BookPageMedia[] = [];

  const isZip = primary.name.toLowerCase().endsWith(".zip") || primary.type.includes("zip");

  if (isZip) {
    const zip = await JSZip.loadAsync(primary);
    const fileKeys = Object.keys(zip.files).filter(k => !zip.files[k].dir && !k.startsWith("__MACOSX"));

    const imageExts = [".jpg", ".jpeg", ".png", ".webp", ".svg"];
    const audioExts = [".mp3", ".wav", ".m4a", ".aac", ".ogg"];
    const videoExts = [".mp4", ".webm", ".mov"];

    const imgFiles = fileKeys.filter(k => imageExts.some(ext => k.toLowerCase().endsWith(ext))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const audFiles = fileKeys.filter(k => audioExts.some(ext => k.toLowerCase().endsWith(ext))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const vidFiles = fileKeys.filter(k => videoExts.some(ext => k.toLowerCase().endsWith(ext))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    // Extract images as object URLs
    for (let i = 0; i < imgFiles.length; i++) {
      const rel = imgFiles[i];
      const blob = await zip.files[rel].async("blob");
      const url = URL.createObjectURL(blob);
      const numMatch = rel.match(/\d+/);
      const pageNum = numMatch ? parseInt(numMatch[0], 10) : i + 1;
      pages.push({
        pageNumber: pageNum,
        displayLabel: String(pageNum),
        pageImage: url,
        media: []
      });
      if (onProgress) onProgress(Math.round(((i + 1) / Math.max(imgFiles.length, 1)) * 90));
    }

    // Extract audio
    for (let i = 0; i < audFiles.length; i++) {
      const rel = audFiles[i];
      const blob = await zip.files[rel].async("blob");
      const url = URL.createObjectURL(blob);
      const name = rel.split("/").pop() || rel;
      const numMatch = name.match(/\d+/);
      const track = numMatch ? numMatch[0] : String(i + 1).padStart(2, "0");
      allMedia.push({
        id: `m-${Date.now()}-${i}`,
        trackNumber: track,
        title: name.replace(/\.[^/.]+$/, ""),
        type: "audio",
        fileName: name,
        url: url,
        pageNumber: 1
      });
    }

    // Extract video
    for (let i = 0; i < vidFiles.length; i++) {
      const rel = vidFiles[i];
      const blob = await zip.files[rel].async("blob");
      const url = URL.createObjectURL(blob);
      const name = rel.split("/").pop() || rel;
      allMedia.push({
        id: `v-${Date.now()}-${i}`,
        trackNumber: String(i + 1),
        title: name.replace(/\.[^/.]+$/, ""),
        type: "video",
        fileName: name,
        url: url,
        pageNumber: 1
      });
    }
  } else {
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const url = URL.createObjectURL(f);
      pages.push({
        pageNumber: i + 1,
        displayLabel: String(i + 1),
        pageImage: f.type.startsWith("image/") ? url : "",
        media: f.type.startsWith("audio/") || f.type.startsWith("video/") ? [{
          id: `m-${Date.now()}-${i}`,
          trackNumber: String(i + 1),
          title: f.name.replace(/\.[^/.]+$/, ""),
          type: f.type.startsWith("video/") ? "video" : "audio",
          fileName: f.name,
          url: url,
          pageNumber: i + 1
        }] : []
      });
    }
  }

  const book: InteractiveBook = {
    id: bookId,
    title: bookTitle,
    subtitle: "Kurs- und Arbeitsbuch",
    author: "Hueber Verlag",
    coverImage: pages[0]?.pageImage || "",
    totalPages: pages.length || 1,
    pages: pages.length > 0 ? pages : [{ pageNumber: 1, displayLabel: "1", pageImage: "", media: [] }],
    allMedia: allMedia,
    createdAt: new Date().toISOString()
  };

  saveClientFallbackBook(book);
  if (onProgress) onProgress(100);
  return book;
}

// Upload and extract book archive (ZIP) or media files onto the server with live progress
export function uploadBookToServer(
  fileOrFiles: File | File[],
  title?: string,
  onProgress?: (percent: number) => void
): Promise<InteractiveBook> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    const fileList = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];

    for (const f of fileList) {
      formData.append("file", f);
      formData.append("files", f);
    }

    if (title && title.trim()) {
      formData.append("title", title.trim());
    }

    const candidateEndpoints = [
      getApiUrl("/api/books/upload"),
      "/api/books/upload",
      getApiUrl("/api/media/books-upload"),
      "/api/media/books-upload",
      getApiUrl("/api/books"),
      "/api/books"
    ];

    let currentIdx = 0;

    const tryNext = () => {
      if (currentIdx >= candidateEndpoints.length) {
        // Fallback: extract client-side using JSZip
        console.warn("[Books] Server endpoints unavailable. Extracting client-side...");
        extractBookClientSide(fileOrFiles, title, onProgress)
          .then(resolve)
          .catch(reject);
        return;
      }

      const endpoint = candidateEndpoints[currentIdx++];
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(Math.min(percent, 98));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.success && res.book) {
              if (onProgress) onProgress(100);
              resolve(res.book);
            } else {
              tryNext();
            }
          } catch (e) {
            tryNext();
          }
        } else if (xhr.status === 404) {
          tryNext();
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
        tryNext();
      };

      xhr.ontimeout = () => {
        tryNext();
      };

      try {
        xhr.open("POST", endpoint, true);
        const token = typeof window !== "undefined" ? localStorage.getItem("app_auth_token") : null;
        if (token) {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }
        xhr.send(formData);
      } catch (err) {
        tryNext();
      }
    };

    tryNext();
  });
}

// Delete book from server
export async function deleteBookFromServer(id: string): Promise<boolean> {
  removeClientFallbackBook(id);
  const endpoints = [
    getApiUrl(`/api/books/${encodeURIComponent(id)}`),
    `/api/books/${encodeURIComponent(id)}`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        return !!data.success;
      }
    } catch (err: any) {}
  }
  return true;
}

// Update book metadata on server
export async function updateBookMetadataOnServer(
  id: string,
  updates: { title?: string; subtitle?: string; author?: string }
): Promise<InteractiveBook | null> {
  const endpoints = [
    getApiUrl(`/api/books/${encodeURIComponent(id)}`),
    `/api/books/${encodeURIComponent(id)}`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        return data.book || null;
      }
    } catch (err: any) {}
  }
  return null;
}

// Backwards-compatible aliases
export const getAllBooksFromDB = fetchBooksFromServer;
export const saveBookToDB = async (book: InteractiveBook) => {
  // Books are persisted to server automatically
};
export const deleteBookFromDB = deleteBookFromServer;
export const fetchAllBooks = fetchBooksFromServer;
export const uploadBookArchive = uploadBookToServer;

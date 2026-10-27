import { InteractiveBook } from "../types";

// Fetch all books stored on the server
export async function fetchBooksFromServer(): Promise<InteractiveBook[]> {
  try {
    const res = await fetch("/api/books", {
      headers: { Accept: "application/json" }
    });
    if (!res.ok) {
      return [];
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return [];
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

// Upload and extract book archive (ZIP) or media files onto the server with live progress
export function uploadBookToServer(
  fileOrFiles: File | File[],
  title?: string,
  onProgress?: (percent: number) => void
): Promise<InteractiveBook> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    const fileList = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];

    for (const f of fileList) {
      formData.append("file", f);
      formData.append("files", f);
    }

    if (title && title.trim()) {
      formData.append("title", title.trim());
    }

    const sendRequest = (endpoint: string) => {
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
              reject(new Error(res.error || "فشل معالجة وحفظ الكتاب في السيرفر"));
            }
          } catch (e) {
            reject(new Error("رد غير صالح من سيرفر الكتب"));
          }
        } else if (xhr.status === 404 && endpoint === "/api/books/upload") {
          console.warn("[Books] 404 on /api/books/upload, falling back to /api/media/books-upload");
          sendRequest("/api/media/books-upload");
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
        if (endpoint === "/api/books/upload") {
          sendRequest("/api/media/books-upload");
        } else {
          reject(new Error("حدث انقطاع في الاتصال بالسيرفر أثناء رفع الكتاب"));
        }
      };

      xhr.ontimeout = () => {
        reject(new Error("انتهت مهلة انتظار السيرفر أثناء رفع واستخراج الكتاب"));
      };

      xhr.open("POST", endpoint, true);
      xhr.send(formData);
    };

    sendRequest("/api/books/upload");
  });
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

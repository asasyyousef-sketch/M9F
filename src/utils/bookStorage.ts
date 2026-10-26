import { InteractiveBook } from "../types";

export async function fetchAllBooks(): Promise<InteractiveBook[]> {
  try {
    const res = await fetch("/api/books");
    if (!res.ok) {
      throw new Error(`خطأ في جلب قائمة الكتب (رمز: ${res.status})`);
    }
    const data = await res.json();
    return Array.isArray(data.books) ? data.books : [];
  } catch (err: any) {
    console.error("Failed to fetch books:", err);
    return [];
  }
}

export async function fetchBookById(id: string): Promise<InteractiveBook | null> {
  try {
    const res = await fetch(`/api/books/${encodeURIComponent(id)}`);
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data.book || null;
  } catch (err: any) {
    console.error(`Failed to fetch book ${id}:`, err);
    return null;
  }
}

export function uploadBookArchive(
  file: File,
  title?: string,
  onProgress?: (percent: number) => void
): Promise<InteractiveBook> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    if (title && title.trim()) {
      formData.append("title", title.trim());
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(Math.min(percent, 99)); // keep at 99 until server finishes extraction
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
            reject(new Error(res.error || "فشل معالجة واستخراج الكتاب في السيرفر"));
          }
        } catch (e: any) {
          reject(new Error("رد غير صالح من خادم استخراج الكتب"));
        }
      } else {
        let errMsg = `فشل رفع واستخراج الكتاب (رمز السيرفر: ${xhr.status})`;
        try {
          const errRes = JSON.parse(xhr.responseText);
          if (errRes.error) errMsg = errRes.error;
        } catch (e) {}
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error("حدث انقطاع في الاتصال بالخادم أثناء رفع واستخراج الكتاب"));
    };

    xhr.ontimeout = () => {
      reject(new Error("انتهت مهلة استجابة السيرفر أثناء رفع واستخراج الكتاب"));
    };

    xhr.open("POST", "/api/books/upload", true);
    xhr.send(formData);
  });
}

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
    console.error("Failed to delete book:", err);
    return false;
  }
}

export async function updateBookMetadata(
  id: string,
  updates: { title?: string; subtitle?: string; author?: string }
): Promise<InteractiveBook | null> {
  try {
    const res = await fetch(`/api/books/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      throw new Error(`رمز الخطأ: ${res.status}`);
    }
    const data = await res.json();
    return data.book || null;
  } catch (err: any) {
    console.error("Failed to update book metadata:", err);
    return null;
  }
}

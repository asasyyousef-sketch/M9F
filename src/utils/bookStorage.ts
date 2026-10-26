import { InteractiveBook, BookPage, BookPageMedia } from "../types";

const DB_NAME = "educational_books_db";
const STORE_NAME = "books";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBookToDB(book: InteractiveBook): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(book);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllBooksFromDB(): Promise<InteractiveBook[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const books: InteractiveBook[] = req.result || [];
      // Rehydrate blob URLs if they were stored as blobs
      books.forEach((book) => {
        if (Array.isArray(book.pages)) {
          book.pages.forEach((page) => {
            if (page.imageBlob && (!page.pageImage || page.pageImage.startsWith("blob:"))) {
              try {
                page.pageImage = URL.createObjectURL(page.imageBlob);
              } catch (e) {
                console.error("Error creating image blob URL:", e);
              }
            }
            if (Array.isArray(page.media)) {
              page.media.forEach((m) => {
                if (m.blob && (!m.url || m.url.startsWith("blob:"))) {
                  try {
                    m.url = URL.createObjectURL(m.blob);
                  } catch (e) {
                    console.error("Error creating media blob URL:", e);
                  }
                }
              });
            }
          });
        }
        if (Array.isArray(book.allMedia)) {
          book.allMedia.forEach((m) => {
            if (m.blob && (!m.url || m.url.startsWith("blob:"))) {
              try {
                m.url = URL.createObjectURL(m.blob);
              } catch (e) {
                console.error("Error creating allMedia blob URL:", e);
              }
            }
          });
        }
      });
      resolve(books);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBookFromDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Built-in Demo Book matching the user screenshot (Miteinander! A1.1 KB+AB)
export const DEMO_BOOK: InteractiveBook = {
  id: "miteinander-a1-1",
  title: "Miteinander! A1.1 KB+AB",
  author: "Hueber Verlag",
  totalPages: 180,
  createdAt: new Date().toISOString(),
  pages: [
    {
      pageNumber: 173,
      displayLabel: "5",
      pageImage: "/assets/aistudio/image_629fa44a.png",
      media: [
        {
          id: "m-173-1",
          trackNumber: "2/34",
          title: "2/34 – Audio: L7, 4a",
          type: "audio",
          fileName: "L7_04a.mp3"
        }
      ]
    },
    {
      pageNumber: 174,
      displayLabel: "6",
      pageImage: "/assets/aistudio/image_629fa44a.png",
      media: [
        {
          id: "m-174-1",
          trackNumber: "2/35",
          title: "2/35 – Audio: L7, 5b",
          type: "audio",
          fileName: "L7_05b.mp3"
        }
      ]
    },
    {
      pageNumber: 175,
      displayLabel: "7",
      pageImage: "/assets/aistudio/image_629fa44a.png",
      media: [
        {
          id: "m-175-1",
          trackNumber: "2/36",
          title: "2/36 – Audio: L7, 6a",
          type: "audio",
          fileName: "L7_06a.mp3"
        },
        {
          id: "m-175-2",
          trackNumber: "2/37",
          title: "2/37 – Audio: L7, 6b",
          type: "audio",
          fileName: "L7_06b.mp3"
        }
      ]
    },
    {
      pageNumber: 176,
      displayLabel: "8",
      pageImage: "/assets/aistudio/image_629fa44a.png",
      media: [
        {
          id: "m-176-1",
          trackNumber: "2/38",
          title: "2/38 – Audio: L7, 7a",
          type: "audio",
          fileName: "L7_07a.mp3"
        },
        {
          id: "m-176-2",
          trackNumber: "2/39",
          title: "2/39 – Audio: L7, 7c",
          type: "audio",
          fileName: "L7_07c.mp3"
        }
      ]
    },
    {
      pageNumber: 177,
      displayLabel: "9",
      pageImage: "/assets/aistudio/image_629fa44a.png",
      media: [
        {
          id: "m-177-1",
          trackNumber: "2/40",
          title: "2/40 – Audio: L7, 8a",
          type: "audio",
          fileName: "L7_08a.mp3"
        }
      ]
    }
  ]
};

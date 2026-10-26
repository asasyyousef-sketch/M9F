import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import JSZip from "jszip";

export interface BookPageMedia {
  id: string;
  trackNumber?: string;
  title: string;
  type: "audio" | "video";
  fileName: string;
  url?: string;
  pageNumber?: number;
}

export interface BookPage {
  pageNumber: number;
  displayLabel?: string;
  pageImage: string;
  media: BookPageMedia[];
}

export interface InteractiveBook {
  id: string;
  title: string;
  author?: string;
  subtitle?: string;
  coverImage?: string;
  totalPages: number;
  pages: BookPage[];
  allMedia?: BookPageMedia[];
  createdAt: string;
}

const BOOKS_FILE_PATH = path.join(process.cwd(), "books.json");
const BOOKS_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "books");

// Ensure directories exist
if (!fs.existsSync(BOOKS_UPLOADS_DIR)) {
  fs.mkdirSync(BOOKS_UPLOADS_DIR, { recursive: true });
}

export function loadServerBooks(): InteractiveBook[] {
  try {
    if (fs.existsSync(BOOKS_FILE_PATH)) {
      const data = fs.readFileSync(BOOKS_FILE_PATH, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to read books.json:", e);
  }

  // Initial Seed matching the user screenshot (Image 1):
  // 1. Miteinander! A1.1 KB+AB
  // 2. Miteinander! A1.2 KB+AB
  // 3. Miteinander! A2.1 KB+AB
  // 4. Miteinander! A2.2 KB+AB
  const initialBooks = getInitialSeedBooks();
  saveServerBooks(initialBooks);
  return initialBooks;
}

export function saveServerBooks(books: InteractiveBook[]): void {
  try {
    fs.writeFileSync(BOOKS_FILE_PATH, JSON.stringify(books, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write books.json:", e);
  }
}

function getInitialSeedBooks(): InteractiveBook[] {
  // Try to load official A1.2 JSON from assets if available
  let a12Pages: BookPage[] = [];
  try {
    const a12ContentPath = path.join(process.cwd(), "public", "assets", "aistudio", "530_25467_content_fd770cf0.json");
    if (fs.existsSync(a12ContentPath)) {
      const contentRaw = fs.readFileSync(a12ContentPath, "utf-8");
      const contentJson = JSON.parse(contentRaw);
      if (Array.isArray(contentJson.book_parts)) {
        contentJson.book_parts.forEach((bp: any) => {
          if (Array.isArray(bp.pages)) {
            bp.pages.forEach((p: any) => {
              const pageNum = parseInt(String(p.page || 1), 10);
              const mediaList: BookPageMedia[] = [];
              if (Array.isArray(p.media)) {
                p.media.forEach((m: any, mIdx: number) => {
                  mediaList.push({
                    id: m.media_id || `m-${pageNum}-${mIdx}`,
                    trackNumber: m.title ? m.title.split("–")[0]?.trim() : `${pageNum}/${mIdx + 1}`,
                    title: m.title || m.file_name,
                    type: m.type === "video" ? "video" : "audio",
                    fileName: m.file_name,
                    url: typeof m.hyperlinkObj === "string" && m.hyperlinkObj.startsWith("http") ? m.hyperlinkObj : undefined,
                    pageNumber: pageNum
                  });
                });
              }

              a12Pages.push({
                pageNumber: pageNum,
                displayLabel: String(p.page_name || pageNum),
                pageImage: "/assets/aistudio/image_629fa44a.png",
                media: mediaList
              });
            });
          }
        });
      }
    }
  } catch (e) {
    console.error("Failed to parse A1.2 seed:", e);
  }

  // Miteinander! A1.1 KB+AB seed with real lesson 8 tracks matching Image 2 (page 186)
  const a11Pages: BookPage[] = [];
  for (let i = 1; i <= 186; i++) {
    const media: BookPageMedia[] = [];
    if (i === 186) {
      media.push(
        {
          id: "m-186-1",
          trackNumber: "2/43",
          title: "2/43 – Audio: L8, 14b",
          type: "audio",
          fileName: "2_43_Audio_L8_14b.mp3",
          pageNumber: 186
        },
        {
          id: "m-186-2",
          trackNumber: "2/44",
          title: "2/44 – Audio: L8, 14c",
          type: "audio",
          fileName: "2_44_Audio_L8_14c.mp3",
          pageNumber: 186
        },
        {
          id: "m-186-3",
          trackNumber: "L8, 14a",
          title: "L8, 14a, Aussprache",
          type: "video",
          fileName: "L8_14a_Aussprache.mp4",
          pageNumber: 186
        }
      );
    }
    a11Pages.push({
      pageNumber: i,
      displayLabel: String(i),
      pageImage: "/assets/aistudio/image_629fa44a.png",
      media
    });
  }

  return [
    {
      id: "miteinander-a1-1",
      title: "Miteinander! A1.1 KB+AB",
      subtitle: "Kurs- und Arbeitsbuch",
      author: "Hueber Verlag",
      coverImage: "/assets/aistudio/cover_a1_1.png",
      totalPages: 186,
      pages: a11Pages,
      createdAt: new Date().toISOString()
    },
    {
      id: "miteinander-a1-2",
      title: "Miteinander! A1.2 KB+AB",
      subtitle: "Kurs- und Arbeitsbuch",
      author: "Hueber Verlag",
      coverImage: "/assets/aistudio/cover_a1_2.png",
      totalPages: a12Pages.length || 222,
      pages: a12Pages,
      createdAt: new Date().toISOString()
    },
    {
      id: "miteinander-a2-1",
      title: "Miteinander! A2.1 KB+AB",
      subtitle: "Kurs- und Arbeitsbuch",
      author: "Hueber Verlag",
      coverImage: "/assets/aistudio/cover_a2_1.png",
      totalPages: 180,
      pages: [],
      createdAt: new Date().toISOString()
    },
    {
      id: "miteinander-a2-2",
      title: "Miteinander! A2.2 KB+AB",
      subtitle: "Kurs- und Arbeitsbuch",
      author: "Hueber Verlag",
      coverImage: "/assets/aistudio/cover_a2_2.png",
      totalPages: 180,
      pages: [],
      createdAt: new Date().toISOString()
    }
  ];
}

// Multer memory storage for ZIP upload
const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB
});

export function registerServerBookRoutes(app: express.Express): void {
  // Static route to serve uploaded book assets (pages, audio, video)
  app.use("/uploads/books", express.static(BOOKS_UPLOADS_DIR));

  // 1. GET all books from server
  app.get("/api/books", (req, res) => {
    try {
      const books = loadServerBooks();
      res.json({ books });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to load books" });
    }
  });

  // 2. GET single book by ID
  app.get("/api/books/:id", (req, res) => {
    try {
      const books = loadServerBooks();
      const book = books.find((b) => b.id === req.params.id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      res.json({ book });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to load book" });
    }
  });

  // 3. Save or update book
  app.post("/api/books", (req, res) => {
    try {
      const newBook: InteractiveBook = req.body;
      if (!newBook || !newBook.id || !newBook.title) {
        return res.status(400).json({ error: "بيانات الكتاب غير مكتملة" });
      }

      const books = loadServerBooks();
      const idx = books.findIndex((b) => b.id === newBook.id);
      if (idx >= 0) {
        books[idx] = newBook;
      } else {
        books.push(newBook);
      }

      saveServerBooks(books);
      res.json({ success: true, book: newBook });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to save book" });
    }
  });

  // 4. Delete book from server
  app.delete("/api/books/:id", (req, res) => {
    try {
      const { id } = req.params;
      const books = loadServerBooks();
      const filtered = books.filter((b) => b.id !== id);
      saveServerBooks(filtered);

      // Clean up server directory for this book if exists
      const bookDir = path.join(BOOKS_UPLOADS_DIR, id);
      if (fs.existsSync(bookDir)) {
        fs.rmSync(bookDir, { recursive: true, force: true });
      }

      res.json({ success: true, message: "تم حذف الكتاب من السيرفر بنجاح" });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to delete book" });
    }
  });

  // 5. Upload ZIP archive directly to server and extract
  app.post("/api/books/upload-zip", zipUpload.single("file"), async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: "الملف المضغوط مطلوب" });
      }

      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(req.file.buffer);

      const bookId = "book-" + Date.now();
      const targetDir = path.join(BOOKS_UPLOADS_DIR, bookId);
      fs.mkdirSync(targetDir, { recursive: true });

      // Find JSON files
      let contentJson: any = null;
      let bookMetaJson: any = null;
      const fileUrlsMap = new Map<string, string>();

      // Extract all files onto disk in public/uploads/books/:bookId/
      const entries = Object.keys(loadedZip.files);
      for (const entryPath of entries) {
        const entry = loadedZip.files[entryPath];
        if (entry.dir) continue;

        const baseName = path.basename(entryPath);
        const lower = entryPath.toLowerCase();

        // Write file to server disk
        const buffer = await entry.async("nodebuffer");
        const filePath = path.join(targetDir, baseName);
        fs.writeFileSync(filePath, buffer);

        const serverUrl = `/uploads/books/${bookId}/${baseName}`;
        fileUrlsMap.set(baseName.toLowerCase(), serverUrl);
        fileUrlsMap.set(entryPath.toLowerCase().replace(/\\/g, "/"), serverUrl);

        // Check JSON
        if (lower.endsWith(".json")) {
          try {
            const text = buffer.toString("utf-8");
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed.book_parts) || Array.isArray(parsed.pages) || Array.isArray(parsed)) {
              contentJson = parsed;
            }
            if (parsed.title || lower.includes("book.json")) {
              bookMetaJson = parsed;
            }
          } catch (e) {}
        }
      }

      // Title & metadata
      const defaultTitle = req.file.originalname.replace(/\.[^/.]+$/, "");
      const bookTitle = bookMetaJson?.title || contentJson?.book_title || defaultTitle;
      const subtitle = bookMetaJson?.subtitle || "Kurs- und Arbeitsbuch";

      // Extract raw pages
      let rawPages: any[] = [];
      if (contentJson) {
        if (Array.isArray(contentJson.book_parts)) {
          contentJson.book_parts.forEach((bp: any) => {
            if (Array.isArray(bp.pages)) rawPages.push(...bp.pages);
          });
        } else if (Array.isArray(contentJson.pages)) {
          rawPages = contentJson.pages;
        } else if (Array.isArray(contentJson)) {
          rawPages = contentJson;
        }
      }

      // Build pages
      const constructedPages: BookPage[] = [];

      if (rawPages.length > 0) {
        rawPages.forEach((p, idx) => {
          const pageNum = parseInt(String(p.page ?? p.page_number ?? idx + 1), 10) || idx + 1;
          const imgRef = p.page_img || p.image || "";
          const imgUrl = fileUrlsMap.get(imgRef.toLowerCase()) || fileUrlsMap.get(path.basename(imgRef).toLowerCase()) || "/assets/aistudio/image_629fa44a.png";

          const mediaList: BookPageMedia[] = [];
          if (Array.isArray(p.media)) {
            p.media.forEach((m: any, mIdx: number) => {
              const fileName = m.file_name || m.fileName || "";
              const fileBase = path.basename(fileName).toLowerCase();
              const serverFileUrl = fileUrlsMap.get(fileBase) || (typeof m.hyperlinkObj === "string" && m.hyperlinkObj.startsWith("http") ? m.hyperlinkObj : undefined);

              mediaList.push({
                id: m.media_id || `m-${pageNum}-${mIdx}`,
                trackNumber: m.title ? m.title.split("–")[0]?.trim() : `${pageNum}/${mIdx + 1}`,
                title: m.title || fileName,
                type: m.type === "video" ? "video" : "audio",
                fileName,
                url: serverFileUrl,
                pageNumber: pageNum
              });
            });
          }

          constructedPages.push({
            pageNumber: pageNum,
            displayLabel: String(p.page_name || pageNum),
            pageImage: imgUrl,
            media: mediaList
          });
        });
      } else {
        // Fallback: build pages from image files found on server disk
        const imageFiles = fs.readdirSync(targetDir).filter((f) => f.match(/\.(jpg|jpeg|png|webp)$/i));
        imageFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        imageFiles.forEach((f, idx) => {
          constructedPages.push({
            pageNumber: idx + 1,
            displayLabel: String(idx + 1),
            pageImage: `/uploads/books/${bookId}/${f}`,
            media: []
          });
        });
      }

      // Strictly sort pages in numerical order
      constructedPages.sort((a, b) => a.pageNumber - b.pageNumber);

      const allMedia: BookPageMedia[] = [];
      constructedPages.forEach((pg) => allMedia.push(...pg.media));

      const newBook: InteractiveBook = {
        id: bookId,
        title: bookTitle,
        subtitle,
        author: "Hueber Verlag",
        coverImage: constructedPages[0]?.pageImage || "/assets/aistudio/image_629fa44a.png",
        totalPages: constructedPages.length,
        pages: constructedPages,
        allMedia,
        createdAt: new Date().toISOString()
      };

      const books = loadServerBooks();
      books.unshift(newBook);
      saveServerBooks(books);

      res.json({
        success: true,
        message: "تم رفع واستخراج الكتاب وحفظه على السيرفر بنجاح!",
        book: newBook
      });
    } catch (e: any) {
      console.error("ZIP Upload error on server:", e);
      res.status(500).json({ error: e.message || "فشل رفع واستخراج ملف الكتاب" });
    }
  });
}

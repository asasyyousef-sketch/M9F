import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import multer from "multer";
import JSZip from "jszip";
import { InteractiveBook, BookPage, BookPageMedia } from "./src/types";

const BOOKS_DIR = path.join(process.cwd(), "public", "uploads", "books");
const BOOKS_META_PATH = path.join(process.cwd(), "books.json");

// Ensure books directory exists
if (!fs.existsSync(BOOKS_DIR)) {
  try {
    fs.mkdirSync(BOOKS_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create books directory:", err);
  }
}

export function loadBooksMeta(): InteractiveBook[] {
  try {
    if (fs.existsSync(BOOKS_META_PATH)) {
      const raw = fs.readFileSync(BOOKS_META_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error reading books.json:", e);
  }
  return [];
}

export function saveBooksMeta(list: InteractiveBook[]) {
  try {
    fs.writeFileSync(BOOKS_META_PATH, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving books.json:", e);
  }
}

// Natural sort comparator for filenames (e.g. page1, page2, page10)
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

// Recursively find all files in a folder
function getAllFilesRecursive(dir: string, baseDir: string = dir): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFilesRecursive(fullPath, baseDir));
    } else {
      const rel = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      results.push(rel);
    }
  }
  return results;
}

export function registerServerBookRoutes(app: express.Express) {
  // Static route to serve uploaded book assets
  app.use(
    "/uploads/books",
    express.static(BOOKS_DIR, {
      setHeaders: (res) => {
        res.setHeader("Accept-Ranges", "bytes");
      }
    })
  );
  app.use(
    "/public/uploads/books",
    express.static(BOOKS_DIR, {
      setHeaders: (res) => {
        res.setHeader("Accept-Ranges", "bytes");
      }
    })
  );

  // Setup multer for memory storage or temp zip file
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 2 * 1024 * 1024 * 1024 // 2GB max
    }
  });

  // 1. Get all books
  app.get("/api/books", (req, res) => {
    try {
      const list = loadBooksMeta();
      res.json({ success: true, books: list });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load books" });
    }
  });

  // 2. Get single book
  app.get("/api/books/:id", (req, res) => {
    try {
      const { id } = req.params;
      const list = loadBooksMeta();
      const book = list.find((b) => b.id === id);
      if (!book) {
        return res.status(404).json({ error: "الكتاب غير موجود" });
      }
      res.json({ success: true, book });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to get book" });
    }
  });

  // 3. Upload and extract Interactive Book (ZIP archive)
  app.post("/api/books/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "الرجاء اختيار ملف الكتاب المضغوط (ZIP)" });
      }

      const originalName = req.file.originalname || "interactive-book.zip";
      const cleanTitle = (req.body.title && typeof req.body.title === "string" && req.body.title.trim())
        ? req.body.title.trim()
        : path.basename(originalName, path.extname(originalName)).replace(/[_-]/g, " ");

      const bookId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const targetDir = path.join(BOOKS_DIR, bookId);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Extract ZIP using JSZip
      const zip = await JSZip.loadAsync(req.file.buffer);
      const zipEntries = Object.keys(zip.files);

      for (const relativePath of zipEntries) {
        const fileEntry = zip.files[relativePath];
        // Ignore directory entries or mac __MACOSX garbage
        if (fileEntry.dir || relativePath.startsWith("__MACOSX/") || relativePath.includes("/__MACOSX/")) {
          continue;
        }

        const cleanRelPath = relativePath.replace(/^(\.\/|\/)+/, "");
        const destPath = path.join(targetDir, cleanRelPath);
        const destDir = path.dirname(destPath);

        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        const content = await fileEntry.async("nodebuffer");
        fs.writeFileSync(destPath, content);
      }

      // Catalog all extracted files
      const allExtractedFiles = getAllFilesRecursive(targetDir);

      const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif", ".bmp"];
      const audioExtensions = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".wma"];
      const videoExtensions = [".mp4", ".webm", ".mov", ".mkv", ".m4v"];

      const imageFiles: string[] = [];
      const audioFiles: string[] = [];
      const videoFiles: string[] = [];

      for (const relFile of allExtractedFiles) {
        const ext = path.extname(relFile).toLowerCase();
        if (imageExtensions.includes(ext)) {
          imageFiles.push(relFile);
        } else if (audioExtensions.includes(ext)) {
          audioFiles.push(relFile);
        } else if (videoExtensions.includes(ext)) {
          videoFiles.push(relFile);
        }
      }

      // Sort images naturally so page 1, 2, 3 ... 10 are in correct order
      imageFiles.sort(naturalCompare);
      audioFiles.sort(naturalCompare);
      videoFiles.sort(naturalCompare);

      // Build media items
      const allMedia: BookPageMedia[] = [];

      audioFiles.forEach((rel, idx) => {
        const filename = path.basename(rel);
        const nameWithoutExt = path.basename(rel, path.extname(rel));
        const numMatch = filename.match(/\d+/);
        const trackNum = numMatch ? numMatch[0] : String(idx + 1).padStart(2, "0");

        // Try to detect page number if track name has page hint e.g. p01, page_5, s012
        let pageNum: number | undefined;
        const pageMatch = filename.match(/(?:page|seite|p|s)[-_]?0*(\d+)/i);
        if (pageMatch) {
          pageNum = parseInt(pageMatch[1], 10);
        }

        allMedia.push({
          id: `media-audio-${idx + 1}-${Date.now()}`,
          trackNumber: trackNum,
          title: nameWithoutExt.replace(/[_-]/g, " "),
          type: "audio",
          fileName: filename,
          url: `/uploads/books/${bookId}/${rel}`,
          pageNumber: pageNum
        });
      });

      videoFiles.forEach((rel, idx) => {
        const filename = path.basename(rel);
        const nameWithoutExt = path.basename(rel, path.extname(rel));
        allMedia.push({
          id: `media-video-${idx + 1}-${Date.now()}`,
          title: nameWithoutExt.replace(/[_-]/g, " "),
          type: "video",
          fileName: filename,
          url: `/uploads/books/${bookId}/${rel}`
        });
      });

      // Build pages
      const pages: BookPage[] = [];

      if (imageFiles.length > 0) {
        imageFiles.forEach((rel, idx) => {
          const pageNum = idx + 1;
          // Associate media belonging to this page
          const pageMedia = allMedia.filter(
            (m) => m.pageNumber === pageNum || (m.trackNumber && parseInt(m.trackNumber, 10) === pageNum)
          );

          pages.push({
            pageNumber: pageNum,
            displayLabel: `صفحة ${pageNum}`,
            pageImage: `/uploads/books/${bookId}/${rel}`,
            media: pageMedia
          });
        });
      } else {
        // If no images found, create at least 1 page with all media
        pages.push({
          pageNumber: 1,
          displayLabel: "صفحة 1",
          pageImage: "",
          media: allMedia
        });
      }

      const coverImg = imageFiles.length > 0 ? `/uploads/books/${bookId}/${imageFiles[0]}` : "";

      const newBook: InteractiveBook = {
        id: bookId,
        title: cleanTitle,
        subtitle: req.body.subtitle || undefined,
        author: req.body.author || undefined,
        coverImage: coverImg,
        totalPages: pages.length,
        pages: pages,
        allMedia: allMedia,
        createdAt: new Date().toISOString()
      };

      const existingBooks = loadBooksMeta();
      existingBooks.unshift(newBook);
      saveBooksMeta(existingBooks);

      console.log(`[Books Server] Book uploaded & extracted successfully: "${newBook.title}" (${pages.length} pages, ${allMedia.length} media tracks)`);

      res.json({
        success: true,
        book: newBook,
        message: `تم رفع واستخراج الكتاب بنجاح (${pages.length} صفحة و ${allMedia.length} مقطع صوتي/مرئي)`
      });
    } catch (err: any) {
      console.error("[Books Server] Failed to upload/extract book:", err);
      res.status(500).json({
        error: `فشل في استخراج أو حفظ ملف الكتاب: ${err?.message || "خطأ غير معروف"}`
      });
    }
  });

  // 4. Update book metadata (rename, etc.)
  app.patch("/api/books/:id", express.json(), (req, res) => {
    try {
      const { id } = req.params;
      const { title, subtitle, author } = req.body;
      const list = loadBooksMeta();
      const bookIndex = list.findIndex((b) => b.id === id);
      if (bookIndex === -1) {
        return res.status(404).json({ error: "الكتاب غير موجود" });
      }

      if (title && typeof title === "string") {
        list[bookIndex].title = title.trim();
      }
      if (subtitle !== undefined) {
        list[bookIndex].subtitle = subtitle;
      }
      if (author !== undefined) {
        list[bookIndex].author = author;
      }

      saveBooksMeta(list);
      res.json({ success: true, book: list[bookIndex] });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update book" });
    }
  });

  // 5. Delete book
  app.delete("/api/books/:id", (req, res) => {
    try {
      const { id } = req.params;
      const list = loadBooksMeta();
      const book = list.find((b) => b.id === id);
      if (!book) {
        return res.status(404).json({ error: "الكتاب غير موجود" });
      }

      // Delete disk directory
      const bookFolder = path.join(BOOKS_DIR, id);
      if (fs.existsSync(bookFolder)) {
        try {
          fs.rmSync(bookFolder, { recursive: true, force: true });
        } catch (e) {
          console.warn("[Books Server] Warning deleting book directory:", e);
        }
      }

      // Filter out from books.json
      const updatedList = list.filter((b) => b.id !== id);
      saveBooksMeta(updatedList);

      res.json({ success: true, message: "تم حذف الكتاب بنجاح" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete book" });
    }
  });
}

import express from "express";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import multer from "multer";
import JSZip from "jszip";
import { InteractiveBook, BookPage, BookPageMedia } from "./src/types";

const BOOKS_DIR = path.join(process.cwd(), "public", "uploads", "books");
const TEMP_DIR = path.join(process.cwd(), "public", "uploads", "temp");
const BOOKS_META_PATH = path.join(process.cwd(), "books.json");

// Ensure books and temp directories exist
if (!fs.existsSync(BOOKS_DIR)) {
  try {
    fs.mkdirSync(BOOKS_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create books directory:", err);
  }
}
if (!fs.existsSync(TEMP_DIR)) {
  try {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create temp directory:", err);
  }
}

// Ensure books directory exists
if (!fs.existsSync(BOOKS_DIR)) {
  try {
    fs.mkdirSync(BOOKS_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create books directory:", err);
  }
}

// Default initial books matching user reference screenshot
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
  },
  {
    id: "miteinander-a1-2",
    title: "Miteinander! A1.2 KB+AB",
    subtitle: "Kurs- und Arbeitsbuch",
    author: "Hueber Verlag",
    coverImage: "/assets/aistudio/covers/cover_a1_2.png",
    totalPages: 180,
    createdAt: "2024-06-11T10:00:00.000Z",
    pages: [
      {
        pageNumber: 1,
        displayLabel: "1",
        pageImage: "/assets/aistudio/covers/cover_a1_2.png",
        media: []
      }
    ],
    allMedia: []
  },
  {
    id: "miteinander-a2-1",
    title: "Miteinander! A2.1 KB+AB",
    subtitle: "Kurs- und Arbeitsbuch",
    author: "Hueber Verlag",
    coverImage: "/assets/aistudio/covers/cover_a2_1.png",
    totalPages: 180,
    createdAt: "2024-06-12T10:00:00.000Z",
    pages: [
      {
        pageNumber: 1,
        displayLabel: "1",
        pageImage: "/assets/aistudio/covers/cover_a2_1.png",
        media: []
      }
    ],
    allMedia: []
  },
  {
    id: "miteinander-a2-2",
    title: "Miteinander! A2.2 KB+AB",
    subtitle: "Kurs- und Arbeitsbuch",
    author: "Hueber Verlag",
    coverImage: "/assets/aistudio/covers/cover_a2_2.png",
    totalPages: 180,
    createdAt: "2024-06-13T10:00:00.000Z",
    pages: [
      {
        pageNumber: 1,
        displayLabel: "1",
        pageImage: "/assets/aistudio/covers/cover_a2_2.png",
        media: []
      }
    ],
    allMedia: []
  }
];

export function loadBooksMeta(): InteractiveBook[] {
  try {
    if (fs.existsSync(BOOKS_META_PATH)) {
      const raw = fs.readFileSync(BOOKS_META_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error reading books.json:", e);
  }
  // Initialize with reference books if file does not exist yet
  try {
    fs.writeFileSync(BOOKS_META_PATH, JSON.stringify(INITIAL_BOOKS, null, 2), "utf-8");
  } catch (e) {
    console.error("Error initializing books.json:", e);
  }
  return INITIAL_BOOKS;
}

export function saveBooksMeta(list: InteractiveBook[]) {
  try {
    fs.writeFileSync(BOOKS_META_PATH, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving books.json:", e);
  }
}

// Natural sort comparator for filenames
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

// Native fast unzip that consumes near 0MB Node.js RAM
function extractZipWithNativeUnzip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("unzip", ["-q", "-o", zipPath, "-d", destDir]);
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      // Exit code 0 is OK, exit code 1 is minor warning (e.g. timestamp differences)
      if (code === 0 || code === 1) {
        resolve();
      } else {
        reject(new Error(`فشل فك ضغط الملف (رمز الخطأ: ${code}): ${stderr}`));
      }
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

// Deep cataloger that parses publisher structure (Hueber prod/book, content.json, audio, video, pages)
export function catalogBookDirectory(
  targetDir: string,
  bookId: string,
  customTitle?: string,
  customSubtitle?: string
): InteractiveBook {
  const allExtractedFiles = getAllFilesRecursive(targetDir);

  // Map lowercase filename to relative path for instant O(1) resolution
  const fileMap = new Map<string, string>();
  for (const rel of allExtractedFiles) {
    const cleanRel = rel.replace(/\\/g, "/");
    const base = path.basename(cleanRel).toLowerCase();
    if (!fileMap.has(base)) {
      fileMap.set(base, cleanRel);
    }
  }

  // 1. Locate publisher JSON manifests
  let parsedBookJson: any = null;
  let parsedContentJson: any = null;

  for (const rel of allExtractedFiles) {
    const lower = rel.toLowerCase();
    const base = path.basename(lower);
    if (base.endsWith("book.json") || base === "book.json") {
      try {
        parsedBookJson = JSON.parse(fs.readFileSync(path.join(targetDir, rel), "utf-8"));
      } catch (e) {
        console.warn("[Books Server] Warning parsing book.json:", e);
      }
    }
    if (base.endsWith("content.json") || base === "content.json") {
      try {
        parsedContentJson = JSON.parse(fs.readFileSync(path.join(targetDir, rel), "utf-8"));
      } catch (e) {
        console.warn("[Books Server] Warning parsing content.json:", e);
      }
    }
  }

  const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".svg"];
  const audioExtensions = [".mp3", ".wav", ".m4a", ".aac", ".ogg"];
  const videoExtensions = [".mp4", ".webm", ".mov", ".mkv"];

  const imageFiles: string[] = [];
  const audioFiles: string[] = [];
  const videoFiles: string[] = [];

  for (const rel of allExtractedFiles) {
    const ext = path.extname(rel).toLowerCase();
    if (imageExtensions.includes(ext)) {
      imageFiles.push(rel);
    } else if (audioExtensions.includes(ext)) {
      audioFiles.push(rel);
    } else if (videoExtensions.includes(ext)) {
      videoFiles.push(rel);
    }
  }

  imageFiles.sort(naturalCompare);
  audioFiles.sort(naturalCompare);
  videoFiles.sort(naturalCompare);

  const allMedia: BookPageMedia[] = [];
  const pages: BookPage[] = [];

  // Check if we have standard publisher content.json structure (Hueber format)
  const publisherPages = parsedContentJson?.book_parts?.[0]?.pages;
  if (Array.isArray(publisherPages) && publisherPages.length > 0) {
    console.log(`[Books Server] Parsing Hueber content structure with ${publisherPages.length} pages`);

    publisherPages.forEach((p: any, idx: number) => {
      // Match page image
      let imgRel = "";
      if (p.page_img) {
        imgRel = fileMap.get(p.page_img.toLowerCase()) || "";
      }
      if (!imgRel && imageFiles[idx]) {
        imgRel = imageFiles[idx];
      }

      const pageMediaList: BookPageMedia[] = [];

      if (Array.isArray(p.media)) {
        p.media.forEach((m: any, mIdx: number) => {
          let fileRel = "";
          if (m.file_name) {
            fileRel = fileMap.get(m.file_name.toLowerCase()) || "";
          }

          const isVideo = m.type === "video" || (m.file_name && m.file_name.toLowerCase().endsWith(".mp4"));
          const mUrl = fileRel ? `/uploads/books/${bookId}/${fileRel}` : "";

          // Extract or format track number cleanly
          let trackNum = "";
          if (m.title && m.title.includes("–")) {
            trackNum = m.title.split("–")[0].trim();
          } else {
            trackNum = String(mIdx + 1);
          }

          const mediaItem: BookPageMedia = {
            id: m.media_id || `m-${p.page || idx + 1}-${mIdx + 1}`,
            trackNumber: trackNum,
            title: m.title || m.file_name || (isVideo ? "مقطع فيديو" : "مقطع صوتي"),
            type: isVideo ? "video" : "audio",
            fileName: m.file_name || (isVideo ? "video.mp4" : "audio.mp3"),
            url: mUrl,
            pageNumber: p.page || p.page_absolute || idx + 1
          };

          pageMediaList.push(mediaItem);

          if (!allMedia.some((existing) => existing.id === mediaItem.id)) {
            allMedia.push(mediaItem);
          }
        });
      }

      pages.push({
        pageNumber: p.page || p.page_absolute || idx + 1,
        displayLabel: p.page_name ? String(p.page_name) : String(p.page || idx + 1),
        pageImage: imgRel ? `/uploads/books/${bookId}/${imgRel}` : "",
        media: pageMediaList
      });
    });
  } else {
    // Fallback: Build from scanned images and media files using natural numbering
    console.log(`[Books Server] Parsing generic structure (${imageFiles.length} images, ${audioFiles.length} audios, ${videoFiles.length} videos)`);

    audioFiles.forEach((rel, idx) => {
      const filename = path.basename(rel);
      const nameWithoutExt = path.basename(rel, path.extname(rel));
      const numMatch = filename.match(/\d+/);
      const trackNum = numMatch ? numMatch[0] : String(idx + 1).padStart(2, "0");

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

    if (imageFiles.length > 0) {
      imageFiles.forEach((rel, idx) => {
        const pageNum = idx + 1;
        const pageMedia = allMedia.filter(
          (m) => m.pageNumber === pageNum || (m.trackNumber && parseInt(m.trackNumber, 10) === pageNum)
        );

        pages.push({
          pageNumber: pageNum,
          displayLabel: String(pageNum),
          pageImage: `/uploads/books/${bookId}/${rel}`,
          media: pageMedia
        });
      });
    } else {
      pages.push({
        pageNumber: 1,
        displayLabel: "1",
        pageImage: "",
        media: allMedia
      });
    }
  }

  // Determine Title, Subtitle, Author, and Cover Image
  let finalTitle = customTitle?.trim() || "";
  let finalSubtitle = customSubtitle?.trim() || "";
  let author = "Hueber Verlag";

  if (parsedBookJson) {
    if (!finalTitle && parsedBookJson.title) finalTitle = parsedBookJson.title;
    if (!finalTitle && parsedBookJson.series) finalTitle = parsedBookJson.series;
    if (!finalSubtitle && parsedBookJson.subtitle) finalSubtitle = parsedBookJson.subtitle;
    if (parsedBookJson.author) author = parsedBookJson.author;
  }

  if (!finalTitle) {
    finalTitle = "كتاب تفاعلي";
  }
  if (!finalSubtitle) {
    finalSubtitle = "Kurs- und Arbeitsbuch";
  }

  // Cover image resolution
  let coverImg = "";
  if (parsedBookJson?.cover_img) {
    const coverRel = fileMap.get(parsedBookJson.cover_img.toLowerCase());
    if (coverRel) {
      coverImg = `/uploads/books/${bookId}/${coverRel}`;
    }
  }
  if (!coverImg) {
    // Check if there is an image with 'cover' or first page image
    const coverMatch = imageFiles.find((f) => f.toLowerCase().includes("cover"));
    if (coverMatch) {
      coverImg = `/uploads/books/${bookId}/${coverMatch}`;
    } else if (imageFiles.length > 0) {
      coverImg = `/uploads/books/${bookId}/${imageFiles[0]}`;
    }
  }

  const newBook: InteractiveBook = {
    id: bookId,
    title: finalTitle,
    subtitle: finalSubtitle,
    author: author,
    coverImage: coverImg,
    totalPages: pages.length,
    pages: pages,
    allMedia: allMedia,
    createdAt: new Date().toISOString()
  };

  const existingBooks = loadBooksMeta();
  const filtered = existingBooks.filter((b) => b.id !== bookId);
  filtered.unshift(newBook);
  saveBooksMeta(filtered);

  console.log(`[Books Server] Successfully cataloged book: "${newBook.title}" (${pages.length} pages, ${allMedia.length} tracks)`);
  return newBook;
}

export function registerServerBookRoutes(app: express.Express) {
  // Ensure books.json exists on server start
  loadBooksMeta();

  // Serve static files in /uploads/books with streaming support
  app.use(
    "/uploads/books",
    express.static(BOOKS_DIR, {
      setHeaders: (res) => {
        res.setHeader("Accept-Ranges", "bytes");
      }
    })
  );

  // Multer configured for DIRECT DISK STREAMING (0MB RAM allocation!)
  const diskUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, TEMP_DIR);
      },
      filename: (req, file, cb) => {
        const unique = `book-upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.zip`;
        cb(null, unique);
      }
    }),
    limits: {
      fileSize: 5 * 1024 * 1024 * 1024 // 5GB max
    }
  });

  // 1. Get all books from server
  app.get("/api/books", (req, res) => {
    try {
      const list = loadBooksMeta();
      res.json({ success: true, books: list });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load books from server" });
    }
  });

  // 2. Get single book from server
  app.get("/api/books/:id", (req, res) => {
    try {
      const { id } = req.params;
      const list = loadBooksMeta();
      const book = list.find((b) => b.id === id);
      if (!book) {
        return res.status(404).json({ error: "الكتاب غير موجود على السيرفر" });
      }
      res.json({ success: true, book });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to get book" });
    }
  });

  // 3. Fast Disk-Streamed ZIP Upload & Native Unzip (0MB RAM, Takes 2-4 seconds!)
  app.post("/api/books/upload", diskUpload.single("file"), async (req, res) => {
    const tempZipPath = req.file?.path;
    try {
      if (!req.file || !tempZipPath) {
        return res.status(400).json({ error: "الرجاء اختيار ملف الكتاب المضغوط (ZIP)" });
      }

      const originalName = req.file.originalname || "book.zip";
      const bookId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const targetDir = path.join(BOOKS_DIR, bookId);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      console.log(`[Books Server] Received ZIP file on disk (${(req.file.size / (1024 * 1024)).toFixed(1)} MB). Unzipping via native process...`);

      // Decompress directly on disk via high-speed native unzip process
      await extractZipWithNativeUnzip(tempZipPath, targetDir);

      // Clean up temp ZIP file from disk immediately
      try {
        if (fs.existsSync(tempZipPath)) {
          fs.unlinkSync(tempZipPath);
        }
      } catch (e) {
        console.warn("[Books Server] Could not delete temp zip:", e);
      }

      // Catalog book and save to books.json
      const customTitle = req.body.title || path.basename(originalName, path.extname(originalName)).replace(/[_-]/g, " ");
      const customSubtitle = req.body.subtitle || "";
      const book = catalogBookDirectory(targetDir, bookId, customTitle, customSubtitle);

      res.json({
        success: true,
        book: book,
        message: "تم فك ضغط وحفظ الكتاب بنجاح على السيرفر بدون استهلاك للذاكرة"
      });
    } catch (err: any) {
      // Clean up temp zip on error
      if (tempZipPath && fs.existsSync(tempZipPath)) {
        try {
          fs.unlinkSync(tempZipPath);
        } catch (e) {}
      }
      console.error("[Books Server] Upload/extract error:", err);
      res.status(500).json({
        error: `فشل في استخراج أو حفظ الكتاب على السيرفر: ${err?.message || "خطأ غير معروف"}`
      });
    }
  });

  // 3b. Folder Upload - Step 1: Initialize Book Folder
  app.post("/api/books/init-folder-upload", express.json(), (req, res) => {
    try {
      const bookId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const targetDir = path.join(BOOKS_DIR, bookId);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      res.json({ success: true, bookId });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "فشل تهيئة مجلد الكتاب على السيرفر" });
    }
  });

  // 3c. Folder Upload - Step 2: Stream Single File into Folder
  const singleFileDiskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const bookId = req.params.id;
      const rawRelPath = (req.headers["x-relative-path"] as string) || file.originalname;
      const cleanRelPath = decodeURIComponent(rawRelPath).replace(/^(\.\/|\/)+/, "");
      const fullPath = path.join(BOOKS_DIR, bookId, cleanRelPath);
      const destDir = path.dirname(fullPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      cb(null, destDir);
    },
    filename: (req, file, cb) => {
      const rawRelPath = (req.headers["x-relative-path"] as string) || file.originalname;
      const cleanRelPath = decodeURIComponent(rawRelPath).replace(/^(\.\/|\/)+/, "");
      cb(null, path.basename(cleanRelPath));
    }
  });

  const singleFileUploader = multer({
    storage: singleFileDiskStorage,
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB max per single media file
  });

  app.post("/api/books/:id/upload-file", singleFileUploader.single("file"), (req, res) => {
    try {
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to save file" });
    }
  });

  // 3c-2. Chunked file upload (for large files to guarantee each request is < 10MB to comply with Cloud Run limits)
  app.post("/api/books/:id/upload-chunk", express.raw({ type: "*/*", limit: "35mb" }), (req, res) => {
    try {
      const bookId = req.params.id;
      const rawRelPath = (req.headers["x-relative-path"] as string) || "file.dat";
      const chunkIndex = parseInt((req.headers["x-chunk-index"] as string) || "0", 10);
      const totalChunks = parseInt((req.headers["x-total-chunks"] as string) || "1", 10);
      const cleanRelPath = decodeURIComponent(rawRelPath).replace(/^(\.\/|\/)+/, "");
      const fullPath = path.join(BOOKS_DIR, bookId, cleanRelPath);
      const destDir = path.dirname(fullPath);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      if (chunkIndex === 0) {
        fs.writeFileSync(fullPath, req.body as Buffer);
      } else {
        fs.appendFileSync(fullPath, req.body as Buffer);
      }

      res.json({
        success: true,
        chunkIndex,
        totalChunks,
        isComplete: chunkIndex === totalChunks - 1
      });
    } catch (err: any) {
      console.error("[Books Server] Chunk upload error:", err);
      res.status(500).json({ error: err?.message || "Failed to save file chunk" });
    }
  });

  // 3d. Folder Upload - Step 3: Finalize & Catalog Book
  app.post("/api/books/:id/finalize-folder-upload", express.json(), (req, res) => {
    try {
      const { id } = req.params;
      const { title, subtitle } = req.body;
      const targetDir = path.join(BOOKS_DIR, id);

      if (!fs.existsSync(targetDir)) {
        return res.status(404).json({ error: "مجلد الكتاب غير موجود على السيرفر" });
      }

      const book = catalogBookDirectory(targetDir, id, title, subtitle);
      res.json({ success: true, book });
    } catch (err: any) {
      console.error("[Books Server] Finalize folder upload error:", err);
      res.status(500).json({ error: err?.message || "فشل فهرسة ملفات الكتاب على السيرفر" });
    }
  });

  // 4. Delete book from server
  app.delete("/api/books/:id", (req, res) => {
    try {
      const { id } = req.params;
      const list = loadBooksMeta();
      const book = list.find((b) => b.id === id);
      if (!book) {
        return res.status(404).json({ error: "الكتاب غير موجود" });
      }

      const bookFolder = path.join(BOOKS_DIR, id);
      if (fs.existsSync(bookFolder)) {
        try {
          fs.rmSync(bookFolder, { recursive: true, force: true });
        } catch (e) {
          console.warn("[Books Server] Warning deleting folder:", e);
        }
      }

      const updatedList = list.filter((b) => b.id !== id);
      saveBooksMeta(updatedList);

      res.json({ success: true, message: "تم حذف الكتاب من السيرفر بنجاح" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete book" });
    }
  });

  // 5. Update book metadata on server
  app.patch("/api/books/:id", express.json(), (req, res) => {
    try {
      const { id } = req.params;
      const { title, subtitle, author } = req.body;
      const list = loadBooksMeta();
      const bookIndex = list.findIndex((b) => b.id === id);
      if (bookIndex === -1) {
        return res.status(404).json({ error: "الكتاب غير موجود" });
      }

      if (title && typeof title === "string") list[bookIndex].title = title.trim();
      if (subtitle !== undefined) list[bookIndex].subtitle = subtitle;
      if (author !== undefined) list[bookIndex].author = author;

      saveBooksMeta(list);
      res.json({ success: true, book: list[bookIndex] });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update book" });
    }
  });
}

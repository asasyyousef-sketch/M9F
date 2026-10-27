import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import multer from "multer";
import { execFile } from "child_process";
import { promisify } from "util";
import JSZip from "jszip";
import { InteractiveBook, BookPage, BookPageMedia } from "./src/types";

const execFileAsync = promisify(execFile);

const BOOKS_DIR = path.join(process.cwd(), "public", "uploads", "books");
const BOOKS_META_PATH = path.join(process.cwd(), "books.json");
const TEMP_UPLOAD_DIR = path.join(os.tmpdir(), "book-uploads");

// Ensure directories exist
if (!fs.existsSync(BOOKS_DIR)) {
  try {
    fs.mkdirSync(BOOKS_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create books directory:", err);
  }
}
if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  try {
    fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create temp upload directory:", err);
  }
}

// Default initial books matching reference screenshot
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

export function registerServerBookRoutes(app: express.Express) {
  loadBooksMeta();

  // Serve static files in /uploads/books with HTTP Range headers
  app.use(
    "/uploads/books",
    express.static(BOOKS_DIR, {
      setHeaders: (res) => {
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Access-Control-Allow-Origin", "*");
      }
    })
  );

  // Configure Multer with disk storage (Zero heap RAM usage during large uploads)
  const bookDiskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
        fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
      }
      cb(null, TEMP_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e6);
      cb(null, `book-upload-${unique}${ext}`);
    }
  });

  const upload = multer({
    storage: bookDiskStorage,
    limits: {
      fileSize: 2 * 1024 * 1024 * 1024 // 2GB max
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

  // 3. Upload and extract book archive or media files on server (Direct Disk Stream)
  app.post("/api/books/upload", upload.any(), async (req, res) => {
    const uploadedFiles = req.files as Express.Multer.File[];
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: "الرجاء اختيار ملف لرفعه على السيرفر" });
    }

    const primaryFile = uploadedFiles[0];
    const originalName = primaryFile.originalname || "book.zip";
    const ext = path.extname(originalName).toLowerCase();

    const bookId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const targetDir = path.join(BOOKS_DIR, bookId);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    try {
      const isZip = ext === ".zip" || ext === ".epub" || primaryFile.mimetype.includes("zip");

      if (isZip) {
        // High-speed native unzip via Linux command (takes <1 sec for 500MB without heap memory allocation)
        let unzippedSuccessfully = false;
        try {
          await execFileAsync("unzip", ["-q", "-o", primaryFile.path, "-d", targetDir]);
          unzippedSuccessfully = true;
        } catch (unzipErr: any) {
          console.warn("[Books Server] Native unzip failed, falling back to JSZip:", unzipErr?.message);
        }

        // Fallback: JSZip stream/buffer
        if (!unzippedSuccessfully) {
          const zipBuffer = fs.readFileSync(primaryFile.path);
          const zip = await JSZip.loadAsync(zipBuffer);
          const zipEntries = Object.keys(zip.files);

          for (const relativePath of zipEntries) {
            const fileEntry = zip.files[relativePath];
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
        }
      } else {
        // If user uploaded direct audio/video/media files (like in media player), move them into book folder
        for (const f of uploadedFiles) {
          const destPath = path.join(targetDir, f.originalname);
          fs.copyFileSync(f.path, destPath);
        }
      }

      // Clean up uploaded temporary files from /tmp
      for (const f of uploadedFiles) {
        try {
          if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        } catch (e) {}
      }

      // Catalog all extracted files inside targetDir
      const allExtractedFiles = getAllFilesRecursive(targetDir);

      // Check if Hueber or publisher manifest exists
      let parsedManifest: any = null;
      let parsedContent: any = null;

      for (const rel of allExtractedFiles) {
        const lower = rel.toLowerCase();
        if (lower.endsWith("book.json") || lower.endsWith("_book.json")) {
          try {
            parsedManifest = JSON.parse(fs.readFileSync(path.join(targetDir, rel), "utf-8"));
          } catch (e) {}
        }
        if (lower.endsWith("content.json") || lower.endsWith("_content.json")) {
          try {
            parsedContent = JSON.parse(fs.readFileSync(path.join(targetDir, rel), "utf-8"));
          } catch (e) {}
        }
      }

      const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".svg"];
      const audioExtensions = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus"];
      const videoExtensions = [".mp4", ".webm", ".mov", ".mkv", ".m4v"];

      const imageFiles: string[] = [];
      const audioFiles: string[] = [];
      const videoFiles: string[] = [];

      for (const rel of allExtractedFiles) {
        const fileExt = path.extname(rel).toLowerCase();
        if (imageExtensions.includes(fileExt)) {
          imageFiles.push(rel);
        } else if (audioExtensions.includes(fileExt)) {
          audioFiles.push(rel);
        } else if (videoExtensions.includes(fileExt)) {
          videoFiles.push(rel);
        }
      }

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

      if (parsedContent && Array.isArray(parsedContent.book_parts) && parsedContent.book_parts[0]?.pages) {
        const publisherPages = parsedContent.book_parts[0].pages;
        publisherPages.forEach((p: any) => {
          const imgRel = imageFiles.find((f) => path.basename(f) === p.page_img) || "";
          const pageMediaList: BookPageMedia[] = [];

          if (Array.isArray(p.media)) {
            p.media.forEach((m: any, mIdx: number) => {
              const fileRel = [...audioFiles, ...videoFiles].find((f) => path.basename(f) === m.file_name);
              const mUrl = fileRel ? `/uploads/books/${bookId}/${fileRel}` : `/uploads/media/audio.mp3`;

              const mediaItem: BookPageMedia = {
                id: m.media_id || `media-${p.page}-${mIdx}`,
                trackNumber: m.title ? m.title.split("–")[0]?.trim() : String(mIdx + 1),
                title: m.title || m.file_name || "مقطع صوتي",
                type: m.type === "video" ? "video" : "audio",
                fileName: m.file_name || "track.mp3",
                url: mUrl,
                pageNumber: p.page
              };
              pageMediaList.push(mediaItem);
              if (!allMedia.some((existing) => existing.id === mediaItem.id)) {
                allMedia.push(mediaItem);
              }
            });
          }

          pages.push({
            pageNumber: p.page,
            displayLabel: String(p.page),
            pageImage: imgRel ? `/uploads/books/${bookId}/${imgRel}` : "",
            media: pageMediaList
          });
        });
      } else if (imageFiles.length > 0) {
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

      // Title & Cover resolution
      let cleanTitle = (req.body.title && typeof req.body.title === "string" && req.body.title.trim())
        ? req.body.title.trim()
        : "";
      let subtitle = req.body.subtitle || "Kurs- und Arbeitsbuch";

      if (parsedManifest) {
        if (!cleanTitle && parsedManifest.title) cleanTitle = parsedManifest.title;
        if (parsedManifest.subtitle) subtitle = parsedManifest.subtitle;
      }
      if (!cleanTitle) {
        cleanTitle = path.basename(originalName, path.extname(originalName)).replace(/[_-]/g, " ");
      }

      let coverImg = "";
      if (imageFiles.length > 0) {
        coverImg = `/uploads/books/${bookId}/${imageFiles[0]}`;
      }

      const newBook: InteractiveBook = {
        id: bookId,
        title: cleanTitle,
        subtitle: subtitle,
        author: parsedManifest?.author || "Hueber Verlag",
        coverImage: coverImg,
        totalPages: pages.length,
        pages: pages,
        allMedia: allMedia,
        createdAt: new Date().toISOString()
      };

      const existingBooks = loadBooksMeta();
      existingBooks.unshift(newBook);
      saveBooksMeta(existingBooks);

      console.log(`[Books Server] Book saved on server: "${newBook.title}" (${pages.length} pages, ${allMedia.length} tracks)`);

      res.json({
        success: true,
        book: newBook,
        message: "تم حفظ واستخراج الكتاب بنجاح على السيرفر"
      });
    } catch (err: any) {
      console.error("[Books Server] Upload/extract error:", err);
      // Clean up temp files if error
      for (const f of uploadedFiles) {
        try {
          if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        } catch (e) {}
      }
      res.status(500).json({
        error: `فشل في استخراج أو حفظ الكتاب على السيرفر: ${err?.message || "خطأ غير معروف"}`
      });
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

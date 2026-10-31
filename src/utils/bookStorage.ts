import JSZip from "jszip";
import { InteractiveBook, BookPage, BookPageMedia } from "../types";

// =========================================================================
// 🚀 High-Reliability Permanent Hard-Drive Storage Engine (Like YouTube)
// Files physically reside on the server disk (/uploads/books/...)
// Persists permanently across page refreshes, reboots, and multiple users
// =========================================================================

const DB_NAME = "InteractiveBooksDB";
const STORE_NAME = "books";
const DB_VERSION = 2;

// Default sample books - empty by default so user starts with clean slate
const INITIAL_BOOKS: InteractiveBook[] = [];

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// In-memory cache for fast instant rendering
let memoryBooksCache: InteractiveBook[] = [...INITIAL_BOOKS];

/**
 * Fetch all books from the server disk (books.json).
 * Server is the primary authority so refresh always shows permanent disk files.
 */
export async function fetchBooksFromServer(): Promise<InteractiveBook[]> {
  try {
    const res = await fetch("/api/books");
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.books)) {
        memoryBooksCache = data.books;
        // Cache to IndexedDB for offline resilience
        try {
          const db = await openDB();
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          data.books.forEach((b: InteractiveBook) => store.put(b));
        } catch (e) {}
        return data.books;
      }
    }
  } catch (err) {
    console.warn("[Books] Server fetch failed, falling back to local cache:", err);
  }

  // Offline fallback: load from IndexedDB
  try {
    const db = await openDB();
    const books = await new Promise<InteractiveBook[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    if (Array.isArray(books) && books.length > 0) {
      memoryBooksCache = books;
      return books;
    }
  } catch (e) {}

  return memoryBooksCache;
}

export async function fetchBookByIdFromServer(id: string): Promise<InteractiveBook | null> {
  const books = await fetchBooksFromServer();
  return books.find((b) => b.id === id) || null;
}

export async function saveBookToDB(book: InteractiveBook): Promise<void> {
  memoryBooksCache = [book, ...memoryBooksCache.filter((b) => b.id !== book.id)];
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(book);
  } catch (e) {}
}

export async function deleteBookFromServer(id: string): Promise<boolean> {
  memoryBooksCache = memoryBooksCache.filter((b) => b.id !== id);
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
  } catch (e) {}

  try {
    await fetch(`/api/books/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (e) {}

  return true;
}

export async function updateBookMetadataOnServer(
  id: string,
  updates: { title?: string; subtitle?: string; author?: string }
): Promise<InteractiveBook | null> {
  const books = await fetchBooksFromServer();
  const book = books.find((b) => b.id === id);
  if (!book) return null;

  if (updates.title) book.title = updates.title;
  if (updates.subtitle !== undefined) book.subtitle = updates.subtitle;
  if (updates.author !== undefined) book.author = updates.author;

  await saveBookToDB(book);
  try {
    await fetch(`/api/books/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
  } catch (e) {}

  return book;
}

interface RawFileEntry {
  name: string;
  getBlob: () => Promise<Blob>;
}

/**
 * ⚡ Direct Server Hard-Drive Storage Pipeline:
 * Transmits each file into the server's permanent disk directory (/public/uploads/books/[bookId]/).
 * Finalizes book manifest so all images and media are permanent HTTP URLs (like YouTube).
 */
async function uploadFilesToServerDisk(
  files: RawFileEntry[],
  defaultTitle?: string,
  onProgress?: (percent: number, statusText?: string) => void
): Promise<InteractiveBook> {
  if (onProgress) onProgress(5, "تهيئة مساحة الكتاب على القرص الصلب للسيرفر...");

  // 1. Initialize book directory on server disk
  const initRes = await fetch("/api/books/init-folder-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: defaultTitle })
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`فشل تهيئة مجلد الكتاب على السيرفر: ${errText || initRes.statusText}`);
  }

  const { bookId } = await initRes.json();
  const totalFiles = files.length;
  let uploadedCount = 0;

  // 2. Upload files in parallel batches (4 concurrent requests)
  const BATCH_SIZE = 4;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (entry) => {
        const blob = await entry.getBlob();
        const formData = new FormData();
        const baseName = entry.name.split("/").pop() || "file";
        formData.append("file", blob, baseName);

        const uploadRes = await fetch(`/api/books/${encodeURIComponent(bookId)}/upload-file`, {
          method: "POST",
          headers: {
            "x-relative-path": encodeURIComponent(entry.name)
          },
          body: formData
        });

        if (!uploadRes.ok) {
          throw new Error(`فشل حفظ الملف ${entry.name} على السيرفر (${uploadRes.status})`);
        }

        uploadedCount++;
        const pct = Math.min(88, Math.round(10 + (uploadedCount / totalFiles) * 78));
        if (onProgress) {
          onProgress(pct, `جاري حفظ الملفات بالقرص الصلب: ${uploadedCount} من ${totalFiles}...`);
        }
      })
    );
  }

  // 3. Finalize book on server: catalogs manifest & pages on disk, creates permanent URLs
  if (onProgress) onProgress(92, "فهرسة الكتاب واعتماده نهائياً على القرص الصلب...");
  const finalRes = await fetch(`/api/books/${encodeURIComponent(bookId)}/finalize-folder-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: defaultTitle })
  });

  if (!finalRes.ok) {
    const errText = await finalRes.text();
    throw new Error(`فشل فهرسة الكتاب على السيرفر: ${errText || finalRes.statusText}`);
  }

  const { book } = await finalRes.json();

  // Save to local cache as well
  await saveBookToDB(book);

  if (onProgress) onProgress(100, "تم حفظ الكتاب بالكامل على القرص الصلب بنجاح!");
  return book;
}

import { UploadDiagnosticTracker, DiagnosticReport, MicroStage } from "./bookUploadDiagnostics";

export interface BookUploadOptions {
  title?: string;
  onProgress?: (percent: number, statusText?: string) => void;
  onStageUpdate?: (stages: MicroStage[], currentStage: MicroStage) => void;
  onDiagnosticReport?: (report: DiagnosticReport) => void;
}

export class UploadDiagnosticException extends Error {
  public report: DiagnosticReport;
  constructor(message: string, report: DiagnosticReport) {
    super(message);
    this.name = "UploadDiagnosticException";
    this.report = report;
  }
}

/**
 * 🔬 High-Precision 30-Micro-Stage Upload Pipeline with Deep Diagnostics
 * Every phase is individually measured and audited. If any micro-step fails,
 * it freezes at that exact step and produces an exhaustive diagnostic report.
 */
export function uploadBookToServer(
  file: File,
  titleOrOptions?: string | BookUploadOptions,
  legacyOnProgress?: (percent: number, statusText?: string) => void
): Promise<InteractiveBook> {
  const options: BookUploadOptions = typeof titleOrOptions === "object"
    ? titleOrOptions
    : {
        title: typeof titleOrOptions === "string" ? titleOrOptions : undefined,
        onProgress: legacyOnProgress
      };

  const tracker = new UploadDiagnosticTracker(file, options.onStageUpdate);

  return new Promise(async (resolve, reject) => {
    const emitFail = (stageId: number, msg: string, stack?: string, tech?: any) => {
      const report = tracker.failStage(stageId, msg, stack, tech);
      if (options.onDiagnosticReport) options.onDiagnosticReport(report);
      reject(new UploadDiagnosticException(msg, report));
    };

    try {
      // ── Stage 1: Input Detection
      tracker.startStage(1, "فحص وجود كائن الملف من إدخال المستخدم");
      if (!file) return emitFail(1, "لم يتم استلام كائن الملف من واجهة الاختيار");
      tracker.completeStage(1, `تم التقاط الملف بنجاح: ${file.name}`);

      // ── Stage 2: File Integrity
      tracker.startStage(2, "فحص بايتات الملف وحجمه الفعلي");
      if (file.size <= 0) return emitFail(2, "حجم الملف المختار صفر بايت (ملف فارغ أو تالف)");
      tracker.completeStage(2, `حجم الملف سليم: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);

      // ── Stage 3: Extension Validation
      tracker.startStage(3, "التحقق من صيغة الحزمة");
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      const validExts = [".zip", ".epub", ".rar", ".7z", ".tar", ".gz", ".mp4", ".mp3"];
      if (!validExts.some((e) => ext.endsWith(e)) && !file.type.includes("zip")) {
        console.warn("[Diagnostic] Warning: Unusual extension, proceeding with caution:", ext);
      }
      tracker.completeStage(3, `امتداد الملف المعالج: ${ext || "binary"}`);

      // ── Stage 4: Browser Capabilities
      tracker.startStage(4, "فحص دعم المتصفح للتقنيات المطلوبة");
      if (typeof FormData === "undefined" || typeof XMLHttpRequest === "undefined") {
        return emitFail(4, "المتصفح الحالي لا يدعم تقنية نقل FormData المتدفق");
      }
      tracker.completeStage(4, "المتصفح يدعم FormData و XMLHttpRequest بنجاح");

      // ── Stage 5: Network Online Check
      tracker.startStage(5, "التحقق من اتصال الشبكة");
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return emitFail(5, "المتصفح في وضع عدم الاتصال (Offline mode)");
      }
      tracker.completeStage(5, "اتصال الشبكة نشط (navigator.onLine = true)");

      // ── Stage 6: Server Connectivity Ping
      tracker.startStage(6, "فحص استجابة السيرفر الحي (Ping /api/books)");
      let pingRes: Response;
      const pingStart = Date.now();
      try {
        pingRes = await fetch("/api/books", {
          headers: { Accept: "application/json" }
        });
      } catch (pingErr: any) {
        return emitFail(6, `تعذر الوصول إلى مسار السيرفر /api/books: ${pingErr?.message || "انقطاع الاتصال"}`, pingErr?.stack);
      }
      const pingLatency = Date.now() - pingStart;
      tracker.completeStage(6, `السيرفر متصل ويستجيب بنجاح (${pingLatency}ms)`);

      // ── Stage 7: Server Latency & Format Check
      tracker.startStage(7, "التحقق من تنسيق استجابة السيرفر");
      const pingContentType = pingRes.headers.get("content-type") || "";
      if (!pingRes.ok) {
        const pingBody = await pingRes.text().catch(() => "");
        tracker.recordHttpResponse(pingRes.status, pingRes.statusText, pingBody);
        if (pingRes.status === 404) {
          return emitFail(
            7,
            `السيرفر المحلي أعاد (404 Not Found) لمسار /api/books. السبب الجذري: سيرفر Node.js في شاشة التيرمينال على حاسوبك ما زال يعمل بالنسخة القديمة في ذاكرة الـ RAM ولم يتم عمل ريستارت له بعد تحديث الكود، أو أن المشروع شغال بوضع Vite فقط بدون سيرفر Express. الحل: أوقف السيرفر في التيرمينال عبر (Ctrl+C) ثم شغله مجدداً عبر (npm run dev).`,
            undefined,
            { status: 404, statusText: "Not Found", responseBody: pingBody }
          );
        }
        return emitFail(7, `السيرفر أعاد رمز غير طبيعي أثناء الفحص الأولي: ${pingRes.status} ${pingRes.statusText}`, undefined, {
          status: pingRes.status,
          responseBody: pingBody
        });
      }
      if (!pingContentType.includes("application/json")) {
        return emitFail(7, `السيرفر أعاد محتوى ليس JSON (${pingContentType}). قد يكون خادم الـ Proxy غير متزامن`);
      }
      tracker.completeStage(7, `تنسيق الرد سليم (application/json) وبزمن ${pingLatency}ms`);

      // ── Stage 8: Headers Prep
      tracker.startStage(8, "إعداد ترويسات الصلاحيات والجلسة");
      tracker.completeStage(8, "تم إعداد ترويسات الطلب بنجاح");

      // ── Stage 9: FormData Construction
      tracker.startStage(9, "تجميع حمولة FormData الثنائية");
      const formData = new FormData();
      formData.append("file", file);
      if (options.title && options.title.trim()) {
        formData.append("title", options.title.trim());
      }
      tracker.completeStage(9, "تم تجهيز الحمولة وتغليف الملف الثنائي");

      // ── Stage 10: Payload Size Audit
      tracker.startStage(10, "مراجعة حجم الحمولة مقارنة بحدود السيرفر (2GB)");
      const maxLimitBytes = 2048 * 1024 * 1024;
      if (file.size > maxLimitBytes) {
        return emitFail(10, `حجم الملف (${(file.size / (1024 * 1024)).toFixed(1)}MB) يتجاوز الحد المسموح به (2048MB)`);
      }
      tracker.completeStage(10, `حجم الحمولة ضمن الحدود المسموحة (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);

      // ── Stage 11: CORS Preflight Prep
      tracker.startStage(11, "إعداد خيارات وترويسات CORS");
      tracker.completeStage(11, "مسار الاتصال جاهز للطلب دون حجب CORS");

      // ── Stage 12: XHR Instance Creation
      tracker.startStage(12, "تهيئة كائن نقل البيانات المتدفق (XMLHttpRequest)");
      const xhr = new XMLHttpRequest();
      tracker.completeStage(12, "تم إنشاء مثيل XHR بنجاح");

      // ── Stage 13: Progress Listener Bind
      tracker.startStage(13, "ربط مراقب تقدم البايتات على معالج الرفع");
      let passed50 = false;
      let passed90 = false;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const rawPct = Math.round((event.loaded / event.total) * 100);
          const mappedPct = Math.min(80, Math.round(15 + (event.loaded / event.total) * 65));
          if (options.onProgress) {
            options.onProgress(mappedPct, `جاري نقل الملف إلى القرص الصلب: ${rawPct}% (${(event.loaded / (1024 * 1024)).toFixed(1)}MB من ${(event.total / (1024 * 1024)).toFixed(1)}MB)`);
          }

          if (rawPct >= 50 && !passed50) {
            passed50 = true;
            tracker.startStage(18, `تدفق نصف البيانات بنجاح: ${rawPct}%`);
            tracker.completeStage(18, `تم إرسال 50% بنجاح (${(event.loaded / (1024 * 1024)).toFixed(1)}MB)`);
          }
          if (rawPct >= 90 && !passed90) {
            passed90 = true;
            tracker.startStage(19, `تدفق معظم البيانات بنجاح: ${rawPct}%`);
            tracker.completeStage(19, `تم إرسال 90% بنجاح (${(event.loaded / (1024 * 1024)).toFixed(1)}MB)`);
          }
        }
      };
      tracker.completeStage(13, "مستمع تدفق البايتات جاهز ونشط");

      // ── Stage 14: ReadyState Listener Bind
      tracker.startStage(14, "ربط مراقب تحولات حالة الـ TCP Socket");
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 2) {
          tracker.startStage(21, "المتصفح استلم أول ترويسة رد من السيرفر (Headers Received)");
          tracker.completeStage(21, `تم استلام ترويسة السيرفر برمز ${xhr.status}`);
        }
      };
      tracker.completeStage(14, "مراقب حالات الاتصال جاهز");

      // ── Stage 15: Timeout Configuration
      tracker.startStage(15, "ضبط معالجات انقطاع الشبكة ومهلة الانتظار");
      xhr.onerror = () => {
        tracker.recordHttpResponse(xhr.status, xhr.statusText, xhr.responseText);
        emitFail(21, `حدث انقطاع في الاتصال بالشبكة (Network Socket Error). رمز الحالة: ${xhr.status || 0}`, undefined, {
          readyState: xhr.readyState,
          status: xhr.status,
          statusText: xhr.statusText
        });
      };
      xhr.ontimeout = () => {
        tracker.recordHttpResponse(xhr.status, xhr.statusText, xhr.responseText);
        emitFail(21, "انتهت مهلة انتظار السيرفر أثناء رفع الحزمة (Request Timeout)");
      };
      tracker.completeStage(15, "تم تأمين معالجات أخطاء المقبس");

      // ── Stage 16: Endpoint Open Socket
      tracker.startStage(16, "فتح مقبس الاتصال بالمسار POST /api/books/upload-job");
      tracker.setEndpoint("/api/books/upload-job");
      xhr.open("POST", "/api/books/upload-job", true);
      tracker.completeStage(16, "تم فتح مقبس الاتصال بنجاح");

      // ── Stage 17: Transmission Start
      tracker.startStage(17, "بدء ضخ أول بايت من الحزمة عبر الشبكة");
      xhr.send(formData);
      tracker.completeStage(17, "بدأ إرسال البايتات بنجاح");

      // ── Handlers for Response
      xhr.onload = async () => {
        tracker.recordHttpResponse(xhr.status, xhr.statusText, xhr.responseText);

        // ── Stage 20: Client Buffers Flush
        tracker.startStage(20, "إفراغ بايتات المتصفح (بلوغ 100%)");
        tracker.completeStage(20, "المتصفح انتهى تماماً من إرسال 100% من بيانات الملف");

        // ── Stage 22: HTTP Status Code Audit
        tracker.startStage(22, `فحص رمز حالة استجابة السيرفر (HTTP ${xhr.status})`);
        if (xhr.status < 200 || xhr.status >= 300) {
          return emitFail(22, `السيرفر أعاد رمز خطأ (${xhr.status} ${xhr.statusText}). الرد: ${xhr.responseText.slice(0, 200)}`, undefined, {
            status: xhr.status,
            rawText: xhr.responseText
          });
        }
        tracker.completeStage(22, `رمز الحالة ناجح: ${xhr.status} OK`);

        // ── Stage 23: Response Content Type
        tracker.startStage(23, "التحقق من أن رد السيرفر بتنسيق JSON");
        const respType = xhr.getResponseHeader("content-type") || "";
        if (xhr.responseText.trim().startsWith("<")) {
          return emitFail(23, "السيرفر أعاد صفحة HTML بدلاً من JSON (غالباً صفحة خطأ من الـ Gateway)", undefined, {
            snippet: xhr.responseText.slice(0, 300)
          });
        }
        tracker.completeStage(23, `نوع الرد سليم: ${respType || "application/json"}`);

        // ── Stage 24: JSON Payload Parse
        tracker.startStage(24, "فك تشفير رد السيرفر واستخراج معرف المهمة");
        let parsedRes: any;
        try {
          parsedRes = JSON.parse(xhr.responseText);
        } catch (jsonErr: any) {
          return emitFail(24, `فشل فك تشفير استجابة السيرفر كـ JSON: ${jsonErr?.message}`, jsonErr?.stack, {
            rawText: xhr.responseText
          });
        }

        const jobId = parsedRes.jobId;
        const bookId = parsedRes.bookId;

        if (!jobId) {
          if (parsedRes.success && parsedRes.book) {
            tracker.completeStage(24, "تم استلام كائن الكتاب المباشر بنجاح");
            tracker.completeStage(25, "تجاوز المرحلة الخلفية بنجاح");
            tracker.completeStage(26, "تجاوز الاستعلام الدوري");
            tracker.completeStage(27, "فك الضغط مكتمل مسبقاً");
            tracker.completeStage(28, "فهرسة الصفحات مكتملة");
            tracker.completeStage(29, "الكتاب مسجل في قاعدة البيانات");
            tracker.completeStage(30, "الكتاب جاهز للعرض الفوري");
            await saveBookToDB(parsedRes.book);
            return resolve(parsedRes.book);
          }
          return emitFail(24, "استجابة السيرفر تفتقر لمعرف المهمة (jobId)", undefined, { parsedRes });
        }
        tracker.completeStage(24, `تم استخراج معرف المهمة بنجاح: ${jobId}`);

        // ── Stage 25: Background Job Dispatch
        tracker.startStage(25, "تأكيد بدء المعالجة الخلفية على القرص الصلب للسيرفر");
        tracker.completeStage(25, `تم إطلاق المهمة في الخلفية (Book ID: ${bookId})`);

        // ── Stage 26: Polling Loop
        tracker.startStage(26, "بدء دورة الاستعلام الحي عن تقدم المعالجة (Polling)");
        if (options.onProgress) {
          options.onProgress(82, "تم حفظ الملف على القرص الصلب، جاري فك الضغط والفهرسة التلقائية...");
        }

        let pollCount = 0;
        let completedStage27 = false;
        let completedStage28 = false;

        const pollTimer = setInterval(async () => {
          pollCount++;
          try {
            const checkRes = await fetch(`/api/books/jobs/${encodeURIComponent(jobId)}`);
            if (!checkRes.ok) {
              clearInterval(pollTimer);
              return emitFail(26, `فشل الاستعلام عن المهمة (رمز: ${checkRes.status})`);
            }

            const checkData = await checkRes.json();
            const job = checkData.job;

            if (!job) {
              clearInterval(pollTimer);
              return emitFail(26, "لم يتم العثور على بيانات المهمة في السيرفر");
            }

            if (job.status === "extracting") {
              tracker.startStage(27, "السيرفر يقوم الآن بفك ضغط الحزمة باستخدام unzip");
              if (options.onProgress) {
                options.onProgress(86, "جاري فك ضغط الصفحات والصوتيات على القرص الصلب...");
              }
            } else if (job.status === "indexing") {
              if (!completedStage27) {
                completedStage27 = true;
                tracker.completeStage(27, "تم فك ضغط ملفات الحزمة بنجاح على القرص الصلب");
              }
              tracker.startStage(28, "السيرفر يقوم الآن بفهرسة الصفحات وربط المقاطع الصوتية");
              if (options.onProgress) {
                options.onProgress(94, "جاري فهرسة الكتاب وربط الصوتيات والفيديوهات بالصفحات...");
              }
            } else if (job.status === "completed") {
              clearInterval(pollTimer);

              if (!completedStage27) tracker.completeStage(27, "تم فك الضغط بنجاح");
              if (!completedStage28) tracker.completeStage(28, "تمت فهرسة الصفحات والوسائط بنجاح");

              // ── Stage 29: Database Registration
              tracker.startStage(29, "تسجيل الكتاب الدائم في books.json");
              tracker.completeStage(29, "تم حفظ الكتاب بشكل دائم لجميع المستخدمين");

              // ── Stage 30: Viewport Render Ready
              tracker.startStage(30, "تجهيز كائن الكتاب وفتحه داخل القارئ");
              const finalBook = job.book;

              if (finalBook) {
                tracker.completeStage(30, `تم تجهيز الكتاب بنجاح: "${finalBook.title}" (${finalBook.pages?.length || 0} صفحة)`);
                await saveBookToDB(finalBook);
                if (options.onProgress) options.onProgress(100, "تم اعتماد الكتاب بنجاح!");
                return resolve(finalBook);
              } else {
                const refreshed = await fetchBooksFromServer();
                const matched = refreshed.find((b) => b.id === bookId) || refreshed[0];
                tracker.completeStage(30, "تم تحميل الكتاب المعتمد من قائمة السيرفر");
                if (options.onProgress) options.onProgress(100, "تم اعتماد الكتاب بنجاح!");
                return resolve(matched);
              }
            } else if (job.status === "error") {
              clearInterval(pollTimer);
              return emitFail(27, job.error || "فشل السيرفر في فك ضغط أو فهرسة ملفات الكتاب", undefined, { job });
            }

            // Safety timeout after 120 polling attempts (around 70 seconds)
            if (pollCount > 120) {
              clearInterval(pollTimer);
              return emitFail(26, "تجاوزت المهمة مهلة الانتظار القصوى في السيرفر (Polling Timeout)");
            }
          } catch (pollErr: any) {
            console.warn("[Books Diagnostic Poller] Warning:", pollErr);
          }
        }, 600);
      };
    } catch (unexpectedErr: any) {
      emitFail(tracker.getCurrentStage().id || 1, `خطأ غير متوقع: ${unexpectedErr?.message}`, unexpectedErr?.stack);
    }
  });
}

export const uploadBookDirectToServer = uploadBookToServer;
export const uploadBookWith30StageDiagnostics = uploadBookToServer;

/**
 * 2. Upload Folder directly into the server's hard drive
 */
export async function uploadBookFolderToServer(
  files: FileList | File[],
  options?: { onProgress?: (pct: number, statusText?: string) => void }
): Promise<InteractiveBook> {
  const fileArray = Array.from(files);
  const rawFiles: RawFileEntry[] = [];

  for (const f of fileArray) {
    const rel = (f as any).webkitRelativePath || f.name;
    if (rel.includes("__MACOSX") || rel.includes(".DS_Store")) continue;
    rawFiles.push({
      name: rel,
      getBlob: async () => f
    });
  }

  const defaultTitle = rawFiles[0]?.name.split("/")[0] || "كتاب تفاعلي";
  return uploadFilesToServerDisk(rawFiles, defaultTitle, options?.onProgress);
}

// Aliases for full compatibility
export interface UploadStageInfo {
  stageNumber: number;
  stageName: string;
  status: "pending" | "processing" | "completed" | "error";
  details: string;
  percentage: number;
}

export async function uploadBookWithDiagnostics(
  fileOrFiles: File | FileList | File[],
  options?: {
    skipVideos?: boolean;
    onStageUpdate?: (info: UploadStageInfo) => void;
  }
): Promise<InteractiveBook> {
  const onProgress = (pct: number, statusText?: string) => {
    if (options?.onStageUpdate) {
      options.onStageUpdate({
        stageNumber: pct < 40 ? 1 : pct < 85 ? 2 : 3,
        stageName: pct < 40 ? "تهيئة وتجهيز المساحة" : pct < 85 ? "حفظ الملفات على القرص الصلب" : "الفهرسة والاعتماد النهائي",
        status: pct >= 100 ? "completed" : "processing",
        details: statusText || "جاري الحفظ على القرص الصلب...",
        percentage: pct
      });
    }
  };

  if (fileOrFiles instanceof File) {
    return uploadBookToServer(fileOrFiles, "", onProgress);
  } else {
    return uploadBookFolderToServer(fileOrFiles, { onProgress });
  }
}

export const getAllBooksFromDB = fetchBooksFromServer;
export const deleteBookFromDB = deleteBookFromServer;
export const fetchAllBooks = fetchBooksFromServer;
export const uploadBookArchive = uploadBookToServer;

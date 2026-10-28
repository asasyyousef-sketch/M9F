// =========================================================================
// 🔬 30-Micro-Stage Deep Diagnostic & Error Handling Engine
// Pinpoints the EXACT failure point down to the microsecond and generates
// a complete copyable diagnostic report for instant root-cause resolution.
// =========================================================================

export interface MicroStage {
  id: number;
  key: string;
  titleAr: string;
  descriptionAr: string;
  status: "pending" | "running" | "completed" | "failed";
  timestamp?: number;
  durationMs?: number;
  details?: string;
  technicalData?: any;
  error?: string;
}

export interface DiagnosticReport {
  reportId: string;
  generatedAt: string;
  fileName: string;
  fileSizeFormatted: string;
  fileSizeBytes: number;
  fileType: string;
  totalStages: number;
  failedStageNumber: number | null;
  failedStageTitle: string | null;
  errorMessage: string | null;
  errorStack: string | null;
  httpStatus: number | null;
  httpStatusText: string | null;
  rawServerResponse: string | null;
  targetEndpoint: string | null;
  clientInfo: {
    userAgent: string;
    isOnline: boolean;
    currentUrl: string;
    screenResolution: string;
    hasFormData: boolean;
    hasIndexedDB: boolean;
  };
  stagesLog: MicroStage[];
}

export const INITIAL_30_STAGES: MicroStage[] = [
  { id: 1, key: "STAGE_01_INPUT_DETECTION", titleAr: "التقاط كائن الملف المختار", descriptionAr: "فحص التقاط الملف من نافذة اختيار الملفات بالمتصفح", status: "pending" },
  { id: 2, key: "STAGE_02_FILE_INTEGRITY", titleAr: "فحص سلامة وخصائص الملف", descriptionAr: "التحقق من سلامة البايتات والحجم ونوع الملف", status: "pending" },
  { id: 3, key: "STAGE_03_EXTENSION_VALIDATION", titleAr: "التحقق من صيغة الحزمة", descriptionAr: "التأكد من امتداد الحزمة (.zip أو مجلد أو ملفات وسائط)", status: "pending" },
  { id: 4, key: "STAGE_04_BROWSER_CAPABILITIES", titleAr: "فحص قدرات المتصفح", descriptionAr: "التأكد من دعم المتصفح لـ FormData و XHR و Blob و IndexedDB", status: "pending" },
  { id: 5, key: "STAGE_05_NETWORK_ONLINE_CHECK", titleAr: "فحص حالة الاتصال بالشبكة", descriptionAr: "التأكد من اتصال المتصفح بالشبكة (navigator.onLine)", status: "pending" },
  { id: 6, key: "STAGE_06_SERVER_CONNECTIVITY_PING", titleAr: "فحص الاتصال المباشر بالسيرفر", descriptionAr: "إجراء Ping أولي لمسار /api/books للتأكد من استجابة خادم Node", status: "pending" },
  { id: 7, key: "STAGE_07_SERVER_LATENCY_CHECK", titleAr: "قياس زمن الاستجابة ونوع المحتوى", descriptionAr: "التأكد من أن السيرفر يرد بـ JSON حقيقي وليس صفحة HTML أو خطأ من البوابة", status: "pending" },
  { id: 8, key: "STAGE_08_SESSION_TOKEN_CHECK", titleAr: "فحص ترويسات وجلسة الاتصال", descriptionAr: "التحقق من إعداد الترويسات والصلاحيات قبل الإرسال", status: "pending" },
  { id: 9, key: "STAGE_09_FORM_PAYLOAD_CONSTRUCTION", titleAr: "بناء وتجميع حمولة FormData", descriptionAr: "تغليف بايتات الحزمة مع العنوان داخل نموذج FormData ثنائي", status: "pending" },
  { id: 10, key: "STAGE_10_PAYLOAD_SIZE_AUDIT", titleAr: "قياس الحجم الإجمالي للحمولة", descriptionAr: "مراجعة حجم البيانات الثنائية ومقارنتها بحدود الخادم (2GB)", status: "pending" },
  { id: 11, key: "STAGE_11_CORS_PREFLIGHT_PREP", titleAr: "إعداد خيارات وترويسات CORS", descriptionAr: "تهيئة مسار الاتصال لضمان عدم حجب الطلب بواسطة سياسات المتصفح", status: "pending" },
  { id: 12, key: "STAGE_12_XHR_INSTANCE_CREATION", titleAr: "إنشاء مثيل النقل المتدفق (XHR)", descriptionAr: "تهيئة كائن XMLHttpRequest مع تمكين التدفق الثنائي", status: "pending" },
  { id: 13, key: "STAGE_13_PROGRESS_LISTENER_BIND", titleAr: "ربط مراقب بايتات الرفع الحي", descriptionAr: "تثبيت مستمع upload.onprogress لمتابعة النقل بايت ببايت", status: "pending" },
  { id: 14, key: "STAGE_14_STATE_LISTENER_BIND", titleAr: "ربط مراقب تحولات حالة الاتصال", descriptionAr: "تثبيت مستمع onreadystatechange لتتبع حالات الـ TCP Socket", status: "pending" },
  { id: 15, key: "STAGE_15_TIMEOUT_CONFIGURATION", titleAr: "ضبط مهلة الانتظار والأخطاء", descriptionAr: "تثبيت معالجات onerror و ontimeout لمنع التعليق الصامت", status: "pending" },
  { id: 16, key: "STAGE_16_ENDPOINT_OPEN_SOCKET", titleAr: "فتح مقبس الاتصال مع مسار السيرفر", descriptionAr: "تنفيذ xhr.open لمسار /api/books/upload-job", status: "pending" },
  { id: 17, key: "STAGE_17_TRANSMISSION_START", titleAr: "بدء ضخ بايتات الملف عبر الشبكة", descriptionAr: "إطلاق أمر xhr.send(formData) وبدء النقل الفعلي", status: "pending" },
  { id: 18, key: "STAGE_18_STREAMING_MIDWAY_CHECK", titleAr: "مراقبة تدفق البيانات وتجاوز 50%", descriptionAr: "التأكد من ثبات النقل دون انقطاع حتى نصف الحجم", status: "pending" },
  { id: 19, key: "STAGE_19_STREAMING_NEAR_COMPLETION", titleAr: "مراقبة تدفق البيانات وتجاوز 90%", descriptionAr: "التأكد من وصول آخر البايتات إلى ممر الشبكة دون بطء", status: "pending" },
  { id: 20, key: "STAGE_20_CLIENT_BUFFERS_FLUSH", titleAr: "إفراغ بايتات المتصفح (بلوغ 100%)", descriptionAr: "اكتمال خروج 100% من حجم الملف من كابل المتصفح إلى السيرفر", status: "pending" },
  { id: 21, key: "STAGE_21_WAITING_SERVER_ACK", titleAr: "انتظار ترويسات رد السيرفر الأولية", descriptionAr: "المتصفح متوقف ينتظر استلام استجابة HTTP Header من خادم السيرفر", status: "pending" },
  { id: 22, key: "STAGE_22_HTTP_STATUS_CODE_AUDIT", titleAr: "فحص رمز حالة الاستجابة (Status Code)", descriptionAr: "التأكد من أن السيرفر أعاد رمز نجاح (200 OK) وليس 404 أو 500 أو 502", status: "pending" },
  { id: 23, key: "STAGE_23_RESPONSE_CONTENT_TYPE", titleAr: "التحقق من نوع استجابة الخادم", descriptionAr: "التأكد من أن الرد application/json وليس صفحة HTML خطأ من البوابة", status: "pending" },
  { id: 24, key: "STAGE_24_JSON_PAYLOAD_PARSE", titleAr: "فك تشفير الرد واستخراج معرف المهمة", descriptionAr: "استخراج jobId و bookId لتأكيد حفظ الملف الخام على القرص الصلب", status: "pending" },
  { id: 25, key: "STAGE_25_BACKGROUND_JOB_DISPATCH", titleAr: "بدء مهمة المعالجة الخلفية بالسيرفر", descriptionAr: "التأكد من إطلاق عملية فك الضغط على القرص الصلب في الخلفية", status: "pending" },
  { id: 26, key: "STAGE_26_JOB_POLLING_INIT", titleAr: "بدء دورة الاستعلام الحي عن التقدم", descriptionAr: "إرسال نبضات دورية إلى /api/books/jobs/:jobId لمتابعة فك الضغط", status: "pending" },
  { id: 27, key: "STAGE_27_SERVER_UNZIP_EXECUTION", titleAr: "فك ضغط الحزمة الفعلي على القرص", descriptionAr: "استخراج الصور والصوتيات والفيديوهات داخل مجلد الكتاب المعزول", status: "pending" },
  { id: 28, key: "STAGE_28_MANIFEST_CATALOGING", titleAr: "فهرسة الصفحات والربط الذكي للصوتيات", descriptionAr: "قراءة ملفات الفهرس وربط كل تراك صوتي بصفحته الدقيقة", status: "pending" },
  { id: 29, key: "STAGE_29_DATABASE_REGISTRATION", titleAr: "تسجيل الكتاب الدائم في books.json", descriptionAr: "كتابة بيانات الكتاب الدائمة على القرص الصلب لجميع المستخدمين", status: "pending" },
  { id: 30, key: "STAGE_30_VIEWPORT_RENDER_READY", titleAr: "اعتماد الكتاب وجاهزية العرض بالقارئ", descriptionAr: "استلام كائن الكتاب المكتمل وفتحه تلقائياً للمستخدم بنجاح تام", status: "pending" }
];

export class UploadDiagnosticTracker {
  private stages: MicroStage[];
  private currentStageIndex: number = 0;
  private onUpdateCallback?: (stages: MicroStage[], currentStage: MicroStage) => void;
  private file: File;
  private targetEndpoint: string = "/api/books/upload-job";
  private httpStatus: number | null = null;
  private httpStatusText: string | null = null;
  private rawResponse: string | null = null;
  private report: DiagnosticReport | null = null;

  constructor(file: File, onUpdate?: (stages: MicroStage[], currentStage: MicroStage) => void) {
    this.file = file;
    this.stages = JSON.parse(JSON.stringify(INITIAL_30_STAGES));
    this.onUpdateCallback = onUpdate;
  }

  public getStages(): MicroStage[] {
    return this.stages;
  }

  public getCurrentStage(): MicroStage {
    return this.stages[this.currentStageIndex] || this.stages[this.stages.length - 1];
  }

  public startStage(stageId: number, details?: string, techData?: any) {
    const idx = this.stages.findIndex((s) => s.id === stageId);
    if (idx !== -1) {
      this.currentStageIndex = idx;
      this.stages[idx].status = "running";
      this.stages[idx].timestamp = Date.now();
      if (details) this.stages[idx].details = details;
      if (techData) this.stages[idx].technicalData = techData;
      this.notify();
    }
  }

  public completeStage(stageId: number, details?: string, techData?: any) {
    const idx = this.stages.findIndex((s) => s.id === stageId);
    if (idx !== -1) {
      const now = Date.now();
      this.stages[idx].status = "completed";
      this.stages[idx].durationMs = this.stages[idx].timestamp ? now - this.stages[idx].timestamp! : 0;
      if (details) this.stages[idx].details = details;
      if (techData) this.stages[idx].technicalData = { ...this.stages[idx].technicalData, ...techData };
      this.notify();
    }
  }

  public failStage(stageId: number, errorMsg: string, stack?: string, techData?: any): DiagnosticReport {
    const idx = this.stages.findIndex((s) => s.id === stageId);
    const targetIdx = idx !== -1 ? idx : this.currentStageIndex;

    this.stages[targetIdx].status = "failed";
    this.stages[targetIdx].error = errorMsg;
    if (techData) this.stages[targetIdx].technicalData = techData;

    const report = this.generateReport(stageId, errorMsg, stack);
    this.report = report;
    this.notify();
    return report;
  }

  public recordHttpResponse(status: number, statusText: string, rawText: string) {
    this.httpStatus = status;
    this.httpStatusText = statusText;
    this.rawResponse = rawText;
  }

  public setEndpoint(url: string) {
    this.targetEndpoint = url;
  }

  public generateReport(failedStageId?: number, errorMsg?: string, stack?: string): DiagnosticReport {
    const failedStage = failedStageId
      ? this.stages.find((s) => s.id === failedStageId)
      : this.stages.find((s) => s.status === "failed");

    const formatBytes = (b: number) => {
      if (b === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(b) / Math.log(k));
      return parseFloat((b / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    return {
      reportId: `DIAG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      generatedAt: new Date().toISOString(),
      fileName: this.file?.name || "unknown",
      fileSizeBytes: this.file?.size || 0,
      fileSizeFormatted: formatBytes(this.file?.size || 0),
      fileType: this.file?.type || "unknown/binary",
      totalStages: 30,
      failedStageNumber: failedStage ? failedStage.id : null,
      failedStageTitle: failedStage ? failedStage.titleAr : null,
      errorMessage: errorMsg || failedStage?.error || null,
      errorStack: stack || null,
      httpStatus: this.httpStatus,
      httpStatusText: this.httpStatusText,
      rawServerResponse: this.rawResponse ? this.rawResponse.slice(0, 1500) : null,
      targetEndpoint: this.targetEndpoint,
      clientInfo: {
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
        isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
        currentUrl: typeof window !== "undefined" ? window.location.href : "N/A",
        screenResolution: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "N/A",
        hasFormData: typeof FormData !== "undefined",
        hasIndexedDB: typeof indexedDB !== "undefined"
      },
      stagesLog: this.stages
    };
  }

  private notify() {
    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.stages, this.getCurrentStage());
    }
  }
}

/**
 * Client-side integration utility for local Gradio Speech-to-Text Server
 * Default Local Server: http://192.168.0.159:7861
 */

export interface GradioTranscribeOptions {
  serverUrl?: string;
  beamSize?: number;
  bestOf?: number;
  temperature?: number;
  conditionOnPreviousText?: boolean;
  vadFilter?: boolean;
  minSilenceDurationMs?: number;
  noSpeechThreshold?: number;
  compressionRatioThreshold?: number;
  logProbThreshold?: number;
  onStatusUpdate?: (statusMessage: string, step: "uploading" | "calling" | "processing" | "completed" | "error") => void;
  signal?: AbortSignal;
}

export interface GradioTranscribeResult {
  plainText: string;
  srtText: string;
  videoHtml?: string;
  txtFile?: any;
  srtFile?: any;
  vttFile?: any;
  statusMsg?: string;
  logs?: string;
}

export const DEFAULT_GRADIO_URL = "http://192.168.0.159:7861";

/**
 * Executes the 3-step Gradio transcription API:
 * 1. Upload media file to /gradio_api/upload
 * 2. Initiate transcribe call to /gradio_api/call/transcribe
 * 3. Stream SSE events from /gradio_api/call/transcribe/{event_id}
 */
export async function transcribeFileWithGradio(
  fileOrBlob: File | Blob,
  fileName: string = "audio.mp4",
  options: GradioTranscribeOptions = {}
): Promise<GradioTranscribeResult> {
  const {
    serverUrl = DEFAULT_GRADIO_URL,
    beamSize = 5,
    bestOf = 5,
    temperature = 0.0,
    conditionOnPreviousText = true,
    vadFilter = true,
    minSilenceDurationMs = 2000,
    noSpeechThreshold = 0.6,
    compressionRatioThreshold = 2.4,
    logProbThreshold = -1.0,
    onStatusUpdate,
    signal
  } = options;

  const baseUrl = serverUrl.replace(/\/+$/, "");

  // 1) Step 1: Upload File to Gradio
  onStatusUpdate?.("1/3 جاري رفع الملف إلى سيرفر التفريغ المحلي...", "uploading");

  const formData = new FormData();
  // Ensure file has proper name if it's a raw blob
  if (fileOrBlob instanceof File) {
    formData.append("files", fileOrBlob);
  } else {
    formData.append("files", fileOrBlob, fileName);
  }

  let uploadRes: Response;
  try {
    uploadRes = await fetch(`${baseUrl}/gradio_api/upload`, {
      method: "POST",
      body: formData,
      signal
    });
  } catch (err: any) {
    throw new Error(
      `تعذر الاتصال بسيرفر Gradio على العنوان (${baseUrl}). تأكد من تشغيل السيرفر ومن اتصال جهازك بالشبكة المحلية (192.168.0.159). تفاصيل: ${err.message}`
    );
  }

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => "");
    throw new Error(`فشل رفع الملف إلى سيرفر Gradio (رمز الخطأ ${uploadRes.status}): ${errText || uploadRes.statusText}`);
  }

  const uploadJson = await uploadRes.json();
  const uploadedPath = Array.isArray(uploadJson) ? uploadJson[0] : uploadJson?.path || uploadJson?.[0]?.path;

  if (!uploadedPath) {
    throw new Error("لم يرجع سيرفر Gradio مسار الملف المرفوع بشكل صحيح.");
  }

  // 2) Step 2: Call Transcribe Endpoint
  onStatusUpdate?.("2/3 تم رفع الملف، جاري تهيئة طلب المعالجة والتفريغ...", "calling");

  const payloadData = [
    { path: uploadedPath, meta: { _type: "gradio.FileData" } },
    beamSize,
    bestOf,
    temperature,
    conditionOnPreviousText,
    vadFilter,
    minSilenceDurationMs,
    noSpeechThreshold,
    compressionRatioThreshold,
    logProbThreshold
  ];

  let callRes: Response;
  try {
    callRes = await fetch(`${baseUrl}/gradio_api/call/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: payloadData }),
      signal
    });
  } catch (err: any) {
    throw new Error(`فشل استدعاء دالة transcribe على السيرفر: ${err.message}`);
  }

  if (!callRes.ok) {
    const errText = await callRes.text().catch(() => "");
    throw new Error(`خطأ في بدء المعالجة (رمز ${callRes.status}): ${errText || callRes.statusText}`);
  }

  const { event_id } = await callRes.json();
  if (!event_id) {
    throw new Error("لم يتم استلام event_id من سيرفر Gradio.");
  }

  // 3) Step 3: Stream SSE to receive the final result
  onStatusUpdate?.("3/3 جاري معالجة الصوت بالذكاء الاصطناعي (قد يستغرق دقائق حسب طول المقطع)...", "processing");

  let streamRes: Response;
  try {
    streamRes = await fetch(`${baseUrl}/gradio_api/call/transcribe/${event_id}`, {
      signal
    });
  } catch (err: any) {
    throw new Error(`فشل الاستماع لنتيجة التفريغ من السيرفر: ${err.message}`);
  }

  if (!streamRes.ok) {
    throw new Error(`فشل قراءة بث النتائج من السيرفر (رمز ${streamRes.status})`);
  }

  if (!streamRes.body) {
    throw new Error("بث النتائج فارغ");
  }

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  let finalResult: GradioTranscribeResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // Keep last incomplete segment in buffer
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;

        try {
          const parsed = JSON.parse(jsonStr);

          // If array returned with transcription results
          if (Array.isArray(parsed) && parsed.length >= 2) {
            const [plainText, srtText, videoHtml, txtFile, srtFile, vttFile, statusMsg, logs] = parsed;

            // Update status if provided
            if (statusMsg) {
              onStatusUpdate?.(`الحالة: ${statusMsg}`, "processing");
            }

            finalResult = {
              plainText: typeof plainText === "string" ? plainText : "",
              srtText: typeof srtText === "string" ? srtText : "",
              videoHtml: typeof videoHtml === "string" ? videoHtml : undefined,
              txtFile,
              srtFile,
              vttFile,
              statusMsg,
              logs: typeof logs === "string" ? logs : undefined
            };

            onStatusUpdate?.("تم استلام النتيجة النهائية بنجاح!", "completed");
            return finalResult;
          } else if (parsed && typeof parsed === "object") {
            // Check for progress / queue messages
            if (parsed.msg === "process_generating" || parsed.stage === "generating") {
              onStatusUpdate?.("جاري استخراج وتوليد النصوص الألمانية المتزامنة...", "processing");
            } else if (parsed.msg === "queued") {
              onStatusUpdate?.("الطلب في قائمة الانتظار على السيرفر...", "processing");
            } else if (parsed.error) {
              throw new Error(`خطأ من سيرفر Gradio: ${parsed.error}`);
            }
          }
        } catch (e: any) {
          if (e.message?.includes("خطأ من سيرفر Gradio")) throw e;
          // Ignore json parse error for non-json data lines
        }
      }
    }
  }

  if (finalResult) {
    return finalResult;
  }

  throw new Error("انتهى البث دون تلقي نتيجة التفريغ النهائية من السيرفر.");
}

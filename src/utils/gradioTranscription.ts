/**
 * Client-side integration utility for local Gradio Speech-to-Text Server & YouTube Processor
 * Default Local Server: http://192.168.0.159:7861
 */

export interface GradioTranscribeOptions {
  serverUrl?: string;
  beamSize?: number;
  bestOf?: number;
  temperature?: number;
  conditionOnPreviousText?: boolean;
  vadFilter?: boolean;
  wordTimestamps?: boolean;
  minSilenceDurationMs?: number;
  noSpeechThreshold?: number;
  compressionRatioThreshold?: number;
  logProbThreshold?: number;
  onUploadProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void;
  onStatusUpdate?: (
    statusMessage: string,
    step: "uploading" | "calling" | "processing" | "completed" | "error",
    progressPercent?: number
  ) => void;
  signal?: AbortSignal;
}

export interface GradioTranscribeResult {
  plainText: string;
  srtText: string;
  vttText?: string;
  videoHtml?: string;
  audioFileUrl?: string;
  txtFile?: any;
  srtFile?: any;
  vttFile?: any;
  statusMsg?: string;
  logs?: string;
}

export interface YouTubeQuality {
  label: string; // e.g. "1080p", "720p", "480p"
  formatId: string; // e.g. "137", "22", "135"
  note?: string;
  filesizeFormatted?: string;
}

export interface YouTubeVideoFormat {
  formatId: string;
  resolution: string;
  note?: string;
  ext?: string;
  filesize?: number;
  filesizeFormatted?: string;
  hasVideo?: boolean;
  hasAudio?: boolean;
}

export interface YouTubeVideoInfo {
  success?: boolean;
  videoId: string;
  title: string;
  author?: string;
  duration?: number; // duration in seconds
  durationFormatted?: string;
  thumbnailUrl: string;
  description?: string;
  qualities: YouTubeQuality[];
  formats?: YouTubeVideoFormat[]; // backwards compatibility
}

export interface YouTubeSubtitleCue {
  start: number;
  end: number;
  text: string;
}

export interface YouTubeSubtitleTrack {
  id: string;
  label: string;
  language: string;
  format: string; // "vtt" | "srt"
  cues: YouTubeSubtitleCue[];
}

export interface YouTubeJobStatus {
  jobId: string;
  stage: "idle" | "queued" | "downloading" | "transcribing" | "done" | "error";
  stageLabel?: string; // "جاري التحميل" | "جاري إنشاء السكربت" | "اكتمل" | "فشل"
  percent?: number; // 0 to 100
  progress: number; // 0 to 100
  message?: string;
  statusMsg: string;
  success?: boolean | null;
  videoUrl?: string; // Available as soon as download completes (during transcribing stage)
  title?: string;
  duration?: number;
  videoId?: string;
  thumbnailUrl?: string;
  author?: string;
  subtitles?: YouTubeSubtitleTrack[];
  vttContent?: string;
  plainText?: string;
  srtText?: string;
  vttText?: string;
  videoHtml?: string;
  txtFile?: any;
  srtFile?: any;
  vttFile?: any;
  speed?: string;
  eta?: string;
  error?: string;
}

export interface YouTubeProcessOptions {
  serverUrl?: string;
  quality?: string;
  formatId?: string;
  includeSubtitles?: boolean;
  beamSize?: number;
  bestOf?: number;
  temperature?: number;
  vadFilter?: boolean;
  minSilenceDurationMs?: number;
  onProgress?: (stageLabel: string, percent: number, message: string, videoUrl?: string) => void;
  onStatusUpdate?: (status: YouTubeJobStatus) => void;
  signal?: AbortSignal;
}

export const DEFAULT_GRADIO_URL = "http://192.168.0.159:7861";

/**
 * Uploads a file with real-time XMLHttpRequest progress (0% - 100%)
 */
function uploadFileWithProgress(
  url: string,
  fileOrBlob: File | Blob,
  fileName: string,
  onProgress?: (percent: number, loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);

    if (signal) {
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new DOMException("Aborted", "AbortError"));
      });
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          onProgress(percent, event.loaded, event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          const uploadedPath = Array.isArray(json)
            ? json[0]
            : json?.path || json?.[0]?.path;
          if (uploadedPath) {
            resolve(uploadedPath);
          } else {
            reject(new Error("لم يرجع سيرفر Gradio مسار الملف المرفوع بشكل صحيح."));
          }
        } catch (e: any) {
          reject(new Error(`فشل تحليل استجابة الرفع: ${e.message}`));
        }
      } else {
        reject(
          new Error(
            `فشل رفع الملف إلى سيرفر Gradio (رمز الخطأ ${xhr.status}): ${xhr.statusText || xhr.responseText}`
          )
        );
      }
    };

    xhr.onerror = () => {
      reject(
        new Error(
          `تعذر الاتصال بسيرفر Gradio على العنوان (${url}). تأكد من تشغيل السيرفر ومن اتصال جهازك بالشبكة المحلية.`
        )
      );
    };

    const formData = new FormData();
    if (fileOrBlob instanceof File) {
      formData.append("files", fileOrBlob);
    } else {
      formData.append("files", fileOrBlob, fileName);
    }

    xhr.send(formData);
  });
}

/**
 * Executes the 3-step Gradio transcription API:
 * 1. Upload media file to /gradio_api/upload with real-time progress bar (0% - 100%)
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
    wordTimestamps = true,
    minSilenceDurationMs = 2000,
    noSpeechThreshold = 0.6,
    compressionRatioThreshold = 2.4,
    logProbThreshold = -1.0,
    onUploadProgress,
    onStatusUpdate,
    signal
  } = options;

  const baseUrl = serverUrl.replace(/\/+$/, "");

  // 1) Step 1: Upload File to Gradio with live progress tracking
  onStatusUpdate?.("جاري رفع ونقل الملف إلى سيرفر التفريغ المحلي...", "uploading", 0);

  let uploadedPath: string;
  try {
    uploadedPath = await uploadFileWithProgress(
      `${baseUrl}/gradio_api/upload`,
      fileOrBlob,
      fileName,
      (percent, loaded, total) => {
        onUploadProgress?.(percent, loaded, total);
        const mbLoaded = (loaded / (1024 * 1024)).toFixed(1);
        const mbTotal = (total / (1024 * 1024)).toFixed(1);
        onStatusUpdate?.(
          `جاري رفع ونقل الملف (${percent}% - ${mbLoaded} / ${mbTotal} MB)...`,
          "uploading",
          percent
        );
      },
      signal
    );
  } catch (err: any) {
    if (err.name === "AbortError") throw err;
    throw new Error(
      `تعذر رفع الملف إلى سيرفر Gradio (${baseUrl}). تأكد من تشغيل السيرفر وأن جهازك متصل بنفس الشبكة (192.168.0.159). التفاصيل: ${err.message}`
    );
  }

  onStatusUpdate?.("اكتمل رفع الملف بنجاح إلى السيرفر (100%)", "uploading", 100);

  // 2) Step 2: Call Transcribe Endpoint (11 values matching Gradio's exact signature: File, 3 Sliders, 3 Checkboxes, 4 Sliders)
  onStatusUpdate?.("تم استلام الملف، جاري تهيئة نموذج Whisper وحجز الدور على السيرفر...", "calling", 35);

  const payload11 = [
    { path: uploadedPath, meta: { _type: "gradio.FileData" } }, // 0: File
    beamSize,                                                   // 1: Slider (beam_size)
    bestOf,                                                     // 2: Slider (best_of)
    temperature,                                                // 3: Slider (temperature)
    conditionOnPreviousText,                                    // 4: Checkbox (condition_on_previous_text)
    vadFilter,                                                  // 5: Checkbox (vad_filter)
    wordTimestamps,                                             // 6: Checkbox (word_timestamps / timestamp token)
    minSilenceDurationMs,                                       // 7: Slider (min_silence_duration_ms)
    noSpeechThreshold,                                          // 8: Slider (no_speech_threshold)
    compressionRatioThreshold,                                  // 9: Slider (compression_ratio_threshold)
    logProbThreshold                                            // 10: Slider (log_prob_threshold)
  ];

  const payload10 = [
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
      body: JSON.stringify({ data: payload11 }),
      signal
    });

    // Fallback: If server responded with error indicating different input count
    if (!callRes.ok && (callRes.status === 422 || callRes.status === 500)) {
      const errText = await callRes.clone().text().catch(() => "");
      if (errText.includes("needed: 10") || errText.includes("got: 11")) {
        callRes = await fetch(`${baseUrl}/gradio_api/call/transcribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: payload10 }),
          signal
        });
      }
    }
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

  // 3) Step 3: Stream SSE to receive the final result with continuous progress updates
  onStatusUpdate?.("جاري تهيئة الصوت بالذكاء الاصطناعي على السيرفر المحلي...", "processing", 40);

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
  let processingPercent = 42;

  // Active smooth ticker that tracks and updates AI transcription progress
  const progressInterval = setInterval(() => {
    if (processingPercent < 94) {
      processingPercent += processingPercent < 70 ? 2 : 1;
      let phaseMsg = "جاري استخراج وتوليد النصوص الألمانية المتزامنة...";
      if (processingPercent < 55) {
        phaseMsg = "جاري تحليل الإشارات الصوتية وتطبيق كاشف الصوت VAD...";
      } else if (processingPercent < 75) {
        phaseMsg = "جاري تفريغ الكلمات الألمانية وتوليد المقاطع الصوتية...";
      } else if (processingPercent < 90) {
        phaseMsg = "جاري مزامنة الطوابع الزمنية الدقيقة (Word Timestamps)...";
      } else {
        phaseMsg = "جاري تجميع مخرجات النصوص وملفات SRT و WebVTT...";
      }
      onStatusUpdate?.(phaseMsg, "processing", processingPercent);
    }
  }, 1200);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
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

              if (statusMsg) {
                onStatusUpdate?.(`الحالة: ${statusMsg}`, "processing", 98);
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

              clearInterval(progressInterval);
              onStatusUpdate?.("تم استلام النتيجة النهائية واكتمال التفريغ بنجاح!", "completed", 100);
              return finalResult;
            } else if (parsed && typeof parsed === "object") {
              // Check for progress / queue messages
              if (parsed.msg === "process_generating" || parsed.stage === "generating") {
                processingPercent = Math.max(processingPercent, Math.min(94, processingPercent + 5));
                onStatusUpdate?.("جاري استخراج وتوليد النصوص الألمانية المتزامنة...", "processing", processingPercent);
              } else if (parsed.msg === "queued") {
                onStatusUpdate?.("الطلب في قائمة الانتظار على السيرفر...", "processing", 38);
              } else if (parsed.error) {
                clearInterval(progressInterval);
                throw new Error(`خطأ من سيرفر Gradio: ${parsed.error}`);
              }
            }
          } catch (e: any) {
            if (e.message?.includes("خطأ من سيرفر Gradio")) {
              clearInterval(progressInterval);
              throw e;
            }
          }
        }
      }
    }
  } finally {
    clearInterval(progressInterval);
  }

  if (finalResult) {
    return finalResult;
  }

  throw new Error("انتهى البث دون تلقي نتيجة التفريغ النهائية من السيرفر.");
}

/**
 * Fetches YouTube video metadata and available qualities from the external Gradio server
 */
export async function getYouTubeInfo(
  youtubeUrl: string,
  serverUrl: string = DEFAULT_GRADIO_URL
): Promise<YouTubeVideoInfo> {
  const baseUrl = serverUrl.replace(/\/+$/, "");
  const trimmedUrl = youtubeUrl.trim();

  let lastError = "";

  // 1. Try POST /api/youtube-info on the user's Gradio server
  try {
    const res = await fetch(`${baseUrl}/api/youtube-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmedUrl })
    });

    if (res.ok) {
      const data = await res.json();
      return normalizeYouTubeInfo(data, trimmedUrl);
    } else {
      const errJson = await res.json().catch(() => ({}));
      lastError = errJson.error || `رمز الاستجابة: ${res.status}`;
    }
  } catch (err: any) {
    lastError = err.message || "فشل الاتصال بالشبكة";
  }

  // 2. Try GET /api/youtube-info?url=... on the user's Gradio server
  try {
    const res = await fetch(`${baseUrl}/api/youtube-info?url=${encodeURIComponent(trimmedUrl)}`);
    if (res.ok) {
      const data = await res.json();
      return normalizeYouTubeInfo(data, trimmedUrl);
    } else {
      const errJson = await res.json().catch(() => ({}));
      lastError = errJson.error || lastError || `رمز الاستجابة: ${res.status}`;
    }
  } catch (err: any) {
    lastError = err.message || lastError;
  }

  throw new Error(
    `تعذر الاتصال بالسيرفر (${baseUrl}). يرجى التأكد من تشغيل السيرفر والاتصال بنفس الشبكة. (السبب: ${lastError})`
  );
}

function formatDurationSeconds(sec?: number): string {
  if (!sec || isNaN(sec) || sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function normalizeYouTubeInfo(data: any, originalUrl: string): YouTubeVideoInfo {
  const videoId = data.videoId || extractYTId(originalUrl) || "";
  const title = data.title || "";
  const author = data.author || data.channel || data.uploader || "";
  const duration = typeof data.duration === "number" ? data.duration : (data.duration ? Number(data.duration) : 0);
  const durationFormatted = data.durationFormatted || formatDurationSeconds(duration);
  const thumbnailUrl = data.thumbnailUrl || data.thumbnail || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "");
  const description = data.description || "";

  // Available qualities strictly from server response
  let qualities: YouTubeQuality[] = [];

  if (Array.isArray(data.qualities) && data.qualities.length > 0) {
    qualities = data.qualities.map((q: any) => ({
      label: q.label || q.resolution || q.formatId || "720p",
      formatId: q.formatId || q.format_id || q.id || "22",
      note: q.note || (q.label?.includes("p") ? `دقة ${q.label}` : ""),
      filesizeFormatted: q.filesizeFormatted || (q.filesize ? `${(q.filesize / (1024 * 1024)).toFixed(1)} MB` : undefined)
    }));
  } else if (Array.isArray(data.formats) && data.formats.length > 0) {
    qualities = data.formats.map((f: any) => ({
      label: f.resolution || f.quality || (f.height ? `${f.height}p` : f.formatId || "720p"),
      formatId: f.formatId || f.format_id || f.id || "22",
      note: f.note || f.format_note || "",
      filesizeFormatted: f.filesizeFormatted || (f.filesize ? `${(f.filesize / (1024 * 1024)).toFixed(1)} MB` : undefined)
    }));
  }

  return {
    success: data.success !== false,
    videoId,
    title,
    author,
    duration,
    durationFormatted,
    thumbnailUrl,
    description,
    qualities
  };
}

function extractYTId(url: string): string | null {
  const p = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([^#\?&"'>]+)/;
  const match = url.match(p);
  return match ? match[1] : null;
}

/**
 * Converts VTT / WebVTT text to standard SRT text
 */
export function convertVttToSrt(vtt: string): string {
  if (!vtt) return "";
  let clean = vtt.replace(/^WEBVTT[^\n]*\n+/i, "").trim();
  // Replace decimal dot in timestamps with comma: 00:00:01.500 -> 00:00:01,500
  clean = clean.replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, "$1,$2");
  // Also handle MM:SS.mmm
  clean = clean.replace(/(\d{2}:\d{2})\.(\d{3})/g, "00:$1,$2");

  const blocks = clean.split(/\n\s*\n/);
  const srtBlocks: string[] = [];

  let idx = 1;
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length >= 2) {
      // Check if first line is time or cue id
      let timeLineIdx = 0;
      if (lines[0].includes("-->")) {
        timeLineIdx = 0;
      } else if (lines.length > 1 && lines[1].includes("-->")) {
        timeLineIdx = 1;
      } else {
        continue;
      }

      const timeLine = lines[timeLineIdx].trim();
      const textLines = lines.slice(timeLineIdx + 1).join("\n").trim();
      if (timeLine && textLines) {
        srtBlocks.push(`${idx}\n${timeLine}\n${textLines}`);
        idx++;
      }
    }
  }

  return srtBlocks.join("\n\n");
}

/**
 * Converts SRT text to WebVTT format
 */
export function convertSrtToVtt(srt: string): string {
  if (!srt) return "WEBVTT\n\n";
  let vtt = "WEBVTT\n\n" + srt.trim();
  // Replace comma in timestamps with dot: 00:00:01,500 -> 00:00:01.500
  vtt = vtt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return vtt;
}

/**
 * Starts a YouTube download and transcription job on the server
 * Endpoint: POST {serverUrl}/api/youtube-process
 * Body: { url, includeSubtitles: true, formatId }
 */
export async function processYouTubeLink(
  youtubeUrl: string,
  formatId?: string,
  options: YouTubeProcessOptions = {}
): Promise<string> {
  const {
    serverUrl = DEFAULT_GRADIO_URL,
    includeSubtitles = true,
    beamSize = 5,
    bestOf = 5,
    temperature = 0.0,
    vadFilter = true,
    minSilenceDurationMs = 2000,
    signal
  } = options;

  const baseUrl = serverUrl.replace(/\/+$/, "");

  // Payload for server following user spec
  const payload: any = {
    url: youtubeUrl.trim(),
    includeSubtitles
  };

  if (formatId) {
    payload.formatId = formatId;
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/youtube-process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal
    });
  } catch (err: any) {
    throw new Error(
      `تعذر إرسال طلب معالجة اليوتيوب إلى السيرفر (${baseUrl}). تأكد من تشغيل السيرفر ومن اتصال الجهاز بنفس الشبكة.`
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`فشل بدء مهمة معالجة اليوتيوب على السيرفر (رمز ${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  const jobId = data.jobId || data.job_id || data.id;
  if (!jobId) {
    throw new Error("لم يرجع السيرفر معرف المهمة (jobId).");
  }
  return jobId;
}

/**
 * Polls YouTube Job status periodically (~1 second) until "done" or "error"
 * Endpoint: GET {serverUrl}/api/youtube-status/{jobId}
 */
export async function pollYouTubeStatus(
  jobId: string,
  onProgress: (status: YouTubeJobStatus) => void,
  serverUrl: string = DEFAULT_GRADIO_URL,
  signal?: AbortSignal
): Promise<YouTubeJobStatus> {
  const baseUrl = serverUrl.replace(/\/+$/, "");

  return new Promise((resolve, reject) => {
    let timer: any = null;
    let isFinished = false;

    const cleanup = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    if (signal) {
      signal.addEventListener("abort", () => {
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
      });
    }

    const checkStatus = async () => {
      if (isFinished) return;

      try {
        const res = await fetch(`${baseUrl}/api/youtube-status/${encodeURIComponent(jobId)}`, { signal });

        if (!res.ok) {
          return; // retry on next tick
        }

        const data = await res.json();
        const stage = data.stage || (data.success ? "done" : "transcribing");
        const stageLabel = data.stageLabel || (stage === "downloading" ? "جاري التحميل" : stage === "transcribing" ? "جاري إنشاء السكربت" : stage === "done" ? "اكتمل" : "معالجة");
        const percent = typeof data.percent === "number" ? data.percent : (typeof data.progress === "number" ? data.progress : (stage === "done" ? 100 : 50));
        const message = data.message || data.statusMsg || (stage === "downloading" ? `جاري تحميل الفيديو... ${percent}%` : "جاري إنشاء السكربت والتفريغ...");

        // Parse subtitles if present
        let srtText = data.srtText || "";
        let vttText = data.vttText || data.vttContent || "";
        let plainText = data.plainText || "";

        if (Array.isArray(data.subtitles) && data.subtitles.length > 0) {
          const primarySub = data.subtitles[0];
          if (primarySub.cues && Array.isArray(primarySub.cues)) {
            if (!srtText) {
              srtText = primarySub.cues.map((c: any, idx: number) => {
                const startStr = formatTimestamp(c.start || 0);
                const endStr = formatTimestamp(c.end || 0);
                return `${idx + 1}\n${startStr} --> ${endStr}\n${c.text || ""}`;
              }).join("\n\n");
            }
            if (!plainText) {
              plainText = primarySub.cues.map((c: any) => c.text || "").join(" ");
            }
          }
        }

        if (vttText && !srtText) {
          srtText = convertVttToSrt(vttText);
        }
        if (srtText && !vttText) {
          vttText = convertSrtToVtt(srtText);
        }

        // Normalize video URL from server response
        let resolvedVideoUrl = data.videoUrl || data.url || data.video_url || data.mediaUrl || "";
        if (typeof resolvedVideoUrl === "object" && resolvedVideoUrl !== null) {
          resolvedVideoUrl = resolvedVideoUrl.url || resolvedVideoUrl.path || resolvedVideoUrl.name || "";
        }
        if (resolvedVideoUrl && typeof resolvedVideoUrl === "string") {
          if (resolvedVideoUrl.startsWith("/")) {
            resolvedVideoUrl = `${baseUrl}${resolvedVideoUrl}`;
          } else if (!resolvedVideoUrl.startsWith("http://") && !resolvedVideoUrl.startsWith("https://") && !resolvedVideoUrl.startsWith("blob:")) {
            resolvedVideoUrl = `${baseUrl}/${resolvedVideoUrl}`;
          }
        }

        const jobStatus: YouTubeJobStatus = {
          jobId,
          stage,
          stageLabel,
          percent,
          progress: percent,
          message,
          statusMsg: message,
          success: data.success,
          videoUrl: resolvedVideoUrl,
          title: data.title,
          duration: data.duration,
          thumbnailUrl: data.thumbnailUrl,
          author: data.author,
          subtitles: data.subtitles,
          vttContent: vttText || data.vttContent,
          plainText,
          srtText,
          vttText,
          speed: data.speed,
          eta: data.eta,
          error: data.error
        };

        // Notify caller about live status (including videoUrl as soon as downloading completes!)
        onProgress(jobStatus);

        // Check completion
        if (stage === "done" || data.success === true) {
          isFinished = true;
          cleanup();
          resolve(jobStatus);
          return;
        }

        // Check error
        if (stage === "error" || data.success === false) {
          isFinished = true;
          cleanup();
          reject(new Error(data.message || data.error || "فشلت معالجة فيديو اليوتيوب على السيرفر."));
          return;
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          cleanup();
          reject(err);
          return;
        }
        console.warn("[YouTube Poll Warning]", err);
      }
    };

    // Execute immediately and set 1-second interval
    checkStatus();
    timer = setInterval(checkStatus, 1000);
  });
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}


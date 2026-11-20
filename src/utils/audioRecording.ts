// Mobile-safe microphone access & compatible MediaRecorder utilities

export async function requestMobileSafeMicrophoneStream(): Promise<MediaStream> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    throw new Error("MIC_UNSUPPORTED");
  }

  const navAny = navigator as any;
  const hasModernMediaDevices = Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function");
  const legacyGetUserMedia =
    navAny.getUserMedia || navAny.webkitGetUserMedia || navAny.mozGetUserMedia || navAny.msGetUserMedia;

  if (!hasModernMediaDevices && !legacyGetUserMedia) {
    if (!window.isSecureContext) {
      throw new Error("INSECURE_CONTEXT");
    }
    throw new Error("MIC_UNSUPPORTED");
  }

  const getStream = (constraints: MediaStreamConstraints): Promise<MediaStream> => {
    if (hasModernMediaDevices) {
      return navigator.mediaDevices.getUserMedia(constraints);
    }
    return new Promise((resolve, reject) => {
      legacyGetUserMedia.call(navigator, constraints, resolve, reject);
    });
  };

  try {
    return await getStream({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  } catch (err: any) {
    const errName = err?.name || "";
    // If browser blocked due to insecure context or explicit user denial, propagate right away
    if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
      if (!window.isSecureContext) {
        throw new Error("INSECURE_CONTEXT");
      }
      throw err;
    }
    // On mobile / WebViews, strict audio constraints can fail with OverconstrainedError / AbortError / NotReadableError.
    // Retry immediately with bare `{ audio: true }`.
    return await getStream({ audio: true });
  }
}

export function getMicrophoneErrorMessage(err: any): string {
  const msg = String(err?.message || "");
  const name = String(err?.name || "");

  if (msg === "INSECURE_CONTEXT" || (typeof window !== "undefined" && !window.isSecureContext)) {
    return "المتصفح على الموبايل يحظر الميكروفون على روابط HTTP غير المشفّرة. افتح التطبيق عبر HTTPS ليعمل التسجيل.";
  }
  if (msg === "MIC_UNSUPPORTED") {
    return "المتصفح الحالي لا يدعم الوصول للميكروفون من الويب.";
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return "تم رفض إذن الميكروفون. يرجى تفعيل إذن الميكروفون للموقع من إعدادات المتصفح.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "لم يتم العثور على ميكروفون متصل بهذا الجهاز.";
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return "الميكروفون قيد الاستخدام من تطبيق آخر أو تعذر تشغيله. أغلق أي مكالمة/تطبيق صوتي وحاول مجدداً.";
  }
  return "تعذر الوصول للميكروفون. يرجى التحقق من أذونات المتصفح.";
}

export function createCompatibleMediaRecorder(stream: MediaStream): {
  recorder: MediaRecorder;
  mimeType: string;
} {
  const candidateMimes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/aac"
  ];

  let selectedMime = "";
  if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
    for (const mime of candidateMimes) {
      try {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      } catch {}
    }
  }

  let recorder: MediaRecorder;
  try {
    recorder = selectedMime
      ? new MediaRecorder(stream, { mimeType: selectedMime })
      : new MediaRecorder(stream);
  } catch {
    recorder = new MediaRecorder(stream);
  }

  const finalMime = recorder.mimeType || selectedMime || "audio/webm";
  return { recorder, mimeType: finalMime };
}

export function isHttpInsecureOrigin(): boolean {
  if (typeof window === "undefined") return false;
  return !window.isSecureContext && window.location.protocol === "http:";
}

export function getHttpsSwitchUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.href.replace(/^http:/i, "https:");
}


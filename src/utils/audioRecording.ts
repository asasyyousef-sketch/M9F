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

export interface MediaPlaybackSnapshot {
  currentTime: number;
  paused: boolean;
  seeking: boolean;
  readyState: number;
  playbackRate: number;
}

export interface PlaybackClockState {
  visualTime: number;
  lastMediaTime: number;
  lastTickMs: number;
  lastFrameMs: number;
  pendingSeekTarget: number | null;
  pendingSeekPreTime: number | null;
  pendingSeekUntilMs: number;
}

export function createPlaybackClockState(initialTime: number): PlaybackClockState {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    visualTime: initialTime,
    lastMediaTime: initialTime,
    lastTickMs: now,
    lastFrameMs: now,
    pendingSeekTarget: null,
    pendingSeekPreTime: null,
    pendingSeekUntilMs: 0
  };
}

export function beginPlaybackSeekHold(
  state: PlaybackClockState,
  targetTime: number,
  nowMs: number,
  preSeekTime?: number
): void {
  state.pendingSeekPreTime =
    preSeekTime !== undefined && Number.isFinite(preSeekTime) ? preSeekTime : state.lastMediaTime;
  state.pendingSeekTarget = targetTime;
  state.pendingSeekUntilMs = nowMs + 650;
  state.visualTime = targetTime;
  state.lastFrameMs = nowMs;
  state.lastTickMs = nowMs;
}

/**
 * Strictly monotonic phase-locked loop (PLL) for mobile HTMLMediaElement playback.
 * Advances smoothly from frame 1 (no startup freeze), converges phase error to 0ms
 * between coarse mobile currentTime updates without backward jitter, and prevents
 * post-seek snap-back using pre-seek baseline checks.
 */
export function stepMonotonicPlaybackClock(
  state: PlaybackClockState,
  snapshot: MediaPlaybackSnapshot,
  nowMs: number
): number {
  const dt = Math.max(0, Math.min(0.05, (nowMs - state.lastFrameMs) / 1000));
  state.lastFrameMs = nowMs;

  const rawCur = Number.isFinite(snapshot.currentTime) ? snapshot.currentTime : state.visualTime;
  const rate = snapshot.playbackRate > 0 ? snapshot.playbackRate : 1;

  // 1. Hold user's scrubbed/clicked position until hardware decoder finishes seeking
  if (state.pendingSeekTarget !== null) {
    const target = state.pendingSeekTarget;
    const preTime = state.pendingSeekPreTime ?? target;
    const nearTargetExact = Math.abs(rawCur - target) <= 0.08;
    const movedFromPreToTarget =
      Math.abs(rawCur - preTime) > 0.03 && Math.abs(rawCur - target) <= 0.35;
    const tinyDeltaSeek = Math.abs(target - preTime) <= 0.06;
    const settled = !snapshot.seeking && (nearTargetExact || movedFromPreToTarget || tinyDeltaSeek);
    const timedOut = nowMs >= state.pendingSeekUntilMs;

    if (settled || timedOut) {
      state.pendingSeekTarget = null;
      state.pendingSeekPreTime = null;
      const resolved = !snapshot.seeking ? rawCur : target;
      state.visualTime = resolved;
      state.lastMediaTime = rawCur;
      state.lastTickMs = nowMs;
    } else {
      state.lastMediaTime = rawCur;
      state.lastTickMs = nowMs;
      return target;
    }
  }

  // 2. If paused, actively seeking, or decoder has no playable frame yet, pause extrapolation
  if (snapshot.paused || snapshot.seeking || snapshot.readyState < 2) {
    if (!snapshot.seeking && snapshot.paused && Math.abs(rawCur - state.visualTime) > 0.05) {
      state.visualTime = rawCur;
    }
    state.lastMediaTime = rawCur;
    state.lastTickMs = nowMs;
    return state.visualTime;
  }

  // 3. Observe any hardware clock update from the media element
  if (Math.abs(rawCur - state.lastMediaTime) > 0.001) {
    state.lastMediaTime = rawCur;
    state.lastTickMs = nowMs;
  }

  // 4. Continuous PLL tracking anchored to latest hardware tick + elapsed frame time
  const elapsedSinceTick = Math.max(0, Math.min(0.9, (nowMs - state.lastTickMs) / 1000));
  const estimatedAudioTime = state.lastMediaTime + elapsedSinceTick * rate;
  const error = estimatedAudioTime - state.visualTime;

  if (Math.abs(error) > 0.45) {
    // External jump / loop restart
    state.visualTime = estimatedAudioTime;
  } else if (error > 0.002) {
    // Visual is behind estimated hardware time: smoothly catch up to zero phase error
    const catchUp = Math.min(error, error * 0.28 + dt * 0.6);
    state.visualTime += dt * rate + catchUp;
  } else if (error < -0.002) {
    // Visual crept slightly ahead of hardware clock: gently slow pace without backward vibration
    const paceScale = Math.max(0.2, 1 + error * 4.0);
    state.visualTime += dt * rate * paceScale;
  } else {
    state.visualTime += dt * rate;
  }

  return state.visualTime;
}



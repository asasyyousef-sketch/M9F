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
  lastAdvanceMs: number;
  lastFrameMs: number;
  hasObservedPlayback: boolean;
  pendingSeekTarget: number | null;
  pendingSeekUntilMs: number;
}

export function createPlaybackClockState(initialTime: number): PlaybackClockState {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    visualTime: initialTime,
    lastMediaTime: initialTime,
    lastAdvanceMs: now,
    lastFrameMs: now,
    hasObservedPlayback: false,
    pendingSeekTarget: null,
    pendingSeekUntilMs: 0
  };
}

export function beginPlaybackSeekHold(state: PlaybackClockState, targetTime: number, nowMs: number): void {
  state.pendingSeekTarget = targetTime;
  state.pendingSeekUntilMs = nowMs + 1200;
  state.visualTime = targetTime;
  state.lastFrameMs = nowMs;
  state.lastAdvanceMs = nowMs;
  state.hasObservedPlayback = false;
}

/**
 * Strictly monotonic phase-locked loop (PLL) for mobile HTMLMediaElement playback.
 * Never vibrates backward/forward between coarse hardware currentTime ticks,
 * never freezes mid-playback, and holds user seek targets until hardware seek settles.
 */
export function stepMonotonicPlaybackClock(
  state: PlaybackClockState,
  snapshot: MediaPlaybackSnapshot,
  nowMs: number
): number {
  const dt = Math.max(0, Math.min(0.05, (nowMs - state.lastFrameMs) / 1000));
  state.lastFrameMs = nowMs;

  const rawCur = Number.isFinite(snapshot.currentTime) ? snapshot.currentTime : state.visualTime;

  // 1. Hold user's scrubbed/clicked position until hardware decoder completes seek
  if (state.pendingSeekTarget !== null) {
    const settled = !snapshot.seeking && Math.abs(rawCur - state.pendingSeekTarget) <= 0.35;
    const timedOut = nowMs >= state.pendingSeekUntilMs;
    if (settled || timedOut) {
      state.pendingSeekTarget = null;
      state.visualTime = rawCur;
      state.lastMediaTime = rawCur;
      state.lastAdvanceMs = nowMs;
      state.hasObservedPlayback = !snapshot.paused && snapshot.readyState >= 2;
    } else {
      state.lastMediaTime = rawCur;
      return state.pendingSeekTarget;
    }
  }

  // 2. If paused, actively seeking, or decoder has no frame/audio yet, do not extrapolate
  if (snapshot.paused || snapshot.seeking || snapshot.readyState < 2) {
    if (!snapshot.seeking && snapshot.paused && Math.abs(rawCur - state.visualTime) > 0.05) {
      state.visualTime = rawCur;
    }
    state.lastMediaTime = rawCur;
    state.hasObservedPlayback = false;
    return state.visualTime;
  }

  // 3. Hardware clock update observed
  if (Math.abs(rawCur - state.lastMediaTime) > 0.001) {
    const prevMedia = state.lastMediaTime;
    state.lastMediaTime = rawCur;
    state.lastAdvanceMs = nowMs;

    if (rawCur > prevMedia || !state.hasObservedPlayback) {
      state.hasObservedPlayback = true;
      const err = rawCur - state.visualTime;
      if (Math.abs(err) > 0.45) {
        // External jump / wrap / loop
        state.visualTime = rawCur;
      } else if (err > 0) {
        // Hardware is ahead: smoothly pull forward without snapping
        state.visualTime += Math.min(err, err * 0.4 + 0.006);
      }
      // If err <= 0 (visualTime was slightly ahead of this tick), NEVER snap backward!
      // Just wait gently below while hardware catches up.
      return state.visualTime;
    }
  }

  // 4. Between coarse mobile hardware ticks: advance monotonically only if recently confirmed playing
  if (state.hasObservedPlayback) {
    const lead = state.visualTime - state.lastMediaTime;
    const sinceTickMs = nowMs - state.lastAdvanceMs;
    if (lead < 0.28 && sinceTickMs < 380) {
      const rate = snapshot.playbackRate > 0 ? snapshot.playbackRate : 1;
      // Gently taper pace if already slightly ahead of last reported hardware tick
      const taper = lead > 0.04 ? Math.max(0.45, 1 - lead * 2) : 1;
      state.visualTime += dt * rate * taper;
    }
  } else {
    state.visualTime = rawCur;
  }

  return state.visualTime;
}


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
  hasObservedTick: boolean;
  backwardJumpStreak: number;
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
    hasObservedTick: false,
    backwardJumpStreak: 0,
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
  state.pendingSeekUntilMs = nowMs + 600;
  state.visualTime = targetTime;
  state.lastFrameMs = nowMs;
  state.lastTickMs = nowMs;
  state.hasObservedTick = false;
  state.backwardJumpStreak = 0;
}

/**
 * Strictly monotonic phase-locked loop (PLL) for mobile HTMLMediaElement playback.
 * - Never snaps backward due to Android MediaCodec jitter or slow IPC ticks.
 * - Eases smoothly from frame 1 (no startup brick-wall freeze, bounded startup lead).
 * - Rapidly locks phase error to 0ms once hardware ticks begin flowing.
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
      const resolved = !snapshot.seeking && Math.abs(rawCur - target) <= 0.35 ? rawCur : target;
      state.visualTime = resolved;
      state.lastMediaTime = rawCur;
      state.lastTickMs = nowMs;
      state.hasObservedTick = false;
      state.backwardJumpStreak = 0;
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
    if (!snapshot.seeking) {
      state.lastMediaTime = rawCur;
    }
    state.lastTickMs = nowMs;
    state.backwardJumpStreak = 0;
    return state.visualTime;
  }

  // 3. Strictly forward hardware clock tracking (ignore small backward codec frame jitter)
  if (rawCur > state.lastMediaTime + 0.002) {
    state.lastMediaTime = rawCur;
    state.lastTickMs = nowMs;
    state.hasObservedTick = true;
    state.backwardJumpStreak = 0;
  } else if (rawCur < state.lastMediaTime - 0.75) {
    state.backwardJumpStreak += 1;
    if (state.backwardJumpStreak >= 3) {
      // Confirmed large external rewind / loop restart
      state.visualTime = rawCur;
      state.lastMediaTime = rawCur;
      state.lastTickMs = nowMs;
      state.hasObservedTick = false;
      state.backwardJumpStreak = 0;
      return state.visualTime;
    }
  } else {
    state.backwardJumpStreak = 0;
  }

  // 4. Strictly monotonic continuous advancement (NEVER snaps backward)
  if (!state.hasObservedTick) {
    // Before first hardware tick arrives after play/seek: glide smoothly from frame 1,
    // easing down gracefully up to +0.18s so startup doesn't freeze OR sprint out of sync.
    const lead = state.visualTime - state.lastMediaTime;
    const maxStartupLead = 0.18;
    if (lead < maxStartupLead) {
      const taper =
        lead > 0.08 ? Math.max(0.15, (maxStartupLead - lead) / (maxStartupLead - 0.08)) : 1.0;
      state.visualTime += dt * rate * taper;
    }
    return state.visualTime;
  }

  const elapsedSinceTick = Math.max(0, Math.min(0.45, (nowMs - state.lastTickMs) / 1000));
  const estimatedAudioTime = state.lastMediaTime + elapsedSinceTick * rate;
  const error = estimatedAudioTime - state.visualTime;

  if (error > 0.5) {
    // Hardware jumped far ahead: snap forward cleanly
    state.visualTime = estimatedAudioTime;
  } else if (error > 0.002) {
    // Visual is behind estimated hardware time: smoothly catch up to 0ms error
    const catchUp = Math.min(error, error * 0.32 + dt * 0.7);
    state.visualTime += dt * rate + catchUp;
  } else {
    // Visual is slightly ahead of hardware clock: NEVER jump backward, gently ease pace
    const paceScale = error <= -0.2 ? 0 : Math.max(0.15, 1 + error * 4.25);
    state.visualTime += dt * rate * paceScale;
  }

  return state.visualTime;
}



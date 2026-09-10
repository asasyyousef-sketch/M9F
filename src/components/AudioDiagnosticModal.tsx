import React, { useState, useRef, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Mic,
  Copy,
  Check,
  RefreshCw,
  X,
  Volume2,
  Server,
  Cpu,
  Globe,
  HelpCircle,
} from "lucide-react";

interface AudioDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSentence?: string;
  language?: string;
}

interface TestStep {
  id: string;
  title: string;
  status: "idle" | "running" | "success" | "warning" | "error";
  details: string;
  rawLog?: string;
}

export const AudioDiagnosticModal: React.FC<AudioDiagnosticModalProps> = ({
  isOpen,
  onClose,
  targetSentence = "Hello, this is a test.",
  language = "en-US",
}) => {
  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [liveVolume, setLiveVolume] = useState<number>(0);
  const [steps, setSteps] = useState<TestStep[]>([
    {
      id: "browser_env",
      title: "1. فحص بيئة المتصفح والبروتوكول",
      status: "idle",
      details: "فحص نوع المتصفح، البروتوكول (HTTPS/HTTP)، وحالة إطار المعاينة (Iframe).",
    },
    {
      id: "api_support",
      title: "2. دعم واجهات برمجة الصوت (Web Audio APIs)",
      status: "idle",
      details: "التحقق من دعم MediaDevices, MediaRecorder, و SpeechRecognition.",
    },
    {
      id: "mic_permission",
      title: "3. إذن الميكروفون والتقاط الإشارة الصوتية",
      status: "idle",
      details: "طلب إذن الميكروفون الحقيقي وفحص مستوى الصوت (هل يلتقط ذبذبات أم مكتوم؟).",
    },
    {
      id: "server_transcribe",
      title: "4. اختبار سيرفر التفريغ الفوري (Gemini Engine)",
      status: "idle",
      details: "إرسال عينة صوتية إلى السيرفر وفحص كود الاستجابة والنتيجة ومفتاح الـ API.",
    },
    {
      id: "google_speech",
      title: "5. اختبار محرك Google Web Speech اللحظي",
      status: "idle",
      details: "تشغيل محرك التعرف المباشر واصطياد كود الخطأ الدقيق إن وُجد.",
    },
  ]);

  const [fullLogs, setFullLogs] = useState<string[]>([]);
  const animFrameRef = useRef<number | null>(null);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setFullLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
  };

  const updateStep = (
    id: string,
    status: TestStep["status"],
    details: string,
    rawLog?: string
  ) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, details, rawLog } : s))
    );
  };

  // Run comprehensive diagnostic suite
  const runDiagnostics = async () => {
    setIsTesting(true);
    setFullLogs([]);
    addLog("=== بدء الفحص والتشخيص الشامل للصوت والميكروفون ===");

    // ----------------------------------------------------
    // STEP 1: Browser Environment
    // ----------------------------------------------------
    updateStep("browser_env", "running", "جاري فحص المتصفح...");
    await new Promise((r) => setTimeout(r, 200));

    const isSecure = window.location.protocol === "https:" || window.location.hostname === "localhost";
    const isInIframe = window.self !== window.top;
    const userAgent = navigator.userAgent;
    const isChrome = /Chrome/.test(userAgent) && !/Edge|Edg|OPR/.test(userAgent);
    const isEdge = /Edg/.test(userAgent);
    const isFirefox = /Firefox/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);

    addLog(`Protocol: ${window.location.protocol}`);
    addLog(`URL: ${window.location.href}`);
    addLog(`In Iframe: ${isInIframe}`);
    addLog(`User Agent: ${userAgent}`);

    let envStatus: TestStep["status"] = "success";
    let envMsg = `المتصفح: ${isChrome ? "Google Chrome" : isEdge ? "Microsoft Edge" : isFirefox ? "Firefox" : isSafari ? "Safari" : "أخرى"} | البروتوكول: ${window.location.protocol}`;

    if (!isSecure) {
      envStatus = "error";
      envMsg += " ⚠️ الموقع يعمل ببروتوكول غير مشفر (HTTP) والمتصفحات تحظر الميكروفون على HTTP!";
    }
    if (isInIframe) {
      envStatus = envStatus === "error" ? "error" : "warning";
      envMsg += " ⚠️ التطبيق يعمل داخل نافذة معاينة (Iframe) مما قد يقيد إذن الميكروفون.";
    }

    updateStep("browser_env", envStatus, envMsg);

    // ----------------------------------------------------
    // STEP 2: Web Audio API Support
    // ----------------------------------------------------
    updateStep("api_support", "running", "جاري التحقق من دعم واجهات برمجة الصوت...");
    await new Promise((r) => setTimeout(r, 200));

    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasMediaRecorder = typeof window.MediaRecorder !== "undefined";
    const hasAudioContext = typeof (window.AudioContext || (window as any).webkitAudioContext) !== "undefined";
    const hasWebSpeech = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    // Check supported MIME types
    const mimeTypesToCheck = [
      "audio/webm",
      "audio/webm;codecs=opus",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/wav",
    ];
    const supportedMimes = mimeTypesToCheck.filter(
      (m) => hasMediaRecorder && MediaRecorder.isTypeSupported(m)
    );

    addLog(`mediaDevices.getUserMedia: ${hasMediaDevices}`);
    addLog(`MediaRecorder: ${hasMediaRecorder}`);
    addLog(`Supported Mimes: ${supportedMimes.join(", ")}`);
    addLog(`AudioContext: ${hasAudioContext}`);
    addLog(`WebSpeech (SpeechRecognition): ${hasWebSpeech}`);

    let apiStatus: TestStep["status"] = "success";
    let apiMsg = `MediaDevices: ${hasMediaDevices ? "✅" : "❌"} | MediaRecorder: ${hasMediaRecorder ? "✅" : "❌"} | WebSpeech: ${hasWebSpeech ? "✅" : "❌"}`;

    if (!hasMediaDevices) {
      apiStatus = "error";
      apiMsg += " (واجهة الميكروفون غير مدعومة في هذا المتصفح!)";
    } else if (!hasWebSpeech) {
      apiStatus = "warning";
      apiMsg += " (Web Speech المباشر غير مدعوم، لكن التسجيل والمحرك الخادمي مدعومان)";
    }

    updateStep("api_support", apiStatus, apiMsg, `الصيغ المدعومة للتسجيل: ${supportedMimes.join(", ")}`);

    // ----------------------------------------------------
    // STEP 3: Real Microphone Capture & Signal Volume Check
    // ----------------------------------------------------
    updateStep("mic_permission", "running", "جاري طلب إذن الميكروفون وفحص الإشارة الصوتية...");
    let micStream: MediaStream | null = null;
    let recordedSampleBlob: Blob | null = null;

    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      const audioTracks = micStream.getAudioTracks();
      const track = audioTracks[0];
      const trackSettings = track ? track.getSettings() : {};
      const trackLabel = track ? track.label : "ميكروفون افتراضي";

      addLog(`Mic Track Label: ${trackLabel}`);
      addLog(`Mic Track ReadyState: ${track?.readyState}`);
      addLog(`Mic Track Enabled: ${track?.enabled}`);
      addLog(`Mic Track Muted: ${track?.muted}`);

      // Measure volume for 2 seconds
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      let maxVolumeDetected = 0;

      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(micStream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const startTime = Date.now();

        // Check volume for 1.5 seconds
        await new Promise<void>((resolve) => {
          const checkVol = () => {
            if (Date.now() - startTime > 1500) {
              audioCtx.close();
              resolve();
              return;
            }
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            const vol = Math.min(100, Math.round((avg / 128) * 100));
            setLiveVolume(vol);
            if (vol > maxVolumeDetected) maxVolumeDetected = vol;
            requestAnimationFrame(checkVol);
          };
          checkVol();
        });
      }

      // Record a small 1-second sample to verify MediaRecorder output
      const recorder = new MediaRecorder(micStream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.start();
        setTimeout(() => recorder.stop(), 800);
      });

      recordedSampleBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      addLog(`Sample Audio Recorded Size: ${recordedSampleBlob.size} bytes, MIME: ${recordedSampleBlob.type}`);
      addLog(`Max Volume Detected: ${maxVolumeDetected}%`);

      let micStatus: TestStep["status"] = "success";
      let micMsg = `تم الاتصال بالميكروفون: "${trackLabel}" | حجم العينة الصوتية: ${recordedSampleBlob.size} بايت | أقصى حساسية: ${maxVolumeDetected}%`;

      if (recordedSampleBlob.size < 200) {
        micStatus = "error";
        micMsg = `⚠️ حجم التسجيل صغير جداً (${recordedSampleBlob.size} بايت)، قد يكون الميكروفون لا يرسل بيانات صوتية!`;
      } else if (maxVolumeDetected === 0) {
        micStatus = "warning";
        micMsg += " ⚠️ مستوى الصوت المسجل 0% (تأكد من أن الميكروفون غير مكتوم Muted في إعدادات الويندوز أو الماك).";
      }

      updateStep("mic_permission", micStatus, micMsg);
    } catch (err: any) {
      addLog(`Microphone Error: ${err.name} - ${err.message}`);
      let errMsg = `فشل الوصول للميكروفون: ${err.name} (${err.message})`;
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errMsg = "❌ تم رفض إذن الميكروفون من قِبل المتصفح. انقر على أيقونة القفل أو الميكروفون في شريط العنوان واختر 'سماح (Allow)'.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errMsg = "❌ لم يتم العثور على ميكروفون متصل بجهازك.";
      }
      updateStep("mic_permission", "error", errMsg);
    } finally {
      if (micStream) {
        micStream.getTracks().forEach((t) => t.stop());
      }
      setLiveVolume(0);
    }

    // ----------------------------------------------------
    // STEP 4: Server Transcription Endpoint Test (/api/shadowing/transcribe)
    // ----------------------------------------------------
    updateStep("server_transcribe", "running", "جاري فخاذ اتصال بسيرفر التفريغ الصوتي الفوري...");
    await new Promise((r) => setTimeout(r, 200));

    try {
      // Create a test WAV audio payload (saying a short test tone/header)
      const testAudioBase64 =
        "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="; // minimal valid WAV header
      const startT = Date.now();

      const response = await fetch("/api/shadowing/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: testAudioBase64,
          mimeType: "audio/wav",
          language: language,
          targetSentence: targetSentence,
        }),
      });

      const elapsed = Date.now() - startT;
      const resJson = await response.json();

      addLog(`Server Endpoint Status: ${response.status} ${response.statusText} (${elapsed}ms)`);
      addLog(`Server Response Body: ${JSON.stringify(resJson)}`);

      if (response.ok && resJson.success) {
        updateStep(
          "server_transcribe",
          "success",
          `✅ السيرفر يعمل بنجاح! وقت الاستجابة: ${elapsed}ms | نص التفريغ: "${resJson.text || "(صوت صامت)"}"`
        );
      } else {
        const errDetail = resJson.error || `كود الخطأ: ${response.status}`;
        updateStep(
          "server_transcribe",
          "error",
          `❌ فشل استجابة السيرفر: ${errDetail} (الزمن: ${elapsed}ms)`
        );
      }
    } catch (serverErr: any) {
      addLog(`Server Fetch Error: ${serverErr.message}`);
      updateStep(
        "server_transcribe",
        "error",
        `❌ تعذر الاتصال بـ /api/shadowing/transcribe: ${serverErr.message}`
      );
    }

    // ----------------------------------------------------
    // STEP 5: Google Web Speech Engine Direct Test
    // ----------------------------------------------------
    updateStep("google_speech", "running", "جاري فحص محرك Google Web Speech الحي...");
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      addLog("SpeechRecognition constructor not found on window object.");
      updateStep(
        "google_speech",
        "warning",
        "محرك Web Speech غير متاح في متصفحك الحالي (متوفر فقط في Google Chrome و Microsoft Edge)."
      );
    } else {
      await new Promise<void>((resolve) => {
        try {
          const rec = new SpeechRecognition();
          rec.lang = language;
          rec.continuous = false;
          rec.interimResults = true;

          let didStart = false;
          let ended = false;

          rec.onstart = () => {
            didStart = true;
            addLog("SpeechRecognition event: onstart fired successfully.");
          };

          rec.onaudiostart = () => {
            addLog("SpeechRecognition event: onaudiostart (Audio input captured).");
          };

          rec.onspeechstart = () => {
            addLog("SpeechRecognition event: onspeechstart (Speech detected).");
          };

          rec.onresult = (e: any) => {
            const transcript = e.results[0]?.[0]?.transcript || "";
            addLog(`SpeechRecognition event: onresult ("${transcript}")`);
          };

          rec.onerror = (e: any) => {
            addLog(`SpeechRecognition event: onerror (${e.error})`);
            if (!ended) {
              ended = true;
              let desc = `رمز الخطأ من Google: "${e.error}"`;
              if (e.error === "not-allowed") {
                desc += " (إذن الميكروفون مرفوض أو محظور داخل إطار المعاينة)";
              } else if (e.error === "network") {
                desc += " (تعذر الاتصال بسيرفرات Google للتعرف الصوتي، تحقق من الاتصال/VPN)";
              } else if (e.error === "audio-capture") {
                desc += " (تعذر فتح قناة الصوت في كارت الصوت)";
              } else if (e.error === "no-speech") {
                desc += " (لم يتم رصد صوت خلال فترة الاختبار)";
              }
              updateStep(
                "google_speech",
                e.error === "no-speech" ? "success" : "error",
                desc
              );
              resolve();
            }
          };

          rec.onend = () => {
            addLog("SpeechRecognition event: onend");
            if (!ended) {
              ended = true;
              updateStep(
                "google_speech",
                didStart ? "success" : "warning",
                didStart
                  ? "✅ محرك Web Speech يعمل ويتصل بنجاح!"
                  : "انتهى الفحص دون رصد إشارة صوتية."
              );
              resolve();
            }
          };

          rec.start();

          // Safety timeout 3.5s
          setTimeout(() => {
            if (!ended) {
              ended = true;
              try {
                rec.stop();
              } catch (e) {}
              updateStep(
                "google_speech",
                didStart ? "success" : "warning",
                didStart
                  ? "✅ محرك Web Speech يعمل ويتصل بدون أخطاء قاتلة!"
                  : "المحرك مستعد ولكن انتهت مهلة الفحص."
              );
              resolve();
            }
          }, 3500);
        } catch (recErr: any) {
          addLog(`SpeechRecognition instantiation exception: ${recErr.message}`);
          updateStep("google_speech", "error", `استثناء غير متوقع: ${recErr.message}`);
          resolve();
        }
      });
    }

    addLog("=== اكتمل الفحص والتشخيص ===");
    setIsTesting(false);
  };

  const handleCopyReport = () => {
    const report = [
      "========================================",
      "تقرير تشخيص الصوت والميكروفون (مدرب اللغات)",
      "========================================",
      `التاريخ والوقت: ${new Date().toLocaleString()}`,
      `الرابط الحالي: ${window.location.href}`,
      `المتصفح: ${navigator.userAgent}`,
      `لغة الفحص: ${language}`,
      "",
      "--- نتائج الاختبارات التفصيلية ---",
      ...steps.map((s) => `[${s.status.toUpperCase()}] ${s.title}\n   النتيجة: ${s.details}${s.rawLog ? `\n   تفاصيل إضافية: ${s.rawLog}` : ""}`),
      "",
      "--- سجل الأحداث الخام (Raw Logs) ---",
      ...fullLogs,
      "========================================",
    ].join("\n");

    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-purple-500/40 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-b border-purple-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white">
                أداة فحص وتشخيص أخطاء الصوت والميكروفون
              </h3>
              <p className="text-xs text-purple-300/80">
                فحص فوري شامل لكارت الصوت، إذن الميكروفون، سيرفر Gemini، ومحرك Web Speech
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm custom-scrollbar">
          {/* Live Volume Meter if testing */}
          {liveVolume > 0 && (
            <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs text-emerald-300">
              <span className="font-bold flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>حساسية الميكروفون اللحظية:</span>
              </span>
              <div className="flex items-center gap-2">
                <div className="w-36 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all"
                    style={{ width: `${liveVolume}%` }}
                  />
                </div>
                <span className="font-mono font-bold w-8">{liveVolume}%</span>
              </div>
            </div>
          )}

          {/* Test Steps Cards */}
          <div className="space-y-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  step.status === "running"
                    ? "bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-950/40"
                    : step.status === "success"
                    ? "bg-emerald-950/20 border-emerald-500/30 text-slate-200"
                    : step.status === "warning"
                    ? "bg-amber-950/20 border-amber-500/30 text-amber-200"
                    : step.status === "error"
                    ? "bg-rose-950/30 border-rose-500/40 text-rose-200"
                    : "bg-slate-800/40 border-slate-700/50 text-slate-400"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {step.status === "running" ? (
                        <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                      ) : step.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : step.status === "warning" ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      ) : step.status === "error" ? (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-white">
                        {step.title}
                      </div>
                      <p className="text-xs mt-1 leading-relaxed text-slate-300">
                        {step.details}
                      </p>
                      {step.rawLog && (
                        <div className="text-[11px] font-mono mt-1 text-purple-300/80 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
                          {step.rawLog}
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                      step.status === "running"
                        ? "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                        : step.status === "success"
                        ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/30"
                        : step.status === "warning"
                        ? "bg-amber-600/30 text-amber-300 border border-amber-500/30"
                        : step.status === "error"
                        ? "bg-rose-600/30 text-rose-300 border border-rose-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {step.status === "running"
                      ? "جاري الفحص..."
                      : step.status === "success"
                      ? "ناجح"
                      : step.status === "warning"
                      ? "تنبيه"
                      : step.status === "error"
                      ? "خطأ"
                      : "بانتظار الفحص"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Raw Log Output Box */}
          {fullLogs.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">سجل أحداث الفحص المباشر (Console Logs):</span>
                <span className="font-mono text-[10px]">{fullLogs.length} أسطر</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl max-h-40 overflow-y-auto font-mono text-[11px] text-emerald-300 space-y-1 custom-scrollbar select-all">
                {fullLogs.map((log, i) => (
                  <div key={i} className="leading-tight">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={runDiagnostics}
            disabled={isTesting}
            className="flex-1 min-w-[200px] py-3 px-5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isTesting ? "animate-spin" : ""}`} />
            <span>{isTesting ? "جاري إجراء الفحص..." : "🚀 بدء الفحص والتشخيص الفوري الآن"}</span>
          </button>

          {fullLogs.length > 0 && (
            <button
              type="button"
              onClick={handleCopyReport}
              className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">تم نسخ التقرير!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-purple-400" />
                  <span>📋 نسخ التقرير لإرساله في الشات</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

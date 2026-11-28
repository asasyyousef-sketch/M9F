import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Swords,
  Sparkles,
  Send,
  Plus,
  RefreshCw,
  LogOut,
  Users,
  Volume2,
  VolumeX,
  Menu,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Trophy,
  Wifi,
  WifiOff,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import writerBlueImg from "../assets/images/duel_writer_blue_1795866622092.jpg";
import writerCoralImg from "../assets/images/duel_writer_coral_1795866622415.jpg";
import duelArenaStageImg from "../assets/images/duel_arena_stage_1795866622482.jpg";

interface DuelMistake {
  original: string;
  correction: string;
  explanationArabic: string;
}

interface DuelAICorrectionResult {
  correctedText: string;
  isCorrect: boolean;
  score: number;
  summaryArabic: string;
  mistakes: DuelMistake[];
  improvedVersion: string;
  tipArabic: string;
}

interface DuelAICorrectionState {
  status: "idle" | "loading" | "done" | "error";
  targetType: "p1" | "p2";
  requestedByName: string;
  requestedAt: string;
  modelUsed?: string;
  errorMessage?: string;
  result?: DuelAICorrectionResult;
}

interface DuelPlayerPublic {
  slot: 1 | 2;
  userId: string;
  name: string;
  avatar: "blue" | "coral";
  connected: boolean;
  isTyping: boolean;
  hasDraft: boolean;
  draftWordCount: number;
  submittedText: string | null;
  submittedAt: string | null;
  score: number;
  scoredThisRound: boolean;
}

interface RoomSummary {
  id: string;
  title: string;
  round: number;
  playerCount: number;
  players: Array<{ slot: 1 | 2; name: string; connected: boolean; avatar: "blue" | "coral" }>;
  createdAt: string;
}

interface RoomState {
  id: string;
  title: string;
  round: number;
  createdAt: string;
  updatedAt: string;
  mySlot: 1 | 2 | null;
  myDraft: string;
  players: {
    p1: DuelPlayerPublic | null;
    p2: DuelPlayerPublic | null;
  };
  centerCorrections: {
    p1: DuelAICorrectionState | null;
    p2: DuelAICorrectionState | null;
  };
}

interface WritingDuelWorkspaceProps {
  onToggleSidebar: () => void;
  onBackToLibrary: () => void;
}

const AI_CORRECTION_MODELS = [
  { key: "gemini-3.6-flash", label: "Gemini 3.6 Flash ⚡" },
  { key: "gemini-3.5-flash", label: "Gemini 3.5 Flash ⚡" },
  { key: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite ⚡" },
  { key: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite ⚡" },
  { key: "gemini-3.7-flash", label: "Gemini 3.7 Flash ⚡" },
  { key: "gemini-2.5-flash", label: "Gemini 2.5 Flash ⚡" },
  { key: "gemini-2.5-pro", label: "Gemini 2.5 Pro 💎" },
  { key: "groq-llama-3.3-70b", label: "Groq Llama 3.3 70B 🚀" },
  { key: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen" },
];

function readLocalSavedKeys(): { geminiApiKey: string; groqApiKey: string } {
  try {
    const geminiApiKey = (
      localStorage.getItem("settings_gemini_api_key") ||
      localStorage.getItem("gemini_api_key") ||
      localStorage.getItem("GEMINI_API_KEY") ||
      ""
    ).trim();
    const groqApiKey = (
      localStorage.getItem("settings_groq_api_key") ||
      localStorage.getItem("groq_api_key") ||
      ""
    ).trim();
    return { geminiApiKey, groqApiKey };
  } catch {
    return { geminiApiKey: "", groqApiKey: "" };
  }
}

function playGameChime(kind: "submit" | "ai_done" | "round", muted: boolean) {
  if (muted) return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes =
      kind === "submit"
        ? [523.25, 659.25]
        : kind === "ai_done"
        ? [587.33, 783.99, 987.77]
        : [440, 554.37, 659.25];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.06, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.2);
    });
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch {}
}

const CartoonAvatar: React.FC<{
  avatar: "blue" | "coral";
  isTyping?: boolean;
  name: string;
  sizeClass?: string;
}> = ({ avatar, isTyping = false, name, sizeClass = "w-20 h-20" }) => {
  const [imgError, setImgError] = useState(false);
  const src = avatar === "blue" ? writerBlueImg : writerCoralImg;
  const fallbackBg =
    avatar === "blue"
      ? "from-sky-500 to-blue-600 text-white"
      : "from-orange-400 to-rose-500 text-white";

  return (
    <motion.div
      animate={
        isTyping
          ? { y: [0, -3, 0], rotate: [-1.5, 1.5, -1.5] }
          : { y: 0, rotate: 0 }
      }
      transition={
        isTyping
          ? { repeat: Infinity, duration: 0.7, ease: "easeInOut" }
          : { duration: 0.25 }
      }
      className={`relative ${sizeClass} rounded-2xl border-2 border-slate-900 shadow-[0_4px_0_#0f172a] overflow-hidden shrink-0 bg-amber-50`}
    >
      {!imgError ? (
        <img
          src={src}
          alt={name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-top"
        />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${fallbackBg} flex items-center justify-center font-black text-2xl`}
        >
          {name.slice(0, 1)}
        </div>
      )}
      {isTyping && (
        <motion.span
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [1, 1.15, 1], opacity: 1 }}
          transition={{ repeat: Infinity, duration: 0.9 }}
          className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-amber-300 border border-slate-900 text-[10px] font-black text-slate-900"
        >
          ✍️
        </motion.span>
      )}
    </motion.div>
  );
};

const BlurredOpponentSheet: React.FC<{
  isTyping: boolean;
  hasDraft: boolean;
  wordCount: number;
}> = ({ isTyping, hasDraft, wordCount }) => {
  // Deterministic simulated blurred word-blocks proportional to wordCount (no real characters ever transmitted!)
  const blockCount = Math.min(36, Math.max(wordCount > 0 ? wordCount : 0, isTyping ? 6 : 0));
  const widths = [46, 68, 38, 82, 54, 62, 40, 74, 50, 64];

  return (
    <div className="flex-1 min-h-[220px] rounded-xl border-2 border-slate-900 bg-white relative overflow-hidden flex flex-col">
      {/* Underlying simulated notebook writing surface (blurred) */}
      <div
        className="flex-1 p-4 flex flex-wrap content-start gap-2.5 select-none pointer-events-none"
        style={{ filter: "blur(7px)" }}
        dir="ltr"
        aria-hidden="true"
      >
        {blockCount > 0 ? (
          <>
            {Array.from({ length: blockCount }).map((_, idx) => (
              <span
                key={idx}
                className={`h-3.5 rounded-full ${
                  idx % 5 === 0 ? "bg-slate-800/75" : "bg-slate-600/70"
                } ${isTyping && idx === blockCount - 1 ? "animate-pulse" : ""}`}
                style={{ width: `${widths[idx % widths.length]}px` }}
              />
            ))}
            {isTyping && (
              <span className="inline-block w-1.5 h-4 bg-sky-600 animate-pulse rounded-xs" />
            )}
          </>
        ) : (
          <div className="w-full space-y-3 opacity-35 pt-2">
            <div className="h-3 w-3/4 rounded-full bg-slate-300" />
            <div className="h-3 w-1/2 rounded-full bg-slate-200" />
            <div className="h-3 w-2/3 rounded-full bg-slate-200" />
          </div>
        )}
      </div>

      {/* Frosted Blur Overlay */}
      <div className="absolute inset-0 backdrop-blur-[6px] bg-white/35 flex flex-col items-center justify-center p-4 gap-2.5 pointer-events-none">
        {isTyping ? (
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="px-4 py-1.5 rounded-xl bg-amber-300/95 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] text-xs font-black text-slate-950"
          >
            يكتب الآن... ✍️
          </motion.div>
        ) : hasDraft ? (
          <div className="px-4 py-1.5 rounded-xl bg-white/95 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] text-xs font-black text-slate-900">
            مسودة قيد الإعداد
          </div>
        ) : null}

        <div className="px-3.5 py-1 rounded-xl bg-slate-900/90 text-white text-xs font-black tabular-nums shadow-xs">
          عدد الكلمات: {wordCount}
        </div>
      </div>
    </div>
  );
};

const AICorrectionPanel: React.FC<{
  correction: DuelAICorrectionState | null;
}> = ({ correction }) => {
  const [showDetails, setShowDetails] = useState(true);

  if (!correction || correction.status === "idle") return null;

  if (correction.status === "loading") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2.5 rounded-xl border-2 border-violet-800 bg-violet-50 p-3 shadow-[0_3px_0_#4c1d95]"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0 border border-slate-900">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
          <p className="text-xs font-black text-violet-950">
            جاري التصحيح... ({correction.requestedByName})
          </p>
        </div>
      </motion.div>
    );
  }

  if (correction.status === "error") {
    return (
      <div className="mt-2.5 rounded-xl border-2 border-rose-800 bg-rose-50 p-3 text-rose-900">
        <div className="flex items-center gap-2 text-xs font-black">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{correction.errorMessage || "تعذر التصحيح."}</span>
        </div>
      </div>
    );
  }

  const res = correction.result;
  if (!res) return null;

  const scoreTheme =
    res.score >= 85
      ? "bg-emerald-400 text-slate-950"
      : res.score >= 60
      ? "bg-amber-300 text-slate-950"
      : "bg-rose-300 text-slate-950";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-2.5 rounded-xl border-2 border-slate-900 bg-white overflow-hidden shadow-[0_3px_0_#0f172a]"
    >
      <div className="px-3 py-2 bg-emerald-50 border-b-2 border-slate-900 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="text-xs font-black text-slate-900 truncate">
            التصحيح ({correction.requestedByName})
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`px-2 py-0.5 rounded-lg border-2 border-slate-900 text-xs font-black tabular-nums ${scoreTheme}`}>
            {res.score}%
          </span>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="p-1 rounded-lg hover:bg-emerald-200/70 text-slate-800 cursor-pointer"
          >
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="p-3 space-y-2.5 text-xs">
          <div className="rounded-lg bg-emerald-50/70 border border-emerald-300 p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px] font-black text-emerald-900">
                {res.isCorrect ? "صحيح" : "النص المصحح"}
              </span>
            </div>
            <p className="font-bold text-slate-900 text-sm leading-relaxed" dir="ltr">
              {res.correctedText}
            </p>
          </div>

          <p className="text-slate-700 font-bold leading-relaxed">{res.summaryArabic}</p>

          {res.mistakes && res.mistakes.length > 0 && (
            <div className="space-y-1.5">
              {res.mistakes.map((m, idx) => (
                <div key={idx} className="rounded-lg bg-rose-50/70 border border-rose-200 p-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold" dir="ltr">
                    <span className="line-through text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
                      {m.original}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      {m.correction}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-700">{m.explanationArabic}</p>
                </div>
              ))}
            </div>
          )}

          {res.improvedVersion && res.improvedVersion.trim() !== res.correctedText.trim() && (
            <div className="rounded-lg bg-sky-50 border border-sky-200 p-2">
              <p className="font-bold text-slate-900 text-xs" dir="ltr">
                {res.improvedVersion}
              </p>
            </div>
          )}

          {res.tipArabic && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] font-bold text-amber-950">
              💡 {res.tipArabic}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export const WritingDuelWorkspace: React.FC<WritingDuelWorkspaceProps> = ({
  onToggleSidebar,
  onBackToLibrary,
}) => {
  const { currentUser, token } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const draftHydratedKeyRef = useRef<string>("");
  const prevCorrectionSignaturesRef = useRef<string>("");
  const prevSubmittedSignaturesRef = useRef<string>("");

  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [lobbyRooms, setLobbyRooms] = useState<RoomSummary[]>([]);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem("writing_duel_muted") === "true";
    } catch {
      return false;
    }
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      return (
        localStorage.getItem("writing_duel_model") ||
        localStorage.getItem("ai_corrector_selected_model") ||
        "gemini-3.6-flash"
      );
    } catch {
      return "gemini-3.6-flash";
    }
  });

  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [draftInput, setDraftInput] = useState("");
  const [stageBgError, setStageBgError] = useState(false);

  const handleModelChange = (modelKey: string) => {
    setSelectedModel(modelKey);
    try {
      localStorage.setItem("writing_duel_model", modelKey);
    } catch {}
  };

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("writing_duel_muted", String(next));
      } catch {}
      return next;
    });
  };

  const sendWs = useCallback((payload: Record<string, any>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    if (!errorToast) return;
    const t = window.setTimeout(() => setErrorToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [errorToast]);

  // Sync user's API keys cleanly if updated in Settings while connected
  useEffect(() => {
    const syncKeys = () => {
      const { geminiApiKey, groqApiKey } = readLocalSavedKeys();
      sendWs({ type: "user:sync_keys", geminiApiKey, groqApiKey });
    };
    window.addEventListener("app_settings_changed", syncKeys);
    window.addEventListener("storage", syncKeys);
    return () => {
      window.removeEventListener("app_settings_changed", syncKeys);
      window.removeEventListener("storage", syncKeys);
    };
  }, [sendWs]);

  useEffect(() => {
    let closedByCleanup = false;
    let attempt = 0;

    const activeToken = token || localStorage.getItem("app_auth_token") || "";
    if (!activeToken) return;

    const connect = () => {
      if (closedByCleanup) return;
      setWsStatus("connecting");
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${proto}//${window.location.host}/ws/writing-duel`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        const { geminiApiKey, groqApiKey } = readLocalSavedKeys();
        ws.send(JSON.stringify({ type: "auth", token: activeToken, geminiApiKey, groqApiKey }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "auth:ok") {
            setWsStatus("connected");
            if (Array.isArray(msg.rooms)) setLobbyRooms(msg.rooms);
            setRoom((currentRoom) => {
              if (currentRoom?.id) {
                ws.send(JSON.stringify({ type: "room:join", roomId: currentRoom.id }));
              }
              return currentRoom;
            });
          } else if (msg.type === "lobby:rooms") {
            setLobbyRooms(Array.isArray(msg.rooms) ? msg.rooms : []);
          } else if (msg.type === "room:state") {
            setRoom(msg.room || null);
          } else if (msg.type === "error") {
            setErrorToast(msg.message || "حدث خطأ.");
          }
        } catch {}
      };

      ws.onclose = () => {
        if (closedByCleanup) return;
        setWsStatus("disconnected");
        attempt += 1;
        const delay = Math.min(8000, 1000 * Math.pow(1.5, Math.min(attempt, 5)));
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {};
    };

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
    };
  }, [token]);

  useEffect(() => {
    if (!room) {
      draftHydratedKeyRef.current = "";
      setDraftInput("");
      return;
    }
    const key = `${room.id}:${room.round}:${room.mySlot}`;
    if (draftHydratedKeyRef.current !== key) {
      draftHydratedKeyRef.current = key;
      setDraftInput(room.myDraft || "");
    }
  }, [room]);

  useEffect(() => {
    if (!room) return;
    const subSig = `${room.players.p1?.submittedAt || ""}|${room.players.p2?.submittedAt || ""}`;
    if (prevSubmittedSignaturesRef.current && prevSubmittedSignaturesRef.current !== subSig) {
      playGameChime("submit", muted);
    }
    prevSubmittedSignaturesRef.current = subSig;

    const corrSig = [
      room.centerCorrections.p1?.status,
      room.centerCorrections.p1?.requestedAt,
      room.centerCorrections.p2?.status,
      room.centerCorrections.p2?.requestedAt,
    ].join("|");

    if (prevCorrectionSignaturesRef.current && prevCorrectionSignaturesRef.current !== corrSig) {
      const hasDone =
        room.centerCorrections.p1?.status === "done" ||
        room.centerCorrections.p2?.status === "done";
      if (hasDone) {
        playGameChime("ai_done", muted);
      }
    }
    prevCorrectionSignaturesRef.current = corrSig;
  }, [room, muted]);

  const handleDraftChange = (val: string) => {
    setDraftInput(val);
    sendWs({ type: "duel:typing", draftText: val, isTyping: val.trim().length > 0 });
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      sendWs({ type: "duel:typing", draftText: val, isTyping: false });
    }, 1800);
  };

  const handleSubmitDraft = () => {
    const text = draftInput.trim();
    if (!text) return;
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    sendWs({ type: "duel:submit", text });
    setDraftInput("");
    playGameChime("submit", muted);
  };

  const handleTriggerAICorrection = (targetType: "p1" | "p2") => {
    const { geminiApiKey, groqApiKey } = readLocalSavedKeys();
    sendWs({
      type: "duel:correct_ai",
      targetType,
      selectedModel,
      geminiApiKey,
      groqApiKey,
    });
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    sendWs({
      type: "room:create",
      title: newRoomTitle.trim() || undefined,
    });
  };

  const handleJoinRoomByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (!cleaned) return;
    sendWs({ type: "room:join", roomId: cleaned });
  };

  const myWordCount = useMemo(() => {
    const t = draftInput.trim();
    return t ? t.split(/\s+/).length : 0;
  }, [draftInput]);

  const renderPlayerHalf = (slotNum: 1 | 2) => {
    if (!room) return null;
    const player = slotNum === 1 ? room.players.p1 : room.players.p2;
    const isMe = room.mySlot === slotNum;
    const theme =
      slotNum === 1
        ? {
            bg: "bg-[#EFF6FF]",
            header: "bg-sky-500 text-white",
            badge: "bg-sky-200 text-slate-950",
            btn: "bg-sky-500 hover:bg-sky-400 text-white",
            label: "اللاعب 1",
            avatar: "blue" as const,
          }
        : {
            bg: "bg-[#FFF4ED]",
            header: "bg-orange-500 text-white",
            badge: "bg-orange-200 text-slate-950",
            btn: "bg-orange-500 hover:bg-orange-400 text-white",
            label: "اللاعب 2",
            avatar: "coral" as const,
          };

    if (!player) {
      return (
        <div
          className={`flex-1 h-full rounded-2xl border-2 border-dashed border-slate-400 ${theme.bg} p-5 flex flex-col items-center justify-center text-center min-h-[280px]`}
        >
          <CartoonAvatar avatar={theme.avatar} name="؟" sizeClass="w-24 h-24 opacity-65 grayscale-[20%]" />
          <p className="mt-3 text-sm font-black text-slate-800">بانتظار {theme.label}...</p>
        </div>
      );
    }

    return (
      <div
        className={`flex-1 h-full min-h-0 rounded-2xl border-2 border-slate-900 ${theme.bg} shadow-[0_5px_0_#0f172a] flex flex-col overflow-hidden`}
      >
        <div className={`${theme.header} px-3.5 py-2.5 border-b-2 border-slate-900 flex items-center justify-between gap-2 shrink-0`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className={`px-2 py-0.5 rounded-lg border border-slate-900 text-[11px] font-black shrink-0 ${theme.badge}`}>
              {isMe ? "أنت" : theme.label}
            </span>
            <h3 className="font-black text-sm truncate">{player.name}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`w-2.5 h-2.5 rounded-full border border-slate-900 ${
                player.connected ? "bg-emerald-300" : "bg-slate-300"
              }`}
            />
            <span className="px-2 py-0.5 rounded-lg bg-slate-900/20 text-white text-xs font-black tabular-nums flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-amber-200" />
              {player.score}
            </span>
          </div>
        </div>

        <div className="p-3.5 flex-1 min-h-0 flex flex-col gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <CartoonAvatar
              avatar={player.avatar}
              isTyping={isMe ? draftInput.trim().length > 0 && myWordCount > 0 : player.isTyping}
              name={player.name}
              sizeClass="w-20 h-20"
            />
            {!isMe && (
              <div className="min-w-0 flex-1 space-y-1">
                {player.isTyping ? (
                  <motion.span
                    animate={{ opacity: [0.65, 1, 0.65] }}
                    transition={{ repeat: Infinity, duration: 1.1 }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-300 border-2 border-slate-900 text-xs font-black text-slate-950"
                  >
                    يكتب الآن... ✍️
                  </motion.span>
                ) : player.submittedText ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-200 border border-slate-900 text-xs font-black text-slate-900">
                    تم الإرسال ✅
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {isMe ? (
            <div className="flex-1 min-h-0 flex flex-col gap-2.5">
              <textarea
                value={draftInput}
                onChange={(e) => handleDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleSubmitDraft();
                  }
                }}
                dir="ltr"
                placeholder="Schreibe hier..."
                className="w-full flex-1 min-h-[220px] rounded-xl border-2 border-slate-900 bg-white p-3.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none shadow-inner"
              />
              <div className="flex items-center justify-between gap-2 shrink-0">
                <span className="text-xs font-extrabold text-slate-700">عدد الكلمات: {myWordCount}</span>
                <button
                  type="button"
                  onClick={handleSubmitDraft}
                  disabled={!draftInput.trim()}
                  className={`px-4 py-2 rounded-xl border-2 border-slate-900 font-black text-xs flex items-center gap-1.5 shadow-[0_3px_0_#0f172a] active:shadow-none active:translate-y-[3px] transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${theme.btn}`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال</span>
                </button>
              </div>
            </div>
          ) : (
            <BlurredOpponentSheet
              isTyping={player.isTyping}
              hasDraft={player.hasDraft}
              wordCount={player.draftWordCount}
            />
          )}
        </div>
      </div>
    );
  };

  const renderCenterSubmissionCard = (slotNum: 1 | 2) => {
    if (!room) return null;
    const player = slotNum === 1 ? room.players.p1 : room.players.p2;
    const correction = slotNum === 1 ? room.centerCorrections.p1 : room.centerCorrections.p2;
    const accent = slotNum === 1 ? "border-sky-700 bg-sky-50/95" : "border-orange-700 bg-orange-50/95";
    const chipBg = slotNum === 1 ? "bg-sky-500 text-white" : "bg-orange-500 text-white";

    if (!player) return null;

    return (
      <div className={`rounded-xl border-2 ${accent} p-3 shadow-xs`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`px-2 py-0.5 rounded-md border border-slate-900 text-[10px] font-black ${chipBg}`}>
              {slotNum === 1 ? "P1" : "P2"}
            </span>
            <span className="text-xs font-black text-slate-900 truncate">{player.name}</span>
          </div>

          {player.submittedText && (
            <button
              type="button"
              onClick={() => handleTriggerAICorrection(slotNum === 1 ? "p1" : "p2")}
              disabled={correction?.status === "loading"}
              className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white border-2 border-slate-900 text-[11px] font-black flex items-center gap-1 shadow-[0_2px_0_#0f172a] active:shadow-none active:translate-y-[2px] transition-all cursor-pointer disabled:opacity-55 shrink-0"
            >
              {correction?.status === "loading" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              <span>صحح بالذكاء</span>
            </button>
          )}
        </div>

        {player.submittedText ? (
          <div className="rounded-lg bg-white border border-slate-300 p-2.5">
            <p className="text-sm font-bold text-slate-900 leading-relaxed whitespace-pre-wrap" dir="ltr">
              {player.submittedText}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 py-5 px-3 text-center text-[11px] font-bold text-slate-400">
            بانتظار الإرسال...
          </div>
        )}

        <AICorrectionPanel correction={correction} />
      </div>
    );
  };

  return (
    <div
      className={`flex-1 h-full bg-[#FAF6ED] text-slate-900 flex flex-col ${
        room ? "overflow-y-auto lg:overflow-hidden" : "overflow-y-auto"
      }`}
      dir="rtl"
    >
      {/* Simple Top Bar */}
      <header className="shrink-0 z-20 bg-[#FFFDF8]/95 backdrop-blur-sm border-b-2 border-slate-900 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-100 cursor-pointer"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="w-9 h-9 rounded-xl bg-amber-400 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] flex items-center justify-center shrink-0">
            <Swords className="w-5 h-5 text-slate-950" />
          </div>
          <h1 className="text-base sm:text-lg font-black text-slate-950 truncate">تحدي الكتابة</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`px-2.5 py-1 rounded-xl border-2 border-slate-900 text-[11px] font-black flex items-center gap-1.5 ${
              wsStatus === "connected"
                ? "bg-emerald-100 text-emerald-950"
                : wsStatus === "connecting"
                ? "bg-amber-100 text-amber-950"
                : "bg-rose-100 text-rose-950"
            }`}
          >
            {wsStatus === "connected" ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-700" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-700" />
            )}
            <span>
              {wsStatus === "connected" ? "متصل" : wsStatus === "connecting" ? "اتصال..." : "منقطع"}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-100 text-slate-800 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {room && (
            <button
              type="button"
              onClick={() => sendWs({ type: "room:leave" })}
              className="px-3 py-1.5 rounded-xl border-2 border-slate-900 bg-rose-100 hover:bg-rose-200 text-rose-950 text-xs font-black flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>مغادرة</span>
            </button>
          )}

          <button
            type="button"
            onClick={onBackToLibrary}
            className="px-3 py-1.5 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-100 text-slate-800 text-xs font-black flex items-center gap-1 cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>المكتبة</span>
          </button>
        </div>
      </header>

      <AnimatePresence>
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mx-auto mt-2 shrink-0 px-4 py-2 rounded-xl border-2 border-slate-900 bg-rose-500 text-white text-xs font-black shadow-[0_3px_0_#0f172a] flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* LOBBY                                                                     */}
      {/* ========================================================================= */}
      {!room ? (
        <div className="flex-1 p-4 sm:p-6 max-w-4xl w-full mx-auto space-y-5">
          <div className="rounded-3xl border-2 border-slate-900 bg-gradient-to-br from-[#FFF9E8] to-[#E0F2FE] p-5 shadow-[0_6px_0_#0f172a] flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-xl sm:text-2xl font-black text-slate-950">تحدي الكتابة المباشر</h2>
            <div className="flex items-center gap-3">
              <CartoonAvatar avatar="blue" isTyping name="1" sizeClass="w-24 h-24" />
              <div className="w-9 h-9 rounded-full bg-amber-400 border-2 border-slate-900 flex items-center justify-center font-black text-xs shadow-[0_2px_0_#0f172a]">
                VS
              </div>
              <CartoonAvatar avatar="coral" isTyping name="2" sizeClass="w-24 h-24" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form
              onSubmit={handleCreateRoom}
              className="rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-[0_5px_0_#0f172a] flex flex-col justify-between gap-3"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-500 text-white border-2 border-slate-900 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <h3 className="font-black text-sm text-slate-950">غرفة جديدة</h3>
                </div>
                <input
                  type="text"
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  placeholder="اسم الغرفة (اختياري)"
                  className="w-full rounded-xl border-2 border-slate-900 px-3 py-2 text-xs font-bold bg-[#FAF6ED] focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
              <button
                type="submit"
                disabled={wsStatus !== "connected"}
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white border-2 border-slate-900 font-black text-sm shadow-[0_4px_0_#0f172a] active:shadow-none active:translate-y-[4px] transition-all cursor-pointer disabled:opacity-50"
              >
                إنشاء غرفة
              </button>
            </form>

            <form
              onSubmit={handleJoinRoomByCode}
              className="rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-[0_5px_0_#0f172a] flex flex-col justify-between gap-3"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-500 text-white border-2 border-slate-900 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="font-black text-sm text-slate-950">دخول برمز</h3>
                </div>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="رمز الغرفة"
                  maxLength={8}
                  dir="ltr"
                  className="w-full rounded-xl border-2 border-slate-900 px-3 py-2 text-center font-mono text-sm font-black tracking-widest uppercase bg-[#FAF6ED] focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <button
                type="submit"
                disabled={wsStatus !== "connected" || !joinCode.trim()}
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white border-2 border-slate-900 font-black text-sm shadow-[0_4px_0_#0f172a] active:shadow-none active:translate-y-[4px] transition-all cursor-pointer disabled:opacity-50"
              >
                انضمام
              </button>
            </form>
          </div>

          <div className="rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-[0_5px_0_#0f172a] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-black text-sm text-slate-950">الغرف ({lobbyRooms.length})</h3>
              <button
                type="button"
                onClick={() => sendWs({ type: "lobby:list" })}
                className="p-1.5 rounded-lg border-2 border-slate-900 bg-[#FAF6ED] hover:bg-amber-100 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {lobbyRooms.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-300 bg-[#FAF6ED] p-5 text-center text-xs font-bold text-slate-400">
                لا توجد غرف حالياً
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lobbyRooms.map((r) => {
                  const isFull = r.playerCount >= 2;
                  const alreadyIn = r.players.some((p) => p.name === currentUser?.name);
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border-2 border-slate-900 bg-[#FAF6ED] p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-black text-xs text-slate-900 truncate">{r.title}</p>
                        <p className="text-[11px] font-bold text-slate-600 truncate mt-0.5">
                          ({r.playerCount}/2) {r.players.map((p) => p.name).join(" • ")}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => sendWs({ type: "room:join", roomId: r.id })}
                        disabled={isFull && !alreadyIn}
                        className="px-3 py-1.5 rounded-xl border-2 border-slate-900 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs shadow-[0_2px_0_#0f172a] active:shadow-none active:translate-y-[2px] cursor-pointer disabled:opacity-45 shrink-0"
                      >
                        {alreadyIn ? "عودة" : isFull ? "مكتملة" : "انضمام"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* FULL-HEIGHT SPLIT-SCREEN CARTOON DUEL ARENA                               */
        /* ========================================================================= */
        <div className="flex-1 min-h-0 p-3 sm:p-4 max-w-[1480px] w-full mx-auto flex flex-col gap-3">
          {/* Clean Match Bar */}
          <div className="shrink-0 rounded-2xl border-2 border-slate-900 bg-white p-2.5 sm:px-3.5 shadow-[0_4px_0_#0f172a] flex flex-wrap items-center justify-between gap-2.5">
            <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-black tabular-nums">
              الجولة {room.round}
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                aria-label="موديل التصحيح"
                className="px-3 py-1.5 rounded-xl border-2 border-slate-900 bg-[#FAF6ED] text-xs font-black cursor-pointer"
                dir="ltr"
              >
                {AI_CORRECTION_MODELS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  sendWs({ type: "duel:next_round" });
                  playGameChime("round", muted);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 text-xs font-black flex items-center gap-1.5 shadow-[0_3px_0_#0f172a] active:shadow-none active:translate-y-[3px] transition-all cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>جولة جديدة</span>
              </button>
            </div>
          </div>

          {/* FULL-HEIGHT 3-WINDOW SPLIT SCREEN */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
            <div className="lg:col-span-4 h-full min-h-0 flex flex-col">{renderPlayerHalf(1)}</div>

            <div className="lg:col-span-4 h-full min-h-0 rounded-2xl border-2 border-slate-900 shadow-[0_5px_0_#0f172a] overflow-hidden relative flex flex-col bg-[#F7EEDB]">
              {!stageBgError && (
                <img
                  src={duelArenaStageImg}
                  alt=""
                  onError={() => setStageBgError(true)}
                  className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none select-none"
                />
              )}

              <div className="relative z-10 shrink-0 bg-amber-400/95 px-3.5 py-2.5 border-b-2 border-slate-900 flex items-center gap-2">
                <Swords className="w-4 h-4 text-slate-950" />
                <h2 className="text-sm font-black text-slate-950">المساحة المتوسطة</h2>
              </div>

              <div className="relative z-10 flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3">
                {renderCenterSubmissionCard(1)}
                {renderCenterSubmissionCard(2)}
              </div>
            </div>

            <div className="lg:col-span-4 h-full min-h-0 flex flex-col">{renderPlayerHalf(2)}</div>
          </div>
        </div>
      )}
    </div>
  );
};

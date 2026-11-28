import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Swords,
  Sparkles,
  Send,
  Lock,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  Users,
  Volume2,
  VolumeX,
  Menu,
  ArrowRight,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Trophy,
  StickyNote,
  Wifi,
  WifiOff,
  Loader2,
  ChevronDown,
  ChevronUp,
  Target,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import writerBlueImg from "../assets/images/duel_writer_blue_1795866622092.jpg";
import writerCoralImg from "../assets/images/duel_writer_coral_1795866622415.jpg";
import duelArenaStageImg from "../assets/images/duel_arena_stage_1795866622482.jpg";

type DuelLevel = "A1" | "A2" | "B1" | "B2";

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
  targetType: "p1" | "p2" | "kartchen";
  targetId: string;
  requestedByName: string;
  requestedAt: string;
  errorMessage?: string;
  result?: DuelAICorrectionResult;
}

interface KartchenItem {
  id: string;
  germanText: string;
  arabicHint: string;
  tag: string;
  authorName: string;
  createdAt: string;
  aiCorrection: DuelAICorrectionState | null;
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
  level: DuelLevel;
  round: number;
  playerCount: number;
  players: Array<{ slot: 1 | 2; name: string; connected: boolean; avatar: "blue" | "coral" }>;
  createdAt: string;
}

interface RoomState {
  id: string;
  title: string;
  level: DuelLevel;
  round: number;
  createdAt: string;
  updatedAt: string;
  mySlot: 1 | 2 | null;
  myDraft: string;
  players: {
    p1: DuelPlayerPublic | null;
    p2: DuelPlayerPublic | null;
  };
  kartchen: KartchenItem[];
  activeKartchenId: string | null;
  isGeneratingKartchen: boolean;
  kartchenGenRequestedBy: string | null;
  centerCorrections: {
    p1: DuelAICorrectionState | null;
    p2: DuelAICorrectionState | null;
  };
}

interface WritingDuelWorkspaceProps {
  onToggleSidebar: () => void;
  onBackToLibrary: () => void;
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
          className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-amber-300 border border-slate-900 text-[10px] font-black text-slate-900 shadow-xs"
        >
          ✍️
        </motion.span>
      )}
    </motion.div>
  );
};

const AICorrectionPanel: React.FC<{
  correction: DuelAICorrectionState | null;
  compact?: boolean;
}> = ({ correction, compact = false }) => {
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
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-violet-950">
              المساعد الذكي يراجع ويصحح النص مباشرة...
            </p>
            <p className="text-[11px] font-bold text-violet-700 truncate">
              بطلب من: {correction.requestedByName} • يظهر للطرفين الآن
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (correction.status === "error") {
    return (
      <div className="mt-2.5 rounded-xl border-2 border-rose-800 bg-rose-50 p-3 text-rose-900">
        <div className="flex items-center gap-2 text-xs font-black">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{correction.errorMessage || "تعذر التصحيح بالذكاء الاصطناعي."}</span>
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
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="text-xs font-black text-slate-900 truncate">
            تصحيح المساعد الذكي ({correction.requestedByName})
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`px-2 py-0.5 rounded-lg border-2 border-slate-900 text-xs font-black tabular-nums ${scoreTheme}`}>
            {res.score}%
          </span>
          {compact && (
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="p-1 rounded-lg hover:bg-emerald-200/70 text-slate-800 cursor-pointer"
            >
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {showDetails && (
        <div className="p-3 space-y-2.5 text-xs">
          {/* Corrected German Text */}
          <div className="rounded-lg bg-emerald-50/70 border border-emerald-300 p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-black text-emerald-900 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {res.isCorrect ? "جملة ممتازة وصحيحة!" : "النص المصحح بالألمانية:"}
              </span>
            </div>
            <p className="font-bold text-slate-900 text-sm leading-relaxed" dir="ltr">
              {res.correctedText}
            </p>
          </div>

          {/* Summary Arabic */}
          <p className="text-slate-700 font-bold leading-relaxed">{res.summaryArabic}</p>

          {/* Mistakes list */}
          {res.mistakes && res.mistakes.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-black text-rose-800 block">تصحيح الأخطاء:</span>
              {res.mistakes.map((m, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-rose-50/70 border border-rose-200 p-2 space-y-1"
                >
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

          {/* Improved version + tip */}
          {res.improvedVersion && res.improvedVersion.trim() !== res.correctedText.trim() && (
            <div className="rounded-lg bg-sky-50 border border-sky-200 p-2">
              <span className="text-[11px] font-black text-sky-900 block mb-0.5">
                صياغة ألمانية أكثر طبيعية:
              </span>
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
  const [copiedCode, setCopiedCode] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem("writing_duel_muted") === "true";
    } catch {
      return false;
    }
  });

  // Lobby form state
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomLevel, setNewRoomLevel] = useState<DuelLevel>("B1");
  const [joinCode, setJoinCode] = useState("");

  // Local writing draft for active player
  const [draftInput, setDraftInput] = useState("");

  // Kärtchen creation form
  const [isAddKartchenOpen, setIsAddKartchenOpen] = useState(false);
  const [kartchenGermanInput, setKartchenGermanInput] = useState("");
  const [kartchenArabicInput, setKartchenArabicInput] = useState("");
  const [kartchenTagInput, setKartchenTagInput] = useState("");
  const [stageBgError, setStageBgError] = useState(false);

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

  // Auto-clear error toast
  useEffect(() => {
    if (!errorToast) return;
    const t = window.setTimeout(() => setErrorToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [errorToast]);

  // WebSocket lifecycle + reconnection
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
        ws.send(JSON.stringify({ type: "auth", token: activeToken }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "auth:ok") {
            setWsStatus("connected");
            if (Array.isArray(msg.rooms)) setLobbyRooms(msg.rooms);
            // Re-join room automatically if we were inside one prior to a brief reconnect
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
            setErrorToast(msg.message || "حدث خطأ غير متوقع.");
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

  // Hydrate draftInput only when switching rooms or starting a new round
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

  // Sound cues when opponent submits or AI finishes correction
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
      ...room.kartchen.map((k) => `${k.id}:${k.aiCorrection?.status}:${k.aiCorrection?.requestedAt}`),
    ].join("|");

    if (prevCorrectionSignaturesRef.current && prevCorrectionSignaturesRef.current !== corrSig) {
      const hasDone =
        room.centerCorrections.p1?.status === "done" ||
        room.centerCorrections.p2?.status === "done" ||
        room.kartchen.some((k) => k.aiCorrection?.status === "done");
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

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    sendWs({
      type: "room:create",
      title: newRoomTitle.trim() || undefined,
      level: newRoomLevel,
    });
  };

  const handleJoinRoomByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (!cleaned) return;
    sendWs({ type: "room:join", roomId: cleaned });
  };

  const handleAddKartchen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kartchenGermanInput.trim()) return;
    sendWs({
      type: "kartchen:add",
      germanText: kartchenGermanInput.trim(),
      arabicHint: kartchenArabicInput.trim(),
      tag: kartchenTagInput.trim() || `${room?.level || "B1"} • قصاصة`,
    });
    setKartchenGermanInput("");
    setKartchenArabicInput("");
    setKartchenTagInput("");
    setIsAddKartchenOpen(false);
  };

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard?.writeText(room.id).then(() => {
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    }).catch(() => {});
  };

  const activeKartchen = useMemo(() => {
    if (!room) return null;
    return room.kartchen.find((k) => k.id === room.activeKartchenId) || room.kartchen[0] || null;
  }, [room]);

  const myWordCount = useMemo(() => {
    const t = draftInput.trim();
    return t ? t.split(/\s+/).length : 0;
  }, [draftInput]);

  // Render one half of the split-screen duel
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
            border: "border-slate-900",
            btn: "bg-sky-500 hover:bg-sky-400 text-white",
            label: "اللاعب الأول",
            avatar: "blue" as const,
          }
        : {
            bg: "bg-[#FFF4ED]",
            header: "bg-orange-500 text-white",
            badge: "bg-orange-200 text-slate-950",
            border: "border-slate-900",
            btn: "bg-orange-500 hover:bg-orange-400 text-white",
            label: "اللاعب الثاني",
            avatar: "coral" as const,
          };

    if (!player) {
      return (
        <div
          className={`rounded-2xl border-2 border-dashed border-slate-400 ${theme.bg} p-5 flex flex-col items-center justify-center text-center min-h-[290px]`}
        >
          <CartoonAvatar avatar={theme.avatar} name="؟" sizeClass="w-20 h-20 opacity-65 grayscale-[20%]" />
          <p className="mt-3 text-sm font-black text-slate-800">بانتظار انضمام {theme.label}...</p>
          <p className="mt-1 text-xs font-bold text-slate-500 max-w-[230px]">
            أرسل رمز الغرفة <span className="font-mono font-black text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-300">{room.id}</span> لصديقك ليدخل معك مباشرة
          </p>
        </div>
      );
    }

    return (
      <div
        className={`rounded-2xl border-2 ${theme.border} ${theme.bg} shadow-[0_5px_0_#0f172a] flex flex-col overflow-hidden min-h-[300px]`}
      >
        {/* Cartoon Player Desk Header */}
        <div className={`${theme.header} px-3.5 py-2.5 border-b-2 border-slate-900 flex items-center justify-between gap-2`}>
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
              title={player.connected ? "متصل" : "غير متصل"}
            />
            <span className="px-2 py-0.5 rounded-lg bg-slate-900/20 text-white text-xs font-black tabular-nums flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-amber-200" />
              {player.score}
            </span>
          </div>
        </div>

        {/* Character + Desk Body */}
        <div className="p-3.5 flex-1 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <CartoonAvatar
              avatar={player.avatar}
              isTyping={isMe ? draftInput.trim().length > 0 && myWordCount > 0 : player.isTyping}
              name={player.name}
              sizeClass="w-20 h-20"
            />
            <div className="min-w-0 flex-1 space-y-1">
              {isMe ? (
                <>
                  <p className="text-xs font-black text-slate-900">مساحتك السرية للكتابة ✍️</p>
                  <p className="text-[11px] font-bold text-slate-600">
                    لا يرى منافسك ما تكتبه هنا حتى تضغط على «إرسال للمساحة الوسطى»
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    {player.isTyping ? (
                      <motion.span
                        animate={{ opacity: [0.65, 1, 0.65] }}
                        transition={{ repeat: Infinity, duration: 1.1 }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-300 border-2 border-slate-900 text-xs font-black text-slate-950"
                      >
                        يكتب الآن... ✍️
                      </motion.span>
                    ) : player.hasDraft ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border-2 border-slate-900 text-xs font-black text-slate-800">
                        لديه مسودة جاهزة 📝
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/70 border border-slate-300 text-xs font-bold text-slate-600">
                        {player.submittedText ? "أرسل نصه للمساحة الوسطى ✅" : "ينتظر بدء الكتابة..."}
                      </span>
                    )}
                  </div>
                  {player.hasDraft && (
                    <p className="text-[11px] font-bold text-slate-600">
                      حجم المسودة الحالية: <span className="font-black text-slate-900">{player.draftWordCount}</span> كلمة
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {isMe ? (
            <div className="flex-1 flex flex-col gap-2.5">
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
                placeholder="Schreibe hier deinen deutschen Satz..."
                className="w-full flex-1 min-h-[120px] rounded-xl border-2 border-slate-900 bg-white p-3 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none shadow-inner"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-slate-600">
                  {myWordCount} كلمة • Ctrl+Enter للإرسال
                </span>
                <button
                  type="button"
                  onClick={handleSubmitDraft}
                  disabled={!draftInput.trim()}
                  className={`px-4 py-2 rounded-xl border-2 border-slate-900 font-black text-xs flex items-center gap-1.5 shadow-[0_3px_0_#0f172a] active:shadow-none active:translate-y-[3px] transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${theme.btn}`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال للمساحة الوسطى</span>
                </button>
              </div>
            </div>
          ) : (
            /* Opponent's Hidden Secret Writing Curtain */
            <div className="flex-1 rounded-xl border-2 border-dashed border-slate-800/70 bg-white/80 p-4 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[145px]">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-300 flex items-center justify-center mb-2 shadow-sm">
                <Lock className="w-6 h-6" />
              </div>
              <p className="text-xs font-black text-slate-900">
                كتابة {player.name} محجوبة عنك 🔒
              </p>
              <p className="text-[11px] font-bold text-slate-500 mt-1 max-w-[240px]">
                تظهر كتابته هنا فور إرسالها إلى المساحة المتوسطة
              </p>
              {/* Animated blurred ink lines to feel like hidden cartoon notebook paper */}
              <div className="mt-3 w-full max-w-[200px] space-y-1.5 opacity-45">
                <div className={`h-2 rounded-full bg-slate-400 ${player.isTyping ? "animate-pulse w-full" : "w-3/4 mx-auto"}`} />
                <div className={`h-2 rounded-full bg-slate-300 ${player.isTyping ? "animate-pulse w-5/6" : "w-1/2 mx-auto"}`} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render submitted card in Center Arena ("المساحة المتوسطة")
  const renderCenterSubmissionCard = (slotNum: 1 | 2) => {
    if (!room) return null;
    const player = slotNum === 1 ? room.players.p1 : room.players.p2;
    const correction = slotNum === 1 ? room.centerCorrections.p1 : room.centerCorrections.p2;
    const accent =
      slotNum === 1
        ? "border-sky-700 bg-sky-50/95"
        : "border-orange-700 bg-orange-50/95";
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
              onClick={() =>
                sendWs({
                  type: "duel:correct_ai",
                  targetType: slotNum === 1 ? "p1" : "p2",
                })
              }
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
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 py-4 px-3 text-center text-[11px] font-bold text-slate-500">
            لم يُرسل النص بعد إلى المساحة المتوسطة...
          </div>
        )}

        <AICorrectionPanel correction={correction} compact />
      </div>
    );
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#FAF6ED] text-slate-900 flex flex-col" dir="rtl">
      {/* Top Game Header Bar */}
      <header className="sticky top-0 z-20 bg-[#FFFDF8]/95 backdrop-blur-sm border-b-2 border-slate-900 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-100 cursor-pointer"
            title="القائمة"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="w-9 h-9 rounded-xl bg-amber-400 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] flex items-center justify-center shrink-0">
            <Swords className="w-5 h-5 text-slate-950" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-slate-950 leading-tight truncate">
              تحدي الكتابة
            </h1>
            <p className="text-[11px] font-bold text-slate-500 truncate">
              مبارزة كتابة ألمانية مباشرة مع تصحيح ذكي فوري
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Live WebSocket Status */}
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
              {wsStatus === "connected"
                ? "متصل مباشر"
                : wsStatus === "connecting"
                ? "جاري الاتصال..."
                : "إعادة الاتصال..."}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-100 text-slate-800 cursor-pointer"
            title={muted ? "تفعيل المؤثرات الصوتية" : "كتم المؤثرات الصوتية"}
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
              <span>مغادرة الغرفة</span>
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

      {/* Error Toast */}
      <AnimatePresence>
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mx-auto mt-3 px-4 py-2 rounded-xl border-2 border-slate-900 bg-rose-500 text-white text-xs font-black shadow-[0_3px_0_#0f172a] flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* STATE 1: LOBBY (NO ACTIVE ROOM)                                           */}
      {/* ========================================================================= */}
      {!room ? (
        <div className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto space-y-6">
          {/* Cartoon Game Hero Banner */}
          <div className="relative rounded-3xl border-2 border-slate-900 bg-gradient-to-br from-[#FFF9E8] via-[#FEF3C7]/60 to-[#E0F2FE] p-5 sm:p-6 shadow-[0_6px_0_#0f172a] overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-7 space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-300 border-2 border-slate-900 text-xs font-black text-slate-950">
                  <Swords className="w-4 h-4" />
                  <span>لعبة مبارزة الكتابة الثنائية المباشرة</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-950 leading-snug">
                  تحدَّ صديقك بالكتابة بالألمانية وصحّحا النصوص بالذكاء معاً!
                </h2>
                <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed">
                  الشاشة تنقسم نصفين: يكتب كل لاعب في مساحته السرية دون أن يرى الآخر ما يكتب، ثم تُعرض النصوص في المساحة المتوسطة مع قسم قصاصات <strong>Kärtchen</strong>، ويستطيع أيٌّ منكما طلب التصحيح الفوري ليظهر التحميل والنتيجة عند الطرفين معاً.
                </p>
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 pt-1">
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-900">
                    👤 أنت: {currentUser?.name || "لاعب"}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-900">
                    🔒 كتابة سرية حتى الإرسال
                  </span>
                </div>
              </div>

              <div className="md:col-span-5 flex items-center justify-center gap-3">
                <CartoonAvatar avatar="blue" isTyping name="اللاعب الأول" sizeClass="w-28 h-28 sm:w-32 sm:h-32" />
                <div className="w-10 h-10 rounded-full bg-amber-400 border-2 border-slate-900 flex items-center justify-center font-black text-sm shadow-[0_3px_0_#0f172a] shrink-0">
                  VS
                </div>
                <CartoonAvatar avatar="coral" isTyping name="اللاعب الثاني" sizeClass="w-28 h-28 sm:w-32 sm:h-32" />
              </div>
            </div>
          </div>

          {/* Create or Join Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Create Room */}
            <form
              onSubmit={handleCreateRoom}
              className="rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[0_5px_0_#0f172a] space-y-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500 text-white border-2 border-slate-900 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-950">إنشاء غرفة تحدي جديدة</h3>
                  <p className="text-[11px] font-bold text-slate-500">ستحصل على رمز لمشاركته مع صديقك</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">اسم الغرفة (اختياري)</label>
                  <input
                    type="text"
                    value={newRoomTitle}
                    onChange={(e) => setNewRoomTitle(e.target.value)}
                    placeholder="مثال: تحدي B1 اليومي"
                    className="w-full rounded-xl border-2 border-slate-900 px-3 py-2 text-xs font-bold bg-[#FAF6ED] focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">المستوى الألماني</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["A1", "A2", "B1", "B2"] as DuelLevel[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setNewRoomLevel(lvl)}
                        className={`py-2 rounded-xl border-2 border-slate-900 text-xs font-black cursor-pointer transition-all ${
                          newRoomLevel === lvl
                            ? "bg-amber-400 text-slate-950 shadow-[0_2px_0_#0f172a]"
                            : "bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={wsStatus !== "connected"}
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white border-2 border-slate-900 font-black text-sm shadow-[0_4px_0_#0f172a] active:shadow-none active:translate-y-[4px] transition-all cursor-pointer disabled:opacity-50"
              >
                ابدأ غرفة التحدي 🎮
              </button>
            </form>

            {/* Join Room by Code */}
            <form
              onSubmit={handleJoinRoomByCode}
              className="rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[0_5px_0_#0f172a] flex flex-col justify-between gap-4"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-orange-500 text-white border-2 border-slate-900 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-950">الانضمام برمز غرفة</h3>
                    <p className="text-[11px] font-bold text-slate-500">أدخل الرمز المكون من 6 أحرف وأرقام</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">رمز الغرفة</label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="KRT42B"
                    maxLength={8}
                    dir="ltr"
                    className="w-full rounded-xl border-2 border-slate-900 px-3 py-2.5 text-center font-mono text-base font-black tracking-widest uppercase bg-[#FAF6ED] focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={wsStatus !== "connected" || !joinCode.trim()}
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white border-2 border-slate-900 font-black text-sm shadow-[0_4px_0_#0f172a] active:shadow-none active:translate-y-[4px] transition-all cursor-pointer disabled:opacity-50"
              >
                دخول إلى المنافسة 🚀
              </button>
            </form>
          </div>

          {/* Open Live Rooms List */}
          <div className="rounded-2xl border-2 border-slate-900 bg-white p-4 sm:p-5 shadow-[0_5px_0_#0f172a] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-700" />
                <h3 className="font-black text-sm text-slate-950">الغرف النشطة الآن ({lobbyRooms.length})</h3>
              </div>
              <button
                type="button"
                onClick={() => sendWs({ type: "lobby:list" })}
                className="px-2.5 py-1 rounded-lg border-2 border-slate-900 bg-[#FAF6ED] hover:bg-amber-100 text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تحديث</span>
              </button>
            </div>

            {lobbyRooms.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-300 bg-[#FAF6ED] p-6 text-center text-xs font-bold text-slate-500">
                لا توجد غرف مفتوحة حالياً — أنشئ أول غرفة وادعُ صديقك!
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
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-amber-300 border border-slate-900 font-mono text-[11px] font-black">
                            {r.id}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-400 text-[10px] font-black">
                            {r.level}
                          </span>
                        </div>
                        <p className="font-black text-xs text-slate-900 truncate mt-1">{r.title}</p>
                        <p className="text-[11px] font-bold text-slate-600 truncate">
                          اللاعبون ({r.playerCount}/2): {r.players.map((p) => p.name).join(" • ")}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => sendWs({ type: "room:join", roomId: r.id })}
                        disabled={isFull && !alreadyIn}
                        className="px-3 py-2 rounded-xl border-2 border-slate-900 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs shadow-[0_2px_0_#0f172a] active:shadow-none active:translate-y-[2px] cursor-pointer disabled:opacity-45 shrink-0"
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
        /* STATE 2: ACTIVE SPLIT-SCREEN CARTOON DUEL ARENA                           */
        /* ========================================================================= */
        <div className="flex-1 p-3 sm:p-5 max-w-[1440px] w-full mx-auto space-y-4">
          {/* Compact Top Match HUD Bar */}
          <div className="rounded-2xl border-2 border-slate-900 bg-white p-3 shadow-[0_4px_0_#0f172a] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-300 border-2 border-slate-900">
                <span className="text-[11px] font-black text-slate-800">الرمز:</span>
                <span className="font-mono text-xs font-black text-slate-950 tracking-wider">{room.id}</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-0.5 rounded hover:bg-amber-400 cursor-pointer"
                  title="نسخ رمز الغرفة"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-800" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-white text-xs font-black tabular-nums">
                الجولة {room.round}
              </span>

              <select
                value={room.level}
                onChange={(e) => sendWs({ type: "room:set_level", level: e.target.value })}
                aria-label="المستوى اللغوي"
                className="px-2.5 py-1 rounded-xl border-2 border-slate-900 bg-[#FAF6ED] text-xs font-black cursor-pointer"
              >
                <option value="A1">المستوى A1</option>
                <option value="A2">المستوى A2</option>
                <option value="B1">المستوى B1</option>
                <option value="B2">المستوى B2</option>
              </select>
            </div>

            {/* Active Kärtchen Prompt Quick Banner */}
            {activeKartchen && (
              <div className="flex-1 min-w-[220px] max-w-xl rounded-xl border-2 border-amber-700 bg-[#FFFDF0] px-3 py-1.5 flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-amber-700 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-900 truncate" dir="ltr">
                    {activeKartchen.germanText}
                  </p>
                  {activeKartchen.arabicHint && (
                    <p className="text-[10px] font-bold text-slate-500 truncate">{activeKartchen.arabicHint}</p>
                  )}
                </div>
              </div>
            )}

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

          {/* SPLIT SCREEN: PLAYER 1 HALF + CENTRAL STAGE + PLAYER 2 HALF */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Half 1: Player 1 */}
            <div className="lg:col-span-4 flex flex-col">{renderPlayerHalf(1)}</div>

            {/* Central Middle Arena ("المساحة المتوسطة") */}
            <div className="lg:col-span-4 rounded-2xl border-2 border-slate-900 shadow-[0_5px_0_#0f172a] overflow-hidden relative flex flex-col bg-[#F7EEDB]">
              {/* Subtle Cartoon Wooden Duel Desk Backdrop */}
              {!stageBgError && (
                <img
                  src={duelArenaStageImg}
                  alt=""
                  onError={() => setStageBgError(true)}
                  className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none select-none"
                />
              )}

              <div className="relative z-10 bg-amber-400/95 px-3.5 py-2.5 border-b-2 border-slate-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-slate-950" />
                  <h2 className="text-sm font-black text-slate-950">المساحة المتوسطة (عرض النصوص)</h2>
                </div>
                <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-900 text-[10px] font-black text-slate-900">
                  مباشر للطرفين
                </span>
              </div>

              <div className="relative z-10 p-3.5 space-y-3 flex-1 flex flex-col justify-start">
                <p className="text-[11px] font-extrabold text-slate-700 text-center bg-white/85 rounded-lg py-1 px-2 border border-amber-700/30">
                  يظهر هنا ما يرسله كل لاعب — يمكن لأيٍّ منكما الضغط على «صحح بالذكاء» لتظهر النتيجة لكليكما مباشرة
                </p>

                {renderCenterSubmissionCard(1)}
                {renderCenterSubmissionCard(2)}
              </div>
            </div>

            {/* Half 2: Player 2 */}
            <div className="lg:col-span-4 flex flex-col">{renderPlayerHalf(2)}</div>
          </div>

          {/* ========================================================================= */}
          {/* KÄRTCHEN ("قصاصات ألمانية") SECTION                                        */}
          {/* ========================================================================= */}
          <section className="rounded-2xl border-2 border-slate-900 bg-white shadow-[0_5px_0_#0f172a] overflow-hidden">
            <div className="px-4 py-3 bg-[#FFF8DC] border-b-2 border-slate-900 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400 border-2 border-slate-900 flex items-center justify-center shrink-0">
                  <StickyNote className="w-4 h-4 text-slate-950" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-950">
                    قسم Kärtchen (قصاصات ألمانية)
                  </h2>
                  <p className="text-[11px] font-bold text-slate-600">
                    اختر قصاصة للتحدي، أو أضف قصاصة جديدة، أو اطلب تصحيح أي قصاصة بالذكاء للطرفين مباشرة
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => sendWs({ type: "kartchen:generate_ai" })}
                  disabled={room.isGeneratingKartchen}
                  className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white border-2 border-slate-900 text-xs font-black flex items-center gap-1.5 shadow-[0_2px_0_#0f172a] active:shadow-none active:translate-y-[2px] cursor-pointer disabled:opacity-60"
                >
                  {room.isGeneratingKartchen ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {room.isGeneratingKartchen
                      ? `جاري توليد قصاصة (${room.kartchenGenRequestedBy || "..."})...`
                      : "توليد قصاصة بالذكاء"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddKartchenOpen((v) => !v)}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 text-xs font-black flex items-center gap-1 shadow-[0_2px_0_#0f172a] active:shadow-none active:translate-y-[2px] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة Kärtchen</span>
                </button>
              </div>
            </div>

            {/* Add Custom Kärtchen Drawer */}
            <AnimatePresence>
              {isAddKartchenOpen && (
                <motion.form
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleAddKartchen}
                  className="overflow-hidden border-b-2 border-slate-900 bg-[#FAF6ED]"
                >
                  <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-5">
                      <label className="block text-xs font-black text-slate-800 mb-1">
                        نص القصاصة بالألمانية (Kärtchen)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        required
                        value={kartchenGermanInput}
                        onChange={(e) => setKartchenGermanInput(e.target.value)}
                        placeholder="z.B.: Ich habe gestern einen Film gesehen..."
                        className="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-xs font-black text-slate-800 mb-1">
                        تلميح أو معنى بالعربية (اختياري)
                      </label>
                      <input
                        type="text"
                        value={kartchenArabicInput}
                        onChange={(e) => setKartchenArabicInput(e.target.value)}
                        placeholder="شاهدت فيلماً بالأمس..."
                        className="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div className="md:col-span-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={kartchenTagInput}
                        onChange={(e) => setKartchenTagInput(e.target.value)}
                        placeholder="التصنيف"
                        className="w-full rounded-xl border-2 border-slate-900 bg-white px-2.5 py-2 text-xs font-bold focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-2 border-slate-900 text-xs font-black shrink-0 cursor-pointer"
                      >
                        حفظ
                      </button>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Kärtchen Cards Grid */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-[#FAF6ED]/50">
              {room.kartchen.map((k) => {
                const isActive = room.activeKartchenId === k.id;
                return (
                  <div
                    key={k.id}
                    className={`rounded-2xl border-2 p-3.5 transition-all flex flex-col justify-between ${
                      isActive
                        ? "border-slate-900 bg-[#FFFDF0] shadow-[0_4px_0_#d97706] ring-2 ring-amber-300"
                        : "border-slate-900 bg-white shadow-[0_3px_0_#0f172a]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-amber-200 border border-slate-900 text-[10px] font-black text-slate-950">
                            {k.tag}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            بواسطة: {k.authorName}
                          </span>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-300 border border-slate-900 text-[10px] font-black text-slate-950">
                              مفعّلة الآن
                            </span>
                          )}
                        </div>

                        {room.kartchen.length > 1 && (
                          <button
                            type="button"
                            onClick={() => sendWs({ type: "kartchen:delete", kartchenId: k.id })}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="حذف القصاصة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <p className="text-sm font-bold text-slate-950 leading-relaxed mb-1.5" dir="ltr">
                        {k.germanText}
                      </p>
                      {k.arabicHint && (
                        <p className="text-xs font-semibold text-slate-600 mb-3">{k.arabicHint}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => sendWs({ type: "kartchen:select", kartchenId: k.id })}
                            className="px-3 py-1.5 rounded-xl border-2 border-slate-900 bg-[#FAF6ED] hover:bg-amber-200 text-xs font-black text-slate-900 cursor-pointer"
                          >
                            اعتماد للتحدي 🎯
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            sendWs({
                              type: "duel:correct_ai",
                              targetType: "kartchen",
                              targetId: k.id,
                            })
                          }
                          disabled={k.aiCorrection?.status === "loading"}
                          className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white border-2 border-slate-900 text-xs font-black flex items-center gap-1.5 shadow-[0_2px_0_#0f172a] active:shadow-none active:translate-y-[2px] cursor-pointer disabled:opacity-55"
                        >
                          {k.aiCorrection?.status === "loading" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          <span>صحح القصاصة بالذكاء</span>
                        </button>
                      </div>

                      <AICorrectionPanel correction={k.aiCorrection} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

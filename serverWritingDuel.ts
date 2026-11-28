import type express from "express";
import type http from "http";
import type https from "https";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, Type } from "@google/genai";
import { verifySessionToken, type UserSession } from "./serverAuth";

export type DuelLevel = "A1" | "A2" | "B1" | "B2";

export interface DuelMistake {
  original: string;
  correction: string;
  explanationArabic: string;
}

export interface DuelAICorrectionResult {
  correctedText: string;
  isCorrect: boolean;
  score: number;
  summaryArabic: string;
  mistakes: DuelMistake[];
  improvedVersion: string;
  tipArabic: string;
}

export interface DuelAICorrectionState {
  status: "idle" | "loading" | "done" | "error";
  targetType: "p1" | "p2" | "kartchen";
  targetId: string;
  requestedByName: string;
  requestedAt: string;
  errorMessage?: string;
  result?: DuelAICorrectionResult;
}

export interface KartchenItem {
  id: string;
  germanText: string;
  arabicHint: string;
  tag: string;
  authorName: string;
  createdAt: string;
  aiCorrection: DuelAICorrectionState | null;
}

export interface DuelPlayerPublic {
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

interface InternalWritingDuelRoom {
  id: string;
  title: string;
  level: DuelLevel;
  round: number;
  createdAt: string;
  updatedAt: string;
  players: {
    p1: DuelPlayerPublic | null;
    p2: DuelPlayerPublic | null;
  };
  // Strictly server-only drafts — never serialized to the opponent
  secretDrafts: {
    p1: string;
    p2: string;
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

export interface PublicRoomSummary {
  id: string;
  title: string;
  level: DuelLevel;
  round: number;
  playerCount: number;
  players: Array<{ slot: 1 | 2; name: string; connected: boolean; avatar: "blue" | "coral" }>;
  createdAt: string;
}

export interface SerializedRoomForViewer {
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

interface AuthedSocket {
  ws: WebSocket;
  user: UserSession | null;
  roomId: string | null;
  isAlive: boolean;
}

const DEFAULT_KARTCHEN_SEEDS: Array<{ germanText: string; arabicHint: string; tag: string }> = [
  {
    germanText: "Stell dir vor, du triffst heute einen alten Freund im Café. Schreibe 2–3 Sätze über euer Gespräch.",
    arabicHint: "تخيّل أنك التقيت بصديق قديم في مقهى اليوم. اكتب جملتين أو ثلاثاً عن حديثكما.",
    tag: "B1 • Alltag",
  },
  {
    germanText: "Warum lernst du Deutsch und welches Ziel möchtest du dieses Jahr erreichen?",
    arabicHint: "لماذا تتعلم الألمانية وما الهدف الذي تريد تحقيقه هذا العام؟",
    tag: "قصاصة تعبير",
  },
  {
    germanText: "Beschreibe deinen perfekten Sonntagmorgen mit mindestens einem Nebensatz (weil / obwohl / wenn).",
    arabicHint: "صف صباح يوم أحد مثالي بالنسبة لك مع استخدام جملة جانبية واحدة على الأقل.",
    tag: "B1 • Grammatik",
  },
  {
    germanText: "Ich gehe heute in den Supermarkt, weil ich frisches Brot und Käse kaufen möchte.",
    arabicHint: "مثال قصاصة جاهزة للتجربة أو التصحيح: أذهب اليوم إلى السوبرماركت...",
    tag: "Kärtchen مثال",
  },
];

const rooms = new Map<string, InternalWritingDuelRoom>();
const socketsByWs = new Map<WebSocket, AuthedSocket>();
const typingTimers = new Map<string, NodeJS.Timeout>();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return "D" + crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function createRoom(creator: UserSession, titleInput?: string, levelInput?: string): InternalWritingDuelRoom {
  const nowIso = new Date().toISOString();
  const id = generateRoomCode();
  const validLevels: DuelLevel[] = ["A1", "A2", "B1", "B2"];
  const level: DuelLevel = validLevels.includes(levelInput as DuelLevel) ? (levelInput as DuelLevel) : "B1";
  const cleanTitle = (typeof titleInput === "string" ? titleInput.trim().slice(0, 60) : "") || `مبارزة ${creator.name}`;

  const starterKartchen: KartchenItem[] = DEFAULT_KARTCHEN_SEEDS.map((seed, idx) => ({
    id: `krt_${Date.now()}_${idx}_${crypto.randomBytes(2).toString("hex")}`,
    germanText: seed.germanText,
    arabicHint: seed.arabicHint,
    tag: seed.tag,
    authorName: "النظام",
    createdAt: nowIso,
    aiCorrection: null,
  }));

  const room: InternalWritingDuelRoom = {
    id,
    title: cleanTitle,
    level,
    round: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
    players: {
      p1: {
        slot: 1,
        userId: creator.userId,
        name: creator.name,
        avatar: "blue",
        connected: false,
        isTyping: false,
        hasDraft: false,
        draftWordCount: 0,
        submittedText: null,
        submittedAt: null,
        score: 0,
        scoredThisRound: false,
      },
      p2: null,
    },
    secretDrafts: { p1: "", p2: "" },
    kartchen: starterKartchen,
    activeKartchenId: starterKartchen[0]?.id || null,
    isGeneratingKartchen: false,
    kartchenGenRequestedBy: null,
    centerCorrections: { p1: null, p2: null },
  };

  rooms.set(id, room);
  return room;
}

function getPlayerSlot(room: InternalWritingDuelRoom, userId: string): 1 | 2 | null {
  if (room.players.p1?.userId === userId) return 1;
  if (room.players.p2?.userId === userId) return 2;
  return null;
}

function serializeRoomForViewer(room: InternalWritingDuelRoom, viewerUserId: string): SerializedRoomForViewer {
  const mySlot = getPlayerSlot(room, viewerUserId);
  const myDraft = mySlot === 1 ? room.secretDrafts.p1 : mySlot === 2 ? room.secretDrafts.p2 : "";
  return {
    id: room.id,
    title: room.title,
    level: room.level,
    round: room.round,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    mySlot,
    myDraft,
    players: {
      p1: room.players.p1 ? { ...room.players.p1 } : null,
      p2: room.players.p2 ? { ...room.players.p2 } : null,
    },
    kartchen: room.kartchen.map((k) => ({ ...k })),
    activeKartchenId: room.activeKartchenId,
    isGeneratingKartchen: room.isGeneratingKartchen,
    kartchenGenRequestedBy: room.kartchenGenRequestedBy,
    centerCorrections: {
      p1: room.centerCorrections.p1 ? { ...room.centerCorrections.p1 } : null,
      p2: room.centerCorrections.p2 ? { ...room.centerCorrections.p2 } : null,
    },
  };
}

function listOpenRooms(): PublicRoomSummary[] {
  const now = Date.now();
  const maxAgeMs = 3 * 60 * 60 * 1000;
  const list: PublicRoomSummary[] = [];

  for (const [id, room] of rooms.entries()) {
    const updatedMs = new Date(room.updatedAt).getTime();
    if (Number.isFinite(updatedMs) && now - updatedMs > maxAgeMs) {
      rooms.delete(id);
      continue;
    }
    const playersList: PublicRoomSummary["players"] = [];
    if (room.players.p1) {
      playersList.push({
        slot: 1,
        name: room.players.p1.name,
        connected: room.players.p1.connected,
        avatar: room.players.p1.avatar,
      });
    }
    if (room.players.p2) {
      playersList.push({
        slot: 2,
        name: room.players.p2.name,
        connected: room.players.p2.connected,
        avatar: room.players.p2.avatar,
      });
    }
    list.push({
      id: room.id,
      title: room.title,
      level: room.level,
      round: room.round,
      playerCount: playersList.length,
      players: playersList,
      createdAt: room.createdAt,
    });
  }

  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {}
  }
}

function broadcastRoom(room: InternalWritingDuelRoom) {
  room.updatedAt = new Date().toISOString();
  for (const client of socketsByWs.values()) {
    if (client.user && client.roomId === room.id) {
      sendJson(client.ws, {
        type: "room:state",
        room: serializeRoomForViewer(room, client.user.userId),
      });
    }
  }
}

function broadcastLobby() {
  const summaries = listOpenRooms();
  for (const client of socketsByWs.values()) {
    if (client.user && !client.roomId) {
      sendJson(client.ws, {
        type: "lobby:rooms",
        rooms: summaries,
      });
    }
  }
}

function syncPlayerConnectivity(room: InternalWritingDuelRoom) {
  let p1Connected = false;
  let p2Connected = false;
  for (const client of socketsByWs.values()) {
    if (!client.user || client.roomId !== room.id || client.ws.readyState !== WebSocket.OPEN) continue;
    if (room.players.p1?.userId === client.user.userId) p1Connected = true;
    if (room.players.p2?.userId === client.user.userId) p2Connected = true;
  }
  if (room.players.p1) {
    room.players.p1.connected = p1Connected;
    if (!p1Connected) room.players.p1.isTyping = false;
  }
  if (room.players.p2) {
    room.players.p2.connected = p2Connected;
    if (!p2Connected) room.players.p2.isTyping = false;
  }
}

async function runGeminiCorrection(
  germanText: string,
  level: DuelLevel,
  promptContext?: string
): Promise<DuelAICorrectionResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || "";
  if (!apiKey) {
    throw new Error("مفتاح GEMINI_API_KEY غير مهيأ على الخادم.");
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const prompt = [
    `أنت مدرس لغة ألمانية خبير وودود تشرف على لعبة "تحدي الكتابة" لمستوى (${level}).`,
    promptContext ? `سياق القصاصة (Kärtchen) المطلوبة: "${promptContext}"` : "",
    `النص الألماني المراد تصحيحه ومراجعته:`,
    `"""${germanText}"""`,
    ``,
    `المطلوب إرجاع JSON دقيق يحتوي على:`,
    `- correctedText: النص الألماني بعد التصحيح الكامل (إن كان صحيحاً تماماً أعده كما هو مع تصحيح علامات الترقيم إن لزم).`,
    `- isCorrect: true إذا كان النص خالياً من الأخطاء النحوية والإملائية المهمة، وإلا false.`,
    `- score: درجة من 0 إلى 100 تعكس جودة الكتابة والدقة النحوية.`,
    `- summaryArabic: ملخص تشجيعي وواضح بالعربية يشرح تقييم النص (جملة إلى جملتين).`,
    `- mistakes: مصفوفة بالأخطاء الفعلية إن وجدت (original, correction, explanationArabic). إذا كان النص صحيحاً اتركها فارغة [].`,
    `- improvedVersion: صياغة ألمانية أجمل وأكثر طبيعية بنفس المعنى مناسبة لمستوى ${level}.`,
    `- tipArabic: نصيحة لغوية سريعة ومفيدة بالعربية حول القاعدة الأهم في هذا النص.`,
  ]
    .filter(Boolean)
    .join("\n");

  const candidateModels = ["gemini-4-hydrogen", "gemini-3.6-flash", "gemini-2.5-flash"];
  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              correctedText: { type: Type.STRING },
              isCorrect: { type: Type.BOOLEAN },
              score: { type: Type.NUMBER },
              summaryArabic: { type: Type.STRING },
              mistakes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    original: { type: Type.STRING },
                    correction: { type: Type.STRING },
                    explanationArabic: { type: Type.STRING },
                  },
                  required: ["original", "correction", "explanationArabic"],
                },
              },
              improvedVersion: { type: Type.STRING },
              tipArabic: { type: Type.STRING },
            },
            required: ["correctedText", "isCorrect", "score", "summaryArabic", "mistakes", "improvedVersion", "tipArabic"],
          },
        },
      });

      const rawText = (response.text || "").trim();
      const parsed = JSON.parse(rawText);
      const safeScore = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
      return {
        correctedText: String(parsed.correctedText || germanText),
        isCorrect: Boolean(parsed.isCorrect),
        score: safeScore,
        summaryArabic: String(parsed.summaryArabic || "تمت مراجعة النص بنجاح."),
        mistakes: Array.isArray(parsed.mistakes)
          ? parsed.mistakes.slice(0, 10).map((m: any) => ({
              original: String(m?.original || ""),
              correction: String(m?.correction || ""),
              explanationArabic: String(m?.explanationArabic || ""),
            }))
          : [],
        improvedVersion: String(parsed.improvedVersion || parsed.correctedText || germanText),
        tipArabic: String(parsed.tipArabic || "استمر بالممارسة اليومية للكتابة بالألمانية!"),
      };
    } catch (err: any) {
      lastError = err;
      const msg = (err?.message || String(err || "")).toLowerCase();
      const isModelUnavailable =
        msg.includes("404") ||
        msg.includes("not found") ||
        msg.includes("not_found") ||
        msg.includes("not supported") ||
        msg.includes("deprecated");
      if (!isModelUnavailable) {
        throw err;
      }
    }
  }

  throw lastError || new Error("تعذر الوصول إلى خدمة التصحيح الذكي.");
}

async function runGeminiKartchenGenerator(level: DuelLevel): Promise<{ germanText: string; arabicHint: string; tag: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || "";
  if (!apiKey) {
    throw new Error("مفتاح GEMINI_API_KEY غير مهيأ على الخادم.");
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const prompt = `أنشئ قصاصة كتابة ألمانية جديدة (Kärtchen) ممتعة ومناسبة لمستوى ${level} للعبة تحدي كتابة ثنائية.
يمكن أن تكون القصاصة سؤالاً تحفيزياً أو موقفاً حياتياً في ألمانيا أو جملة بداية يكملها اللاعبان في جملتين إلى ثلاث جمل.
أرجع JSON فقط فيه:
- germanText: نص القصاصة بالألمانية (مختصر وواضح 1-2 جملة).
- arabicHint: شرح أو ترجمة مساعدة مختصرة بالعربية.
- tag: تصنيف قصير مثل "${level} • Alltag" أو "${level} • Beruf" أو "${level} • Reise".`;

  const candidateModels = ["gemini-4-hydrogen", "gemini-3.6-flash", "gemini-2.5-flash"];
  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              germanText: { type: Type.STRING },
              arabicHint: { type: Type.STRING },
              tag: { type: Type.STRING },
            },
            required: ["germanText", "arabicHint", "tag"],
          },
        },
      });
      const parsed = JSON.parse((response.text || "").trim());
      return {
        germanText: String(parsed.germanText || "Schreibe drei Sätze über deinen Lieblingstag in der Woche.").slice(0, 400),
        arabicHint: String(parsed.arabicHint || "اكتب ثلاث جمل عن يومك المفضل في الأسبوع.").slice(0, 300),
        tag: String(parsed.tag || `${level} • Kärtchen`).slice(0, 40),
      };
    } catch (err: any) {
      lastError = err;
      const msg = (err?.message || String(err || "")).toLowerCase();
      const isModelUnavailable =
        msg.includes("404") ||
        msg.includes("not found") ||
        msg.includes("not_found") ||
        msg.includes("not supported") ||
        msg.includes("deprecated");
      if (!isModelUnavailable) {
        throw err;
      }
    }
  }

  throw lastError || new Error("تعذر توليد القصاصة الذكية.");
}

async function handleRoomAICorrection(
  room: InternalWritingDuelRoom,
  requester: UserSession,
  targetType: "p1" | "p2" | "kartchen",
  targetId?: string
) {
  let textToCorrect = "";
  let currentState: DuelAICorrectionState | null = null;
  let kartchenRef: KartchenItem | undefined;

  if (targetType === "p1" || targetType === "p2") {
    const player = room.players[targetType];
    if (!player || !player.submittedText || !player.submittedText.trim()) {
      return;
    }
    currentState = room.centerCorrections[targetType];
    if (currentState?.status === "loading") return;
    textToCorrect = player.submittedText.trim();
  } else if (targetType === "kartchen" && targetId) {
    kartchenRef = room.kartchen.find((k) => k.id === targetId);
    if (!kartchenRef || !kartchenRef.germanText.trim()) return;
    if (kartchenRef.aiCorrection?.status === "loading") return;
    textToCorrect = kartchenRef.germanText.trim();
  } else {
    return;
  }

  const loadingState: DuelAICorrectionState = {
    status: "loading",
    targetType,
    targetId: targetId || targetType,
    requestedByName: requester.name,
    requestedAt: new Date().toISOString(),
  };

  if (targetType === "p1" || targetType === "p2") {
    room.centerCorrections[targetType] = loadingState;
  } else if (kartchenRef) {
    kartchenRef.aiCorrection = loadingState;
  }

  // Immediately inform BOTH players so the live loading indicator appears simultaneously
  broadcastRoom(room);

  const activeKartchen = room.kartchen.find((k) => k.id === room.activeKartchenId);
  const promptContext = targetType === "kartchen" ? undefined : activeKartchen?.germanText;

  try {
    const result = await runGeminiCorrection(textToCorrect, room.level, promptContext);
    const doneState: DuelAICorrectionState = {
      status: "done",
      targetType,
      targetId: targetId || targetType,
      requestedByName: requester.name,
      requestedAt: new Date().toISOString(),
      result,
    };

    if (targetType === "p1" || targetType === "p2") {
      room.centerCorrections[targetType] = doneState;
      const targetPlayer = room.players[targetType];
      if (targetPlayer && !targetPlayer.scoredThisRound) {
        const bonus = result.isCorrect ? 15 : Math.max(5, Math.round(result.score / 10));
        targetPlayer.score += bonus;
        targetPlayer.scoredThisRound = true;
      }
    } else if (kartchenRef) {
      kartchenRef.aiCorrection = doneState;
    }

    broadcastRoom(room);
  } catch (err: any) {
    const errState: DuelAICorrectionState = {
      status: "error",
      targetType,
      targetId: targetId || targetType,
      requestedByName: requester.name,
      requestedAt: new Date().toISOString(),
      errorMessage: err?.message || "تعذر الاتصال بالمساعد الذكي أثناء التصحيح.",
    };
    if (targetType === "p1" || targetType === "p2") {
      room.centerCorrections[targetType] = errState;
    } else if (kartchenRef) {
      kartchenRef.aiCorrection = errState;
    }
    broadcastRoom(room);
  }
}

export function registerWritingDuelRoutes(app: express.Express) {
  // REST Endpoints for listing/creating rooms (authenticated via serverAuth)
  app.get("/api/writing-duel/rooms", (req: any, res: any) => {
    if (!req.user) return res.status(401).json({ error: "غير مصرح لك." });
    res.json({ rooms: listOpenRooms() });
  });

  app.post("/api/writing-duel/rooms", (req: any, res: any) => {
    if (!req.user) return res.status(401).json({ error: "غير مصرح لك." });
    const { title, level } = req.body || {};
    const room = createRoom(req.user, title, level);
    broadcastLobby();
    res.json({
      room: serializeRoomForViewer(room, req.user.userId),
    });
  });
}

export function attachWritingDuelWebSocket(
  httpServer: http.Server,
  httpsServer?: https.Server | null
) {

  const wss = new WebSocketServer({ noServer: true });

  const handleUpgrade = (req: http.IncomingMessage, socket: any, head: Buffer) => {
    try {
      const host = req.headers.host || "localhost";
      const parsed = new URL(req.url || "/", `http://${host}`);
      if (parsed.pathname !== "/ws/writing-duel") {
        // Leave all other paths (e.g. Vite HMR) completely untouched
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } catch {}
  };

  httpServer.on("upgrade", handleUpgrade);
  if (httpsServer) {
    httpsServer.on("upgrade", handleUpgrade);
  }

  // Heartbeat to prune dead sockets
  const heartbeatInterval = setInterval(() => {
    for (const [ws, client] of socketsByWs.entries()) {
      if (!client.isAlive) {
        ws.terminate();
        continue;
      }
      client.isAlive = false;
      try {
        ws.ping();
      } catch {}
    }
  }, 25000);
  heartbeatInterval.unref?.();

  wss.on("connection", (ws: WebSocket) => {
    const clientState: AuthedSocket = {
      ws,
      user: null,
      roomId: null,
      isAlive: true,
    };
    socketsByWs.set(ws, clientState);

    ws.on("pong", () => {
      clientState.isAlive = true;
    });

    ws.on("message", async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString("utf-8"));
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      // 1. Authentication handshake
      if (msg.type === "auth") {
        const session = verifySessionToken(msg.token);
        if (!session) {
          sendJson(ws, { type: "error", code: "UNAUTHORIZED", message: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول من جديد." });
          ws.close(4001, "Unauthorized");
          return;
        }
        clientState.user = session;
        sendJson(ws, {
          type: "auth:ok",
          user: { id: session.userId, name: session.name, username: session.username },
          rooms: listOpenRooms(),
        });
        return;
      }

      if (!clientState.user) {
        sendJson(ws, { type: "error", code: "UNAUTHENTICATED", message: "يرجى المصادقة أولاً." });
        return;
      }

      const user = clientState.user;

      // 2. Lobby list request
      if (msg.type === "lobby:list") {
        sendJson(ws, { type: "lobby:rooms", rooms: listOpenRooms() });
        return;
      }

      // 3. Create room
      if (msg.type === "room:create") {
        // Leave previous room cleanly if any
        if (clientState.roomId && rooms.has(clientState.roomId)) {
          const prev = rooms.get(clientState.roomId)!;
          clientState.roomId = null;
          syncPlayerConnectivity(prev);
          broadcastRoom(prev);
        }
        const room = createRoom(user, msg.title, msg.level);
        clientState.roomId = room.id;
        syncPlayerConnectivity(room);
        broadcastRoom(room);
        broadcastLobby();
        return;
      }

      // 4. Join room by code
      if (msg.type === "room:join") {
        const roomId = String(msg.roomId || "").trim().toUpperCase();
        const room = rooms.get(roomId);
        if (!room) {
          sendJson(ws, { type: "error", code: "ROOM_NOT_FOUND", message: `الغرفة (${roomId}) غير موجودة أو انتهت.` });
          return;
        }

        let slot = getPlayerSlot(room, user.userId);
        if (!slot) {
          if (!room.players.p1) {
            room.players.p1 = {
              slot: 1,
              userId: user.userId,
              name: user.name,
              avatar: "blue",
              connected: true,
              isTyping: false,
              hasDraft: false,
              draftWordCount: 0,
              submittedText: null,
              submittedAt: null,
              score: 0,
              scoredThisRound: false,
            };
            slot = 1;
          } else if (!room.players.p2) {
            room.players.p2 = {
              slot: 2,
              userId: user.userId,
              name: user.name,
              avatar: "coral",
              connected: true,
              isTyping: false,
              hasDraft: false,
              draftWordCount: 0,
              submittedText: null,
              submittedAt: null,
              score: 0,
              scoredThisRound: false,
            };
            slot = 2;
          } else {
            sendJson(ws, { type: "error", code: "ROOM_FULL", message: "هذه الغرفة مكتملة بالفعل (لاعبان متصلان)." });
            return;
          }
        }

        if (clientState.roomId && clientState.roomId !== room.id && rooms.has(clientState.roomId)) {
          const prev = rooms.get(clientState.roomId)!;
          clientState.roomId = null;
          syncPlayerConnectivity(prev);
          broadcastRoom(prev);
        }

        clientState.roomId = room.id;
        syncPlayerConnectivity(room);
        broadcastRoom(room);
        broadcastLobby();
        return;
      }

      // 5. Leave current room
      if (msg.type === "room:leave") {
        if (clientState.roomId && rooms.has(clientState.roomId)) {
          const prev = rooms.get(clientState.roomId)!;
          clientState.roomId = null;
          syncPlayerConnectivity(prev);
          broadcastRoom(prev);
          broadcastLobby();
        } else {
          clientState.roomId = null;
        }
        sendJson(ws, { type: "lobby:rooms", rooms: listOpenRooms() });
        return;
      }

      // All actions below require being inside an active room
      if (!clientState.roomId || !rooms.has(clientState.roomId)) {
        sendJson(ws, { type: "error", code: "NO_ROOM", message: "لست منضماً إلى غرفة نشطة حالياً." });
        return;
      }

      const room = rooms.get(clientState.roomId)!;
      const slot = getPlayerSlot(room, user.userId);
      if (!slot) {
        sendJson(ws, { type: "error", code: "NOT_PLAYER", message: "أنت غير مسجل كلاعب في هذه الغرفة." });
        return;
      }

      const slotKey = slot === 1 ? "p1" : "p2";
      const playerObj = room.players[slotKey];
      if (!playerObj) return;

      // 6. Live hidden typing draft update
      // IMPORTANT: Never broadcast the draft characters to the opponent! Only typing presence & word count.
      if (msg.type === "duel:typing") {
        const draft = typeof msg.draftText === "string" ? msg.draftText.slice(0, 2000) : "";
        room.secretDrafts[slotKey] = draft;
        playerObj.hasDraft = draft.trim().length > 0;
        playerObj.draftWordCount = countWords(draft);
        playerObj.isTyping = Boolean(msg.isTyping) && draft.length > 0;

        const timerKey = `${room.id}:${slotKey}`;
        const existingTimer = typingTimers.get(timerKey);
        if (existingTimer) clearTimeout(existingTimer);

        if (playerObj.isTyping) {
          const timeout = setTimeout(() => {
            typingTimers.delete(timerKey);
            const currentRoom = rooms.get(room.id);
            const currentPlayer = currentRoom?.players[slotKey];
            if (currentRoom && currentPlayer && currentPlayer.isTyping) {
              currentPlayer.isTyping = false;
              broadcastRoom(currentRoom);
            }
          }, 3500);
          typingTimers.set(timerKey, timeout);
        }

        // Send updated room state (opponent receives ONLY isTyping/hasDraft/draftWordCount, NEVER draftText!)
        broadcastRoom(room);
        return;
      }

      // 7. Submit text to the central stage ("المساحة المتوسطة")
      if (msg.type === "duel:submit") {
        const submitted = typeof msg.text === "string" ? msg.text.trim().slice(0, 2000) : room.secretDrafts[slotKey].trim();
        if (!submitted) return;

        playerObj.submittedText = submitted;
        playerObj.submittedAt = new Date().toISOString();
        playerObj.isTyping = false;
        playerObj.hasDraft = false;
        playerObj.draftWordCount = 0;
        playerObj.scoredThisRound = false;
        room.secretDrafts[slotKey] = "";
        room.centerCorrections[slotKey] = null;

        const timerKey = `${room.id}:${slotKey}`;
        const existingTimer = typingTimers.get(timerKey);
        if (existingTimer) {
          clearTimeout(existingTimer);
          typingTimers.delete(timerKey);
        }

        broadcastRoom(room);
        return;
      }

      // 8. Clear own submitted text or start a fresh round
      if (msg.type === "duel:next_round") {
        room.round += 1;
        room.secretDrafts.p1 = "";
        room.secretDrafts.p2 = "";
        if (room.players.p1) {
          room.players.p1.submittedText = null;
          room.players.p1.submittedAt = null;
          room.players.p1.isTyping = false;
          room.players.p1.hasDraft = false;
          room.players.p1.draftWordCount = 0;
          room.players.p1.scoredThisRound = false;
        }
        if (room.players.p2) {
          room.players.p2.submittedText = null;
          room.players.p2.submittedAt = null;
          room.players.p2.isTyping = false;
          room.players.p2.hasDraft = false;
          room.players.p2.draftWordCount = 0;
          room.players.p2.scoredThisRound = false;
        }
        room.centerCorrections = { p1: null, p2: null };

        // Advance active Kärtchen cleanly if multiple exist
        if (room.kartchen.length > 1) {
          const curIdx = room.kartchen.findIndex((k) => k.id === room.activeKartchenId);
          const nextIdx = (curIdx + 1) % room.kartchen.length;
          room.activeKartchenId = room.kartchen[nextIdx].id;
        }

        broadcastRoom(room);
        broadcastLobby();
        return;
      }

      // 9. Change room level
      if (msg.type === "room:set_level") {
        const validLevels: DuelLevel[] = ["A1", "A2", "B1", "B2"];
        if (validLevels.includes(msg.level)) {
          room.level = msg.level;
          broadcastRoom(room);
          broadcastLobby();
        }
        return;
      }

      // 10. Trigger live AI correction (either player can correct player 1, player 2, or any Kärtchen!)
      if (msg.type === "duel:correct_ai") {
        const targetType = msg.targetType;
        const targetId = typeof msg.targetId === "string" ? msg.targetId : undefined;
        if (targetType === "p1" || targetType === "p2" || targetType === "kartchen") {
          void handleRoomAICorrection(room, user, targetType, targetId);
        }
        return;
      }

      // 11. Kärtchen ("قصاصة") actions
      if (msg.type === "kartchen:select") {
        const kId = String(msg.kartchenId || "");
        if (room.kartchen.some((k) => k.id === kId)) {
          room.activeKartchenId = kId;
          broadcastRoom(room);
        }
        return;
      }

      if (msg.type === "kartchen:add") {
        const germanText = typeof msg.germanText === "string" ? msg.germanText.trim().slice(0, 500) : "";
        const arabicHint = typeof msg.arabicHint === "string" ? msg.arabicHint.trim().slice(0, 300) : "";
        const tag = typeof msg.tag === "string" && msg.tag.trim() ? msg.tag.trim().slice(0, 40) : "Kärtchen جديدة";
        if (!germanText) return;

        const newCard: KartchenItem = {
          id: `krt_${Date.now()}_${crypto.randomBytes(2).toString("hex")}`,
          germanText,
          arabicHint,
          tag,
          authorName: user.name,
          createdAt: new Date().toISOString(),
          aiCorrection: null,
        };
        room.kartchen.unshift(newCard);
        room.activeKartchenId = newCard.id;
        broadcastRoom(room);
        return;
      }

      if (msg.type === "kartchen:delete") {
        const kId = String(msg.kartchenId || "");
        if (room.kartchen.length <= 1) return;
        room.kartchen = room.kartchen.filter((k) => k.id !== kId);
        if (room.activeKartchenId === kId) {
          room.activeKartchenId = room.kartchen[0]?.id || null;
        }
        broadcastRoom(room);
        return;
      }

      if (msg.type === "kartchen:generate_ai") {
        if (room.isGeneratingKartchen) return;
        room.isGeneratingKartchen = true;
        room.kartchenGenRequestedBy = user.name;
        broadcastRoom(room);

        try {
          const generated = await runGeminiKartchenGenerator(room.level);
          const newCard: KartchenItem = {
            id: `krt_${Date.now()}_${crypto.randomBytes(2).toString("hex")}`,
            germanText: generated.germanText,
            arabicHint: generated.arabicHint,
            tag: generated.tag,
            authorName: `ذكاء (${user.name})`,
            createdAt: new Date().toISOString(),
            aiCorrection: null,
          };
          room.kartchen.unshift(newCard);
          room.activeKartchenId = newCard.id;
        } catch (err: any) {
          sendJson(ws, {
            type: "error",
            code: "KARTCHEN_AI_ERROR",
            message: err?.message || "تعذر توليد قصاصة جديدة بالذكاء الاصطناعي.",
          });
        } finally {
          room.isGeneratingKartchen = false;
          room.kartchenGenRequestedBy = null;
          broadcastRoom(room);
        }
        return;
      }
    });

    ws.on("close", () => {
      const state = socketsByWs.get(ws);
      socketsByWs.delete(ws);
      if (state?.roomId && rooms.has(state.roomId)) {
        const room = rooms.get(state.roomId)!;
        syncPlayerConnectivity(room);
        broadcastRoom(room);
        broadcastLobby();
      }
    });

    ws.on("error", () => {});
  });
}

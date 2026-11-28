import type express from "express";
import type http from "http";
import type https from "https";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, Type } from "@google/genai";
import { verifySessionToken, type UserSession } from "./serverAuth";

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
  targetType: "p1" | "p2";
  requestedByName: string;
  requestedAt: string;
  modelUsed?: string;
  errorMessage?: string;
  result?: DuelAICorrectionResult;
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
  centerCorrections: {
    p1: DuelAICorrectionState | null;
    p2: DuelAICorrectionState | null;
  };
}

export interface PublicRoomSummary {
  id: string;
  title: string;
  round: number;
  playerCount: number;
  players: Array<{ slot: 1 | 2; name: string; connected: boolean; avatar: "blue" | "coral" }>;
  createdAt: string;
}

export interface SerializedRoomForViewer {
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

interface AuthedSocket {
  ws: WebSocket;
  user: UserSession | null;
  roomId: string | null;
  isAlive: boolean;
}

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

function createRoom(creator: UserSession, titleInput?: string): InternalWritingDuelRoom {
  const nowIso = new Date().toISOString();
  const id = generateRoomCode();
  const cleanTitle = (typeof titleInput === "string" ? titleInput.trim().slice(0, 60) : "") || `غرفة ${creator.name}`;

  const room: InternalWritingDuelRoom = {
    id,
    title: cleanTitle,
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
    round: room.round,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    mySlot,
    myDraft,
    players: {
      p1: room.players.p1 ? { ...room.players.p1 } : null,
      p2: room.players.p2 ? { ...room.players.p2 } : null,
    },
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

function parseCorrectionPayload(rawText: string, originalText: string): DuelAICorrectionResult {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  const safeScore = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
  return {
    correctedText: String(parsed.correctedText || originalText),
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
    improvedVersion: String(parsed.improvedVersion || parsed.correctedText || originalText),
    tipArabic: String(parsed.tipArabic || "استمر في الكتابة والممارسة!"),
  };
}

async function runAICorrection(
  germanText: string,
  selectedModel: string,
  clientGeminiKey?: string,
  clientGroqKey?: string
): Promise<DuelAICorrectionResult> {
  const modelId = (selectedModel || "gemini-3.6-flash").trim();
  const isGroq = modelId.includes("groq");

  const prompt = [
    `أنت مدرس لغة ألمانية خبير وودود تراجع نصاً حراً في لعبة تحدي كتابة.`,
    `النص الألماني المراد تصحيحه ومراجعته:`,
    `"""${germanText}"""`,
    ``,
    `المطلوب إرجاع JSON حصري يحتوي على المفاتيح التالية:`,
    `- correctedText: النص الألماني بعد التصحيح الكامل.`,
    `- isCorrect: true إذا كان النص صحيحاً نحوياً وإملائياً، وإلا false.`,
    `- score: درجة من 0 إلى 100.`,
    `- summaryArabic: ملخص موجز بالعربية يقيّم الجملة.`,
    `- mistakes: مصفوفة أخطاء [{ original, correction, explanationArabic }] أو [] إن لم توجد أخطاء.`,
    `- improvedVersion: صياغة ألمانية أكثر طبيعية وسلاسة.`,
    `- tipArabic: نصيحة لغوية سريعة بالعربية.`,
  ].join("\n");

  if (isGroq) {
    const groqKey = (clientGroqKey || "").trim() || (process.env.GROQ_API_KEY || "").trim();
    if (!groqKey) {
      throw new Error("مفتاح Groq API غير مضاف في الإعدادات.");
    }
    const resGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "أرجع JSON فقط مطابقاً تماماً للمفاتيح المطلوبة." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });
    if (!resGroq.ok) {
      const errBody = await resGroq.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `خطأ من Groq (${resGroq.status})`);
    }
    const dataGroq = await resGroq.json();
    const out = dataGroq?.choices?.[0]?.message?.content || "";
    if (!out.trim()) throw new Error("رد فارغ من Groq.");
    return parseCorrectionPayload(out, germanText);
  }

  const geminiKey = (clientGeminiKey || "").trim() || (process.env.GEMINI_API_KEY || "").trim();
  if (!geminiKey) {
    throw new Error("مفتاح Gemini API غير موجود. يرجى إضافته في إعدادات التطبيق.");
  }

  const ai = new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const response = await ai.models.generateContent({
    model: modelId,
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
  if (!rawText) throw new Error(`لم يصل رد من الموديل (${modelId}).`);
  return parseCorrectionPayload(rawText, germanText);
}

async function handleRoomAICorrection(
  room: InternalWritingDuelRoom,
  requester: UserSession,
  targetType: "p1" | "p2",
  selectedModel: string,
  clientGeminiKey?: string,
  clientGroqKey?: string
) {
  const player = room.players[targetType];
  if (!player || !player.submittedText || !player.submittedText.trim()) {
    return;
  }
  const currentState = room.centerCorrections[targetType];
  if (currentState?.status === "loading") return;

  const textToCorrect = player.submittedText.trim();
  const modelToUse = (selectedModel || "gemini-3.6-flash").trim();

  room.centerCorrections[targetType] = {
    status: "loading",
    targetType,
    requestedByName: requester.name,
    requestedAt: new Date().toISOString(),
    modelUsed: modelToUse,
  };

  // Broadcast immediately so BOTH players see live loading state simultaneously
  broadcastRoom(room);

  try {
    const result = await runAICorrection(textToCorrect, modelToUse, clientGeminiKey, clientGroqKey);
    room.centerCorrections[targetType] = {
      status: "done",
      targetType,
      requestedByName: requester.name,
      requestedAt: new Date().toISOString(),
      modelUsed: modelToUse,
      result,
    };
    if (!player.scoredThisRound) {
      const bonus = result.isCorrect ? 15 : Math.max(5, Math.round(result.score / 10));
      player.score += bonus;
      player.scoredThisRound = true;
    }
    broadcastRoom(room);
  } catch (err: any) {
    room.centerCorrections[targetType] = {
      status: "error",
      targetType,
      requestedByName: requester.name,
      requestedAt: new Date().toISOString(),
      modelUsed: modelToUse,
      errorMessage: err?.message || "تعذر الاتصال بالمساعد الذكي أثناء التصحيح.",
    };
    broadcastRoom(room);
  }
}

export function registerWritingDuelRoutes(app: express.Express) {
  app.get("/api/writing-duel/rooms", (req: any, res: any) => {
    if (!req.user) return res.status(401).json({ error: "غير مصرح لك." });
    res.json({ rooms: listOpenRooms() });
  });

  app.post("/api/writing-duel/rooms", (req: any, res: any) => {
    if (!req.user) return res.status(401).json({ error: "غير مصرح لك." });
    const { title } = req.body || {};
    const room = createRoom(req.user, title);
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

      if (msg.type === "lobby:list") {
        sendJson(ws, { type: "lobby:rooms", rooms: listOpenRooms() });
        return;
      }

      if (msg.type === "room:create") {
        if (clientState.roomId && rooms.has(clientState.roomId)) {
          const prev = rooms.get(clientState.roomId)!;
          clientState.roomId = null;
          syncPlayerConnectivity(prev);
          broadcastRoom(prev);
        }
        const room = createRoom(user, msg.title);
        clientState.roomId = room.id;
        syncPlayerConnectivity(room);
        broadcastRoom(room);
        broadcastLobby();
        return;
      }

      if (msg.type === "room:join") {
        const roomId = String(msg.roomId || "").trim().toUpperCase();
        const room = rooms.get(roomId);
        if (!room) {
          sendJson(ws, { type: "error", code: "ROOM_NOT_FOUND", message: "الغرفة غير موجودة أو انتهت." });
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
            sendJson(ws, { type: "error", code: "ROOM_FULL", message: "الغرفة مكتملة بالفعل (لاعبان)." });
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

      if (!clientState.roomId || !rooms.has(clientState.roomId)) {
        sendJson(ws, { type: "error", code: "NO_ROOM", message: "لست داخل غرفة نشطة." });
        return;
      }

      const room = rooms.get(clientState.roomId)!;
      const slot = getPlayerSlot(room, user.userId);
      if (!slot) {
        sendJson(ws, { type: "error", code: "NOT_PLAYER", message: "أنت غير مسجل في هذه الغرفة." });
        return;
      }

      const slotKey = slot === 1 ? "p1" : "p2";
      const playerObj = room.players[slotKey];
      if (!playerObj) return;

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

        broadcastRoom(room);
        return;
      }

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

        broadcastRoom(room);
        broadcastLobby();
        return;
      }

      if (msg.type === "duel:correct_ai") {
        const targetType = msg.targetType;
        if (targetType === "p1" || targetType === "p2") {
          const selectedModel = typeof msg.selectedModel === "string" ? msg.selectedModel : "gemini-3.6-flash";
          const clientGeminiKey = typeof msg.geminiApiKey === "string" ? msg.geminiApiKey : "";
          const clientGroqKey = typeof msg.groqApiKey === "string" ? msg.groqApiKey : "";
          void handleRoomAICorrection(room, user, targetType, selectedModel, clientGeminiKey, clientGroqKey);
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

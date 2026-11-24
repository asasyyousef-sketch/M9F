import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getSupabase } from "./src/supabaseClient";

export interface AppUser {
  id: string;
  username: string;
  name: string;
  role: "admin" | "user";
  status?: "active" | "suspended";
  notes?: string;
  lastLoginAt?: string | null;
  passwordUpdatedAt?: string | null;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

export interface UserSession {
  token: string;
  userId: string;
  username: string;
  name: string;
  role: "admin" | "user";
  createdAt: number;
  expiresAt: number;
}

const SESSIONS_PATH = path.join(process.cwd(), "active_sessions.json");
const activeSessions = new Map<string, UserSession>();
const suspendedUserIds = new Set<string>();

function loadPersistedSessions() {
  try {
    if (fs.existsSync(SESSIONS_PATH)) {
      const data = fs.readFileSync(SESSIONS_PATH, "utf-8");
      const list: UserSession[] = JSON.parse(data);
      const now = Date.now();
      list.forEach((s) => {
        if (s && s.token && s.expiresAt > now) {
          activeSessions.set(s.token, s);
        }
      });
    }
  } catch (e) {
    console.warn("[Auth] Failed to load persisted sessions:", e);
  }
}

function persistSessions() {
  try {
    const list = Array.from(activeSessions.values());
    fs.writeFileSync(SESSIONS_PATH, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.warn("[Auth] Failed to save sessions:", e);
  }
}

loadPersistedSessions();

export function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, s, 10000, 64, "sha512").toString("hex");
  return { salt: s, hash };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  try {
    const testHash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(testHash, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

function refreshSuspendedCache(users: AppUser[]) {
  suspendedUserIds.clear();
  users.forEach((u) => {
    if (u.status === "suspended") {
      suspendedUserIds.add(u.id);
    }
  });
}

function toSupabaseUserRow(u: AppUser) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    salt: u.salt,
    passwordHash: u.passwordHash,
    createdAt: u.createdAt || new Date().toISOString()
  };
}

export function loadUsers(dbPath: string): AppUser[] {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, "utf-8");
      const parsed = JSON.parse(data);
      const list: AppUser[] = Array.isArray(parsed.users) ? parsed.users : [];
      refreshSuspendedCache(list);
      return list;
    }
  } catch (e) {
    console.error("[Auth] Error reading users from DB:", e);
  }
  return [];
}

export function saveUsersLocal(dbPath: string, users: AppUser[]) {
  try {
    let current: any = {};
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, "utf-8");
      current = JSON.parse(data);
    }
    current.users = users;
    refreshSuspendedCache(users);
    fs.writeFileSync(dbPath, JSON.stringify(current, null, 2), "utf-8");
  } catch (e) {
    console.error("[Auth] Error saving users to local DB:", e);
  }
}

export function saveUsers(dbPath: string, users: AppUser[]) {
  saveUsersLocal(dbPath, users);

  const supabase = getSupabase();
  if (supabase && users.length > 0) {
    const cloudRows = users.map(toSupabaseUserRow);
    (async () => {
      try {
        const { error } = await supabase.from("app_users").upsert(cloudRows);
        if (error) {
          console.warn("[Auth Supabase Sync] Failed to upsert users to Supabase:", error.message);
        } else {
          console.log(`[Auth Supabase Sync] Successfully synchronized ${cloudRows.length} users with Supabase cloud!`);
        }
      } catch (err: any) {
        console.warn("[Auth Supabase Sync] Error during users upsert:", err.message || err);
      }
    })();
  }
}

export async function syncUsersWithSupabase(dbPath: string): Promise<AppUser[]> {
  const localUsers = loadUsers(dbPath);
  try {
    const supabase = getSupabase();
    if (!supabase) return localUsers;

    const { data: cloudUsers, error } = await supabase.from("app_users").select("*");
    if (error) {
      console.warn("[Auth Supabase Sync] Supabase app_users table note:", error.message);
      return localUsers;
    }

    if (Array.isArray(cloudUsers) && cloudUsers.length > 0) {
      const userMap = new Map<string, AppUser>();
      localUsers.forEach((u) => userMap.set(u.id, u));

      cloudUsers.forEach((cu: any) => {
        const existingLocal = userMap.get(cu.id);
        userMap.set(cu.id, {
          id: cu.id,
          username: cu.username,
          name: cu.name,
          role: cu.role,
          salt: cu.salt,
          passwordHash: cu.passwordHash,
          createdAt: cu.createdAt || existingLocal?.createdAt || new Date().toISOString(),
          // Preserve local extended account management metadata across cloud sync
          status: existingLocal?.status || "active",
          lastLoginAt: existingLocal?.lastLoginAt ?? null,
          passwordUpdatedAt: existingLocal?.passwordUpdatedAt ?? cu.createdAt ?? null,
          notes: existingLocal?.notes ?? ""
        });
      });

      const mergedUsers = Array.from(userMap.values());
      saveUsersLocal(dbPath, mergedUsers);

      const missingInCloud = localUsers
        .filter((lu) => !cloudUsers.some((cu: any) => cu.id === lu.id))
        .map(toSupabaseUserRow);
      if (missingInCloud.length > 0) {
        await supabase.from("app_users").upsert(missingInCloud);
      }

      console.log(`[Auth Supabase Sync] Synchronized ${mergedUsers.length} users between local and Supabase cloud.`);
      return mergedUsers;
    } else if (localUsers.length > 0) {
      console.log(`[Auth Supabase Sync] Pushing ${localUsers.length} local users to Supabase cloud app_users...`);
      await supabase.from("app_users").upsert(localUsers.map(toSupabaseUserRow));
    }
  } catch (err: any) {
    console.warn("[Auth Supabase Sync] Exception during sync:", err.message || err);
  }
  return localUsers;
}

function revokeUserSessions(userId: string, preserveToken?: string): number {
  let count = 0;
  for (const [token, sess] of activeSessions.entries()) {
    if (sess.userId === userId && (!preserveToken || token !== preserveToken)) {
      activeSessions.delete(token);
      count++;
    }
  }
  if (count > 0) persistSessions();
  return count;
}

function countActiveSessionsByUser(): Record<string, number> {
  const now = Date.now();
  const counts: Record<string, number> = {};
  let pruned = false;
  for (const [token, sess] of activeSessions.entries()) {
    if (sess.expiresAt <= now) {
      activeSessions.delete(token);
      pruned = true;
      continue;
    }
    counts[sess.userId] = (counts[sess.userId] || 0) + 1;
  }
  if (pruned) persistSessions();
  return counts;
}

function getBearerToken(req: any): string | null {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
}

/**
 * Express middleware to extract and verify the session token from the Authorization header.
 */
export function authMiddleware(req: any, _res: any, next: any) {
  const token = getBearerToken(req);

  if (token && activeSessions.has(token)) {
    const session = activeSessions.get(token)!;
    if (session.expiresAt > Date.now() && !suspendedUserIds.has(session.userId)) {
      req.user = session;
      return next();
    } else {
      activeSessions.delete(token);
      persistSessions();
    }
  }

  req.user = null;
  next();
}

/**
 * Registers all authentication and user management API endpoints.
 */
export function registerAuthRoutes(
  app: express.Express,
  dbPath: string,
  onAdminSetup?: (adminId: string) => void
) {
  // Ensure suspendedUserIds cache is populated at startup
  loadUsers(dbPath);

  // Check auth status
  app.get("/api/auth/status", async (req: any, res: any) => {
    let users = loadUsers(dbPath);
    if (users.length === 0) {
      try {
        users = await syncUsersWithSupabase(dbPath);
      } catch {}
    }
    const hasAdmin = users.some((u) => u.role === "admin");
    res.json({
      hasAdmin,
      currentUser: req.user
        ? {
            id: req.user.userId,
            username: req.user.username,
            name: req.user.name,
            role: req.user.role
          }
        : null,
      totalUsers: users.length
    });
  });

  // Check username availability
  app.get("/api/auth/check-username", async (req: any, res: any) => {
    const raw = String(req.query.username || "").trim().toLowerCase();
    if (!raw || raw.length < 3) {
      return res.json({ available: false, reason: "الاسم قصير جداً (3 أحرف على الأقل)" });
    }
    const users = loadUsers(dbPath);
    const exists = users.some((u) => u.username.toLowerCase() === raw);
    res.json({ available: !exists, username: raw });
  });

  // Public User Registration
  app.post("/api/auth/register", async (req: any, res: any) => {
    const { username, password, name } = req.body || {};
    if (!username || !String(username).trim() || !password) {
      return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان لإنشاء الحساب." });
    }

    const cleanUsername = String(username).trim().toLowerCase();

    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: "يجب أن يتكون اسم المستخدم من 3 أحرف أو أرقام على الأقل." });
    }

    if (!/^[a-zA-Z0-9_.\-\u0600-\u06FF]+$/.test(cleanUsername)) {
      return res.status(400).json({ error: "اسم المستخدم يمكن أن يحتوي فقط على أحرف أو أرقام أو شرطة أو نقطة." });
    }

    if (String(password).length < 4) {
      return res.status(400).json({ error: "يجب أن تتكون كلمة المرور من 4 خانات على الأقل." });
    }

    let users = loadUsers(dbPath);
    if (users.length === 0) {
      try {
        users = await syncUsersWithSupabase(dbPath);
      } catch {}
    }

    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      return res.status(400).json({ error: "اسم المستخدم هذا مسجل بالفعل، يرجى اختيار اسم آخر أو تسجيل الدخول." });
    }

    const isFirstUser = users.length === 0 || !users.some((u) => u.role === "admin");
    const role: "admin" | "user" = isFirstUser ? "admin" : "user";
    const newId = "usr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    const { salt, hash } = hashPassword(String(password));
    const nowIso = new Date().toISOString();

    const newUser: AppUser = {
      id: newId,
      username: cleanUsername,
      name: (name && String(name).trim()) || cleanUsername,
      role,
      status: "active",
      lastLoginAt: nowIso,
      passwordUpdatedAt: nowIso,
      notes: "",
      salt,
      passwordHash: hash,
      createdAt: nowIso
    };

    users.push(newUser);
    saveUsers(dbPath, users);

    if (isFirstUser && onAdminSetup) {
      try {
        onAdminSetup(newId);
      } catch (err) {
        console.error("[Auth Register] Error in onAdminSetup callback:", err);
      }
    } else if (!isFirstUser) {
      try {
        if (fs.existsSync(dbPath)) {
          const raw = fs.readFileSync(dbPath, "utf-8");
          const dbData = JSON.parse(raw);
          dbData.folders = dbData.folders || [];
          dbData.cards = dbData.cards || [];

          const starterFolderId = "folder_" + Date.now();
          const starterFolder = {
            id: starterFolderId,
            userId: newId,
            name: "مجلدي التعليمي الأول",
            description: "مجلد افتراضي لبدء التعلم وحفظ البطاقات الخاصة بك",
            color: "#0056f6",
            frontLang: "de",
            backLang: "ar",
            createdAt: nowIso,
            updatedAt: nowIso
          };

          const starterCards = [
            {
              id: "card_" + Date.now() + "_1",
              userId: newId,
              folderId: starterFolderId,
              frontText: "Hallo",
              frontLang: "de",
              backText: "مرحباً",
              backLang: "ar",
              streak: 0,
              createdAt: nowIso
            },
            {
              id: "card_" + Date.now() + "_2",
              userId: newId,
              folderId: starterFolderId,
              frontText: "Danke schön",
              frontLang: "de",
              backText: "شكراً جزيلاً",
              backLang: "ar",
              streak: 0,
              createdAt: nowIso
            },
            {
              id: "card_" + Date.now() + "_3",
              userId: newId,
              folderId: starterFolderId,
              frontText: "Auf Wiedersehen",
              frontLang: "de",
              backText: "إلى اللقاء / مع السلامة",
              backLang: "ar",
              streak: 0,
              createdAt: nowIso
            }
          ];

          dbData.folders.push(starterFolder);
          dbData.cards.push(...starterCards);
          fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), "utf-8");
        }
      } catch (seedErr) {
        console.warn("[Auth Register] Notice seeding starter folder:", seedErr);
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    const session: UserSession = {
      token,
      userId: newUser.id,
      username: newUser.username,
      name: newUser.name,
      role: newUser.role,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    };
    activeSessions.set(token, session);
    persistSessions();

    res.json({
      success: true,
      message: "تم إنشاء الحساب بنجاح وتم تسجيل الدخول تلقائياً!",
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        status: newUser.status,
        createdAt: newUser.createdAt
      },
      token
    });
  });

  // Setup first admin account
  app.post("/api/auth/setup-admin", (req: any, res: any) => {
    const users = loadUsers(dbPath);
    if (users.length > 0) {
      return res.status(403).json({ error: "تم إعداد الحساب الرئيسي بالفعل ولا يمكن تكرار هذه الخطوة." });
    }

    const { username, password, name } = req.body || {};
    if (!username || !String(username).trim() || !password) {
      return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان." });
    }

    if (String(password).length < 4) {
      return res.status(400).json({ error: "يجب أن تتكون كلمة المرور من 4 خانات على الأقل." });
    }

    const adminId = "usr_" + Date.now();
    const { salt, hash } = hashPassword(String(password));
    const nowIso = new Date().toISOString();
    const adminUser: AppUser = {
      id: adminId,
      username: String(username).trim().toLowerCase(),
      name: (name && String(name).trim()) || "المدير",
      role: "admin",
      status: "active",
      lastLoginAt: nowIso,
      passwordUpdatedAt: nowIso,
      notes: "",
      salt,
      passwordHash: hash,
      createdAt: nowIso
    };

    saveUsers(dbPath, [adminUser]);

    const token = crypto.randomBytes(32).toString("hex");
    const session: UserSession = {
      token,
      userId: adminId,
      username: adminUser.username,
      name: adminUser.name,
      role: "admin",
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    };
    activeSessions.set(token, session);
    persistSessions();

    if (onAdminSetup) {
      try {
        onAdminSetup(adminId);
      } catch (err) {
        console.error("[Auth] Error in onAdminSetup callback:", err);
      }
    }

    res.json({
      success: true,
      user: {
        id: adminId,
        username: adminUser.username,
        name: adminUser.name,
        role: "admin",
        status: "active"
      },
      token
    });
  });

  // User Login
  app.post("/api/auth/login", async (req: any, res: any) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "يرجى كتابة اسم المستخدم وكلمة المرور." });
    }

    let users = loadUsers(dbPath);
    let user = users.find((u) => u.username.toLowerCase() === String(username).trim().toLowerCase());

    if (!user) {
      try {
        users = await syncUsersWithSupabase(dbPath);
        user = users.find((u) => u.username.toLowerCase() === String(username).trim().toLowerCase());
      } catch {}
    }

    if (!user || !verifyPassword(String(password), user.salt, user.passwordHash)) {
      return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ error: "تم إيقاف هذا الحساب مؤقتاً من قبل الإدارة." });
    }

    // Record last login timestamp locally without altering password hash
    user.lastLoginAt = new Date().toISOString();
    saveUsersLocal(dbPath, users);

    const token = crypto.randomBytes(32).toString("hex");
    const session: UserSession = {
      token,
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    };
    activeSessions.set(token, session);
    persistSessions();

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        status: user.status || "active"
      },
      token
    });
  });

  // User Logout
  app.post("/api/auth/logout", (req: any, res: any) => {
    const token = getBearerToken(req);
    if (token) {
      activeSessions.delete(token);
      persistSessions();
    }
    res.json({ success: true });
  });

  // Get current user details
  app.get("/api/auth/me", (req: any, res: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "غير مسجل الدخول." });
    }
    res.json({
      user: {
        id: req.user.userId,
        username: req.user.username,
        name: req.user.name,
        role: req.user.role
      }
    });
  });

  // List all users with real content & session metrics (Admin only)
  app.get("/api/auth/users", (req: any, res: any) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "هذه الميزة متاحة فقط لمدير النظام." });
    }

    let folderCounts: Record<string, number> = {};
    let cardCounts: Record<string, number> = {};
    let usersList: AppUser[] = [];

    try {
      if (fs.existsSync(dbPath)) {
        const parsed = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
        usersList = Array.isArray(parsed.users) ? parsed.users : [];
        refreshSuspendedCache(usersList);
        const folders = Array.isArray(parsed.folders) ? parsed.folders : [];
        const cards = Array.isArray(parsed.cards) ? parsed.cards : [];
        folders.forEach((f: any) => {
          const uid = f?.userId || "";
          if (uid) folderCounts[uid] = (folderCounts[uid] || 0) + 1;
        });
        cards.forEach((c: any) => {
          const uid = c?.userId || "";
          if (uid) cardCounts[uid] = (cardCounts[uid] || 0) + 1;
        });
      }
    } catch (e) {
      usersList = loadUsers(dbPath);
    }

    const sessionCounts = countActiveSessionsByUser();

    const users = usersList.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      status: u.status || "active",
      notes: u.notes || "",
      lastLoginAt: u.lastLoginAt || null,
      passwordUpdatedAt: u.passwordUpdatedAt || u.createdAt || null,
      createdAt: u.createdAt,
      foldersCount: folderCounts[u.id] || 0,
      cardsCount: cardCounts[u.id] || 0,
      activeSessionsCount: sessionCounts[u.id] || 0
    }));

    const summary = {
      total: users.length,
      admins: users.filter((u) => u.role === "admin").length,
      regular: users.filter((u) => u.role !== "admin").length,
      active: users.filter((u) => u.status !== "suspended").length,
      suspended: users.filter((u) => u.status === "suspended").length,
      activeSessions: Object.values(sessionCounts).reduce((a, b) => a + b, 0)
    };

    res.json({ users, summary });
  });

  // Create new user (Admin only)
  app.post("/api/auth/users", (req: any, res: any) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "هذه الميزة متاحة فقط لمدير النظام." });
    }

    const { username, password, name, role, status, notes } = req.body || {};
    if (!username || !String(username).trim() || !password) {
      return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان." });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: "يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل." });
    }
    if (!/^[a-zA-Z0-9_.\-\u0600-\u06FF]+$/.test(cleanUsername)) {
      return res.status(400).json({ error: "اسم المستخدم يحتوي على رموز غير مسموح بها." });
    }
    if (String(password).length < 4) {
      return res.status(400).json({ error: "يجب أن تكون كلمة المرور من 4 خانات على الأقل." });
    }

    const users = loadUsers(dbPath);
    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      return res.status(400).json({ error: "اسم المستخدم هذا مسجل بالفعل، يرجى اختيار اسم آخر." });
    }

    const newId = "usr_" + Date.now();
    const { salt, hash } = hashPassword(String(password));
    const nowIso = new Date().toISOString();
    const newUser: AppUser = {
      id: newId,
      username: cleanUsername,
      name: (name && String(name).trim()) || cleanUsername,
      role: role === "admin" ? "admin" : "user",
      status: status === "suspended" ? "suspended" : "active",
      notes: typeof notes === "string" ? notes.trim().slice(0, 300) : "",
      lastLoginAt: null,
      passwordUpdatedAt: nowIso,
      salt,
      passwordHash: hash,
      createdAt: nowIso
    };

    users.push(newUser);
    saveUsers(dbPath, users);

    res.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        status: newUser.status,
        notes: newUser.notes,
        lastLoginAt: newUser.lastLoginAt,
        passwordUpdatedAt: newUser.passwordUpdatedAt,
        createdAt: newUser.createdAt,
        foldersCount: 0,
        cardsCount: 0,
        activeSessionsCount: 0
      }
    });
  });

  // Update user details, role, status, or notes (Admin only)
  app.patch("/api/auth/users/:id", (req: any, res: any) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "هذه الميزة متاحة فقط لمدير النظام." });
    }

    const targetId = req.params.id;
    const { name, username, role, status, notes } = req.body || {};

    const users = loadUsers(dbPath);
    const targetUser = users.find((u) => u.id === targetId);
    if (!targetUser) {
      return res.status(404).json({ error: "المستخدم غير موجود." });
    }

    const isSelf = req.user.userId === targetId;

    // Validate role transitions
    if (role !== undefined) {
      const nextRole: "admin" | "user" = role === "admin" ? "admin" : "user";
      if (isSelf && nextRole !== "admin") {
        return res.status(400).json({ error: "لا يمكنك خفض صلاحية حسابك الحالي أثناء تسجيل الدخول." });
      }
      if (targetUser.role === "admin" && nextRole !== "admin") {
        const otherActiveAdmins = users.filter(
          (u) => u.id !== targetId && u.role === "admin" && u.status !== "suspended"
        );
        if (otherActiveAdmins.length === 0) {
          return res.status(400).json({ error: "يجب أن يبقى مدير نشط واحد على الأقل في النظام." });
        }
      }
      targetUser.role = nextRole;
    }

    // Validate status transitions
    if (status !== undefined) {
      const nextStatus: "active" | "suspended" = status === "suspended" ? "suspended" : "active";
      if (isSelf && nextStatus === "suspended") {
        return res.status(400).json({ error: "لا يمكنك إيقاف حسابك الحالي أثناء تسجيل الدخول." });
      }
      if (targetUser.role === "admin" && nextStatus === "suspended") {
        const otherActiveAdmins = users.filter(
          (u) => u.id !== targetId && u.role === "admin" && u.status !== "suspended"
        );
        if (otherActiveAdmins.length === 0) {
          return res.status(400).json({ error: "لا يمكن إيقاف المدير النشط الوحيد في النظام." });
        }
      }
      targetUser.status = nextStatus;
      if (nextStatus === "suspended") {
        revokeUserSessions(targetId);
      }
    }

    // Validate username update
    if (username !== undefined) {
      const cleanUsername = String(username).trim().toLowerCase();
      if (cleanUsername.length < 3) {
        return res.status(400).json({ error: "يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل." });
      }
      if (!/^[a-zA-Z0-9_.\-\u0600-\u06FF]+$/.test(cleanUsername)) {
        return res.status(400).json({ error: "اسم المستخدم يحتوي على رموز غير مسموح بها." });
      }
      if (users.some((u) => u.id !== targetId && u.username.toLowerCase() === cleanUsername)) {
        return res.status(400).json({ error: "اسم المستخدم مستخدم بالفعل لحساب آخر." });
      }
      targetUser.username = cleanUsername;
    }

    if (name !== undefined) {
      targetUser.name = String(name).trim() || targetUser.username;
    }

    if (notes !== undefined) {
      targetUser.notes = String(notes).trim().slice(0, 300);
    }

    // Update active session metadata for this user if still active
    if (targetUser.status !== "suspended") {
      let updatedSess = false;
      for (const sess of activeSessions.values()) {
        if (sess.userId === targetId) {
          sess.username = targetUser.username;
          sess.name = targetUser.name;
          sess.role = targetUser.role;
          updatedSess = true;
        }
      }
      if (updatedSess) persistSessions();
    }

    saveUsers(dbPath, users);

    res.json({
      success: true,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        name: targetUser.name,
        role: targetUser.role,
        status: targetUser.status || "active",
        notes: targetUser.notes || "",
        lastLoginAt: targetUser.lastLoginAt || null,
        passwordUpdatedAt: targetUser.passwordUpdatedAt || targetUser.createdAt || null,
        createdAt: targetUser.createdAt
      }
    });
  });

  // Revoke all active sessions for a specific user (Admin only)
  app.post("/api/auth/users/:id/revoke-sessions", (req: any, res: any) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "هذه الميزة متاحة فقط لمدير النظام." });
    }
    const targetId = req.params.id;
    const currentToken = req.user.userId === targetId ? getBearerToken(req) || undefined : undefined;
    const revokedCount = revokeUserSessions(targetId, currentToken);
    res.json({ success: true, revokedCount });
  });

  // Delete user (Admin only)
  app.delete("/api/auth/users/:id", (req: any, res: any) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "هذه الميزة متاحة فقط لمدير النظام." });
    }

    const targetId = req.params.id;
    if (targetId === req.user.userId) {
      return res.status(400).json({ error: "لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول به." });
    }

    const users = loadUsers(dbPath);
    const targetIdx = users.findIndex((u) => u.id === targetId);
    if (targetIdx === -1) {
      return res.status(404).json({ error: "المستخدم غير موجود." });
    }

    if (users[targetIdx].role === "admin") {
      const remainingAdmins = users.filter((u) => u.role === "admin" && u.id !== targetId);
      if (remainingAdmins.length === 0) {
        return res.status(400).json({ error: "لا يمكن حذف المشرف الأخير في النظام." });
      }
    }

    users.splice(targetIdx, 1);
    saveUsers(dbPath, users);

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from("app_users")
        .delete()
        .eq("id", targetId)
        .then(({ error }: any) => {
          if (error) console.warn("[Auth Supabase Sync] Failed to delete user from Supabase:", error.message);
        });
    }

    revokeUserSessions(targetId);

    res.json({ success: true });
  });

  // Change password (Admin or self)
  app.put("/api/auth/users/:id/password", (req: any, res: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "غير مصرح لك." });
    }

    const targetId = req.params.id;
    const isSelf = req.user.userId === targetId;
    const isAdmin = req.user.role === "admin";

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: "ليس لديك صلاحية لتغيير كلمة مرور مستخدم آخر." });
    }

    const { newPassword, revokeSessions } = req.body || {};
    if (!newPassword || String(newPassword).length < 4) {
      return res.status(400).json({ error: "يجب أن تكون كلمة المرور الجديدة 4 خانات على الأقل." });
    }

    const users = loadUsers(dbPath);
    const user = users.find((u) => u.id === targetId);
    if (!user) {
      return res.status(404).json({ error: "المستخدم غير موجود." });
    }

    const { salt, hash } = hashPassword(String(newPassword));
    const nowIso = new Date().toISOString();
    user.salt = salt;
    user.passwordHash = hash;
    user.passwordUpdatedAt = nowIso;
    saveUsers(dbPath, users);

    let revokedCount = 0;
    if (revokeSessions !== false && !isSelf) {
      revokedCount = revokeUserSessions(targetId);
    } else if (revokeSessions === true && isSelf) {
      revokedCount = revokeUserSessions(targetId, getBearerToken(req) || undefined);
    }

    res.json({
      success: true,
      message: "تم تحديث كلمة المرور بنجاح.",
      revokedCount,
      passwordUpdatedAt: nowIso
    });
  });
}

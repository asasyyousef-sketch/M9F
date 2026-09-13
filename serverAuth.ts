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

// Initialize active sessions from disk
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

export function loadUsers(dbPath: string): AppUser[] {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, "utf-8");
      const parsed = JSON.parse(data);
      return Array.isArray(parsed.users) ? parsed.users : [];
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
    fs.writeFileSync(dbPath, JSON.stringify(current, null, 2), "utf-8");
  } catch (e) {
    console.error("[Auth] Error saving users to local DB:", e);
  }
}

export function saveUsers(dbPath: string, users: AppUser[]) {
  saveUsersLocal(dbPath, users);

  // Background sync with Supabase app_users table
  const supabase = getSupabase();
  if (supabase && users.length > 0) {
    (async () => {
      try {
        const { error } = await supabase.from("app_users").upsert(users);
        if (error) {
          console.warn("[Auth Supabase Sync] Failed to upsert users to Supabase:", error.message);
        } else {
          console.log(`[Auth Supabase Sync] Successfully synchronized ${users.length} users with Supabase cloud!`);
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
      // First populate local users
      localUsers.forEach((u) => userMap.set(u.id, u));
      // Overlay cloud users
      cloudUsers.forEach((cu: any) => {
        userMap.set(cu.id, {
          id: cu.id,
          username: cu.username,
          name: cu.name,
          role: cu.role,
          salt: cu.salt,
          passwordHash: cu.passwordHash,
          createdAt: cu.createdAt || new Date().toISOString(),
        });
      });

      const mergedUsers = Array.from(userMap.values());
      saveUsersLocal(dbPath, mergedUsers);

      // If local had users not in cloud yet, upsert them
      const missingInCloud = localUsers.filter((lu) => !cloudUsers.some((cu: any) => cu.id === lu.id));
      if (missingInCloud.length > 0) {
        await supabase.from("app_users").upsert(missingInCloud);
      }

      console.log(`[Auth Supabase Sync] Synchronized ${mergedUsers.length} users between local and Supabase cloud.`);
      return mergedUsers;
    } else if (localUsers.length > 0) {
      // Cloud table is empty, upload local users to cloud
      console.log(`[Auth Supabase Sync] Pushing ${localUsers.length} local users to Supabase cloud app_users...`);
      await supabase.from("app_users").upsert(localUsers);
    }
  } catch (err: any) {
    console.warn("[Auth Supabase Sync] Exception during sync:", err.message || err);
  }
  return localUsers;
}

/**
 * Express middleware to extract and verify the session token from the Authorization header.
 */
export function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (token && activeSessions.has(token)) {
    const session = activeSessions.get(token)!;
    if (session.expiresAt > Date.now()) {
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
  // Check auth status
  app.get("/api/auth/status", async (req: any, res: any) => {
    let users = loadUsers(dbPath);
    if (users.length === 0) {
      try {
        users = await syncUsersWithSupabase(dbPath);
      } catch (e) {
        // non-blocking fallback
      }
    }
    const hasAdmin = users.some((u) => u.role === "admin");
    res.json({
      hasAdmin,
      currentUser: req.user
        ? {
            id: req.user.userId,
            username: req.user.username,
            name: req.user.name,
            role: req.user.role,
          }
        : null,
      totalUsers: users.length,
    });
  });

  // Setup first admin account
  app.post("/api/auth/setup-admin", (req: any, res: any) => {
    const users = loadUsers(dbPath);
    if (users.length > 0) {
      return res.status(403).json({ error: "تم إعداد الحساب الرئيسي بالفعل ولا يمكن تكرار هذه الخطوة." });
    }

    const { username, password, name } = req.body || {};
    if (!username || !username.trim() || !password) {
      return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان." });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: "يجب أن تتكون كلمة المرور من 4 خانات على الأقل." });
    }

    const adminId = "usr_" + Date.now();
    const { salt, hash } = hashPassword(password);
    const adminUser: AppUser = {
      id: adminId,
      username: username.trim().toLowerCase(),
      name: (name && name.trim()) || "المدير",
      role: "admin",
      salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    };

    saveUsers(dbPath, [adminUser]);

    // Create session token
    const token = crypto.randomBytes(32).toString("hex");
    const session: UserSession = {
      token,
      userId: adminId,
      username: adminUser.username,
      name: adminUser.name,
      role: "admin",
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
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
      },
      token,
    });
  });

  // User Login
  app.post("/api/auth/login", async (req: any, res: any) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "يرجى كتابة اسم المستخدم وكلمة المرور." });
    }

    let users = loadUsers(dbPath);
    let user = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());

    // If user not found locally, try syncing from Supabase
    if (!user) {
      try {
        users = await syncUsersWithSupabase(dbPath);
        user = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
      } catch (e) {
        // non-blocking fallback
      }
    }

    if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
      return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const session: UserSession = {
      token,
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
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
      },
      token,
    });
  });

  // User Logout
  app.post("/api/auth/logout", (req: any, res: any) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
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
        role: req.user.role,
      },
    });
  });

  // List all users (Admin only)
  app.get("/api/auth/users", (req: any, res: any) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "هذه الميزة متاحة فقط لمدير النظام." });
    }

    const users = loadUsers(dbPath).map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
    }));

    res.json({ users });
  });

  // Create new user (Admin only)
  app.post("/api/auth/users", (req: any, res: any) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "هذه الميزة متاحة فقط لمدير النظام." });
    }

    const { username, password, name, role } = req.body || {};
    if (!username || !username.trim() || !password) {
      return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان." });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: "يجب أن تكون كلمة المرور من 4 خانات على الأقل." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const users = loadUsers(dbPath);

    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      return res.status(400).json({ error: "اسم المستخدم هذا مسجل بالفعل، يرجى اختيار اسم آخر." });
    }

    const newId = "usr_" + Date.now();
    const { salt, hash } = hashPassword(password);
    const newUser: AppUser = {
      id: newId,
      username: cleanUsername,
      name: (name && name.trim()) || cleanUsername,
      role: role === "admin" ? "admin" : "user",
      salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
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
        createdAt: newUser.createdAt,
      },
    });
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

    // Protect against deleting the last admin
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
      supabase.from("app_users").delete().eq("id", targetId).then(({ error }: any) => {
        if (error) console.warn("[Auth Supabase Sync] Failed to delete user from Supabase:", error.message);
      });
    }

    // Invalidate any active sessions for the deleted user
    for (const [token, sess] of activeSessions.entries()) {
      if (sess.userId === targetId) {
        activeSessions.delete(token);
      }
    }
    persistSessions();

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

    const { newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: "يجب أن تكون كلمة المرور الجديدة 4 خانات على الأقل." });
    }

    const users = loadUsers(dbPath);
    const user = users.find((u) => u.id === targetId);

    if (!user) {
      return res.status(404).json({ error: "المستخدم غير موجود." });
    }

    const { salt, hash } = hashPassword(newPassword);
    user.salt = salt;
    user.passwordHash = hash;
    saveUsers(dbPath, users);

    res.json({ success: true, message: "تم تحديث كلمة المرور بنجاح." });
  });
}

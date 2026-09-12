import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { AppUser } from "../types";
import {
  Users,
  UserPlus,
  ShieldCheck,
  UserCheck,
  KeyRound,
  Trash2,
  RefreshCw,
  Database,
  Check,
  Copy,
  AlertCircle,
  Loader2,
  Lock,
  User,
  Sparkles,
  DownloadCloud,
  RotateCcw
} from "lucide-react";

export const AccountsSettingsTab: React.FC = () => {
  const { currentUser, authFetch } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Browser Cache Recovery state
  const [browserCacheInfo, setBrowserCacheInfo] = useState<{
    foldersCount: number;
    cardsCount: number;
    sources: string[];
    recoveredFolders: any[];
    recoveredCards: any[];
  }>({ foldersCount: 0, cardsCount: 0, sources: [], recoveredFolders: [], recoveredCards: [] });
  const [recovering, setRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  const scanBrowserCache = useCallback(() => {
    try {
      const folderSources = ["cached_folders", "ai_workspace_folders", "trash_folders"];
      const cardSources = ["cached_cards", "ai_workspace_cards", "trash_cards"];

      const folderMap = new Map<string, any>();
      const cardMap = new Map<string, any>();
      const detectedSources: string[] = [];

      folderSources.forEach((fKey) => {
        try {
          const raw = localStorage.getItem(fKey);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list) && list.length > 0) {
              list.forEach((f: any) => {
                if (f && f.id && f.id !== "folder-student-1") {
                  folderMap.set(f.id, f);
                }
              });
              detectedSources.push(fKey);
            }
          }
        } catch {}
      });

      cardSources.forEach((cKey) => {
        try {
          const raw = localStorage.getItem(cKey);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list) && list.length > 0) {
              list.forEach((c: any) => {
                if (c && c.id && c.id !== "card-student-1") {
                  cardMap.set(c.id, c);
                }
              });
            }
          }
        } catch {}
      });

      setBrowserCacheInfo({
        foldersCount: folderMap.size,
        cardsCount: cardMap.size,
        sources: detectedSources,
        recoveredFolders: Array.from(folderMap.values()),
        recoveredCards: Array.from(cardMap.values())
      });
    } catch (e) {
      console.error("Failed to scan browser cache:", e);
    }
  }, []);

  useEffect(() => {
    scanBrowserCache();
  }, [scanBrowserCache]);

  const handleRestoreFromBrowser = async () => {
    if (browserCacheInfo.foldersCount === 0 && browserCacheInfo.cardsCount === 0) return;
    setRecovering(true);
    setRecoveryMessage(null);
    try {
      // Save directly to server backend for current admin
      const res = await authFetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folders: browserCacheInfo.recoveredFolders,
          cards: browserCacheInfo.recoveredCards
        })
      });

      if (!res.ok) throw new Error("فشل حفظ البيانات المسترجعة في السيرفر");

      // Update current user local cache
      if (currentUser) {
        localStorage.setItem(`cached_folders_${currentUser.id}`, JSON.stringify(browserCacheInfo.recoveredFolders));
        localStorage.setItem(`cached_cards_${currentUser.id}`, JSON.stringify(browserCacheInfo.recoveredCards));
      }

      setRecoveryMessage(`✅ تم بنجاح استعادة ${browserCacheInfo.foldersCount} مجلد و ${browserCacheInfo.cardsCount} بطاقة وربطها بحسابك! جاري التحديث...`);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setRecoveryMessage(`❌ خطأ أثناء الاستعادة: ${err.message || err}`);
    } finally {
      setRecovering(false);
    }
  };

  // New User Form state
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [creatingUser, setCreatingUser] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Change Password state
  const [changingPasswordUserId, setChangingPasswordUserId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [changingPasswordLoading, setChangingPasswordLoading] = useState(false);
  const [changePasswordMsg, setChangePasswordMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Deleting user state
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // SQL Copy state
  const [copiedSql, setCopiedSql] = useState(false);

  // Load all users
  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      setUsersError(null);
      const res = await authFetch("/api/auth/users");
      if (!res.ok) {
        throw new Error("فشل تحميل قائمة المستخدمين.");
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setUsersError(err.message || "حدث خطأ أثناء جلب المستخدمين.");
    } finally {
      setLoadingUsers(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    if (!newUsername.trim() || !newPassword) {
      setCreateError("يرجى إدخال اسم المستخدم وكلمة المرور.");
      return;
    }
    if (newPassword.length < 4) {
      setCreateError("يجب أن تكون كلمة المرور 4 خانات على الأقل.");
      return;
    }

    try {
      setCreatingUser(true);
      const res = await authFetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          name: newName.trim() || newUsername.trim(),
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل إنشاء الحساب.");
      }

      setCreateSuccess(`تم إنشاء حساب "${data.user.username}" بنجاح!`);
      setNewUsername("");
      setNewPassword("");
      setNewName("");
      setNewRole("user");
      fetchUsers();
    } catch (err: any) {
      setCreateError(err.message || "حدث خطأ أثناء إنشاء الحساب.");
    } finally {
      setCreatingUser(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف الحساب "${username}"؟`)) {
      return;
    }

    try {
      setDeletingUserId(userId);
      const res = await authFetch(`/api/auth/users/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل حذف المستخدم.");
      }
      fetchUsers();
    } catch (err: any) {
      alert(err.message || "فشل حذف المستخدم.");
    } finally {
      setDeletingUserId(null);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (userId: string) => {
    if (!newPasswordInput || newPasswordInput.length < 4) {
      setChangePasswordMsg({ text: "كلمة المرور يجب أن تكون 4 خانات على الأقل.", isError: true });
      return;
    }

    try {
      setChangingPasswordLoading(true);
      setChangePasswordMsg(null);
      const res = await authFetch(`/api/auth/users/${userId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newPasswordInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل تحديث كلمة المرور.");
      }
      setChangePasswordMsg({ text: "تم تحديث كلمة المرور بنجاح!", isError: false });
      setNewPasswordInput("");
      setTimeout(() => {
        setChangingPasswordUserId(null);
        setChangePasswordMsg(null);
      }, 1500);
    } catch (err: any) {
      setChangePasswordMsg({ text: err.message || "فشل تحديث كلمة المرور.", isError: true });
    } finally {
      setChangingPasswordLoading(false);
    }
  };

  const copySqlToClipboard = () => {
    const sql = `ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS "userId" TEXT;\nALTER TABLE public.cards ADD COLUMN IF NOT EXISTS "userId" TEXT;`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans" dir="rtl">
      {/* Overview Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-primary/10 to-indigo-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-on-surface">إدارة الحسابات والمستخدمين</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300">
                صلاحية المشرف فقط
              </span>
            </div>
            <p className="text-xs text-on-surface-variant/80 mt-0.5">
              الحساب الأول هو المشرف الأصلي، ولديه ارتباط دائم بكافة البطاقات والمجلدات الأصلية الحالية في Supabase.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={fetchUsers}
            disabled={loadingUsers}
            className="p-2 rounded-xl bg-surface border border-outline-variant hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="تحديث القائمة"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline">تحديث</span>
          </button>
        </div>
      </div>

      {/* Grid: Create User & Users List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Create New User Form (5 Cols) */}
        <div className="lg:col-span-5 bg-surface border border-outline-variant/60 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/40">
            <UserPlus className="w-4 h-4 text-purple-600" />
            <h4 className="text-sm font-bold text-on-surface">إنشاء حساب مستخدم جديد</h4>
          </div>

          <p className="text-xs text-on-surface-variant/70 leading-relaxed">
            أنشئ حساباً لمستخدم آخر. سيحصل على مساحة بطاقات ومجلدات خاصة به مرتبطة بالسيرفر وقاعدة البيانات.
          </p>

          {createSuccess && (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-300 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{createSuccess}</span>
            </div>
          )}

          {createError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                اسم المستخدم (للدخول) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="مثال: student1"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl py-2 pr-9 pl-3 text-xs font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <User className="w-3.5 h-3.5 text-outline absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                الاسم الظاهر (اختياري)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: أحمد علي"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl py-2 pr-9 pl-3 text-xs font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <Sparkles className="w-3.5 h-3.5 text-outline absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                كلمة المرور *
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl py-2 pr-9 pl-3 text-xs font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <KeyRound className="w-3.5 h-3.5 text-outline absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                نوع الصلاحية
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "user" | "admin")}
                className="w-full bg-surface-container-low border border-outline-variant rounded-xl py-2 px-3 text-xs font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              >
                <option value="user">مستخدم عادي (طالب / متعلم)</option>
                <option value="admin">مدير نظام (مشرف كامل)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={creatingUser}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {creatingUser ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إنشاء الحساب...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>إنشاء الحساب الآن</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Registered Accounts List (7 Cols) */}
        <div className="lg:col-span-7 bg-surface border border-outline-variant/60 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant/40">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-bold text-on-surface">قائمة الحسابات المسجلة</h4>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container font-bold text-on-surface-variant">
                {users.length}
              </span>
            </div>
          </div>

          {loadingUsers ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-on-surface-variant">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs font-semibold">جاري تحميل المستخدمين...</span>
            </div>
          ) : usersError ? (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{usersError}</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant text-xs">
              لا توجد حسابات مسجلة بعد.
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {users.map((u) => {
                const isCurrent = currentUser?.id === u.id;
                const isAdmin = u.role === "admin";
                const isChangingPassword = changingPasswordUserId === u.id;

                return (
                  <div
                    key={u.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isCurrent
                        ? "bg-primary/5 border-primary/30"
                        : "bg-surface-container-lowest border-outline-variant/40 hover:border-outline-variant"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* User Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isAdmin
                              ? "bg-purple-600/15 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                              : "bg-blue-600/15 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                          }`}
                        >
                          {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-on-surface truncate">
                              {u.name || u.username}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary/20 text-primary">
                                أنت
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-on-surface-variant/70">
                            <span>@{u.username}</span>
                            <span>•</span>
                            <span className={isAdmin ? "text-purple-600 font-bold" : "text-blue-600"}>
                              {isAdmin ? "مدير نظام" : "مستخدم"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setChangingPasswordUserId(isChangingPassword ? null : u.id);
                            setNewPasswordInput("");
                            setChangePasswordMsg(null);
                          }}
                          className="p-1.5 rounded-lg bg-surface border border-outline-variant/60 hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-xs transition-all cursor-pointer"
                          title="تغيير كلمة المرور"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        {!isCurrent && (
                          <button
                            type="button"
                            disabled={deletingUserId === u.id}
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="p-1.5 rounded-lg bg-surface border border-outline-variant/60 hover:bg-red-500/10 hover:border-red-500/30 text-on-surface-variant hover:text-red-600 text-xs transition-all cursor-pointer disabled:opacity-50"
                            title="حذف المستخدم"
                          >
                            {deletingUserId === u.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Change Password Box */}
                    {isChangingPassword && (
                      <div className="mt-3 pt-3 border-t border-outline-variant/30 space-y-2 animate-fade-in">
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            placeholder="أدخل كلمة المرور الجديدة (4 خانات على الأقل)"
                            value={newPasswordInput}
                            onChange={(e) => setNewPasswordInput(e.target.value)}
                            className="flex-1 bg-surface border border-outline-variant rounded-lg py-1.5 px-2.5 text-xs font-semibold text-on-surface outline-none focus:ring-1 focus:ring-primary"
                          />
                          <button
                            type="button"
                            disabled={changingPasswordLoading}
                            onClick={() => handleChangePassword(u.id)}
                            className="px-3 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-lg hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                          >
                            {changingPasswordLoading ? "جاري الحفظ..." : "تحديث"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setChangingPasswordUserId(null)}
                            className="px-2 py-1.5 text-on-surface-variant hover:text-on-surface text-xs font-semibold transition-all cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                        {changePasswordMsg && (
                          <p
                            className={`text-[11px] font-semibold ${
                              changePasswordMsg.isError ? "text-red-500" : "text-green-600"
                            }`}
                          >
                            {changePasswordMsg.text}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Browser Cache Data Recovery Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-primary/20 shadow-sm space-y-3 bg-gradient-to-br from-primary/5 via-surface to-surface">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <DownloadCloud className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-on-surface">استعادة البطاقات والمجلدات السابقة من المتصفح</h4>
              <p className="text-[11px] text-on-surface-variant/80">فحص النسخ السابقة المخزنة في ذاكرة المتصفح واسترجاعها وربطها بحسابك</p>
            </div>
          </div>
          <button
            type="button"
            onClick={scanBrowserCache}
            className="p-1.5 rounded-lg border border-outline-variant hover:bg-surface-container text-on-surface-variant text-xs flex items-center gap-1 transition-all"
            title="إعادة فحص ذاكرة المتصفح"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-3.5 bg-surface-container-low/70 rounded-xl border border-outline-variant/50 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-on-surface font-medium">البيانات المكتشفة في المتصفح:</span>
              <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary font-bold text-xs">
                {browserCacheInfo.foldersCount} مجلدات
              </span>
              <span className="px-2 py-0.5 rounded-md bg-secondary/15 text-secondary font-bold text-xs">
                {browserCacheInfo.cardsCount} بطاقات
              </span>
            </div>
            {browserCacheInfo.foldersCount > 0 || browserCacheInfo.cardsCount > 0 ? (
              <button
                type="button"
                onClick={handleRestoreFromBrowser}
                disabled={recovering}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {recovering ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الاستعادة...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>استعادة وحفظ البيانات بحسابي الآن</span>
                  </>
                )}
              </button>
            ) : (
              <span className="text-[11px] text-on-surface-variant/70 italic">
                (لم يتم العثور على بطاقات قديمة إضافية غير محملة)
              </span>
            )}
          </div>

          {recoveryMessage && (
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
              {recoveryMessage}
            </p>
          )}
        </div>
      </div>

      {/* Supabase & Data Link Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-outline-variant/60 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-emerald-600" />
            <h4 className="text-sm font-bold text-on-surface">ارتباط البيانات بـ Supabase</h4>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            مفعل ومتزامن
          </span>
        </div>

        <p className="text-xs text-on-surface-variant/80 leading-relaxed">
          جميع البطاقات والمجلدات والملفات التي تخص الحساب الرئيسي محفوظة في Supabase ونسخة السيرفر الأصلية. المستخدمون الآخرون الذين تنشئهم يحفظ السيرفر بطاقاتهم بشكل معزول ومخصص لهم تلقائياً.
        </p>

        <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <span className="font-bold text-on-surface">أمر SQL اختياري لدعم عمود المستخدم في Supabase:</span>
            <p className="text-[11px] text-on-surface-variant/70 font-mono">
              ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS "userId" TEXT;
            </p>
          </div>
          <button
            type="button"
            onClick={copySqlToClipboard}
            className="px-3 py-1.5 rounded-lg bg-surface border border-outline-variant hover:bg-surface-container text-on-surface text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSql ? "تم النسخ!" : "نسخ أمر SQL"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

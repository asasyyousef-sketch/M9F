import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { AppUser, UserRole, UserStatus } from "../types";
import {
  UserPlus,
  Trash2,
  RefreshCw,
  Check,
  Copy,
  AlertCircle,
  Eye,
  EyeOff,
  Search,
  Download,
  Ban,
  CheckCircle2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Shield,
  User as UserIcon,
  X
} from "lucide-react";

interface AccountSummary {
  total: number;
  admins: number;
  regular: number;
  active: number;
  suspended: number;
  activeSessions: number;
}

type AccountsView =
  | { name: "list" }
  | { name: "create" }
  | { name: "detail"; userId: string };

function formatShortDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return "—";
  }
}

function formatDateTime(iso?: string | null, emptyText = "لم يسجل دخول بعد"): string {
  if (!iso) return emptyText;
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

function sanitizeCsvCell(val: unknown): string {
  const str = String(val ?? "");
  const escaped = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${escaped.replace(/"/g, '""')}"`;
}

function generateStrongPassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const arr = new Uint32Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * chars.length);
  }
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export const AccountsSettingsTab: React.FC = () => {
  const { currentUser, authFetch, refreshStatus } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  // Navigation within Accounts section
  const [view, setView] = useState<AccountsView>({ name: "list" });

  // List filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [listFilter, setListFilter] = useState<"all" | "admin" | "user" | "suspended">("all");

  // Create form state
  const [createUsername, setCreateUsername] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [showCreatePw, setShowCreatePw] = useState(true);
  const [createRole, setCreateRole] = useState<UserRole>("user");
  const [createNotes, setCreateNotes] = useState("");
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Detail / Edit state
  const [editUsername, setEditUsername] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("user");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Password reset state inside detail view
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [showDetailPw, setShowDetailPw] = useState(true);
  const [revokeSessionsOnPw, setRevokeSessionsOnPw] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [copiedPw, setCopiedPw] = useState(false);

  // In-memory-only credentials display right after creating an account or resetting a password
  const [recentCredentials, setRecentCredentials] = useState<{
    username: string;
    password: string;
    action: "created" | "updated";
  } | null>(null);
  const [showRecentPw, setShowRecentPw] = useState(true);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // Status / session / delete state inside detail view
  const [busyAction, setBusyAction] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Data & Backup state
  const [copiedSql, setCopiedSql] = useState(false);
  const [browserCacheInfo, setBrowserCacheInfo] = useState<{
    foldersCount: number;
    cardsCount: number;
    recoveredFolders: any[];
    recoveredCards: any[];
  }>({ foldersCount: 0, cardsCount: 0, recoveredFolders: [], recoveredCards: [] });
  const [recovering, setRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  const showNotice = (text: string, isError = false) => {
    setNotice({ text, isError });
    setTimeout(() => {
      setNotice((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      setUsersError(null);
      const res = await authFetch("/api/auth/users");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "تعذر تحميل الحسابات.");
      }
      const data = await res.json();
      setUsers(data.users || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      setUsersError(err.message || "حدث خطأ أثناء جلب الحسابات.");
    } finally {
      setLoadingUsers(false);
    }
  }, [authFetch]);

  const scanBrowserCache = useCallback(() => {
    try {
      const folderSources = ["cached_folders", "ai_workspace_folders", "trash_folders"];
      const cardSources = ["cached_cards", "ai_workspace_cards", "trash_cards"];
      const folderMap = new Map<string, any>();
      const cardMap = new Map<string, any>();

      folderSources.forEach((fKey) => {
        try {
          const raw = localStorage.getItem(fKey);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              list.forEach((f: any) => {
                if (f && f.id && f.id !== "folder-student-1") folderMap.set(f.id, f);
              });
            }
          }
        } catch {}
      });

      cardSources.forEach((cKey) => {
        try {
          const raw = localStorage.getItem(cKey);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              list.forEach((c: any) => {
                if (c && c.id && c.id !== "card-student-1") cardMap.set(c.id, c);
              });
            }
          }
        } catch {}
      });

      setBrowserCacheInfo({
        foldersCount: folderMap.size,
        cardsCount: cardMap.size,
        recoveredFolders: Array.from(folderMap.values()),
        recoveredCards: Array.from(cardMap.values())
      });
    } catch {}
  }, []);

  useEffect(() => {
    fetchUsers();
    scanBrowserCache();
  }, [fetchUsers, scanBrowserCache]);

  const selectedUser = useMemo(() => {
    if (view.name !== "detail") return null;
    return users.find((u) => u.id === view.userId) || null;
  }, [view, users]);

  // Populate detail form whenever selected user opens
  const openUserDetail = (u: AppUser) => {
    setEditUsername(u.username);
    setEditName(u.name || "");
    setEditRole(u.role);
    setEditNotes(u.notes || "");
    setNewPasswordInput("");
    setShowDetailPw(true);
    setRevokeSessionsOnPw(true);
    setConfirmDelete(false);
    setCopiedPw(false);
    setRecentCredentials((prev) => (prev?.username === u.username ? prev : null));
    setNotice(null);
    setView({ name: "detail", userId: u.id });
  };

  const openCreateView = () => {
    setCreateUsername("");
    setCreateName("");
    setCreatePassword("");
    setShowCreatePw(true);
    setCreateRole("user");
    setCreateNotes("");
    setCreateError(null);
    setCopiedPw(false);
    setRecentCredentials(null);
    setNotice(null);
    setView({ name: "create" });
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedPw(true);
      setTimeout(() => setCopiedPw(false), 2000);
    } catch {}
  };

  const handleCopyCredentials = async (username: string, password: string) => {
    try {
      await navigator.clipboard?.writeText(`اسم المستخدم: ${username}\nكلمة المرور: ${password}`);
      setCopiedCredentials(true);
      setTimeout(() => setCopiedCredentials(false), 2000);
    } catch {}
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!createUsername.trim() || !createPassword) {
      setCreateError("يرجى إدخال اسم المستخدم وكلمة المرور.");
      return;
    }
    if (createPassword.length < 4) {
      setCreateError("كلمة المرور يجب أن تكون 4 خانات على الأقل.");
      return;
    }

    try {
      setSubmittingCreate(true);
      const savedPassword = createPassword;
      const res = await authFetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: createUsername.trim(),
          password: savedPassword,
          name: createName.trim() || createUsername.trim(),
          role: createRole,
          notes: createNotes.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر إنشاء الحساب.");

      setCreatePassword("");
      setRecentCredentials({
        username: data.user.username,
        password: savedPassword,
        action: "created"
      });
      setShowRecentPw(true);
      setCopiedCredentials(false);
      await fetchUsers();
      setView({ name: "list" });
      showNotice(`تم إنشاء الحساب @${data.user.username}`);
    } catch (err: any) {
      setCreateError(err.message || "حدث خطأ أثناء إنشاء الحساب.");
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!editUsername.trim()) {
      showNotice("اسم المستخدم مطلوب.", true);
      return;
    }

    try {
      setSavingEdit(true);
      const res = await authFetch(`/api/auth/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: editUsername.trim(),
          name: editName.trim() || editUsername.trim(),
          role: editRole,
          notes: editNotes.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر حفظ التعديلات.");

      await fetchUsers();
      if (currentUser?.id === selectedUser.id) refreshStatus();
      showNotice("تم حفظ بيانات الحساب.");
    } catch (err: any) {
      showNotice(err.message || "تعذر حفظ التعديلات.", true);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!newPasswordInput || newPasswordInput.length < 4) {
      showNotice("كلمة المرور يجب أن تكون 4 خانات على الأقل.", true);
      return;
    }

    try {
      setSavingPassword(true);
      const savedPassword = newPasswordInput;
      const res = await authFetch(`/api/auth/users/${selectedUser.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: savedPassword,
          revokeSessions: revokeSessionsOnPw
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر تحديث كلمة المرور.");

      setNewPasswordInput("");
      setRecentCredentials({
        username: selectedUser.username,
        password: savedPassword,
        action: "updated"
      });
      setShowRecentPw(true);
      setCopiedCredentials(false);
      await fetchUsers();
      showNotice("تم تحديث كلمة المرور.");
    } catch (err: any) {
      showNotice(err.message || "تعذر تحديث كلمة المرور.", true);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleToggleStatus = async (u: AppUser) => {
    const nextStatus: UserStatus = u.status === "suspended" ? "active" : "suspended";
    try {
      setBusyAction(true);
      const res = await authFetch(`/api/auth/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر تغيير حالة الحساب.");

      await fetchUsers();
      showNotice(nextStatus === "suspended" ? "تم إيقاف الحساب مؤقتاً." : "تم تفعيل الحساب.");
    } catch (err: any) {
      showNotice(err.message || "تعذر تحديث الحالة.", true);
    } finally {
      setBusyAction(false);
    }
  };

  const handleRevokeSessions = async (u: AppUser) => {
    try {
      setBusyAction(true);
      const res = await authFetch(`/api/auth/users/${u.id}/revoke-sessions`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر إنهاء الجلسات.");

      await fetchUsers();
      showNotice(`تم إنهاء ${data.revokedCount || 0} جلسة نشطة.`);
    } catch (err: any) {
      showNotice(err.message || "تعذر إنهاء الجلسات.", true);
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteAccount = async (u: AppUser) => {
    try {
      setBusyAction(true);
      const res = await authFetch(`/api/auth/users/${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر حذف الحساب.");

      await fetchUsers();
      setView({ name: "list" });
      showNotice(`تم حذف الحساب @${u.username}`);
    } catch (err: any) {
      showNotice(err.message || "تعذر حذف الحساب.", true);
    } finally {
      setBusyAction(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ["اسم المستخدم", "الاسم", "الصلاحية", "الحالة", "المجلدات", "البطاقات", "الجلسات", "آخر دخول", "تاريخ الإنشاء"];
    const rows = filteredUsers.map((u) => [
      sanitizeCsvCell(u.username),
      sanitizeCsvCell(u.name || u.username),
      sanitizeCsvCell(u.role === "admin" ? "مدير" : "مستخدم"),
      sanitizeCsvCell(u.status === "suspended" ? "موقوف" : "نشط"),
      sanitizeCsvCell(u.foldersCount ?? 0),
      sanitizeCsvCell(u.cardsCount ?? 0),
      sanitizeCsvCell(u.activeSessionsCount ?? 0),
      sanitizeCsvCell(u.lastLoginAt || ""),
      sanitizeCsvCell(u.createdAt || "")
    ]);
    const csv = "\uFEFF" + [headers.map(sanitizeCsvCell).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreFromBrowser = async () => {
    if (browserCacheInfo.foldersCount === 0 && browserCacheInfo.cardsCount === 0) return;
    setRecovering(true);
    setRecoveryMessage(null);
    try {
      const res = await authFetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folders: browserCacheInfo.recoveredFolders,
          cards: browserCacheInfo.recoveredCards
        })
      });
      if (!res.ok) throw new Error("فشل حفظ البيانات المسترجعة.");
      if (currentUser) {
        localStorage.setItem(`cached_folders_${currentUser.id}`, JSON.stringify(browserCacheInfo.recoveredFolders));
        localStorage.setItem(`cached_cards_${currentUser.id}`, JSON.stringify(browserCacheInfo.recoveredCards));
      }
      setRecoveryMessage(`تمت استعادة ${browserCacheInfo.foldersCount} مجلد و ${browserCacheInfo.cardsCount} بطاقة.`);
      fetchUsers();
    } catch (err: any) {
      setRecoveryMessage(err.message || "حدث خطأ أثناء الاستعادة.");
    } finally {
      setRecovering(false);
    }
  };

  const copySqlToClipboard = () => {
    const sql = `ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS "userId" TEXT;\nALTER TABLE public.cards ADD COLUMN IF NOT EXISTS "userId" TEXT;`;
    navigator.clipboard?.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (listFilter === "admin" && u.role !== "admin") return false;
      if (listFilter === "user" && u.role !== "user") return false;
      if (listFilter === "suspended" && u.status !== "suspended") return false;
      if (q) {
        const matchUser = u.username.toLowerCase().includes(q);
        const matchName = (u.name || "").toLowerCase().includes(q);
        if (!matchUser && !matchName) return false;
      }
      return true;
    });
  }, [users, searchQuery, listFilter]);

  const computedSummary = summary || {
    total: users.length,
    admins: users.filter((u) => u.role === "admin").length,
    regular: users.filter((u) => u.role !== "admin").length,
    active: users.filter((u) => u.status !== "suspended").length,
    suspended: users.filter((u) => u.status === "suspended").length,
    activeSessions: users.reduce((sum, u) => sum + (u.activeSessionsCount || 0), 0)
  };

  // ==================== VIEW: CREATE USER ====================
  if (view.name === "create") {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setView({ name: "list" })}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#004ac6] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
            <span>العودة لقائمة الحسابات</span>
          </button>
        </div>

        <form onSubmit={handleCreateSubmit} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">إنشاء حساب جديد</h3>
          </div>

          <div className="p-4 space-y-4">
            {createError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">اسم المستخدم *</label>
                <input
                  type="text"
                  required
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  placeholder="student1"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 focus:bg-white focus:border-[#004ac6] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">الاسم الكامل</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="الاسم الظاهر"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:border-[#004ac6] outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">كلمة المرور *</label>
                <button
                  type="button"
                  onClick={() => {
                    setCreatePassword(generateStrongPassword(10));
                    setShowCreatePw(true);
                  }}
                  className="text-xs font-semibold text-[#004ac6] hover:underline cursor-pointer"
                >
                  توليد تلقائي
                </button>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showCreatePw ? "text" : "password"}
                    required
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="4 خانات على الأقل"
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 pl-9 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 focus:bg-white focus:border-[#004ac6] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePw((p) => !p)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showCreatePw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {createPassword && (
                  <button
                    type="button"
                    onClick={() => handleCopyText(createPassword)}
                    className="px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedPw ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPw ? "تم النسخ" : "نسخ"}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">الصلاحية</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:bg-white focus:border-[#004ac6] outline-none"
                >
                  <option value="user">مستخدم</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">ملاحظة إدارية</label>
                <input
                  type="text"
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  placeholder="اختياري"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:border-[#004ac6] outline-none"
                />
              </div>
            </div>
          </div>

          <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setView({ name: "list" })}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submittingCreate}
              className="px-5 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003ea8] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {submittingCreate ? "جاري الإنشاء..." : "إنشاء الحساب"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ==================== VIEW: USER DETAIL & MANAGEMENT ====================
  if (view.name === "detail" && selectedUser) {
    const isSelf = currentUser?.id === selectedUser.id;
    const isSuspended = selectedUser.status === "suspended";

    return (
      <div className="space-y-4" dir="rtl">
        {/* Top Back Bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setView({ name: "list" })}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#004ac6] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
            <span>العودة لقائمة الحسابات</span>
          </button>

          <span className={`text-xs font-bold ${isSuspended ? "text-red-700" : "text-emerald-700"}`}>
            {isSuspended ? "حساب موقوف" : "حساب نشط"}
          </span>
        </div>

        {notice && (
          <div
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
              notice.isError ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} className="cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Group 1: Account Summary */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">
                {selectedUser.name || selectedUser.username} {isSelf && <span className="text-xs text-[#004ac6]">(الحالي)</span>}
              </div>
              <div className="text-xs font-mono text-slate-500 mt-0.5" dir="ltr">
                @{selectedUser.username}
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-700">
              {selectedUser.role === "admin" ? "مدير نظام" : "مستخدم"}
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-100 text-center py-3 tabular-nums">
            <div>
              <div className="text-sm font-bold text-slate-900">{selectedUser.foldersCount ?? 0}</div>
              <div className="text-[11px] text-slate-500">المجلدات</div>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">{selectedUser.cardsCount ?? 0}</div>
              <div className="text-[11px] text-slate-500">البطاقات</div>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">{selectedUser.activeSessionsCount ?? 0}</div>
              <div className="text-[11px] text-slate-500">جلسات نشطة</div>
            </div>
          </div>

          <div className="px-4 py-2.5 flex items-center justify-between text-xs text-slate-500 tabular-nums">
            <span>آخر تسجيل دخول</span>
            <span className="text-slate-800 font-medium">{formatDateTime(selectedUser.lastLoginAt)}</span>
          </div>
          <div className="px-4 py-2.5 flex items-center justify-between text-xs text-slate-500 tabular-nums">
            <span>تاريخ الإنشاء</span>
            <span className="text-slate-800 font-medium">{formatShortDate(selectedUser.createdAt)}</span>
          </div>
        </div>

        {/* Group 2: Edit Profile & Role */}
        <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-500">البيانات الأساسية والصلاحية</h4>
          </div>
          <div className="p-4 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:border-[#004ac6] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المستخدم</label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 focus:bg-white focus:border-[#004ac6] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الصلاحية</label>
                <select
                  value={editRole}
                  disabled={isSelf}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:bg-white focus:border-[#004ac6] outline-none disabled:opacity-60"
                >
                  <option value="user">مستخدم</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظة إدارية</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="اختياري"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:border-[#004ac6] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingEdit}
                className="px-4 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003ea8] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {savingEdit ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </div>
        </form>

        {/* Group 3: Security & Sessions */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
          <div className="px-4 py-3">
            <h4 className="text-xs font-bold text-slate-500">الأمان والجلسات</h4>
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-800">كلمة المرور الحالية</div>
              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                مشفّرة ولا يمكن استرجاعها · آخر تحديث:{" "}
                {formatDateTime(selectedUser.passwordUpdatedAt || selectedUser.createdAt, "غير محدد")}
              </div>
            </div>
            <div className="text-xs font-mono tracking-widest text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1" dir="ltr">
              ••••••••••••
            </div>
          </div>

          {recentCredentials && recentCredentials.username === selectedUser.username && (
            <div className="px-4 py-3 bg-emerald-50/70 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-900">
                  كلمة المرور المعيّنة حديثاً (تظهر مؤقتاً للنسخ)
                </span>
                <button
                  type="button"
                  onClick={() => setRecentCredentials(null)}
                  className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                  title="إخفاء"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-emerald-200 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono font-bold text-slate-900" dir="ltr">
                    {showRecentPw ? recentCredentials.password : "••••••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRecentPw((p) => !p)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    title={showRecentPw ? "إخفاء" : "إظهار"}
                  >
                    {showRecentPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCredentials(recentCredentials.username, recentCredentials.password)}
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCredentials ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCredentials ? "تم النسخ" : "نسخ بيانات الدخول"}</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">تغيير / تعيين كلمة مرور جديدة</label>
              <button
                type="button"
                onClick={() => {
                  setNewPasswordInput(generateStrongPassword(10));
                  setShowDetailPw(true);
                }}
                className="text-xs font-semibold text-[#004ac6] hover:underline cursor-pointer"
              >
                توليد تلقائي
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showDetailPw ? "text" : "password"}
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="اكتب كلمة المرور الجديدة (4 خانات على الأقل)"
                  dir="ltr"
                  className="w-full px-3 py-2 pl-9 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 focus:bg-white focus:border-[#004ac6] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowDetailPw((p) => !p)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title={showDetailPw ? "إخفاء" : "إظهار"}
                >
                  {showDetailPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPasswordInput && (
                <button
                  type="button"
                  onClick={() => handleCopyText(newPasswordInput)}
                  className="px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  {copiedPw ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPw ? "تم" : "نسخ"}</span>
                </button>
              )}
              <button
                type="submit"
                disabled={savingPassword || !newPasswordInput}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0"
              >
                {savingPassword ? "حفظ..." : "تحديث"}
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={revokeSessionsOnPw}
                onChange={(e) => setRevokeSessionsOnPw(e.target.checked)}
                className="accent-[#004ac6] rounded cursor-pointer"
              />
              <span>إنهاء الجلسات النشطة عند تغيير كلمة المرور</span>
            </label>
          </form>

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-700 font-semibold tabular-nums">
              الجلسات النشطة حالياً: {selectedUser.activeSessionsCount ?? 0}
            </div>
            <button
              type="button"
              disabled={busyAction || (selectedUser.activeSessionsCount ?? 0) === 0}
              onClick={() => handleRevokeSessions(selectedUser)}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>إنهاء كل الجلسات</span>
            </button>
          </div>
        </div>

        {/* Group 4: Account Control (Suspend / Delete - non-self only) */}
        {!isSelf && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
            <div className="px-4 py-3">
              <h4 className="text-xs font-bold text-slate-500">إدارة الحالة والحذف</h4>
            </div>

            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-800">
                {isSuspended ? "إعادة تفعيل الحساب" : "إيقاف الحساب مؤقتاً"}
              </div>
              <button
                type="button"
                disabled={busyAction}
                onClick={() => handleToggleStatus(selectedUser)}
                className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  isSuspended
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                }`}
              >
                {isSuspended ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                <span>{isSuspended ? "تفعيل" : "إيقاف"}</span>
              </button>
            </div>

            <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-red-700">حذف الحساب نهائياً</div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => handleDeleteAccount(selectedUser)}
                    className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    تأكيد الحذف
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== VIEW: MAIN ACCOUNTS DIRECTORY ====================
  return (
    <div className="space-y-5" dir="rtl">
      {notice && (
        <div
          className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
            notice.isError ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {recentCredentials && recentCredentials.action === "created" && (
        <div className="bg-white border border-emerald-200 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-bold text-emerald-800">
              بيانات الحساب الجديد جاهزة للنسخ (تظهر هذه المرة فقط)
            </div>
            <button
              type="button"
              onClick={() => setRecentCredentials(null)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono" dir="ltr">
              <span className="font-bold text-slate-900">@{recentCredentials.username}</span>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-slate-900">
                {showRecentPw ? recentCredentials.password : "••••••••••••"}
              </span>
              <button
                type="button"
                onClick={() => setShowRecentPw((p) => !p)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                title={showRecentPw ? "إخفاء" : "إظهار"}
              >
                {showRecentPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleCopyCredentials(recentCredentials.username, recentCredentials.password)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              {copiedCredentials ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCredentials ? "تم النسخ" : "نسخ بيانات الدخول"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Section 1: Summary & Primary Action */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3.5 flex items-center justify-between gap-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">ملخص الحسابات</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchUsers}
              disabled={loadingUsers}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center cursor-pointer disabled:opacity-50"
              title="تحديث"
            >
              <RefreshCw className={`w-4 h-4 ${loadingUsers ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={openCreateView}
              className="h-9 px-4 rounded-xl bg-[#004ac6] hover:bg-[#003ea8] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة حساب</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 divide-x divide-x-reverse divide-slate-100 text-center py-3 tabular-nums">
          <div>
            <div className="text-base font-bold text-slate-900">{computedSummary.total}</div>
            <div className="text-[11px] text-slate-500">الإجمالي</div>
          </div>
          <div>
            <div className="text-base font-bold text-emerald-700">{computedSummary.active}</div>
            <div className="text-[11px] text-slate-500">نشط</div>
          </div>
          <div>
            <div className={`text-base font-bold ${computedSummary.suspended > 0 ? "text-red-700" : "text-slate-900"}`}>
              {computedSummary.suspended}
            </div>
            <div className="text-[11px] text-slate-500">موقوف</div>
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">{computedSummary.activeSessions}</div>
            <div className="text-[11px] text-slate-500">جلسات نشطة</div>
          </div>
        </div>
      </div>

      {/* Section 2: Users Directory */}
      <div className="space-y-2">
        <div className="px-1 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-500">الحسابات المسجلة</h4>
          <span className="text-xs text-slate-400 tabular-nums">{filteredUsers.length}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Search + Simple Segmented Tabs */}
          <div className="p-3 border-b border-slate-100 space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم أو اسم المستخدم..."
                className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-8 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#004ac6] outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              {[
                { id: "all", label: "الكل" },
                { id: "admin", label: "المديرون" },
                { id: "user", label: "المستخدمون" },
                { id: "suspended", label: "الموقوفون" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setListFilter(tab.id as any)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    listFilter === tab.id
                      ? "bg-white text-[#004ac6] shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clean Users Rows */}
          {loadingUsers ? (
            <div className="divide-y divide-slate-100">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-4 py-3.5 flex items-center justify-between animate-pulse">
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-28 bg-slate-200 rounded" />
                    <div className="h-2.5 w-40 bg-slate-100 rounded" />
                  </div>
                  <div className="h-4 w-12 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : usersError ? (
            <div className="p-6 text-center text-xs text-red-700 font-semibold">{usersError}</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">لا توجد حسابات مطابقة.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const isCurrent = currentUser?.id === u.id;
                const isSuspended = u.status === "suspended";
                const isAdmin = u.role === "admin";

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => openUserDetail(u)}
                    className="w-full min-h-[60px] px-4 py-3 flex items-center justify-between gap-3 text-right hover:bg-slate-50 active:bg-slate-100/80 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        {isAdmin ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {u.name || u.username}
                          </span>
                          {isCurrent && <span className="text-[11px] font-semibold text-[#004ac6]">(أنت)</span>}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono" dir="ltr">@{u.username}</span>
                          <span aria-hidden="true">·</span>
                          <span>{isAdmin ? "مدير" : "مستخدم"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`text-xs font-bold ${isSuspended ? "text-red-700" : "text-emerald-700"}`}>
                        {isSuspended ? "موقوف" : "نشط"}
                      </span>
                      <ChevronLeft className="w-4 h-4 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Data & Maintenance (Cleanly Divided Rows) */}
      <div className="space-y-2">
        <h4 className="px-1 text-xs font-bold text-slate-500">أدوات البيانات والمزامنة</h4>

        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          {/* Row 1: Export CSV */}
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-900">تصدير سجل الحسابات</div>
              <div className="text-[11px] text-slate-500 mt-0.5">تنزيل قائمة المستخدمين بصيغة CSV</div>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredUsers.length === 0}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير</span>
            </button>
          </div>

          {/* Row 2: Browser Cache Recovery */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900">استعادة بيانات المتصفح</div>
                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  {browserCacheInfo.foldersCount} مجلد · {browserCacheInfo.cardsCount} بطاقة
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={scanBrowserCache}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                  title="إعادة الفحص"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                {(browserCacheInfo.foldersCount > 0 || browserCacheInfo.cardsCount > 0) && (
                  <button
                    type="button"
                    onClick={handleRestoreFromBrowser}
                    disabled={recovering}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {recovering ? "جاري الاستعادة..." : "استعادة"}
                  </button>
                )}
              </div>
            </div>
            {recoveryMessage && (
              <div className="text-xs font-semibold text-emerald-700">{recoveryMessage}</div>
            )}
          </div>

          {/* Row 3: Supabase SQL */}
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900">ربط جدول المستخدمين في Supabase</div>
              <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5" dir="ltr">
                ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS &quot;userId&quot; TEXT;
              </div>
            </div>
            <button
              type="button"
              onClick={copySqlToClipboard}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? "تم النسخ" : "نسخ SQL"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

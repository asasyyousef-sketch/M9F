import React, { useState, useEffect } from "react";
import {
  FolderOpen,
  Settings,
  X,
  Database,
  Copy,
  Check,
  Sparkles,
  Trash2,
  PenTool,
  Film,
  PanelRightClose,
  PanelRightOpen,
  BookOpen,
  BookMarked,
  NotebookPen,
  Headphones,
  Languages,
  LogOut
} from "lucide-react";
import { Folder as FolderType, Flashcard, DbStatus } from "../types";
import { useAuth } from "../context/AuthContext";
import {
  loadSecondarySectionsVisibility,
  SecondarySectionsVisibility
} from "../utils/sidebarSections";
import { PWAInstallButton } from "./PWAInstallBanner";

interface SidebarProps {
  folders: FolderType[];
  cards?: Flashcard[];
  activeFolderId: string;
  onSelectFolder: (id: string) => void;
  onHomeClick: () => void;
  onSettingsClick?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  dbStatus?: DbStatus;
  activeTab?: "library" | "books" | "ai" | "trash" | "corrector" | "media" | "notes" | "shadowing" | "verbs";
  onSelectBooks?: () => void;
  onSelectAI?: () => void;
  onSelectTrash?: () => void;
  onSelectCorrector?: () => void;
  onSelectMedia?: () => void;
  onSelectNotes?: () => void;
  onSelectShadowing?: () => void;
  onSelectVerbs?: () => void;
  onDataReloaded?: (folders: any[], cards: any[]) => void;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  folders,
  cards = [],
  activeFolderId,
  onSelectFolder,
  onHomeClick,
  onSettingsClick,
  isOpen = false,
  onClose,
  dbStatus,
  activeTab = "library",
  onSelectBooks,
  onSelectAI,
  onSelectTrash,
  onSelectCorrector,
  onSelectMedia,
  onSelectNotes,
  onSelectShadowing,
  onSelectVerbs,
  onDataReloaded
}) => {
  // Collapsible Mini-Rail state (Slim Icon Bar)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };



  // Secondary sidebar sections visibility (hidden by default; controlled from Settings)
  const [secondaryVisibility, setSecondaryVisibility] = useState<SecondarySectionsVisibility>(
    () => loadSecondarySectionsVisibility()
  );

  useEffect(() => {
    const syncVisibility = () => {
      setSecondaryVisibility(loadSecondarySectionsVisibility());
    };
    window.addEventListener("app_settings_changed", syncVisibility);
    window.addEventListener("storage", syncVisibility);
    return () => {
      window.removeEventListener("app_settings_changed", syncVisibility);
      window.removeEventListener("storage", syncVisibility);
    };
  }, []);

  const hasAnySecondaryMediaSection =
    secondaryVisibility.media || secondaryVisibility.notes || secondaryVisibility.shadowing;

  const { currentUser, authFetch, logout } = useAuth();
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Manual Sync states
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleForcePush = async () => {
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      const res = await authFetch("/api/sync/push", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "حدث خطأ أثناء رفع الملفات");
      setSyncMessage({ text: data.message || "تم الرفع والمزامنة بنجاح!", isError: false });
    } catch (err: any) {
      setSyncMessage({ text: err.message || "فشل الرفع", isError: true });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleForcePull = async () => {
    if (!window.confirm("تنبيه هام جداً:\nسيقوم هذا الإجراء باستبدال كافة المجلدات والبطاقات المحلية الحالية واسترجاع البيانات المحفوظة في السحابة فقط.\nهل أنت متأكد من رغبتك بالاستمرار؟")) {
      return;
    }
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      const res = await authFetch("/api/sync/pull", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "حدث خطأ أثناء جلب البيانات");
      if (onDataReloaded && data.folders && data.cards) {
        onDataReloaded(data.folders, data.cards);
      }
      setSyncMessage({ text: data.message || "تم سحب واستعادة البيانات السحابية بنجاح!", isError: false });
    } catch (err: any) {
      setSyncMessage({ text: err.message || "فشل سحب البيانات", isError: true });
    } finally {
      setSyncLoading(false);
    }
  };



  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden transition-opacity duration-200"
          onClick={onClose}
        />
      )}

      {/* Sidebar aside */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 bg-white font-sans text-sm flex flex-col border-l border-slate-200 shrink-0 h-full overflow-hidden transition-all duration-300 ease-in-out md:translate-x-0 md:relative md:flex select-none shadow-xs ${
          isOpen ? "translate-x-0 shadow-2xl" : "translate-x-full md:translate-x-0"
        } ${isCollapsed ? "md:w-[68px] md:min-w-[68px] md:max-w-[68px] w-64" : "w-64 min-w-[16rem] max-w-[16rem]"}`}
        dir="rtl"
      >
        {/* ========================================================================= */}
        {/* 1. SIDEBAR HEADER */}
        {/* ========================================================================= */}
        <div className={`pt-4 pb-3 flex items-center border-b border-slate-200/80 shrink-0 ${isCollapsed ? "px-2 justify-center md:flex-col gap-2" : "px-3.5 justify-between"}`}>
          {!isCollapsed ? (
            <>
              <div 
                onClick={onHomeClick}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl overflow-hidden shadow-2xs border border-slate-200/80 bg-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <img
                    src="/ico.png"
                    alt="مدرب اللغات"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-sm font-black text-slate-900 tracking-tight leading-none">
                    مدرب اللغات
                  </h1>
                  <span className="text-[10px] text-slate-400 font-medium">المنصة التعليمية</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Desktop Collapse Toggle */}
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="طي القائمة الجانبية"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>

                {/* Mobile Close Button */}
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div 
                onClick={onHomeClick}
                className="w-9 h-9 rounded-xl overflow-hidden shadow-2xs border border-slate-200/80 bg-white flex items-center justify-center cursor-pointer hover:scale-105 transition-transform" 
                title="مدرب اللغات"
              >
                <img
                  src="/ico.png"
                  alt="مدرب اللغات"
                  className="w-7 h-7 object-contain"
                />
              </div>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="توسيع القائمة الجانبية"
              >
                <PanelRightOpen className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 2. CATEGORIZED NAVIGATION ITEMS */}
        {/* ========================================================================= */}
        <nav className="py-3 px-2.5 flex-1 overflow-y-auto overflow-x-hidden space-y-4 custom-scrollbar">

          {/* CATEGORY 1: التعلّم والمحتوى (CORE LEARNING) */}
          <div className="space-y-1.5">
            {!isCollapsed && (
              <div className="px-2 pb-0.5 flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-500 tracking-wide">
                  التعلّم والمحتوى
                </span>
              </div>
            )}

            {/* المكتبة (Blue) */}
            <button
              type="button"
              onClick={() => {
                onSelectFolder("");
                onClose?.();
              }}
              title="المكتبة"
              className={`w-full relative flex items-center gap-2.5 rounded-xl text-right transition-all duration-150 font-bold text-[12.5px] cursor-pointer group border ${
                isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "px-2.5 py-2 min-h-[42px]"
              } ${
                activeTab === "library"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-blue-50/45 text-slate-800 border-blue-100 hover:bg-blue-50 hover:border-blue-300"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  activeTab === "library"
                    ? "bg-white/20 text-white"
                    : "bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                }`}
              >
                <FolderOpen className="w-4 h-4" />
              </div>
              {!isCollapsed && (
                <span className="truncate whitespace-nowrap">المكتبة</span>
              )}
            </button>

            {/* الكتب الرقمية (Indigo - Always Visible Shortcut) */}
            <button
              type="button"
              onClick={() => {
                onSelectBooks?.();
                onClose?.();
              }}
              title="الكتب الرقمية"
              className={`w-full relative flex items-center gap-2.5 rounded-xl text-right transition-all duration-150 font-bold text-[12.5px] cursor-pointer group border ${
                isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "px-2.5 py-2 min-h-[42px]"
              } ${
                activeTab === "books"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-indigo-50/45 text-slate-800 border-indigo-100 hover:bg-indigo-50 hover:border-indigo-300"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  activeTab === "books"
                    ? "bg-white/20 text-white"
                    : "bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
                }`}
              >
                <BookMarked className="w-4 h-4" />
              </div>
              {!isCollapsed && (
                <span className="truncate whitespace-nowrap">الكتب الرقمية</span>
              )}
            </button>

            {/* تصريف الأفعال (Amber) */}
            <button
              type="button"
              onClick={() => {
                onSelectVerbs?.();
                onClose?.();
              }}
              title="تصريف الأفعال"
              className={`w-full relative flex items-center gap-2.5 rounded-xl text-right transition-all duration-150 font-bold text-[12.5px] cursor-pointer group border ${
                isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "px-2.5 py-2 min-h-[42px]"
              } ${
                activeTab === "verbs"
                  ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                  : "bg-amber-50/50 text-slate-800 border-amber-200/70 hover:bg-amber-50 hover:border-amber-300"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  activeTab === "verbs"
                    ? "bg-white/20 text-white"
                    : "bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-white"
                }`}
              >
                <Languages className="w-4 h-4" />
              </div>
              {!isCollapsed && (
                <span className="truncate whitespace-nowrap">تصريف الأفعال</span>
              )}
            </button>
          </div>

          <div className="border-t border-slate-100" />

          {/* CATEGORY 2: الأدوات الذكية (SMART TOOLS) */}
          <div className="space-y-1.5">
            {!isCollapsed && (
              <div className="px-2 pb-0.5 flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-500 tracking-wide">
                  الأدوات الذكية
                </span>
              </div>
            )}

            {/* المساعد الذكي (Violet) */}
            <button
              type="button"
              onClick={() => {
                onSelectAI?.();
                onClose?.();
              }}
              title="المساعد الذكي"
              className={`w-full relative flex items-center gap-2.5 rounded-xl text-right transition-all duration-150 font-bold text-[12.5px] cursor-pointer group border ${
                isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "px-2.5 py-2 min-h-[42px]"
              } ${
                activeTab === "ai"
                  ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                  : "bg-violet-50/45 text-slate-800 border-violet-100 hover:bg-violet-50 hover:border-violet-300"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  activeTab === "ai"
                    ? "bg-white/20 text-white"
                    : "bg-violet-100 text-violet-600 group-hover:bg-violet-600 group-hover:text-white"
                }`}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              {!isCollapsed && (
                <span className="truncate whitespace-nowrap">المساعد الذكي</span>
              )}
            </button>

            {/* المصحح اللغوي (Emerald - Secondary, visible only if enabled in Settings) */}
            {secondaryVisibility.corrector && (
              <button
                type="button"
                onClick={() => {
                  onSelectCorrector?.();
                  onClose?.();
                }}
                title="المصحح اللغوي"
                className={`w-full relative flex items-center gap-2.5 rounded-xl text-right transition-all duration-150 font-bold text-[12.5px] cursor-pointer group border ${
                  isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "px-2.5 py-2 min-h-[42px]"
                } ${
                  activeTab === "corrector"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-emerald-50/45 text-slate-800 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-300"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    activeTab === "corrector"
                      ? "bg-white/20 text-white"
                      : "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"
                  }`}
                >
                  <PenTool className="w-4 h-4" />
                </div>
                {!isCollapsed && (
                  <span className="truncate whitespace-nowrap">المصحح اللغوي</span>
                )}
              </button>
            )}
          </div>

          {/* CATEGORY 3: الأقسام الثانوية (MEDIA & EXTRA PRACTICE - Hidden by default unless toggled in Settings) */}
          {hasAnySecondaryMediaSection && (
            <>
              <div className="border-t border-slate-100" />
              <div className="space-y-1.5">
                {!isCollapsed && (
                  <div className="px-2 pb-0.5 flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-500 tracking-wide">
                      الوسائط والممارسة
                    </span>
                  </div>
                )}

                {/* مشغل الوسائط (Cyan) */}
                {secondaryVisibility.media && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectMedia?.();
                      onClose?.();
                    }}
                    title="مشغل الوسائط"
                    className={`w-full relative flex items-center gap-2.5 rounded-xl text-right transition-all duration-150 font-bold text-[12.5px] cursor-pointer group border ${
                      isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "px-2.5 py-2 min-h-[42px]"
                    } ${
                      activeTab === "media"
                        ? "bg-cyan-600 text-white border-cyan-600 shadow-sm"
                        : "bg-cyan-50/45 text-slate-800 border-cyan-100 hover:bg-cyan-50 hover:border-cyan-300"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        activeTab === "media"
                          ? "bg-white/20 text-white"
                          : "bg-cyan-100 text-cyan-700 group-hover:bg-cyan-600 group-hover:text-white"
                      }`}
                    >
                      <Film className="w-4 h-4" />
                    </div>
                    {!isCollapsed && (
                      <span className="truncate whitespace-nowrap">مشغل الوسائط</span>
                    )}
                  </button>
                )}

                {/* الكتابات (Teal) */}
                {secondaryVisibility.notes && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectNotes?.();
                      onClose?.();
                    }}
                    title="الكتابات"
                    className={`w-full relative flex items-center gap-2.5 rounded-xl text-right transition-all duration-150 font-bold text-[12.5px] cursor-pointer group border ${
                      isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "px-2.5 py-2 min-h-[42px]"
                    } ${
                      activeTab === "notes"
                        ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                        : "bg-teal-50/45 text-slate-800 border-teal-100 hover:bg-teal-50 hover:border-teal-300"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        activeTab === "notes"
                          ? "bg-white/20 text-white"
                          : "bg-teal-100 text-teal-700 group-hover:bg-teal-600 group-hover:text-white"
                      }`}
                    >
                      <NotebookPen className="w-4 h-4" />
                    </div>
                    {!isCollapsed && (
                      <span className="truncate whitespace-nowrap">الكتابات</span>
                    )}
                  </button>
                )}

                {/* استوديو الشادوينج (Orange) */}
                {secondaryVisibility.shadowing && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectShadowing?.();
                      onClose?.();
                    }}
                    title="استوديو الشادوينج"
                    className={`w-full relative flex items-center gap-2.5 rounded-xl text-right transition-all duration-150 font-bold text-[12.5px] cursor-pointer group border ${
                      isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "px-2.5 py-2 min-h-[42px]"
                    } ${
                      activeTab === "shadowing"
                        ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                        : "bg-orange-50/45 text-slate-800 border-orange-100 hover:bg-orange-50 hover:border-orange-300"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        activeTab === "shadowing"
                          ? "bg-white/20 text-white"
                          : "bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white"
                      }`}
                    >
                      <Headphones className="w-4 h-4" />
                    </div>
                    {!isCollapsed && (
                      <span className="truncate whitespace-nowrap">استوديو الشادوينج</span>
                    )}
                  </button>
                )}
              </div>
            </>
          )}

          <div className="border-t border-slate-100" />

          {/* CATEGORY 4: النظام (SYSTEM) */}
          <div className="space-y-1.5">
            {!isCollapsed && (
              <div className="px-2 pb-0.5 flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-500 tracking-wide">
                  النظام
                </span>
              </div>
            )}

            {/* سلة المهملات (Rose) */}
            <button
              type="button"
              onClick={() => {
                onSelectTrash?.();
                onClose?.();
              }}
              title="سلة المهملات"
              className={`w-full relative flex items-center gap-2.5 rounded-xl text-right transition-all duration-150 font-bold text-[12.5px] cursor-pointer group border ${
                isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "px-2.5 py-2 min-h-[42px]"
              } ${
                activeTab === "trash"
                  ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                  : "bg-rose-50/40 text-slate-800 border-rose-100 hover:bg-rose-50 hover:border-rose-300"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  activeTab === "trash"
                    ? "bg-white/20 text-white"
                    : "bg-rose-100 text-rose-600 group-hover:bg-rose-600 group-hover:text-white"
                }`}
              >
                <Trash2 className="w-4 h-4" />
              </div>
              {!isCollapsed && <span className="truncate whitespace-nowrap">سلة المهملات</span>}
            </button>
          </div>
        </nav>

        {/* ========================================================================= */}
        {/* 4. SLEEK COMPACT FOOTER (SYNC STATUS + SETTINGS) */}
        {/* ========================================================================= */}
        <div className={`p-2.5 border-t border-slate-200 bg-slate-50/70 backdrop-blur-xs space-y-1.5 shrink-0 ${isCollapsed ? "flex flex-col items-center" : ""}`}>
          
          {/* Supabase Status Pill */}
          {dbStatus && dbStatus.supabaseActive ? (
            !isCollapsed ? (
              <div className="p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  {dbStatus.tablesExist ? (
                    <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  )}
                  <span className="font-semibold text-[11px] text-slate-700 truncate">
                    {dbStatus.tablesExist ? "مزامنة سحابية نشطة" : "إعداد جداول Supabase"}
                  </span>
                </div>

                {!dbStatus.tablesExist && (
                  <button
                    type="button"
                    onClick={() => setIsSqlModalOpen(true)}
                    className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    SQL
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => !dbStatus.tablesExist && setIsSqlModalOpen(true)}
                title={dbStatus.tablesExist ? "مزامنة سحابية نشطة (Supabase Connected)" : "جداول Supabase مفقودة - اضغط للتهيئة"}
                className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer relative shadow-2xs"
              >
                <Database className="w-4 h-4 text-slate-600" />
                <span
                  className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                    dbStatus.tablesExist ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
              </button>
            )
          ) : null}

          {/* PWA Install Action (hidden automatically when already installed or unsupported) */}
          <PWAInstallButton variant="sidebar" collapsed={isCollapsed} />

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => {
              onSettingsClick?.();
              onClose?.();
            }}
            title="إعدادات النظام"
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-right text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-semibold text-xs cursor-pointer ${
              isCollapsed ? "justify-center px-0 w-9 h-9 mx-auto" : ""
            }`}
          >
            <Settings className="w-4 h-4 text-slate-500 shrink-0" />
            {!isCollapsed && <span>إعدادات النظام</span>}
          </button>

          {/* Logout Button */}
          {currentUser && (
            <button
              type="button"
              onClick={() => {
                logout();
                onClose?.();
              }}
              title="تسجيل الخروج"
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-right text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors font-semibold text-xs cursor-pointer ${
                isCollapsed ? "justify-center px-0 w-9 h-9 mx-auto" : ""
              }`}
            >
              <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
              {!isCollapsed && <span>تسجيل الخروج</span>}
            </button>
          )}
        </div>
      </aside>

      {/* SQL SCHEMA GENERATOR MODAL */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]" dir="rtl">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-800">تهيئة قاعدة بيانات Supabase</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">
                مرحباً! لحل مشكلة عدم وجود جداول (<span className="text-rose-600 font-mono text-[11px]">Could not find table public.decks</span>)، يرجى نسخ هذا الكود البرمجي ولصقه في لوحة تحكم Supabase الخاصة بك:
              </p>

              <div className="bg-blue-50/70 border border-blue-100 p-3 rounded-xl space-y-2">
                <span className="font-bold text-blue-900 block">خطوات الإعداد السريعة:</span>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 leading-relaxed pr-2">
                  <li>افتح لوحة تحكم <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold">Supabase Dashboard</a> وانتقل إلى مشروعك.</li>
                  <li>من القائمة الجانبية اليسرى، انتقل إلى <strong>SQL Editor</strong>.</li>
                  <li>اضغط على <strong>New Query</strong> لفتح محرر جديد.</li>
                  <li>قم بلصق كود الـ SQL المنسوخ أدناه ثم اضغط على زر <strong>Run</strong> (أو اضغط CMD/Ctrl + Enter).</li>
                </ol>
              </div>

              {/* Code Container */}
              <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-900">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 text-[10px] font-mono text-slate-400">
                  <span>supabase_schema.sql</span>
                  <button
                    type="button"
                    onClick={() => {
                      const sql = `
-- 1. Create decks table
CREATE TABLE IF NOT EXISTS public.decks (
  id TEXT PRIMARY KEY,
  "parentId" TEXT REFERENCES public.decks(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  "coverImage" TEXT,
  "coverImagePosition" TEXT DEFAULT '50% 50%',
  "frontLang" TEXT NOT NULL,
  "backLang" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist to avoid errors
DROP POLICY IF EXISTS "Allow public read access" ON public.decks;
DROP POLICY IF EXISTS "Allow public write access" ON public.decks;

CREATE POLICY "Allow public read access" ON public.decks FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.decks FOR ALL USING (true);

-- 2. Create cards table
CREATE TABLE IF NOT EXISTS public.cards (
  id TEXT PRIMARY KEY,
  "folderId" TEXT REFERENCES public.decks(id) ON DELETE CASCADE NOT NULL,
  "frontText" TEXT NOT NULL,
  "frontLang" TEXT NOT NULL,
  "frontImage" TEXT,
  "frontImagePosition" TEXT DEFAULT '50% 50%',
  "frontAudioUrl" TEXT,
  "backText" TEXT NOT NULL,
  "backLang" TEXT NOT NULL,
  "backImage" TEXT,
  "backImagePosition" TEXT DEFAULT '50% 50%',
  "backAudioUrl" TEXT,
  "isArticleMode" BOOLEAN DEFAULT false,
  "correctArticle" TEXT DEFAULT '',
  "isPluralMode" BOOLEAN DEFAULT false,
  "pluralText" TEXT DEFAULT '',
  "pluralLang" TEXT DEFAULT 'de',
  "translationHint" TEXT,
  streak INTEGER DEFAULT 0 NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist to avoid errors
DROP POLICY IF EXISTS "Allow public read access" ON public.cards;
DROP POLICY IF EXISTS "Allow public write access" ON public.cards;

CREATE POLICY "Allow public read access" ON public.cards FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.cards FOR ALL USING (true);

-- 3. MIGRATION FOR EXISTING TABLES
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS "isPluralMode" BOOLEAN DEFAULT false;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS "pluralText" TEXT DEFAULT '';
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS "pluralLang" TEXT DEFAULT 'de';
`.trim();
                      navigator.clipboard.writeText(sql);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-700 text-slate-200 rounded transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                        <span>نسخ الكود</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-4 text-[10px] font-mono text-slate-300 overflow-x-auto overflow-y-auto max-h-[160px] leading-relaxed text-left ltr select-all">
{`-- 1. Create decks table (folders)
CREATE TABLE IF NOT EXISTS public.decks (
  id TEXT PRIMARY KEY,
  "parentId" TEXT REFERENCES public.decks(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  "coverImage" TEXT,
  "coverImagePosition" TEXT DEFAULT '50% 50%',
  "frontLang" TEXT NOT NULL,
  "backLang" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist to avoid errors
DROP POLICY IF EXISTS "Allow public read access" ON public.decks;
DROP POLICY IF EXISTS "Allow public write access" ON public.decks;

CREATE POLICY "Allow public read access" ON public.decks FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.decks FOR ALL USING (true);

-- 2. Create cards table (flashcards)
CREATE TABLE IF NOT EXISTS public.cards (
  id TEXT PRIMARY KEY,
  "folderId" TEXT REFERENCES public.decks(id) ON DELETE CASCADE NOT NULL,
  "frontText" TEXT NOT NULL,
  "frontLang" TEXT NOT NULL,
  "frontImage" TEXT,
  "frontImagePosition" TEXT DEFAULT '50% 50%',
  "frontAudioUrl" TEXT,
  "backText" TEXT NOT NULL,
  "backLang" TEXT NOT NULL,
  "backImage" TEXT,
  "backImagePosition" TEXT DEFAULT '50% 50%',
  "backAudioUrl" TEXT,
  "isArticleMode" BOOLEAN DEFAULT false,
  "correctArticle" TEXT DEFAULT '',
  "isPluralMode" BOOLEAN DEFAULT false,
  "pluralText" TEXT DEFAULT '',
  "pluralLang" TEXT DEFAULT 'de',
  "translationHint" TEXT,
  streak INTEGER DEFAULT 0 NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist to avoid errors
DROP POLICY IF EXISTS "Allow public read access" ON public.cards;
DROP POLICY IF EXISTS "Allow public write access" ON public.cards;

CREATE POLICY "Allow public read access" ON public.cards FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.cards FOR ALL USING (true);

-- 3. MIGRATION FOR EXISTING TABLES
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS "isPluralMode" BOOLEAN DEFAULT false;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS "pluralText" TEXT DEFAULT '';
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS "pluralLang" TEXT DEFAULT 'de';`}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition-all"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

import React, { useState, useEffect } from "react";
import {
  Folder,
  FolderOpen,
  History,
  Star,
  Settings,
  ChevronLeft,
  ChevronDown,
  X,
  Database,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  Sparkles,
  Trash2,
  Youtube,
  PenTool,
  Film,
  PanelRightClose,
  PanelRightOpen,
  Layers,
  Search,
  BookOpen
} from "lucide-react";
import { Folder as FolderType, DbStatus } from "../types";

interface SidebarProps {
  folders: FolderType[];
  activeFolderId: string;
  onSelectFolder: (id: string) => void;
  onHomeClick: () => void;
  onSettingsClick?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  dbStatus?: DbStatus;
  activeTab?: "library" | "ai" | "trash" | "youtube" | "corrector" | "media";
  onSelectAI?: () => void;
  onSelectTrash?: () => void;
  onSelectYoutube?: () => void;
  onSelectCorrector?: () => void;
  onSelectMedia?: () => void;
  onDataReloaded?: (folders: any[], cards: any[]) => void;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  folders,
  activeFolderId,
  onSelectFolder,
  onHomeClick,
  onSettingsClick,
  isOpen = false,
  onClose,
  dbStatus,
  activeTab = "library",
  onSelectAI,
  onSelectTrash,
  onSelectYoutube,
  onSelectCorrector,
  onSelectMedia,
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

  // Folder search filter in sidebar
  const [searchQuery, setSearchQuery] = useState("");

  // Keep track of expanded state for collapsible folders
  const [isLibraryExpanded, setIsLibraryExpanded] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    "folder-chemistry-root": true,
    "folder-organic": true,
  });

  // Mini rail quick folder popover
  const [isMiniFolderMenuOpen, setIsMiniFolderMenuOpen] = useState(false);

  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Manual Sync states
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleForcePush = async () => {
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/sync/push", { method: "POST" });
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
      const res = await fetch("/api/sync/pull", { method: "POST" });
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

  // Helper to check if a folder is active or has an active descendant
  const isFolderActiveOrDescendantActive = (folderId: string): boolean => {
    if (activeFolderId === folderId) return true;
    const children = folders.filter((f) => f.parentId === folderId);
    return children.some((child) => isFolderActiveOrDescendantActive(child.id));
  };

  // Find all root-level folders (folders with no parent or whose parent is missing)
  const rootFolders = folders.filter(
    (f) => !f.parentId || !folders.some((p) => p.id === f.parentId)
  );

  // Filter folders by search query if present
  const filteredRootFolders = searchQuery.trim()
    ? rootFolders.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        folders.some(
          (sub) =>
            sub.parentId === f.id &&
            sub.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : rootFolders;

  // Consistent sorting: predefined folders first, then custom folders by creation date
  const sortedRootFolders = [...filteredRootFolders].sort((a, b) => {
    const predefinedOrder = ["folder-math", "folder-chemistry-root", "folder-physics"];
    const indexA = predefinedOrder.indexOf(a.id);
    const indexB = predefinedOrder.indexOf(b.id);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Sort subfolders
  const getSortedChildren = (parentId: string) => {
    const children = folders.filter((f) => f.parentId === parentId);
    return [...children].sort((a, b) => {
      const predefinedOrder = ["folder-organic", "folder-inorganic", "folder-alkanes"];
      const indexA = predefinedOrder.indexOf(a.id);
      const indexB = predefinedOrder.indexOf(b.id);

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  };

  // Recursive dynamic folder tree renderer
  const renderFolderTree = (folder: FolderType, depth: number) => {
    const children = getSortedChildren(folder.id);
    const hasKids = children.length > 0;
    const isExpanded = !!expandedFolders[folder.id];
    const isActive = activeFolderId === folder.id;
    const isHighlight = isFolderActiveOrDescendantActive(folder.id);

    return (
      <div key={folder.id} className="flex flex-col">
        {/* Folder Item Row */}
        <button
          onClick={() => {
            onSelectFolder(folder.id);
            onClose?.();
            if (hasKids && !isExpanded) {
              setExpandedFolders((prev) => ({ ...prev, [folder.id]: true }));
            }
          }}
          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-right transition-all text-xs cursor-pointer ${
            isActive
              ? "bg-[#0056f6]/10 text-[#0056f6] font-bold"
              : isHighlight
              ? "text-[#0056f6] font-semibold hover:bg-slate-200/50"
              : "text-slate-700 hover:bg-slate-200/50 font-medium"
          }`}
          style={{ marginRight: `${depth * 10}px` }}
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: folder.color || "#64748b" }}
            />
            <span className="truncate">{folder.name}</span>
          </div>

          {hasKids && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setExpandedFolders((prev) => ({ ...prev, [folder.id]: !prev[folder.id] }));
              }}
              className="p-1 hover:bg-black/5 rounded-md transition-colors cursor-pointer shrink-0"
            >
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform ${
                  isExpanded ? "transform rotate-0" : "transform -rotate-90"
                }`}
              />
            </div>
          )}
        </button>

        {/* Nested Children */}
        {hasKids && isExpanded && (
          <div className="flex flex-col mr-3 border-r border-slate-200 pr-1.5 mt-0.5 mb-1">
            {children.map((child) => renderFolderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
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
        className={`fixed inset-y-0 right-0 z-50 bg-[#f8fafc] font-sans text-sm flex flex-col border-l border-slate-200/80 shrink-0 h-full overflow-hidden transition-all duration-300 ease-in-out md:translate-x-0 md:relative md:flex ${
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        } ${isCollapsed ? "md:w-[68px] w-64" : "w-64"}`}
        dir="rtl"
      >
        {/* ========================================================================= */}
        {/* 1. SIDEBAR HEADER */}
        {/* ========================================================================= */}
        <div className={`pt-4 pb-3 flex items-center border-b border-slate-200/60 ${isCollapsed ? "px-2.5 justify-center md:flex-col gap-2" : "px-4 justify-between"}`}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0056f6] to-indigo-600 flex items-center justify-center text-white shadow-xs">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-none">
                    StudySmarter
                  </h1>
                  <span className="text-[10px] text-slate-400 font-medium">المنصة التعليمية</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Desktop Collapse Toggle */}
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                  title="طي القائمة الجانبية (Slim Rail)"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>

                {/* Mobile Close Button */}
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0056f6] to-indigo-600 flex items-center justify-center text-white shadow-xs" title="StudySmarter">
                <BookOpen className="w-4 h-4" />
              </div>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                title="توسيع القائمة الجانبية"
              >
                <PanelRightOpen className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 2. SEARCH BAR (EXPANDED ONLY) */}
        {/* ========================================================================= */}
        {!isCollapsed && (
          <div className="px-3 pt-2.5 pb-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث في المجلدات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-2.5 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#0056f6] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. NAVIGATION ITEMS */}
        {/* ========================================================================= */}
        <nav className="py-2 px-2 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
          
          {/* SECTION: WORKSPACE & AI TOOLS */}
          <div className="space-y-0.5">
            {!isCollapsed && (
              <div className="px-2 pb-1.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                مساحة العمل والذكاء
              </div>
            )}

            {/* AI Assistant */}
            <button
              type="button"
              onClick={() => {
                onSelectAI?.();
                onClose?.();
              }}
              title="المساعد الذكي"
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-right transition-all font-semibold text-xs cursor-pointer group ${
                isCollapsed ? "justify-center px-0" : ""
              } ${
                activeTab === "ai"
                  ? "bg-violet-600/10 text-violet-700 font-bold shadow-xs border border-violet-200/50"
                  : "text-slate-700 hover:bg-slate-200/60"
              }`}
            >
              <div className={`p-1 rounded-lg ${activeTab === "ai" ? "bg-violet-600 text-white" : "bg-violet-100 text-violet-600 group-hover:bg-violet-200"}`}>
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              {!isCollapsed && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="truncate">المساعد الذكي</span>
                  <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">AI</span>
                </div>
              )}
            </button>

            {/* YouTube Transcription */}
            <button
              type="button"
              onClick={() => {
                onSelectYoutube?.();
                onClose?.();
              }}
              title="تفريغ اليوتيوب"
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-right transition-all font-semibold text-xs cursor-pointer group ${
                isCollapsed ? "justify-center px-0" : ""
              } ${
                activeTab === "youtube"
                  ? "bg-rose-600/10 text-rose-700 font-bold shadow-xs border border-rose-200/50"
                  : "text-slate-700 hover:bg-slate-200/60"
              }`}
            >
              <div className={`p-1 rounded-lg ${activeTab === "youtube" ? "bg-rose-600 text-white" : "bg-rose-100 text-rose-600 group-hover:bg-rose-200"}`}>
                <Youtube className="w-3.5 h-3.5" />
              </div>
              {!isCollapsed && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="truncate">تفريغ اليوتيوب</span>
                  <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">spT</span>
                </div>
              )}
            </button>

            {/* AI Corrector */}
            <button
              type="button"
              onClick={() => {
                onSelectCorrector?.();
                onClose?.();
              }}
              title="المصحح الذكي"
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-right transition-all font-semibold text-xs cursor-pointer group ${
                isCollapsed ? "justify-center px-0" : ""
              } ${
                activeTab === "corrector"
                  ? "bg-emerald-600/10 text-emerald-700 font-bold shadow-xs border border-emerald-200/50"
                  : "text-slate-700 hover:bg-slate-200/60"
              }`}
            >
              <div className={`p-1 rounded-lg ${activeTab === "corrector" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200"}`}>
                <PenTool className="w-3.5 h-3.5" />
              </div>
              {!isCollapsed && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="truncate">المصحح الذكي</span>
                  <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Grammar</span>
                </div>
              )}
            </button>

            {/* Media Player */}
            <button
              type="button"
              onClick={() => {
                onSelectMedia?.();
                onClose?.();
              }}
              title="مشغل الوسائط"
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-right transition-all font-semibold text-xs cursor-pointer group ${
                isCollapsed ? "justify-center px-0" : ""
              } ${
                activeTab === "media"
                  ? "bg-blue-600/10 text-blue-700 font-bold shadow-xs border border-blue-200/50"
                  : "text-slate-700 hover:bg-slate-200/60"
              }`}
            >
              <div className={`p-1 rounded-lg ${activeTab === "media" ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-600 group-hover:bg-blue-200"}`}>
                <Film className="w-3.5 h-3.5" />
              </div>
              {!isCollapsed && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="truncate">مشغل الوسائط</span>
                  <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Media</span>
                </div>
              )}
            </button>
          </div>

          {/* SECTION: EDUCATIONAL LIBRARY & FOLDERS */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <>
                <div className="px-2 pb-1 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>المكتبة التعليمية</span>
                  <span className="text-[10px] text-slate-400 font-mono">({folders.length})</span>
                </div>

                {/* Root Library Button */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectFolder("");
                    onClose?.();
                    setIsLibraryExpanded(true);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-right transition-all font-bold text-xs cursor-pointer ${
                    activeFolderId === "" && activeTab === "library"
                      ? "bg-[#0056f6]/10 text-[#0056f6] border border-[#0056f6]/20"
                      : "text-slate-700 hover:bg-slate-200/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-[#0056f6]" />
                    <span>كافة البطاقات والمجلدات</span>
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLibraryExpanded(!isLibraryExpanded);
                    }}
                    className="p-1 hover:bg-black/5 rounded-md transition-colors cursor-pointer"
                  >
                    {isLibraryExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Folder Tree */}
                {isLibraryExpanded && (
                  <div className="pr-1 space-y-0.5 max-h-60 overflow-y-auto custom-scrollbar">
                    {sortedRootFolders.map((rootFolder) => renderFolderTree(rootFolder, 0))}
                  </div>
                )}
              </>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    onSelectFolder("");
                    onClose?.();
                  }}
                  title="المكتبة التعليمية"
                  className={`w-full flex items-center justify-center py-2 rounded-xl transition-all cursor-pointer ${
                    activeFolderId === "" && activeTab === "library"
                      ? "bg-[#0056f6]/10 text-[#0056f6]"
                      : "text-slate-700 hover:bg-slate-200/60"
                  }`}
                >
                  <FolderOpen className="w-4 h-4 text-[#0056f6]" />
                </button>
              </div>
            )}
          </div>

          {/* SECTION: SYSTEM & UTILITY */}
          <div className="space-y-0.5">
            {!isCollapsed && (
              <div className="px-2 pb-1.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                النظام والوصول السريع
              </div>
            )}

            {/* Recents */}
            <button
              type="button"
              onClick={() => {
                onSelectFolder("");
                onClose?.();
              }}
              title="العناصر الأخيرة"
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-right transition-all font-medium text-xs cursor-pointer text-slate-700 hover:bg-slate-200/60 ${
                isCollapsed ? "justify-center px-0" : ""
              }`}
            >
              <History className="w-4 h-4 text-slate-400 shrink-0" />
              {!isCollapsed && <span>العناصر الأخيرة</span>}
            </button>

            {/* Favorites */}
            <button
              type="button"
              onClick={() => {
                onSelectFolder("");
                onClose?.();
              }}
              title="المفضلة"
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-right transition-all font-medium text-xs cursor-pointer text-slate-700 hover:bg-slate-200/60 ${
                isCollapsed ? "justify-center px-0" : ""
              }`}
            >
              <Star className="w-4 h-4 text-amber-500 shrink-0" />
              {!isCollapsed && <span>المفضلة</span>}
            </button>

            {/* Trash */}
            <button
              type="button"
              onClick={() => {
                onSelectTrash?.();
                onClose?.();
              }}
              title="سلة المهملات"
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-right transition-all font-medium text-xs cursor-pointer ${
                isCollapsed ? "justify-center px-0" : ""
              } ${
                activeTab === "trash"
                  ? "bg-rose-50 text-rose-700 border border-rose-200 font-bold"
                  : "text-slate-700 hover:bg-slate-200/60"
              }`}
            >
              <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
              {!isCollapsed && <span>سلة المهملات</span>}
            </button>
          </div>
        </nav>

        {/* ========================================================================= */}
        {/* 4. SLEEK COMPACT FOOTER (SUPABASE PILL + SETTINGS) */}
        {/* ========================================================================= */}
        <div className={`p-2.5 border-t border-slate-200/80 bg-white/70 backdrop-blur-xs space-y-2 shrink-0 ${isCollapsed ? "flex flex-col items-center" : ""}`}>
          
          {/* Compact Supabase Sync Status Indicator */}
          {dbStatus && dbStatus.supabaseActive ? (
            !isCollapsed ? (
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {dbStatus.tablesExist ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  )}
                  <span className="font-bold text-[11px] text-slate-800 truncate">
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
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer relative"
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

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => {
              onSettingsClick?.();
              onClose?.();
            }}
            title="إعدادات النظام"
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-right text-slate-700 hover:bg-slate-100 transition-colors font-semibold text-xs cursor-pointer ${
              isCollapsed ? "justify-center px-0 w-9 h-9" : ""
            }`}
          >
            <Settings className="w-4 h-4 text-slate-500 shrink-0" />
            {!isCollapsed && <span>إعدادات النظام</span>}
          </button>
        </div>
      </aside>

      {/* SQL SCHEMA GENERATOR MODAL */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]" dir="rtl">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#0056f6]" />
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

              <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl space-y-2">
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

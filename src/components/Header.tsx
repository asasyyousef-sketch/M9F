import React from "react";
import { Search, FolderPlus, PlusCircle, Play, Sparkles, User, ShieldCheck, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenSettings
}) => {
  const { currentUser, logout } = useAuth();

  return (
    <header className="z-10 bg-surface-bright border-b border-outline-variant/30 px-3 sm:px-6 py-2 sm:py-3 shrink-0 flex flex-row items-center justify-between gap-3 font-sans" dir="rtl">
      {/* Brand Logo */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-pulse" />
        </div>
        <div>
          <h1 className="text-sm sm:text-xl font-bold text-on-surface tracking-tight font-display">StudySmarter</h1>
          <p className="hidden sm:block text-[10px] font-semibold text-on-surface-variant/70 leading-none">تكنولوجيا التكرار المتباعد الذكي</p>
        </div>
      </div>

      {/* Global Search Input */}
      <div className="flex-1 max-w-md relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="ابحث عن بطاقات أو مجلدات..."
          className="w-full bg-surface-container-low border border-outline-variant rounded-full py-1.5 sm:py-2 pr-9 sm:pr-12 pl-3 text-xs font-semibold text-on-surface placeholder-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
        <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-outline absolute right-3 sm:right-4 top-1/2 -translate-y-1/2" />
      </div>

      {/* User Status & Logout */}
      {currentUser && (
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-surface-container border border-outline-variant/50 text-xs">
            {currentUser.role === "admin" ? (
              <ShieldCheck className="w-4 h-4 text-purple-600" />
            ) : (
              <User className="w-4 h-4 text-blue-600" />
            )}
            <span className="font-bold text-on-surface max-w-[120px] truncate">
              {currentUser.name || currentUser.username}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                currentUser.role === "admin"
                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-300"
                  : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
              }`}
            >
              {currentUser.role === "admin" ? "مشرف" : "مستخدم"}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-surface-container-low border border-outline-variant/60 hover:bg-red-500/10 hover:border-red-500/30 text-on-surface-variant hover:text-red-600 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="تسجيل الخروج"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">خروج</span>
          </button>
        </div>
      )}
    </header>
  );
};


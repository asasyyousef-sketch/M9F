import React from "react";
import { FolderOpen, BookMarked, Languages, Sparkles, Menu } from "lucide-react";

type TabType = "library" | "books" | "ai" | "trash" | "corrector" | "media" | "notes" | "shadowing" | "verbs";

interface MobileBottomNavProps {
  activeTab: TabType;
  onSelectLibrary: () => void;
  onSelectVerbs: () => void;
  onSelectBooks: () => void;
  onSelectAI: () => void;
  onOpenMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = React.memo(({
  activeTab,
  onSelectLibrary,
  onSelectVerbs,
  onSelectBooks,
  onSelectAI,
  onOpenMenu,
}) => {
  const navItems = [
    {
      id: "library",
      label: "المكتبة",
      icon: FolderOpen,
      active: activeTab === "library",
      onClick: onSelectLibrary,
      activeColor: "text-blue-600 bg-blue-50",
    },
    {
      id: "verbs",
      label: "الأفعال",
      icon: Languages,
      active: activeTab === "verbs",
      onClick: onSelectVerbs,
      activeColor: "text-amber-600 bg-amber-50",
    },
    {
      id: "books",
      label: "الكتب",
      icon: BookMarked,
      active: activeTab === "books",
      onClick: onSelectBooks,
      activeColor: "text-indigo-600 bg-indigo-50",
    },
    {
      id: "ai",
      label: "المساعد",
      icon: Sparkles,
      active: activeTab === "ai",
      onClick: onSelectAI,
      activeColor: "text-violet-600 bg-violet-50",
    },
  ];

  const isSecondaryActive =
    activeTab === "corrector" ||
    activeTab === "media" ||
    activeTab === "notes" ||
    activeTab === "shadowing" ||
    activeTab === "trash";

  return (
    <nav
      className="md:hidden shrink-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] z-30 shadow-[0_-4px_16px_rgba(15,23,42,0.05)]"
      dir="rtl"
      aria-label="التنقل السريع للجوال"
    >
      <div className="grid grid-cols-5 gap-1 items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl transition-colors cursor-pointer ${
                item.active
                  ? `${item.activeColor} font-extrabold`
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold"
              }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span className="text-[10px] leading-tight truncate max-w-full">{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl transition-colors cursor-pointer ${
            isSecondaryActive
              ? "text-slate-900 bg-slate-100 font-extrabold"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold"
          }`}
        >
          <Menu className="w-[18px] h-[18px] shrink-0" />
          <span className="text-[10px] leading-tight">المزيد</span>
        </button>
      </div>
    </nav>
  );
});

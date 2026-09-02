import React, { useState } from "react";
import {
  X,
  Palette,
  Type,
  Sliders,
  Sparkles,
  RotateCcw,
  Check,
  Split,
  Eye,
  Layers,
  ArrowUpDown,
  MoveHorizontal,
  CheckCheck,
  Zap,
  Save,
  ArrowRight,
  Shield,
  Box,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowRightLeft,
  Globe,
  Tv,
  Space,
  ChevronDown,
  ChevronUp,
  Maximize2
} from "lucide-react";
import {
  SubtitleTrackStyleConfig,
  DEFAULT_PRIMARY_STYLE,
  DEFAULT_SECONDARY_STYLE,
  hexToRgba,
  computeSubtitleCSS,
  detectTextDirection
} from "./MediaPlayerWorkspace";

export interface SubtitleStylePanelProps {
  primaryStyle: SubtitleTrackStyleConfig;
  secondaryStyle: SubtitleTrackStyleConfig;
  onUpdatePrimaryStyle: (
    style: Partial<SubtitleTrackStyleConfig> | ((prev: SubtitleTrackStyleConfig) => SubtitleTrackStyleConfig)
  ) => void;
  onUpdateSecondaryStyle: (
    style: Partial<SubtitleTrackStyleConfig> | ((prev: SubtitleTrackStyleConfig) => SubtitleTrackStyleConfig)
  ) => void;
  onUpdateBothStyles: (style: Partial<SubtitleTrackStyleConfig>) => void;
  onClose?: () => void;
  onSaveAndReturn?: () => void;
  isEmbedded?: boolean;
  activeTrackLabel?: string;
  secondaryTrackLabel?: string;
  samplePrimaryText?: string;
  sampleSecondaryText?: string;
  returnModalName?: string;
}

const TEXT_COLOR_PRESETS = [
  { label: "أبيض ناصع", hex: "#ffffff" },
  { label: "أصفر ذهبي", hex: "#fde047" },
  { label: "أخضر زمردي", hex: "#6ee7b7" },
  { label: "سماوي نيون", hex: "#38bdf8" },
  { label: "برتقالي دافئ", hex: "#fb923c" },
  { label: "وردي ناعم", hex: "#f472b6" },
  { label: "بنفسجي فاتح", hex: "#c084fc" },
  { label: "رمادي فاتح", hex: "#e2e8f0" }
];

const BG_COLOR_PRESETS = [
  { label: "أسود نقي", hex: "#000000" },
  { label: "رمادي داكن", hex: "#0f172a" },
  { label: "كحلي داكن", hex: "#022c22" },
  { label: "أخضر غامق", hex: "#064e3b" },
  { label: "بنفسجي داكن", hex: "#3b0764" },
  { label: "أزرق كحلي", hex: "#1e1b4b" }
];

const STYLE_TEMPLATES: {
  name: string;
  icon: string;
  desc: string;
  tag: string;
  style: Partial<SubtitleTrackStyleConfig>;
}[] = [
  {
    name: "سينمائي نيتفلكس",
    icon: "🎬",
    desc: "أبيض ناصع بخلفية سوداء شفافة مريحة",
    tag: "شائع جداً",
    style: {
      fontSize: 20,
      textColor: "#ffffff",
      bgColor: "#000000",
      bgOpacity: 80,
      fontWeight: "700",
      fontFamily: "tajawal",
      textShadow: "subtle",
      textStroke: false,
      position: "bottom",
      offsetY: 28,
      borderRadius: 12,
      paddingX: 16,
      paddingY: 6,
      letterSpacing: 0,
      wordSpacing: 0,
      lineHeight: 1.4,
      direction: "auto",
      textAlign: "center"
    }
  },
  {
    name: "يوتيوب الذهبي",
    icon: "🟡",
    desc: "نص أصفر عالي التباين وجذاب جداً",
    tag: "عالي التباين",
    style: {
      fontSize: 22,
      textColor: "#fde047",
      bgColor: "#000000",
      bgOpacity: 85,
      fontWeight: "700",
      fontFamily: "cairo",
      textShadow: "strong",
      textStroke: false,
      position: "bottom",
      offsetY: 28,
      borderRadius: 12,
      paddingX: 18,
      paddingY: 6,
      letterSpacing: 0.5,
      wordSpacing: 1,
      lineHeight: 1.4,
      direction: "auto",
      textAlign: "center"
    }
  },
  {
    name: "زجاجي عصري (Glass)",
    icon: "💎",
    desc: "خلفية بلورية شبه شفافة عصرية وأنيقة",
    tag: "تصميم حديث",
    style: {
      fontSize: 20,
      textColor: "#ffffff",
      bgColor: "#0f172a",
      bgOpacity: 45,
      fontWeight: "600",
      fontFamily: "sans",
      textShadow: "subtle",
      textStroke: false,
      position: "bottom",
      offsetY: 28,
      borderRadius: 14,
      paddingX: 16,
      paddingY: 6,
      letterSpacing: 0,
      wordSpacing: 0,
      lineHeight: 1.4,
      direction: "auto",
      textAlign: "center"
    }
  },
  {
    name: "خط بارز نقي (Outline)",
    icon: "✏️",
    desc: "بدون خلفية مع تحديد أسود دقيق للحروف",
    tag: "بدون خلفية",
    style: {
      fontSize: 22,
      textColor: "#ffffff",
      bgColor: "#000000",
      bgOpacity: 0,
      fontWeight: "900",
      fontFamily: "cairo",
      textShadow: "outline",
      textStroke: true,
      position: "bottom",
      offsetY: 28,
      borderRadius: 0,
      paddingX: 12,
      paddingY: 4,
      letterSpacing: 1,
      wordSpacing: 1,
      lineHeight: 1.4,
      direction: "auto",
      textAlign: "center"
    }
  },
  {
    name: "زمردي هادئ",
    icon: "🟢",
    desc: "أخضر زمردي مريح للعينين للقراءة الطويلة",
    tag: "مريح للعين",
    style: {
      fontSize: 20,
      textColor: "#6ee7b7",
      bgColor: "#064e3b",
      bgOpacity: 85,
      fontWeight: "700",
      fontFamily: "tajawal",
      textShadow: "subtle",
      textStroke: false,
      position: "bottom",
      offsetY: 28,
      borderRadius: 12,
      paddingX: 16,
      paddingY: 6,
      letterSpacing: 0,
      wordSpacing: 0,
      lineHeight: 1.4,
      direction: "auto",
      textAlign: "center"
    }
  },
  {
    name: "سماوي نيون مضيء",
    icon: "⚡",
    desc: "توهج نيون أزرق جذاب وعالي الوضوح",
    tag: "مضيء نيون",
    style: {
      fontSize: 20,
      textColor: "#38bdf8",
      bgColor: "#022c22",
      bgOpacity: 75,
      fontWeight: "700",
      fontFamily: "sans",
      textShadow: "glow",
      textStroke: false,
      position: "bottom",
      offsetY: 28,
      borderRadius: 14,
      paddingX: 16,
      paddingY: 6,
      letterSpacing: 0.5,
      wordSpacing: 0,
      lineHeight: 1.45,
      direction: "auto",
      textAlign: "center"
    }
  }
];

export const SubtitleStylePanel: React.FC<SubtitleStylePanelProps> = ({
  primaryStyle,
  secondaryStyle,
  onUpdatePrimaryStyle,
  onUpdateSecondaryStyle,
  onUpdateBothStyles,
  onClose,
  onSaveAndReturn,
  isEmbedded = false,
  activeTrackLabel,
  secondaryTrackLabel,
  samplePrimaryText,
  sampleSecondaryText,
  returnModalName
}) => {
  const [selectedTab, setSelectedTab] = useState<"primary" | "secondary" | "both">("primary");
  const [activeSection, setActiveSection] = useState<"presets" | "font" | "background" | "position">("presets");
  const [showPreviewStage, setShowPreviewStage] = useState<boolean>(true);
  const [justSaved, setJustSaved] = useState<boolean>(false);

  const currentConfig = selectedTab === "secondary" ? secondaryStyle : primaryStyle;

  const handleUpdate = (updates: Partial<SubtitleTrackStyleConfig>) => {
    if (selectedTab === "both") {
      onUpdateBothStyles(updates);
    } else if (selectedTab === "secondary") {
      onUpdateSecondaryStyle(updates);
    } else {
      onUpdatePrimaryStyle(updates);
    }
  };

  const handleReset = () => {
    if (selectedTab === "secondary") {
      onUpdateSecondaryStyle(DEFAULT_SECONDARY_STYLE);
    } else if (selectedTab === "both") {
      onUpdatePrimaryStyle(DEFAULT_PRIMARY_STYLE);
      onUpdateSecondaryStyle(DEFAULT_SECONDARY_STYLE);
    } else {
      onUpdatePrimaryStyle(DEFAULT_PRIMARY_STYLE);
    }
  };

  const handleSaveAction = () => {
    setJustSaved(true);
    setTimeout(() => {
      if (onSaveAndReturn) {
        onSaveAndReturn();
      } else if (onClose) {
        onClose();
      }
    }, 200);
  };

  return (
    <div className="flex flex-col h-full text-slate-200 bg-slate-900 select-none overflow-hidden" dir="rtl">
      
      {/* ======================================================== */}
      {/* 1. TOP LIVE PREVIEW STAGE (Compact & Mobile-Optimized) */}
      {/* ======================================================== */}
      <div className="p-2 sm:p-3 bg-slate-950 border-b border-slate-800/90 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <button
            type="button"
            onClick={() => setShowPreviewStage(!showPreviewStage)}
            className="text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Tv className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">المعاينة الحية المتطابقة</span>
            <span className="text-[10px] text-slate-500 font-normal shrink-0">
              ({showPreviewStage ? "إخفاء" : "إظهار"})
            </span>
            {showPreviewStage ? (
              <ChevronUp className="w-3 h-3 text-slate-500" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-500" />
            )}
          </button>
          
          <span className="text-[9.5px] text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-mono flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>مباشر ✓</span>
          </span>
        </div>

        {/* Video Canvas Mockup */}
        {showPreviewStage && (() => {
          const pText = samplePrimaryText || "Das ist ein Text hier";
          const sText = sampleSecondaryText || "هذا النص التجريبي هنا";
          const pDir = primaryStyle.direction === "rtl" ? "rtl" : primaryStyle.direction === "ltr" ? "ltr" : detectTextDirection(pText);
          const sDir = secondaryStyle.direction === "rtl" ? "rtl" : secondaryStyle.direction === "ltr" ? "ltr" : detectTextDirection(sText);
          return (
            <div className="relative w-full min-h-[72px] sm:min-h-[90px] max-h-[140px] bg-gradient-to-b from-slate-900 via-slate-950 to-black rounded-lg border border-slate-800 flex flex-col items-center justify-center p-2 overflow-hidden shadow-inner gap-1.5 animate-fadeIn">
              {/* Background Grid Accent */}
              <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:14px_14px] opacity-20 pointer-events-none" />

              {/* Primary Subtitle Sample */}
              <div
                dir={pDir}
                style={computeSubtitleCSS(primaryStyle, false, 1, pText)}
                className="transition-all duration-150 shadow-md max-w-[96%] truncate text-center"
              >
                <span>{pText}</span>
              </div>

              {/* Secondary Subtitle Sample (Arabic Dual) */}
              <div
                dir={sDir}
                style={computeSubtitleCSS(secondaryStyle, false, 1, sText)}
                className="transition-all duration-150 shadow-md max-w-[96%] truncate text-center"
              >
                <span>{sText}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ======================================================== */}
      {/* 2. TARGET TRACK SELECTOR & SECTIONS NAVIGATION */}
      {/* ======================================================== */}
      <div className="p-2.5 sm:p-3 bg-slate-900/95 border-b border-slate-800/80 space-y-2 shrink-0">
        
        {/* Track Selector Bar (Mobile Friendly 3-Segment Switcher) */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-400">تعديل الستايل لـ:</span>
          <button
            onClick={handleReset}
            className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors px-1.5 py-0.5 rounded-md hover:bg-slate-800"
            title="استعادة الإعدادات الافتراضية"
          >
            <RotateCcw className="w-3 h-3" />
            <span>استعادة الافتراضي</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-bold">
          <button
            onClick={() => setSelectedTab("primary")}
            className={`py-1.5 px-1 rounded-md text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
              selectedTab === "primary"
                ? "bg-indigo-600 text-white shadow-xs font-black"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <span>🇩🇪 الأولى</span>
          </button>

          <button
            onClick={() => setSelectedTab("secondary")}
            className={`py-1.5 px-1 rounded-md text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
              selectedTab === "secondary"
                ? "bg-emerald-600 text-white shadow-xs font-black"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <span>🇸🇦 الثانية</span>
          </button>

          <button
            onClick={() => setSelectedTab("both")}
            className={`py-1.5 px-1 rounded-md text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
              selectedTab === "both"
                ? "bg-amber-600 text-white shadow-xs font-black"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
            title="تطبيق التغييرات على مساري الترجمة معاً"
          >
            <Split className="w-3 h-3 shrink-0" />
            <span>كلاهما</span>
          </button>
        </div>

        {/* Sections Navigation Tabs (Responsive & Elegant) */}
        <div className="grid grid-cols-4 gap-1 pt-0.5 text-xs font-bold">
          <button
            onClick={() => setActiveSection("presets")}
            className={`py-2 px-1 rounded-lg text-center transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 border ${
              activeSection === "presets"
                ? "bg-slate-800 text-amber-300 border-amber-500/50 shadow-xs font-black"
                : "bg-slate-950/60 text-slate-400 border-slate-800/80 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] sm:text-xs">قوالب</span>
          </button>

          <button
            onClick={() => setActiveSection("font")}
            className={`py-2 px-1 rounded-lg text-center transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 border ${
              activeSection === "font"
                ? "bg-slate-800 text-indigo-300 border-indigo-500/50 shadow-xs font-black"
                : "bg-slate-950/60 text-slate-400 border-slate-800/80 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Type className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-[11px] sm:text-xs">الخط</span>
          </button>

          <button
            onClick={() => setActiveSection("background")}
            className={`py-2 px-1 rounded-lg text-center transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 border ${
              activeSection === "background"
                ? "bg-slate-800 text-teal-300 border-teal-500/50 shadow-xs font-black"
                : "bg-slate-950/60 text-slate-400 border-slate-800/80 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Box className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="text-[11px] sm:text-xs">الخلفية</span>
          </button>

          <button
            onClick={() => setActiveSection("position")}
            className={`py-2 px-1 rounded-lg text-center transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 border ${
              activeSection === "position"
                ? "bg-slate-800 text-blue-300 border-blue-500/50 shadow-xs font-black"
                : "bg-slate-950/60 text-slate-400 border-slate-800/80 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-[11px] sm:text-xs">الموضع</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. MAIN CONTROLS CONTENT (Clean, Fully Responsive) */}
      {/* ======================================================== */}
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-3 custom-scrollbar text-xs">
        
        {/* ==================================================== */}
        {/* SECTION 1: PRESETS / QUICK TEMPLATES */}
        {/* ==================================================== */}
        {activeSection === "presets" && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>نماذج سريعة جاهزة (بنقرة واحدة):</span>
              </span>
            </div>

            {/* Responsive Templates Grid (1 col on narrow mobile, 2 col on tablets/desktops) */}
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
              {STYLE_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.name}
                  onClick={() => handleUpdate(tmpl.style)}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/90 active:scale-[0.98] border border-slate-800 hover:border-amber-500/60 text-right transition-all cursor-pointer flex items-center gap-2.5 shadow-xs group"
                >
                  <span className="text-xl group-hover:scale-110 transition-transform shrink-0">{tmpl.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition-colors truncate">{tmpl.name}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 group-hover:text-amber-400 font-mono shrink-0">
                        {tmpl.tag}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-400 line-clamp-1 mt-0.5 leading-tight">{tmpl.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Quick Match & Clone Actions */}
            <div className="pt-2 space-y-2 border-t border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400">مطابقة وتوحيد الستايل:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onUpdatePrimaryStyle({ ...secondaryStyle });
                    setSelectedTab("primary");
                  }}
                  className="py-2 px-2 bg-slate-950/80 hover:bg-slate-800 active:scale-95 text-slate-300 hover:text-white rounded-lg text-xs font-bold border border-slate-800 hover:border-indigo-500/60 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="نسخ ستايل الترجمة الثانية إلى الأولى"
                >
                  <Zap className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">الثانية ➔ الأولى</span>
                </button>

                <button
                  onClick={() => {
                    onUpdateSecondaryStyle({ ...primaryStyle });
                    setSelectedTab("secondary");
                  }}
                  className="py-2 px-2 bg-slate-950/80 hover:bg-slate-800 active:scale-95 text-slate-300 hover:text-white rounded-lg text-xs font-bold border border-slate-800 hover:border-emerald-500/60 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="نسخ ستايل الترجمة الأولى إلى الثانية"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">الأولى ➔ الثانية</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* SECTION 2: FONT & TEXT DETAILS */}
        {/* ==================================================== */}
        {activeSection === "font" && (
          <div className="space-y-2.5 animate-fadeIn">
            {/* Text Direction (اتجاه النص) */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                  <span>اتجاه النص (Direction):</span>
                </label>
                <span className="text-[9.5px] text-indigo-400 font-bold bg-indigo-950/70 border border-indigo-500/30 px-1.5 py-0.5 rounded-full">
                  {(currentConfig.direction === "rtl" && "RTL") ||
                   (currentConfig.direction === "ltr" && "LTR") ||
                   "Auto ✨"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-xs">
                {[
                  { id: "auto", label: "تلقائي ذكي", sub: "Auto" },
                  { id: "rtl", label: "يمين (RTL)", sub: "عربي" },
                  { id: "ltr", label: "يسار (LTR)", sub: "أجنبي" }
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleUpdate({ direction: d.id as any })}
                    className={`py-1.5 px-1 rounded-md text-center transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                      (currentConfig.direction ?? "auto") === d.id
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-xs font-bold"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    <span>{d.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Text Alignment (محاذاة النص) */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <AlignCenter className="w-3.5 h-3.5 text-indigo-400" />
                  <span>محاذاة النص:</span>
                </label>
              </div>
              <div className="grid grid-cols-3 gap-1 text-xs font-bold">
                {[
                  { id: "center", label: "توسيط", icon: AlignCenter },
                  { id: "right", label: "يمين", icon: AlignRight },
                  { id: "left", label: "يسار", icon: AlignLeft }
                ].map((al) => {
                  const Icon = al.icon;
                  return (
                    <button
                      key={al.id}
                      onClick={() => handleUpdate({ textAlign: al.id as any })}
                      className={`py-1.5 px-1 rounded-md text-center transition-all cursor-pointer border flex items-center justify-center gap-1 ${
                        (currentConfig.textAlign ?? "center") === al.id
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{al.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Size */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>حجم الخط:</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleUpdate({ fontSize: Math.max(12, currentConfig.fontSize - 1) })}
                    className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 active:scale-90 text-white flex items-center justify-center font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-mono text-indigo-400 font-bold px-1.5 text-xs">{currentConfig.fontSize}px</span>
                  <button
                    onClick={() => handleUpdate({ fontSize: Math.min(48, currentConfig.fontSize + 1) })}
                    className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 active:scale-90 text-white flex items-center justify-center font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
              <input
                type="range"
                min="12"
                max="48"
                step="1"
                value={currentConfig.fontSize}
                onChange={(e) => handleUpdate({ fontSize: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="grid grid-cols-5 gap-1 text-[10px] text-slate-400 font-mono">
                {[14, 18, 22, 26, 32].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => handleUpdate({ fontSize: sz })}
                    className={`py-1 rounded-md transition-colors cursor-pointer text-center ${
                      currentConfig.fontSize === sz ? "bg-indigo-600 text-white font-bold" : "hover:text-white bg-slate-900 border border-slate-800"
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            </div>

            {/* Letter Spacing (تباعد الحروف) */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <MoveHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                  <span>تباعد الحروف:</span>
                </span>
                <span className="font-mono text-indigo-400 font-bold">{currentConfig.letterSpacing ?? 0}px</span>
              </div>
              <input
                type="range"
                min="-2"
                max="8"
                step="0.5"
                value={currentConfig.letterSpacing ?? 0}
                onChange={(e) => handleUpdate({ letterSpacing: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="grid grid-cols-5 gap-1 text-[9.5px] text-slate-400 font-mono">
                {[
                  { val: -1, label: "-1px" },
                  { val: 0, label: "0px" },
                  { val: 1, label: "1px" },
                  { val: 2.5, label: "2.5px" },
                  { val: 5, label: "5px" }
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => handleUpdate({ letterSpacing: item.val })}
                    className={`py-1 rounded-md transition-colors cursor-pointer text-center ${
                      (currentConfig.letterSpacing ?? 0) === item.val
                        ? "bg-indigo-600 text-white font-bold"
                        : "hover:text-white bg-slate-900 border border-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Word Spacing (تباعد الكلمات) */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <AlignLeft className="w-3.5 h-3.5 text-indigo-400" />
                  <span>تباعد الكلمات:</span>
                </span>
                <span className="font-mono text-indigo-400 font-bold">{currentConfig.wordSpacing ?? 0}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="16"
                step="1"
                value={currentConfig.wordSpacing ?? 0}
                onChange={(e) => handleUpdate({ wordSpacing: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="grid grid-cols-4 gap-1 text-[9.5px] text-slate-400 font-mono">
                {[
                  { val: 0, label: "0px طبيعي" },
                  { val: 3, label: "3px خفيف" },
                  { val: 6, label: "6px متوازن" },
                  { val: 12, label: "12px متباعد" }
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => handleUpdate({ wordSpacing: item.val })}
                    className={`py-1 rounded-md transition-colors cursor-pointer text-center ${
                      (currentConfig.wordSpacing ?? 0) === item.val
                        ? "bg-indigo-600 text-white font-bold"
                        : "hover:text-white bg-slate-900 border border-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Height (ارتفاع الأسطر) */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  <span>ارتفاع الأسطر (Line Height):</span>
                </span>
                <span className="font-mono text-indigo-400 font-bold">{currentConfig.lineHeight ?? 1.4}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="2.4"
                step="0.05"
                value={currentConfig.lineHeight ?? 1.4}
                onChange={(e) => handleUpdate({ lineHeight: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="grid grid-cols-4 gap-1 text-[9.5px] text-slate-400 font-mono">
                {[
                  { val: 1.15, label: "1.15 مكثف" },
                  { val: 1.4, label: "1.4 قياسي" },
                  { val: 1.65, label: "1.65 مريح" },
                  { val: 2.0, label: "2.0 واسع" }
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => handleUpdate({ lineHeight: item.val })}
                    className={`py-1 rounded-md transition-colors cursor-pointer text-center ${
                      Math.abs((currentConfig.lineHeight ?? 1.4) - item.val) < 0.04
                        ? "bg-indigo-600 text-white font-bold"
                        : "hover:text-white bg-slate-900 border border-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Family */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-1.5">
              <label className="text-xs font-bold text-slate-300">نوع الخط:</label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: "tajawal", label: "تجوّل" },
                  { id: "cairo", label: "كايرو" },
                  { id: "amiri", label: "أميري" },
                  { id: "sans", label: "عصري" },
                  { id: "mono", label: "مطور" },
                  { id: "system", label: "النظام" }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleUpdate({ fontFamily: f.id as any })}
                    className={`py-1.5 px-1 rounded-md text-center text-xs font-bold transition-all cursor-pointer border ${
                      currentConfig.fontFamily === f.id
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Weight */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-1.5">
              <label className="text-xs font-bold text-slate-300">سماكة الخط:</label>
              <div className="grid grid-cols-4 gap-1 text-[11px]">
                {[
                  { id: "400", label: "عادي" },
                  { id: "600", label: "شبه عريض" },
                  { id: "700", label: "عريض" },
                  { id: "900", label: "داكن" }
                ].map((w) => (
                  <button
                    key={w.id}
                    onClick={() => handleUpdate({ fontWeight: w.id as any })}
                    className={`py-1.5 px-1 rounded-md text-center font-bold transition-all cursor-pointer border ${
                      currentConfig.fontWeight === w.id
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Color */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-1.5">
              <label className="text-xs font-bold text-slate-300">لون النص:</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentConfig.textColor}
                  onChange={(e) => handleUpdate({ textColor: e.target.value })}
                  className="w-8 h-8 rounded-md border border-slate-700 bg-transparent cursor-pointer shrink-0"
                />
                <div className="flex flex-wrap items-center gap-1.5 flex-1">
                  {TEXT_COLOR_PRESETS.map((col) => (
                    <button
                      key={col.hex}
                      onClick={() => handleUpdate({ textColor: col.hex })}
                      style={{ backgroundColor: col.hex }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        currentConfig.textColor.toLowerCase() === col.hex.toLowerCase()
                          ? "border-white scale-110 shadow-md ring-2 ring-indigo-500/50"
                          : "border-slate-800 hover:scale-105"
                      }`}
                      title={col.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Text Shadows */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-1.5">
              <label className="text-xs font-bold text-slate-300">تأثير الظلال والتوهج:</label>
              <div className="grid grid-cols-3 gap-1 text-[11px]">
                {[
                  { id: "none", label: "بدون ظل" },
                  { id: "subtle", label: "ظل ناعم" },
                  { id: "strong", label: "سينمائي 3D" },
                  { id: "outline", label: "حدود بارزة" },
                  { id: "glow", label: "توهج نيون" }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleUpdate({ textShadow: s.id as any })}
                    className={`py-1.5 px-1 rounded-md text-center font-bold transition-all cursor-pointer border ${
                      currentConfig.textShadow === s.id
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Stroke */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">تحديد خارجي داكن للحروف (Stroke):</span>
              <button
                onClick={() => handleUpdate({ textStroke: !currentConfig.textStroke })}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  currentConfig.textStroke ? "bg-indigo-600" : "bg-slate-800"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    currentConfig.textStroke ? "left-1.5" : "right-1.5"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* SECTION 3: BACKGROUND & BOX */}
        {/* ==================================================== */}
        {activeSection === "background" && (
          <div className="space-y-2.5 animate-fadeIn">
            {/* Opacity */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>شفافية الخلفية:</span>
                <span className="font-mono text-teal-400 font-bold">{currentConfig.bgOpacity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={currentConfig.bgOpacity}
                onChange={(e) => handleUpdate({ bgOpacity: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
              <div className="grid grid-cols-4 gap-1 text-[9.5px] text-slate-400 font-mono">
                {[
                  { val: 0, label: "0% شفاف" },
                  { val: 45, label: "45% زجاجي" },
                  { val: 80, label: "80% داكن" },
                  { val: 100, label: "100% مصمت" }
                ].map((op) => (
                  <button
                    key={op.val}
                    onClick={() => handleUpdate({ bgOpacity: op.val })}
                    className={`py-1 rounded-md transition-colors cursor-pointer text-center ${
                      currentConfig.bgOpacity === op.val ? "bg-teal-600 text-white font-bold" : "hover:text-white bg-slate-900 border border-slate-800"
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Color */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-1.5">
              <label className="text-xs font-bold text-slate-300">لون خلفية الصندوق:</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentConfig.bgColor}
                  onChange={(e) => handleUpdate({ bgColor: e.target.value })}
                  className="w-8 h-8 rounded-md border border-slate-700 bg-transparent cursor-pointer shrink-0"
                />
                <div className="flex flex-wrap items-center gap-1.5 flex-1">
                  {BG_COLOR_PRESETS.map((col) => (
                    <button
                      key={col.hex}
                      onClick={() => handleUpdate({ bgColor: col.hex })}
                      style={{ backgroundColor: col.hex }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        currentConfig.bgColor.toLowerCase() === col.hex.toLowerCase()
                          ? "border-white scale-110 shadow-md ring-2 ring-teal-500/50"
                          : "border-slate-800 hover:scale-105"
                      }`}
                      title={col.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Padding X & Y (الحشوة الأفقية والعمودية الدقيقة) */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-teal-400" />
                  <span>الحشوة الداخلية (Padding):</span>
                </span>
                <span className="font-mono text-teal-400 font-bold text-[11px]">
                  X: {currentConfig.paddingX ?? 16}px | Y: {currentConfig.paddingY ?? 6}px
                </span>
              </div>

              {/* Padding X Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>أفقي (عرض الحشوة X):</span>
                  <span className="font-mono text-teal-400">{currentConfig.paddingX ?? 16}px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="48"
                  step="2"
                  value={currentConfig.paddingX ?? 16}
                  onChange={(e) => handleUpdate({ paddingX: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
              </div>

              {/* Padding Y Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>عمودي (ارتفاع الحشوة Y):</span>
                  <span className="font-mono text-teal-400">{currentConfig.paddingY ?? 6}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="28"
                  step="1"
                  value={currentConfig.paddingY ?? 6}
                  onChange={(e) => handleUpdate({ paddingY: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
              </div>

              {/* Quick Padding Presets */}
              <div className="grid grid-cols-2 xs:grid-cols-4 gap-1 text-[10px]">
                {[
                  { px: 8, py: 3, label: "مضغوط (8x3)" },
                  { px: 16, py: 6, label: "متوازن (16x6)" },
                  { px: 24, py: 10, label: "واسع (24x10)" },
                  { px: 32, py: 14, label: "سينمائي (32x14)" }
                ].map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleUpdate({ paddingX: p.px, paddingY: p.py })}
                    className={`py-1.5 px-1 rounded-md text-center font-bold transition-all cursor-pointer border ${
                      (currentConfig.paddingX ?? 16) === p.px && (currentConfig.paddingY ?? 6) === p.py
                        ? "bg-teal-600 text-white border-teal-500 shadow-xs"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Corner Radius (استدارة الحواف) */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>استدارة الحواف (Radius):</span>
                <span className="font-mono text-teal-400 font-bold">{currentConfig.borderRadius ?? 14}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="36"
                step="2"
                value={currentConfig.borderRadius ?? 14}
                onChange={(e) => handleUpdate({ borderRadius: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {[
                  { val: 0, label: "0px حادة" },
                  { val: 8, label: "8px خفيفة" },
                  { val: 14, label: "14px ناعمة" },
                  { val: 24, label: "24px كبسولة" }
                ].map((r) => (
                  <button
                    key={r.val}
                    onClick={() => handleUpdate({ borderRadius: r.val })}
                    className={`py-1.5 px-1 rounded-md text-center font-bold transition-all cursor-pointer border ${
                      (currentConfig.borderRadius ?? 14) === r.val
                        ? "bg-teal-600 text-white border-teal-500 shadow-xs"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* SECTION 4: POSITION ON SCREEN */}
        {/* ==================================================== */}
        {activeSection === "position" && (
          <div className="space-y-2.5 animate-fadeIn">
            {/* Placement */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-1.5">
              <label className="text-xs font-bold text-slate-300">الموضع على الشاشة:</label>
              <div className="grid grid-cols-3 gap-1 text-xs font-bold">
                {[
                  { id: "bottom", label: "أسفل الشاشة" },
                  { id: "center", label: "المنتصف" },
                  { id: "top", label: "أعلى الشاشة" }
                ].map((pos) => (
                  <button
                    key={pos.id}
                    onClick={() => handleUpdate({ position: pos.id as any })}
                    className={`py-2 px-1 rounded-md text-center transition-all cursor-pointer border ${
                      currentConfig.position === pos.id
                        ? "bg-blue-600 text-white border-blue-500 shadow-xs font-bold"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vertical Offset */}
            <div className="bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>إزاحة عمودية (Offset Y):</span>
                <span className="font-mono text-blue-400 font-bold">{currentConfig.offsetY}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="140"
                step="2"
                value={currentConfig.offsetY}
                onChange={(e) => handleUpdate({ offsetY: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-400 font-mono">
                {[
                  { val: 0, label: "0px ملاصق" },
                  { val: 28, label: "28px قياسي" },
                  { val: 60, label: "60px متوسط" },
                  { val: 120, label: "120px مرتفع" }
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => handleUpdate({ offsetY: item.val })}
                    className={`py-1 rounded-md transition-colors cursor-pointer text-center ${
                      currentConfig.offsetY === item.val
                        ? "bg-blue-600 text-white font-bold"
                        : "hover:text-white bg-slate-900 border border-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* 4. PANEL FOOTER WITH CLEAN ACTION */}
      {/* ======================================================== */}
      <div className="p-2.5 sm:p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-1 text-[10px] text-slate-400 truncate">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">تُطبّق فوراً على الفيديو</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleSaveAction}
            className={`px-4 py-2 rounded-lg text-white font-black text-xs shadow-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              justSaved
                ? "bg-emerald-500 shadow-emerald-500/40 scale-105"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30 active:scale-95"
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{justSaved ? "تم الحفظ والتطبيق! ✓" : (returnModalName ? `حفظ والعودة` : "حفظ التعديلات ✓")}</span>
          </button>
        </div>
      </div>

    </div>
  );
};

export interface SubtitleStyleModalProps extends SubtitleStylePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAndReturn?: () => void;
  activeTrackLabel?: string;
  secondaryTrackLabel?: string;
  samplePrimaryText?: string;
  sampleSecondaryText?: string;
  returnModalName?: string;
}

export const SubtitleStyleModal: React.FC<SubtitleStyleModalProps> = ({
  isOpen,
  onClose,
  onSaveAndReturn,
  primaryStyle,
  secondaryStyle,
  onUpdatePrimaryStyle,
  onUpdateSecondaryStyle,
  onUpdateBothStyles,
  activeTrackLabel,
  secondaryTrackLabel,
  samplePrimaryText,
  sampleSecondaryText,
  returnModalName
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn"
      dir="rtl"
    >
      <div className="bg-slate-900 border border-slate-700/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col w-full max-w-lg h-[92vh] max-h-[700px] animate-scaleUp">
        {/* Modal Header */}
        <div className="p-3 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-orange-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-white flex items-center gap-2">
                <span>تخصيص ستايل الترجمة</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 font-mono">
                  Dual Subs
                </span>
              </h3>
              <p className="text-[10.5px] text-slate-400">تعديل شامل للخطوط والألوان والخلفيات والموضع</p>
            </div>
          </div>

          <button
            onClick={onSaveAndReturn || onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <SubtitleStylePanel
            primaryStyle={primaryStyle}
            secondaryStyle={secondaryStyle}
            onUpdatePrimaryStyle={onUpdatePrimaryStyle}
            onUpdateSecondaryStyle={onUpdateSecondaryStyle}
            onUpdateBothStyles={onUpdateBothStyles}
            onClose={onClose}
            onSaveAndReturn={onSaveAndReturn}
            isEmbedded={false}
            activeTrackLabel={activeTrackLabel}
            secondaryTrackLabel={secondaryTrackLabel}
            samplePrimaryText={samplePrimaryText}
            sampleSecondaryText={sampleSecondaryText}
            returnModalName={returnModalName}
          />
        </div>
      </div>
    </div>
  );
};

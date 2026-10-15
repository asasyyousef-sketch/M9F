import React from "react";
import { Folder, RectangleVertical, Check, X, Sparkles, Palette } from "lucide-react";
import { Folder as FolderType, Flashcard, getSafeImageStyle } from "../types";
import { ImageWithSkeleton } from "./ReviewSession";

export interface StyleOption {
  id: string;
  name: string;
  description: string;
}

export const STYLES_LIST: StyleOption[] = [
  { id: "S01", name: "القياسي البسيط (Classic Minimal)", description: "مستطيل أفقي للمجلدات ومستطيل رأسي للبطاقات مع شريط لوني علوي ناعم وزوايا حادة 3px" },
  { id: "S02", name: "التبويب العلوي وشريط العلامة (Top Tab & Bookmark)", description: "لسان تبويب أعلى المجلد وشريط علامة مرجعية أعلى البطاقة" },
  { id: "S03", name: "إطار لوني داخلي (Dual Inset Accent Frame)", description: "إطار ملوّن أنيق بلون المجلد/البطاقة محاط بحواف دقيقة" },
  { id: "S04", name: "الشريط السفلي المدمج (Bottom Status Strip)", description: "شريط سفلي مدمج في أسفل الصورة يحمل أيقونة العنصر" },
  { id: "S05", name: "الزاوية المشطوفة كالمستندات (Folded Dog-Ear Corner)", description: "حافة علوية مشطوفة هندسياً للمجلد كالأوراق والملفات" },
  { id: "S06", name: "الشارة الزجاجية العائمة (Glassmorphic Chip)", description: "شارة زجاجية أنيقة شبه شفافة في الزاوية تبرز الأيقونة" },
  { id: "S07", name: "العمود اللوني الجانبي (Side Accent Spine)", description: "عمود لوني بارز على طرف المجلد وشريط أفقي على طرف البطاقة" },
  { id: "S08", name: "السينمائي العريض وبطاقة الهاتف (Cinematic & Mobile)", description: "أفقي عريض جداً للمجلدات (16:9) ورأسي طولي للبطاقات (9:16)" },
  { id: "S09", name: "إطار بولارويد النظيف (Polaroid White Frame)", description: "إطار أبيض ناصع مع قاعدة سفلية عريضة تحاكي بطاقات الصور الكلاسيكية" },
  { id: "S10", name: "تدرج ناعم وشارة دائرية (Soft Gradient & Dot)", description: "تدرج شفاف خفيف مع شارة نقطية دائرية ملونة" },
  { id: "S11", name: "الحلقات والمسطرة (Binder Rings & Ruled Line)", description: "تأثير مجلد الحلقات للملفات مع خط مسطرة علوي للبطاقة" },
  { id: "S12", name: "الحدود الحادة المشدودة (Sharp Architectural)", description: "زوايا حادة هندسية بالغة الدقة (1px) مع إطار احترافي رفيع" },
  { id: "S13", name: "الكبسولة الناعمة (Smooth Soft Capsule)", description: "انحناء متوسط متناسق rounded-md دون أي تفاصيل زائدة" },
  { id: "S14", name: "الظل المجسم الخفيف (Crisp Subtle Elevation)", description: "عمق خفيف بظل ناعم يبرز الغلاف عن الخلفية" },
  { id: "S15", name: "الشريط الرأسي الرقيق (Slim Vertical Pinstripe)", description: "خط لوني رفيع في أقصى اليمين يميز هوية المجلد والبطاقة" },
  { id: "S16", name: "شريط العنوان العلوي (Top Header Ribbon)", description: "شريط علوي بعرض الصورة بالكامل يحمل لون الهوية" },
  { id: "S17", name: "إطار المعرض الأنيق (Gallery Matte Frame)", description: "إطار داكن ناعم يحيط بالصورة كمعارض الأعمال" },
  { id: "S18", name: "الأيقونة المعلقة البارزة (Hanging Badge Overlay)", description: "أيقونة دائرية تطفو جزئياً على الحافة العلوية للغلاف" },
  { id: "S19", name: "الزجاج الداكن الحديث (Dark Translucent Tag)", description: "شارة سوداء شفافة أنيقة بلون أسود شفاف 70% في الزاوية" },
  { id: "S20", name: "الاستوديو الاحترافي (Pro Studio Border)", description: "إطار لوني دقيق 1.5px يطابق لون المجلد بالكامل مع شارة متطابقة" }
];

export const FolderThumbnail: React.FC<{
  folder: FolderType;
  styleId?: string;
}> = ({ folder, styleId = "S18" }) => {
  const color = folder.color || "#0056f6";

  const renderContent = () => {
    if (folder.coverImage) {
      return (
        <>
          <ImageWithSkeleton
            src={folder.coverImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={getSafeImageStyle(folder.coverImagePosition)}
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </>
      );
    }
    return (
      <div 
        className="w-full h-full flex items-center justify-center transition-all"
        style={{ background: `linear-gradient(135deg, ${color}20, ${color}35)` }}
      >
        <Folder className="w-5 h-5 fill-current drop-shadow-2xs" style={{ color }} />
      </div>
    );
  };

  switch (styleId) {
    case "S01": // Minimal Standard with Top Colored Stripe
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-10 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            <div className="absolute top-0 inset-x-0 h-1 z-10" style={{ backgroundColor: color }} />
            {renderContent()}
            <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] bg-black/60 text-white z-10">
              <Folder className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S02": // Modern Top-Tab
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-11 flex flex-col justify-end transition-transform group-hover:scale-102">
            <div 
              className="h-2 w-6 rounded-t-xs self-start mr-1 shadow-2xs flex items-center justify-center z-0"
              style={{ backgroundColor: color }}
            >
              <Folder className="w-2 h-2 text-white fill-white/90" />
            </div>
            <div 
              className="relative w-full h-9 rounded-sm rounded-tl-xs overflow-hidden border border-slate-200/80 shadow-2xs flex items-center justify-center bg-slate-100 z-1"
              style={{ borderColor: `${color}40` }}
            >
              {renderContent()}
              <div 
                className="absolute left-1 bottom-1 px-1 py-0.5 rounded-[2px] text-white flex items-center gap-1 shadow-2xs text-[9px] font-bold z-10"
                style={{ backgroundColor: color }}
              >
                <Folder className="w-2.5 h-2.5 fill-current" />
              </div>
            </div>
          </div>
        </div>
      );

    case "S03": // Dual Inset Accent Frame
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div 
            className="relative w-14 h-10.5 rounded-[4px] p-0.5 border shadow-2xs flex items-center justify-center bg-white transition-transform group-hover:scale-102"
            style={{ borderColor: `${color}60` }}
          >
            <div className="relative w-full h-full rounded-[2px] overflow-hidden bg-slate-50 flex items-center justify-center">
              {renderContent()}
              <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] text-white z-10" style={{ backgroundColor: color }}>
                <Folder className="w-2.5 h-2.5 fill-current" />
              </div>
            </div>
          </div>
        </div>
      );

    case "S04": // Bottom Status Strip
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-11 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex flex-col bg-slate-50 transition-transform group-hover:scale-102">
            <div className="relative w-full h-8 overflow-hidden">
              {renderContent()}
            </div>
            <div className="h-3 w-full flex items-center justify-between px-1.5 text-white z-10" style={{ backgroundColor: color }}>
              <span className="text-[8px] font-bold">مجلد</span>
              <Folder className="w-2 h-2 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S05": // Chamfered Dog-Ear Corner
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-10.5 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            {renderContent()}
            {/* Cut-corner dog-ear overlay */}
            <div className="absolute top-0 right-0 w-3 h-3 bg-white border-b border-l border-slate-300 z-10 shadow-2xs" />
            <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] bg-black/60 text-white z-10">
              <Folder className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S06": // Floating Glassmorphic Chip
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-10 rounded-sm overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded-full bg-white/90 dark:bg-black/80 backdrop-blur-md border border-white/40 shadow-xs flex items-center gap-1 z-10">
              <Folder className="w-2.5 h-2.5" style={{ color }} />
            </div>
          </div>
        </div>
      );

    case "S07": // Side Accent Spine (Vertical on right edge)
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-10 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            <div className="absolute top-0 bottom-0 right-0 w-1.5 z-10" style={{ backgroundColor: color }} />
            {renderContent()}
            <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] bg-black/60 text-white z-10">
              <Folder className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S08": // Cinematic 16:9 Wide Album
      return (
        <div className="w-15 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-15 h-9 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-900 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute left-1 bottom-1 px-1 py-0.5 rounded-[2px] bg-black/70 text-white text-[8px] font-bold z-10 flex items-center gap-0.5">
              <Folder className="w-2 h-2 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S09": // Polaroid White Frame
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-11 rounded-[2px] bg-white border border-slate-200/90 shadow-xs p-1 pb-2 flex flex-col justify-between transition-transform group-hover:scale-102">
            <div className="relative w-full h-7 rounded-[1px] overflow-hidden bg-slate-100">
              {renderContent()}
            </div>
            <div className="flex items-center justify-between text-[8px] font-bold text-slate-500 px-0.5 pt-0.5">
              <span>ملف</span>
              <Folder className="w-2 h-2" style={{ color }} />
            </div>
          </div>
        </div>
      );

    case "S10": // Soft Gradient & Dot
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-13.5 h-10 rounded-[4px] overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute top-1 right-1 w-2 h-2 rounded-full border border-white shadow-xs z-10" style={{ backgroundColor: color }} />
            <div className="absolute left-1 bottom-1 p-0.5 rounded-full bg-black/60 text-white z-10">
              <Folder className="w-2 h-2 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S11": // Binder Rings (dots on right side)
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-10 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            <div className="absolute right-1 inset-y-1 flex flex-col justify-between z-10 pointer-events-none">
              <div className="w-1 h-1 rounded-full bg-slate-400 border border-white" />
              <div className="w-1 h-1 rounded-full bg-slate-400 border border-white" />
              <div className="w-1 h-1 rounded-full bg-slate-400 border border-white" />
            </div>
            {renderContent()}
            <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] bg-black/60 text-white z-10">
              <Folder className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S12": // Sharp Architectural (1px radius)
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-10 rounded-[1px] overflow-hidden border border-slate-300 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute left-0 bottom-0 px-1 py-0.5 text-white text-[8px] font-bold z-10" style={{ backgroundColor: color }}>
              <Folder className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S13": // Smooth Soft Capsule (rounded-md)
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-10 rounded-md overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute left-1.5 bottom-1.5 p-1 rounded-md bg-black/60 text-white z-10">
              <Folder className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S14": // Elevated Card Drop-Shadow
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-13.5 h-10 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-sm flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] text-white z-10" style={{ backgroundColor: color }}>
              <Folder className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S15": // Slim Vertical Pinstripe
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-10 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            <div className="absolute top-0 bottom-0 right-0 w-0.5 z-10" style={{ backgroundColor: color }} />
            {renderContent()}
            <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] bg-black/60 text-white z-10">
              <Folder className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S16": // Top Header Ribbon
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-10.5 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex flex-col bg-slate-50 transition-transform group-hover:scale-102">
            <div className="h-2 w-full flex items-center px-1 text-white z-10" style={{ backgroundColor: color }}>
              <Folder className="w-1.5 h-1.5 fill-current" />
            </div>
            <div className="relative w-full flex-1 overflow-hidden">
              {renderContent()}
            </div>
          </div>
        </div>
      );

    case "S17": // Gallery Matte Frame
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-10 rounded-[2px] p-0.5 bg-slate-800 border border-slate-700 shadow-2xs flex items-center justify-center transition-transform group-hover:scale-102">
            <div className="relative w-full h-full rounded-[1px] overflow-hidden">
              {renderContent()}
            </div>
            <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] bg-black/80 text-white z-10">
              <Folder className="w-2 h-2 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S18": // Hanging Badge Overlay
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-9.5 rounded-[3px] overflow-visible border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            <div className="absolute -top-1.5 right-1 w-4 h-4 rounded-full border border-white shadow-xs text-white flex items-center justify-center z-10" style={{ backgroundColor: color }}>
              <Folder className="w-2 h-2 fill-current" />
            </div>
            <div className="relative w-full h-full rounded-[3px] overflow-hidden">
              {renderContent()}
            </div>
          </div>
        </div>
      );

    case "S19": // Dark Translucent Tag
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-14 h-10 rounded-sm overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded-[3px] bg-black/75 backdrop-blur-xs text-white text-[8px] font-bold flex items-center gap-1 z-10">
              <Folder className="w-2 h-2 fill-current" />
              <span>مجلد</span>
            </div>
          </div>
        </div>
      );

    case "S20": // Pro Studio Clean Border
    default:
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div 
            className="relative w-14 h-10 rounded-[3px] overflow-hidden border-1.5 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102"
            style={{ borderColor: color }}
          >
            {renderContent()}
            <div className="absolute left-1 bottom-1 px-1 py-0.5 rounded-[2px] text-white flex items-center gap-0.5 z-10" style={{ backgroundColor: color }}>
              <Folder className="w-2 h-2 fill-current" />
            </div>
          </div>
        </div>
      );
  }
};

export const CardThumbnail: React.FC<{
  card: Flashcard;
  cardColor: string;
  styleId?: string;
}> = ({ card, cardColor, styleId = "S18" }) => {
  const color = cardColor || "#0056f6";

  const renderContent = () => {
    if (card.frontImage) {
      return (
        <>
          <ImageWithSkeleton
            src={card.frontImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={getSafeImageStyle(card.frontImagePosition)}
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </>
      );
    }
    return (
      <div 
        className="w-full h-full flex flex-col items-center justify-center p-1 relative"
        style={{ background: `linear-gradient(135deg, ${color}15, ${color}28)` }}
      >
        <div className="w-full h-0.5 rounded-full mb-1 opacity-70" style={{ backgroundColor: color }} />
        <RectangleVertical className="w-4 h-4 fill-current drop-shadow-2xs" style={{ color }} />
      </div>
    );
  };

  switch (styleId) {
    case "S01": // Minimal Standard with Top Colored Stripe
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-13.5 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            <div className="absolute top-0 inset-x-0 h-1 z-10" style={{ backgroundColor: color }} />
            {renderContent()}
            <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] bg-black/60 text-white z-10">
              <RectangleVertical className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S02": // Bookmark Ribbon
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-13.5 rounded-sm overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            <div 
              className="absolute top-0 right-1.5 w-2.5 h-3 rounded-b-xs shadow-2xs z-10 flex items-center justify-center"
              style={{ backgroundColor: color }}
            >
              <RectangleVertical className="w-1.5 h-1.5 text-white fill-white" />
            </div>
            {renderContent()}
            <div 
              className="absolute left-1 bottom-1 px-1 py-0.5 rounded-[2px] text-white flex items-center gap-1 shadow-2xs text-[9px] font-bold z-10"
              style={{ backgroundColor: color }}
            >
              <RectangleVertical className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S03": // Dual Inset Accent Frame
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div 
            className="relative w-10.5 h-13.5 rounded-[4px] p-0.5 border shadow-2xs flex items-center justify-center bg-white transition-transform group-hover:scale-102"
            style={{ borderColor: `${color}60` }}
          >
            <div className="relative w-full h-full rounded-[2px] overflow-hidden bg-slate-50 flex items-center justify-center">
              {renderContent()}
              <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] text-white z-10" style={{ backgroundColor: color }}>
                <RectangleVertical className="w-2.5 h-2.5 fill-current" />
              </div>
            </div>
          </div>
        </div>
      );

    case "S04": // Bottom Status Strip
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-13.5 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex flex-col bg-slate-50 transition-transform group-hover:scale-102">
            <div className="relative w-full flex-1 overflow-hidden">
              {renderContent()}
            </div>
            <div className="h-3 w-full flex items-center justify-between px-1 text-white z-10" style={{ backgroundColor: color }}>
              <span className="text-[8px] font-bold">بطاقة</span>
              <RectangleVertical className="w-2 h-2 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S05": // Chamfered Corner
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-13.5 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-white border-b border-l border-slate-300 z-10 shadow-2xs" />
            <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] bg-black/60 text-white z-10">
              <RectangleVertical className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S06": // Floating Glassmorphic Chip
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-13.5 rounded-sm overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded-full bg-white/90 dark:bg-black/80 backdrop-blur-md border border-white/40 shadow-xs flex items-center gap-1 z-10">
              <RectangleVertical className="w-2.5 h-2.5" style={{ color }} />
            </div>
          </div>
        </div>
      );

    case "S07": // Top Accent Spine (Horizontal on top border)
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-13.5 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            <div className="absolute top-0 inset-x-0 h-1.5 z-10" style={{ backgroundColor: color }} />
            {renderContent()}
            <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] bg-black/60 text-white z-10">
              <RectangleVertical className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S08": // Mobile 9:16 Tall Card
      return (
        <div className="w-14 h-15 shrink-0 flex items-center justify-center">
          <div className="relative w-9 h-14.5 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-900 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute left-1 bottom-1 px-1 py-0.5 rounded-[2px] bg-black/70 text-white text-[8px] font-bold z-10 flex items-center gap-0.5">
              <RectangleVertical className="w-2 h-2 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S09": // Polaroid White Frame
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-13.5 rounded-[2px] bg-white border border-slate-200/90 shadow-xs p-1 pb-2 flex flex-col justify-between transition-transform group-hover:scale-102">
            <div className="relative w-full flex-1 rounded-[1px] overflow-hidden bg-slate-100">
              {renderContent()}
            </div>
            <div className="flex items-center justify-between text-[8px] font-bold text-slate-500 px-0.5 pt-0.5">
              <span>بطاقة</span>
              <RectangleVertical className="w-2 h-2" style={{ color }} />
            </div>
          </div>
        </div>
      );

    case "S10": // Soft Gradient & Dot
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-13.5 rounded-[4px] overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute top-1 right-1 w-2 h-2 rounded-full border border-white shadow-xs z-10" style={{ backgroundColor: color }} />
            <div className="absolute left-1 bottom-1 p-0.5 rounded-full bg-black/60 text-white z-10">
              <RectangleVertical className="w-2 h-2 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S11": // Index Card Header Rule
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-13.5 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            <div className="absolute top-2 inset-x-0 h-px bg-red-400/80 z-10 pointer-events-none" />
            {renderContent()}
            <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] bg-black/60 text-white z-10">
              <RectangleVertical className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S12": // Sharp Architectural (1px radius)
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10 h-13.5 rounded-[1px] overflow-hidden border border-slate-300 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute left-0 bottom-0 px-1 py-0.5 text-white text-[8px] font-bold z-10" style={{ backgroundColor: color }}>
              <RectangleVertical className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S13": // Smooth Soft Capsule (rounded-md)
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-13.5 rounded-md overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute left-1.5 bottom-1.5 p-1 rounded-md bg-black/60 text-white z-10">
              <RectangleVertical className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S14": // Elevated Card Drop-Shadow
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10 h-13 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-sm flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] text-white z-10" style={{ backgroundColor: color }}>
              <RectangleVertical className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S15": // Slim Vertical Pinstripe
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-13.5 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            <div className="absolute top-0 bottom-0 right-0 w-0.5 z-10" style={{ backgroundColor: color }} />
            {renderContent()}
            <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] bg-black/60 text-white z-10">
              <RectangleVertical className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S16": // Top Header Ribbon
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-13.5 rounded-[3px] overflow-hidden border border-slate-200/90 shadow-2xs flex flex-col bg-slate-50 transition-transform group-hover:scale-102">
            <div className="h-2 w-full flex items-center px-1 text-white z-10" style={{ backgroundColor: color }}>
              <RectangleVertical className="w-1.5 h-1.5 fill-current" />
            </div>
            <div className="relative w-full flex-1 overflow-hidden">
              {renderContent()}
            </div>
          </div>
        </div>
      );

    case "S17": // Gallery Matte Frame
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-13.5 rounded-[2px] p-0.5 bg-slate-800 border border-slate-700 shadow-2xs flex items-center justify-center transition-transform group-hover:scale-102">
            <div className="relative w-full h-full rounded-[1px] overflow-hidden">
              {renderContent()}
            </div>
            <div className="absolute left-1 bottom-1 p-0.5 rounded-[2px] bg-black/80 text-white z-10">
              <RectangleVertical className="w-2 h-2 fill-current" />
            </div>
          </div>
        </div>
      );

    case "S18": // Hanging Badge Overlay
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-12.5 rounded-[3px] overflow-visible border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border border-white shadow-xs text-white flex items-center justify-center z-10" style={{ backgroundColor: color }}>
              <RectangleVertical className="w-2 h-2 fill-current" />
            </div>
            <div className="relative w-full h-full rounded-[3px] overflow-hidden">
              {renderContent()}
            </div>
          </div>
        </div>
      );

    case "S19": // Dark Translucent Tag
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div className="relative w-10.5 h-13.5 rounded-sm overflow-hidden border border-slate-200/90 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102">
            {renderContent()}
            <div className="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded-[3px] bg-black/75 backdrop-blur-xs text-white text-[8px] font-bold flex items-center gap-1 z-10">
              <RectangleVertical className="w-2 h-2 fill-current" />
              <span>بطاقة</span>
            </div>
          </div>
        </div>
      );

    case "S20": // Pro Studio Clean Border
    default:
      return (
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <div 
            className="relative w-10.5 h-13.5 rounded-[3px] overflow-hidden border-1.5 shadow-2xs flex items-center justify-center bg-slate-50 transition-transform group-hover:scale-102"
            style={{ borderColor: color }}
          >
            {renderContent()}
            <div className="absolute left-1 bottom-1 px-1 py-0.5 rounded-[2px] text-white flex items-center gap-0.5 z-10" style={{ backgroundColor: color }}>
              <RectangleVertical className="w-2 h-2 fill-current" />
            </div>
          </div>
        </div>
      );
  }
};

export const StylePickerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  currentStyleId: string;
  onSelectStyle: (styleId: string) => void;
  sampleFolder: FolderType;
  sampleCard: Flashcard;
}> = ({
  isOpen,
  onClose,
  currentStyleId,
  onSelectStyle,
  sampleFolder,
  sampleCard
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 text-right"
      dir="rtl"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0056f6] to-purple-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">
                  اختر الشكل المفضل لديك (20 نمطاً)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-200">
                  إعدادات مؤقتة
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                تصفح الأشكال أدناه واختر النمط الذي يناسبك، ثم أخبرني بالرمز (مثلاً S02 أو S07) لاعتماده نهائياً وحذف هذه الإعدادات.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - 20 Styles Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3.5 bg-slate-50/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {STYLES_LIST.map((style) => {
              const isSelected = currentStyleId === style.id;
              return (
                <div
                  key={style.id}
                  onClick={() => onSelectStyle(style.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 relative ${
                    isSelected
                      ? "border-[#0056f6] bg-blue-50/30 shadow-md ring-2 ring-[#0056f6]/20"
                      : "border-slate-200/80 bg-white hover:border-[#0056f6]/50 hover:shadow-sm"
                  }`}
                >
                  {/* Top: Style Tag & Name */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs ${
                          isSelected ? "bg-[#0056f6] text-white" : "bg-slate-100 text-slate-700"
                        }`}>
                          {style.id}
                        </span>
                        <h4 className="font-bold text-slate-800 text-sm">{style.name}</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">
                        {style.description}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-[#0056f6] bg-blue-100/70 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3 stroke-[3]" /> المفعّل
                      </span>
                    )}
                  </div>

                  {/* Middle: Live Previews Side-by-Side */}
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-center justify-around gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-400">معاينة المجلد</span>
                      <FolderThumbnail folder={sampleFolder} styleId={style.id} />
                    </div>
                    <div className="h-10 w-px bg-slate-200/60" />
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-400">معاينة البطاقة</span>
                      <CardThumbnail card={sampleCard} cardColor="#0056f6" styleId={style.id} />
                    </div>
                  </div>

                  {/* Bottom Action */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectStyle(style.id);
                    }}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? "bg-[#0056f6] text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-[#0056f6] hover:text-white"
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>النمط المطبق حالياً</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>اختيار وتطبيق {style.id}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-600 font-semibold">
            النمط المختار حالياً: <span className="font-mono font-black text-[#0056f6] px-2 py-0.5 bg-blue-50 rounded-md">{currentStyleId}</span> — شاركني الرمز عندما تقرر لتثبيته نهائياً!
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            إغلاق ومعاينة التطبيق
          </button>
        </div>
      </div>
    </div>
  );
};

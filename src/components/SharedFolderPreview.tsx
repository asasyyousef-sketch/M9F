import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Folder as FolderIcon,
  ChevronLeft,
  Volume2,
  Plus,
  Play,
  X,
  CheckCircle2,
  FolderPlus,
  User as UserIcon,
  ArrowRight,
  Eye,
  MessageSquare
} from "lucide-react";
import { DirectShareItem, Folder as FolderType, Flashcard, getSafeImageStyle, isGermanSentence } from "../types";
import { FolderThumbnail, CardThumbnail } from "./ThumbnailStyles";
import { speakClient } from "./Modals";
import { ImageWithSkeleton } from "./ReviewSession";

interface SharedFolderPreviewProps {
  directShare: DirectShareItem;
  searchQuery: string;
  onInsertFolder: (item: DirectShareItem) => void;
  onClosePreview: () => void;
  onTryReview?: (cards: Flashcard[], folder: FolderType, folders: FolderType[]) => void;
}

export const SharedFolderPreview: React.FC<SharedFolderPreviewProps> = ({
  directShare,
  searchQuery,
  onInsertFolder,
  onClosePreview,
  onTryReview
}) => {
  const [currentFolderId, setCurrentFolderId] = useState<string>(directShare.folder.id);
  const [previewCard, setPreviewCard] = useState<Flashcard | null>(null);
  const [isPreviewFlipped, setIsPreviewFlipped] = useState(false);
  const [showPreviewPlural, setShowPreviewPlural] = useState(false);

  // Reset navigation when opening a different shared item
  useEffect(() => {
    setCurrentFolderId(directShare.folder.id);
    setPreviewCard(null);
    setIsPreviewFlipped(false);
  }, [directShare.id, directShare.folder.id]);

  useEffect(() => {
    setShowPreviewPlural(false);
  }, [previewCard, isPreviewFlipped]);

  // All virtual folders in this shared bundle (root + all nested subfolders)
  const virtualFolders: FolderType[] = useMemo(() => {
    return [
      { ...directShare.folder, parentId: undefined },
      ...(directShare.subfolders || [])
    ];
  }, [directShare]);

  const virtualCards: Flashcard[] = useMemo(() => {
    return directShare.cards || [];
  }, [directShare]);

  const activeFolder = useMemo(() => {
    return virtualFolders.find((f) => f.id === currentFolderId) || virtualFolders[0];
  }, [virtualFolders, currentFolderId]);

  const folderColor = activeFolder?.color || "#0056f6";

  // Build breadcrumb path within the previewed shared folder
  const breadcrumbPath = useMemo(() => {
    const path: FolderType[] = [];
    let current = activeFolder;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift(current);
      if (current.id === directShare.folder.id || !current.parentId) {
        break;
      }
      current = virtualFolders.find((f) => f.id === current.parentId) || directShare.folder;
    }
    return path;
  }, [activeFolder, virtualFolders, directShare.folder]);

  const getRecursiveCardCount = useCallback(
    (folderId: string): number => {
      const subfolderIds = new Set<string>();
      const queue = [folderId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const f of virtualFolders) {
          if (f.parentId === curr && !subfolderIds.has(f.id)) {
            subfolderIds.add(f.id);
            queue.push(f.id);
          }
        }
      }
      const allIds = new Set([folderId, ...subfolderIds]);
      return virtualCards.filter((c) => allIds.has(c.folderId)).length;
    },
    [virtualFolders, virtualCards]
  );

  const displayedFolders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return virtualFolders.filter((f) => {
      if (f.id === directShare.folder.id) return false;
      const matchesParent = f.parentId === activeFolder.id;
      if (!matchesParent) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q))
      );
    });
  }, [virtualFolders, directShare.folder.id, activeFolder.id, searchQuery]);

  const displayedCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return virtualCards.filter((c) => {
      const belongsHere =
        c.folderId === activeFolder.id ||
        (activeFolder.id === directShare.folder.id && !virtualFolders.some((vf) => vf.id === c.folderId));
      if (!belongsHere) return false;
      if (!q) return true;
      return (
        c.frontText.toLowerCase().includes(q) ||
        c.backText.toLowerCase().includes(q) ||
        (c.translationHint && c.translationHint.toLowerCase().includes(q))
      );
    });
  }, [virtualCards, activeFolder.id, directShare.folder.id, virtualFolders, searchQuery]);

  const currentFolderAllCards = useMemo(() => {
    const subfolderIds = new Set<string>();
    const queue = [activeFolder.id];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const f of virtualFolders) {
        if (f.parentId === curr && !subfolderIds.has(f.id)) {
          subfolderIds.add(f.id);
          queue.push(f.id);
        }
      }
    }
    const allIds = new Set([activeFolder.id, ...subfolderIds]);
    return virtualCards.filter(
      (c) => allIds.has(c.folderId) || (activeFolder.id === directShare.folder.id && !virtualFolders.some((vf) => vf.id === c.folderId))
    );
  }, [activeFolder.id, directShare.folder.id, virtualFolders, virtualCards]);

  const playPronunciation = (text: string, lang: string) => {
    speakClient(text, lang);
  };

  return (
    <div className="space-y-4 md:space-y-5 pb-20" dir="rtl">
      {/* Preview Mode Sticky Banner with Insert CTA */}
      <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-l from-amber-50 via-white to-blue-50/70 p-3.5 md:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
            <Eye className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-slate-800">
                معاينة المجلد المشارك
              </span>
              {directShare.isImported ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  تم إدراجه في مكتبتك مسبقاً
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  غير مضاف للمكتبة بعد
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold flex-wrap">
              <span className="inline-flex items-center gap-1">
                <UserIcon className="w-3 h-3 text-slate-400" />
                مرسل من: <strong className="text-slate-700">{directShare.senderName}</strong>
                <span className="font-mono text-slate-400" dir="ltr">(@{directShare.senderUsername})</span>
              </span>
              <span>•</span>
              <span>{virtualCards.length} بطاقة</span>
              {directShare.subfolders.length > 0 && (
                <>
                  <span>•</span>
                  <span>{directShare.subfolders.length} مجلد فرعي</span>
                </>
              )}
            </div>
            {directShare.message && (
              <p className="text-[11px] text-slate-600 bg-white/80 border border-slate-200/70 rounded-lg px-2.5 py-1 inline-flex items-center gap-1.5 mt-0.5">
                <MessageSquare className="w-3 h-3 text-[#0056f6] shrink-0" />
                <span>{directShare.message}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={onClosePreview}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة لمكتبتي</span>
          </button>

          {onTryReview && currentFolderAllCards.length > 0 && (
            <button
              type="button"
              onClick={() => onTryReview(currentFolderAllCards, activeFolder, virtualFolders)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#0056f6] bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all flex items-center gap-1.5 cursor-pointer"
              title="تجربة المراجعة بدون حفظ المجلد في المكتبة"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>تجربة المراجعة</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onInsertFolder(directShare)}
            className="px-4 py-2 rounded-xl text-xs font-black text-white bg-[#0056f6] hover:bg-[#0047cc] shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>إدراج المجلد المشارك</span>
          </button>
        </div>
      </div>

      {/* Breadcrumbs Bar (Library Style) */}
      <div
        className="flex flex-nowrap items-center justify-between gap-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-100 px-3.5 py-1.5 rounded-2xl shadow-3xs w-full overflow-x-auto scrollbar-none"
        style={{
          borderRight: `3px solid ${folderColor}`
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {breadcrumbPath.map((f, index) => {
            const isLast = index === breadcrumbPath.length - 1;
            return (
              <React.Fragment key={f.id}>
                {index > 0 && <ChevronLeft className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                <button
                  type="button"
                  disabled={isLast}
                  onClick={() => setCurrentFolderId(f.id)}
                  className={
                    isLast
                      ? "px-2.5 py-1 rounded-lg font-extrabold text-xs shrink-0 truncate max-w-[240px]"
                      : "px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-[#0056f6] rounded-lg transition-all cursor-pointer shrink-0 truncate max-w-[160px]"
                  }
                  style={
                    isLast
                      ? {
                          backgroundColor: `${f.color || "#0056f6"}12`,
                          color: f.color || "#0056f6",
                          border: `1px solid ${f.color || "#0056f6"}20`
                        }
                      : undefined
                  }
                >
                  {f.name}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <span className="text-[11px] text-slate-400 font-semibold shrink-0">
          وضع المعاينة
        </span>
      </div>

      {/* Folder Banner (Exact Library Visual Style) */}
      <div
        className="relative overflow-hidden p-4 md:p-6 rounded-2xl border shadow-xs pl-20 md:pl-52"
        style={{
          borderRight: `4px solid ${folderColor}`,
          backgroundColor: folderColor,
          borderColor: folderColor
        }}
      >
        {activeFolder.coverImage && (
          <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <img
              src={activeFolder.coverImage}
              alt=""
              className="w-full h-full object-cover"
              style={{
                ...getSafeImageStyle(activeFolder.coverImagePosition),
                opacity: 0.15,
                filter: "blur(5px)"
              }}
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-black/5 to-transparent" />
          </div>
        )}

        <div
          className="absolute -top-20 -left-20 w-44 h-44 rounded-full blur-3xl pointer-events-none z-0"
          style={{ backgroundColor: "#ffffff", opacity: 0.15 }}
        />

        <div className="flex flex-col gap-1 w-full z-10 relative text-right min-w-0 pr-1">
          <h2 className="text-lg md:text-2xl font-black tracking-tight leading-tight truncate text-white drop-shadow-sm">
            {activeFolder.name}
          </h2>
          {activeFolder.description && (
            <p className="text-[11px] md:text-xs font-semibold leading-snug line-clamp-1 max-w-xl pr-0.5 text-white/85">
              {activeFolder.description}
            </p>
          )}
        </div>

        <div
          className="absolute left-0 top-0 bottom-0 w-16 md:w-48 border-r md:border-r-0 md:border-l border-slate-100/10 overflow-hidden flex items-center justify-center shrink-0 z-10"
          style={{ backgroundColor: `${folderColor}15` }}
        >
          {activeFolder.coverImage ? (
            <>
              <ImageWithSkeleton
                src={activeFolder.coverImage}
                alt="غلاف المجلد"
                className="absolute inset-0 w-full h-full object-cover"
                style={getSafeImageStyle(activeFolder.coverImagePosition)}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-transparent pointer-events-none" />
            </>
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center text-white"
              style={{ background: `linear-gradient(135deg, ${folderColor}, ${folderColor}dd)` }}
            >
              <FolderIcon className="w-6 h-6 md:w-8 md:h-8 fill-white/20 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Subfolders & Cards List (Exact Library Visual Style) */}
      <div className="pt-1 min-h-[260px]">
        {displayedFolders.length === 0 && displayedCards.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200/70 flex flex-col items-center justify-center p-6">
            <FolderIcon className="w-12 h-12 text-slate-300 mb-3" />
            <h4 className="font-bold text-slate-700 text-sm">
              {searchQuery ? "لا توجد نتائج مطابقة للبحث" : "هذا المجلد فارغ"}
            </h4>
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {/* Subfolders */}
            {displayedFolders.map((f) => {
              const fRecursiveCardCount = getRecursiveCardCount(f.id);
              return (
                <div key={f.id} className="py-1.5 w-full">
                  <div
                    onClick={() => setCurrentFolderId(f.id)}
                    className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-lg hover:shadow-xs hover:bg-slate-50/40 transition-all cursor-pointer group select-none"
                  >
                    <div className="flex items-center gap-4 text-right">
                      <FolderThumbnail folder={f} styleId="S18" />
                      <div>
                        <h4 className="font-bold text-[#202124] text-base group-hover:text-[#0056f6] transition-colors leading-snug">
                          {f.name}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {fRecursiveCardCount} بطاقة
                        </p>
                      </div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-[#0056f6] transition-colors" />
                  </div>
                </div>
              );
            })}

            {/* Cards */}
            {displayedCards.map((card) => {
              const cardFolder = virtualFolders.find((f) => f.id === card.folderId) || activeFolder;
              const cardColor = cardFolder?.color || "#0056f6";
              return (
                <div key={card.id} className="py-1.5 w-full">
                  <div
                    onClick={() => {
                      setPreviewCard(card);
                      setIsPreviewFlipped(false);
                    }}
                    className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-lg hover:shadow-xs hover:bg-slate-50/40 transition-all group cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-4 text-right min-w-0 flex-1">
                      <CardThumbnail card={card} cardColor={cardColor} styleId="S18" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-[#202124] text-base group-hover:text-[#0056f6] transition-colors leading-snug truncate" dir="ltr">
                          {card.frontText}
                        </h4>
                        {(card.translationHint || card.backText) && (
                          <p className="text-xs text-slate-500 font-medium mt-0.5 truncate" dir="rtl">
                            {card.translationHint || card.backText}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playPronunciation(card.frontText, card.frontLang || activeFolder.frontLang || "de");
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-[#0056f6] hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
                      title="استمع للنطق"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3D Interactive Flashcard Flip Preview Modal */}
      {previewCard && (
        <div
          onClick={() => setPreviewCard(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in text-right cursor-default"
          dir="rtl"
        >
          <button
            type="button"
            onClick={() => setPreviewCard(null)}
            className="mb-3 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="إغلاق المعاينة"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm h-[520px] flex items-center justify-center"
          >
            <div
              onClick={() => setIsPreviewFlipped(!isPreviewFlipped)}
              className={`w-full h-full flip-card cursor-pointer select-none ${isPreviewFlipped ? "flipped" : ""}`}
            >
              <div className="w-full h-full relative flip-card-inner rounded-2xl shadow-2xl transition-all duration-300">
                {/* FRONT FACE */}
                <div className="absolute inset-0 w-full h-full flip-card-front rounded-2xl flex flex-col p-6 border border-slate-100 bg-white overflow-hidden justify-between">
                  <div className="flex justify-between items-center w-full">
                    <span
                      className="text-[10px] font-extrabold px-3 py-1 rounded-full border text-slate-700 bg-slate-50"
                      style={{ borderColor: `${folderColor}30` }}
                    >
                      {virtualFolders.find((f) => f.id === previewCard.folderId)?.name || activeFolder.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playPronunciation(previewCard.frontText, previewCard.frontLang);
                      }}
                      className="w-9 h-9 rounded-full bg-slate-50 text-slate-700 border border-slate-100 flex items-center justify-center hover:bg-[#0056f6]/10 hover:text-[#0056f6] transition-all cursor-pointer"
                      title="استمع للنطق"
                    >
                      <Volume2 className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center py-4">
                    {previewCard.frontImage ? (
                      <div className="w-full aspect-square max-w-[260px] mx-auto rounded-xl overflow-hidden relative mb-4 border border-slate-100 flex items-center justify-center bg-slate-50 shrink-0">
                        <ImageWithSkeleton
                          src={previewCard.frontImage}
                          alt="Front Illustration"
                          className="absolute inset-0 w-full h-full object-cover"
                          style={getSafeImageStyle(previewCard.frontImagePosition)}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-24 relative mb-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200/80 flex flex-col justify-center gap-2 p-3 overflow-hidden">
                        <div className="h-0.5 w-[85%] bg-slate-200/60 rounded-full" />
                        <div className="h-0.5 w-[65%] bg-slate-200/60 rounded-full" />
                        <div className="h-0.5 w-[75%] bg-slate-200/60 rounded-full" />
                        <div className="absolute right-3 top-0 bottom-0 w-[1px] bg-rose-200/60" />
                      </div>
                    )}

                    <div className="text-center w-full px-2">
                      <h3 className="text-2xl font-extrabold text-[#202124] tracking-tight leading-snug break-words whitespace-pre-wrap" dir="ltr">
                        {previewCard.frontText}
                      </h3>
                      {previewCard.translationHint && (
                        <p className="text-xs font-bold text-[#5f6368] mt-2 bg-slate-50 py-1 px-2.5 rounded-lg inline-block border border-slate-100">
                          {previewCard.translationHint}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center w-full border-t border-slate-100 pt-3 text-slate-400 text-[10px] font-bold">
                    <span>اضغط للقلب</span>
                    <span>الوجه الأمامي</span>
                  </div>
                </div>

                {/* BACK FACE */}
                <div className="absolute inset-0 w-full h-full flip-card-back rounded-2xl flex flex-col p-6 border-2 border-[#0056f6]/20 bg-white overflow-hidden justify-between">
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[10px] font-extrabold bg-[#0056f6]/10 text-[#0056f6] px-3 py-1 rounded-full">
                      {showPreviewPlural ? "صيغة الجمع" : "الإجابة / الترجمة"}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (showPreviewPlural && previewCard.pluralText) {
                            playPronunciation(previewCard.pluralText, previewCard.pluralLang || "de");
                          } else {
                            playPronunciation(previewCard.backText, previewCard.backLang);
                          }
                        }}
                        className="w-9 h-9 rounded-full bg-[#0056f6]/5 text-[#0056f6] border border-[#0056f6]/10 flex items-center justify-center hover:bg-[#0056f6]/15 transition-all cursor-pointer"
                        title="استمع للنطق"
                      >
                        <Volume2 className="w-4.5 h-4.5" />
                      </button>

                      {previewCard.isPluralMode && previewCard.pluralText && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextShow = !showPreviewPlural;
                            setShowPreviewPlural(nextShow);
                            if (nextShow) {
                              playPronunciation(previewCard.pluralText!, previewCard.pluralLang || "de");
                            } else {
                              playPronunciation(previewCard.backText, previewCard.backLang);
                            }
                          }}
                          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                            showPreviewPlural
                              ? "bg-purple-600 text-white border-purple-600 shadow-sm hover:bg-purple-700"
                              : "bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100"
                          }`}
                          title={showPreviewPlural ? "العودة للترجمة" : "عرض صيغة الجمع للكلمة (+)"}
                        >
                          <Plus className="w-4.5 h-4.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center py-4">
                    {previewCard.backImage && (
                      <div className="w-full aspect-square rounded-xl overflow-hidden relative mb-4 border border-slate-100 flex items-center justify-center bg-slate-50 shrink-0">
                        <ImageWithSkeleton
                          src={previewCard.backImage}
                          alt="Back Illustration"
                          className="absolute inset-0 w-full h-full object-cover"
                          style={getSafeImageStyle(previewCard.backImagePosition)}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    <div className="text-center w-full px-2">
                      <h3 className="text-xl font-bold text-slate-900 leading-relaxed break-words whitespace-pre-wrap">
                        {showPreviewPlural && previewCard.pluralText ? (
                          <div className="flex flex-col items-center gap-1.5 animate-fadeIn">
                            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                              صيغة الجمع (Plural)
                            </span>
                            <span className="whitespace-pre-wrap font-extrabold text-purple-950">
                              {previewCard.pluralText}
                            </span>
                          </div>
                        ) : (
                          <span className="whitespace-pre-wrap">{previewCard.backText}</span>
                        )}
                      </h3>
                      {!isGermanSentence(previewCard.frontText || "") && previewCard.correctArticle && (
                        <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded-full font-bold text-xs">
                          <span>أداة التعريف:</span>
                          <span className="font-sans font-extrabold text-sm uppercase">
                            {previewCard.correctArticle === "die-plural" ? "die" : previewCard.correctArticle}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center w-full border-t border-slate-100 pt-3 text-slate-400 text-[10px] font-bold">
                    <span>اضغط للقلب</span>
                    <span>الوجه الخلفي</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

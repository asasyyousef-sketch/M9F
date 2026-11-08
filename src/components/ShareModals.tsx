import React, { useState, useEffect, useRef } from "react";
import { 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Folder, 
  Layers, 
  Download, 
  Sparkles, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Globe, 
  Image as ImageIcon, 
  Volume2, 
  BookOpen, 
  Play, 
  Smartphone,
  ChevronDown,
  ChevronUp,
  Wifi,
  Laptop,
  Edit2
} from "lucide-react";
import { Folder as FolderType, Flashcard, SharedDeckData, getSafeImageStyle, normalizeMediaUrl } from "../types";

// ─── ShareFolderModal ──────────────────────────────────────────────────────────
interface ShareFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: FolderType | null;
  allFolders: FolderType[];
  allCards: Flashcard[];
  currentUserName?: string;
}

export const ShareFolderModal: React.FC<ShareFolderModalProps> = ({
  isOpen,
  onClose,
  folder,
  allFolders,
  allCards,
  currentUserName
}) => {
  const [shareId, setShareId] = useState<string>("");
  const [lanHost, setLanHost] = useState<string>("");
  const [serverHost, setServerHost] = useState<string>("");
  const [availableIps, setAvailableIps] = useState<string[]>([]);
  const [selectedHostMode, setSelectedHostMode] = useState<"current" | "lan" | "localhost" | "custom">(() => {
    const saved = localStorage.getItem("preferred_share_host_mode");
    if (saved === "current" || saved === "lan" || saved === "localhost" || saved === "custom") {
      return saved as any;
    }
    return "current";
  });
  const [customHostInput, setCustomHostInput] = useState<string>(() => {
    return localStorage.getItem("preferred_share_custom_host") || "";
  });
  const [isEditingCustomHost, setIsEditingCustomHost] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [showQrCode, setShowQrCode] = useState<boolean>(false);
  const [showCardsPreview, setShowCardsPreview] = useState<boolean>(false);

  // Cards belonging to this folder (and subfolders)
  const folderCards = React.useMemo(() => {
    if (!folder) return [];
    // Collect child folder IDs
    const childFolderIds = new Set<string>([folder.id]);
    const collectChildren = (parentId: string) => {
      allFolders.filter(f => f.parentId === parentId).forEach(child => {
        childFolderIds.add(child.id);
        collectChildren(child.id);
      });
    };
    collectChildren(folder.id);

    return allCards.filter(c => childFolderIds.has(c.folderId));
  }, [folder, allFolders, allCards]);

  const subfolders = React.useMemo(() => {
    if (!folder) return [];
    return allFolders.filter(f => f.parentId === folder.id);
  }, [folder, allFolders]);

  // Request share link generation when modal opens
  useEffect(() => {
    if (!isOpen || !folder) {
      setShareId("");
      setQrCodeDataUrl("");
      setError(null);
      setCopied(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch("/api/share/folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder,
        cards: folderCards,
        subfolders,
        authorName: currentUserName || "مستخدم مدرب اللغات"
      })
    })
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data.success && data.shareId) {
          setShareId(data.shareId);
          const rawLan = data.lanHost || "";
          const isValidLan = rawLan && !rawLan.startsWith("169.254.") && !rawLan.startsWith("127.");
          if (isValidLan) {
            setLanHost(rawLan);
          } else {
            setLanHost("");
          }
          if (data.currentHost) setServerHost(data.currentHost);
          if (data.networkIps) {
            const filteredIps = (data.networkIps as string[]).filter(ip => !ip.startsWith("169.254.") && !ip.startsWith("127."));
            setAvailableIps(filteredIps);
          }
          if (isValidLan && data.primaryLanIp && !localStorage.getItem("preferred_share_custom_host")) {
            const portMatch = (data.currentHost || "").match(/:(\d+)$/);
            const port = portMatch ? portMatch[1] : "3000";
            setCustomHostInput(`${data.primaryLanIp}:${port}`);
          }
        } else {
          setError(data.error || "تعذر إنشاء رابط المشاركة");
        }
      })
      .catch(err => {
        if (!isMounted) return;
        console.error("Error creating share link:", err);
        setError("فشل الاتصال بالخادم لإنشاء الرابط");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, folder, folderCards, subfolders, currentUserName]);

  // Determine effective host dynamically
  const browserHost = typeof window !== "undefined" ? window.location.host : "localhost:3000";
  const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
  const publicBrowserHost = browserHost.replace(/^ais-dev-/, "ais-pre-");

  const effectiveHost = React.useMemo(() => {
    if (selectedHostMode === "custom" && customHostInput.trim()) {
      return customHostInput.trim();
    }
    if (selectedHostMode === "localhost") {
      const port = browserHost.split(":")[1] || "3000";
      return `localhost:${port}`;
    }
    const isValidLan = lanHost && !lanHost.startsWith("169.254.") && !lanHost.startsWith("127.");
    if (selectedHostMode === "lan" && isValidLan) {
      return lanHost;
    }
    // Safe standard: The public accessible domain or IP
    return publicBrowserHost;
  }, [selectedHostMode, customHostInput, lanHost, browserHost, publicBrowserHost]);

  const activeShareUrl = React.useMemo(() => {
    if (!shareId) return "";
    return `${protocol}//${effectiveHost}/?share=${shareId}`;
  }, [protocol, effectiveHost, shareId]);

  // Update QR code whenever activeShareUrl changes
  useEffect(() => {
    if (activeShareUrl) {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(activeShareUrl)}`;
      setQrCodeDataUrl(qrUrl);
    } else {
      setQrCodeDataUrl("");
    }
  }, [activeShareUrl]);

  if (!isOpen || !folder) return null;

  const handleCopyLink = () => {
    if (!activeShareUrl) return;
    navigator.clipboard.writeText(activeShareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleNativeShare = () => {
    if (navigator.share && activeShareUrl) {
      navigator.share({
        title: `ملف بطاقات: ${folder.name}`,
        text: `📚 شاركت معك ملف البطاقات التعليمية "${folder.name}" (${folderCards.length} بطاقة). اضغط الرابط لإضافته فوراً لمكتبتك!`,
        url: activeShareUrl
      }).catch(() => {});
    }
  };

  const shareText = encodeURIComponent(
    `📚 شاركت معك ملف البطاقات التعليمية "${folder.name}" (${folderCards.length} بطاقة).\nاضغط على الرابط لإضافته فوراً إلى مكتبتك بكل صوره وكلماته وترتيبه:\n${activeShareUrl}`
  );
  const whatsappUrl = `https://api.whatsapp.com/send?text=${shareText}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(activeShareUrl)}&text=${encodeURIComponent(`📚 ملف بطاقات: ${folder.name} (${folderCards.length} بطاقة)`)}`;

  const handleDownloadDeckBackup = () => {
    const backupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      folder: {
        ...folder,
        coverImage: normalizeMediaUrl(folder.coverImage)
      },
      subfolders: subfolders.map(sf => ({
        ...sf,
        coverImage: normalizeMediaUrl(sf.coverImage)
      })),
      cards: folderCards.map(c => ({
        ...c,
        frontImage: normalizeMediaUrl(c.frontImage),
        frontAudioUrl: normalizeMediaUrl(c.frontAudioUrl),
        backImage: normalizeMediaUrl(c.backImage),
        backAudioUrl: normalizeMediaUrl(c.backAudioUrl)
      }))
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${folder.name.replace(/\s+/g, "_")}_بطاقات.deck.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
              style={{ backgroundColor: folder.color || "#0056f6" }}
            >
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">مشاركة الملف برابط</h3>
              <p className="text-xs text-slate-400">
                أي شخص لديه الرابط يمكنه إضافة الملف لمكتبته
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Deck Card Overview (Simplified & Clean) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3.5">
            {/* Visual Cover Thumbnail */}
            <div 
              className="relative w-14 h-18 rounded-xl overflow-hidden shrink-0 shadow-xs border border-slate-200/80 bg-white"
            >
              {folder.coverImage ? (
                <img
                  src={normalizeMediaUrl(folder.coverImage)}
                  alt=""
                  className="w-full h-full object-cover"
                  style={getSafeImageStyle(folder.coverImagePosition)}
                />
              ) : (
                <div 
                  className="w-full h-full flex flex-col items-center justify-center p-1 text-center text-white"
                  style={{ backgroundColor: folder.color || "#0056f6" }}
                >
                  <BookOpen className="w-5 h-5 text-white/90" />
                </div>
              )}
            </div>

            {/* Folder Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-800 text-sm truncate">{folder.name}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-500 font-medium">
                  {folderCards.length} بطاقة
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-medium">
                  {folder.frontLang || "de"} ⬅️ {folder.backLang || "ar"}
                </span>
                {subfolders.length > 0 && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500 font-medium">
                      {subfolders.length} مجلد فرعي
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Domain & Host Selection Control */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5" dir="rtl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Globe className="w-4 h-4 text-[#0056f6]" />
                <span>نطاق الرابط (الدومين / IP):</span>
              </div>
              <span className="text-[11px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                {effectiveHost}
              </span>
            </div>

            {/* Quick Host Switcher Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
              {lanHost && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHostMode("lan");
                    localStorage.setItem("preferred_share_host_mode", "lan");
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    selectedHostMode === "lan"
                      ? "bg-white text-[#0056f6] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title={`مشاركة عبر شبكة Wi-Fi: ${lanHost}`}
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>شبكة Wi-Fi ({lanHost.split(":")[0]})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedHostMode("localhost");
                  localStorage.setItem("preferred_share_host_mode", "localhost");
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  selectedHostMode === "localhost"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="للفتح على نفس الكمبيوتر فقط"
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Localhost</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedHostMode("custom");
                  localStorage.setItem("preferred_share_host_mode", "custom");
                  setIsEditingCustomHost(true);
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  selectedHostMode === "custom"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="تحديد IP أو دومين مخصص يدوياً"
              >
                <Edit2 className="w-3 h-3" />
                <span>تخصيص IP</span>
              </button>
            </div>

            {/* Inline Custom Host Edit Input */}
            {(selectedHostMode === "custom" || isEditingCustomHost) && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={customHostInput}
                  onChange={(e) => {
                    setCustomHostInput(e.target.value);
                    localStorage.setItem("preferred_share_custom_host", e.target.value.trim());
                  }}
                  placeholder="مثال: 192.168.0.159:3000 أو mydomain.com"
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0056f6]"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customHostInput.trim()) {
                      localStorage.setItem("preferred_share_custom_host", customHostInput.trim());
                      setSelectedHostMode("custom");
                      setIsEditingCustomHost(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-[#0056f6] hover:bg-[#0047cc] text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  حفظ
                </button>
              </div>
            )}

            {/* Contextual Guidance Note */}
            {effectiveHost.includes("localhost") ? (
              <p className="text-[11px] text-amber-800 bg-amber-50/90 border border-amber-200/80 rounded-xl p-2.5 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>تنبيه:</strong> رابط localhost يعمل فقط على هذا الجهاز نفسه. لمشاركة الرابط مع هاتفك أو جهاز آخر عبر نفس شبكة Wi-Fi، اضغط على <strong>شبكة Wi-Fi</strong> أعلاه ليتمكن الهاتف من فتحه ومسح رمز الـ QR.
                </span>
              </p>
            ) : (
              <p className="text-[11px] text-emerald-800 bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  الرابط متوافق مع الهواتف والأجهزة المتصلة بنفس شبكة Wi-Fi ({effectiveHost}).
                </span>
              </p>
            )}
          </div>

          {/* Share Link Section */}
          {isLoading ? (
            <div className="p-8 rounded-2xl bg-slate-50 flex flex-col items-center justify-center gap-2 text-center">
              <div className="w-6 h-6 border-2 border-[#0056f6] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">جاري إنشاء الرابط...</p>
            </div>
          ) : error ? (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Main Copy Action */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={activeShareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0056f6] cursor-text"
                  dir="ltr"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                    copied 
                      ? "bg-emerald-600 text-white" 
                      : "bg-[#0056f6] hover:bg-[#0047cc] text-white active:scale-95"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      تم النسخ
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      نسخ الرابط
                    </>
                  )}
                </button>
              </div>

              {/* Quick Share Options: WhatsApp, Telegram, QR Code */}
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>واتساب</span>
                </a>

                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl border border-sky-200 bg-sky-50/70 hover:bg-sky-100 text-sky-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>تيليجرام</span>
                </a>

                <button
                  onClick={() => setShowQrCode(!showQrCode)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    showQrCode 
                      ? "bg-slate-800 text-white border-slate-800" 
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{showQrCode ? "إخفاء QR" : "رمز QR"}</span>
                </button>
              </div>

              {/* QR Code view */}
              {showQrCode && qrCodeDataUrl && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center gap-2">
                  <img src={qrCodeDataUrl} alt="QR Code" className="w-40 h-40 rounded-lg bg-white p-2 shadow-2xs" />
                  <p className="text-[11px] text-slate-500 font-medium text-center">
                    امسح الرمز بكاميرا الهاتف للفتح مباشرة عبر ({effectiveHost})
                  </p>
                </div>
              )}

              {/* Optional preview of cards */}
              <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowCardsPreview(!showCardsPreview)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-100/80 transition-colors flex items-center justify-between text-xs font-medium text-slate-600 cursor-pointer"
                >
                  <span>معاينة البطاقات ({folderCards.length})</span>
                  {showCardsPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showCardsPreview && (
                  <div className="p-2.5 max-h-44 overflow-y-auto space-y-1.5 border-t border-slate-100 bg-white">
                    {folderCards.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">لا توجد بطاقات في هذا المجلد</p>
                    ) : (
                      folderCards.map((card, idx) => (
                        <div 
                          key={card.id || idx}
                          className="px-2.5 py-1.5 bg-slate-50 rounded-lg flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] text-slate-400 font-bold w-4 text-center shrink-0">{idx + 1}</span>
                            <span className="font-semibold text-slate-800 truncate">{card.frontText}</span>
                          </div>
                          <span className="text-slate-500 text-[11px] truncate">{card.backText}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <button
            onClick={handleDownloadDeckBackup}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            تنزيل JSON
          </button>
          
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer shadow-2xs"
          >
            تم
          </button>
        </div>
      </div>
    </div>
  );
};



// ─── ImportSharedDeckModal ─────────────────────────────────────────────────────
interface ImportSharedDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  sharedData: SharedDeckData | null;
  isLoading: boolean;
  error: string | null;
  onImport: (sharedData: SharedDeckData, openImmediately: boolean) => void;
  onStartReview?: (cards: Flashcard[]) => void;
  existingFolders: FolderType[];
}

export const ImportSharedDeckModal: React.FC<ImportSharedDeckModalProps> = ({
  isOpen,
  onClose,
  sharedData,
  isLoading,
  error,
  onImport,
  onStartReview,
  existingFolders
}) => {
  const [showCardsPreview, setShowCardsPreview] = useState(false);

  if (!isOpen) return null;

  const folder = sharedData?.folder;
  const cards = sharedData?.cards || [];

  const alreadyExists = folder ? existingFolders.some(f => f.name.trim().toLowerCase() === folder.name.trim().toLowerCase()) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">ملف بطاقات مشارك</h3>
              <p className="text-xs text-slate-400">
                {sharedData?.authorName ? `بواسطة: ${sharedData.authorName}` : "تلقيت ملف بطاقات جديد"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {isLoading ? (
            <div className="p-8 rounded-2xl bg-slate-50 flex flex-col items-center justify-center gap-2 text-center">
              <div className="w-6 h-6 border-2 border-[#0056f6] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">جاري تحميل بيانات الملف...</p>
            </div>
          ) : error || !sharedData || !folder ? (
            <div className="p-6 text-center space-y-3">
              <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
              <p className="font-bold text-slate-800 text-sm">تعذر فتح الملف</p>
              <p className="text-xs text-slate-500">{error || "الرابط غير صالح"}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          ) : (
            <>
              {/* Folder Overview Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                {/* Visual Cover */}
                <div 
                  className="relative w-16 h-20 rounded-xl overflow-hidden shrink-0 shadow-xs border border-slate-200/80 bg-white"
                >
                  {folder.coverImage ? (
                    <img
                      src={normalizeMediaUrl(folder.coverImage)}
                      alt=""
                      className="w-full h-full object-cover"
                      style={getSafeImageStyle(folder.coverImagePosition)}
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-white"
                      style={{ backgroundColor: folder.color || "#0056f6" }}
                    >
                      <BookOpen className="w-6 h-6 text-white/90" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 text-base truncate">{folder.name}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-600 font-semibold bg-white px-2 py-0.5 rounded-md border border-slate-200/70">
                      {cards.length} بطاقة
                    </span>
                    <span className="text-xs text-slate-600 font-semibold bg-white px-2 py-0.5 rounded-md border border-slate-200/70">
                      {folder.frontLang || "de"} ⬅️ {folder.backLang || "ar"}
                    </span>
                  </div>
                </div>
              </div>

              {alreadyExists && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  يوجد ملف بنفس الاسم، سيتم حفظ هذا الملف كنسخة إضافية.
                </p>
              )}

              {/* Cards Preview Accordion */}
              <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowCardsPreview(!showCardsPreview)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-100/80 transition-colors flex items-center justify-between text-xs font-medium text-slate-600 cursor-pointer"
                >
                  <span>معاينة البطاقات ({cards.length})</span>
                  {showCardsPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showCardsPreview && (
                  <div className="p-2.5 max-h-48 overflow-y-auto space-y-1.5 border-t border-slate-100 bg-white">
                    {cards.map((card, idx) => (
                      <div 
                        key={card.id || idx}
                        className="px-2.5 py-1.5 bg-slate-50 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] text-slate-400 font-bold w-4 text-center shrink-0">{idx + 1}</span>
                          <span className="font-semibold text-slate-800 truncate">{card.frontText}</span>
                        </div>
                        <span className="text-slate-500 text-[11px] truncate">{card.backText}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!isLoading && !error && sharedData && folder && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <div className="flex items-center gap-2">
              {onStartReview && cards.length > 0 && (
                <button
                  onClick={() => {
                    onImport(sharedData, false);
                    onStartReview(cards);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Play className="w-3 h-3 text-[#0056f6]" />
                  مراجعة الآن
                </button>
              )}

              <button
                onClick={() => onImport(sharedData, true)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#0056f6] hover:bg-[#0047cc] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                حفظ في مكتبتي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

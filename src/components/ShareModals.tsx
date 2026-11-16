import React, { useState, useEffect } from "react";
import { 
  Share2, 
  Copy, 
  Check, 
  QrCode, 
  Download, 
  Sparkles, 
  X, 
  AlertCircle, 
  BookOpen, 
  Play, 
  ChevronDown,
  ChevronUp,
  Send,
  Users,
  Search,
  CheckCircle2,
  ShieldCheck,
  User as UserIcon
} from "lucide-react";
import { Folder as FolderType, Flashcard, SharedDeckData, DirectShareUser, getSafeImageStyle } from "../types";
import { useAuth } from "../context/AuthContext";

// ─── ShareFolderModal ──────────────────────────────────────────────────────────
interface ShareFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: FolderType | null;
  allFolders: FolderType[];
  allCards: Flashcard[];
  currentUserName?: string;
  initialMode?: "link" | "send";
  onSentSuccess?: (msg: string) => void;
}

export const ShareFolderModal: React.FC<ShareFolderModalProps> = ({
  isOpen,
  onClose,
  folder,
  allFolders,
  allCards,
  currentUserName,
  initialMode = "link",
  onSentSuccess
}) => {
  const { authFetch } = useAuth();
  const [activeMode, setActiveMode] = useState<"link" | "send">(initialMode);

  // Link share states
  const [shareUrl, setShareUrl] = useState<string>("");
  const [shareId, setShareId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [showQrCode, setShowQrCode] = useState<boolean>(false);
  const [showCardsPreview, setShowCardsPreview] = useState<boolean>(false);

  // Direct send-to-user states
  const [recipients, setRecipients] = useState<DirectShareUser[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState<boolean>(false);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState<string>("");
  const [sendMessage, setSendMessage] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentSuccessText, setSentSuccessText] = useState<string | null>(null);

  // Sync mode when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveMode(initialMode);
      setSelectedRecipientIds([]);
      setRecipientSearch("");
      setSendMessage("");
      setSendError(null);
      setSentSuccessText(null);
    }
  }, [isOpen, initialMode, folder?.id]);

  // Cards & ALL recursive subfolders belonging to this folder
  const { folderCards, subfolders } = React.useMemo(() => {
    if (!folder) return { folderCards: [], subfolders: [] };
    const childFolderIds = new Set<string>([folder.id]);
    const collectedSubfolders: FolderType[] = [];
    const collectChildren = (parentId: string) => {
      allFolders.filter(f => f.parentId === parentId).forEach(child => {
        if (!childFolderIds.has(child.id)) {
          childFolderIds.add(child.id);
          collectedSubfolders.push(child);
          collectChildren(child.id);
        }
      });
    };
    collectChildren(folder.id);

    return {
      subfolders: collectedSubfolders,
      folderCards: allCards.filter(c => childFolderIds.has(c.folderId))
    };
  }, [folder, allFolders, allCards]);

  // Request share link generation when link mode is active
  useEffect(() => {
    if (!isOpen || !folder) {
      setShareUrl("");
      setShareId("");
      setQrCodeDataUrl("");
      setError(null);
      setCopied(false);
      return;
    }

    if (activeMode !== "link") return;
    if (shareUrl) return;

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
        if (data.success && data.shareUrl) {
          setShareUrl(data.shareUrl);
          setShareId(data.shareId);
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(data.shareUrl)}`;
          setQrCodeDataUrl(qrUrl);
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
  }, [isOpen, folder, activeMode, shareUrl, folderCards, subfolders, currentUserName]);

  // Fetch system users when send mode is active
  useEffect(() => {
    if (!isOpen || activeMode !== "send") return;
    let isMounted = true;
    setIsLoadingRecipients(true);
    setRecipientsError(null);

    authFetch("/api/users/recipients")
      .then(async res => {
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "تعذر جلب قائمة المستخدمين");
        }
        return data;
      })
      .then(data => {
        if (!isMounted) return;
        setRecipients(Array.isArray(data.users) ? data.users : []);
      })
      .catch(err => {
        if (!isMounted) return;
        setRecipientsError(err.message || "تعذر تحميل قائمة المستخدمين");
      })
      .finally(() => {
        if (isMounted) setIsLoadingRecipients(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeMode, authFetch]);

  if (!isOpen || !folder) return null;

  const filteredRecipients = recipients.filter((u) => {
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
  });

  const toggleRecipient = (id: string) => {
    setSentSuccessText(null);
    setSendError(null);
    setSelectedRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDirectSend = async () => {
    if (selectedRecipientIds.length === 0) {
      setSendError("يرجى اختيار مستخدم واحد على الأقل لإرسال المجلد إليه.");
      return;
    }

    setIsSending(true);
    setSendError(null);
    setSentSuccessText(null);

    try {
      const res = await authFetch("/api/direct-shares/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientIds: selectedRecipientIds,
          folder,
          cards: folderCards,
          subfolders,
          message: sendMessage
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشل إرسال المجلد");
      }

      const names = (data.recipients || []).map((r: any) => r.name || r.username).join("، ");
      const msg = `تم إرسال "${folder.name}" بنجاح إلى: ${names}`;
      setSentSuccessText(msg);
      setSelectedRecipientIds([]);
      setSendMessage("");
      if (onSentSuccess) {
        onSentSuccess(`📨 ${msg}`);
      }
    } catch (err: any) {
      setSendError(err.message || "حدث خطأ أثناء إرسال المجلد");
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const shareText = encodeURIComponent(
    `📚 شاركت معك ملف البطاقات التعليمية "${folder.name}" (${folderCards.length} بطاقة).\nاضغط على الرابط لإضافته فوراً إلى مكتبتك بكل صوره وكلماته وترتيبه:\n${shareUrl}`
  );
  const whatsappUrl = `https://api.whatsapp.com/send?text=${shareText}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`📚 ملف بطاقات: ${folder.name} (${folderCards.length} بطاقة)`)}`;

  const handleDownloadDeckBackup = () => {
    const backupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      folder,
      subfolders,
      cards: folderCards
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
              {activeMode === "send" ? <Send className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                {activeMode === "send" ? "إرسال المجلد لمستخدم" : "مشاركة الملف برابط"}
              </h3>
              <p className="text-xs text-slate-400">
                {activeMode === "send"
                  ? "أرسل المجلد مباشرة لحساب مستخدم آخر ليظهر في زر الجرس لديه"
                  : "أي شخص لديه الرابط يمكنه إضافة الملف لمكتبته"}
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

        {/* Parallel Mode Switcher: Link Share vs Direct Send */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/70">
            <button
              type="button"
              onClick={() => setActiveMode("link")}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMode === "link"
                  ? "bg-white text-[#0056f6] shadow-xs"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>مشاركة برابط</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("send")}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMode === "send"
                  ? "bg-white text-[#0056f6] shadow-xs"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>إرسال لمستخدم</span>
            </button>
          </div>
        </div>

        {/* Body content */}
        <div className="p-6 pt-4 overflow-y-auto space-y-4 flex-1">
          {/* Deck Card Overview */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3.5">
            <div 
              className="relative w-14 h-18 rounded-xl overflow-hidden shrink-0 shadow-xs border border-slate-200/80 bg-white"
            >
              {folder.coverImage ? (
                <img
                  src={folder.coverImage}
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

            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-800 text-sm truncate">{folder.name}</h4>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
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

          {activeMode === "send" ? (
            <div className="space-y-3.5">
              {/* Search Users */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  placeholder="ابحث عن اسم المستخدم أو الاسم..."
                  className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0056f6]/20 focus:border-[#0056f6]"
                />
              </div>

              {/* Users List */}
              {isLoadingRecipients ? (
                <div className="p-6 rounded-2xl bg-slate-50 flex flex-col items-center justify-center gap-2 text-center">
                  <div className="w-5 h-5 border-2 border-[#0056f6] border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-500">جاري تحميل المستخدمين المسجلين...</p>
                </div>
              ) : recipientsError ? (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{recipientsError}</span>
                </div>
              ) : recipients.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-1.5">
                  <Users className="w-7 h-7 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">لا يوجد مستخدمون آخرون في النظام حالياً</p>
                  <p className="text-[11px] text-slate-500">
                    قم بإنشاء حساب مستخدم آخر في النظام حتى تتمكن من إرسال المجلدات إليه مباشرة.
                  </p>
                </div>
              ) : filteredRecipients.length === 0 ? (
                <div className="p-5 rounded-2xl bg-slate-50 text-center text-xs text-slate-500">
                  لا توجد نتائج مطابقة للبحث "{recipientSearch}"
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
                  {filteredRecipients.map((user) => {
                    const isSelected = selectedRecipientIds.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleRecipient(user.id)}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer text-right ${
                          isSelected
                            ? "bg-blue-50/70 border-[#0056f6] shadow-2xs"
                            : "bg-white border-slate-200/80 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-extrabold ${
                              isSelected
                                ? "bg-[#0056f6] text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {user.role === "admin" ? (
                              <ShieldCheck className="w-4 h-4" />
                            ) : (
                              <UserIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-800 truncate">{user.name}</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                  user.role === "admin"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {user.role === "admin" ? "مشرف" : "مستخدم"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono truncate" dir="ltr">
                              @{user.username}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? "bg-[#0056f6] border-[#0056f6] text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Optional message */}
              {recipients.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    رسالة مرفقة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={sendMessage}
                    onChange={(e) => setSendMessage(e.target.value)}
                    placeholder="مثلاً: أرسلت لك هذا المجلد للمراجعة..."
                    maxLength={250}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0056f6]/20 focus:border-[#0056f6]"
                  />
                </div>
              )}

              {sendError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{sendError}</span>
                </div>
              )}

              {sentSuccessText && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{sentSuccessText}</span>
                </div>
              )}

              {recipients.length > 0 && (
                <button
                  type="button"
                  onClick={handleDirectSend}
                  disabled={isSending || selectedRecipientIds.length === 0}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isSending || selectedRecipientIds.length === 0
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-[#0056f6] hover:bg-[#0047cc] text-white shadow-sm active:scale-98"
                  }`}
                >
                  {isSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>جاري الإرسال...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        {selectedRecipientIds.length > 0
                          ? `إرسال المجلد (${selectedRecipientIds.length} مستخدم)`
                          : "اختر مستخدماً للإرسال"}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : isLoading ? (
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
                  value={shareUrl}
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
                  <img src={qrCodeDataUrl} alt="QR Code" className="w-36 h-36 rounded-lg bg-white p-2 shadow-2xs" />
                  <p className="text-[11px] text-slate-500">امسح الرمز بكاميرا الهاتف لفتح الملف</p>
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
                      src={folder.coverImage}
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

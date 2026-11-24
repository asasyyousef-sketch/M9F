import React, { useState } from "react";
import { Download, Smartphone, Share, PlusSquare, WifiOff, CheckCircle2, X } from "lucide-react";
import { usePWAInstall, useOnlineStatus } from "../hooks/usePWAInstall";

interface PWAInstallButtonProps {
  variant?: "compact" | "sidebar" | "settings";
  collapsed?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = "compact",
  collapsed = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // When already running in standalone installed mode:
  // hide compact/sidebar buttons cleanly; in settings show installed status badge.
  if (isInstalled) {
    if (variant === "settings") {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>التطبيق مثبّت ويعمل بوضع التطبيق المستقل</span>
        </div>
      );
    }
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  // Compact header button (only appears when installable or on iOS to avoid desktop clutter)
  if (variant === "compact") {
    if (!isInstallable && !isIOS) return null;
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 text-[11px] font-bold shadow-xs transition-colors cursor-pointer shrink-0"
          title="تثبيت كتطبيق على الجهاز"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">تثبيت التطبيق</span>
        </button>
        {showGuideModal && (
          <PWAInstallGuideModal isIOS={isIOS} onClose={() => setShowGuideModal(false)} />
        )}
      </>
    );
  }

  // Sidebar footer button
  if (variant === "sidebar") {
    if (!isInstallable && !isIOS) return null;
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          title="تثبيت التطبيق على الجهاز"
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-right text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 transition-colors font-bold text-xs cursor-pointer ${
            collapsed ? "justify-center px-0 w-9 h-9 mx-auto" : ""
          }`}
        >
          <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
          {!collapsed && <span>تثبيت التطبيق</span>}
        </button>
        {showGuideModal && (
          <PWAInstallGuideModal isIOS={isIOS} onClose={() => setShowGuideModal(false)} />
        )}
      </>
    );
  }

  // Settings view button (always visible when not installed so user can install or read browser steps)
  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-colors cursor-pointer"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>
          {isInstallable
            ? "تثبيت التطبيق الآن على جهازك"
            : isIOS
            ? "خطوات التثبيت على iPhone / iPad"
            : "تثبيت كتطبيق (PWA)"}
        </span>
      </button>
      {showGuideModal && (
        <PWAInstallGuideModal isIOS={isIOS} onClose={() => setShowGuideModal(false)} />
      )}
    </>
  );
};

const PWAInstallGuideModal: React.FC<{ isIOS: boolean; onClose: () => void }> = ({
  isIOS,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">تثبيت مدرب اللغات</h3>
              <p className="text-[11px] text-slate-500">تجربة تطبيق أسرع وبشاشة كاملة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIOS ? (
          <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
            <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200/70">
              <Share className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p>
                <strong>1.</strong> اضغط على أيقونة <strong>المشاركة (Share)</strong> في شريط متصفح Safari.
              </p>
            </div>
            <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200/70">
              <PlusSquare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p>
                <strong>2.</strong> مرّر للأسفل واختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
            <p className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-3 text-slate-700">
              للتثبيت المباشر: افتح التطبيق في متصفح <strong>Chrome</strong> أو <strong>Edge</strong> (أو في تبويب مستقل)، ثم اضغط على أيقونة التثبيت في شريط العنوان أو من قائمة المتصفح (⋮) واختر <strong>تثبيت التطبيق</strong>.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-slate-800 transition-colors cursor-pointer"
        >
          حسناً
        </button>
      </div>
    </div>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white shadow-lg border border-amber-500/50"
      dir="rtl"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>وضع عدم الاتصال — يتم استخدام البيانات المحفوظة محلياً</span>
    </div>
  );
};

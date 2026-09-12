import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ShieldCheck, Lock, User, Sparkles, KeyRound, AlertCircle, Loader2, ArrowRight } from "lucide-react";

export const AuthScreen: React.FC = () => {
  const { hasAdmin, login, setupAdmin, isLoading } = useAuth();

  // Setup Admin form states
  const [setupUsername, setSetupUsername] = useState("admin");
  const [setupName, setSetupName] = useState("مدير النظام");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupConfirmPassword, setSetupConfirmPassword] = useState("");

  // Login form states
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If still checking status
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-surface flex flex-col items-center justify-center gap-4 z-50 font-sans" dir="rtl">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2 text-on-surface-variant text-sm font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>جاري التحقق من حالة النظام...</span>
        </div>
      </div>
    );
  }

  // First-time Admin setup handler
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!setupUsername.trim()) {
      setFormError("يرجى إدخال اسم المستخدم.");
      return;
    }
    if (setupPassword.length < 4) {
      setFormError("يجب أن تكون كلمة المرور 4 خانات على الأقل.");
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setFormError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setSubmitting(true);
    const res = await setupAdmin(setupUsername.trim(), setupPassword, setupName.trim());
    setSubmitting(false);
    if (!res.success && res.error) {
      setFormError(res.error);
    }
  };

  // Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!loginUsername.trim() || !loginPassword) {
      setFormError("يرجى إدخال اسم المستخدم وكلمة المرور.");
      return;
    }

    setSubmitting(true);
    const res = await login(loginUsername.trim(), loginPassword);
    setSubmitting(false);
    if (!res.success && res.error) {
      setFormError(res.error);
    }
  };

  const isInitialSetup = hasAdmin === false;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans select-none overflow-y-auto"
      dir="rtl"
    >
      <div className="w-full max-w-md bg-surface border border-outline-variant/50 rounded-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden my-auto animate-fade-in">
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-primary via-indigo-500 to-purple-500" />

        {/* Logo & Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            {isInitialSetup ? (
              <ShieldCheck className="w-7 h-7 text-primary" />
            ) : (
              <Lock className="w-7 h-7 text-primary" />
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
            {isInitialSetup ? "إعداد حساب المشرف الرئيسي" : "تسجيل الدخول"}
          </h2>
          <p className="text-xs sm:text-sm text-on-surface-variant/80 mt-1 leading-relaxed">
            {isInitialSetup
              ? "مرحباً بك! سيتم تعيين هذا الحساب كمدير رئيسي، وربط كافة المجلدات والبطاقات الأصلية الحالية به فوراً."
              : "أدخل بيانات حسابك للوصول إلى مساحتك التعليمية وبطاقاتك."}
          </p>
        </div>

        {/* Error notice */}
        {formError && (
          <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* First-time Admin Setup Form */}
        {isInitialSetup ? (
          <form onSubmit={handleSetupSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                اسم المستخدم (للدخول)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={setupUsername}
                  onChange={(e) => setSetupUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl py-2.5 pr-10 pl-3 text-xs font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <User className="w-4 h-4 text-outline absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                الاسم الظاهر (اختياري)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  placeholder="مدير النظام"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl py-2.5 pr-10 pl-3 text-xs font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <Sparkles className="w-4 h-4 text-outline absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl py-2.5 pr-10 pl-3 text-xs font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <KeyRound className="w-4 h-4 text-outline absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                تأكيد كلمة المرور
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={setupConfirmPassword}
                  onChange={(e) => setSetupConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl py-2.5 pr-10 pl-3 text-xs font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <KeyRound className="w-4 h-4 text-outline absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 active:scale-[0.98] text-on-primary font-bold text-xs rounded-xl shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري إنشاء الحساب الرئيسي...</span>
                  </>
                ) : (
                  <>
                    <span>إنشاء الحساب الرئيسي وحفظ البيانات</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Login Form */
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                اسم المستخدم
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl py-2.5 pr-10 pl-3 text-xs font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <User className="w-4 h-4 text-outline absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl py-2.5 pr-10 pl-3 text-xs font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <KeyRound className="w-4 h-4 text-outline absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 active:scale-[0.98] text-on-primary font-bold text-xs rounded-xl shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التحقق والدخول...</span>
                  </>
                ) : (
                  <>
                    <span>تسجيل الدخول</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </>
                )}
              </button>
            </div>

            {/* Note about admin-only account creation */}
            <div className="mt-4 pt-4 border-t border-outline-variant/30 text-center">
              <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
                🛡️ <span className="font-bold">ملاحظة أمان:</span> إنشاء الحسابات الجديدة متاح فقط من خلال إعدادات المشرف (المدير).
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

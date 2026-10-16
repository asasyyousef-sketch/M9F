import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { User, KeyRound, AlertCircle, Loader2 } from "lucide-react";

export const AuthScreen: React.FC = () => {
  const { hasAdmin, login, register, setupAdmin, isLoading } = useAuth();

  const [isSignUp, setIsSignUp] = useState(hasAdmin === false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If still checking status
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3 z-50 font-sans">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setFormError("Please enter both username and password.");
      return;
    }

    if (isSignUp) {
      if (password.length < 4) {
        setFormError("Password must be at least 4 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setFormError("Passwords do not match.");
        return;
      }

      setSubmitting(true);
      const res = hasAdmin === false
        ? await setupAdmin(cleanUsername, password)
        : await register(cleanUsername, password);
      setSubmitting(false);

      if (!res.success && res.error) {
        setFormError(res.error);
      }
    } else {
      setSubmitting(true);
      const res = await login(cleanUsername, password);
      setSubmitting(false);

      if (!res.success && res.error) {
        setFormError(res.error);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center p-4 z-50 font-sans select-none overflow-y-auto">
      <div className="w-full max-w-[340px] sm:max-w-[360px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-6 sm:p-8 relative my-auto animate-fadeIn">
        {/* Title */}
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-6">
          {isSignUp ? "Sign up" : "Login"}
        </h1>

        {/* Error message */}
        {formError && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Username Input */}
          <div className="relative flex items-center">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-800 dark:text-slate-200 flex items-center justify-center pointer-events-none">
              <User className="w-4 h-4 stroke-[2.2]" />
            </div>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username or Email"
              className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white dark:bg-slate-800/70 dark:hover:bg-slate-800 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl py-3 pl-11 pr-3 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          {/* Password Input */}
          <div className="relative flex items-center">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-800 dark:text-slate-200 flex items-center justify-center pointer-events-none">
              <KeyRound className="w-4 h-4 stroke-[2.2]" />
            </div>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white dark:bg-slate-800/70 dark:hover:bg-slate-800 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl py-3 pl-11 pr-3 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          {/* Confirm Password (only in sign up mode) */}
          {isSignUp && (
            <div className="relative flex items-center">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-800 dark:text-slate-200 flex items-center justify-center pointer-events-none">
                <KeyRound className="w-4 h-4 stroke-[2.2]" />
              </div>
              <input
                type="text"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white dark:bg-slate-800/70 dark:hover:bg-slate-800 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl py-3 pl-11 pr-3 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          )}

          {/* Blue Login/Sign Up Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-[#1a73e8] hover:bg-[#155fc7] active:scale-[0.98] text-white font-bold text-xs sm:text-sm tracking-wider uppercase rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <span>{isSignUp ? "SIGN UP" : "LOGIN"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

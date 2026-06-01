"use client";

import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, FormEvent, Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "خطا در ورود");
        setLoading(false);
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("خطا در برقراری ارتباط با سرور");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 bg-background font-sans">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-2xl shadow-black/40 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-cta/10 border border-cta/30 mb-4">
              <svg
                className="w-7 h-7 text-cta"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11a7 7 0 01-14 0M12 18v3m-4 0h8M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold font-mono text-slate-100">
              Persian TTS
            </h1>
            <p className="mt-2 text-sm text-slate-400 font-vazirmatn" dir="rtl">
              برای ادامه وارد حساب کاربری خود شوید
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="block text-xs font-mono uppercase tracking-wider text-slate-400"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cta/60 focus:border-cta/60 transition-colors duration-200 disabled:opacity-50"
                placeholder="username"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-mono uppercase tracking-wider text-slate-400"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cta/60 focus:border-cta/60 transition-colors duration-200 disabled:opacity-50"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2 font-vazirmatn"
                role="alert"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary font-vazirmatn text-base"
            >
              {loading ? "در حال ورود..." : "ورود"}
            </button>
          </form>

          <p className="mt-6 text-center text-[10px] text-slate-600 font-mono">
            Session valid for 2 days
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-background text-slate-500 text-sm font-mono">
          Loading...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

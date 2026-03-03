"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../../components/header";
import { publicFetch, setToken } from "../../lib/auth-client";

type LoginResponse = {
  token?: string;
  requires2fa?: boolean;
  mfaToken?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!mfaToken) {
        const response = await publicFetch<LoginResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });

        if (response.requires2fa && response.mfaToken) {
          setMfaToken(response.mfaToken);
          return;
        }

        if (!response.token) {
          throw new Error("Invalid login response");
        }

        setToken(response.token);
        router.push("/");
        return;
      }

      const response = await publicFetch<{ token: string }>("/auth/login/2fa", {
        method: "POST",
        body: JSON.stringify({ mfaToken, otp })
      });
      setToken(response.token);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary text-4xl font-black shadow-inner mb-4">
            B
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome Back</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            {mfaToken ? "Two-Factor Verification" : "Sign in to your account"}
          </p>
        </div>

        <form className="space-y-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50" onSubmit={onSubmit}>
          <p className="text-xs font-medium text-slate-500 text-center leading-relaxed">
            {mfaToken ? "Enter the 6-digit code from your authenticator app." : "Use your email and password to continue."}
          </p>

          <div className="space-y-4">
            {!mfaToken ? (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                  <input
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all shadow-sm"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                  <input
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all shadow-sm"
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    type="password"
                    value={password}
                    required
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4 animate-in zoom-in-95 duration-300">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">6-Digit Code</label>
                  <input
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-5 text-center text-2xl font-black tracking-[0.5em] outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all shadow-sm"
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    value={otp}
                    autoFocus
                  />
                </div>
                <button
                  className="w-full text-xs font-black text-slate-400 hover:text-primary transition-colors uppercase tracking-widest"
                  onClick={() => {
                    setMfaToken(null);
                    setOtp("");
                  }}
                  type="button"
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 animate-in shake duration-500">
              <p className="text-xs font-bold text-rose-600 text-center">{error}</p>
            </div>
          )}

          <button
            className="w-full rounded-2xl bg-slate-900 py-5 text-sm font-black text-white hover:bg-slate-800 shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            disabled={loading}
            type="submit"
          >
            <span className="flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Signing in...
                </>
              ) : mfaToken ? "Verify Code" : "Sign In"}
            </span>
          </button>
        </form>

        <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
          Secure access only
        </p>
      </div>
    </main>
  );
}

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
    <main>
      <Header title="Login" />
      <form className="space-y-3 px-4 py-6" onSubmit={onSubmit}>
        <p className="text-sm text-slate-600">{mfaToken ? "Enter 6-digit code from Authy" : "Sign in with your admin-created account."}</p>

        {!mfaToken ? (
          <>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              value={email}
            />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8 chars)"
              type="password"
              value={password}
            />
          </>
        ) : (
          <>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
              value={otp}
            />
            <button
              className="w-full rounded-xl border border-slate-300 bg-white py-3 font-semibold text-slate-700"
              onClick={() => {
                setMfaToken(null);
                setOtp("");
              }}
              type="button"
            >
              Back to Password Login
            </button>
          </>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button className="w-full rounded-xl bg-primary py-3 font-semibold text-white" disabled={loading} type="submit">
          {loading ? "Please wait..." : mfaToken ? "Verify 2FA" : "Sign In"}
        </button>
      </form>
    </main>
  );
}

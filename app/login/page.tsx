"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Login failed.");
        setPending(false);
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError("Connection lost. Try again.");
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A0A0B] px-6">
      <div className="w-full max-w-sm animate-[fadeIn_0.5s_ease-out]">
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes blink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
        `}</style>

        <div className="mb-6 text-center">
          <p className="font-mono text-[11px] tracking-[0.3em] text-[#F5751E]">BFP–NCR</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#EDEDEC]">
            Incident Dashboard
          </h1>
          <p className="mt-1 font-mono text-[11px] text-[#5A5A5E]">
            authorized personnel only
            <span className="ml-1 inline-block" style={{ animation: "blink 1s step-end infinite" }}>
              _
            </span>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border border-[#2A2A2C] bg-[#0E0E0F] p-5"
        >
          <div className="mb-3 flex items-center justify-between border-b border-[#2A2A2C] pb-2 font-mono text-[10px] tracking-wide text-[#5A5A5E]">
            <span>ACCESS / 01</span>
            <span className={pending ? "text-[#F5751E]" : "text-[#5A5A5E]"}>
              {pending ? "VERIFYING…" : "LOCKED"}
            </span>
          </div>

          <label className="mb-1 block font-mono text-[11px] text-[#6A6A6E]">USERNAME</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
            className="mb-3 w-full border border-[#2A2A2C] bg-[#141415] px-3 py-2 text-sm text-[#EDEDEC] outline-none focus:border-[#F5751E]"
          />

          <label className="mb-1 block font-mono text-[11px] text-[#6A6A6E]">PASSWORD</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mb-4 w-full border border-[#2A2A2C] bg-[#141415] px-3 py-2 text-sm text-[#EDEDEC] outline-none focus:border-[#F5751E]"
          />

          {error && (
            <p className="mb-3 border border-[#E5484D]/40 bg-[#1A1213] px-3 py-2 font-mono text-xs text-[#E5A6A8]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full border border-[#F5751E] py-2 text-sm font-medium text-[#F5751E] transition-colors hover:bg-[#F5751E] hover:text-[#0A0A0B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Verifying…" : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Snowflake, CheckCircle2, XCircle } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          // Update stored user so banner disappears immediately
          try {
            const raw = localStorage.getItem("coldstreak-auth-user");
            if (raw) {
              const u = JSON.parse(raw);
              localStorage.setItem("coldstreak-auth-user", JSON.stringify({ ...u, emailVerified: true }));
            }
          } catch {}
          setStatus("success");
          setTimeout(() => setLocation("/"), 2500);
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-800/60 border border-blue-700 mb-6">
          <Snowflake className="w-8 h-8 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">ColdStreak</h1>

        {status === "loading" && (
          <p className="text-blue-400 text-sm">Verifying your email…</p>
        )}

        {status === "success" && (
          <div className="bg-green-900/40 border border-green-600/40 rounded-2xl p-6 mt-4">
            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-3" />
            <p className="text-green-300 font-semibold mb-1">Email verified!</p>
            <p className="text-green-400/80 text-sm">Taking you back to the app…</p>
          </div>
        )}

        {status === "error" && (
          <div className="bg-red-900/30 border border-red-700/40 rounded-2xl p-6 mt-4">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-red-300 font-semibold mb-1">Link invalid or expired</p>
            <p className="text-red-400/80 text-sm mb-4">This link may have already been used or has expired.</p>
            <button
              onClick={() => setLocation("/")}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-blue-950 font-bold text-sm transition-colors"
            >
              Back to app
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

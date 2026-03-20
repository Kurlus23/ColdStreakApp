import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Snowflake, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "retry">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const attempt = async () => {
    if (!token) { setStatus("error"); setErrorMsg("No verification token found."); return; }
    setStatus("loading");
    try {
      const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (data.ok) {
        try {
          const raw = localStorage.getItem("coldstreak-auth-user");
          if (raw) {
            const u = JSON.parse(raw);
            localStorage.setItem("coldstreak-auth-user", JSON.stringify({ ...u, emailVerified: true }));
          }
        } catch {}
        setStatus("success");
        setTimeout(() => setLocation("/"), 2500);
      } else if (res.status === 503) {
        setStatus("retry");
        setErrorMsg(data.message || "Server temporarily unavailable.");
      } else {
        setStatus("error");
        setErrorMsg(data.message || "This link may have already been used or has expired.");
      }
    } catch {
      setStatus("retry");
      setErrorMsg("Could not reach the server. Check your connection and try again.");
    }
  };

  useEffect(() => { attempt(); }, [token]);

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
            <p className="text-red-400/80 text-sm mb-4">{errorMsg}</p>
            <button
              onClick={() => setLocation("/")}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-blue-950 font-bold text-sm transition-colors"
            >
              Back to app
            </button>
          </div>
        )}

        {status === "retry" && (
          <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-2xl p-6 mt-4">
            <RefreshCw className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
            <p className="text-yellow-300 font-semibold mb-1">Temporarily unavailable</p>
            <p className="text-yellow-400/80 text-sm mb-4">{errorMsg}</p>
            <button
              onClick={attempt}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-blue-950 font-bold text-sm transition-colors mb-2"
            >
              Try Again
            </button>
            <button
              onClick={() => setLocation("/")}
              className="w-full py-2.5 rounded-xl bg-blue-800/60 border border-blue-700/50 text-blue-300 font-semibold text-sm transition-colors hover:bg-blue-700/60"
            >
              Back to app
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

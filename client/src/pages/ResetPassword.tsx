import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Snowflake, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  useEffect(() => {
    if (!token) setError("Invalid or missing reset link.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setError("");
    setLoading(true);
    try {
      const data = await apiRequest("POST", "/api/auth/reset-password", { token, password });
      const json = await data.json();
      if (!data.ok) { setError(json.message || "Reset failed. Please try again."); return; }
      localStorage.setItem("coldstreak-auth-token", json.token);
      localStorage.setItem("coldstreak-auth-user", JSON.stringify(json.user));
      setDone(true);
      setTimeout(() => setLocation("/"), 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-800/60 border border-blue-700 mb-4">
            <Snowflake className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">ColdStreak</h1>
          <p className="text-blue-400 text-sm mt-1">
            {done ? "Password updated!" : "Set a new password"}
          </p>
        </div>

        {done ? (
          <div className="bg-green-900/40 border border-green-600/40 rounded-2xl p-6 text-center">
            <p className="text-green-300 font-semibold mb-1">You're all set 🎉</p>
            <p className="text-green-400/80 text-sm">You're now signed in. Taking you back to the app…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-blue-900/50 border border-blue-700/40 rounded-2xl p-6 space-y-4">
            {error && (
              <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-4 py-3">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="relative">
              <input
                data-testid="input-new-password"
                type={showPassword ? "text" : "password"}
                placeholder="New password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!token}
                className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-4 py-3 text-white placeholder:text-blue-500 focus:outline-none focus:border-cyan-400 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <input
              data-testid="input-confirm-password"
              type={showPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={!token}
              className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-4 py-3 text-white placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
            />

            <button
              data-testid="button-reset-submit"
              type="submit"
              disabled={loading || !token || !password || !confirm}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-blue-950 font-bold transition-colors disabled:opacity-50"
            >
              {loading ? "Updating…" : "Set New Password"}
            </button>

            <button
              type="button"
              onClick={() => setLocation("/")}
              className="w-full py-2 text-blue-400 text-sm hover:text-blue-300 transition-colors"
            >
              Back to app
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

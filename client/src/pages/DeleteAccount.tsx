import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function DeleteAccount() {
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const loginRes = await apiRequest("POST", "/api/auth/login", { email, password });
      const { token } = await loginRes.json();
      const deleteRes = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!deleteRes.ok) throw new Error("Deletion failed");
    },
    onSuccess: () => {
      localStorage.removeItem("coldstreak-auth-token");
      localStorage.removeItem("coldstreak-auth-user");
      localStorage.removeItem("coldstreak-is-pro");
      localStorage.removeItem("coldstreak-pro-email");
      setDone(true);
    },
    onError: () => {
      setError("Invalid email or password. Please try again.");
    },
  });

  if (done) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center px-6">
        <div className="text-center text-white max-w-sm">
          <p className="text-4xl mb-4">🧊</p>
          <h1 className="text-xl font-bold mb-2">Account Deleted</h1>
          <p className="text-blue-300 text-sm mb-6">
            Your ColdStreak account and all associated data have been permanently deleted.
          </p>
          <a
            href="/"
            className="text-cyan-400 underline text-sm"
          >
            Return to ColdStreak
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center px-6">
      <div className="bg-blue-900 rounded-2xl p-8 max-w-md w-full text-white">
        <p className="text-3xl mb-4 text-center">🧊</p>
        <h1 className="text-xl font-bold text-center mb-1">Delete Your Account</h1>
        <p className="text-blue-300 text-sm text-center mb-6">
          Permanently delete your ColdStreak account and all associated data.
        </p>

        <div className="bg-blue-800 rounded-xl p-4 mb-6 text-sm text-blue-200 space-y-1">
          <p className="font-semibold text-white mb-2">The following will be permanently deleted:</p>
          <p>• Your account and login credentials</p>
          <p>• All plunge history and session data</p>
          <p>• Leaderboard entries and community spots</p>
          <p>• Badges and achievements</p>
          <p>• ColdStreak Pro status (non-refundable)</p>
        </div>

        {!confirmed ? (
          <div className="space-y-3">
            <button
              data-testid="button-confirm-delete"
              onClick={() => setConfirmed(true)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition"
            >
              I understand — delete my account
            </button>
            <a
              href="/"
              className="block text-center text-blue-300 text-sm hover:text-white transition"
            >
              Cancel — keep my account
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-blue-300 text-center">Enter your credentials to confirm deletion.</p>
            <input
              data-testid="input-delete-email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-blue-800 border border-blue-700 rounded-xl px-4 py-3 text-white placeholder-blue-400 focus:outline-none focus:border-cyan-500"
            />
            <input
              data-testid="input-delete-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-blue-800 border border-blue-700 rounded-xl px-4 py-3 text-white placeholder-blue-400 focus:outline-none focus:border-cyan-500"
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              data-testid="button-submit-delete"
              onClick={() => { setError(""); deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending || !email || !password}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
            >
              {deleteMutation.isPending ? "Deleting…" : "Permanently Delete Account"}
            </button>
            <button
              onClick={() => setConfirmed(false)}
              className="w-full text-center text-blue-300 text-sm hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        )}

        <p className="text-blue-400 text-xs text-center mt-6">
          Need help instead?{" "}
          <a href="mailto:coldstreakapp17@gmail.com" className="text-cyan-400 underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { Analytics } from "@/lib/analytics";
import { usernameSchema } from "@shared/schema";
import { Eye, EyeOff, Loader2, Check, X, HeartPulse } from "lucide-react";

const ONBOARDING_KEY = "coldstreak-onboarded";

export function hasCompletedOnboarding() {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

interface OnboardingProps {
  onComplete: (skipped: boolean) => void;
  onRegister: (args: { email: string; password: string; username: string; bodyWeight?: number }) => Promise<{ ok: boolean; error?: string }>;
  onImportWeight: () => Promise<{ lbs: number | null; message?: string }>;
  healthKitAvailable: boolean;
}

const slides = [
  {
    icon: "🧊",
    title: "Welcome to ColdStreak",
    subtitle: "Your cold plunge companion",
    body: "Track every plunge, build your streak, and watch your cold tolerance grow over time. Science-backed scoring shows your real progress.",
  },
  {
    icon: "⏱️",
    title: "Log Your First Plunge",
    subtitle: "Three taps and you're tracked",
    body: null,
    steps: [
      { emoji: "▶️", label: "Tap the big timer → start it before you get in" },
      { emoji: "🛑", label: "Tap stop when you're done" },
      { emoji: "🌡️", label: "Enter water temperature → Save" },
      { emoji: "📈", label: "Your Cold Score & streak update instantly" },
    ],
  },
  {
    icon: "👑",
    title: "What Pro Unlocks",
    subtitle: "For serious plungers",
    body: null,
    features: [
      { emoji: "♾️", label: "Unlimited plunge history" },
      { emoji: "🎵", label: "Spotify & Apple Music auto-play" },
      { emoji: "📡", label: "Bluetooth thermometer & HR" },
      { emoji: "🏆", label: "Leaderboards & Chill Places" },
      { emoji: "❄️", label: "Streak freezes" },
      { emoji: "🚫", label: "No ads, ever" },
    ],
  },
  {
    // Account creation step — rendered as a custom form (see renderAccountSlide).
    icon: "👤",
    title: "Create Your Account",
    subtitle: "Save your progress everywhere",
    account: true,
  },
];

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function Onboarding({ onComplete, onRegister, onImportWeight, healthKitAvailable }: OnboardingProps) {
  const [slide, setSlide] = useState(0);

  // Account form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [weight, setWeight] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameMsg, setUsernameMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const checkSeqRef = useRef(0);

  function finish(skipped: boolean) {
    localStorage.setItem(ONBOARDING_KEY, "true");
    Analytics.onboardingCompleted(skipped);
    onComplete(skipped);
  }

  function next() {
    if (slide < slides.length - 1) {
      setSlide(slide + 1);
    } else {
      finish(false);
    }
  }

  // Debounced live username availability check.
  useEffect(() => {
    const u = username.trim();
    if (!u) { setUsernameStatus("idle"); setUsernameMsg(null); return; }
    const parsed = usernameSchema.safeParse(u);
    if (!parsed.success) {
      setUsernameStatus("invalid");
      setUsernameMsg(parsed.error.errors[0].message);
      return;
    }
    setUsernameStatus("checking");
    setUsernameMsg(null);
    const seq = ++checkSeqRef.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(parsed.data)}`);
        const data = await res.json();
        if (seq !== checkSeqRef.current) return; // stale
        if (data.available) {
          setUsernameStatus("available");
          setUsernameMsg(null);
        } else {
          setUsernameStatus("taken");
          setUsernameMsg(data.reason || "That username is already taken");
        }
      } catch {
        if (seq !== checkSeqRef.current) return;
        setUsernameStatus("idle");
        setUsernameMsg(null);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [username]);

  async function handleImportWeight() {
    if (importing) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const { lbs, message } = await onImportWeight();
      if (lbs && lbs >= 60 && lbs <= 500) {
        setWeight(String(Math.round(lbs)));
        setImportMsg("Pulled from Apple Health.");
      } else {
        setImportMsg(message || "No weight found in Apple Health.");
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleCreate() {
    if (submitting) return;
    setFormError(null);

    const e = email.trim();
    if (!e || !/^\S+@\S+\.\S+$/.test(e)) { setFormError("Enter a valid email address."); return; }
    if (password.length < 6) { setFormError("Password must be at least 6 characters."); return; }
    const u = username.trim();
    const parsed = usernameSchema.safeParse(u);
    if (!parsed.success) { setFormError(parsed.error.errors[0].message); return; }
    if (usernameStatus === "taken") { setFormError("That username is already taken."); return; }

    const w = weight.trim() ? Number(weight) : undefined;
    if (w !== undefined && (isNaN(w) || w < 60 || w > 500)) { setFormError("Enter a weight between 60 and 500 lbs."); return; }

    setSubmitting(true);
    try {
      const result = await onRegister({ email: e, password, username: parsed.data, bodyWeight: w });
      if (result.ok) {
        finish(false);
      } else {
        setFormError(result.error || "Could not create account. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const current = slides[slide];
  const isAccount = !!(current as any).account;
  const isLast = slide === slides.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-blue-950 px-6 py-10 overflow-y-auto">

      {/* Skip */}
      <div className="w-full flex justify-end">
        <button
          data-testid="button-onboarding-skip"
          onClick={() => finish(true)}
          className="text-blue-300 text-sm font-medium px-2 py-1"
        >
          {isAccount ? "Skip for now" : "Skip"}
        </button>
      </div>

      {/* Slide content */}
      {isAccount ? (
        <div className="flex-1 flex flex-col justify-center w-full max-w-sm gap-4 py-4">
          <div className="text-center">
            <div className="text-6xl leading-none mb-2">{current.icon}</div>
            <h2 className="text-2xl font-bold text-white mb-1">{current.title}</h2>
            <p className="text-blue-300 text-sm font-medium">{current.subtitle}</p>
          </div>

          <div className="space-y-3">
            {/* Email */}
            <input
              data-testid="input-onboarding-email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-blue-900/70 border border-blue-700 rounded-xl px-3 py-3 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
            />

            {/* Password */}
            <div className="relative">
              <input
                data-testid="input-onboarding-password"
                type={showPassword ? "text" : "password"}
                placeholder="Password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-blue-900/70 border border-blue-700 rounded-xl pl-3 pr-11 py-3 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                data-testid="button-onboarding-toggle-password"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-blue-300 hover:text-white hover:bg-blue-800/50 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Username */}
            <div>
              <div className="relative">
                <input
                  data-testid="input-onboarding-username"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Username (your public handle)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/^@/, ""))}
                  className="w-full bg-blue-900/70 border border-blue-700 rounded-xl pl-3 pr-10 py-3 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === "checking" && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                  {usernameStatus === "available" && <Check className="w-4 h-4 text-green-400" />}
                  {(usernameStatus === "taken" || usernameStatus === "invalid") && <X className="w-4 h-4 text-red-400" />}
                </span>
              </div>
              {usernameMsg && (
                <p data-testid="text-onboarding-username-msg" className={`text-xs mt-1 px-1 ${usernameStatus === "available" ? "text-green-400" : "text-red-400"}`}>{usernameMsg}</p>
              )}
              {usernameStatus === "available" && (
                <p className="text-green-400 text-xs mt-1 px-1">Username is available</p>
              )}
            </div>

            {/* Body weight */}
            <div>
              <div className="flex gap-2">
                <input
                  data-testid="input-onboarding-weight"
                  type="number"
                  inputMode="numeric"
                  placeholder="Body weight (lbs)"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="flex-1 bg-blue-900/70 border border-blue-700 rounded-xl px-3 py-3 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                />
                {healthKitAvailable && (
                  <button
                    type="button"
                    data-testid="button-onboarding-import-weight"
                    onClick={handleImportWeight}
                    disabled={importing}
                    className="flex items-center gap-1.5 px-3 rounded-xl bg-pink-900/40 border border-pink-500/40 text-pink-200 text-xs font-semibold disabled:opacity-50 active:scale-95 transition-all whitespace-nowrap"
                  >
                    {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HeartPulse className="w-3.5 h-3.5" />}
                    Apple Health
                  </button>
                )}
              </div>
              {importMsg && <p className="text-blue-300 text-xs mt-1 px-1">{importMsg}</p>}
            </div>

            {/* Cold Score / calories reminder — accurate phrasing */}
            <div className="bg-blue-900/50 border border-blue-700/40 rounded-xl px-3 py-2.5">
              <p className="text-blue-200 text-xs leading-relaxed">
                Your <span className="font-semibold text-white">Cold Score</span> is based on time + water temperature. Adding your weight unlocks accurate <span className="font-semibold text-white">calorie</span> estimates — you can change it anytime.
              </p>
            </div>

            {formError && <p data-testid="text-onboarding-error" className="text-red-400 text-xs px-1">{formError}</p>}

            <button
              data-testid="button-onboarding-create"
              onClick={handleCreate}
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 transition-all text-blue-950 font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : "Create Account"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm w-full gap-5">
          <div className="text-7xl leading-none">{current.icon}</div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{current.title}</h2>
            <p className="text-blue-300 text-sm font-medium">{current.subtitle}</p>
          </div>

          {current.body && (
            <p className="text-blue-100 text-sm leading-relaxed">{current.body}</p>
          )}

          {current.steps && (
            <div className="w-full flex flex-col gap-3">
              {current.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3 bg-blue-900/50 rounded-xl px-4 py-3 text-left">
                  <span className="text-xl">{step.emoji}</span>
                  <span className="text-blue-100 text-sm font-medium">{step.label}</span>
                </div>
              ))}
            </div>
          )}

          {current.features && (
            <div className="w-full grid grid-cols-2 gap-3">
              {current.features.map((f, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 bg-blue-900/50 rounded-xl px-3 py-4">
                  <span className="text-2xl">{f.emoji}</span>
                  <span className="text-blue-100 text-xs font-medium text-center leading-snug">{f.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Progress dots */}
      <div className="flex gap-2 mb-4 mt-2">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === slide ? "w-6 bg-cyan-400" : "w-2 bg-blue-700"
            }`}
          />
        ))}
      </div>

      {/* CTA button — hidden on the account slide (it has its own Create button) */}
      {!isAccount && (
        <button
          data-testid="button-onboarding-next"
          onClick={next}
          className="w-full max-w-sm py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 transition-all text-blue-950 font-bold text-base"
        >
          {isLast ? "Get Started" : "Next"}
        </button>
      )}

    </div>
  );
}

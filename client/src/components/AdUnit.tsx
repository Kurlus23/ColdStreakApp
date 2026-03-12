import { useState, useEffect } from "react";
import { X, ExternalLink } from "lucide-react";

// ---------------------------------------------------------------------------
// Placeholder ad data — swap these with real ad-network creatives / scripts
// ---------------------------------------------------------------------------
const FEED_ADS = [
  {
    brand: "The Plunge",
    tagline: "Cold plunge tubs built for daily use",
    cta: "Shop Now",
    href: "https://plunge.com",
    bg: "from-cyan-900/60 to-slate-900/80",
    accent: "text-cyan-400",
    badge: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300",
  },
  {
    brand: "Momentous",
    tagline: "Elite supplements trusted by pro athletes",
    cta: "Explore",
    href: "https://www.livemomentous.com",
    bg: "from-violet-900/60 to-slate-900/80",
    accent: "text-violet-400",
    badge: "bg-violet-500/20 border-violet-500/40 text-violet-300",
  },
  {
    brand: "Morozko Forge",
    tagline: "The original ice bath. Built to last a lifetime.",
    cta: "Learn More",
    href: "https://morozkoforge.com",
    bg: "from-blue-900/60 to-slate-900/80",
    accent: "text-blue-400",
    badge: "bg-blue-500/20 border-blue-500/40 text-blue-300",
  },
];

const INTERSTITIAL_ADS = FEED_ADS;

// ---------------------------------------------------------------------------
// Banner Ad — slim sticky strip above the nav bar, rotates every 8s
// ---------------------------------------------------------------------------
export function BannerAd() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * FEED_ADS.length));
  const [visible, setVisible] = useState(true);
  const ad = FEED_ADS[idx % FEED_ADS.length];

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % FEED_ADS.length), 8000);
    return () => clearInterval(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      data-testid="banner-ad"
      className="mb-2.5"
    >
      <div className={`relative flex items-center gap-2 bg-gradient-to-r ${ad.bg} border border-slate-700/60 rounded-xl px-3 py-2 shadow-lg`}>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 shrink-0">Ad</span>
        <p className={`text-xs font-bold ${ad.accent} shrink-0`}>{ad.brand}</p>
        <p className="text-white/80 text-xs truncate flex-1">{ad.tagline}</p>
        <a
          href={ad.href}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-banner-ad-cta"
          className={`shrink-0 text-xs font-semibold ${ad.accent} flex items-center gap-0.5 hover:underline`}
        >
          {ad.cta}
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
        <button
          onClick={() => setVisible(false)}
          data-testid="button-dismiss-banner"
          className="shrink-0 text-slate-500 hover:text-white transition-colors ml-1"
          aria-label="Dismiss ad"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed Ad — drops into the plunge history list
// ---------------------------------------------------------------------------
export function FeedAd({ index = 0 }: { index?: number }) {
  const ad = FEED_ADS[index % FEED_ADS.length];
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-r ${ad.bg} border border-slate-700/50 rounded-2xl p-5`}
    >
      <span
        className={`absolute top-3 right-3 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${ad.badge}`}
        data-testid="label-sponsored"
      >
        Sponsored
      </span>

      <p className={`text-xs font-bold uppercase tracking-widest ${ad.accent} mb-1`}>
        {ad.brand}
      </p>
      <p className="text-white text-sm font-medium leading-snug pr-16">
        {ad.tagline}
      </p>
      <a
        href={ad.href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="link-ad-cta"
        className={`inline-flex items-center gap-1 mt-3 text-xs font-semibold ${ad.accent} hover:underline`}
      >
        {ad.cta}
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interstitial Ad — modal overlay with countdown dismiss
// ---------------------------------------------------------------------------
interface InterstitialAdProps {
  onDismiss: () => void;
  countdownSeconds?: number;
  adIndex?: number;
}

export function InterstitialAd({
  onDismiss,
  countdownSeconds = 5,
  adIndex = 0,
}: InterstitialAdProps) {
  const [remaining, setRemaining] = useState(countdownSeconds);
  const ad = INTERSTITIAL_ADS[adIndex % INTERSTITIAL_ADS.length];

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
      data-testid="interstitial-ad"
    >
      <div className="relative w-full max-w-sm">
        <button
          onClick={remaining === 0 ? onDismiss : undefined}
          data-testid="button-dismiss-ad"
          className={`absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
            remaining === 0
              ? "bg-white text-black hover:bg-slate-200 cursor-pointer"
              : "bg-slate-700 text-slate-400 cursor-default"
          }`}
        >
          {remaining === 0 ? <X className="w-4 h-4" /> : remaining}
        </button>

        <div
          className={`overflow-hidden bg-gradient-to-br ${ad.bg} border border-slate-600/60 rounded-2xl p-6`}
        >
          <span
            className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wide mb-3 ${ad.badge}`}
          >
            Sponsored
          </span>
          <p className={`text-lg font-bold ${ad.accent} mb-1`}>{ad.brand}</p>
          <p className="text-white text-sm leading-relaxed mb-4">{ad.tagline}</p>
          <div className="flex items-center gap-3">
            <a
              href={ad.href}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-interstitial-ad-cta"
              className={`flex-1 text-center py-2 rounded-xl text-sm font-semibold border ${ad.badge} hover:opacity-80 transition-opacity`}
            >
              {ad.cta}
            </a>
          </div>
        </div>

        <p className="text-center text-slate-500 text-[10px] mt-2">
          Upgrade to Pro to remove ads
        </p>
      </div>
    </div>
  );
}

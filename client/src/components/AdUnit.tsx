import { useState, useEffect } from "react";
import { X, ExternalLink } from "lucide-react";

const ADS = [
  {
    brand: "The Pod Chiller",
    tagline: "Purpose-built cold plunge chiller — cools to 42°F with built-in filtration",
    cta: "Shop on Amazon",
    href: "https://www.amazon.com/dp/B0F6NWFWMP?tag=coldstreak-20",
    bg: "from-cyan-900/60 to-slate-900/80",
    accent: "text-cyan-400",
    badge: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300",
  },
  {
    brand: "Primaal Health Smart Ice Bath",
    tagline: "All-in-one smart cold plunge — app-controlled chiller, tub & lid included",
    cta: "Shop on Amazon",
    href: "https://amzn.to/4slE17u",
    bg: "from-blue-900/60 to-slate-900/80",
    accent: "text-blue-400",
    badge: "bg-blue-500/20 border-blue-500/40 text-blue-300",
  },
  {
    brand: "Oura Ring 4",
    tagline: "Track HRV & recovery to measure exactly how cold plunges help you",
    cta: "Shop on Amazon",
    href: "https://www.amazon.com/dp/B0FKQBMVYZ?tag=coldstreak-20",
    bg: "from-violet-900/60 to-slate-900/80",
    accent: "text-violet-400",
    badge: "bg-violet-500/20 border-violet-500/40 text-violet-300",
  },
  {
    brand: "Baoshishan Water Chiller",
    tagline: "Affordable 1/4HP chiller — cools any tub down to 39°F for serious plungers",
    cta: "Shop on Amazon",
    href: "https://www.amazon.com/dp/B0716XSSC4?tag=coldstreak-20",
    bg: "from-teal-900/60 to-slate-900/80",
    accent: "text-teal-400",
    badge: "bg-teal-500/20 border-teal-500/40 text-teal-300",
  },
  {
    brand: "The Pod Long — 126 Gallon",
    tagline: "Extra-long cold plunge tub — fits up to 6'9\" for full-body immersion",
    cta: "Shop on Amazon",
    href: "https://www.amazon.com/dp/B0F6NWYSS2?tag=coldstreak-20",
    bg: "from-indigo-900/60 to-slate-900/80",
    accent: "text-indigo-400",
    badge: "bg-indigo-500/20 border-indigo-500/40 text-indigo-300",
  },
  {
    brand: "Inkbird WiFi Temp Controller",
    tagline: "Set your exact plunge temp — WiFi-controlled with real-time alerts",
    cta: "Shop on Amazon",
    href: "https://www.amazon.com/dp/B07X1JT372?tag=coldstreak-20",
    bg: "from-orange-900/60 to-slate-900/80",
    accent: "text-orange-400",
    badge: "bg-orange-500/20 border-orange-500/40 text-orange-300",
  },
];

// ---------------------------------------------------------------------------
// Banner Ad — slim strip above the nav bar, rotates every 8s
// ---------------------------------------------------------------------------
export function BannerAd() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * ADS.length));
  const [visible, setVisible] = useState(true);
  const ad = ADS[idx % ADS.length];

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % ADS.length), 8000);
    return () => clearInterval(t);
  }, []);

  if (!visible) return null;

  return (
    <div data-testid="banner-ad" className="mb-2.5">
      <div className={`relative flex items-center gap-2 bg-gradient-to-r ${ad.bg} border border-slate-700/60 rounded-xl px-3 py-2 shadow-lg`}>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 shrink-0">Ad</span>
        <p className={`text-xs font-bold ${ad.accent} shrink-0`}>{ad.brand}</p>
        <p className="text-white/80 text-xs truncate flex-1">{ad.tagline}</p>
        <a
          href={ad.href}
          target="_blank"
          rel="noopener noreferrer sponsored"
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
  const ad = ADS[index % ADS.length];
  return (
    <div className={`relative overflow-hidden bg-gradient-to-r ${ad.bg} border border-slate-700/50 rounded-2xl p-5`}>
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
      <div className="flex items-center gap-3 mt-3">
        <a
          href={ad.href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          data-testid="link-ad-cta"
          className={`inline-flex items-center gap-1 text-xs font-semibold ${ad.accent} hover:underline`}
        >
          {ad.cta}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
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
  const ad = ADS[adIndex % ADS.length];

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

        <div className={`overflow-hidden bg-gradient-to-br ${ad.bg} border border-slate-600/60 rounded-2xl p-6`}>
          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wide mb-3 ${ad.badge}`}>
            Sponsored
          </span>
          <p className={`text-lg font-bold ${ad.accent} mb-2`}>{ad.brand}</p>
          <p className="text-white text-sm leading-relaxed mb-4">{ad.tagline}</p>
          <div className="flex items-center gap-3">
            <a
              href={ad.href}
              target="_blank"
              rel="noopener noreferrer sponsored"
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

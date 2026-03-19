import { BadgeCheck, Building2, Navigation, Phone, ExternalLink, X } from "lucide-react";

const biz = {
  name: "Arctic Recovery Studio",
  city: "Fredericksburg",
  state: "VA",
  fullAddress: "2265 Princess Anne St, Fredericksburg, VA 22401",
  description:
    "Premium cold plunge facility offering private and group sessions. Featuring Morozko Forge tubs at 34–38°F, infrared sauna, and guided breathwork coaching. Walk-ins welcome.",
  modalities: [
    { emoji: "🧊", label: "Cold Plunge" },
    { emoji: "🔥", label: "Infrared Sauna" },
    { emoji: "🧘", label: "Breathwork" },
    { emoji: "💆", label: "Recovery Therapy" },
  ],
  phone: "(540) 555-0182",
  websiteUrl: "https://arcticrecoverystudio.com",
  yelpUrl: "https://yelp.com",
  bookingUrl: "https://arcticrecoverystudio.com/book",
};

export default function VerifiedProfile() {
  return (
    <div className="min-h-screen bg-black/80 flex items-end justify-center p-0">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-yellow-600/40 rounded-t-3xl shadow-2xl overflow-y-auto max-h-screen">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-yellow-500/20 border border-yellow-500/40">
            <Building2 className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white font-bold text-base truncate">{biz.name}</h2>
              <span className="inline-flex items-center gap-1 text-[10px] bg-yellow-500/20 border border-yellow-400/40 text-yellow-300 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                <BadgeCheck className="w-3 h-3" /> Verified
              </span>
            </div>
            <p className="text-blue-400 text-xs mt-0.5">
              {biz.fullAddress}
            </p>
          </div>
          <button className="text-slate-500 hover:text-white transition-colors shrink-0 ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Full profile content */}
        <div className="px-5 py-4 space-y-3 pb-6">
          <p className="text-slate-300 text-sm leading-relaxed">{biz.description}</p>

          {/* Modalities */}
          <div>
            <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1.5">Modalities</p>
            <div className="flex flex-wrap gap-1.5">
              {biz.modalities.map((mod) => (
                <span
                  key={mod.label}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold"
                >
                  {mod.emoji} {mod.label}
                </span>
              ))}
            </div>
          </div>

          {/* Action links */}
          <div className="space-y-2">
            <button className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/20 transition-all active:scale-[0.98]">
              <Navigation className="w-4 h-4 shrink-0" /> Get Directions
            </button>

            <a
              href={`tel:${biz.phone}`}
              className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-blue-800/40 border border-blue-700/40 text-blue-200 text-sm hover:border-blue-500/60 transition-all"
            >
              <Phone className="w-4 h-4 text-blue-400 shrink-0" />
              {biz.phone}
            </a>

            <a
              href={biz.websiteUrl}
              className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-blue-800/40 border border-blue-700/40 text-blue-200 text-sm hover:border-blue-500/60 transition-all"
            >
              <ExternalLink className="w-4 h-4 text-blue-400 shrink-0" /> Website
            </a>

            <a
              href={biz.yelpUrl}
              className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-red-900/20 border border-red-700/30 text-red-200 text-sm hover:border-red-500/40 transition-all"
            >
              <ExternalLink className="w-4 h-4 text-red-400 shrink-0" /> Yelp Reviews
            </a>

            <a
              href={biz.bookingUrl}
              className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-green-900/20 border border-green-700/30 text-green-200 text-sm font-semibold hover:border-green-500/40 transition-all"
            >
              <ExternalLink className="w-4 h-4 text-green-400 shrink-0" /> Book Appointment
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Link } from "wouter";

export default function Support() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="max-w-2xl mx-auto px-6 py-12">

        <div className="mb-10">
          <Link href="/">
            <a className="text-cyan-600 text-sm font-semibold hover:underline" data-testid="link-back-home">← Back to ColdStreak</a>
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-4 mb-1">Support</h1>
          <p className="text-slate-500 text-sm">Need help with ColdStreak? We're here.</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Contact Us</h2>
            <p className="text-slate-600 mb-3">
              The fastest way to reach us is by email. We typically respond within 1–2 business days.
            </p>
            <a
              href="mailto:support@coldstreakapp.com"
              data-testid="link-email-support"
              className="inline-block bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-5 py-3 rounded-xl"
            >
              support@coldstreakapp.com
            </a>
            <p className="text-slate-500 text-xs mt-3">
              You can also send a message from inside the app: open <strong>Settings → Support</strong> and use the in-app contact form.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">Frequently Asked Questions</h2>

            <div className="space-y-5">
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">How do I restore my ColdStreak Pro purchase on a new device?</h3>
                <p className="text-slate-600">
                  On iOS: open the app → tap <strong>Upgrade to Pro</strong> → tap <strong>Restore Purchases</strong>. On web: tap <strong>Upgrade to Pro</strong> → enter the email you used at checkout under "already purchased?" and tap Restore.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-1">How do I cancel my ColdStreak Pro Monthly subscription?</h3>
                <p className="text-slate-600">
                  <strong>iPhone:</strong> Settings → [your name] → Subscriptions → ColdStreak Pro → Cancel Subscription.<br/>
                  <strong>Android:</strong> Google Play Store → Profile → Payments &amp; subscriptions → Subscriptions → ColdStreak Pro → Cancel.<br/>
                  <strong>Web (Stripe):</strong> Open Settings inside the app → ColdStreak Pro → Manage / Cancel Subscription.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-1">How do I delete my account?</h3>
                <p className="text-slate-600">
                  Inside the app: <strong>Settings → Delete Account</strong>. Or visit <Link href="/delete-account"><a className="text-cyan-600 underline" data-testid="link-delete-account">coldstreakapp.com/delete-account</a></Link> and follow the prompts.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-1">My Bluetooth thermometer won't connect.</h3>
                <p className="text-slate-600">
                  Bluetooth thermometers (Inkbird IBS-TH2 Plus and similar) require the ColdStreak iOS or Android app — they cannot connect through the mobile browser. Make sure Bluetooth is enabled and that ColdStreak has Bluetooth permission in your device settings.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-1">I'm a business owner — how do I claim my Chill Place listing?</h3>
                <p className="text-slate-600">
                  Open the app → <strong>Explore</strong> tab → tap your business → <strong>Claim Ownership</strong>. Choose a Verified Business plan, complete the purchase, and you'll get access to the Business Dashboard to manage your listing, view analytics, and add co-managers.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-1">I was charged but my Pro features aren't active.</h3>
                <p className="text-slate-600">
                  Try <strong>Restore Purchases</strong> first (see above). If that doesn't work, email us at support@coldstreakapp.com with the email used at checkout and we'll resolve it within one business day.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-1">How do I request a refund?</h3>
                <p className="text-slate-600">
                  <strong>iOS purchases:</strong> request refunds through Apple at <a href="https://reportaproblem.apple.com" className="text-cyan-600 underline">reportaproblem.apple.com</a>.<br/>
                  <strong>Android purchases:</strong> request refunds through Google Play.<br/>
                  <strong>Web purchases:</strong> email us at support@coldstreakapp.com.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Legal</h2>
            <p className="text-slate-600">
              <Link href="/privacy"><a className="text-cyan-600 underline" data-testid="link-privacy">Privacy Policy</a></Link>
              {" · "}
              <Link href="/terms"><a className="text-cyan-600 underline" data-testid="link-terms">Terms of Use</a></Link>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

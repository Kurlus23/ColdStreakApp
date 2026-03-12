import { Link } from "wouter";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <Link href="/">
            <a className="text-cyan-600 text-sm font-semibold hover:underline">← Back to ColdStreak</a>
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-4 mb-1">Privacy Policy</h1>
          <p className="text-slate-500 text-sm">Last updated: March 2026</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Overview</h2>
            <p className="text-slate-600">
              ColdStreak ("we", "us", "our") is a cold plunge tracking application. This Privacy Policy explains what information we collect, how we use it, and your rights with respect to it. We are committed to collecting only what is necessary and never selling your data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>
                <span className="font-semibold text-slate-800">Plunge history and session data</span> — duration, temperature, score, and optional notes you enter. Stored on your device and, if you have an account, on our servers.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Email address</span> — collected only if you purchase ColdStreak Pro or create an account. Used solely to verify your purchase and restore access across devices. Never used for marketing without explicit consent.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Leaderboard entries</span> — if you choose to submit a score to a public leaderboard, your chosen display name and plunge score are stored on our servers and visible to other users.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Community location submissions</span> — location name and any details you provide when suggesting a community spot. These are stored on our servers and may be visible to other Pro users.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Device settings and preferences</span> — stored locally on your device (body weight, home location label, alarm preferences). Not transmitted to our servers.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Information We Do Not Collect</h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>We do not collect your precise GPS location without your explicit permission.</li>
              <li>We do not collect health data beyond what you manually enter.</li>
              <li>We do not use advertising tracking identifiers or third-party ad tracking SDKs.</li>
              <li>We do not sell, rent, or share your personal data with third parties for their marketing purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>To provide and improve the ColdStreak app and its features.</li>
              <li>To verify Pro subscription status and restore purchases across devices.</li>
              <li>To display public leaderboard entries as opted in by you.</li>
              <li>To operate the community location feature.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Data Storage and Security</h2>
            <p className="text-slate-600">
              Your plunge history is stored locally on your device and, where applicable, on secured servers. We use industry-standard encryption for data in transit (HTTPS). Payment processing is handled entirely by Stripe — we never store your payment card details.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Third-Party Services</h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>
                <span className="font-semibold text-slate-800">Stripe</span> — payment processing for ColdStreak Pro. Subject to <a href="https://stripe.com/privacy" className="text-cyan-600 hover:underline" target="_blank" rel="noopener noreferrer">Stripe's Privacy Policy</a>.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Advertising</span> — free users may see advertisements served by third-party networks. These networks may use cookies or device identifiers in accordance with their own privacy policies. Pro users do not see ads.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Your Rights</h2>
            <p className="text-slate-600 mb-2">You may request at any time:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Access to the personal data we hold about you.</li>
              <li>Correction of inaccurate data.</li>
              <li>Deletion of your account and associated data.</li>
            </ul>
            <p className="text-slate-600 mt-2">
              To exercise these rights, email us at <a href="mailto:ColdStreakApp17@gmail.com" className="text-blue-600 underline">ColdStreakApp17@gmail.com</a> or contact us via the App Store or Google Play listing for ColdStreak.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Children</h2>
            <p className="text-slate-600">
              ColdStreak is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us so we can delete it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Changes to This Policy</h2>
            <p className="text-slate-600">
              We may update this Privacy Policy from time to time. We will note the date of the most recent update at the top of this page. Continued use of ColdStreak after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Contact</h2>
            <p className="text-slate-600">
              For privacy-related questions or data requests, email us at <a href="mailto:ColdStreakApp17@gmail.com" className="text-blue-600 underline">ColdStreakApp17@gmail.com</a> or contact us via the ColdStreak listing on the App Store or Google Play.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-slate-200">
          <p className="text-slate-400 text-xs">© 2026 ColdStreak. All rights reserved.</p>
          <div className="flex gap-4 mt-2">
            <Link href="/terms"><a className="text-cyan-600 text-xs hover:underline">Terms of Service</a></Link>
            <Link href="/"><a className="text-cyan-600 text-xs hover:underline">Back to App</a></Link>
          </div>
        </div>

      </div>
    </div>
  );
}

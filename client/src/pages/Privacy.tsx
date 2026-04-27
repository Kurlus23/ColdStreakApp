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
                <span className="font-semibold text-slate-800">Plunge history and session data</span> — duration, temperature, score, and any optional details you enter (such as location name). Stored on your device and, if you have an account, on our servers.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Session photos</span> — if you choose to attach a photo to a plunge session, it is stored on our servers (encrypted at rest and in transit) and is only visible to you when viewing your own history.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Email address</span> — collected only if you create an account or purchase ColdStreak Pro. Used to verify your purchase, restore access across devices, and for account-related communications. Never used for marketing without explicit consent.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Leaderboard entries</span> — if you choose to submit a score to a public leaderboard, your chosen display name and plunge score are stored on our servers and visible to all users.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Community location submissions</span> — if you submit a community spot, the location name, coordinates, and any details you provide are stored on our servers and visible to all users of the App. Your contact email is recorded for ownership purposes only and is never displayed publicly.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Business listing submissions</span> — if you submit a business listing, we collect the information you provide: business name, city, state, full address, phone number, website and social media URLs, and a contact email address. Your contact email is used solely for administrative purposes and is never displayed publicly. The business name, city, state, description, and any links you provide may be displayed publicly within the App. Verified business listings require a paid monthly subscription processed through Stripe; Stripe handles all payment data and ColdStreak does not store your credit card information.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Community event data</span> — if you create an event, we store the event name, description, date(s), location name, and any GPS coordinates you pin (plunge spot and parking/access point). This information is visible to all users of the App. Your display name is shown as the event organizer. We also store the list of users who sign up for an event (display names and account IDs) and any co-coordinator relationships you establish. Events are automatically deleted after their end window (up to seven days from the start date).
              </li>
              <li>
                <span className="font-semibold text-slate-800">Device location (GPS)</span> — only requested with your explicit permission. When granted, your device coordinates are used locally to suggest nearby community locations, to auto-detect your city and state for session logging, and to pin GPS coordinates when creating an event or community location. Precise coordinates are not stored on our servers beyond what you explicitly choose to attach to a submitted location or event. Location data is never used for advertising or shared with third parties.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Apple Health data (iOS only)</span> — only requested with your explicit permission. When granted, ColdStreak reads your heart rate and heart-rate variability from Apple Health for the duration of an active plunge to compute summary metrics (such as average heart rate over the session). The aggregated metrics are stored as part of the plunge record on your device and, if you have an account, on our servers. Raw individual heart-rate samples from Apple Health are never transmitted off your device. ColdStreak does not write data back to Apple Health and does not read any other health data type.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Bluetooth (BLE)</span> — only requested with your explicit permission. Used to discover and connect to a paired water-temperature thermometer (e.g. Inkbird IBS-TH2 Plus) and a paired heart-rate monitor. All Bluetooth scan results, advertisement payloads, and live readings are processed entirely on your device. The decoded current temperature and heart rate may be saved as part of a plunge record you choose to log; the underlying raw Bluetooth data is never transmitted to our servers.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Apple Watch (iOS only)</span> — when you install the optional ColdStreak Watch companion app, your active plunge timer, average heart rate, and any HRV reading are sent from the Watch to the iPhone over Apple's secure Watch Connectivity channel. This data is not transmitted off your device except as part of a plunge record you choose to log.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Device settings and preferences</span> — stored locally on your device only (body weight, home location label, alarm preferences, private spots). Not transmitted to our servers.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Information We Do Not Collect</h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>We do not collect your precise GPS location without your explicit permission, and we do not store raw GPS coordinates on our servers beyond what you explicitly choose to attach to a submitted location or event.</li>
              <li>We do not read any health data from Apple Health beyond heart rate and heart-rate variability, and we never write data back to Apple Health.</li>
              <li>We do not use advertising tracking identifiers (such as the iOS IDFA) or third-party ad tracking SDKs.</li>
              <li>We do not sell, rent, or share your personal data with third parties for their marketing purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>To provide and improve the ColdStreak app and its features.</li>
              <li>To verify Pro subscription status and restore purchases across devices.</li>
              <li>To display public leaderboard entries as opted in by you.</li>
              <li>To operate the community location feature, including displaying submitted spots to all users and attributing edits to the submitter's account.</li>
              <li>To display verified business listing information to users of the Explore feature.</li>
              <li>To operate the community Events feature — displaying event details, organizer names, and sign-up lists to all users of the App, and enforcing automatic event expiry.</li>
              <li>To resolve a city/state name from your device coordinates when you enable GPS (location data is not stored beyond the resolved place name or coordinates you explicitly choose to pin).</li>
              <li>To detect and fix errors in the App through anonymous crash reports.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Public Visibility of Event Data</h2>
            <p className="text-slate-600 mb-2">
              When you create an event, the following information is visible to all users of ColdStreak and to anyone who accesses the event's shareable link:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>Event name, description, and date(s)</li>
              <li>Location name and any GPS coordinates you pin</li>
              <li>Your display name as the event organizer</li>
              <li>The display names of any co-coordinators you add</li>
              <li>The display names of users who sign up</li>
            </ul>
            <p className="text-slate-600 mt-2">
              By creating an event or signing up for one, you consent to this information being publicly visible. If you wish to remove your event, you may do so through the App; events also expire automatically after their scheduled end window.
            </p>
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
                <span className="font-semibold text-slate-800">Stripe</span> — payment processing for ColdStreak Pro and Verified Business Listings. ColdStreak does not store payment card data. Subject to <a href="https://stripe.com/privacy" className="text-cyan-600 hover:underline" target="_blank" rel="noopener noreferrer">Stripe's Privacy Policy</a>.
              </li>
              <li>
                <span className="font-semibold text-slate-800">PostHog</span> — anonymous product analytics (e.g. feature usage events such as timer started, plunge logged). No personally identifiable information is sent. Subject to <a href="https://posthog.com/privacy" className="text-cyan-600 hover:underline" target="_blank" rel="noopener noreferrer">PostHog's Privacy Policy</a>.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Sentry</span> — error monitoring. If the App encounters an error, an automated crash report is sent to Sentry. Reports may include device type, operating system, and a stack trace. No personally identifiable information is intentionally included. Subject to <a href="https://sentry.io/privacy/" className="text-cyan-600 hover:underline" target="_blank" rel="noopener noreferrer">Sentry's Privacy Policy</a>.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Nominatim / OpenStreetMap</span> — reverse geocoding. When you grant location permission, your device coordinates are sent to the Nominatim public API to resolve a city and state name. No personal account is created and the OpenStreetMap Foundation does not retain coordinates for longer than required for the request. Subject to the <a href="https://osmfoundation.org/wiki/Privacy_Policy" className="text-cyan-600 hover:underline" target="_blank" rel="noopener noreferrer">OSMF Privacy Policy</a>.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Google Maps</span> — when you tap a "Get Directions" button on a community location or event, your device opens Google Maps with the destination coordinates. ColdStreak does not transmit your location to Google; Google's own privacy policy applies to any navigation session you initiate. Subject to <a href="https://policies.google.com/privacy" className="text-cyan-600 hover:underline" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a>.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Advertising</span> — free users may see advertisements served by third-party networks. These networks may use cookies or device identifiers in accordance with their own privacy policies. ColdStreak Pro users do not see ads.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Your Rights</h2>
            <p className="text-slate-600 mb-2">You may request at any time:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Access to the personal data we hold about you.</li>
              <li>Correction of inaccurate data.</li>
              <li>Deletion of your account and associated data, including any events you have created.</li>
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

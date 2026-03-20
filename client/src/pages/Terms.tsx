import { Link } from "wouter";

export default function Terms() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <Link href="/">
            <a className="text-cyan-600 text-sm font-semibold hover:underline">← Back to ColdStreak</a>
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-4 mb-1">Terms of Service</h1>
          <p className="text-slate-500 text-sm">Last updated: March 2026</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Acceptance of Terms</h2>
            <p className="text-slate-600">
              By downloading, installing, or using ColdStreak ("the App"), you agree to be bound by these Terms of Service. If you do not agree, do not use the App. We reserve the right to update these terms at any time; continued use of the App constitutes acceptance of any changes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Use of the App</h2>
            <p className="text-slate-600 mb-2">ColdStreak is provided for personal health tracking purposes. Business owners may also use the App to submit and manage a business listing through the Verified Business Listing feature. You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Use the App in any way that violates applicable laws or regulations.</li>
              <li>Attempt to reverse engineer, modify, or create derivative works of the App.</li>
              <li>Submit false, misleading, or harmful content to community features.</li>
              <li>Use automated means to access or scrape data from the App.</li>
              <li>Share your account credentials with others.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Health and Safety Disclaimer</h2>
            <p className="text-slate-600 mb-2">
              <strong className="text-slate-800">ASSUMPTION OF RISK:</strong> Cold water immersion carries serious health risks including cold water shock, cardiac arrest, hypothermia, loss of consciousness, and drowning. By using ColdStreak, you acknowledge that you voluntarily assume all risks associated with cold plunge activities.
            </p>
            <p className="text-slate-600 mb-2">
              ColdStreak is a tracking tool only. It does not provide medical advice, diagnosis, or treatment. Cold exposure scores, calorie estimates, and wellness metrics are approximations for informational purposes only and should not be used as the basis for any medical or nutritional decision.
            </p>
            <p className="text-slate-600">
              Consult a qualified physician before beginning cold exposure therapy, especially if you have heart conditions, high blood pressure, Raynaud's disease, circulatory conditions, or are pregnant.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Community Locations</h2>
            <p className="text-slate-600 mb-2">
              Community Spots are submitted by ColdStreak users and have not been verified for safety, accuracy, legality, or accessibility by ColdStreak. Conditions at any location — water temperature, currents, depth, accessibility — can change without notice due to weather, flooding, drought, or closures. Always assess conditions yourself before entering any body of water. Never plunge alone. ColdStreak is not liable for any injury, loss, or damages arising from use of community-submitted locations.
            </p>
            <p className="text-slate-600 mb-2">
              <strong className="text-slate-800">Trespassing and Land Access:</strong> The presence of a location in ColdStreak does not imply legal public access or permission to enter. Many natural swimming spots are located on private land, protected reserves, or areas with seasonal restrictions. It is your responsibility to research and comply with applicable access laws before visiting any location. ColdStreak is not responsible for trespassing violations, fines, or any consequences arising from accessing restricted locations.
            </p>
            <p className="text-slate-600">
              Directions and access point coordinates provided for community locations are for general guidance only and may not reflect current trail conditions, road closures, or official trailhead access points. Always verify directions independently before travel.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">User-Submitted Content</h2>
            <p className="text-slate-600">
              By submitting a community spot, leaderboard entry, or any other content, you confirm that the information is accurate to the best of your knowledge, that you are not disclosing a location on private land without authorization, and you grant ColdStreak a non-exclusive, worldwide, royalty-free license to display it within the App. You may edit or remove your own submitted locations at any time through the App. ColdStreak reserves the right to remove or hide any content that is inaccurate, inappropriate, offensive, or in violation of these terms, without notice.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Content Standards</h2>
            <p className="text-slate-600 mb-2">When using any sharing, photo, or community features within ColdStreak, you agree not to share, upload, or transmit content that:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Contains nudity, sexually explicit material, or pornographic content of any kind.</li>
              <li>Depicts or promotes violence, self-harm, or abuse.</li>
              <li>Harasses, threatens, or demeans other users.</li>
              <li>Is defamatory, hateful, or discriminatory based on race, gender, religion, sexual orientation, or any other protected characteristic.</li>
              <li>Violates the privacy or intellectual property rights of any person.</li>
              <li>Is spam, deceptive, or contains malicious links or software.</li>
            </ul>
            <p className="text-slate-600 mt-2">
              ColdStreak reserves the right to remove any content that violates these standards and to suspend or terminate accounts that repeatedly violate this policy, without notice.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Purchases, Subscriptions, and Refunds</h2>
            <p className="text-slate-600 mb-3">
              ColdStreak offers the following paid options:
            </p>
            <ul className="list-disc list-inside text-slate-600 space-y-1.5 mb-3 text-sm">
              <li><span className="font-semibold text-slate-700">ColdStreak Pro — Lifetime ($19.99 introductory price):</span> A single non-recurring purchase that permanently unlocks Pro features on your account. This is an introductory price and will increase to $29.99 for new purchases in the future; customers who purchase at the introductory price lock it in permanently. All sales are final and non-refundable except where required by applicable law or the policies of the platform through which you purchased (Apple App Store or Google Play).</li>
              <li><span className="font-semibold text-slate-700">ColdStreak Pro — Annual ($9.99/year):</span> An auto-renewing subscription billed once per year. You may cancel at any time through your account settings or the platform store (Apple App Store or Google Play); cancellation takes effect at the end of the current billing period and no partial-period refunds are issued except as required by law.</li>
              <li><span className="font-semibold text-slate-700">Verified Business Listing ($29.99/month, first month free):</span> A recurring monthly subscription for businesses seeking a verified listing in the ColdStreak Explore tab. The first calendar month is provided at no charge; subsequent months are billed automatically. You may cancel at any time; access continues until the end of the paid period. Refunds for business listing subscriptions are not provided except as required by law.</li>
            </ul>
            <p className="text-slate-600">
              Pro status is tied to your account and can be restored on any device by logging in with the same credentials. If you believe a charge was made in error, contact us at <a href="mailto:ColdStreakApp17@gmail.com" className="text-cyan-600 hover:underline">ColdStreakApp17@gmail.com</a> before initiating a chargeback.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Advertising</h2>
            <p className="text-slate-600">
              Free users of ColdStreak may see advertisements served by third-party networks. ColdStreak Pro removes all advertisements. ColdStreak is not responsible for the content of third-party advertisements or the practices of the advertisers.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Intellectual Property</h2>
            <p className="text-slate-600">
              ColdStreak, its logo, name, design, and all content created by us are the intellectual property of ColdStreak and its developers. You may not reproduce, distribute, or create derivative works without our written permission.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Availability and Changes</h2>
            <p className="text-slate-600">
              We reserve the right to modify, suspend, or discontinue the App or any of its features at any time without notice. We are not liable to you or any third party for any such modification, suspension, or discontinuation.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Limitation of Liability</h2>
            <p className="text-slate-600">
              To the fullest extent permitted by applicable law, ColdStreak and its developers shall not be liable for any indirect, incidental, special, punitive, or consequential damages — including but not limited to personal injury, property damage, loss of data, or loss of revenue — arising from your use of the App, cold plunge activities undertaken in connection with it, trespassing or access violations in connection with community-submitted locations, or reliance on community-submitted location data or directions. Our total liability to you for any claim arising from use of the App shall not exceed the total amount you paid to ColdStreak in the twelve months preceding the claim. Your sole remedy for dissatisfaction with the App is to stop using it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Governing Law</h2>
            <p className="text-slate-600">
              These Terms are governed by and construed in accordance with the laws of the United States. Any disputes arising from these Terms or your use of the App shall be resolved through binding arbitration or in a court of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Contact</h2>
            <p className="text-slate-600">
              For questions about these Terms, email us at <a href="mailto:ColdStreakApp17@gmail.com" className="text-blue-600 underline">ColdStreakApp17@gmail.com</a> or contact us via the ColdStreak listing on the App Store or Google Play.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-slate-200">
          <p className="text-slate-400 text-xs">© 2026 ColdStreak. All rights reserved.</p>
          <div className="flex gap-4 mt-2">
            <Link href="/privacy"><a className="text-cyan-600 text-xs hover:underline">Privacy Policy</a></Link>
            <Link href="/"><a className="text-cyan-600 text-xs hover:underline">Back to App</a></Link>
          </div>
        </div>

      </div>
    </div>
  );
}

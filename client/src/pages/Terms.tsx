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
          <p className="text-slate-500 text-sm">Last updated: May 2026</p>
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
            <p className="text-slate-600 mb-2">ColdStreak is provided for personal health tracking purposes. Business owners may also use the App to submit and manage a business listing through the Verified Business Listing feature. Registered users may create and manage community events through the Events feature. You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Use the App in any way that violates applicable laws or regulations.</li>
              <li>Attempt to reverse engineer, modify, or create derivative works of the App.</li>
              <li>Submit false, misleading, or harmful content to community features, including events.</li>
              <li>Use automated means to access or scrape data from the App.</li>
              <li>Share your account credentials with others.</li>
              <li>Create events for illegal gatherings, trespassing activities, or with the intent to harm or defraud attendees.</li>
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
            <h2 className="text-base font-bold text-slate-900 mb-2">Community Events</h2>
            <p className="text-slate-600 mb-2">
              The Events feature allows registered ColdStreak users to create, share, and sign up for community cold plunge gatherings. <strong className="text-slate-800">ColdStreak does not organize, host, sponsor, oversee, or endorse any event created through this feature.</strong> All events are independently organized by the user who created them and any co-coordinators they designate.
            </p>
            <p className="text-slate-600 mb-2">
              <strong className="text-slate-800">No Verification:</strong> ColdStreak does not verify the accuracy, safety, legality, or any other aspect of any event, its listed location, its organizers, or the activities planned. GPS-pinned plunge spot and access/parking coordinates are provided by the event creator and carry the same risks as community location data — conditions may differ from what is described, access may be restricted, and coordinates may be inaccurate.
            </p>
            <p className="text-slate-600 mb-2">
              <strong className="text-slate-800">Organizer Responsibility:</strong> Event creators and co-coordinators are solely responsible for the events they create, including ensuring the safety of the chosen location, obtaining any required permits or landowner permission, communicating risks to attendees, and complying with all applicable laws. By creating an event, you represent that you have the authority to organize the activity at the stated location.
            </p>
            <p className="text-slate-600 mb-2">
              <strong className="text-slate-800">Attendee Assumption of Risk:</strong> By signing up for or attending any event found through ColdStreak, you acknowledge that cold water immersion carries serious health risks (including hypothermia, cold shock, and cardiac events), that you are voluntarily participating, and that you assume all risks associated with attendance, including travel to and from the event location. You are responsible for assessing the event location's safety and your own fitness to participate.
            </p>
            <p className="text-slate-600 mb-2">
              <strong className="text-slate-800">No Guarantee of Persistence:</strong> Events are automatically removed after their scheduled end window (a maximum of seven days from the event start date). ColdStreak does not guarantee that any event will remain available on the platform. Cancellations, changes, and removals are solely the responsibility of the event organizers; ColdStreak has no obligation to notify attendees of changes.
            </p>
            <p className="text-slate-600">
              ColdStreak is not liable for any injury, loss, damages, claims, or legal consequences arising from your creation of, coordination of, attendance at, or inability to attend any community event.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Verified Business Listings — Owner Responsibilities</h2>
            <p className="text-slate-600 mb-2">
              <strong className="text-slate-800">Accuracy of business information:</strong> If you submit or manage a Verified Business Listing, you represent that all information you provide — including business name, address, hours of operation, contact details, website and booking URLs, modalities offered, and any descriptive content — is accurate and that you are authorized to publish it on behalf of the business. Hours and "open now" status displayed on your public profile (<code>/biz/[your-slug]</code>) are calculated from the hours and timezone you set; ColdStreak is not responsible for visitor reliance on outdated hours that you have not updated.
            </p>
            <p className="text-slate-600 mb-2">
              <strong className="text-slate-800">Co-manager authorization:</strong> When you add a co-manager email address to your listing, you represent that the person at that address is authorized by the business to access the business dashboard, view analytics, edit hours, and download anonymized plunger statistics. You remain responsible for the actions of any co-manager you add. The primary contact-email owner is the only account that may add or remove co-managers; co-managers themselves cannot modify the allowlist.
            </p>
            <p className="text-slate-600 mb-2">
              <strong className="text-slate-800">Plunger data export — privacy obligations:</strong> The CSV export available in the business dashboard contains only display names and stable anonymous identifiers chosen by ColdStreak — it does not contain email addresses, account IDs, or device identifiers. By downloading this data you agree to use it only for your own internal analytics and customer-experience purposes, to keep it confidential, to not attempt to re-identify anonymous plungers, to not combine it with other data sources for the purpose of identification, and to comply with all applicable privacy laws (including GDPR, CCPA, and any state biometric or wellness-data laws that apply to your business).
            </p>
            <p className="text-slate-600 mb-2">
              <strong className="text-slate-800">Public profile claims:</strong> Your public profile may include claims about water temperature, modalities, certifications, or affiliations. You are solely responsible for the accuracy of these claims and for compliance with applicable advertising, consumer-protection, and health-and-wellness regulations in your jurisdiction. ColdStreak does not independently verify any owner-supplied content beyond the initial listing approval.
            </p>
            <p className="text-slate-600 mb-2">
              <strong className="text-slate-800">Admin support visibility:</strong> ColdStreak administrative staff may view your listing's dashboard, analytics, and co-manager list for the purpose of providing customer support, investigating reported abuse, or maintaining platform integrity. We do not access this data for any other purpose.
            </p>
            <p className="text-slate-600">
              <strong className="text-slate-800">Indemnity:</strong> You agree to indemnify and hold harmless ColdStreak, its developers, and its affiliates from any claim, loss, or damages (including reasonable attorneys' fees) arising from your submission of false, misleading, or unauthorized listing information; from your misuse of co-manager access or downloaded plunger data; or from any claim by a third party that your listing violates their rights.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">User-Submitted Content</h2>
            <p className="text-slate-600">
              By submitting a community spot, event, leaderboard entry, or any other content, you confirm that the information is accurate to the best of your knowledge, that you are not disclosing a location on private land without authorization, and you grant ColdStreak a non-exclusive, worldwide, royalty-free license to display it within the App. You may edit or remove your own submitted locations at any time through the App. ColdStreak reserves the right to remove or hide any content that is inaccurate, inappropriate, offensive, or in violation of these terms, without notice.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Content Standards</h2>
            <p className="text-slate-600 mb-2">When using any sharing, photo, event, or community features within ColdStreak, you agree not to share, upload, or transmit content that:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Contains nudity, sexually explicit material, or pornographic content of any kind.</li>
              <li>Depicts or promotes violence, self-harm, or abuse.</li>
              <li>Harasses, threatens, or demeans other users.</li>
              <li>Is defamatory, hateful, or discriminatory based on race, gender, religion, sexual orientation, or any other protected characteristic.</li>
              <li>Violates the privacy or intellectual property rights of any person.</li>
              <li>Is spam, deceptive, or contains malicious links or software.</li>
              <li>Promotes illegal activity or creates events for illegal gatherings.</li>
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
              <li><span className="font-semibold text-slate-700">ColdStreak Pro — Monthly ($3.99/month):</span> An auto-renewing monthly subscription. You may cancel at any time through your account settings or the platform store (Apple App Store or Google Play); cancellation takes effect at the end of the current billing period and no partial-period refunds are issued except as required by law.</li>
              <li><span className="font-semibold text-slate-700">ColdStreak Pro — Lifetime ($19.99 introductory price):</span> A single non-recurring purchase that permanently unlocks Pro features on your account. This is an introductory price and will increase to $29.99 for new purchases in the future; customers who purchase at the introductory price lock it in permanently. All sales are final and non-refundable except where required by applicable law or the policies of the platform through which you purchased (Apple App Store or Google Play).</li>
              <li><span className="font-semibold text-slate-700">Verified Business Listing — tiered subscriptions:</span> A recurring monthly subscription for businesses seeking verified listings in the ColdStreak Explore tab. Available tiers: <strong>1 location at $29.99/month (first month free)</strong>, <strong>up to 3 locations at $79.99/month (billed immediately, no free trial)</strong>, and <strong>up to 10 locations at $129.99/month (billed immediately, no free trial)</strong>. Businesses with more than 10 locations may contact us at <a href="mailto:ColdStreakApp17@gmail.com" className="text-cyan-600 hover:underline">ColdStreakApp17@gmail.com</a> for enterprise pricing. The introductory free month applies only to the $29.99 / 1-location tier. Subsequent months are billed automatically. You may cancel at any time; access continues until the end of the paid period. Refunds for business listing subscriptions are not provided except as required by law.</li>
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
              We reserve the right to modify, suspend, or discontinue the App or any of its features — including the Events feature — at any time without notice. We are not liable to you or any third party for any such modification, suspension, or discontinuation.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Limitation of Liability</h2>
            <p className="text-slate-600">
              To the fullest extent permitted by applicable law, ColdStreak and its developers shall not be liable for any indirect, incidental, special, punitive, or consequential damages — including but not limited to personal injury, property damage, loss of data, or loss of revenue — arising from your use of the App, cold plunge activities undertaken in connection with it, trespassing or access violations in connection with community-submitted locations, your creation of or attendance at any community event, reliance on event location data, GPS coordinates, or directions provided through the Events feature, or any act or omission of an event organizer or co-coordinator. Our total liability to you for any claim arising from use of the App shall not exceed the total amount you paid to ColdStreak in the twelve months preceding the claim. Your sole remedy for dissatisfaction with the App is to stop using it.
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

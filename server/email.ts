const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.EMAIL_FROM || "ColdStreak <noreply@coldstreakapp.com>";
const FALLBACK_FROM = "ColdStreak <onboarding@resend.dev>";

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — email not sent to:", to);
    console.warn("[email] Subject:", subject);
    return;
  }

  const tryFrom = async (from: string): Promise<Response> => {
    return fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from, to: [to], subject, html, reply_to: "ColdStreakApp17@gmail.com" }),
    });
  };

  let res = await tryFrom(FROM_ADDRESS);

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403 && body.includes("not verified")) {
      console.warn("[email] Domain not verified, falling back to onboarding@resend.dev");
      res = await tryFrom(FALLBACK_FROM);
      if (!res.ok) {
        const errBody = await res.text();
        console.error("[email] Resend API error (fallback):", res.status, errBody);
        throw new Error("Failed to send email");
      }
    } else if (!res.ok) {
      console.error("[email] Resend API error:", res.status, body);
      throw new Error("Failed to send email");
    }
  }

  console.log("[email] Sent successfully to:", to, "subject:", subject);
}

export async function sendBroadcastEmail(to: string, subject: string, bodyText: string): Promise<void> {
  // Convert newlines to <br> for HTML rendering, wrap in branded template
  const bodyHtml = bodyText
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  await sendEmail(to, subject, `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f1f3d;color:#e2e8f0;border-radius:16px;padding:32px;">
      <h1 style="color:#22d3ee;margin:0 0 24px;font-size:22px">🧊 ColdStreak</h1>
      <div style="line-height:1.75;font-size:15px;color:#cbd5e1;">${bodyHtml}</div>
      <hr style="border:none;border-top:1px solid #1e3a5f;margin:28px 0;" />
      <p style="color:#475569;font-size:12px;margin:0;line-height:1.6;">
        You received this because you have a ColdStreak account.<br>
        — The ColdStreak Team 🥶
      </p>
    </div>
  `);
}

export async function sendFriendInviteEmail(to: string, inviterName: string, appUrl: string): Promise<void> {
  await sendEmail(to, `${inviterName} wants to be your ColdStreak friend! 🧊`, `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f1f3d;color:#e2e8f0;border-radius:16px;padding:32px;">
      <h1 style="color:#22d3ee;margin:0 0 8px">🧊 ColdStreak</h1>
      <h2 style="color:#fff;margin:0 0 16px;font-size:20px">You've been invited!</h2>
      <p style="color:#94a3b8;margin:0 0 8px;line-height:1.6">
        <strong style="color:#e2e8f0">${inviterName}</strong> sent you a friend request on ColdStreak — the cold plunge tracking app.
      </p>
      <p style="color:#94a3b8;margin:0 0 24px;line-height:1.6">
        Join ColdStreak to track your plunges, build streaks, and compete on leaderboards with friends.
      </p>
      <a href="${appUrl}"
         style="display:inline-block;background:#22d3ee;color:#0f172a;font-weight:700;
                text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;">
        Accept &amp; Join ColdStreak
      </a>
      <p style="color:#64748b;margin:24px 0 0;font-size:13px;line-height:1.6">
        Once you sign up, set a username so ${inviterName} can send you a friend request directly.<br><br>
        — The ColdStreak Team 🥶
      </p>
    </div>
  `);
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  await sendEmail(to, "Verify your ColdStreak email", `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f1f3d;color:#e2e8f0;border-radius:16px;padding:32px;">
      <h1 style="color:#22d3ee;margin:0 0 8px">🧊 ColdStreak</h1>
      <h2 style="color:#fff;margin:0 0 24px;font-size:20px">Verify your email address</h2>
      <p style="color:#94a3b8;margin:0 0 24px;line-height:1.6">
        Thanks for signing up! Click below to confirm your email address. You can keep using ColdStreak in the meantime.
      </p>
      <a href="${verifyUrl}"
         style="display:inline-block;background:#22d3ee;color:#0f172a;font-weight:700;
                text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;">
        Verify Email
      </a>
      <p style="color:#64748b;margin:24px 0 0;font-size:13px;line-height:1.6">
        If you didn't create a ColdStreak account, you can safely ignore this email.<br><br>
        — The ColdStreak Team 🥶
      </p>
    </div>
  `);
}

export async function sendWelcomeEmail(to: string, displayName: string | null | undefined, appUrl: string): Promise<void> {
  const safeName = displayName
    ? displayName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    : "";
  const greeting = safeName ? `Hey ${safeName},` : "Hey there,";

  await sendEmail(to, "Welcome to ColdStreak — your cold journey starts here 🧊", `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#081426;color:#e2e8f0;border-radius:20px;overflow:hidden;">
      <div style="background:#102f55;padding:36px 32px 30px;">
        <div style="color:#67e8f9;font-size:14px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">ColdStreak</div>
        <h1 style="color:#fff;margin:0 0 12px;font-size:30px;line-height:1.15;">Welcome to your coldest habit.</h1>
        <p style="color:#bae6fd;margin:0;font-size:17px;line-height:1.6;">${greeting} ColdStreak helps you turn cold plunges into a trackable, rewarding routine.</p>
      </div>

      <div style="padding:30px 32px;">
        <div style="background:#102f55;border:1px solid #2a638e;border-radius:16px;padding:22px 20px 20px;margin-bottom:26px;">
          <div style="color:#bae6fd;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px;">Your first plunge</div>
          <h2 style="color:#fff;margin:0 0 10px;font-size:21px;line-height:1.3;">You’re less than a minute from getting started.</h2>
          <p style="color:#cbd5e1;margin:0 0 20px;line-height:1.65;font-size:14px;">
            Open ColdStreak, enter your water temperature, start the timer, and jump in. We’ll take care of the tracking.
          </p>
          <a href="${appUrl}"
             style="display:inline-block;background:#22d3ee;color:#082f49;font-weight:700;
                    text-decoration:none;padding:14px 22px;border-radius:11px;font-size:15px;">
            Start Your First Plunge
          </a>
        </div>

        <p style="color:#cbd5e1;margin:0 0 18px;line-height:1.7;font-size:15px;">
          As you keep going, here’s what you’ll discover:
        </p>

        <div style="background:#102f55;border:1px solid #2a638e;border-radius:14px;padding:18px 18px 16px;margin-bottom:12px;">
          <div style="color:#67e8f9;font-size:15px;font-weight:700;margin-bottom:6px;">Track your progress</div>
          <p style="color:#94a3b8;margin:0;line-height:1.6;font-size:14px;">
            Use the countdown or stopwatch from Home, then see your duration, water temperature, Cold Score, streaks, goals, and achievements all in one place.
          </p>
        </div>

        <div style="background:#102f55;border:1px solid #2a638e;border-radius:14px;padding:18px 18px 16px;margin-bottom:12px;">
          <div style="color:#67e8f9;font-size:15px;font-weight:700;margin-bottom:6px;">Turn your plunge into a game</div>
          <p style="color:#94a3b8;margin:0;line-height:1.6;font-size:14px;">
            Brain Freeze throws quick trivia questions at you while you’re in the water. Answer correctly, earn points and cold-water bonuses, and challenge your friends.
          </p>
        </div>

        <div style="background:#102f55;border:1px solid #2a638e;border-radius:14px;padding:18px 18px 16px;margin-bottom:12px;">
          <div style="color:#67e8f9;font-size:15px;font-weight:700;margin-bottom:8px;">Turn every plunge into personal insights</div>
          <p style="color:#cbd5e1;margin:0 0 10px;line-height:1.6;font-size:14px;">
            The <strong style="color:#fff;">Benefit Bar</strong> shows what your time in the cold is building toward while you plunge.
          </p>
          <p style="color:#cbd5e1;margin:0 0 10px;line-height:1.6;font-size:14px;">
            Complete the quick post-plunge check-in to uncover your <strong style="color:#fff;">Sweet Spot</strong> for temperature and duration.
          </p>
          <p style="color:#cbd5e1;margin:0;line-height:1.6;font-size:14px;">
            Your weekly and monthly <strong style="color:#fff;">Reports</strong> turn those check-ins into patterns you can actually use.
          </p>
        </div>

        <div style="background:#102f55;border:1px solid #2a638e;border-radius:14px;padding:18px 18px 16px;margin-bottom:12px;">
          <div style="color:#67e8f9;font-size:15px;font-weight:700;margin-bottom:6px;">Find your people</div>
          <p style="color:#94a3b8;margin:0;line-height:1.6;font-size:14px;">
            Discover plunge spots, events, and other cold-plunge enthusiasts near you. Compete on leaderboards or challenge friends.
          </p>
        </div>

        <div style="background:#102f55;border:1px solid #2a638e;border-radius:14px;padding:18px 18px 16px;margin-bottom:26px;">
          <div style="color:#67e8f9;font-size:15px;font-weight:700;margin-bottom:6px;">Keep the streak alive</div>
          <p style="color:#94a3b8;margin:0;line-height:1.6;font-size:14px;">
            Come back tomorrow, watch your progress build, and use Streak Freeze when you need a rest day.
          </p>
        </div>

        <p style="color:#64748b;margin:26px 0 0;font-size:13px;line-height:1.8;">
          Start small: choose a comfortable temperature, set a short timer, and focus on steady breathing. ColdStreak is for personal tracking and motivation, not medical advice. If you have a health condition or are unsure whether cold exposure is right for you, consult a qualified healthcare professional first.
        </p>
      </div>

      <div style="background:#081426;border-top:1px solid #1d456b;padding:20px 32px;">
        <p style="color:#64748b;margin:0;font-size:13px;line-height:1.8;">
          You received this because you created a ColdStreak account.<br>
          Questions? Reply to this email and we’ll help.<br><br>
          Stay cold,<br><strong style="color:#94a3b8;">The ColdStreak Team</strong>
        </p>
      </div>
    </div>
  `);
}

export async function sendMilestoneEmail(milestone: number, totalUsers: number): Promise<void> {
  await sendEmail(
    "ColdStreakApp17@gmail.com",
    `🎉 ColdStreak hit ${milestone.toLocaleString()} users!`,
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f1f3d;color:#e2e8f0;border-radius:16px;padding:32px;">
      <h1 style="color:#22d3ee;margin:0 0 8px">🧊 ColdStreak</h1>
      <h2 style="color:#fff;margin:0 0 24px;font-size:22px">🎉 You hit ${milestone.toLocaleString()} users!</h2>
      <p style="color:#94a3b8;margin:0 0 16px;line-height:1.6;font-size:16px">
        Someone just became user #${totalUsers.toLocaleString()} on ColdStreak. You've officially crossed the <strong style="color:#22d3ee">${milestone.toLocaleString()}-user milestone</strong>.
      </p>
      <p style="color:#64748b;margin:24px 0 0;font-size:13px">
        — Your ColdStreak server 🥶
      </p>
    </div>
  `
  );
}

export async function sendAdminSecurityAlert(event: "login" | "password_reset", username: string, ip?: string): Promise<void> {
  const label = event === "login" ? "Login attempt" : "Password reset request";
  const color = event === "login" ? "#22d3ee" : "#f59e0b";
  await sendEmail(
    "coldstreakapp17@gmail.com",
    `🔐 ColdStreak admin alert: ${label} for ${username}`,
    `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f1f3d;color:#e2e8f0;border-radius:16px;padding:32px;">
      <h1 style="color:#22d3ee;margin:0 0 8px">🧊 ColdStreak</h1>
      <h2 style="color:${color};margin:0 0 16px;font-size:18px">${label}</h2>
      <p style="color:#94a3b8;margin:0 0 8px;line-height:1.6">
        A <strong style="color:#e2e8f0">${label.toLowerCase()}</strong> was detected for the admin account <strong style="color:${color}">${username}</strong>.
      </p>
      ${ip ? `<p style="color:#64748b;font-size:13px;margin:0 0 8px">IP: ${ip}</p>` : ""}
      <p style="color:#64748b;margin:16px 0 0;font-size:13px">
        If this was you, no action is needed. If not, change the password immediately.<br><br>
        — ColdStreak Security 🥶
      </p>
    </div>`
  );
}

export async function sendSupportEmail(opts: {
  from: string;
  username: string | null;
  category: string;
  message: string;
  deviceInfo: string;
}): Promise<void> {
  const categoryLabels: Record<string, string> = {
    bug: "🐛 Bug Report",
    refund: "💳 Refund Request",
    feature: "💡 Feature Request",
    other: "📬 General Question",
  };
  const label = categoryLabels[opts.category] ?? opts.category;
  await sendEmail("coldstreakapp17@gmail.com", `[ColdStreak Support] ${label}`, `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f1f3d;color:#e2e8f0;border-radius:16px;padding:32px;">
      <h1 style="color:#22d3ee;margin:0 0 4px">🧊 ColdStreak Support</h1>
      <h2 style="color:#fff;margin:0 0 24px;font-size:18px">${label}</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="color:#64748b;padding:4px 0;width:110px">From</td><td style="color:#e2e8f0">${opts.from}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0">Username</td><td style="color:#e2e8f0">${opts.username ?? "—"}</td></tr>
      </table>
      <div style="background:#1e3a5f;border-radius:10px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;line-height:1.7;white-space:pre-wrap;">${opts.message}</p>
      </div>
      <div style="background:#0d1b2e;border-radius:10px;padding:12px;font-size:12px;color:#64748b;">
        <strong style="color:#94a3b8;">Device Info</strong><br>
        <pre style="margin:6px 0 0;white-space:pre-wrap;font-size:11px;">${opts.deviceInfo}</pre>
      </div>
    </div>
  `);
}

export async function sendAdminReplyEmail(opts: {
  to: string;
  username: string | null;
  originalCategory: string;
  originalMessage: string;
  replyText: string;
}): Promise<void> {
  const categoryLabels: Record<string, string> = {
    bug: "Bug Report",
    refund: "Refund Request",
    feature: "Feature Request",
    other: "General Question",
  };
  const label = categoryLabels[opts.originalCategory] ?? opts.originalCategory;
  await sendEmail(opts.to, `Re: Your ColdStreak ${label}`, `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f1f3d;color:#e2e8f0;border-radius:16px;padding:32px;">
      <h1 style="color:#22d3ee;margin:0 0 4px">🧊 ColdStreak Support</h1>
      <h2 style="color:#fff;margin:0 0 24px;font-size:18px">Re: Your ${label}</h2>
      <p style="color:#94a3b8;margin:0 0 16px">Hi${opts.username ? ` ${opts.username}` : ""},</p>
      <div style="background:#1e3a5f;border-radius:10px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;line-height:1.7;white-space:pre-wrap;color:#e2e8f0;">${opts.replyText}</p>
      </div>
      <div style="background:#0d1b2e;border-radius:10px;padding:12px;font-size:12px;color:#64748b;margin-bottom:20px;">
        <strong style="color:#94a3b8;">Your original message</strong>
        <p style="margin:6px 0 0;white-space:pre-wrap;font-size:11px;">${opts.originalMessage}</p>
      </div>
      <p style="color:#64748b;font-size:12px;margin:0;">Stay cold,<br><strong style="color:#94a3b8;">The ColdStreak Team</strong></p>
    </div>
  `);
}

export async function sendChurnSurveyEmail(opts: {
  to: string;
  displayName: string | null;
  daysInactive: number;
  surveyUrl: string;
}): Promise<void> {
  const greeting = opts.displayName ? `Hey ${opts.displayName},` : "Hey there,";
  await sendEmail(opts.to, "🧊 We miss you at ColdStreak — quick question?", `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f1f3d;color:#e2e8f0;border-radius:16px;padding:32px;">
      <h1 style="color:#22d3ee;margin:0 0 8px">🧊 ColdStreak</h1>
      <h2 style="color:#fff;margin:0 0 16px;font-size:20px">We miss you in the cold</h2>
      <p style="color:#94a3b8;margin:0 0 16px;line-height:1.6">${greeting}</p>
      <p style="color:#94a3b8;margin:0 0 16px;line-height:1.6">
        It's been about <strong style="color:#e2e8f0">${opts.daysInactive} days</strong> since your last plunge. Would you mind telling us why? It takes 10 seconds and genuinely helps us improve.
      </p>
      <a href="${opts.surveyUrl}"
         style="display:inline-block;background:#22d3ee;color:#0f172a;font-weight:700;
                text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;">
        Tell us what happened
      </a>
      <p style="color:#64748b;margin:24px 0 0;font-size:13px;line-height:1.6">
        No pressure — if you're back in the water already, ignore this and keep plunging. 🥶<br><br>
        — The ColdStreak Team
      </p>
    </div>
  `);
}

export async function sendCoManagerInviteEmail(opts: {
  to: string;
  businessName: string;
  inviterEmail: string;
  dashboardUrl: string;
}): Promise<void> {
  await sendEmail(opts.to, `You've been added as a co-manager on ColdStreak`, `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f1f3d;color:#e2e8f0;border-radius:16px;padding:32px;">
      <h1 style="color:#22d3ee;margin:0 0 8px">🧊 ColdStreak</h1>
      <h2 style="color:#fff;margin:0 0 16px;font-size:20px">You're now a co-manager for ${opts.businessName}</h2>
      <p style="color:#94a3b8;margin:0 0 16px;line-height:1.6">
        <strong style="color:#e2e8f0">${opts.inviterEmail}</strong> added you as a co-manager for
        <strong style="color:#e2e8f0">${opts.businessName}</strong> on ColdStreak.
      </p>
      <p style="color:#94a3b8;margin:0 0 24px;line-height:1.6">
        Sign in with this email address (<strong style="color:#e2e8f0">${opts.to}</strong>) and you'll see the listing in your business dashboard. You can view analytics, edit hours, and export plunger data — but only the primary owner can add or remove co-managers.
      </p>
      <a href="${opts.dashboardUrl}"
         style="display:inline-block;background:#22d3ee;color:#0f172a;font-weight:700;
                text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;">
        Open business dashboard
      </a>
      <p style="color:#64748b;margin:24px 0 0;font-size:13px;line-height:1.6">
        Don't have a ColdStreak account yet? Create one with this email address to gain access.<br><br>
        — The ColdStreak Team 🥶
      </p>
    </div>
  `);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmail(to, "Reset your ColdStreak password", `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f1f3d;color:#e2e8f0;border-radius:16px;padding:32px;">
      <h1 style="color:#22d3ee;margin:0 0 8px">🧊 ColdStreak</h1>
      <h2 style="color:#fff;margin:0 0 24px;font-size:20px">Reset your password</h2>
      <p style="color:#94a3b8;margin:0 0 24px;line-height:1.6">
        We received a request to reset your password. Click the button below to choose a new one.
        This link expires in <strong style="color:#e2e8f0">1 hour</strong>.
      </p>
      <a href="${resetUrl}"
         style="display:inline-block;background:#22d3ee;color:#0f172a;font-weight:700;
                text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;">
        Reset Password
      </a>
      <p style="color:#64748b;margin:24px 0 0;font-size:13px;line-height:1.6">
        If you didn't request this, you can safely ignore this email — your password won't change.<br><br>
        — The ColdStreak Team 🥶
      </p>
    </div>
  `);
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.EMAIL_FROM || "ColdStreak <noreply@coldstreakapp.com>";
const FALLBACK_FROM = "ColdStreak <onboarding@resend.dev>";

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
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
    }
    if (!res.ok) {
      const errBody = await res.text();
      console.error("[email] Resend API error:", res.status, errBody);
      throw new Error("Failed to send email");
    }
  }

  console.log("[email] Sent successfully to:", to, "subject:", subject);
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
    "kurlus23@gmail.com",
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

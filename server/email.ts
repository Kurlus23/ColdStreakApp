const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.EMAIL_FROM || "ColdStreak <noreply@coldstreak.app>";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — password reset email not sent");
    console.warn("[email] Reset URL (dev only):", resetUrl);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject: "Reset your ColdStreak password",
      html: `
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
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[email] Resend API error:", res.status, body);
    throw new Error("Failed to send reset email");
  }
}

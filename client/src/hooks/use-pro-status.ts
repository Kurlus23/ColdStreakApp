import { useState, useEffect, useCallback } from "react";

const PRO_EMAIL_KEY = "coldstreak-pro-email";
const PRO_STATUS_KEY = "coldstreak-is-pro";
const PROMO_EXPIRES_KEY = "coldstreak-promo-expires";
const PROMO_OWNER_KEY = "coldstreak-promo-owner";
const AUTH_USER_KEY = "coldstreak-auth-user";
const FOUNDING_PLUNGER_KEY = "coldstreak-founding-plunger";
export const PENDING_CHECKOUT_KEY = "coldstreak-pending-checkout";

function getLoggedInEmail(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.email ?? null;
  } catch {
    return null;
  }
}

function isPromoActiveForEmail(email: string | null): boolean {
  const expires = localStorage.getItem(PROMO_EXPIRES_KEY);
  if (!expires || new Date(expires) <= new Date()) return false;
  const owner = localStorage.getItem(PROMO_OWNER_KEY);
  // If no owner stored it was redeemed while logged out — applies to anyone
  if (!owner) return true;
  if (!email) return false;
  return owner.toLowerCase() === email.toLowerCase();
}

export function useProStatus() {
  const loggedInEmail = getLoggedInEmail();

  const [isPro, setIsPro] = useState<boolean>(() => {
    if (isPromoActiveForEmail(loggedInEmail)) return true;
    const cached = localStorage.getItem(PRO_STATUS_KEY) === "true";
    if (!cached) return false;
    const proEmail = localStorage.getItem(PRO_EMAIL_KEY);
    if (loggedInEmail && proEmail && loggedInEmail.toLowerCase() !== proEmail.toLowerCase()) return false;
    return true;
  });
  const [proEmail, setProEmail] = useState<string | null>(
    () => localStorage.getItem(PRO_EMAIL_KEY)
  );
  const [promoExpiresAt, setPromoExpiresAt] = useState<string | null>(
    () => localStorage.getItem(PROMO_EXPIRES_KEY)
  );
  const [loading, setLoading] = useState(false);
  const [isFoundingPlunger, setIsFoundingPlunger] = useState<boolean>(
    () => localStorage.getItem(FOUNDING_PLUNGER_KEY) === "true"
  );

  const markPro = useCallback((email: string, foundingPlunger = false) => {
    localStorage.setItem(PRO_STATUS_KEY, "true");
    localStorage.setItem(PRO_EMAIL_KEY, email.toLowerCase());
    localStorage.setItem(FOUNDING_PLUNGER_KEY, String(foundingPlunger));
    setIsPro(true);
    setProEmail(email.toLowerCase());
    setIsFoundingPlunger(foundingPlunger);
  }, []);

  // Called on logout — clears Stripe pro flags but keeps promo so the same
  // user's promo survives a logout/login on the same device.
  const clearPro = useCallback(() => {
    localStorage.removeItem(PRO_STATUS_KEY);
    localStorage.removeItem(PRO_EMAIL_KEY);
    localStorage.removeItem(FOUNDING_PLUNGER_KEY);
    setIsPro(false);
    setProEmail(null);
    setIsFoundingPlunger(false);
    // Promo expiry + owner are intentionally kept so the same user recovers
    // their promo after logging back in. verifyProForEmail() will clear them
    // if the logged-in email doesn't match the promo owner.
  }, []);

  // Called right after login to restore Pro from the server or local promo.
  const verifyProForEmail = useCallback(async (email: string) => {
    const norm = email.toLowerCase();
    try {
      const res = await fetch(`/api/pro-status/${encodeURIComponent(norm)}`);
      const data = await res.json();
      if (data.isPro) {
        markPro(data.email, data.foundingPlunger ?? false);
        return;
      }
    } catch { /* network error — fall through to promo check */ }

    // No server record — check if a local promo belongs to this email
    if (isPromoActiveForEmail(norm)) {
      // Stamp owner so it won't bleed to a different account
      localStorage.setItem(PROMO_OWNER_KEY, norm);
      setIsPro(true);
      return;
    }

    // Promo exists but belongs to a different account — clear it
    const owner = localStorage.getItem(PROMO_OWNER_KEY);
    if (owner && owner.toLowerCase() !== norm) {
      localStorage.removeItem(PROMO_EXPIRES_KEY);
      localStorage.removeItem(PROMO_OWNER_KEY);
      setPromoExpiresAt(null);
    }

    setIsPro(false);
  }, [markPro]);

  // On mount, verify cached pro status with the backend
  useEffect(() => {
    const cachedEmail = localStorage.getItem(PRO_EMAIL_KEY);
    if (!cachedEmail) return;

    const currentEmail = getLoggedInEmail();
    if (currentEmail && currentEmail.toLowerCase() !== cachedEmail.toLowerCase()) {
      clearPro();
      return;
    }

    fetch(`/api/pro-status/${encodeURIComponent(cachedEmail)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.isPro) {
          markPro(data.email, data.foundingPlunger ?? false);
        } else {
          clearPro();
        }
      })
      .catch(() => {});
  }, [markPro, clearPro]);

  const startCheckout = useCallback(async (plan: "lifetime" | "annual" = "lifetime"): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const origin = window.location.origin;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          successUrl: `${origin}/`,
          cancelUrl: `${origin}/`,
          plan,
        }),
      });
      const data = await res.json();
      if (data.url) {
        // Flag that we're leaving for Stripe — native app uses this to auto-restore on return
        const emailForRestore = getLoggedInEmail();
        localStorage.setItem(PENDING_CHECKOUT_KEY, emailForRestore ?? "unknown");
        window.location.href = data.url;
        return { success: true };
      }
      return { success: false, error: data.detail ?? data.message ?? "Could not start checkout. Please try again." };
    } catch (e) {
      console.error("Checkout failed", e);
      return { success: false, error: "Network error. Please check your connection and try again." };
    } finally {
      setLoading(false);
    }
  }, []);

  const verifySession = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stripe/verify?session_id=${sessionId}`);
      const data = await res.json();
      if (data.isPro && data.email) {
        markPro(data.email, data.foundingPlunger ?? false);
        return true;
      }
    } catch (e) {
      console.error("Verify failed", e);
    } finally {
      setLoading(false);
    }
    return false;
  }, [markPro]);

  const restorePurchase = useCallback(async (email: string): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pro-status/${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.isPro) {
        markPro(data.email, data.foundingPlunger ?? false);
        return true;
      }
    } catch (e) {
      console.error("Restore failed", e);
    } finally {
      setLoading(false);
    }
    return false;
  }, [markPro]);

  const redeemPromo = useCallback(async (code: string): Promise<{ success: boolean; durationDays?: number; error?: string }> => {
    setLoading(true);
    try {
      const loggedInEmail = getLoggedInEmail();
      const res = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email: loggedInEmail ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error ?? "Invalid code" };
      localStorage.setItem(PROMO_EXPIRES_KEY, data.expiresAt);
      setPromoExpiresAt(data.expiresAt);
      setIsPro(true);
      if (loggedInEmail) {
        // Lock promo to this account and mark Stripe-style so restore works
        localStorage.setItem(PROMO_OWNER_KEY, loggedInEmail.toLowerCase());
        markPro(loggedInEmail, false);
      }
      return { success: true, durationDays: data.durationDays };
    } catch {
      return { success: false, error: "Something went wrong" };
    } finally {
      setLoading(false);
    }
  }, [markPro]);

  return { isPro, proEmail, promoExpiresAt, loading, isFoundingPlunger, startCheckout, verifySession, restorePurchase, clearPro, redeemPromo, verifyProForEmail };
}

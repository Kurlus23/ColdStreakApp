import { useState, useEffect, useCallback } from "react";
import {
  initIAP,
  logoutIAP,
  purchasePlan,
  restorePurchasesIAP,
  syncIAPToServer,
  isNativePlatform,
  isIOSNative,
  type IAPPlan,
} from "@/lib/iap";

const PRO_EMAIL_KEY = "coldstreak-pro-email";
const PRO_STATUS_KEY = "coldstreak-is-pro";
const PRO_PLAN_KEY = "coldstreak-pro-plan";
const PROMO_EXPIRES_KEY = "coldstreak-promo-expires";
const PROMO_OWNER_KEY = "coldstreak-promo-owner";
const AUTH_USER_KEY = "coldstreak-auth-user";
const FOUNDING_PLUNGER_KEY = "coldstreak-founding-plunger";
export const PENDING_CHECKOUT_KEY = "coldstreak-pending-checkout";
export const PENDING_SESSION_KEY = "coldstreak-pending-session";

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
  const [proPlan, setProPlan] = useState<string | null>(
    () => localStorage.getItem(PRO_PLAN_KEY)
  );
  const [promoExpiresAt, setPromoExpiresAt] = useState<string | null>(
    () => localStorage.getItem(PROMO_EXPIRES_KEY)
  );
  const [loading, setLoading] = useState(false);
  const [isFoundingPlunger, setIsFoundingPlunger] = useState<boolean>(
    () => localStorage.getItem(FOUNDING_PLUNGER_KEY) === "true"
  );

  const markPro = useCallback((email: string, foundingPlunger = false, planType?: string) => {
    localStorage.setItem(PRO_STATUS_KEY, "true");
    localStorage.setItem(PRO_EMAIL_KEY, email.toLowerCase());
    localStorage.setItem(FOUNDING_PLUNGER_KEY, String(foundingPlunger));
    if (planType) localStorage.setItem(PRO_PLAN_KEY, planType);
    setIsPro(true);
    setProEmail(email.toLowerCase());
    setIsFoundingPlunger(foundingPlunger);
    if (planType) setProPlan(planType);
  }, []);

  // Called on logout — clears Stripe pro flags but keeps promo so the same
  // user's promo survives a logout/login on the same device.
  const clearPro = useCallback(() => {
    localStorage.removeItem(PRO_STATUS_KEY);
    localStorage.removeItem(PRO_EMAIL_KEY);
    localStorage.removeItem(FOUNDING_PLUNGER_KEY);
    localStorage.removeItem(PRO_PLAN_KEY);
    setIsPro(false);
    setProEmail(null);
    setIsFoundingPlunger(false);
    setProPlan(null);
    // On native, also disconnect from RevenueCat so the next login binds a fresh
    // appUserId. On web this is a no-op.
    if (isNativePlatform()) {
      logoutIAP().catch(() => { /* swallow — user is logging out anyway */ });
    }
    // Promo expiry + owner are intentionally kept so the same user recovers
    // their promo after logging back in. verifyProForEmail() will clear them
    // if the logged-in email doesn't match the promo owner.
  }, []);

  // Called right after login to restore Pro from the server or local promo.
  const verifyProForEmail = useCallback(async (email: string) => {
    const norm = email.toLowerCase();

    // On native, bind the RevenueCat customer to this email and pull the
    // latest entitlement state. If the user already has Pro via IAP, this
    // syncs it to our DB so the rest of the app sees them as Pro immediately.
    if (isNativePlatform()) {
      try {
        await initIAP(norm);
        const sync = await syncIAPToServer(norm);
        if (sync.ok && sync.isPro) {
          markPro(norm, false, sync.planType ?? "monthly");
          return;
        }
      } catch (err) {
        console.error("[iap] verify-on-login failed", err);
      }
    }

    try {
      const res = await fetch(`/api/pro-status/${encodeURIComponent(norm)}`);
      const data = await res.json();
      if (data.isPro) {
        markPro(data.email, data.foundingPlunger ?? false, data.planType);
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

  // Verify cached pro status with the backend — runs on mount and whenever the
  // page becomes visible again (tab focus, app foreground). This ensures
  // subscription cancellations are detected without requiring a sign-out.
  useEffect(() => {
    // 30-second debounce prevents rapid-fire duplicate calls when tabs are toggled
    // quickly. The server has its own 5-min Stripe cache so it handles the heavy lifting.
    let lastCheck = 0;
    const DEBOUNCE_MS = 30 * 1000;

    function verify() {
      const cachedEmail = localStorage.getItem(PRO_EMAIL_KEY);
      if (!cachedEmail) return;

      const currentEmail = getLoggedInEmail();
      if (currentEmail && currentEmail.toLowerCase() !== cachedEmail.toLowerCase()) {
        clearPro();
        return;
      }

      const now = Date.now();
      if (now - lastCheck < DEBOUNCE_MS) return;
      lastCheck = now;

      fetch(`/api/pro-status/${encodeURIComponent(cachedEmail)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (data.isPro) {
            markPro(data.email, data.foundingPlunger ?? false, data.planType);
          } else {
            clearPro();
          }
        })
        .catch(() => {});
    }

    verify();

    // Check every time the user returns to the app (tab / Android foreground restore)
    function onVisibilityChange() {
      if (document.visibilityState === "visible") verify();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [markPro, clearPro]);

  const startCheckout = useCallback(async (plan: "lifetime" | "annual" | "monthly" = "lifetime"): Promise<{ success: boolean; activated?: boolean; error?: string }> => {
    setLoading(true);
    try {
      const emailForRestore = getLoggedInEmail() ?? localStorage.getItem(PRO_EMAIL_KEY);

      // iOS native: route through StoreKit/RevenueCat (App Review Guideline 3.1.1).
      // The web Stripe flow is disallowed for unlocking digital content on iOS.
      if (isIOSNative()) {
        if (!emailForRestore) {
          return { success: false, error: "Please sign in before purchasing." };
        }
        await initIAP(emailForRestore);
        const outcome = await purchasePlan(plan as IAPPlan);
        if (outcome.cancelled) return { success: false, error: "Purchase cancelled." };
        if (!outcome.success) return { success: false, error: outcome.error ?? "Purchase failed." };

        // Tell the server about the new entitlement so the rest of the app (and
        // the web account, if the user signs in there too) sees them as Pro.
        const sync = await syncIAPToServer(emailForRestore);
        const planType = sync.planType ?? plan;
        if (outcome.isPro || sync.isPro) {
          markPro(emailForRestore, false, planType);
          return { success: true, activated: true };
        }
        return { success: false, error: "Purchase completed but Pro is not active yet. Try Restore Purchases." };
      }

      const origin = window.location.origin;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          successUrl: `${origin}/`,
          cancelUrl: `${origin}/`,
          plan,
          email: emailForRestore ?? undefined,
        }),
      });
      const data = await res.json();
      // Server found an existing lifetime payment — activate directly, no new charge
      if (data.activated && data.email) {
        markPro(data.email, data.foundingPlunger ?? false, data.planType ?? "lifetime");
        return { success: true, activated: true };
      }
      if (data.url) {
        // Flag that we're leaving for Stripe — native app uses this to auto-restore on return
        localStorage.setItem(PENDING_CHECKOUT_KEY, emailForRestore ?? "unknown");
        // Store the session ID so we can verify even if the URL param gets dropped on redirect
        if (data.sessionId) localStorage.setItem(PENDING_SESSION_KEY, data.sessionId);
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
  }, [markPro]);

  const verifySession = useCallback(async (sessionId: string): Promise<string | false> => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stripe/verify?session_id=${sessionId}`);
      const data = await res.json();
      if (data.isPro && data.email) {
        markPro(data.email, data.foundingPlunger ?? false, data.planType);
        return (data.planType as string) || "lifetime";
      }
    } catch (e) {
      console.error("Verify failed", e);
    } finally {
      setLoading(false);
    }
    return false;
  }, [markPro]);

  const restorePurchase = useCallback(async (email: string): Promise<{ success: boolean; planType?: string }> => {
    setLoading(true);
    try {
      // On iOS native, ask RevenueCat / StoreKit first — this restores any
      // App Store purchase made on this Apple ID even if our server doesn't
      // know about it yet. Then sync the result back to our DB.
      if (isIOSNative()) {
        try {
          await initIAP(email);
          const restored = await restorePurchasesIAP();
          if (restored.success && restored.isPro) {
            const sync = await syncIAPToServer(email);
            const planType = sync.planType ?? "monthly";
            markPro(email, false, planType);
            return { success: true, planType };
          }
        } catch (err) {
          console.error("[iap] restore failed", err);
        }
      }

      const res = await fetch(`/api/pro-status/${encodeURIComponent(email)}?noCache=1`, { cache: "no-store" });
      const data = await res.json();
      if (data.isPro) {
        markPro(data.email, data.foundingPlunger ?? false, data.planType);
        return { success: true, planType: data.planType };
      }
    } catch (e) {
      console.error("Restore failed", e);
    } finally {
      setLoading(false);
    }
    return { success: false };
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
        markPro(loggedInEmail, false, "promo");
      }
      return { success: true, durationDays: data.durationDays };
    } catch {
      return { success: false, error: "Something went wrong" };
    } finally {
      setLoading(false);
    }
  }, [markPro]);

  return { isPro, proEmail, proPlan, promoExpiresAt, loading, isFoundingPlunger, startCheckout, verifySession, restorePurchase, clearPro, redeemPromo, verifyProForEmail };
}

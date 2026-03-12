import { useState, useEffect, useCallback } from "react";

const PRO_EMAIL_KEY = "coldstreak-pro-email";
const PRO_STATUS_KEY = "coldstreak-is-pro";
const AUTH_USER_KEY = "coldstreak-auth-user";

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

export function useProStatus() {
  const [isPro, setIsPro] = useState<boolean>(() => {
    const cached = localStorage.getItem(PRO_STATUS_KEY) === "true";
    if (!cached) return false;
    // If a different user is logged in, don't inherit Pro from previous account
    const proEmail = localStorage.getItem(PRO_EMAIL_KEY);
    const loggedInEmail = getLoggedInEmail();
    if (loggedInEmail && proEmail && loggedInEmail !== proEmail) return false;
    return true;
  });
  const [proEmail, setProEmail] = useState<string | null>(
    () => localStorage.getItem(PRO_EMAIL_KEY)
  );
  const [loading, setLoading] = useState(false);

  const markPro = useCallback((email: string) => {
    localStorage.setItem(PRO_STATUS_KEY, "true");
    localStorage.setItem(PRO_EMAIL_KEY, email);
    setIsPro(true);
    setProEmail(email);
  }, []);

  const clearPro = useCallback(() => {
    localStorage.removeItem(PRO_STATUS_KEY);
    localStorage.removeItem(PRO_EMAIL_KEY);
    setIsPro(false);
    setProEmail(null);
  }, []);

  // On mount, verify cached pro status with the backend
  useEffect(() => {
    const cachedEmail = localStorage.getItem(PRO_EMAIL_KEY);
    if (!cachedEmail) return;

    // If a different user is logged in, clear Pro immediately
    const loggedInEmail = getLoggedInEmail();
    if (loggedInEmail && loggedInEmail !== cachedEmail) {
      clearPro();
      return;
    }

    fetch(`/api/pro-status/${encodeURIComponent(cachedEmail)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.isPro) {
          markPro(data.email);
        } else {
          clearPro();
        }
      })
      .catch(() => {});
  }, [markPro, clearPro]);

  const startCheckout = useCallback(async () => {
    setLoading(true);
    try {
      const origin = window.location.origin;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          successUrl: `${origin}/`,
          cancelUrl: `${origin}/`,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      console.error("Checkout failed", e);
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
        markPro(data.email);
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
        markPro(data.email);
        return true;
      }
    } catch (e) {
      console.error("Restore failed", e);
    } finally {
      setLoading(false);
    }
    return false;
  }, [markPro]);

  return { isPro, proEmail, loading, startCheckout, verifySession, restorePurchase, clearPro };
}

import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import App from "./App";
import "./index.css";
import { initMonitoring } from "./lib/monitoring";
import { initIAP, isNativePlatform } from "./lib/iap";

initMonitoring();

// Configure RevenueCat as early as possible on native (iOS/Android).
// Pass the cached email if available so the IAP customer is tied to our user.
if (isNativePlatform()) {
  let cachedEmail: string | null = null;
  try {
    const raw = localStorage.getItem("coldstreak-auth-user");
    if (raw) cachedEmail = JSON.parse(raw)?.email ?? null;
  } catch { /* ignore */ }
  initIAP(cachedEmail).catch((err) => console.error("[iap] boot init failed", err));
}

if ((window as any).Capacitor?.isNativePlatform?.()) {
  const _fetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/")) {
      return _fetch(`https://coldstreakapp.com${input}`, init);
    }
    return _fetch(input, init);
  };
}

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined;


if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.debug();
    },
  });
}

const root = document.getElementById("root")!;

createRoot(root).render(
  POSTHOG_KEY ? (
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  ) : (
    <App />
  )
);


import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import App from "./App";
import "./index.css";
import { initMonitoring } from "./lib/monitoring";

initMonitoring();

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


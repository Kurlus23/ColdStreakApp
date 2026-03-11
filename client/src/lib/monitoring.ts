import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initMonitoring() {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
  });
}

export { Sentry };

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error, { extra: context });
}

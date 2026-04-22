import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import jwt from "jsonwebtoken";

// Idempotent bootstrap for tables added after the initial deploy that may not
// yet exist on the prod DB. Cheap, runs once on startup, never throws.
async function ensureRuntimeTables() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS share_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        client_id TEXT,
        kind TEXT NOT NULL,
        target_id TEXT,
        channel TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS share_events_user_id_idx    ON share_events(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS share_events_created_at_idx ON share_events(created_at DESC)`);
  } catch (err) {
    console.error("[bootstrap] ensureRuntimeTables failed:", err);
  }
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const ALLOWED_ORIGINS = [
  "https://coldstreakapp.com",
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
  /^http:\/\/localhost:\d+$/,
];

app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  const allowed = ALLOWED_ORIGINS.some((o) =>
    typeof o === "string" ? o === origin : o.test(origin)
  );
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Client-Id,X-Client-Platform,X-Client-Timezone");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// ── First-touch / activity tracker ────────────────────────────────────────
// Records API requests that carry a clientId so we have a server-side ground
// truth for "real visitors" independent of GA. Fire-and-forget — never blocks
// the response. Per-process throttle keeps DB writes to ~1/device/5min.
const VISIT_THROTTLE_MS = 5 * 60 * 1000;
const lastVisitWriteAt = new Map<string, number>();
// Soft cap to prevent unbounded memory growth in long-running process.
function pruneVisitCache() {
  if (lastVisitWriteAt.size <= 10_000) return;
  const cutoff = Date.now() - VISIT_THROTTLE_MS;
  for (const [k, t] of lastVisitWriteAt) if (t < cutoff) lastVisitWriteAt.delete(k);
}

// Must match the secret used by routes.ts to sign auth tokens, otherwise
// jwt.verify() silently fails here and we lose the ability to attribute
// visits/geo to a user.
const VISIT_JWT_SECRET = process.env.SESSION_SECRET || "coldstreak-dev-secret";

app.use((req, _res, next) => {
  next();
  try {
    if (!req.path.startsWith("/api/")) return;
    if (req.path.startsWith("/api/admin/visits")) return; // don't self-track admin polling
    // Accept clientId only via the dedicated header — single canonical channel.
    const clientId = (req.headers["x-client-id"] as string | undefined) || undefined;
    if (!clientId || clientId.length < 8 || clientId.length > 128) return;

    // Per-process throttle: skip if we wrote for this client recently.
    const now = Date.now();
    const last = lastVisitWriteAt.get(clientId) ?? 0;
    if (now - last < VISIT_THROTTLE_MS) return;
    lastVisitWriteAt.set(clientId, now);
    pruneVisitCache();

    const ua = (req.headers["user-agent"] as string | undefined) || undefined;
    // Prefer the explicit platform sent by the client (knows about Capacitor
    // native vs PWA standalone vs regular browser). Fall back to UA sniffing.
    const headerPlatform = req.headers["x-client-platform"];
    let platform: string;
    if (typeof headerPlatform === "string" && headerPlatform.length > 0 && headerPlatform.length <= 40) {
      platform = headerPlatform;
    } else {
      platform = /capacitor|coldstreak/i.test(ua || "") ? "Native App"
        : /android/i.test(ua || "") ? "Android Web"
        : /iphone|ipad|ios/i.test(ua || "") ? "iOS Safari"
        : "Desktop Web";
    }

    // Best-effort: link the device to a verified user when a valid Bearer is present.
    let userId: number | undefined;
    const auth = req.headers.authorization;
    // TEMP diagnostic
    console.error("[visits] path=", req.path,
      "hasAuth=", !!auth,
      "authPrefix=", auth ? auth.slice(0, 10) : "none",
      "headers=", Object.keys(req.headers).filter(k => k.startsWith("x-") || k === "authorization").join(","));
    if (auth?.startsWith("Bearer ")) {
      try {
        const payload = jwt.verify(auth.slice(7), VISIT_JWT_SECRET) as { id?: number };
        if (typeof payload?.id === "number") userId = payload.id;
        console.error("[visits] verify OK userId=", userId);
      } catch (e) {
        console.error("[visits] jwt verify failed:", (e as Error)?.message,
          "secretLen=", VISIT_JWT_SECRET.length,
          "envSet=", !!process.env.SESSION_SECRET);
      }
    }

    const tzHeader = req.headers["x-client-timezone"];
    const timezone = (typeof tzHeader === "string" && tzHeader.length > 0 && tzHeader.length <= 64)
      ? tzHeader : undefined;
    const cfCountry = req.headers["cf-ipcountry"];
    const country = (typeof cfCountry === "string" && cfCountry.length === 2 && cfCountry !== "XX")
      ? cfCountry.toUpperCase() : undefined;
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      || req.socket.remoteAddress || undefined;

    storage.recordClientVisit({
      clientId,
      userAgent: ua?.slice(0, 200),
      path: req.path.slice(0, 200),
      platform,
      userId,
      timezone,
      country,
      ip,
    }).catch((err) => console.error("[visits] record failed:", err?.message ?? err));
  } catch (err) {
    console.error("[visits] middleware error:", err);
  }
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // Seed restore promo code on every boot (no-op if already exists)
  await storage.seedPromoCode("TESTINGPRO", 30, 20);

  // Clear display_name from admin accounts so they never collide with real user profiles
  await storage.clearAdminDisplayNames();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      void ensureRuntimeTables();
    },
  );
})();

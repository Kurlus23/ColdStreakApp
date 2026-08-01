/**
 * Task #185 — Verify the coach gives goal-specific answers for each benefit type.
 *
 * Runs against the live DB + Gemini API.
 * Creates four temporary test users (one per benefit), asks the same question,
 * verifies the reply mentions goal-relevant keywords, then cleans up.
 */

import { db } from "../server/db";
import { users, plunges } from "@shared/schema";
import { eq } from "drizzle-orm";
import { coachChat } from "../server/coach";

const QUESTION = "how long should I plunge?";

const BENEFIT_KEYWORDS: Record<string, string[]> = {
  energy:     ["energy", "norepinephrine", "focus", "alert", "energi"],
  mood:       ["mood", "dopamine", "serotonin", "emotional", "lift"],
  metabolism: ["metaboli", "calorie", "brown fat", "burn", "thermogen"],
  recovery:   ["recover", "inflammat", "soreness", "muscle", "anti-inflam"],
};

const TEST_EMAIL_PREFIX = "test-coach-benefit-";

async function cleanupTestUsers() {
  for (const benefit of ["energy", "mood", "metabolism", "recovery", "none"]) {
    const email = `${TEST_EMAIL_PREFIX}${benefit}@test.invalid`;
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) {
      await db.delete(plunges).where(eq(plunges.userId, existing.id));
      await db.delete(users).where(eq(users.id, existing.id));
    }
  }
}

async function createTestUser(benefit: string | null): Promise<number> {
  const label = benefit ?? "none";
  const email = `${TEST_EMAIL_PREFIX}${label}@test.invalid`;

  // Remove any leftover from previous run
  const [old] = await db.select().from(users).where(eq(users.email, email));
  if (old) {
    await db.delete(plunges).where(eq(plunges.userId, old.id));
    await db.delete(users).where(eq(users.id, old.id));
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash: "test-hash",
      username: `testcoach${label}${Date.now()}`,
      primaryBenefit: benefit,
    })
    .returning();

  return user.id;
}

async function run() {
  console.log("=== Coach Benefit-Goal Test ===\n");

  // Clean up leftovers first
  await cleanupTestUsers();

  const results: { benefit: string; passed: boolean; reply: string; matched: string[] }[] = [];

  // ── Test each benefit ──────────────────────────────────────────────────────
  for (const benefit of ["energy", "mood", "metabolism", "recovery"] as const) {
    process.stdout.write(`Testing benefit=${benefit} ... `);

    const userId = await createTestUser(benefit);
    let reply = "";
    let passed = false;
    let matched: string[] = [];

    try {
      const result = await coachChat(userId, QUESTION, []);
      reply = result.reply;

      const replyLower = reply.toLowerCase();
      matched = BENEFIT_KEYWORDS[benefit].filter(kw => replyLower.includes(kw.toLowerCase()));
      passed = matched.length > 0;
    } catch (err) {
      reply = `ERROR: ${err}`;
    }

    console.log(passed ? "✅ PASS" : "❌ FAIL");
    if (!passed) {
      console.log(`  Keywords expected (any of): ${BENEFIT_KEYWORDS[benefit].join(", ")}`);
      console.log(`  Reply: ${reply.slice(0, 300)}...`);
    } else {
      console.log(`  Matched: ${matched.join(", ")}`);
      console.log(`  Reply excerpt: ${reply.slice(0, 200)}...`);
    }

    results.push({ benefit, passed, reply, matched });
  }

  // ── Test no benefit set ────────────────────────────────────────────────────
  process.stdout.write(`Testing benefit=none (no primaryBenefit) ... `);
  const nobenefitId = await createTestUser(null);
  let nobenefitPassed = false;
  let nobenefitReply = "";

  try {
    const result = await coachChat(nobenefitId, QUESTION, []);
    nobenefitReply = result.reply;
    // For no-benefit: just needs a non-empty, coherent answer (contains duration info)
    const lower = nobenefitReply.toLowerCase();
    nobenefitPassed =
      nobenefitReply.length > 50 &&
      (lower.includes("minute") || lower.includes("second") || lower.includes("min") || lower.includes("sec") || lower.includes("duration") || lower.includes("long"));
  } catch (err) {
    nobenefitReply = `ERROR: ${err}`;
  }

  console.log(nobenefitPassed ? "✅ PASS" : "❌ FAIL");
  console.log(`  Reply excerpt: ${nobenefitReply.slice(0, 200)}...`);

  // ── Clean up ───────────────────────────────────────────────────────────────
  await cleanupTestUsers();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n=== Summary ===");
  const allPassed = results.every(r => r.passed) && nobenefitPassed;
  for (const r of results) {
    console.log(`  ${r.passed ? "✅" : "❌"} benefit=${r.benefit}${r.matched.length ? ` (matched: ${r.matched.join(", ")})` : ""}`);
  }
  console.log(`  ${nobenefitPassed ? "✅" : "❌"} benefit=none (generic answer)`);
  console.log(`\nOverall: ${allPassed ? "ALL PASSED" : "SOME FAILED"}`);

  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});

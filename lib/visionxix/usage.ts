/**
 * Vision XIX AI — Usage tracking using Firebase Admin SDK (server-side only)
 */

import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  PlanTier,
  getEffectiveMessageLimit,
} from "./plans";

const BOTS_COL = "visionxix_bots";
const USAGE_COL = "visionxix_usage";

export interface BotConfig {
  botId: string;
  plan: PlanTier;
  addOn10k?: boolean;
  addOn25k?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

function yearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Get current month message usage for a bot
 */
export async function getMessageUsage(
  botId: string,
  ym: string = yearMonth()
): Promise<number> {
  try {
    const adminDb = getAdminDb();
    const ref = adminDb.collection(USAGE_COL).doc(`${botId}_${ym}`);
    const snap = await ref.get();
    return snap.exists ? (snap.data()?.messageCount ?? 0) : 0;
  } catch {
    return 0;
  }
}

/**
 * Increment message count and return new total.
 */
export async function incrementMessageUsage(botId: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
}> {
  const ym = yearMonth();
  const adminDb = getAdminDb();

  const botRef = adminDb.collection(BOTS_COL).doc(botId);
  const botSnap = await botRef.get();
  if (!botSnap.exists) {
    throw new Error("Bot not found. Please use a valid bot ID from your Vision XIX Labs dashboard.");
  }

  const data = botSnap.data();
  const plan = (data?.plan ?? "demo") as PlanTier;
  const addOn10k = !!data?.addOn10k;
  const addOn25k = !!data?.addOn25k;
  const limit = getEffectiveMessageLimit(plan, addOn10k, addOn25k);

  const usageRef = adminDb.collection(USAGE_COL).doc(`${botId}_${ym}`);
  const usageSnap = await usageRef.get();
  const current = usageSnap.exists ? (usageSnap.data()?.messageCount ?? 0) : 0;

  if (current >= limit) {
    return { used: current, limit, remaining: 0 };
  }

  const newCount = current + 1;

  if (usageSnap.exists) {
    await usageRef.update({
      messageCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await usageRef.set({
      botId,
      yearMonth: ym,
      messageCount: newCount,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return {
    used: newCount,
    limit,
    remaining: limit - newCount,
  };
}

/**
 * Check if bot can send a message without incrementing
 */
export async function canSendMessage(botId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}> {
  const ym = yearMonth();
  const used = await getMessageUsage(botId, ym);

  const adminDb = getAdminDb();
  const botRef = adminDb.collection(BOTS_COL).doc(botId);
  const botSnap = await botRef.get();
  if (!botSnap.exists) {
    return { allowed: false, used: 0, limit: 0, remaining: 0 };
  }

  const data = botSnap.data();
  const plan = (data?.plan ?? "demo") as PlanTier;
  const addOn10k = !!data?.addOn10k;
  const addOn25k = !!data?.addOn25k;
  const limit = getEffectiveMessageLimit(plan, addOn10k, addOn25k);

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Create or update bot config. Call from Stripe webhook / admin.
 */
export async function upsertBot(config: BotConfig): Promise<void> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection(BOTS_COL).doc(config.botId);
  await ref.set(
    {
      ...config,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

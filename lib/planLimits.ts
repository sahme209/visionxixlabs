/** Plan limits for legacy bots/chat features */
export function getPlanLimits(plan: string | null) {
  const limits: Record<string, { messages: number; pages: number; bots: number }> = {
    starter: { messages: 500, pages: 5, bots: 1 },
    pro: { messages: 5000, pages: 50, bots: 5 },
    enterprise: { messages: 50000, pages: 500, bots: 50 },
  };
  return limits[plan ?? "starter"] ?? limits.starter;
}

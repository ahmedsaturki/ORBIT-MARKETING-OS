export interface AccountActivity {
  readonly tasksAttempted: number;
  readonly tasksSucceeded: number;
  readonly tasksFailed: number;
  readonly challenges: number;
  readonly daysActive: number;
}

export interface SafetyBudget {
  readonly dailyLimit: number;
  readonly rationale: string;
}

/**
 * Calculate a conservative ramp-up budget. This is a local rate limit,
 * not a mechanism for evading platform enforcement.
 */
export function calculateWarmupBudget(
  daysActive: number,
  baseDailyLimit = 3,
  weeklyGrowth = 0.2,
  maxDailyLimit = 100,
): SafetyBudget {
  if (!Number.isInteger(daysActive) || daysActive < 0) throw new RangeError("daysActive must be non-negative");
  if (baseDailyLimit < 1 || weeklyGrowth < 0 || maxDailyLimit < baseDailyLimit) {
    throw new RangeError("invalid warm-up parameters");
  }

  const weeks = Math.floor(daysActive / 7);
  const rawLimit = baseDailyLimit * (1 + weeklyGrowth) ** weeks;
  const dailyLimit = Math.max(baseDailyLimit, Math.min(maxDailyLimit, Math.floor(rawLimit)));

  return {
    dailyLimit,
    rationale: weeks === 0
      ? "initial conservative operating budget"
      : "incremental local budget based on account age",
  };
}

export function calculateHealthScore(activity: AccountActivity): number {
  if (activity.tasksAttempted < 0 || activity.tasksSucceeded < 0 || activity.tasksFailed < 0 || activity.challenges < 0) {
    throw new RangeError("activity counts must be non-negative");
  }
  if (activity.tasksSucceeded + activity.tasksFailed > activity.tasksAttempted) {
    throw new RangeError("completed counts cannot exceed attempts");
  }

  if (activity.tasksAttempted === 0) return 100;

  const successRate = activity.tasksSucceeded / activity.tasksAttempted;
  const failureRate = activity.tasksFailed / activity.tasksAttempted;
  const challengePenalty = Math.min(30, activity.challenges * 10);
  const ageBonus = Math.min(10, Math.floor(Math.max(0, activity.daysActive) / 7));

  const score = Math.round(70 * successRate - 30 * failureRate + ageBonus + 30);
  return Math.max(0, Math.min(100, score - challengePenalty));
}

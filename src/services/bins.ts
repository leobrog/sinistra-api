/**
 * BGS Bins Calculation Service
 *
 * Pure math functions for BGS (Background Simulation) bucket calculations.
 * Converts raw activity values (pluses, credits, counts) into BGS points
 * and computes thresholds for the next point.
 *
 * Bucket thresholds (4× progression unless noted):
 *   Missions:     4, 16, 64, 256, …       (influence pluses)
 *   Exploration:  2M, 8M, 32M, 128M, …    (credits)
 *   Bounty:       400K, 800K, 1.6M, …     (credits, 2× progression)
 *   Scenarios:    4, 16, 64, …            (count)
 *   Mission fail: 4, 16, 64, …            (count, negative)
 *   Murder:       4, 16, 64, …            (count, negative)
 *   Smuggling:    40, 160, 640, …         (count, negative)
 */

// ─── First-point thresholds ────────────────────────────────────────────────────

export const MISSIONS_FIRST_THRESHOLD = 4
export const EXPLORATION_FIRST_THRESHOLD = 2_000_000
export const BOUNTY_FIRST_THRESHOLD = 400_000
export const SCENARIOS_FIRST_THRESHOLD = 4
export const MISSION_FAIL_FIRST_THRESHOLD = 4
export const MURDER_FIRST_THRESHOLD = 4
export const SMUGGLING_FIRST_THRESHOLD = 40

// ─── BGS Points Calculations ───────────────────────────────────────────────────

/**
 * BGS points for mission influence pluses (4× progression, firstThreshold = 4).
 * Each "+" character from mission reward influence strings counts as one plus.
 */
export const bgsPointsMissions = (pluses: number): number => {
  if (pluses < MISSIONS_FIRST_THRESHOLD) return 0
  return Math.floor(Math.log(pluses) / Math.log(4))
}

/**
 * BGS points for exploration sales (4× progression, firstThreshold = 2 000 000 cr).
 */
export const bgsPointsExploration = (credits: number): number => {
  if (credits < EXPLORATION_FIRST_THRESHOLD) return 0
  // Equivalent to floor(log4(credits / 500_000)) which crosses 1 at 2M
  return Math.floor(Math.log(credits / 500_000) / Math.log(4))
}

/**
 * BGS points for bounty vouchers (2× progression, firstThreshold = 400 000 cr).
 */
export const bgsPointsBounty = (credits: number): number => {
  if (credits < BOUNTY_FIRST_THRESHOLD) return 0
  // Equivalent to floor(log2(credits / 200_000)) which crosses 1 at 400K
  return Math.floor(Math.log(credits / 200_000) / Math.log(2))
}

/**
 * Generic BGS points for count-based buckets (4× progression by default).
 *
 * @param n - Current raw count
 * @param firstThreshold - Count needed for the first point
 * @param multiplier - Progression multiplier (default 4; use 2 for bounty-style)
 */
export const bgsPointsCount = (
  n: number,
  firstThreshold: number,
  multiplier: 2 | 4 = 4
): number => {
  if (n < firstThreshold) return 0
  return Math.floor(Math.log(n / firstThreshold) / Math.log(multiplier)) + 1
}

// ─── Threshold helpers ─────────────────────────────────────────────────────────

/**
 * Raw value required to earn the next BGS point beyond `currentPts`.
 *
 * Examples (missions, firstThreshold=4, multiplier=4):
 *   currentPts=0 → 4   (need 4 pluses for 1st point)
 *   currentPts=1 → 16  (need 16 pluses for 2nd point)
 *   currentPts=2 → 64
 *
 * @param currentPts - Points already earned in this bucket
 * @param firstThreshold - Raw value that earns the first point
 * @param multiplier - Progression multiplier (2 or 4)
 */
export const nextThreshold = (
  currentPts: number,
  firstThreshold: number,
  multiplier: 2 | 4
): number => {
  return firstThreshold * Math.pow(multiplier, currentPts)
}

/**
 * How much more raw value is needed to reach the next threshold from the
 * current accumulated value. Returns 0 if already at or past the threshold.
 */
export const remaining = (currentRaw: number, threshold: number): number => {
  return Math.max(0, threshold - currentRaw)
}

// ─── Influence Prediction ──────────────────────────────────────────────────────

/**
 * Compute the approximate maximum influence swing for a system.
 * Formula: 36 − log₂(population)
 */
export const computeMaxSwing = (population: number): number => {
  if (population <= 0) return 0
  return 36 - Math.log2(population)
}

export interface InfluencePrediction {
  /** Influence lost to "tax" (proportional to current influence share). */
  predictedTax: number
  /** Maximum influence gain if unopposed, based on net BGS score. */
  predictedGainUnopposed: number
  /** Net expected change: gainUnopposed − tax. */
  predictedInfluenceChange: number
}

/**
 * Predict influence change for a faction this tick (simplified model).
 *
 * Tax:        currentInfluence / 100 × maxSwing
 * Gain:       (min(netPts, 10) / 10) × maxSwing
 * Net change: gain − tax
 *
 * @param netPts - Net BGS points this tick (positive − negative, uncapped)
 * @param currentInfluence - Faction's current influence percentage (0–100)
 * @param maxSwing - Maximum swing for the system (from computeMaxSwing)
 */
export const predictInfluenceGain = (
  netPts: number,
  currentInfluence: number,
  maxSwing: number
): InfluencePrediction => {
  const cappedPts = Math.min(Math.max(netPts, 0), 10)
  const predictedGainUnopposed = (cappedPts / 10) * maxSwing
  const predictedTax = (currentInfluence / 100) * maxSwing
  const predictedInfluenceChange = predictedGainUnopposed - predictedTax
  return { predictedTax, predictedGainUnopposed, predictedInfluenceChange }
}

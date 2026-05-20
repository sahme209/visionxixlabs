/**
 * Pure cost forecaster.
 *
 * Given a rolling-window of daily usage (e.g. last 7 days of tokens or
 * dollars), project month-to-date + month-end totals using a simple
 * linear average. Operators use the forecast to spot a tenant about
 * to blow past a cap before the bill arrives.
 *
 * Pure / deterministic. No tier knowledge — caller layers tier caps on
 * top of the forecast.
 */

export interface DailyUsagePoint {
  /** UTC date key, YYYY-MM-DD. */
  dateKey: string;
  /** Usage value for the day (tokens, dollars, count — caller picks). */
  value: number;
}

export interface CostForecastInput {
  windowDaily: readonly DailyUsagePoint[];
  /** YYYY-MM (calendar month being forecast). */
  month: string;
  /** Optional cap to flag the forecast against. */
  cap?: number;
  /** Day-of-month so the forecaster knows progress through the month. Default: today. */
  asOfDayOfMonth?: number;
  /** Total days in the calendar month. Default 30. */
  daysInMonth?: number;
}

export interface CostForecast {
  month: string;
  asOfDay: number;
  daysInMonth: number;
  averageDailyUsage: number;
  projectedMonthEnd: number;
  /** Sum of all values in the supplied window. */
  windowTotal: number;
  /** True iff cap supplied and projectedMonthEnd >= cap. */
  willExceedCap: boolean;
  capRatio: number;
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

export function forecastCost(input: CostForecastInput): CostForecast {
  const windowVals = input.windowDaily.map((p) => p.value);
  const windowTotal = sum(windowVals);
  const averageDailyUsage = windowVals.length === 0 ? 0 : windowTotal / windowVals.length;
  const daysInMonth = Math.max(28, Math.min(31, input.daysInMonth ?? 30));
  const asOfDay = Math.max(1, Math.min(daysInMonth, input.asOfDayOfMonth ?? daysInMonth));
  const projectedMonthEnd = averageDailyUsage * daysInMonth;
  const cap = input.cap;
  const willExceedCap = typeof cap === "number" && cap > 0 ? projectedMonthEnd >= cap : false;
  const capRatio = typeof cap === "number" && cap > 0 ? projectedMonthEnd / cap : 0;

  return {
    month: input.month,
    asOfDay,
    daysInMonth,
    averageDailyUsage,
    projectedMonthEnd,
    windowTotal,
    willExceedCap,
    capRatio,
  };
}

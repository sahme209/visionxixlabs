/**
 * Pure cron-expression validator (5-field standard cron).
 *
 * Validates fields, returns the parsed structure, and produces a
 * human-readable description ("every 5 minutes", "every Monday at
 * 14:00"). No external libraries; no DB.
 *
 * Pure / deterministic.
 */

export interface CronParts {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export interface CronValidationReport {
  valid: boolean;
  parts: CronParts | null;
  errors: string[];
  /** Operator-readable description; "(invalid)" when valid=false. */
  humanReadable: string;
}

const FIELD_RANGES: Record<keyof CronParts, [number, number]> = {
  minute:     [0, 59],
  hour:       [0, 23],
  dayOfMonth: [1, 31],
  month:      [1, 12],
  dayOfWeek:  [0, 6],
};

const FIELD_ORDER: Array<keyof CronParts> = ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"];

function isInteger(s: string): boolean {
  return /^-?\d+$/.test(s);
}

function validateOneField(field: keyof CronParts, raw: string): string | null {
  if (raw === "*") return null;
  const [min, max] = FIELD_RANGES[field];
  // Allow lists like "1,3,5"
  if (raw.includes(",")) {
    for (const part of raw.split(",")) {
      const e = validateOneField(field, part);
      if (e) return e;
    }
    return null;
  }
  // Range "5-10"
  if (raw.includes("-") && !raw.startsWith("-")) {
    const [a, b] = raw.split("-");
    if (!isInteger(a) || !isInteger(b)) return `invalid range in ${field}`;
    const ai = Number(a), bi = Number(b);
    if (ai < min || bi > max || ai > bi) return `out-of-range range in ${field}`;
    return null;
  }
  // Step "*/5" or "5-10/2"
  if (raw.includes("/")) {
    const [base, step] = raw.split("/");
    if (!isInteger(step) || Number(step) <= 0) return `invalid step in ${field}`;
    if (base === "*") return null;
    return validateOneField(field, base);
  }
  // Bare number
  if (!isInteger(raw)) return `non-numeric in ${field}`;
  const v = Number(raw);
  if (v < min || v > max) return `out-of-range in ${field} (got ${v}, allowed ${min}..${max})`;
  return null;
}

function describe(parts: CronParts): string {
  const { minute, hour, dayOfMonth, month, dayOfWeek } = parts;
  // Step pattern → "every N minutes".
  if (minute.startsWith("*/") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `every ${minute.slice(2)} minutes`;
  }
  // Hourly at minute X.
  if (isInteger(minute) && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `every hour at minute ${minute}`;
  }
  // Daily at HH:MM.
  if (isInteger(minute) && isInteger(hour) && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `daily at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  // Weekly on dayOfWeek at HH:MM.
  if (isInteger(minute) && isInteger(hour) && dayOfMonth === "*" && month === "*" && isInteger(dayOfWeek)) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return `every ${days[Number(dayOfWeek) % 7]} at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  return `cron ${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
}

export function validateCron(expression: string): CronValidationReport {
  const errors: string[] = [];
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    return { valid: false, parts: null, errors: ["empty expression"], humanReadable: "(invalid)" };
  }
  const tokens = trimmed.split(/\s+/);
  if (tokens.length !== 5) {
    return {
      valid: false, parts: null,
      errors: [`expected 5 fields, got ${tokens.length}`],
      humanReadable: "(invalid)",
    };
  }
  const parts: CronParts = {
    minute: tokens[0], hour: tokens[1], dayOfMonth: tokens[2], month: tokens[3], dayOfWeek: tokens[4],
  };
  for (const field of FIELD_ORDER) {
    const err = validateOneField(field, parts[field]);
    if (err) errors.push(err);
  }
  if (errors.length > 0) {
    return { valid: false, parts, errors, humanReadable: "(invalid)" };
  }
  return { valid: true, parts, errors: [], humanReadable: describe(parts) };
}

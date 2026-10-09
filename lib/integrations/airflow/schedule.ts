const FIELD_RANGES = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]] as const;

function matchesField(field: string, value: number, min: number, max: number): boolean {
  return field.split(",").some((part) => {
    if (part === "*") return true;
    if (part.startsWith("*/")) {
      const step = Number(part.slice(2));
      return Number.isInteger(step) && step > 0 && step <= max && (value - min) % step === 0;
    }
    const number = Number(part);
    return Number.isInteger(number) && number >= min && number <= max && number === value;
  });
}

export function isValidUtcCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  return fields.length === 5 && fields.every((field, index) => field.split(",").every((part) => {
    if (part === "*") return true;
    if (part.startsWith("*/")) return /^\*\/[1-9]\d*$/.test(part) && Number(part.slice(2)) <= FIELD_RANGES[index][1];
    return /^\d+$/.test(part) && Number(part) >= FIELD_RANGES[index][0] && Number(part) <= FIELD_RANGES[index][1];
  }));
}

export function nextCronOccurrence(expression: string, after = new Date()): Date {
  if (!isValidUtcCron(expression)) throw new Error("invalid_schedule_cron");
  const fields = expression.trim().split(/\s+/);
  const candidate = new Date(after);
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  for (let minute = 0; minute < 527_040; minute += 1) {
    const values = [candidate.getUTCMinutes(), candidate.getUTCHours(), candidate.getUTCDate(), candidate.getUTCMonth() + 1, candidate.getUTCDay()];
    if (values.every((value, index) => matchesField(fields[index], value, FIELD_RANGES[index][0], FIELD_RANGES[index][1]))) return candidate;
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  throw new Error("schedule_has_no_occurrence");
}
